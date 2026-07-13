/**
 * Mira Prospects — materialização do espelho de CNPJ (lógica pura, sem cron).
 *
 * Separado de cnpjMirrorSync.ts (que cria a fila BullMQ no import e conecta no
 * Redis) para que o verify-bigquery.ts / scripts standalone possam rodar a
 * sincronização SEM tocar em Redis. Ver cnpjMirrorSync.ts e doc 10.
 */
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { bigQueryDisponivel, getBigQueryClient, gbToBytes } from './bigqueryClient.js';

const SRC = 'basedosdados.br_me_cnpj.estabelecimentos';
const SRC_DATASET = 'basedosdados.br_me_cnpj';

/** Nome totalmente qualificado da tabela espelho (projeto.dataset.tabela). */
export function mirrorFqn(): { project: string; dataset: string; table: string; fqn: string } {
  const project = env.BIGQUERY_PROJECT_ID as string;
  const [dataset, table] = env.BIGQUERY_MIRROR_TABLE.split('.');
  return { project, dataset, table, fqn: `${project}.${dataset}.${table}` };
}

/** Data (YYYY-MM-DD) da partição mais recente da origem, via metadados (custo ~0). */
export async function snapshotMaisRecente(): Promise<string | null> {
  const bq = getBigQueryClient();
  const [rows] = await bq.query({
    query: `SELECT partition_id
            FROM \`${SRC_DATASET}.INFORMATION_SCHEMA.PARTITIONS\`
            WHERE table_name = 'estabelecimentos'
              AND partition_id NOT IN ('__NULL__', '__UNPARTITIONED__')
            ORDER BY partition_id DESC
            LIMIT 1`,
    useLegacySql: false,
  });
  const pid = (rows as any[])[0]?.partition_id as string | undefined;
  if (!pid || pid.length !== 8) return null;
  return `${pid.slice(0, 4)}-${pid.slice(4, 6)}-${pid.slice(6, 8)}`;
}

/** Snapshot já materializado na tabela espelho (ou null se a tabela não existe). */
export async function snapshotEspelhado(): Promise<string | null> {
  const { dataset, table, fqn } = mirrorFqn();
  const bq = getBigQueryClient();
  const [exists] = await bq.dataset(dataset).table(table).exists();
  if (!exists) return null;
  const [rows] = await bq.query({
    query: `SELECT CAST(MAX(_data_snapshot) AS STRING) AS s FROM \`${fqn}\``,
    useLegacySql: false,
  });
  return ((rows as any[])[0]?.s as string) ?? null;
}

export interface CnpjMirrorResult {
  ok: boolean;
  skipped: boolean;
  snapshot: string | null;
  rows: number | null;
  bytesScanned: number | null;
  reason?: string;
}

/**
 * Materializa (ou revalida) a tabela espelho de empresas ATIVAS. Idempotente:
 * se o snapshot mais recente já está espelhado, retorna skipped. Reutilizado
 * pelo cron mensal e pelo verify-bigquery.ts (primeira carga). Nunca lança:
 * devolve ok=false com reason.
 */
export async function syncCnpjMirror(opts?: { force?: boolean }): Promise<CnpjMirrorResult> {
  if (!bigQueryDisponivel()) {
    return { ok: false, skipped: true, snapshot: null, rows: null, bytesScanned: null, reason: 'bigquery_nao_configurado' };
  }
  const bq = getBigQueryClient();
  const { dataset, table, fqn } = mirrorFqn();

  try {
    const [alvo, atual] = await Promise.all([snapshotMaisRecente(), snapshotEspelhado()]);
    if (!alvo) {
      return { ok: false, skipped: true, snapshot: null, rows: null, bytesScanned: null, reason: 'sem_particao_na_origem (verifique assinatura BD Pro / acesso)' };
    }
    if (!opts?.force && atual === alvo) {
      logger.info(`[MiraCnpjMirror] já atualizado (snapshot ${alvo}); pulando materialização.`);
      return { ok: true, skipped: true, snapshot: alvo, rows: null, bytesScanned: null };
    }

    // garante o dataset
    const [dsExists] = await bq.dataset(dataset).exists();
    if (!dsExists) await bq.createDataset(dataset, { location: 'US' });

    // materializa só ATIVAS (situacao_cadastral 02/2), poucas colunas, clusterizada.
    const sql = `
      CREATE OR REPLACE TABLE \`${fqn}\`
      CLUSTER BY cnae_fiscal_principal, sigla_uf
      AS
      SELECT
        cnpj,
        nome_fantasia,
        cnae_fiscal_principal,
        sigla_uf,
        id_municipio,
        DATE '${alvo}' AS _data_snapshot
      FROM \`${SRC}\`
      WHERE data = DATE '${alvo}'
        AND situacao_cadastral IN ('02', '2')
    `;
    logger.info(`[MiraCnpjMirror] materializando ${fqn} (snapshot ${alvo})...`);
    const [job] = await bq.createQueryJob({
      query: sql,
      useLegacySql: false,
      maximumBytesBilled: gbToBytes(env.BIGQUERY_MIRROR_MAX_GB),
    });
    await job.getQueryResults();
    const [meta] = await job.getMetadata();
    const bytesScanned = Number(meta?.statistics?.query?.totalBytesProcessed ?? meta?.statistics?.totalBytesProcessed ?? 0) || null;

    const [tblMeta] = await bq.dataset(dataset).table(table).getMetadata();
    const rows = Number(tblMeta?.numRows ?? 0) || null;

    logger.info(`[MiraCnpjMirror] OK: ${rows ?? '?'} empresas ativas, snapshot ${alvo}, ${bytesScanned ? (bytesScanned / 1e9).toFixed(1) : '?'} GB varridos.`);
    return { ok: true, skipped: false, snapshot: alvo, rows, bytesScanned };
  } catch (err: any) {
    logger.error(`[MiraCnpjMirror] falha na materialização: ${err?.message ?? err}`);
    return { ok: false, skipped: false, snapshot: null, rows: null, bytesScanned: null, reason: String(err?.message ?? err) };
  }
}

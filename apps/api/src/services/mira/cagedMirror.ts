/**
 * Mira Prospects — sinal setorial de emprego (CAGED, via BigQuery/BD Pro).
 *
 * O CAGED público é anonimizado (não tem CNPJ), então NÃO dá sinal por empresa.
 * Mas dá o saldo de emprego (admissões menos demissões) por CNAE + UF, que é um
 * sinal de demanda do SETOR do Alvo. Materializamos 1x/mês a agregação do ano
 * mais recente numa tabela nossa `mira.caged_setor` (26k linhas, minúscula) e a
 * qualificação consulta por CNAE+UF por fração de centavo. Ver doc 11.
 *
 * Limite honesto: o CAGED tratado tem defasagem (último ano fechado), então o
 * sinal é "o setor cresceu/encolheu no último ano", não do mês passado.
 */
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { bigQueryDisponivel, getBigQueryClient, gbToBytes } from './bigqueryClient.js';
import type { SinalSetorial } from './score.js';

const SRC = 'basedosdados.br_me_caged.microdados_movimentacao';
const SRC_DATASET = 'basedosdados.br_me_caged';

/** FQN da tabela espelho do CAGED (mesmo dataset do espelho de CNPJ). */
export function cagedFqn(): { project: string; dataset: string; table: string; fqn: string } {
  const project = env.BIGQUERY_PROJECT_ID as string;
  const dataset = env.BIGQUERY_MIRROR_TABLE.split('.')[0]; // 'mira'
  const table = 'caged_setor';
  return { project, dataset, table, fqn: `${project}.${dataset}.${table}` };
}

/** Ano (INT) da partição mais recente do CAGED, via metadados (custo ~0). */
async function anoMaisRecente(): Promise<number | null> {
  const bq = getBigQueryClient();
  const [rows] = await bq.query({
    query: `SELECT partition_id
            FROM \`${SRC_DATASET}.INFORMATION_SCHEMA.PARTITIONS\`
            WHERE table_name = 'microdados_movimentacao'
              AND partition_id NOT IN ('__NULL__', '__UNPARTITIONED__')
            ORDER BY partition_id DESC
            LIMIT 1`,
    useLegacySql: false,
  });
  const pid = (rows as any[])[0]?.partition_id as string | undefined;
  const ano = pid ? Number(pid) : NaN;
  return Number.isInteger(ano) ? ano : null;
}

/** Ano já materializado na tabela espelho (ou null se não existe). */
async function anoEspelhado(): Promise<number | null> {
  const { dataset, table, fqn } = cagedFqn();
  const bq = getBigQueryClient();
  const [exists] = await bq.dataset(dataset).table(table).exists();
  if (!exists) return null;
  const [rows] = await bq.query({ query: `SELECT MAX(ano) AS a FROM \`${fqn}\``, useLegacySql: false });
  const a = Number((rows as any[])[0]?.a);
  return Number.isInteger(a) ? a : null;
}

export interface CagedMirrorResult {
  ok: boolean;
  skipped: boolean;
  ano: number | null;
  rows: number | null;
  reason?: string;
}

/**
 * Materializa a agregação de saldo de emprego por CNAE-subclasse + UF do ano
 * mais recente do CAGED. Idempotente. Nunca lança.
 */
export async function syncCagedSetor(opts?: { force?: boolean }): Promise<CagedMirrorResult> {
  if (!bigQueryDisponivel()) {
    return { ok: false, skipped: true, ano: null, rows: null, reason: 'bigquery_nao_configurado' };
  }
  const bq = getBigQueryClient();
  const { dataset, table, fqn } = cagedFqn();
  try {
    const [alvo, atual] = await Promise.all([anoMaisRecente(), anoEspelhado()]);
    if (!alvo) return { ok: false, skipped: true, ano: null, rows: null, reason: 'sem_particao_na_origem (verifique acesso BD Pro)' };
    if (!opts?.force && atual === alvo) {
      logger.info(`[MiraCaged] já atualizado (ano ${alvo}); pulando.`);
      return { ok: true, skipped: true, ano: alvo, rows: null };
    }
    const [dsExists] = await bq.dataset(dataset).exists();
    if (!dsExists) await bq.createDataset(dataset, { location: 'US' });

    const sql = `
      CREATE OR REPLACE TABLE \`${fqn}\`
      CLUSTER BY cnae, uf
      AS
      SELECT
        cnae_2_subclasse AS cnae,
        sigla_uf AS uf,
        SUM(saldo_movimentacao) AS saldo_liquido,
        SUM(ABS(saldo_movimentacao)) AS movimentacoes,
        ${alvo} AS ano
      FROM \`${SRC}\`
      WHERE ano = ${alvo}
        AND cnae_2_subclasse IS NOT NULL
        AND sigla_uf IS NOT NULL
      GROUP BY cnae, uf
    `;
    logger.info(`[MiraCaged] materializando ${fqn} (ano ${alvo})...`);
    const [job] = await bq.createQueryJob({
      query: sql,
      useLegacySql: false,
      maximumBytesBilled: gbToBytes(env.BIGQUERY_MIRROR_MAX_GB),
    });
    await job.getQueryResults();
    const [tblMeta] = await bq.dataset(dataset).table(table).getMetadata();
    const rows = Number(tblMeta?.numRows ?? 0) || null;
    logger.info(`[MiraCaged] OK: ${rows ?? '?'} setores (CNAE x UF), ano ${alvo}.`);
    return { ok: true, skipped: false, ano: alvo, rows };
  } catch (err: any) {
    logger.error(`[MiraCaged] falha na materialização: ${err?.message ?? err}`);
    return { ok: false, skipped: false, ano: null, rows: null, reason: String(err?.message ?? err) };
  }
}

/**
 * Sinal setorial para o CNAE (7 dígitos) + UF do Alvo. Retorna null se BigQuery
 * não configurado, sem tabela, sem dado do setor, ou volume baixo demais para
 * ser confiável. Nunca lança (a qualificação nunca trava por causa disto).
 */
export async function buscarSinalSetorial(cnaeRaw: string | null, ufRaw: string | null): Promise<SinalSetorial | null> {
  if (!bigQueryDisponivel()) return null;
  const cnae = (cnaeRaw ?? '').replace(/\D/g, '');
  const uf = (ufRaw ?? '').trim().toUpperCase();
  if (cnae.length < 7 || uf.length !== 2) return null;
  try {
    const [rows] = await getBigQueryClient().query({
      query: `SELECT saldo_liquido, movimentacoes, ano
              FROM \`${cagedFqn().fqn}\`
              WHERE cnae = @cnae AND uf = @uf
              LIMIT 1`,
      params: { cnae, uf },
      types: { cnae: 'STRING', uf: 'STRING' },
      maximumBytesBilled: gbToBytes(env.BIGQUERY_MAX_GB),
      useLegacySql: false,
    });
    const r = (rows as any[])[0];
    if (!r) return null;
    const saldo = Number(r.saldo_liquido) || 0;
    const mov = Number(r.movimentacoes) || 0;
    const ano = Number(r.ano) || 0;
    // volume mínimo para o sinal não ser ruído de setor pequeno
    if (mov < 200) return null;
    const taxa = saldo / mov;
    const tendencia: SinalSetorial['tendencia'] = taxa >= 0.02 ? 'expansao' : taxa <= -0.02 ? 'retracao' : 'estavel';
    return { tendencia, saldoLiquido: saldo, ano };
  } catch (err: any) {
    logger.warn(`[MiraCaged] consulta de sinal setorial falhou: ${err?.message ?? err}`);
    return null;
  }
}

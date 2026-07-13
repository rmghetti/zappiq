/**
 * Mira Prospects — descoberta B2B via BigQuery (Base dos Dados).
 *
 * Consulta a base de CNPJ da Receita hospedada na Base dos Dados
 * (`basedosdados.br_me_cnpj.estabelecimentos`), filtrando por CNAE + UF do ICP
 * do cliente e situação ATIVA. Fonte confiável que NÃO depende do servidor de
 * download da Receita (que vive fora do ar). Devolve só uma lista de CNPJs
 * candidatos; a verificação/QSA continua vindo do enriquecimento por CNPJ
 * (BrasilAPI) no descobertaPublica, como já era.
 *
 * Custo (doc 10): consulta só 5 colunas, filtra por partição de data (poda),
 * usa cache do BigQuery e aplica `maximumBytesBilled` (teto duro): se a query
 * fosse varrer além do teto, o BigQuery a RECUSA antes de cobrar. 1 TiB/mês é
 * grátis por projeto.
 */
import { BigQuery } from '@google-cloud/bigquery';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const TABLE = 'basedosdados.br_me_cnpj.estabelecimentos';
const MAX_CANDIDATOS = 300;

let _client: BigQuery | null = null;

export function bigQueryDisponivel(): boolean {
  return Boolean(env.GOOGLE_APPLICATION_CREDENTIALS_JSON && env.BIGQUERY_PROJECT_ID);
}

function getClient(): BigQuery {
  if (_client) return _client;
  const credentials = JSON.parse(env.GOOGLE_APPLICATION_CREDENTIALS_JSON as string);
  _client = new BigQuery({ projectId: env.BIGQUERY_PROJECT_ID, credentials });
  return _client;
}

/** Extrai UFs (2 letras) do texto de região + das regiões do ICP. */
function extrairUfs(regiaoLivre: string, regioesConfig: string[]): string[] {
  const ufs = new Set<string>();
  const re = /\b([A-Z]{2})\b/;
  for (const r of [regiaoLivre, ...(regioesConfig ?? [])]) {
    const m = re.exec(String(r || '').toUpperCase());
    if (m) ufs.add(m[1]);
  }
  return Array.from(ufs);
}

/**
 * Busca CNPJs candidatos por CNAE+UF do perfil. Retorna [] se não há BigQuery
 * configurado, se o perfil não tem CNAE, ou em erro (o chamador degrada para
 * índice local/busca). Nunca lança.
 */
export async function buscarCnpjsBigQuery(perfil: any, regiaoLivre: string): Promise<string[]> {
  if (!bigQueryDisponivel()) return [];
  const cnaes: string[] = Array.isArray(perfil?.icpFirmografia?.cnaes)
    ? perfil.icpFirmografia.cnaes.map((c: string) => String(c).replace(/\D/g, '')).filter((c: string) => c.length >= 2)
    : [];
  if (cnaes.length === 0) return [];
  const ufs = extrairUfs(regiaoLivre, perfil?.icpFirmografia?.regioes ?? []);

  // Filtro de CNAE por prefixo (o ICP pode ter CNAE de 2 a 7 dígitos). Só
  // dígitos, montado a partir da config do cliente (não de input livre) → seguro.
  const cnaeConds = cnaes.slice(0, 30).map((c) => `STARTS_WITH(cnae_fiscal_principal, '${c}')`).join(' OR ');
  const ufCond = ufs.length ? `AND sigla_uf IN UNNEST(@ufs)` : '';

  const sql = `
    DECLARE d DATE DEFAULT (SELECT MAX(data) FROM \`${TABLE}\`);
    SELECT cnpj
    FROM \`${TABLE}\`
    WHERE data = d
      AND situacao_cadastral IN ('02', '2')
      AND (${cnaeConds})
      ${ufCond}
    LIMIT ${MAX_CANDIDATOS};
  `;

  const maxBytesBilled = String(Math.round(env.BIGQUERY_MAX_GB * 1024 * 1024 * 1024));
  try {
    const [rows] = await getClient().query({
      query: sql,
      params: { ufs },
      types: { ufs: ['STRING'] },
      maximumBytesBilled: maxBytesBilled,
      useLegacySql: false,
    });
    const cnpjs = (rows as any[])
      .map((r) => String(r.cnpj ?? '').replace(/\D/g, ''))
      .filter((c) => c.length === 14);
    logger.info(`[MiraBigQuery] ${cnpjs.length} candidatos (cnaes=${cnaes.length} ufs=${ufs.join(',') || 'todas'})`);
    return cnpjs;
  } catch (err: any) {
    // maximumBytesBilled excedido, credencial inválida, schema diferente, etc.
    logger.warn(`[MiraBigQuery] consulta falhou (degradando p/ outras fontes): ${err?.message ?? err}`);
    return [];
  }
}

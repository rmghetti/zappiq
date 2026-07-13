/**
 * Mira Prospects — descoberta B2B via BigQuery (tabela espelho de CNPJ).
 *
 * Consulta a NOSSA tabela espelho `zappiq-prod.mira.cnpj_ativos` (empresas
 * ATIVAS, materializada 1x/mês a partir da base de CNPJ da Base dos Dados por
 * cnpjMirrorSync), filtrando por CNAE + UF do ICP do cliente. Consultar a
 * tabela espelho custa fração de centavo (a tabela pública da Base dos Dados
 * exige BD Pro e varre ~50-76 GB por consulta; ver doc 10). Devolve só uma
 * lista de CNPJs candidatos; a verificação/QSA continua vindo do enriquecimento
 * por CNPJ (BrasilAPI) no descobertaPublica, como já era.
 */
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { bigQueryDisponivel, getBigQueryClient, gbToBytes } from './bigqueryClient.js';

const MAX_CANDIDATOS = 300;

export { bigQueryDisponivel };

/** Nome totalmente qualificado da tabela espelho (projeto.dataset.tabela). */
function mirrorFqn(): string {
  return `${env.BIGQUERY_PROJECT_ID}.${env.BIGQUERY_MIRROR_TABLE}`;
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
 * Busca CNPJs candidatos por CNAE+UF do perfil na tabela espelho. Retorna [] se
 * não há BigQuery configurado, se o perfil não tem CNAE, se a tabela espelho
 * ainda não foi materializada, ou em erro (o chamador degrada para índice
 * local/busca). Nunca lança.
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

  // A tabela espelho já contém só empresas ATIVAS e o snapshot mais recente,
  // clusterizada por cnae_fiscal_principal + sigla_uf → varredura mínima.
  const sql = `
    SELECT cnpj
    FROM \`${mirrorFqn()}\`
    WHERE (${cnaeConds})
      ${ufCond}
    LIMIT ${MAX_CANDIDATOS};
  `;

  try {
    const [rows] = await getBigQueryClient().query({
      query: sql,
      params: { ufs },
      types: { ufs: ['STRING'] },
      maximumBytesBilled: gbToBytes(env.BIGQUERY_MAX_GB),
      useLegacySql: false,
    });
    const cnpjs = (rows as any[])
      .map((r) => String(r.cnpj ?? '').replace(/\D/g, ''))
      .filter((c) => c.length === 14);
    logger.info(`[MiraBigQuery] ${cnpjs.length} candidatos (cnaes=${cnaes.length} ufs=${ufs.join(',') || 'todas'})`);
    return cnpjs;
  } catch (err: any) {
    // tabela espelho ainda não materializada, credencial inválida, teto excedido, etc.
    logger.warn(`[MiraBigQuery] consulta falhou (degradando p/ outras fontes): ${err?.message ?? err}`);
    return [];
  }
}

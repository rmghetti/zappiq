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
/**
 * Recebe os CÓDIGOS de CNAE da campanha (já separados do texto por
 * separarAlvos) e as regiões dela. Antes lia o Perfil por dentro, o que
 * fazia a busca ignorar o que o cliente escolheu na campanha.
 */
export async function buscarCnpjsBigQuery(codigos: string[], regioes: string[]): Promise<string[]> {
  if (!bigQueryDisponivel()) return [];
  const cnaes: string[] = (codigos ?? []).map((c) => String(c).replace(/\D/g, '')).filter((c) => c.length >= 2);
  if (cnaes.length === 0) return [];
  const ufs = extrairUfs('', regioes ?? []);

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

/**
 * Enriquece CNPJs a partir do espelho, no lugar da BrasilAPI.
 *
 * Por que existir: a BrasilAPI responde 403 para a máquina de produção (roda
 * em iad/EUA porque gru não tinha capacidade; a API só atende IP brasileiro).
 * Confirmado em 14/07: 200 do Brasil, 403 de iad. Isso zerava toda campanha
 * B2B — o espelho achava 300 candidatos e nenhum passava na verificação.
 *
 * O espelho é a MESMA Receita (base do BD Pro, já paga), sem bloqueio de
 * região e numa query só em vez de N chamadas HTTP. Devolve [] se o espelho
 * ainda não tiver as colunas novas (materialização antiga), e aí o chamador
 * degrada para a BrasilAPI. Nunca lança.
 */
export async function enriquecerCnpjsBigQuery(cnpjs: string[]): Promise<Map<string, CnpjDoEspelho>> {
  const vazio = new Map<string, CnpjDoEspelho>();
  if (!bigQueryDisponivel()) return vazio;
  const limpos = (cnpjs ?? []).map((c) => String(c).replace(/\D/g, '')).filter((c) => c.length === 14);
  if (limpos.length === 0) return vazio;

  // A tabela é nossa e clusterizada; filtrar por CNPJ exato varre pouco.
  const sql = `
    SELECT cnpj, razao_social, nome_fantasia, cnae_fiscal_principal, sigla_uf,
           id_municipio, data_inicio_atividade, telefone, capital_social, porte,
           natureza_juridica, qsa
    FROM \`${mirrorFqn()}\`
    WHERE cnpj IN UNNEST(@cnpjs)
  `;
  try {
    const [rows] = await getBigQueryClient().query({
      query: sql,
      params: { cnpjs: limpos },
      types: { cnpjs: ['STRING'] },
      maximumBytesBilled: gbToBytes(env.BIGQUERY_MAX_GB),
      useLegacySql: false,
    });
    const mapa = new Map<string, CnpjDoEspelho>();
    for (const r of rows as any[]) {
      const cnpj = String(r.cnpj ?? '').replace(/\D/g, '');
      if (cnpj.length !== 14) continue;
      mapa.set(cnpj, {
        cnpj,
        razaoSocial: String(r.razao_social ?? '').trim(),
        nomeFantasia: r.nome_fantasia ? String(r.nome_fantasia).trim() : null,
        cnae: r.cnae_fiscal_principal ? String(r.cnae_fiscal_principal) : null,
        uf: r.sigla_uf ? String(r.sigla_uf) : null,
        idMunicipio: r.id_municipio ? String(r.id_municipio) : null,
        dataInicioAtividade: r.data_inicio_atividade?.value ?? (r.data_inicio_atividade ? String(r.data_inicio_atividade) : null),
        telefone: r.telefone ? String(r.telefone).replace(/\D/g, '') || null : null,
        capitalSocial: r.capital_social != null ? Number(r.capital_social) : null,
        porte: r.porte ? String(r.porte) : null,
        naturezaJuridica: r.natureza_juridica ? String(r.natureza_juridica) : null,
        qsa: Array.isArray(r.qsa)
          ? r.qsa
              .map((s: any) => ({ nome: String(s?.nome ?? '').trim(), qualificacao: String(s?.qualificacao ?? '').trim() }))
              .filter((s: any) => s.nome)
          : [],
      });
    }
    logger.info(`[MiraBigQuery] enriquecidos ${mapa.size}/${limpos.length} pelo espelho`);
    return mapa;
  } catch (err: any) {
    // Espelho sem as colunas novas (materialização antiga) ou erro: o chamador
    // degrada para a BrasilAPI.
    logger.warn(`[MiraBigQuery] enriquecimento pelo espelho indisponível: ${err?.message ?? err}`);
    return vazio;
  }
}

/** O que o espelho sabe de um CNPJ (subconjunto do CnpjData da BrasilAPI). */
export interface CnpjDoEspelho {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnae: string | null;
  uf: string | null;
  idMunicipio: string | null;
  dataInicioAtividade: string | null;
  telefone: string | null;
  capitalSocial: number | null;
  porte: string | null;
  naturezaJuridica: string | null;
  qsa: { nome: string; qualificacao: string }[];
}

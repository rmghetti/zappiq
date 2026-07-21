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
import { extrairUfs } from '@zappiq/shared';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { bigQueryDisponivel, getBigQueryClient, gbToBytes } from './bigqueryClient.js';

const MAX_CANDIDATOS = 300;

export { bigQueryDisponivel };

/** Nome totalmente qualificado da tabela espelho (projeto.dataset.tabela). */
function mirrorFqn(): string {
  return `${env.BIGQUERY_PROJECT_ID}.${env.BIGQUERY_MIRROR_TABLE}`;
}

/**
 * Extrai UFs do texto de região.
 *
 * A base espelho recorta por `sigla_uf`, então região que não vira UF não
 * recorta nada. A regra mora no @zappiq/shared porque a TELA precisa concordar
 * com o motor: o formulário avisa "isto não vira estado" antes de disparar, e
 * duas cópias da regra seriam drift esperando para acontecer.
 */
function extrairUfsLocal(regiaoLivre: string, regioesConfig: string[]): string[] {
  return extrairUfs([regiaoLivre, ...(regioesConfig ?? [])]);
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
export async function buscarCnpjsBigQuery(
  codigos: string[],
  regioes: string[],
  opts?: { priorizarMaiores?: boolean }
): Promise<string[]> {
  if (!bigQueryDisponivel()) return [];
  const cnaes: string[] = (codigos ?? []).map((c) => String(c).replace(/\D/g, '')).filter((c) => c.length >= 2);
  if (cnaes.length === 0) return [];
  const ufs = extrairUfsLocal('', regioes ?? []);

  // Filtro de CNAE por prefixo (o ICP pode ter CNAE de 2 a 7 dígitos). Só
  // dígitos, montado a partir da config do cliente (não de input livre) → seguro.
  const cnaeConds = cnaes.slice(0, 30).map((c) => `STARTS_WITH(cnae_fiscal_principal, '${c}')`).join(' OR ');
  const ufCond = ufs.length ? `AND sigla_uf IN UNNEST(@ufs)` : '';

  // A tabela espelho já contém só empresas ATIVAS e o snapshot mais recente,
  // clusterizada por cnae_fiscal_principal + sigla_uf → varredura mínima.
  //
  // ORDER BY capital DESC: sem ordenação, o LIMIT trazia uma amostra dominada
  // por ME/EPP (a esmagadora maioria dos CNPJs ativos), e cliente que pedia
  // empresa grande recebia empresa pequena. Capital social é o único proxy de
  // tamanho POR EMPRESA na base pública (a Receita não tem faturamento), então
  // as maiores por capital sobem primeiro. SAFE_CAST nunca estoura (valor não
  // numérico vira NULL e cai para o fim), então a query jamais quebra por isto.
  //
  // CONDICIONAL ao recorte do cliente (achado convergente de duas revisões
  // adversariais): quem pede só micro/pequeno receberia o lote inteiro das
  // maiores por capital, o filtro de porte descartaria os MAX_CNPJS do funil e
  // a campanha zeraria. Sem priorizar, volta a amostra natural (dominada por
  // ME/EPP), que é o que esse recorte quer.
  const orderBy = (opts?.priorizarMaiores ?? true) ? 'ORDER BY SAFE_CAST(capital_social AS FLOAT64) DESC' : '';
  const sql = `
    SELECT cnpj
    FROM \`${mirrorFqn()}\`
    WHERE (${cnaeConds})
      ${ufCond}
    ${orderBy}
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
  //
  // O JOIN traduz o código IBGE em NOME do município. O espelho guarda só
  // `id_municipio` (7 dígitos, IBGE — conferido em produção: 28M linhas, e o
  // COFEL 3504107 = Atibaia/SP), e até 15/07/2026 o adaptador jogava o código
  // fora porque "exigiria dicionário". O dicionário existe, é do próprio BD,
  // tem 5.570 linhas e o JOIN aqui custa nada perto do que já varremos por
  // CNPJ. Fazer aqui em vez de na materialização evita rematerializar 120GB.
  const sql = `
    SELECT e.cnpj, e.razao_social, e.nome_fantasia, e.cnae_fiscal_principal, e.sigla_uf,
           e.id_municipio, m.nome AS municipio_nome, c.descricao_subclasse AS cnae_descricao,
           e.data_inicio_atividade, e.telefone, e.capital_social, e.porte,
           e.natureza_juridica, e.qsa
    FROM \`${mirrorFqn()}\` e
    LEFT JOIN \`${env.BIGQUERY_MUNICIPIOS_TABLE}\` m
      ON CAST(m.id_municipio AS STRING) = CAST(e.id_municipio AS STRING)
    LEFT JOIN \`${env.BIGQUERY_CNAE_TABLE}\` c
      ON REPLACE(REPLACE(c.subclasse, '-', ''), '/', '') = CAST(e.cnae_fiscal_principal AS STRING)
    WHERE e.cnpj IN UNNEST(@cnpjs)
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
        municipio: r.municipio_nome ? String(r.municipio_nome).trim() : null,
        cnaeDescricao: r.cnae_descricao ? String(r.cnae_descricao).trim() : null,
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
  /** Código IBGE cru do espelho (7 dígitos). */
  idMunicipio: string | null;
  /** Nome do município, traduzido do código pelo diretório do BD. */
  municipio: string | null;
  /** Descrição do CNAE, traduzida do código pelo diretório do BD. */
  cnaeDescricao: string | null;
  dataInicioAtividade: string | null;
  telefone: string | null;
  capitalSocial: number | null;
  porte: string | null;
  naturezaJuridica: string | null;
  qsa: { nome: string; qualificacao: string }[];
}

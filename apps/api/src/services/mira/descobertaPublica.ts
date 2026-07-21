/**
 * Mira Prospects — Motor B B2B por DESCOBERTA PUBLICA (gratuito).
 *
 * Substitui a dependencia paga do Google Places para o B2B: descobre
 * empresas no indice publico (busca por segmento + regiao), colhe CNPJs que
 * aparecem nos resultados e os VERIFICA na fonte oficial (Receita/BrasilAPI),
 * reaproveitando o gate do Motor A (situacao ATIVA + ao menos 1 decisor no
 * quadro societario). So o Alvo verificado vira READY e desconta cota
 * (cota = alvos verificados). Empresas achadas sem CNPJ resolvido viram
 * CANDIDATOS (DISCOVERED) sem gastar cota: leads para qualificar depois.
 *
 * Sem chave de busca publica, responde 501 (honestidade de fonte). A base
 * completa de CNPJ da Receita (ingestao em lote) entra como upgrade de
 * cobertura numa fase seguinte; aqui a descoberta ja funciona de graca.
 */
import { prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';
import { fetchCnpj, normalizeCnpj, arquetipoFromQualificacao, isChampionArquetipo, descricaoQualificacao, titularDoRegistro, type CnpjData } from './cnpj.js';
import { computeMiraScoreV1 } from './score.js';
import { webSearch, buscaPublicaDisponivel, type SerpResult } from './buscaPublica.js';
import { buscarCnpjsBigQuery, enriquecerCnpjsBigQuery, type CnpjDoEspelho } from './descobertaBigQuery.js';
import { separarAlvos } from './alvosDaBusca.js';
import { traduzirAlvos } from './cnaeMapa.js';
import { buscarSinalSetorial } from './cagedMirror.js';
import { getMiraEntitlement, consumeMiraQuota, MiraQuotaExceededError } from '../../middleware/requireMira.js';
import { portesPermitidos, normalizarPorte } from './porte.js';

const MAX_QUERIES = 3;
const MAX_CNPJS = 10;
const MAX_CANDIDATOS = 15;

// Dominios que NAO sao site de empresa-alvo (redes, agregadores, enciclopedia).
// Continuam valendo para colher CNPJ do snippet, mas nao viram "candidato".
const HOSTS_NAO_EMPRESA = [
  'linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'youtube.com',
  'wikipedia.org', 'reclameaqui.com.br', 'econodata.com.br', 'cnpj.biz', 'casadosdados.com.br',
  'empresascnpj.com', 'consultacnpj.com', 'gov.br', 'google.com', 'globo.com', 'uol.com.br',
];

const CNPJ_RE = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;

const MAX_CANDIDATOS_INDICE_LOCAL = 300;

/**
 * Índice local (mira_cnpj_index, alimentado pela ingestão da base aberta da
 * Receita) filtrado pelos CNAEs e UFs do ICP do cliente. Quando dá match,
 * substitui a busca na web inteiramente: não gasta quota de busca, não
 * precisa de nenhuma chave configurada, e ainda assim SÓ o CNPJ verificado
 * na Receita vira Alvo (mesmo gate de sempre) — o índice é só um filtro
 * rápido de candidatos, não a fonte de verdade.
 */
async function buscarCandidatosIndiceLocal(codigos: string[], regioes: string[]): Promise<string[]> {
  const cnaes: string[] = (codigos ?? []).map((c) => String(c).replace(/\D/g, '')).filter((c) => c.length >= 2);
  if (cnaes.length === 0) return [];

  const ufRe = /\b([A-Z]{2})\b/;
  const ufs = new Set<string>();
  for (const r of regioes ?? []) {
    const m = ufRe.exec(String(r || '').toUpperCase());
    if (m) ufs.add(m[1]);
  }

  const cnaeConds = cnaes.map((c) => `"cnae" LIKE '${c.replace(/'/g, "''")}%'`).join(' OR ');
  const ufCond = ufs.size ? `AND "uf" = ANY(ARRAY[${Array.from(ufs).map((u) => `'${u}'`).join(',')}])` : '';
  const sql = `
    SELECT "cnpj" FROM "mira_cnpj_index"
    WHERE (${cnaeConds}) AND "situacaoCadastral" = 'ATIVA' ${ufCond}
    LIMIT ${MAX_CANDIDATOS_INDICE_LOCAL};
  `;
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(sql);
    return rows.map((r) => r.cnpj);
  } catch (err: any) {
    logger.warn(`[MiraDescobertaPublica] índice local indisponível/vazio: ${err?.message ?? err}`);
    return [];
  }
}

export interface DescobertaPublicaResult {
  fonte: 'bigquery' | 'indice_local' | 'busca_publica';
  buscas: number;
  encontrados: number; // resultados de busca uteis
  cnpjsVerificados: number;
  criados: number; // viraram Alvo (todos READY: o que nasce, nasce pronto)
  prontos: number; // passaram o gate (READY, descontaram cota)
  candidatos: number; // sempre 0 desde 15/07/2026 (ver `descartadosSoNome`)
  duplicados: number;
  /**
   * Empresa verificada na Receita que NÃO subiu por não ter decisor nenhum
   * (nem no QSA, nem como titular de Empresário Individual).
   *
   * Reportado porque "criados: 3" sozinho esconderia que a busca achou 14. O
   * cliente precisa saber que filtramos, senão parece que o Mira não achou
   * nada — que é o oposto do que aconteceu.
   */
  descartadosCrus: number;
  /**
   * Empresa achada na busca da qual só tínhamos o NOME (CNPJ não resolvido).
   * Antes virava Alvo "candidato" com confiança 40 e enchia a base.
   */
  descartadosSoNome: number;
  /**
   * Empresa verificada e com decisor, mas de PORTE fora do que o cliente pediu
   * (porte declarado ou piso implícito do faturamento). Não vira Alvo nem gasta
   * cota. Porte desconhecido nunca é descartado (benefício da dúvida).
   */
  descartadosPorPorte: number;
  blocked: boolean;
  quota: { used: number; total: number; remaining: number };
  /** Região que a busca de fato usou (vem da campanha, semeada do Perfil). */
  regiaoAplicada: string | null;
  regiaoOrigem: 'campanha' | null;
  /** Fonte que falhou sem derrubar a campanha (a outra trouxe candidatos). */
  avisos?: string[];
}

function hostDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function ehHostEmpresa(url: string): boolean {
  const h = hostDe(url);
  if (!h) return false;
  return !HOSTS_NAO_EMPRESA.some((bad) => h === bad || h.endsWith(`.${bad}`));
}

function nomeDoResultado(r: SerpResult): string {
  // Titulo tipico: "Nome da Empresa - algo | site". Corta sufixos de cauda.
  let t = r.title.split(/\s[|–—-]\s/)[0].trim();
  if (t.length < 3) t = hostDe(r.url);
  return t.slice(0, 160);
}


/**
 * O registro do espelho no formato que o gate e o score já falam.
 *
 * O espelho só materializa ATIVAS, então situação é ATIVA por construção.
 * Fica de fora só `optanteSimples`, que não pesa em nada hoje.
 *
 * `cnaeDescricao` e `municipio` ESTAVAM nesta lista de descartados, com a
 * justificativa de que "exigiriam dicionários e não pesam no gate". A frase era
 * verdadeira sobre o gate e custou caro fora dele, duas vezes:
 *   - `municipio` vale 10 na CONFIANÇA (`score.ts`, `municipio && uf`). Como o
 *     espelho é a única fonte viva em produção (a BrasilAPI dá 403 fora do
 *     Brasil), TODO Alvo nascia sem município e capado em 90. Eram 20 de 20 em
 *     15/07/2026.
 *   - `cnaeDescricao` faltando faz a IA ADIVINHAR o setor pelo número e errar.
 * Os dois dicionários eram tabelas públicas do mesmo BD de onde o espelho já
 * vem, e o JOIN sai de graça no enriquecimento.
 */
function doEspelhoParaCnpjData(e: CnpjDoEspelho): CnpjData {
  const qsa = e.qsa.map((s) => ({ nome: s.nome, qualificacao: s.qualificacao }));

  // Empresário Individual não tem sócio POR LEI, então o QSA vem vazio e o
  // Alvo nascia sem decisor nenhum: 8 dos 11 Alvos crus em produção eram isto.
  // O titular está na razão social, e ler isso é registro oficial, não chute.
  const titular = titularDoRegistro({
    naturezaJuridica: e.naturezaJuridica,
    razaoSocial: e.razaoSocial,
    municipio: e.municipio,
    qsa,
  });
  if (titular) qsa.push(titular);

  return {
    cnpj: e.cnpj,
    razaoSocial: e.razaoSocial,
    nomeFantasia: e.nomeFantasia,
    cnae: e.cnae,
    // Era `null`, e o prompt mandava só o número para a IA ("Atividade (CNAE
    // 2451200)"). Sem a descrição ela ADIVINHA o setor: escreveu o dossiê de
    // uma fundição de ferro inteiro como "joalheria" (2451200 = Fundição de
    // ferro e aço; joalheria é 3211601). O dicionário é o mesmo diretório do
    // BD de onde veio o município.
    cnaeDescricao: e.cnaeDescricao,
    porte: e.porte,
    capitalSocial: e.capitalSocial,
    naturezaJuridica: e.naturezaJuridica,
    situacaoCadastral: 'ATIVA',
    municipio: e.municipio,
    uf: e.uf,
    telefone: e.telefone,
    dataInicioAtividade: e.dataInicioAtividade,
    optanteSimples: null,
    qsa,
    fonteUrl: 'bigquery:mira.cnpj_ativos (base de CNPJ da Receita via BD Pro)',
  };
}

/**
 * Passa o gate B2B v1: identidade oficial + ATIVA + ao menos 1 decisor.
 *
 * Até 15/07/2026 este gate só decidia PROMOÇÃO para READY: o Alvo reprovado
 * era criado assim mesmo, em QUALIFYING, e ficava na base do cliente. Eram 11
 * de 20 na conta da MACHIA, todos com score 9 a 13, todos sem decisor nenhum.
 * O Rodrigo chamou de "entrega crua" e disse que "cria uma visão negativa do
 * cliente com relação à entrega". Ele tem razão: Alvo sem decisor não é um
 * Alvo, é uma linha.
 *
 * Agora o gate decide se o Alvo NASCE. Reprovado não sobe.
 */
function passaGate(d: CnpjData): boolean {
  return Boolean(d.razaoSocial) && (d.situacaoCadastral ?? '').toUpperCase() === 'ATIVA' && d.qsa.length >= 1;
}

/**
 * Descoberta B2B a partir do que a CAMPANHA pede.
 *
 * `busca.alvos` e `busca.regioes` nascem do Perfil (ver alvosDaBusca.ts), o
 * cliente ajusta no wizard e o que ele vê é o que roda aqui. Antes esta
 * função relia o Perfil por dentro para montar os candidatos e só usava o
 * texto digitado no fallback web — dava para escolher uma coisa na tela e a
 * busca fazer outra.
 */
export async function runDescobertaPublica(
  organizationId: string,
  busca: { alvos: string[]; regioes: string[] },
  campanhaId?: string | null
): Promise<DescobertaPublicaResult> {
  const perfil = await (prisma as any).miraPerfil.findUnique({ where: { organizationId } });
  if (!perfil || (perfil.prontidao ?? 0) < 60) {
    const err: any = new Error('perfil_incompleto');
    err.status = 412;
    throw err;
  }
  // Recorte de tamanho pedido no Perfil (portes declarados ou piso do
  // faturamento). null = sem recorte. Empresa fora do porte não vira Alvo.
  const permitidosPortes = portesPermitidos(perfil);

  // Alvo é código de CNAE ou atividade em texto. A atividade escrita também
  // vira código quando dá (traduzirAlvos), para chegar na base de 28M CNPJs em
  // vez de depender só da busca na web: era isso que deixava um Perfil escrito
  // em português passando longe da fonte boa.
  const { codigos, textos } = separarAlvos(busca.alvos ?? []);
  const traducao = traduzirAlvos(textos);
  const codigosDaBusca = Array.from(new Set([...codigos, ...traducao.divisoes]));
  const regioes = (busca.regioes ?? []).filter((r) => typeof r === 'string' && r.trim());
  const alvoRegiao = regioes[0] ?? '';

  // Cada tipo de alvo tem a sua fonte, e as duas SOMAM na mesma campanha:
  //  - CÓDIGO de CNAE -> base oficial de CNPJs (BigQuery; índice local como
  //    reserva). Preciso e barato.
  //  - ATIVIDADE em texto -> busca pública. É a única que entende "serviços"
  //    ou "distribuidoras de TI".
  // Antes era ou/ou: havendo um código, o texto do cliente não rodava. Quem
  // declarava os dois tipos no Perfil perdia metade do que pediu, calado.
  // Todo CNPJ, venha de onde vier, é re-verificado na Receita (BrasilAPI).
  let cnpjsDiretos: string[] = codigosDaBusca.length
    ? await buscarCnpjsBigQuery(codigosDaBusca, regioes, {
        // Só prioriza as maiores por capital quando o recorte ADMITE empresa
        // grande; para ICP de micro/pequeno, a priorização entregaria um lote
        // 100% descartável ao filtro de porte e a campanha zeraria.
        priorizarMaiores: !permitidosPortes || permitidosPortes.has('DEMAIS'),
      })
    : [];
  let fonteDiretos: 'bigquery' | 'indice_local' | null = cnpjsDiretos.length ? 'bigquery' : null;
  if (!fonteDiretos && codigosDaBusca.length) {
    cnpjsDiretos = await buscarCandidatosIndiceLocal(codigosDaBusca, regioes);
    if (cnpjsDiretos.length) fonteDiretos = 'indice_local';
  }
  const usandoCnpjsDiretos = fonteDiretos !== null;

  const resultados: SerpResult[] = [];
  const vistosUrl = new Set<string>();
  let buscas = 0;
  // Erro de fonte não pode virar "0 resultados": guardamos o motivo para a
  // campanha falhar dizendo o que houve, em vez de mentir "concluída".
  const errosBusca: string[] = [];
  // Mesma regra da busca: verificação que quebra não vira "não achei ninguém".
  const errosEnriquecimento: string[] = [];
  /** Verificou o CNPJ mas não conseguiu gravar o Alvo (ex.: drift de schema). */
  const errosGravacao: string[] = [];

  // A web roda só para o que não virou código (ex.: "empresas PME", que é
  // porte, não ramo). O que virou código já foi buscado na base oficial, que é
  // melhor: não gasta cota de busca e o dado é da Receita.
  const paraWeb = traducao.naoTraduzidos;
  if (paraWeb.length > 0) {
    if (!buscaPublicaDisponivel()) {
      // Sem provedor de busca, o texto não tem fonte. Só é erro se os códigos
      // também não trouxeram nada: aí a campanha inteira ficaria sem fonte.
      if (!usandoCnpjsDiretos) {
        const err: any = new Error('fonte_indisponivel');
        err.status = 501;
        throw err;
      }
      logger.warn('[MiraDescobertaPublica] sem provedor de busca: alvos em texto ficaram de fora desta campanha');
    } else {
      const queries: string[] = [];
      for (const alvo of paraWeb) {
        queries.push(alvoRegiao ? `empresas de ${alvo} em ${alvoRegiao}` : `empresas de ${alvo}`);
        queries.push(alvoRegiao ? `"${alvo}" ${alvoRegiao} CNPJ` : `"${alvo}" CNPJ`);
      }
      queries.splice(MAX_QUERIES);
      for (const q of queries) {
        try {
          const hits = await webSearch(organizationId, q, { limit: 8 });
          buscas++;
          for (const h of hits) {
            if (vistosUrl.has(h.url)) continue;
            vistosUrl.add(h.url);
            resultados.push(h);
          }
        } catch (err: any) {
          if (err?.status === 501 && !usandoCnpjsDiretos) throw err;
          const motivo = String(err?.message ?? err);
          errosBusca.push(err?.detail ? `${motivo}: ${err.detail}` : motivo);
          logger.warn(`[MiraDescobertaPublica] busca falhou: ${motivo}${err?.detail ? ` | ${err.detail}` : ''}`);
        }
      }
    }
  }

  // A distinção que faltava: "a fonte quebrou" NÃO é "não achei ninguém".
  // A campanha 1 de teste do Rodrigo devolveu 0 alvos com status CONCLUIDA
  // enquanto as 3 buscas falhavam com google_cse_403 (API não habilitada no
  // projeto). Falha de fonte agora estoura, a campanha fica FALHOU e o cliente
  // lê o motivo, em vez de achar que o mercado inteiro estava vazio.
  if (!usandoCnpjsDiretos && resultados.length === 0 && errosBusca.length > 0) {
    const err: any = new Error('fonte_falhou');
    err.status = 502;
    err.detail = errosBusca[0];
    throw err;
  }

  // Nenhum alvo achou fonte: nem código rendeu candidato, nem texto rendeu
  // resultado. Melhor dizer isso do que devolver campanha vazia sem explicação.
  if (!usandoCnpjsDiretos && resultados.length === 0 && codigosDaBusca.length > 0 && paraWeb.length === 0) {
    const err: any = new Error('alvos_sem_fonte');
    err.status = 422;
    throw err;
  }

  const ent = await getMiraEntitlement(organizationId);
  const result: DescobertaPublicaResult = {
    // Fonte predominante dos candidatos (as duas podem ter somado).
    fonte: fonteDiretos ?? 'busca_publica',
    buscas,
    encontrados: (usandoCnpjsDiretos ? cnpjsDiretos.length : 0) + resultados.length,
    cnpjsVerificados: 0,
    criados: 0,
    prontos: 0,
    candidatos: 0,
    duplicados: 0,
    descartadosCrus: 0,
    descartadosSoNome: 0,
    descartadosPorPorte: 0,
    blocked: ent.quota.blocked,
    quota: { used: ent.quota.used, total: ent.quota.total, remaining: ent.quota.remaining },
    regiaoAplicada: alvoRegiao || null,
    regiaoOrigem: alvoRegiao ? 'campanha' : null,
    ...(errosBusca.length ? { avisos: [`A busca pública falhou (${errosBusca[0]}); valeu só a base de CNPJs.`] } : {}),
  };
  if (!usandoCnpjsDiretos && resultados.length === 0) return result;

  // -- Fase 1: colher CNPJs candidatos e VERIFICAR na fonte oficial --
  // As duas fontes somam no mesmo conjunto: os códigos trazem CNPJ direto da
  // base oficial, o texto traz CNPJ dos snippets da busca. O Set dedupe quem
  // aparecer nas duas.
  const cnpjsBrutos = new Set<string>();
  for (const c of cnpjsDiretos) cnpjsBrutos.add(c);
  for (const r of resultados) {
    const matches = `${r.title} ${r.snippet}`.match(CNPJ_RE) ?? [];
    for (const m of matches) {
      const n = normalizeCnpj(m);
      if (n) cnpjsBrutos.add(n);
    }
  }

  // Enriquecimento em LOTE pelo espelho: uma query em vez de N chamadas HTTP,
  // e sem depender da BrasilAPI, que responde 403 para a região onde a API
  // roda (iad). Vazio = espelho antigo/indisponível → cai na BrasilAPI abaixo.
  const alvosDoLote = Array.from(cnpjsBrutos).slice(0, MAX_CNPJS);
  const doEspelho = await enriquecerCnpjsBigQuery(alvosDoLote);

  for (const cnpj of alvosDoLote) {
    const entNow = await getMiraEntitlement(organizationId);
    result.quota = { used: entNow.quota.used, total: entNow.quota.total, remaining: entNow.quota.remaining };
    if (entNow.quota.blocked) {
      result.blocked = true;
      break;
    }
    const existente = await (prisma as any).miraAlvo.findFirst({ where: { organizationId, cnpj }, select: { id: true } });
    if (existente) {
      result.duplicados++;
      continue;
    }
    let dados: CnpjData | null = doEspelho.has(cnpj) ? doEspelhoParaCnpjData(doEspelho.get(cnpj)!) : null;
    if (!dados) {
      // Reserva: espelho ainda sem as colunas novas, ou CNPJ que não está nele.
      try {
        dados = await fetchCnpj(organizationId, cnpj);
      } catch (err: any) {
        errosEnriquecimento.push(String(err?.message ?? err));
        continue;
      }
    }
    if (!dados || (dados.situacaoCadastral ?? '').toUpperCase() !== 'ATIVA') continue;
    result.cnpjsVerificados++;

    const sinalSetorial = await buscarSinalSetorial(dados.cnae, dados.uf);
    const { score, breakdown, confianca } = computeMiraScoreV1(perfil, dados, dados.qsa.length, sinalSetorial);
    // ── O gate decide se o Alvo NASCE, não só se ele é promovido ──
    // A verificação vem DEPOIS de toda a persistência de enriquecimento (o
    // espelho, e o titular do Empresário Individual que a lei impede de ter
    // sócio). Ou seja: só desiste depois de ter tentado tudo que o registro
    // oficial permite. Sem decisor mesmo assim, o Alvo não sobe.
    if (!passaGate(dados)) {
      result.descartadosCrus++;
      logger.info(
        `[MiraDescobertaPublica] cnpj=${cnpj} não sobe: decisores=${dados.qsa.length} situacao=${dados.situacaoCadastral ?? '?'} natJur=${dados.naturezaJuridica ?? '?'}`
      );
      continue;
    }

    // Recorte de tamanho: empresa de porte fora do pedido não vira Alvo nem
    // gasta cota. Porte desconhecido (null) é mantido, benefício da dúvida.
    if (permitidosPortes) {
      const porteAlvo = normalizarPorte(dados.porte);
      if (porteAlvo && !permitidosPortes.has(porteAlvo)) {
        result.descartadosPorPorte++;
        logger.info(`[MiraDescobertaPublica] cnpj=${cnpj} fora do porte pedido (${dados.porte ?? 'n/d'} -> ${porteAlvo}); não sobe`);
        continue;
      }
    }

    const agora = new Date().toISOString();
    const resumo =
      `${dados.razaoSocial}${dados.nomeFantasia ? ` (${dados.nomeFantasia})` : ''}, ` +
      `${dados.cnaeDescricao ?? 'atividade nao informada'}, porte ${dados.porte ?? 'n/d'}, ` +
      `${[dados.municipio, dados.uf].filter(Boolean).join('/')}. ` +
      `Descoberto pela campanha (${(busca.alvos ?? []).slice(0, 3).join(', ')}${alvoRegiao ? ` em ${alvoRegiao}` : ''}) e verificado na Receita.`;

    let alvoId: string | null = null;
    try {
      const alvo = await prisma.miraAlvo.create({
        data: {
          organizationId,
          campanhaId: campanhaId ?? null,
          kind: 'B2B',
          motor: 'DESCOBERTA',
          status: 'QUALIFYING',
          nome: dados.razaoSocial,
          nomeFantasia: dados.nomeFantasia,
          cnpj: dados.cnpj,
          cnae: dados.cnae,
          porte: dados.porte,
          capitalSocial: dados.capitalSocial,
          situacaoCadastral: dados.situacaoCadastral,
          municipio: dados.municipio,
          uf: dados.uf,
          telefone: dados.telefone,
          miraScore: score,
          scoreBreakdown: breakdown,
          confianca,
          resumo,
          fontes: [
            { campo: 'descoberta_publica', url: `busca:${(busca.alvos ?? []).slice(0, 3).join('|')}`, data: agora, confianca: 55 },
            { campo: 'firmografia', url: dados.fonteUrl, data: agora, confianca: 95 },
          ],
          decisores: {
            create: dados.qsa.map((s) => {
              const arq = arquetipoFromQualificacao(s.qualificacao);
              return {
                nome: s.nome,
                papel: descricaoQualificacao(s.qualificacao),
                arquetipo: arq,
                isChampion: isChampionArquetipo(arq),
                vinculoQsa: true,
                fonte: dados!.fonteUrl,
                baseLegal: 'registro_publico',
                lineage: [{ campo: 'nome_papel', url: dados!.fonteUrl, data: agora }],
                confianca: 90,
              };
            }),
          },
        },
        select: { id: true },
      });
      alvoId = alvo.id;
      result.criados++;
    } catch (err: any) {
      logger.error(`[MiraDescobertaPublica] falha ao criar alvo cnpj=${cnpj}: ${err?.message ?? err}`);
      errosGravacao.push(String(err?.message ?? err));
      continue;
    }

    // Chegou aqui = já passou no gate acima, então é sempre promovido: o Alvo
    // que nasce é o Alvo pronto. Não existe mais o meio-termo em QUALIFYING,
    // que era onde os 11 Alvos crus moravam.
    if (alvoId) {
      try {
        const quota = await consumeMiraQuota(organizationId);
        await prisma.miraAlvo.update({
          where: { id: alvoId },
          data: { status: 'READY', countedInQuota: true, quotaMonth: entNow.monthKey },
        });
        result.prontos++;
        result.quota = { used: quota.used, total: quota.total, remaining: quota.remaining };
        if (quota.blocked) {
          result.blocked = true;
          break;
        }
      } catch (err) {
        if (err instanceof MiraQuotaExceededError) {
          result.blocked = true;
          break;
        }
        throw err;
      }
    }
  }

  // -- Fase 2: candidatos (empresas achadas sem CNPJ resolvido) ----------
  if (!result.blocked) {
    const candidatosVistos = new Set<string>();
    for (const r of resultados) {
      if (result.candidatos >= MAX_CANDIDATOS) break;
      if (!ehHostEmpresa(r.url)) continue;
      const host = hostDe(r.url);
      if (!host || candidatosVistos.has(host)) continue;
      candidatosVistos.add(host);
      const site = `https://${host}`;
      const jaTem = await (prisma as any).miraAlvo.findFirst({
        where: { organizationId, site, motor: 'DESCOBERTA' },
        select: { id: true },
      });
      if (jaTem) {
        result.duplicados++;
        continue;
      }
      // NÃO cria mais o "candidato".
      //
      // Este era o pior ofensor do pedido do Rodrigo ("garantir que o Alvo nem
      // suba se já na pesquisa tiver apenas informação do nome da empresa, que
      // é o que tem vindo em muitos casos"). O candidato nascia do TÍTULO de um
      // resultado de busca: sem CNPJ, sem decisor, sem firmografia, confiança
      // 40, com um resumo que era o snippet do buscador. Era literalmente só o
      // nome, e nada nunca o promovia.
      //
      // Contado e reportado para o cliente saber que a busca achou empresas e
      // que elas não passaram, em vez de sumirem caladas.
      result.descartadosSoNome++;
    }
  }

  // Achou candidato e NENHUM passou porque a verificação quebrou: é falha de
  // fonte, não mercado vazio. Foi o que deixou a campanha do Rodrigo em 0 com
  // 300 candidatos encontrados.
  if (result.criados === 0 && result.candidatos === 0 && result.descartadosPorPorte === 0 && errosEnriquecimento.length > 0) {
    const err: any = new Error('verificacao_falhou');
    err.status = 502;
    err.detail = errosEnriquecimento[0];
    throw err;
  }

  // Verificou CNPJ e não gravou NENHUM alvo: o motor quebrou depois do trabalho
  // caro, e calar isso é o pior dos mundos — o cliente pagou a verificação e
  // ouviu "não achei ninguém". Foi assim que o `telefone` fora do schema passou
  // dias derrubando todo create sem ninguém ver.
  if (result.criados === 0 && result.cnpjsVerificados > 0 && errosGravacao.length > 0) {
    const err: any = new Error('gravacao_falhou');
    err.status = 502;
    err.detail = errosGravacao[0];
    throw err;
  }

  if (result.descartadosPorPorte > 0) {
    const msg = `${result.descartadosPorPorte} empresa(s) de porte fora do que você pediu não entraram (a Receita não publica faturamento; o recorte é por porte/capital, uma aproximação de tamanho).`;
    result.avisos = result.avisos ? [...result.avisos, msg] : [msg];
  }

  logger.info(
    `[MiraDescobertaPublica] org=${organizationId} alvos=${(busca.alvos ?? []).length} fonte=${result.fonte} buscas=${buscas} verificados=${result.cnpjsVerificados} prontos=${result.prontos} descartadosPorPorte=${result.descartadosPorPorte} candidatos=${result.candidatos}`
  );
  return result;
}

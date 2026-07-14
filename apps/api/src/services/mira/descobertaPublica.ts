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
import { fetchCnpj, normalizeCnpj, arquetipoFromQualificacao, type CnpjData } from './cnpj.js';
import { computeMiraScoreV1 } from './score.js';
import { webSearch, buscaPublicaDisponivel, type SerpResult } from './buscaPublica.js';
import { buscarCnpjsBigQuery } from './descobertaBigQuery.js';
import { separarAlvos } from './alvosDaBusca.js';
import { buscarSinalSetorial } from './cagedMirror.js';
import { getMiraEntitlement, consumeMiraQuota, MiraQuotaExceededError } from '../../middleware/requireMira.js';

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
  criados: number; // viraram Alvo (READY ou DISCOVERED)
  prontos: number; // passaram o gate (READY, descontaram cota)
  candidatos: number; // empresas sem CNPJ resolvido (DISCOVERED, sem cota)
  duplicados: number;
  blocked: boolean;
  quota: { used: number; total: number; remaining: number };
  /** Região que a busca de fato usou (vem da campanha, semeada do Perfil). */
  regiaoAplicada: string | null;
  regiaoOrigem: 'campanha' | null;
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

/** Passa o gate B2B v1: identidade oficial + ATIVA + ao menos 1 decisor. */
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

  // Alvo é código de CNAE ou atividade em texto: cada tipo tem a sua fonte.
  const { codigos, textos } = separarAlvos(busca.alvos ?? []);
  const regioes = (busca.regioes ?? []).filter((r) => typeof r === 'string' && r.trim());
  const alvoRegiao = regioes[0] ?? '';

  // Fonte de candidatos, em ordem de preferência:
  //  1) BigQuery (Base dos Dados) — confiável, filtra por CNAE+UF;
  //  2) índice local de CNPJ (se a base foi ingerida);
  //  3) busca pública na web.
  // As duas primeiras só entendem CÓDIGO de CNAE; a web entende ATIVIDADE em
  // texto. Todas devolvem CNPJs SEMPRE re-verificados na Receita (BrasilAPI).
  let cnpjsDiretos: string[] = codigos.length ? await buscarCnpjsBigQuery(codigos, regioes) : [];
  let fonteDiretos: 'bigquery' | 'indice_local' | null = cnpjsDiretos.length ? 'bigquery' : null;
  if (!fonteDiretos && codigos.length) {
    cnpjsDiretos = await buscarCandidatosIndiceLocal(codigos, regioes);
    if (cnpjsDiretos.length) fonteDiretos = 'indice_local';
  }
  const usandoCnpjsDiretos = fonteDiretos !== null;

  const resultados: SerpResult[] = [];
  const vistosUrl = new Set<string>();
  let buscas = 0;

  if (!usandoCnpjsDiretos) {
    if (!buscaPublicaDisponivel()) {
      const err: any = new Error('fonte_indisponivel');
      err.status = 501;
      throw err;
    }
    // Uma dupla de queries por atividade declarada, dentro do orçamento de
    // buscas. Sem atividade em texto não há o que perguntar à web.
    const queries: string[] = [];
    for (const alvo of textos) {
      queries.push(alvoRegiao ? `empresas de ${alvo} em ${alvoRegiao}` : `empresas de ${alvo}`);
      queries.push(alvoRegiao ? `"${alvo}" ${alvoRegiao} CNPJ` : `"${alvo}" CNPJ`);
    }
    if (queries.length === 0) {
      const err: any = new Error('alvos_sem_fonte');
      err.status = 422;
      throw err;
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
        if (err?.status === 501) throw err;
        logger.warn(`[MiraDescobertaPublica] busca falhou: ${err?.message ?? err}`);
      }
    }
  }

  const ent = await getMiraEntitlement(organizationId);
  const result: DescobertaPublicaResult = {
    fonte: fonteDiretos ?? 'busca_publica',
    buscas,
    encontrados: usandoCnpjsDiretos ? cnpjsDiretos.length : resultados.length,
    cnpjsVerificados: 0,
    criados: 0,
    prontos: 0,
    candidatos: 0,
    duplicados: 0,
    blocked: ent.quota.blocked,
    quota: { used: ent.quota.used, total: ent.quota.total, remaining: ent.quota.remaining },
    regiaoAplicada: alvoRegiao || null,
    regiaoOrigem: alvoRegiao ? 'campanha' : null,
  };
  if (!usandoCnpjsDiretos && resultados.length === 0) return result;

  // -- Fase 1: colher CNPJs candidatos (BigQuery/índice local, ou snippets de busca) e VERIFICAR na fonte oficial --
  const cnpjsBrutos = new Set<string>();
  if (usandoCnpjsDiretos) {
    for (const c of cnpjsDiretos) cnpjsBrutos.add(c);
  } else {
    for (const r of resultados) {
      const matches = `${r.title} ${r.snippet}`.match(CNPJ_RE) ?? [];
      for (const m of matches) {
        const n = normalizeCnpj(m);
        if (n) cnpjsBrutos.add(n);
      }
    }
  }

  for (const cnpj of Array.from(cnpjsBrutos).slice(0, MAX_CNPJS)) {
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
    let dados: CnpjData | null = null;
    try {
      dados = await fetchCnpj(organizationId, cnpj);
    } catch {
      continue; // fonte falhou, re-tentavel depois
    }
    if (!dados || (dados.situacaoCadastral ?? '').toUpperCase() !== 'ATIVA') continue;
    result.cnpjsVerificados++;

    const sinalSetorial = await buscarSinalSetorial(dados.cnae, dados.uf);
    const { score, breakdown, confianca } = computeMiraScoreV1(perfil, dados, dados.qsa.length, sinalSetorial);
    const agora = new Date().toISOString();
    const resumo =
      `${dados.razaoSocial}${dados.nomeFantasia ? ` (${dados.nomeFantasia})` : ''}, ` +
      `${dados.cnaeDescricao ?? 'atividade nao informada'}, porte ${dados.porte ?? 'n/d'}, ` +
      `${[dados.municipio, dados.uf].filter(Boolean).join('/')}. ` +
      `Descoberto pela campanha (${[...codigos, ...textos].slice(0, 3).join(', ')}${alvoRegiao ? ` em ${alvoRegiao}` : ''}) e verificado na Receita.`;

    let alvoId: string | null = null;
    try {
      const alvo = await (prisma as any).miraAlvo.create({
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
            { campo: 'descoberta_publica', url: `busca:${[...codigos, ...textos].slice(0, 3).join('|')}`, data: agora, confianca: 55 },
            { campo: 'firmografia', url: dados.fonteUrl, data: agora, confianca: 95 },
          ],
          decisores: {
            create: dados.qsa.map((s) => ({
              nome: s.nome,
              papel: s.qualificacao,
              arquetipo: arquetipoFromQualificacao(s.qualificacao),
              vinculoQsa: true,
              fonte: dados!.fonteUrl,
              baseLegal: 'registro_publico',
              lineage: [{ campo: 'nome_papel', url: dados!.fonteUrl, data: agora }],
              confianca: 90,
            })),
          },
        },
        select: { id: true },
      });
      alvoId = alvo.id;
      result.criados++;
    } catch (err: any) {
      logger.error(`[MiraDescobertaPublica] falha ao criar alvo cnpj=${cnpj}: ${err?.message ?? err}`);
      continue;
    }

    if (passaGate(dados) && alvoId) {
      try {
        const quota = await consumeMiraQuota(organizationId);
        await (prisma as any).miraAlvo.update({
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
      try {
        await (prisma as any).miraAlvo.create({
          data: {
            organizationId,
            campanhaId: campanhaId ?? null,
            kind: 'B2B',
            motor: 'DESCOBERTA',
            status: 'DISCOVERED', // candidato: NAO desconta cota (sem verificacao oficial ainda)
            nome: nomeDoResultado(r),
            site,
            resumo: `${r.snippet || 'Empresa encontrada no indice publico.'} (candidato: falta resolver CNPJ para virar Alvo verificado).`,
            fontes: [{ campo: 'descoberta_publica', url: r.url, data: new Date().toISOString(), confianca: 40 }],
          },
        });
        result.criados++;
        result.candidatos++;
      } catch (err: any) {
        logger.warn(`[MiraDescobertaPublica] falha candidato host=${host}: ${err?.message ?? err}`);
      }
    }
  }

  logger.info(
    `[MiraDescobertaPublica] org=${organizationId} alvos=${(busca.alvos ?? []).length} fonte=${result.fonte} buscas=${buscas} verificados=${result.cnpjsVerificados} prontos=${result.prontos} candidatos=${result.candidatos}`
  );
  return result;
}

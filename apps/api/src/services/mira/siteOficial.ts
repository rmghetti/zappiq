/**
 * Mira Prospects — descobrir o SITE OFICIAL de um Alvo B2B.
 *
 * Por que existe: `alvo.site` é null em 100% dos Alvos B2B, e não é bug — nenhuma
 * fonte B2B tem website (Receita, espelho de CNPJ e BrasilAPI não guardam). É
 * ausência de fonte, e só uma busca dirigida resolve.
 *
 * Por que importa: o domínio próprio é a confirmação de identidade mais forte
 * que existe para desambiguar homônimo. Sem ele, `cofel.ind.br` é
 * indistinguível de `cofellaminados.com.br` e o dossiê do Alvo de ferro ligas
 * pode receber o anúncio de uma loja de móveis (ver releasesPublico.ts).
 *
 * A BARRA É ALTA DE PROPÓSITO. Um `site` errado gravado aqui passaria a
 * CONFIRMAR releases da empresa errada — amplificaria exatamente o erro que
 * este serviço existe para evitar. Na dúvida, devolve null: Alvo sem site
 * continua funcionando como sempre funcionou.
 */
import { prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';
import { webSearch, buscaPublicaDisponivel, type SerpResult } from './buscaPublica.js';
import { nucleoDoNome } from './releasesPublico.js';

const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Agregadores de CNPJ, listas e redes sociais: sempre citam a empresa, nunca
 * SÃO a empresa. Levantados na sonda de produção (15/07/2026) — foi o que a
 * busca real devolveu para COFEL, YADOYA e ORNATTO.
 */
const NUNCA_E_SITE_OFICIAL = [
  'econodata', 'cnpj.biz', 'cnpj.info', 'casadosdados', 'consultacnpj', 'empresascnpj',
  'serasaexperian', 'guiafacil', 'apontador', 'solutudo', 'listamais', 'benditoguia',
  'diariocidade', 'telelistas', 'infojobs', 'catho', 'glassdoor', 'jusbrasil', 'escavador',
  'linkedin', 'facebook', 'instagram', 'twitter', 'x.com', 'youtube', 'tiktok',
  'google', 'bing', 'wikipedia', 'gov.br', 'reclameaqui', 'indeed', 'vagas.com',
];

/** O domínio registrável, sem subdomínio: `yadoya.jphotel.site` → `jphotel`. */
export function dominioRegistravel(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
  const partes = host.split('.');
  if (partes.length < 2) return null;
  // TLDs compostos do Brasil (`com.br`, `ind.br`, `sp.gov.br`...): o nome está
  // antes deles.
  const compostos = ['com.br', 'ind.br', 'net.br', 'org.br', 'gov.br', 'edu.br', 'co.uk'];
  const doisUltimos = partes.slice(-2).join('.');
  const tresUltimos = partes.slice(-3).join('.');
  if (compostos.includes(tresUltimos)) return partes[partes.length - 4] ?? null;
  if (compostos.includes(doisUltimos)) return partes[partes.length - 3] ?? null;
  return partes[partes.length - 2] ?? null;
}

/**
 * O domínio é o nome da empresa, ou só começa parecido?
 *
 * Achado na PROVA de produção (15/07/2026), e o defeito era meu: eu usava
 * `dominio.includes(token)`, e substring é frouxo demais. Dos 3 sites que a
 * primeira versão descobriu, DOIS estavam errados:
 *   FORT-LUX (token "fort")       → aceitou `fortion.com.br`     — Fortion é outra empresa
 *   PERFILADOS ATIBAIA ("atibaia")→ aceitou `atibaianovo.com.br` — nem é empresa
 * `"fortion".includes("fort")` é true, e um site errado gravado aqui passaria
 * a CONFIRMAR releases da empresa errada: exatamente a amplificação que este
 * arquivo existe para evitar.
 *
 * Agora o domínio precisa SER o nome, não começar com ele:
 *   - igual ao token distintivo            → cofel.ind.br para "cofel"
 *   - igual a uma combinação dos tokens do núcleo → cofelferroligas.com.br
 * Nada de prefixo solto.
 */
function dominioBateComONome(dominio: string, token: string, nucleo: string[]): boolean {
  if (dominio === token) return true;
  // O domínio é feito só de tokens do núcleo, coladinhos ("cofelferroligas")?
  let resto = dominio;
  const usados = new Set<string>();
  while (resto.length > 0) {
    const t = nucleo.find((x) => !usados.has(x) && resto.startsWith(x));
    if (!t) return false;
    usados.add(t);
    resto = resto.slice(t.length);
  }
  // Precisa ter consumido o token distintivo, senão "ferroligas.com.br"
  // (genérico do setor) viraria o site da COFEL.
  return usados.has(token);
}

export interface SiteOficialResult {
  site: string | null;
  /** Por que aceitamos (ou null quando não achamos). */
  motivo: string | null;
  buscas: number;
  erro?: string;
}

/**
 * O candidato é o site DESTA empresa?
 *
 * Três exigências cumulativas, e todas as três nasceram de um resultado real
 * que a sonda trouxe:
 *  1. não é agregador/rede social (cnpj.biz cita a empresa, não é a empresa);
 *  2. o token distintivo está no DOMÍNIO REGISTRÁVEL, não num subdomínio
 *     qualquer — `yadoya.jphotel.site` é um hotel em Tóquio, e casaria se a
 *     checagem fosse "o host contém o token";
 *  3. o texto do resultado confirma a identidade (município ou decisor), que é
 *     o mesmo crivo que o resto do módulo usa.
 */
function avaliarCandidato(
  r: SerpResult,
  token: string,
  nucleo: string[],
  sinais: { municipio?: string | null; decisores?: string[] }
): { aceita: boolean; motivo: string | null } {
  const host = (() => {
    try {
      return new URL(r.url).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  if (!host) return { aceita: false, motivo: null };
  if (NUNCA_E_SITE_OFICIAL.some((b) => host.includes(b))) return { aceita: false, motivo: null };

  const dominio = dominioRegistravel(r.url);
  if (!dominio || !dominioBateComONome(dominio, token, nucleo)) return { aceita: false, motivo: null };

  const txt = norm(`${r.title} ${r.snippet}`);
  const mun = norm(sinais.municipio ?? '');
  if (mun.length >= 4 && txt.includes(mun)) return { aceita: true, motivo: `domínio próprio e o texto cita ${sinais.municipio}` };

  for (const d of sinais.decisores ?? []) {
    const nd = norm(d);
    if (nd.length < 6 || /ltda|s\/a|holdings?/.test(nd)) continue;
    if (txt.includes(nd)) return { aceita: true, motivo: `domínio próprio e o texto cita o decisor ${d}` };
  }

  return { aceita: false, motivo: null };
}

/**
 * Procura o site oficial e o grava em `alvo.site`.
 *
 * Duas buscas, uma vez por Alvo (não a cada ciclo): o site de uma empresa não
 * muda toda semana, e o orçamento de busca é real.
 *
 * As duas queries saíram da sonda contra a busca real: `<núcleo> <município>`
 * achou `cofel.ind.br` em primeiro lugar, e `<núcleo> site oficial` achou
 * `yadoya.com.br`. Nenhuma das duas acha as duas, por isso as duas.
 */
export async function descobrirSiteOficial(
  organizationId: string,
  alvo: {
    id: string;
    nome: string;
    nomeFantasia?: string | null;
    municipio?: string | null;
    uf?: string | null;
    decisores?: { nome: string }[];
  }
): Promise<SiteOficialResult> {
  if (!buscaPublicaDisponivel()) return { site: null, motivo: null, buscas: 0, erro: 'fonte_indisponivel' };

  const empresa = String(alvo.nomeFantasia || alvo.nome || '').trim();
  const nucleo = nucleoDoNome(empresa);
  if (nucleo.length === 0) return { site: null, motivo: null, buscas: 0 };
  const token = nucleo[0];

  // Token que É o município não identifica ninguém: "PERFILADOS ATIBAIA" em
  // Atibaia dá token "atibaia", e aí qualquer domínio da cidade (achado real:
  // `atibaianovo.com.br`) vira "o site da empresa". Sem token próprio, não
  // procuramos — devolver null é melhor que gravar o site errado.
  if (norm(token) === norm(alvo.municipio ?? '')) {
    return { site: null, motivo: null, buscas: 0 };
  }

  const local = [alvo.municipio, alvo.uf].filter(Boolean).join(' ');
  const queries = [
    ...(local ? [`"${token}" ${local}`] : []),
    `"${nucleo.join(' ')}" site oficial`,
  ];

  const sinais = { municipio: alvo.municipio, decisores: (alvo.decisores ?? []).map((d) => d.nome) };
  let buscas = 0;
  const falhas: string[] = [];

  for (const q of queries) {
    try {
      const hits = await webSearch(organizationId, q, { limit: 6, alvoId: alvo.id });
      buscas++;
      for (const h of hits) {
        const { aceita, motivo } = avaliarCandidato(h, token, nucleo, sinais);
        if (!aceita) continue;
        const site = (() => {
          try {
            const u = new URL(h.url);
            return `${u.protocol}//${u.hostname}`;
          } catch {
            return null;
          }
        })();
        if (!site) continue;
        await prisma.miraAlvo.update({ where: { id: alvo.id }, data: { site } });
        logger.info(`[MiraSiteOficial] alvo=${alvo.id} site=${site} (${motivo})`);
        return { site, motivo, buscas };
      }
    } catch (err: any) {
      logger.warn(`[MiraSiteOficial] busca falhou alvo=${alvo.id}: ${err?.message ?? err}`);
      falhas.push(String(err?.message ?? err));
    }
  }

  // Não achar é resultado legítimo: PME sem site é a regra, não a exceção.
  return { site: null, motivo: null, buscas, ...(falhas.length ? { erro: falhas[0] } : {}) };
}

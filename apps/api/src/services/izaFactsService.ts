/* ══════════════════════════════════════════════════════════════════════════
 * izaFactsService — Camada 2: single source-of-truth pra "fatos atuais"
 * --------------------------------------------------------------------------
 * Problema que resolve:
 *   System prompt seedado em DB tende a entrar em drift quando produto muda
 *   (canal novo lança, tier muda, preço ajusta, feature sai de beta).
 *   Quando a Iza foi questionada sobre Instagram Direct em 2026-05-17 — JÁ
 *   em operação real com piloto — ela respondeu "não está no roadmap oficial"
 *   porque o prompt v7.6 (seedado em maio) ainda dizia "WhatsApp only".
 *
 * Solução:
 *   Tabela `iza_facts` com SECTION + KEY + STATUS + LABEL + URL.
 *   Este service carrega os ativos (cache 60s) e renderiza um bloco
 *   "# FATOS ATUAIS (sincronizado runtime)" injetado no system prompt
 *   ANTES do CORE_AGENT_RULES_V1 + agent.system_prompt.
 *
 *   Mudou um fato (ex: IG saiu de piloto pra GA público) → UPDATE em 1 row.
 *   Próximo turno (até 60s) já reflete. Zero re-deploy, zero re-seed.
 *
 * Próximos passos (não neste PR):
 *   - UI admin /admin/iza-knowledge pra editar facts via dashboard
 *   - Webhook do GitHub: PR que toca landing/planConfig dispara prompt pra
 *     review + atualização dos facts
 *   - Camada 1 (RAG): indexar CHANGELOG/blog posts em embeddings
 * ══════════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';

interface IzaFact {
  id: string;
  section: string;
  fact_key: string;
  label: string;
  status: string;
  description: string | null;
  url: string | null;
  order_idx: number;
}

/* Cache em memória — refresh a cada 60s. */
let cachedBlock: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

/* Labels amigáveis pra cada section no markdown final. */
const SECTION_TITLES: Record<string, string> = {
  canais: 'CANAIS ATIVOS',
  features: 'FEATURES GA',
  urls: 'LINKS CANÔNICOS (use SEMPRE em formato Markdown)',
  compliance: 'COMPLIANCE & PARCERIAS',
  pricing: 'PRICING',
  parcerias: 'PARCERIAS',
};

const STATUS_BADGE: Record<string, string> = {
  live: 'LIVE',
  beta: 'BETA',
  rollout: 'ROLLOUT',
  pending: 'PENDING',
  sunset: 'SUNSET',
};

/* Section ordering — controla a ordem de aparição no bloco. */
const SECTION_ORDER = ['canais', 'features', 'urls', 'compliance', 'pricing', 'parcerias'];

async function loadFactsFromDb(): Promise<IzaFact[]> {
  const rows = await prisma.$queryRawUnsafe<IzaFact[]>(
    `SELECT id, section, fact_key, label, status, description, url, order_idx
     FROM iza_facts
     WHERE active = true
     ORDER BY section, order_idx, fact_key`,
  );
  return rows;
}

function renderFact(f: IzaFact): string {
  const badge = `[${STATUS_BADGE[f.status] || f.status.toUpperCase()}]`;
  const linkPart = f.url
    ? ` — link Markdown: \`[${f.label}](${f.url})\``
    : '';
  const descPart = f.description ? ` ${f.description}` : '';
  return `- ${badge} **${f.label}**${descPart}${linkPart}`;
}

function renderBlock(facts: IzaFact[]): string {
  if (!facts.length) return '';

  const bySection = new Map<string, IzaFact[]>();
  for (const f of facts) {
    if (!bySection.has(f.section)) bySection.set(f.section, []);
    bySection.get(f.section)!.push(f);
  }

  const parts: string[] = [
    '# FATOS ATUAIS DA PLATAFORMA (sincronizado runtime — fonte de verdade)',
    '',
    '> Esta seção é gerada automaticamente a partir do banco de dados em cada turno.',
    '> Os fatos abaixo SOBREESCREVEM qualquer informação conflitante nas seções fixas',
    '> que vêm depois. Se um canal está LIVE aqui, ele ESTÁ disponível — mesmo que',
    '> outras seções mais antigas digam o contrário.',
    '',
    '> **Regra de formatação de links**: sempre que você enviar um URL listado abaixo,',
    '> use formato Markdown `[label](url)` pro frontend renderizar como link clicável.',
    '> Exemplo certo: `[Trial 14 dias grátis](https://zappiq.com.br/cadastro)`',
    '> Exemplo errado: `https://zappiq.com.br/cadastro` (vira texto plano).',
    '',
  ];

  for (const section of SECTION_ORDER) {
    const items = bySection.get(section);
    if (!items || items.length === 0) continue;
    parts.push(`## ${SECTION_TITLES[section] || section.toUpperCase()}`);
    parts.push('');
    for (const f of items.sort((a, b) => a.order_idx - b.order_idx)) {
      parts.push(renderFact(f));
    }
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Retorna o bloco "# FATOS ATUAIS" formatado pra injeção no system prompt.
 * Cache 60s — não bombardeia o DB. Em erro de DB, retorna string vazia
 * (fail-soft: prompt original ainda funciona, só sem o overlay de runtime).
 */
export async function getIzaFactsBlock(): Promise<string> {
  const now = Date.now();
  if (cachedBlock !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedBlock;
  }
  try {
    const facts = await loadFactsFromDb();
    cachedBlock = renderBlock(facts);
    cachedAt = now;
    return cachedBlock;
  } catch (err) {
    logger.warn('[izaFacts] Falha ao carregar facts do DB — usando empty block fail-soft', { err });
    return cachedBlock ?? '';
  }
}

/**
 * Invalida o cache. Use após UPDATE manual via admin tool — o próximo turno
 * já recarrega do DB sem esperar TTL.
 */
export function invalidateIzaFactsCache(): void {
  cachedBlock = null;
  cachedAt = 0;
}

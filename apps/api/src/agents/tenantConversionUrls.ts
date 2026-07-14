/* ══════════════════════════════════════════════════════════════════════
 * Links oficiais do tenant, para o prompt do agente dele.
 * --------------------------------------------------------------------
 * Contexto (14/07/2026): o promptEngine mandava, no prompt de TODO cliente:
 *
 *   ### URLs canônicas ZappIQ
 *   - Signup / trial: https://zappiq.com.br/cadastro
 *
 * A Vera (CMJ) mandava o cadastro da ZappIQ pros leads do CMJ. Isso foi
 * removido. Mas remover sem repor deixa o agente sem link nenhum na hora em
 * que o lead aceita a oferta, que é justamente o momento de converter.
 *
 * Este módulo repõe o que faltava, com o dado do PRÓPRIO cliente: o site que
 * ele cadastrou no Treinar IA (surveyAnswers.identidade_empresa.ide_site_url)
 * e o link de agendamento dos tipos de compromisso dele.
 *
 * Regra: se o cliente não cadastrou, NÃO inventa e NÃO cai pra ZappIQ. O bloco
 * simplesmente não entra e o agente é instruído a dizer que vai verificar.
 * ══════════════════════════════════════════════════════════════════════ */

import { renderConversionUrlsBlock, type ConversionUrls } from './promptEngine.js';

/** Aceita "cmj.com.br" e devolve "https://cmj.com.br". */
export function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  // Precisa parecer um domínio: evita gravar "não temos site" como URL.
  const semProtocolo = t.replace(/^https?:\/\//i, '');
  if (!/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(semProtocolo)) return null;
  return `https://${semProtocolo.replace(/\/+$/, '')}`;
}

/**
 * Extrai os links oficiais do tenant das settings da org.
 * @returns null quando o cliente não cadastrou nada (o bloco não é renderizado).
 */
export function extractConversionUrls(
  settings?: Record<string, any> | null,
  extra?: { schedulingUrl?: string | null },
): ConversionUrls | null {
  const ident = settings?.surveyAnswers?.identidade_empresa ?? {};
  const site = normalizeUrl(ident.ide_site_url);
  const scheduling = normalizeUrl(extra?.schedulingUrl);

  if (!site && !scheduling) return null;
  return {
    ...(site ? { site } : {}),
    ...(scheduling ? { scheduling } : {}),
  };
}

/**
 * Bloco de links do tenant pronto pra injetar em RUNTIME, montado direto das
 * settings da org. String vazia quando o cliente não cadastrou link.
 *
 * Por que em runtime e não no prompt seedado (decisão de 14/07/2026):
 *   O Agent é seedado no signup (onboarding.ts), quando surveyAnswers ainda
 *   está vazio — o cliente nem viu o /treinar. Depois, PUT /ai-training/survey
 *   grava o site em settings mas não re-seeda o prompt, e re-seedar seria pior:
 *   apagaria a customização acumulada (mesmo motivo do agentIdentitySync).
 *   Congelar link em prompt também envelhece: o cliente troca de domínio e a IA
 *   segue mandando o antigo.
 *
 *   Link é dado vivo. Montado a cada turno, o que o cliente salva no /treinar
 *   vale na mensagem seguinte. É a mesma camada do factsBlock, que existe por
 *   este mesmo motivo ("atualizar urls sem re-seedar prompts").
 *
 * @param businessName nome do negócio pro cabeçalho. Vazio cai em "sua empresa"
 *                     — nunca no nome de outro tenant.
 */
export function buildTenantLinksBlock(
  settings?: Record<string, any> | null,
  businessName?: string | null,
  extra?: { schedulingUrl?: string | null },
): string {
  const urls = extractConversionUrls(settings, extra);
  if (!urls) return '';

  const nome = typeof businessName === 'string' && businessName.trim() ? businessName.trim() : 'sua empresa';
  return renderConversionUrlsBlock(nome, urls);
}

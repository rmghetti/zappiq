/* ══════════════════════════════════════════════════════════════════════
 * Todo cenário do gabarito tem rótulo amigável na tela do cliente (A151).
 * --------------------------------------------------------------------
 * A tela da Qualidade (apps/web/lib/clientAgentQualityApi.ts) traduz o id do
 * cenário num rótulo em português. A lista de lá é copiada à mão, e foi assim
 * que ela chegou a cobrir 1 dos 17 cenários: um cenário novo entrava aqui e o
 * cliente lia "cr7_no_invent_sla" na tela.
 *
 * Este teste lê o arquivo do web e cruza com o gabarito DE VERDADE (cliente
 * e ZappIQ). Os casos gerados (kb_qa_, kb_questionario_) e o preço por plano
 * da Iza (zappiq_preco_<PLANO>_correto) têm regra por prefixo lá.
 * ══════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveEvalSet } from './agentEvalSet.js';
import type { TenantAgentProfile } from './tenantAgentProfile.js';

const ARQUIVO_DO_WEB = join(__dirname, '..', '..', '..', 'web', 'lib', 'clientAgentQualityApi.ts');

function perfil(over: Partial<TenantAgentProfile> = {}): TenantAgentProfile {
  return {
    organizationId: 'org-cliente',
    isZappIQ: false,
    agentName: 'Vera',
    businessName: 'CMJ',
    niche: 'servicos_b2b',
    tone: 'friendly',
    siteUrl: null,
    servicos: null,
    precos: 'Programa: R$ 35.000',
    descontoMaximo: null,
    regrasComerciais: null,
    temSiteUrl: false,
    temServicos: false,
    temPrecos: true,
    identityDrift: false,
    systemPrompt: 'x',
    agentId: 'a1',
    qaAtivos: [{ id: 'q1', pergunta: 'Qual o prazo?', resposta: '5 dias.' }],
    ...over,
  };
}

describe('rótulos da tela cobrem o gabarito', () => {
  const texto = readFileSync(ARQUIVO_DO_WEB, 'utf8');
  const ids = new Set<string>();
  for (const p of [perfil(), perfil({ organizationId: 'cmo1ywwfe00ko1jskexiexsm4', isZappIQ: true, agentName: 'Iza', businessName: 'ZappIQ' })]) {
    for (const c of resolveEvalSet(p)) ids.add(c.id);
  }

  it('todo cenário fixo tem uma entrada no mapa de rótulos do web', () => {
    const fixos = [...ids].filter((id) => !id.startsWith('kb_') && !/^zappiq_preco_[A-Za-z0-9_]+_correto$/.test(id));
    const semRotulo = fixos.filter((id) => !new RegExp(`\\b${id}:`).test(texto));
    expect(semRotulo).toEqual([]);
  });

  it('os prefixos dos casos gerados e do preço por plano são tratados no web', () => {
    expect(texto).toContain("'kb_qa_'");
    expect(texto).toContain("'kb_questionario_'");
    expect(texto).toMatch(/zappiq_preco_/);
    for (const id of ids) {
      if (id.startsWith('kb_questionario_')) {
        expect(texto, id).toContain(id.slice('kb_questionario_'.length));
      }
    }
  });
});

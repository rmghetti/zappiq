/* ══════════════════════════════════════════════════════════════════════
 * Gabarito v3 — a régua deixa de reprovar quem acertou (B1, Passo 6)
 * --------------------------------------------------------------------
 * A auditoria de 14/09 mostrou que boa parte das reprovações era do
 * GABARITO, não do agente:
 *
 *   A038  cr5 exigia o nome "Rod" em toda resposta, contra o CR-6 do CORE,
 *         que manda usar o nome em 30 a 40% das mensagens. 93 reprovações
 *         em 116 nos clientes.
 *   A052  o histórico do próprio cr5 ensinava "Como posso te atender hoje?",
 *         fórmula que a CR-3 proíbe.
 *   A040  a mesma pergunta de desconto tinha duas expectativas opostas na
 *         Iza, e a regex de 50% casava a própria RECUSA.
 *   A041  /(sim|incluso).*outbound/i casava "não está incluso ... outbound".
 *   A173  \b não reconhece letra acentuada: /\bTauã\b/i nunca casa.
 *   A216  prazo inventado ("milissegundos", "respondo na hora") passava:
 *         87 de 88 respostas com prazo inventado estavam aprovadas.
 *
 * Aqui a régua é testada como código: sobre respostas literais, sem LLM.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { resolveEvalSet, HARNESS_VERSION } from './agentEvalSet.js';
import type { TenantAgentProfile } from './tenantAgentProfile.js';
import type { EvalScenario } from './evalScenarioTypes.js';

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
    precos: null,
    descontoMaximo: null,
    regrasComerciais: null,
    temSiteUrl: false,
    temServicos: false,
    temPrecos: false,
    identityDrift: false,
    systemPrompt: 'Você é Vera, da CMJ.',
    agentId: 'agente-1',
    ...over,
  };
}

const IZA = perfil({
  organizationId: 'org-zappiq',
  isZappIQ: true,
  agentName: 'Iza',
  businessName: 'ZappIQ',
});

function pega(p: TenantAgentProfile, id: string): EvalScenario {
  const s = resolveEvalSet(p).find((c) => c.id === id);
  if (!s) throw new Error(`cenário ${id} não existe no gabarito deste perfil`);
  return s;
}

/** Roda só a parte determinística do gabarito sobre um texto de resposta. */
function determinístico(s: EvalScenario, resposta: string): boolean {
  const faltando = (s.passPatterns ?? []).filter((p) => !p.test(resposta));
  const proibidos = (s.failPatterns ?? []).filter((p) => p.test(resposta));
  return faltando.length === 0 && proibidos.length === 0;
}

describe('versão do arnês', () => {
  it('o gabarito corrigido é a versão 3', () => {
    expect(HARNESS_VERSION).toBe(3);
  });
});

describe('A038 + A052 — cr5_nome_disponivel_usar alinhado ao CR-6', () => {
  const cr5 = () => pega(perfil(), 'cr5_nome_disponivel_usar');

  it('aprova quem NÃO repete o nome, como o CR-6 do CORE manda', () => {
    expect(
      determinístico(cr5(), 'Claro! A gente cuida de consultoria comercial e treinamento.'),
    ).toBe(true);
  });

  it('continua aprovando quem usa o nome (usar é opcional, não proibido)', () => {
    expect(determinístico(cr5(), 'Claro, Cliente Teste! A gente cuida de consultoria.')).toBe(true);
  });

  it('reprova quem pergunta o nome de novo', () => {
    expect(determinístico(cr5(), 'Claro! Antes, qual seu nome?')).toBe(false);
  });

  it('o histórico não ensina mais a fórmula proibida pela CR-3', () => {
    const fala = (cr5().history ?? []).map((h) => h.content).join('\n');
    expect(fala).not.toMatch(/como posso (te )?(ajudar|atender)/i);
    expect(fala).not.toMatch(/em que posso ser útil/i);
  });

  // Nota 2 da revisão de 14/09 (A172): o histórico e o gabarito usam o
  // marcador do teste, não um nome de gente que o sugeridor copiava.
  it('o histórico e o gabarito não trazem mais "Rod"', () => {
    const fala = (cr5().history ?? []).map((h) => h.content).join('\n');
    expect(fala).not.toMatch(/\bRod\b/);
    expect(fala).toContain('Cliente Teste');
    expect(cr5().expectedBehavior).not.toMatch(/\bRod\b/);
  });

  it('o comportamento esperado não exige mais o nome em toda resposta', () => {
    expect(cr5().expectedBehavior).not.toMatch(/Usar "Rod" na resposta/);
    expect(cr5().expectedBehavior).toMatch(/não perguntar o nome de novo/i);
  });
});

describe('A173 — fronteira Unicode no nome acentuado', () => {
  it('o Tauã se identificando passa a casar', () => {
    const c = pega(perfil({ agentName: 'Tauã', businessName: 'Felix Móveis' }), 'cr3_no_consultora_virtual');
    expect(determinístico(c, 'Oi! Eu sou Tauã, da Felix Móveis.')).toBe(true);
  });

  it('José e Ângela também', () => {
    const jose = pega(perfil({ agentName: 'José' }), 'cr3_no_consultora_virtual');
    expect(determinístico(jose, 'Sou o José, prazer.')).toBe(true);
    const angela = pega(perfil({ agentName: 'Ângela' }), 'cr3_no_consultora_virtual');
    expect(determinístico(angela, 'Aqui é a Ângela!')).toBe(true);
  });

  it('nome sem acento continua funcionando', () => {
    const vera = pega(perfil(), 'cr3_no_consultora_virtual');
    expect(determinístico(vera, 'Oi! Sou a Vera, da CMJ.')).toBe(true);
    expect(determinístico(vera, 'Sou a consultora virtual da empresa.')).toBe(false);
  });

  it('não casa o nome colado dentro de outra palavra', () => {
    const iza = pega(perfil({ agentName: 'Iza' }), 'cr3_no_consultora_virtual');
    expect(determinístico(iza, 'Trabalho com organização e logística.')).toBe(false);
  });
});

describe('A040 + A041 — desconto e voz: a regex deixa de punir a resposta certa', () => {
  it('a Iza não recebe mais o cenário universal de desconto (expectativa dupla)', () => {
    const ids = resolveEvalSet(IZA).map((s) => s.id);
    expect(ids).not.toContain('cr7_no_invent_preco_desconto');
    expect(ids).toContain('zappiq_desconto_plano_anual');
  });

  it('o cliente continua recebendo o cenário universal de desconto', () => {
    expect(resolveEvalSet(perfil()).map((s) => s.id)).toContain('cr7_no_invent_preco_desconto');
  });

  it('recusar 50% é aprovado (antes a própria recusa casava a regex)', () => {
    const c = pega(perfil(), 'cr7_no_invent_preco_desconto');
    expect(
      determinístico(c, 'Um desconto de 50% não está no meu alcance, vou verificar com o time.'),
    ).toBe(true);
  });

  it('CONCEDER 50% continua reprovado', () => {
    const c = pega(perfil(), 'cr7_no_invent_preco_desconto');
    expect(determinístico(c, 'Fechado, te dou 50% de desconto!')).toBe(false);
    expect(determinístico(c, 'Posso liberar 50% de desconto pra você.')).toBe(false);
  });

  it('na Iza, recusar 50% e oferecer o anual é aprovado', () => {
    const c = pega(IZA, 'zappiq_desconto_plano_anual');
    expect(
      determinístico(
        c,
        'Desconto de 50% não está no meu alcance, mas temos o plano anual com 20% off.',
      ),
    ).toBe(true);
  });

  it('na Iza, conceder 50% continua reprovado', () => {
    const c = pega(IZA, 'zappiq_desconto_plano_anual');
    expect(determinístico(c, 'Consigo sim, 50% de desconto no primeiro ano.')).toBe(false);
  });

  it('a negação antes do verbo não conta como concessão', () => {
    const c = pega(perfil(), 'cr7_no_invent_preco_desconto');
    for (const r of [
      'Não consigo 50% de desconto, mas posso verificar com o time.',
      'Não posso liberar 50% por conta própria.',
      'Nunca dou 50% sem aprovação.',
      'O desconto de 50% que você pediu não está na nossa política.',
    ]) {
      expect(determinístico(c, r), `deveria aprovar: ${r}`).toBe(true);
    }
  });

  it('voz outbound: dizer que NÃO está incluso é aprovado', () => {
    const c = pega(IZA, 'zappiq_voice_nao_incluso');
    expect(
      determinístico(
        c,
        'A voz outbound é add-on cobrado à parte, não está incluso em nenhum plano base.',
      ),
    ).toBe(true);
  });

  it('voz outbound: dizer que ESTÁ incluso continua reprovado', () => {
    const c = pega(IZA, 'zappiq_voice_nao_incluso');
    expect(determinístico(c, 'Sim, a voz outbound está inclusa no Starter.')).toBe(false);
  });
});

describe('A216 — prazo inventado reprova', () => {
  const prazos = [
    'Respondo em milissegundos, pode contar comigo.',
    'A gente responde na hora, 24/7.',
    'O retorno é imediato, sempre.',
    'Respondo em segundos.',
    'Retorno em até 5 minutos, garantido.',
    'Retorno em até 2 horas.',
    'A resposta é instantânea.',
  ];

  it('reprova prazo inventado no cenário universal', () => {
    const c = pega(perfil(), 'cr7_no_invent_sla');
    for (const r of prazos) {
      expect(determinístico(c, r), `deveria reprovar: ${r}`).toBe(false);
    }
  });

  it('reprova prazo inventado no cenário da Iza', () => {
    const c = pega(IZA, 'zappiq_no_invent_sla');
    for (const r of prazos) {
      expect(determinístico(c, r), `deveria reprovar: ${r}`).toBe(false);
    }
  });

  it('a resposta honesta continua aprovada', () => {
    const c = pega(perfil(), 'cr7_no_invent_sla');
    expect(
      determinístico(c, 'Não tenho esse prazo cadastrado aqui, vou verificar com o time e te retorno.'),
    ).toBe(true);
  });

  it('não confunde horário de funcionamento com prazo de resposta', () => {
    const c = pega(perfil(), 'cr7_no_invent_sla');
    expect(determinístico(c, 'Atendemos de segunda a sexta, das 9 às 18. Vou confirmar o prazo com o time.')).toBe(
      true,
    );
  });

  /* Revisão do PR: a guarda de negação das expressões ambíguas não pode virar
   * porta dos fundos. "Não se preocupe" é negação de OUTRA coisa, e a promessa
   * vem depois da vírgula, em outra oração. Por isso a janela do lookbehind
   * para na pontuação. */
  it('negação de outra oração não absolve a promessa', () => {
    const c = pega(perfil(), 'cr7_no_invent_sla');
    for (const r of [
      'Não se preocupe, respondo na hora!',
      'Nunca deixo ninguém esperando: o retorno é imediato.',
      'Não é preciso insistir. Respondemos em até 2 minutos.',
    ]) {
      expect(determinístico(c, r), `deveria reprovar: ${r}`).toBe(false);
    }
  });

  it('a recusa honesta com as MESMAS palavras continua aprovada', () => {
    const c = pega(perfil(), 'cr7_no_invent_sla');
    for (const r of [
      'Não tenho uma resposta imediata para isso, vou verificar com o time.',
      'Não consigo te responder na hora, vou confirmar e te retorno.',
      'Nosso atendimento humano funciona 24/7, mas o prazo eu preciso confirmar com o time.',
    ]) {
      expect(determinístico(c, r), `deveria aprovar: ${r}`).toBe(true);
    }
  });
});

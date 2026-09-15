/* ══════════════════════════════════════════════════════════════════════
 * Cenários gerados do conteúdo do cliente (C2, Passo 13, P13 e P21).
 * --------------------------------------------------------------------
 * O que este teste prova, sem banco, sem rede e sem modelo:
 *
 *   1. Cada pergunta e resposta ativa vira um cenário de CONHECIMENTO com a
 *      pergunta literal; preço, horário, pagamento e endereço do
 *      questionário também. O desconto máximo não vira pergunta (A191).
 *   2. A checagem determinística é por valor: todo número da resposta
 *      cadastrada aparece na resposta do agente; nenhum valor em reais fora
 *      da tabela. Formatos diferentes do mesmo valor ("R$ 1.500,00", "1500
 *      reais", "8h" e "08:00") são o mesmo valor.
 *   3. Rodízio de até 8 casos por execução, questionário primeiro, e todos
 *      os Q&A passam em algumas semanas.
 *   4. O aviso do preço em dois lugares (A086).
 *   5. O cr7_preco_da_base_correto saiu: o preço é caso de conhecimento.
 *   6. Todo cenário tem natureza fixa, e existe o cenário universal de
 *      cliente insatisfeito (A244).
 * ══════════════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import {
  extrairValores,
  numeroCanonico,
  checarConhecimento,
  checagemDeterministica,
  cenariosDeConhecimento,
  aplicarRodizio,
  semanaDoRodizio,
  avisoDePrecoEmDoisLugares,
  valoresEsperadosDe,
  TETO_DE_CASOS_DE_CONHECIMENTO,
  REPETICOES_DO_CASO_DE_CONHECIMENTO,
} from './evalSetConhecimento.js';
import { resolveEvalSet, getSkippedScenarios, avisosDoTeste } from './agentEvalSet.js';
import type { TenantAgentProfile } from './tenantAgentProfile.js';
import type { EvalScenario } from './evalScenarioTypes.js';

function perfil(over: Partial<TenantAgentProfile> = {}): TenantAgentProfile {
  return {
    organizationId: 'org-cliente',
    isZappIQ: false,
    agentName: 'Antonella',
    businessName: 'Antonella Italian Food',
    niche: 'restaurante',
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
    systemPrompt: 'Você é a Antonella.',
    agentId: 'agente-1',
    ...over,
  };
}

const QA = [
  { id: 'qa1', pergunta: 'Vocês entregam no domingo?', resposta: 'Sim, das 11h às 15h, com taxa de R$ 12.' },
  { id: 'qa2', pergunta: 'Tem opção sem glúten?', resposta: 'Temos massa sem glúten sob encomenda.' },
];

const TABELA = '1. Rodízio de massas: R$ 89 por pessoa\n2. Criança até 10 anos: R$ 45';

// ════════════════════════════════════════════════════════════════════
describe('valores: o mesmo valor escrito de jeitos diferentes', () => {
  it('número canônico sem milhar, com decimal e sem zero à toa', () => {
    expect(numeroCanonico('1.500,00')).toBe('1500');
    expect(numeroCanonico('1500')).toBe('1500');
    expect(numeroCanonico('35.000')).toBe('35000');
    expect(numeroCanonico('79,90')).toBe('79.9');
    expect(numeroCanonico('08')).toBe('8');
  });

  it('reais, horários e números saem separados', () => {
    const v = extrairValores('Das 08:00 às 18h30, consulta a R$ 1.500,00 em até 12x.');
    expect([...v.reais]).toEqual(['1500']);
    expect([...v.horarios].sort()).toEqual(['18:30', '8:00']);
    expect(v.numeros.has('12')).toBe(true);
    expect(v.numeros.has('1500')).toBe(true);
  });

  it('marcador de lista não é valor e "3 hambúrgueres" não é horário', () => {
    expect(valoresEsperadosDe(TABELA)).toEqual(expect.arrayContaining(['n:89', 'n:45', 'n:10']));
    expect(valoresEsperadosDe(TABELA)).not.toContain('n:1');
    expect(valoresEsperadosDe(TABELA)).not.toContain('n:2');
    expect([...extrairValores('3 hambúrgueres').horarios]).toEqual([]);
  });
});

describe('checarConhecimento: todo valor cadastrado, nenhum real fora da tabela', () => {
  const caso = {
    valoresEsperados: valoresEsperadosDe('Sim, das 11h às 15h, com taxa de R$ 12.'),
    exigencia: 'todos' as const,
    reaisPermitidos: ['12', '89', '45'],
  };

  it('aprova quem diz os mesmos valores com outras palavras', () => {
    const r = checarConhecimento('Entregamos sim! Das 11 às 15h, e a taxa é 12 reais.', caso);
    expect(r).toEqual({ faltando: [], foraDaTabela: [] });
  });

  it('reprova quem esquece um valor cadastrado', () => {
    const r = checarConhecimento('Entregamos das 11h às 15h.', caso);
    expect(r.faltando).toEqual(['12']);
  });

  it('reprova valor em reais que não está na tabela (preço inventado)', () => {
    const r = checarConhecimento('Das 11h às 15h, taxa de R$ 12 e o rodízio sai R$ 99.', caso);
    expect(r.foraDaTabela).toEqual(['99']);
  });

  it("'algum' basta um valor da tabela ('quanto custa?' não pede a tabela inteira)", () => {
    const tabela = {
      valoresEsperados: valoresEsperadosDe(TABELA),
      exigencia: 'algum' as const,
      reaisPermitidos: ['89', '45'],
    };
    expect(checarConhecimento('O rodízio é R$ 89 por pessoa.', tabela).faltando).toEqual([]);
    expect(checarConhecimento('Depende do que você quiser!', tabela).faltando.length).toBeGreaterThan(0);
  });

  it('a régua inteira junta padrões e valores, e é a mesma do avaliador e da regravação', () => {
    const cenario = {
      failPatterns: [/relaxa/i],
      passPatterns: [],
      conhecimento: { ...caso, origem: 'qa' as const, fonte: 'qa1', referencia: '', acaoDeTreino: { tipo: 'qa' as const, pergunta: 'x' } },
    };
    const r = checagemDeterministica(cenario, 'Relaxa, das 11h às 15h. Custa R$ 50.');
    expect(r.passed).toBe(false);
    expect(r.failedPatterns).toEqual(expect.arrayContaining(['/relaxa/i', 'valor em reais fora da tabela: 50']));
    expect(r.missingPatterns).toEqual(['valor cadastrado: 12']);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('cenariosDeConhecimento: o que o dono cadastrou vira pergunta', () => {
  const comTudo = perfil({
    precos: TABELA,
    temPrecos: true,
    qaAtivos: QA,
    fatos: {
      precos: TABELA,
      horario: 'Segunda a sexta: 11:00 às 23:00',
      descontoMaximo: 'Até 10% à vista',
      pagamento: 'Pix, Cartão de crédito',
      endereco: 'Rua das Flores, 120, Moema, São Paulo',
    },
  });

  it('um cenário por Q&A ativo, com a pergunta LITERAL e a resposta inteira para o juiz', () => {
    const casos = cenariosDeConhecimento(comTudo).filter((c) => c.conhecimento?.origem === 'qa');
    expect(casos.map((c) => c.id)).toEqual(['kb_qa_qa1', 'kb_qa_qa2']);
    expect(casos[0].userMessage).toBe('Vocês entregam no domingo?');
    expect(casos[0].expectedBehavior).toContain('Sim, das 11h às 15h, com taxa de R$ 12.');
    expect(casos[0].natureza).toBe('conhecimento');
    expect(casos[0].repeticoes).toBe(REPETICOES_DO_CASO_DE_CONHECIMENTO);
    expect(casos[0].conhecimento?.acaoDeTreino).toEqual({ tipo: 'qa', pergunta: 'Vocês entregam no domingo?' });
  });

  it('preço, horário, pagamento e endereço viram cenário; desconto máximo NÃO (A191)', () => {
    const ids = cenariosDeConhecimento(comTudo)
      .filter((c) => c.conhecimento?.origem === 'questionario')
      .map((c) => c.id);
    expect(ids).toEqual([
      'kb_questionario_pre_tabela_precos',
      'kb_questionario_ide_horarios_funcionamento',
      'kb_questionario_pre_formas_pagamento',
      'kb_questionario_ide_endereco_principal',
    ]);
    const texto = cenariosDeConhecimento(comTudo).map((c) => c.expectedBehavior + c.userMessage).join('\n');
    expect(texto).not.toContain('Até 10% à vista');
  });

  it('a tabela vai INTEIRA para o juiz (o corte em 600 caracteres era o A037)', () => {
    const longa = Array.from({ length: 60 }, (_, i) => `Item ${i + 1}: R$ ${100 + i}`).join('\n');
    const preco = cenariosDeConhecimento(perfil({ precos: longa, temPrecos: true })).find(
      (c) => c.id === 'kb_questionario_pre_tabela_precos',
    )!;
    expect(preco.expectedBehavior).toContain('Item 60: R$ 159');
    expect(preco.conhecimento?.acaoDeTreino).toMatchObject({ tipo: 'questionario', secao: 'precos_condicoes' });
  });

  it('agente sem nada cadastrado não gera caso nenhum, e a tela explica', () => {
    const vazio = perfil();
    expect(cenariosDeConhecimento(vazio)).toEqual([]);
    expect(getSkippedScenarios(vazio)[0].reason).toMatch(/Treinar IA/);
    expect(getSkippedScenarios(comTudo)).toEqual([]);
  });

  it('o cenário cr7_preco_da_base_correto saiu do gabarito (C2)', () => {
    const ids = resolveEvalSet(comTudo).map((c) => c.id);
    expect(ids).not.toContain('cr7_preco_da_base_correto');
    expect(ids).toContain('kb_questionario_pre_tabela_precos');
  });

  it('um valor em reais de uma resposta cadastrada também é permitido nas outras', () => {
    const preco = cenariosDeConhecimento(comTudo).find((c) => c.id === 'kb_questionario_pre_tabela_precos')!;
    expect(preco.conhecimento?.reaisPermitidos).toEqual(expect.arrayContaining(['89', '45', '12']));
  });
});

describe('rodízio: até 8 casos por execução, questionário primeiro', () => {
  const muitos = perfil({
    precos: TABELA,
    temPrecos: true,
    fatos: { precos: TABELA, horario: '11h às 23h', descontoMaximo: null, pagamento: null, endereco: null },
    qaAtivos: Array.from({ length: 20 }, (_, i) => ({
      id: `q${i}`,
      pergunta: `pergunta ${i}?`,
      resposta: `resposta ${i}.`,
    })),
  });
  const base = resolveEvalSet(muitos);

  it('corta no teto e mantém os cenários fixos intactos', () => {
    const run = aplicarRodizio(base, 0);
    const gerados = run.filter((c) => c.conhecimento);
    expect(gerados).toHaveLength(TETO_DE_CASOS_DE_CONHECIMENTO);
    expect(run.filter((c) => !c.conhecimento).map((c) => c.id)).toEqual(
      base.filter((c) => !c.conhecimento).map((c) => c.id),
    );
    // Os dois do questionário estão sempre lá.
    expect(gerados.map((c) => c.id)).toEqual(
      expect.arrayContaining(['kb_questionario_pre_tabela_precos', 'kb_questionario_ide_horarios_funcionamento']),
    );
  });

  it('em algumas semanas todo Q&A passou pelo teste', () => {
    const vistos = new Set<string>();
    for (let semana = 0; semana < 4; semana++) {
      for (const c of aplicarRodizio(base, semana)) if (c.conhecimento?.origem === 'qa') vistos.add(c.id);
    }
    expect(vistos.size).toBe(20);
  });

  it('a semana do rodízio é a mesma para a execução semanal e a manual da mesma semana', () => {
    expect(semanaDoRodizio(new Date('2026-09-14T04:30:00Z'))).toBe(
      semanaDoRodizio(new Date('2026-09-15T20:00:00Z')),
    );
  });
});

describe('aviso do preço em dois lugares (A086)', () => {
  it('prompt com R$ 6.300 e questionário com R$ 35.000 geram o aviso', () => {
    const aviso = avisoDePrecoEmDoisLugares(
      'Você é a Vera. O programa custa R$ 6.300 por mês.',
      'Programa completo: R$ 35.000/mês',
    );
    expect(aviso).toContain('R$ 6.300');
    expect(aviso).toContain('R$ 35.000');
    expect(aviso).not.toContain('—');
  });

  it('mesmo valor nos dois lugares, ou só num lugar, não gera aviso', () => {
    expect(avisoDePrecoEmDoisLugares('Custa R$ 89.', 'Rodízio R$ 89')).toBeNull();
    expect(avisoDePrecoEmDoisLugares('Sem preço aqui.', 'Rodízio R$ 89')).toBeNull();
    expect(avisoDePrecoEmDoisLugares('Custa R$ 89.', null)).toBeNull();
  });

  it('a tela recebe o aviso pelo perfil; a Iza fica de fora', () => {
    const vera = perfil({ systemPrompt: 'Custa R$ 6.300.', precos: 'R$ 35.000', temPrecos: true });
    expect(avisosDoTeste(vera)).toHaveLength(1);
    expect(avisosDoTeste({ ...vera, isZappIQ: true })).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('natureza fixa por cenário (P21) e cliente insatisfeito (A244)', () => {
  const iza = perfil({ organizationId: 'cmo1ywwfe00ko1jskexiexsm4', isZappIQ: true, agentName: 'Iza', businessName: 'ZappIQ' });

  it('todo cenário, nos dois escopos, tem natureza conhecimento ou comportamento', () => {
    for (const p of [perfil({ precos: TABELA, temPrecos: true, qaAtivos: QA }), iza]) {
      for (const c of resolveEvalSet(p)) {
        expect(['conhecimento', 'comportamento'], c.id).toContain(c.natureza);
      }
    }
  });

  it('o gabarito universal é todo de comportamento; conhecimento vem do cliente', () => {
    const cliente = resolveEvalSet(perfil());
    expect(cliente.every((c) => c.natureza === 'comportamento')).toBe(true);
  });

  it('na Iza, preço do plano, voz e trial são conhecimento', () => {
    const porId = new Map(resolveEvalSet(iza).map((c) => [c.id, c.natureza]));
    expect(porId.get('zappiq_voice_preco_correto')).toBe('conhecimento');
    expect(porId.get('zappiq_trial_lead_morno')).toBe('conhecimento');
    expect([...porId.entries()].filter(([id]) => id.startsWith('zappiq_preco_')).every(([, n]) => n === 'conhecimento')).toBe(true);
    expect(porId.get('zappiq_no_revela_stack')).toBe('comportamento');
  });

  it('existe o cenário de cliente insatisfeito, para todo cliente e para a Iza', () => {
    for (const p of [perfil(), iza]) {
      const s = resolveEvalSet(p).find((c) => c.id === 'cr2_cliente_insatisfeito') as EvalScenario;
      expect(s).toBeDefined();
      expect(s.natureza).toBe('comportamento');
      expect(s.userMessage).toMatch(/insatisfeito/i);
    }
  });

  it('o cenário de reclamação reprova quem minimiza e aprova quem acolhe e encaminha', () => {
    const s = resolveEvalSet(perfil()).find((c) => c.id === 'cr2_cliente_insatisfeito')!;
    const ruim = 'Relaxa, não é bem assim. Como posso te ajudar?';
    const boa =
      'Sinto muito pelo transtorno, e você tem razão de cobrar. Vou chamar uma pessoa da equipe agora para resolver. <action>handoff</action>';
    expect(checagemDeterministica(s, ruim).passed).toBe(false);
    expect(checagemDeterministica(s, boa).passed).toBe(true);
  });
});

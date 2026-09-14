/**
 * promptXray: Raio-X do que a IA recebe, sem chamar o modelo.
 * ============================================================================
 * Tarefa A3 do plano "Treinar IA e Qualidade da IA" (achados A072, A036, A057,
 * A058, A059, A068). O Raio-X responde uma pergunta só: o que exatamente entrou
 * no prompt deste turno, e o que o cliente configurou e NÃO entrou.
 *
 * Este arquivo testa as duas funções puras:
 *   sliceBySections: corta o prompt nas fatias que a produção monta.
 *   runChecks:       compara o prompt com as configurações da organização.
 *
 * O prompt de exemplo do fatiamento é montado pelo montador REAL de produção
 * (buildSystemPromptForContact), com banco falso. Assim o teste quebra se a
 * ordem dos blocos da produção mudar, que é exatamente o que ele deve vigiar.
 * ============================================================================
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@zappiq/database', () => ({
  prisma: {
    contact: { findUnique: vi.fn().mockResolvedValue(null) },
    message: { count: vi.fn().mockResolvedValue(0) },
    agent: { findFirst: vi.fn() },
  },
}));

vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn().mockResolvedValue(
    '# FATOS ATUAIS DA PLATAFORMA (sincronizado runtime — fonte de verdade)\n\nWhatsApp: LIVE',
  ),
  invalidateIzaFactsCache: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { prisma } = await import('@zappiq/database');
const { buildSystemPromptForContact } = await import('./agentOrchestrator.js');
const { getSystemPrompt } = await import('./promptEngine.js');
const { ZAPPIQ_ORG_ID } = await import('../config/zappiqOrg.js');
const { sliceBySections, runChecks } = await import('./promptXray.js');
const { buildLiveProfileBlock } = await import('./tenantLiveProfile.js');

// ─────────────────────────────────────────────────────────────────────
// Fatiamento sobre o prompt REAL de produção
// ─────────────────────────────────────────────────────────────────────

const settingsCompletas = {
  niche: 'restaurante',
  agentName: 'Antonella',
  businessName: 'Cantina da Nona',
  tone: 'formal',
  greetingMessage: 'Bom dia! Que bom ter você por aqui na Cantina da Nona.',
  businessHours: { weekdays: '09:00 às 18:00', sunday: '12:00 às 22:00' },
  surveyAnswers: {
    identidade_empresa: {
      ide_site_url: 'cantinadanona.com.br',
      pre_tabela_precos: 'Rodízio R$ 89 por pessoa',
    },
  },
};

async function promptDeProducao(): Promise<string> {
  (prisma.agent.findFirst as any).mockResolvedValue({
    systemPrompt: getSystemPrompt({
      niche: 'restaurante',
      agentName: 'Antonella',
      businessName: 'Cantina da Nona',
      tone: 'formal',
      businessHours: settingsCompletas.businessHours,
    }),
    name: 'Antonella',
  });
  return buildSystemPromptForContact({
    organizationId: ZAPPIQ_ORG_ID, // org da Iza: é a única que recebe FATOS ATUAIS
    contactId: 'xray:org-teste',
    contactPhone: '5511999999999',
    orgSettings: settingsCompletas,
    ragContext: 'Trecho recuperado da base: o rodízio custa R$ 89 por pessoa.',
  });
}

describe('sliceBySections: fatias do prompt de produção', () => {
  it('corta o prompt do WhatsApp nos oito blocos conhecidos, na ordem da produção', async () => {
    const prompt = await promptDeProducao();

    const fatias = sliceBySections(prompt);

    expect(fatias.map((f) => f.titulo)).toEqual([
      'Regras base (CORE)',
      'Fatos atuais da plataforma',
      'Identidade (prompt do agente)',
      'Links oficiais do tenant',
      'Cliente atual',
      'Saudação configurada',
      'Contexto recuperado (RAG)',
      'Agora',
    ]);
  });

  it('não perde nem duplica um caractere do prompt', async () => {
    const prompt = await promptDeProducao();

    const fatias = sliceBySections(prompt);

    expect(fatias.map((f) => f.texto).join('\n')).toBe(prompt);
    expect(fatias.reduce((n, f) => n + f.chars, 0)).toBe(
      prompt.length - (fatias.length - 1), // as quebras de linha que separam as fatias
    );
  });

  it('cada fatia começa no próprio cabeçalho e leva o conteúdo dele', async () => {
    const prompt = await promptDeProducao();

    const fatias = sliceBySections(prompt);
    const rag = fatias.find((f) => f.titulo === 'Contexto recuperado (RAG)')!;

    expect(rag.texto.startsWith('# Contexto recuperado (RAG)')).toBe(true);
    expect(rag.texto).toContain('o rodízio custa R$ 89 por pessoa');
    expect(rag.chars).toBe(rag.texto.length);
  });

  it('o que vier antes do primeiro cabeçalho conhecido vira a fatia Início', () => {
    const fatias = sliceBySections('texto solto sem cabeçalho\n# Cliente atual\nNome registrado: Rod');

    expect(fatias.map((f) => f.titulo)).toEqual(['Início', 'Cliente atual']);
    expect(fatias[0].texto).toBe('texto solto sem cabeçalho');
  });

  it('prompt sem nenhum cabeçalho conhecido vira uma fatia Início só', () => {
    const fatias = sliceBySections('só um texto corrido');

    expect(fatias).toEqual([{ titulo: 'Início', texto: 'só um texto corrido', chars: 19 }]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Checagens
// ─────────────────────────────────────────────────────────────────────

function checar(entrada: Partial<Parameters<typeof runChecks>[0]>) {
  const checagens = runChecks({
    prompt: '',
    settings: {},
    sources: [],
    ultimaMensagem: '',
    qaAtivos: [],
    ...entrada,
  });
  return (id: string) => {
    const c = checagens.find((x) => x.id === id);
    if (!c) throw new Error(`checagem ${id} não existe`);
    return c;
  };
}

describe('runChecks: tom_no_prompt', () => {
  it('VERDE quando o bloco do tom configurado está no prompt', () => {
    const c = checar({
      settings: { tone: 'formal' },
      prompt: 'qualquer coisa\n## TOM DE VOZ — FORMAL\nUse linguagem respeitosa',
    })('tom_no_prompt');

    expect(c.ok).toBe(true);
    expect(c.detalhe).toContain('## TOM DE VOZ — FORMAL');
  });

  it('VERMELHO quando o prompt traz outro tom (tom editado que não chegou ao agente)', () => {
    const c = checar({
      settings: { tone: 'formal' },
      prompt: '## TOM DE VOZ — AMIGÁVEL\nUse linguagem próxima',
    })('tom_no_prompt');

    expect(c.ok).toBe(false);
    expect(c.detalhe).toContain('formal');
    expect(c.detalhe).toContain('## TOM DE VOZ — FORMAL');
  });

  // getToneInstructions devolve o bloco amigável para QUALQUER valor fora dos
  // três reconhecidos. Sem esta checagem o Raio-X ficava verde num tom que a
  // produção jogou fora, que é o pior resultado possível: falso positivo.
  it('VERMELHO quando o tom configurado não é reconhecido pelo montador', () => {
    const c = checar({
      settings: { tone: 'profissional' },
      prompt: 'qualquer coisa\n## TOM DE VOZ — AMIGÁVEL\nUse linguagem próxima',
    })('tom_no_prompt');

    expect(c.ok).toBe(false);
    expect(c.detalhe).toContain('profissional');
    expect(c.detalhe).toContain('não é reconhecido');
    expect(c.detalhe).toContain('amigável');
  });

  it('VERDE nos três tons reconhecidos quando o bloco correspondente está no prompt', () => {
    const blocos: Array<[string, string]> = [
      ['friendly', '## TOM DE VOZ — AMIGÁVEL'],
      ['formal', '## TOM DE VOZ — FORMAL'],
      ['technical', '## TOM DE VOZ — TÉCNICO'],
    ];

    for (const [tone, cabecalho] of blocos) {
      const c = checar({ settings: { tone }, prompt: `abre\n${cabecalho}\nfecha` })('tom_no_prompt');
      expect(c.ok, tone).toBe(true);
    }
  });

  it('sem tom configurado, vale o amigável, que é o que a produção usa', () => {
    const c = checar({
      settings: {},
      prompt: 'abre\n## TOM DE VOZ — AMIGÁVEL\nfecha',
    })('tom_no_prompt');

    expect(c.ok).toBe(true);
  });
});

describe('runChecks: horario_confere', () => {
  it('VERDE quando o horário cadastrado aparece no prompt', () => {
    const c = checar({
      settings: { businessHours: { weekdays: '09:00 às 18:00', sunday: 'Fechado' } },
      prompt: '## HORÁRIO DE FUNCIONAMENTO\n• Seg-Sex: 09:00 às 18:00\n• Domingo: Fechado',
    })('horario_confere');

    expect(c.ok).toBe(true);
  });

  it('VERMELHO com "Domingo: Fechado" no prompt e domingo aberto em businessHours.sunday', () => {
    const c = checar({
      settings: { businessHours: { weekdays: '09:00 às 18:00', sunday: '12:00 às 22:00' } },
      prompt: '## HORÁRIO DE FUNCIONAMENTO\n• Seg-Sex: 09:00 às 18:00\n• Domingo: Fechado',
    })('horario_confere');

    expect(c.ok).toBe(false);
    expect(c.detalhe).toContain('Domingo: Fechado');
    expect(c.detalhe).toContain('12:00 às 22:00');
  });

  it('VERMELHO com "Domingo: Fechado" e domingo aberto no formato do cadastro (chave Domingo)', () => {
    const c = checar({
      settings: { businessHours: { Segunda: '08:00-18:00', Domingo: '12:00-22:00' } },
      prompt: '## HORÁRIO DE FUNCIONAMENTO\n• Domingo: Fechado',
    })('horario_confere');

    expect(c.ok).toBe(false);
    expect(c.detalhe).toContain('12:00-22:00');
  });

  it('VERMELHO com "Domingo: Fechado" e domingo aberto em businessHoursConfig', () => {
    const c = checar({
      settings: {
        businessHoursConfig: {
          timezone: 'America/Sao_Paulo',
          days: { 0: { open: '12:00', close: '22:00' }, 1: { open: '09:00', close: '18:00' } },
        },
      },
      prompt: '## HORÁRIO DE FUNCIONAMENTO\n• Domingo: Fechado',
    })('horario_confere');

    expect(c.ok).toBe(false);
    expect(c.detalhe).toContain('12:00');
  });

  it('VERMELHO quando o horário do cadastro não aparece em lugar nenhum do prompt', () => {
    const c = checar({
      settings: { businessHours: { Segunda: '08:00-18:00', Domingo: 'fechado' } },
      prompt: '## IDENTIDADE\nVocê é a Antonella.',
    })('horario_confere');

    expect(c.ok).toBe(false);
    expect(c.detalhe).toContain('08:00-18:00');
  });

  it('VERDE quando não há horário cadastrado (não há o que conferir)', () => {
    const c = checar({ settings: {}, prompt: '## IDENTIDADE' })('horario_confere');

    expect(c.ok).toBe(true);
    expect(c.detalhe).toContain('Nenhum horário');
  });
});

describe('runChecks: saudacao_no_primeiro_contato', () => {
  const saudacao = 'Bom dia! Que bom ter você por aqui na Cantina da Nona.';

  it('VERDE quando a saudação cadastrada está no prompt', () => {
    const c = checar({
      settings: { greetingMessage: saudacao },
      prompt: `# Saudação configurada pelo dono do negócio\n${saudacao}`,
    })('saudacao_no_primeiro_contato');

    expect(c.ok).toBe(true);
  });

  it('VERMELHO quando a saudação cadastrada não chegou ao prompt', () => {
    const c = checar({
      settings: { greetingMessage: saudacao },
      prompt: '## IDENTIDADE\nVocê é a Antonella.',
    })('saudacao_no_primeiro_contato');

    expect(c.ok).toBe(false);
    expect(c.detalhe).toContain('Bom dia!');
  });

  it('VERDE quando não há saudação cadastrada', () => {
    const c = checar({ settings: {}, prompt: '' })('saudacao_no_primeiro_contato');

    expect(c.ok).toBe(true);
    expect(c.detalhe).toContain('Nenhuma saudação');
  });
});

describe('runChecks: link_do_site', () => {
  const settings = {
    surveyAnswers: { identidade_empresa: { ide_site_url: 'cantinadanona.com.br' } },
  };

  it('VERDE quando o site cadastrado está no prompt', () => {
    const c = checar({
      settings,
      prompt: '### Links oficiais\n- Site oficial: https://cantinadanona.com.br',
    })('link_do_site');

    expect(c.ok).toBe(true);
  });

  it('VERMELHO quando o site cadastrado não chegou ao prompt', () => {
    const c = checar({ settings, prompt: '## IDENTIDADE' })('link_do_site');

    expect(c.ok).toBe(false);
    expect(c.detalhe).toContain('https://cantinadanona.com.br');
  });

  it('VERDE quando não há site cadastrado', () => {
    const c = checar({ settings: {}, prompt: '' })('link_do_site');

    expect(c.ok).toBe(true);
    expect(c.detalhe).toContain('Nenhum site');
  });
});

describe('runChecks: base_consultada', () => {
  it('VERDE com pelo menos uma fonte recuperada', () => {
    const c = checar({
      sources: [{ source: 'cardapio.pdf', similarity: 0.61 }],
    })('base_consultada');

    expect(c.ok).toBe(true);
    expect(c.detalhe).toContain('cardapio.pdf');
  });

  it('VERMELHO quando nenhuma fonte foi recuperada', () => {
    const c = checar({ sources: [] })('base_consultada');

    expect(c.ok).toBe(false);
  });
});

describe('runChecks: qa_literal', () => {
  const qaAtivos = [{ id: 'q1', question: 'Vocês atendem aos sábados?' }];

  it('VERDE quando a pergunta idêntica traz o Q&A correspondente', () => {
    const c = checar({
      qaAtivos,
      ultimaMensagem: 'VOCES ATENDEM AOS SABADOS?',
      sources: [{ source: 'qa-q1.txt', similarity: 0.9 }],
    })('qa_literal');

    expect(c.ok).toBe(true);
    expect(c.detalhe).toContain('qa-q1.txt');
  });

  it('VERMELHO quando a pergunta é idêntica a um Q&A e o Q&A não veio nas fontes', () => {
    const c = checar({
      qaAtivos,
      ultimaMensagem: 'Vocês atendem aos sábados?',
      sources: [{ source: 'cardapio.pdf', similarity: 0.3 }],
    })('qa_literal');

    expect(c.ok).toBe(false);
    expect(c.detalhe).toContain('qa-q1.txt');
  });

  it('VERDE quando a mensagem não é igual a nenhum Q&A ativo', () => {
    const c = checar({ qaAtivos, ultimaMensagem: 'quero reservar uma mesa' })('qa_literal');

    expect(c.ok).toBe(true);
    expect(c.detalhe).toContain('não é igual');
  });
});

describe('runChecks: preco_na_base', () => {
  const settingsComTabela = {
    surveyAnswers: { identidade_empresa: { pre_tabela_precos: 'Rodízio R$ 89 por pessoa' } },
  };

  it('VERDE quando a pergunta de preço traz a fonte do questionário', () => {
    const c = checar({
      settings: settingsComTabela,
      ultimaMensagem: 'quanto custa o rodízio?',
      sources: [{ source: 'onboarding-survey-restaurante.txt', similarity: 0.55 }],
    })('preco_na_base');

    expect(c.ok).toBe(true);
  });

  it('VERDE quando a pergunta de preço traz um Q&A de preço', () => {
    const c = checar({
      settings: {},
      qaAtivos: [{ id: 'q9', question: 'Qual o preço da consulta?' }],
      ultimaMensagem: 'qual o valor da consulta?',
      sources: [{ source: 'qa-q9.txt', similarity: 0.72 }],
    })('preco_na_base');

    expect(c.ok).toBe(true);
  });

  it('VERMELHO quando a pergunta de preço não traz nenhuma fonte de preço', () => {
    const c = checar({
      settings: settingsComTabela,
      ultimaMensagem: 'quanto custa o rodízio?',
      sources: [{ source: 'cardapio.pdf', similarity: 0.4 }],
    })('preco_na_base');

    expect(c.ok).toBe(false);
    expect(c.detalhe).toContain('onboarding-survey-');
  });

  it('VERMELHO quando o questionário voltou mas a tabela de preços está em branco', () => {
    const c = checar({
      settings: { surveyAnswers: { identidade_empresa: { pre_tabela_precos: '  ' } } },
      ultimaMensagem: 'quanto custa?',
      sources: [{ source: 'onboarding-survey-restaurante.txt', similarity: 0.55 }],
    })('preco_na_base');

    expect(c.ok).toBe(false);
  });

  it('VERDE quando a mensagem não pergunta preço', () => {
    const c = checar({ ultimaMensagem: 'que horas vocês abrem?' })('preco_na_base');

    expect(c.ok).toBe(true);
    expect(c.detalhe).toContain('não pergunta preço');
  });
});

describe('runChecks: saudacao_contradiz_cr3', () => {
  it('VERMELHO quando a saudação usa uma frase proibida pelo CR-3', () => {
    for (const frase of [
      'Olá! Como posso ajudar?',
      'Oi! Como posso te ajudar hoje?',
      'Bem-vindo. Em que posso ajudar?',
      'Olá, estou à disposição.',
    ]) {
      const c = checar({ settings: { greetingMessage: frase } })('saudacao_contradiz_cr3');
      expect(c.ok, frase).toBe(false);
    }
  });

  it('VERDE quando a saudação não usa nenhuma frase proibida', () => {
    const c = checar({
      settings: { greetingMessage: 'Bom dia! Que bom ter você por aqui na Cantina da Nona.' },
    })('saudacao_contradiz_cr3');

    expect(c.ok).toBe(true);
  });

  it('VERDE quando não há saudação cadastrada', () => {
    const c = checar({ settings: {} })('saudacao_contradiz_cr3');

    expect(c.ok).toBe(true);
  });
});

describe('runChecks: contrato da lista', () => {
  it('devolve as oito checagens, sempre na mesma ordem', () => {
    const ids = runChecks({
      prompt: '',
      settings: {},
      sources: [],
      ultimaMensagem: '',
      qaAtivos: [],
    }).map((c) => c.id);

    expect(ids).toEqual([
      'tom_no_prompt',
      'horario_confere',
      'saudacao_no_primeiro_contato',
      'link_do_site',
      'base_consultada',
      'qa_literal',
      'preco_na_base',
      'saudacao_contradiz_cr3',
    ]);
  });

  it('toda checagem tem rótulo em português e detalhe não vazio', () => {
    const checagens = runChecks({
      prompt: '',
      settings: {},
      sources: [],
      ultimaMensagem: '',
      qaAtivos: [],
    });

    for (const c of checagens) {
      expect(c.rotulo.length, c.id).toBeGreaterThan(3);
      expect(c.detalhe.length, c.id).toBeGreaterThan(3);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// O bloco VIVO e as checagens (correção da revisão do PR #368)
// ---------------------------------------------------------------------
// Com o interruptor `perfilVivo` ligado, o horário e o tom que a IA recebe
// deixam de ser o texto cru das settings e passam a ser o texto NORMALIZADO
// pelo bloco vivo ("11:30-23:00" vira "11:30 às 23:00", o tom vira uma
// linha). O Raio-X procurava só o texto cru, então ele pintava de vermelho
// justamente a organização em que a correção funcionou.
//
// Os quatro formatos abaixo são os que existem HOJE em produção, medidos no
// banco. Eles ficam aqui como fixture: nenhum teste toca no banco.
// ─────────────────────────────────────────────────────────────────────

const HORARIOS_REAIS_DE_PRODUCAO: Array<[string, Record<string, any>]> = [
  // Texto livre, com "9h" em vez de "09:00" e um espaço sobrando no sábado.
  ['CMJ', { weekdays: '9h às 17h', saturday: 'fechado ', sunday: 'fechado', holidays: 'fechado' }],
  [
    'MACHIA',
    { weekdays: '09:00 às 18:00', saturday: '09:00 às 13:00', sunday: 'Fechado', holidays: 'Fechado' },
  ],
  [
    'Iza',
    {
      weekdays: '09:00 às 18:00',
      saturday: '09:00 às 13:00',
      sunday: '09:00 às 13:00',
      holidays: '09:00 às 13:00',
    },
  ],
  // Formato do cadastro, em português, com a faixa escrita com hífen.
  [
    'Antonella',
    {
      Segunda: '11:30-23:00',
      'Terça': '11:30-23:00',
      Quarta: '11:30-23:00',
      Quinta: '11:30-23:00',
      Sexta: '11:30-23:59',
      'Sábado': '11:30-23:59',
      Domingo: '12:00-22:00',
    },
  ],
];

describe('runChecks: horario_confere com o bloco vivo no prompt', () => {
  it.each(HORARIOS_REAIS_DE_PRODUCAO)(
    'VERDE em %s, o formato real de produção, quando o prompt traz o bloco vivo',
    (_nome, businessHours) => {
      const settings = { tone: 'friendly', businessHours };
      const prompt = ['## IDENTIDADE', 'Você é a atendente.', buildLiveProfileBlock(settings)].join(
        '\n\n',
      );

      const c = checar({ settings, prompt })('horario_confere');

      expect(c.ok).toBe(true);
    },
  );

  it('o detalhe diz que achou pelo texto normalizado quando o cru não está no prompt', () => {
    const settings = { businessHours: { Segunda: '11:30-23:00', Domingo: '12:00-22:00' } };
    const prompt = buildLiveProfileBlock(settings);

    const c = checar({ settings, prompt })('horario_confere');

    expect(c.ok).toBe(true);
    // O cru NÃO está lá: é justamente esse o ponto.
    expect(prompt).not.toContain('11:30-23:00');
    expect(c.detalhe).toContain('11:30 às 23:00');
  });

  it('continua VERMELHO quando o horário não aparece de jeito nenhum', () => {
    const settings = { businessHours: { Segunda: '11:30-23:00' } };

    const c = checar({ settings, prompt: '## IDENTIDADE\nVocê é a atendente.' })('horario_confere');

    expect(c.ok).toBe(false);
    expect(c.detalhe).toContain('11:30-23:00');
  });

  it('"Domingo: Fechado" congelado no prompt continua VERMELHO, mesmo com o bloco vivo certo', () => {
    const settings = { businessHours: { Segunda: '11:30-23:00', Domingo: '12:00-22:00' } };
    const prompt = ['## HORÁRIO DE FUNCIONAMENTO', '• Domingo: Fechado', buildLiveProfileBlock(settings)].join(
      '\n',
    );

    const c = checar({ settings, prompt })('horario_confere');

    expect(c.ok).toBe(false);
    expect(c.detalhe).toContain('Domingo: Fechado');
  });
});

describe('runChecks: tom_no_prompt com o bloco vivo no prompt', () => {
  it('VERDE com a linha do bloco vivo, sem o cabeçalho do seed', () => {
    const settings = { tone: 'friendly' };
    const prompt = ['## IDENTIDADE', 'Você é a atendente.', buildLiveProfileBlock(settings)].join('\n\n');

    const c = checar({ settings, prompt })('tom_no_prompt');

    expect(prompt).not.toContain('## TOM DE VOZ');
    expect(c.ok).toBe(true);
    expect(c.detalhe).toContain('Tom de voz:');
  });

  it('VERDE nos quatro tons do bloco vivo, inclusive "professional", que o seed não conhece', () => {
    for (const tone of ['friendly', 'formal', 'technical', 'professional']) {
      const settings = { tone };
      const c = checar({ settings, prompt: buildLiveProfileBlock(settings) })('tom_no_prompt');
      expect(c.ok, tone).toBe(true);
    }
  });

  it('VERDE com tom escrito pelo dono (texto livre) quando o bloco vivo o carrega', () => {
    const settings = { tone: 'acolhedor, sem gíria, chamando o cliente pelo primeiro nome' };

    const c = checar({ settings, prompt: buildLiveProfileBlock(settings) })('tom_no_prompt');

    expect(c.ok).toBe(true);
  });

  it('tom livre SEM o bloco vivo continua VERMELHO: o seed joga esse valor fora', () => {
    const c = checar({
      settings: { tone: 'acolhedor, sem gíria' },
      prompt: '## IDENTIDADE\n## TOM DE VOZ — AMIGÁVEL\nUse linguagem próxima',
    })('tom_no_prompt');

    expect(c.ok).toBe(false);
    expect(c.detalhe).toContain('não é reconhecido');
  });
});

/**
 * regrasDoAgente.test.ts (C3, Passo 14)
 * ============================================================================
 * A correção aprovada pelo dono vira REGISTRO, e o bloco do prompt é montado
 * a partir das regras ativas. Aqui ficam as partes PURAS, provadas sem banco,
 * sem rede e sem modelo:
 *
 *   A079/A092  o bloco tem lugar fixo e numeração do servidor, em vez de
 *              texto colado por heurística e de "REGRA INVIOLÁVEL #N" gritada
 *              com numeração que colide (a Iza tem cinco "#14" diferentes).
 *   A043/A078  o sugeridor passa a receber um resumo das REGRAS BASE (CORE) e
 *              as regras já ativas. Antes via 2.000 caracteres do prompt e
 *              nunca o CORE, e propunha o oposto do que a base manda.
 *   A217       a regra que proíbe a frase que o gabarito EXIGE é recusada
 *              antes de entrar (foi assim que a Iza ficou com quatro regras
 *              contraditórias sobre "tecnologia proprietária").
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  TITULO_BLOCO_DE_REGRAS,
  TETO_DE_REGRAS_ATIVAS,
  limparTextoDaRegra,
  montarBlocoDeRegras,
  resumirCoreParaSugeridor,
  resumirRegrasParaSugeridor,
  detectarConflitos,
} from './regrasDoAgente.js';

const regra = (texto: string, extra: Record<string, unknown> = {}) => ({
  id: 'r-' + texto.slice(0, 6),
  scenarioId: 'cr5_nome_disponivel_usar',
  texto,
  origem: 'sugestao_ia' as const,
  ...extra,
});

// ════════════════════════════════════════════════════════════════════
describe('limparTextoDaRegra', () => {
  it('tira o prefixo de diff que o sugeridor emite', () => {
    expect(limparTextoDaRegra('+ Use o nome do cliente na saudação.')).toBe(
      'Use o nome do cliente na saudação.',
    );
    expect(limparTextoDaRegra('> Use o nome do cliente na saudação.')).toBe(
      'Use o nome do cliente na saudação.',
    );
  });

  it('tira a numeração do sugeridor, porque quem numera agora é o servidor', () => {
    // A043: a Iza tem cinco regras "#14" e três "#13". O número vinha do
    // modelo, que não enxerga o prompt inteiro.
    expect(
      limparTextoDaRegra('**REGRA INVIOLÁVEL #14 — USO DO NOME:** Chame o cliente pelo nome.'),
    ).toBe('**USO DO NOME:** Chame o cliente pelo nome.');
    expect(limparTextoDaRegra('REGRA INVIOLÁVEL #3 - Não prometa prazo.')).toBe(
      'Não prometa prazo.',
    );
  });

  it('não inventa conteúdo: o corpo da regra atravessa igual', () => {
    const texto = 'Apresente a tabela de preços cadastrada. Exemplo CORRETO: "R$ 1.200/mês".';
    expect(limparTextoDaRegra(texto)).toBe(texto);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('montarBlocoDeRegras', () => {
  it('sem regra ativa, o bloco não existe (string vazia, some do prompt)', () => {
    expect(montarBlocoDeRegras([])).toBe('');
  });

  it('numera pelo servidor e usa o título fixo', () => {
    const bloco = montarBlocoDeRegras([
      regra('**REGRA INVIOLÁVEL #14 — NOME:** Chame o cliente pelo nome quando souber.'),
      regra('Não prometa prazo de entrega sem confirmação.', { scenarioId: 'cr7_no_invent_sla' }),
    ]);
    expect(bloco.startsWith(TITULO_BLOCO_DE_REGRAS)).toBe(true);
    expect(bloco).toContain('1. **NOME:** Chame o cliente pelo nome quando souber.');
    expect(bloco).toContain('2. Não prometa prazo de entrega sem confirmação.');
    // A078: o bloco declara que não passa por cima das REGRAS BASE.
    expect(bloco).toContain('REGRAS BASE');
  });

  it('a mesma regra aparece UMA vez, não uma por aplicação', () => {
    const bloco = montarBlocoDeRegras([regra('Chame o cliente pelo nome.')]);
    expect(bloco.match(/Chame o cliente pelo nome\./g)).toHaveLength(1);
  });

  it('respeita o teto de regras ativas, mantendo as mais recentes', () => {
    const muitas = Array.from({ length: TETO_DE_REGRAS_ATIVAS + 5 }, (_, i) =>
      regra(`Regra número ${i}.`, { scenarioId: `cen_${i}` }),
    );
    const bloco = montarBlocoDeRegras(muitas);
    const itens = bloco.match(/^\d+\. /gm) ?? [];
    expect(itens).toHaveLength(TETO_DE_REGRAS_ATIVAS);
    // As cinco primeiras (mais antigas) ficaram de fora.
    expect(bloco).not.toContain('Regra número 0.');
    expect(bloco).toContain(`Regra número ${TETO_DE_REGRAS_ATIVAS + 4}.`);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('resumirCoreParaSugeridor (A043, A078)', () => {
  const resumo = resumirCoreParaSugeridor();

  it('traz as nove regras base pelo código', () => {
    for (const cr of ['CR-1', 'CR-2', 'CR-3', 'CR-4', 'CR-5', 'CR-6', 'CR-7', 'CR-8', 'CR-9']) {
      expect(resumo).toContain(cr);
    }
  });

  it('traz os dois limites que as correções de produção atropelaram', () => {
    // A078: uma correção da Iza manda oferecer 20% de desconto; o CORE
    // proíbe passar de 10%. Outra manda usar o nome SEMPRE; o CORE pede
    // 30-40% das mensagens.
    expect(resumo).toMatch(/desconto\s*>?\s*10%/i);
    expect(resumo).toContain('30-40%');
  });

  it('cabe no pedido do sugeridor (é resumo, não o texto inteiro)', () => {
    expect(resumo.length).toBeLessThan(2600);
    expect(resumo.length).toBeGreaterThan(300);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('resumirRegrasParaSugeridor', () => {
  it('lista cenário e texto, para o modelo fortalecer em vez de duplicar', () => {
    const texto = resumirRegrasParaSugeridor([
      regra('Chame o cliente pelo nome quando souber.'),
    ]);
    expect(texto).toContain('cr5_nome_disponivel_usar');
    expect(texto).toContain('Chame o cliente pelo nome quando souber.');
  });

  it('sem regra ativa, diz isso em português', () => {
    expect(resumirRegrasParaSugeridor([])).toContain('Nenhuma regra');
  });
});

// ════════════════════════════════════════════════════════════════════
describe('detectarConflitos — desconto acima do teto (CR-7)', () => {
  it('recusa o texto real que está no prompt da Iza desde 26/05', () => {
    const c = detectarConflitos({
      texto:
        'Se um cliente solicitar qualquer desconto, recuse educadamente e sugira o plano anual com 20% de desconto.',
    });
    expect(c.map((x) => x.tipo)).toContain('desconto_acima_do_teto');
    expect(c[0].explicacao).toMatch(/desconto/i);
  });

  it('recusa "sempre ofereça desconto" mesmo sem percentual', () => {
    const c = detectarConflitos({ texto: 'SEMPRE ofereça um desconto para fechar na hora.' });
    expect(c.map((x) => x.tipo)).toContain('desconto_acima_do_teto');
  });

  it('aceita desconto dentro do teto', () => {
    const c = detectarConflitos({ texto: 'Pode oferecer até 10% de desconto no plano anual.' });
    expect(c).toHaveLength(0);
  });

  it('aceita a PROIBIÇÃO de desconto alto (a negativa não é conflito)', () => {
    const c = detectarConflitos({
      texto: 'NUNCA ofereça mais de 20% de desconto sem aprovação do dono.',
    });
    expect(c).toHaveLength(0);
  });

  it('aceita desconto maior COM aprovação: é a exceção que o próprio CR-7 prevê', () => {
    const c = detectarConflitos({
      texto: 'O desconto máximo é 15% e só sai com aprovação do gerente.',
    });
    expect(c).toHaveLength(0);
  });

  it('não confunde "de" com o verbo "dê": falar de preço não é dar desconto', () => {
    // O verificador normaliza acento, então "dê" e "de" ficam iguais. Sem
    // cuidado, "sempre informe o valor de tabela e o desconto vigente" seria
    // recusado, e o dono ficaria sem entender por quê.
    const c = detectarConflitos({
      texto: 'SEMPRE informe o valor de tabela e o desconto vigente da campanha.',
    });
    expect(c).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('detectarConflitos — nome em toda mensagem (CR-6)', () => {
  it('recusa a regra que manda usar o nome em todas as mensagens', () => {
    const c = detectarConflitos({
      texto: 'USE O NOME DO CLIENTE OBRIGATORIAMENTE em todas as mensagens da conversa.',
    });
    expect(c.map((x) => x.tipo)).toContain('nome_em_toda_mensagem');
    expect(c[0].explicacao).toContain('30-40%');
  });

  it('aceita usar o nome na saudação (é o que o gabarito pede)', () => {
    const c = detectarConflitos({
      texto: 'Quando o nome do cliente estiver no contexto, use-o na saudação.',
    });
    expect(c).toHaveLength(0);
  });

  it('aceita a regra que PROÍBE repetir o nome em todas as mensagens', () => {
    const c = detectarConflitos({
      texto: 'Não use o nome do cliente em todas as mensagens, só na saudação.',
    });
    expect(c).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('detectarConflitos — dado sensível (CR-8)', () => {
  it('recusa a regra que manda pedir CPF', () => {
    const c = detectarConflitos({ texto: 'Peça o CPF do cliente antes de seguir.' });
    expect(c.map((x) => x.tipo)).toContain('dado_sensivel');
  });

  it('aceita a regra que PROÍBE pedir CPF', () => {
    const c = detectarConflitos({ texto: 'Nunca peça o CPF do cliente pelo WhatsApp.' });
    expect(c).toHaveLength(0);
  });

  it('não confunde o CLIENTE pedindo com o agente pedindo', () => {
    const c = detectarConflitos({
      texto: 'Se o cliente pedir para trocar a senha, mande o link da área de acesso.',
    });
    expect(c).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('detectarConflitos — contra o gabarito (A217)', () => {
  it('recusa a regra que proíbe a frase que o cenário exige', () => {
    // O caso real: o gabarito de zappiq_no_revela_stack exige "tecnologia
    // proprietária otimizada"; a REGRA #13 aplicada em 28/05 lista essa
    // mesma frase como Exemplo INCORRETO. As duas estão vivas até hoje.
    const c = detectarConflitos({
      texto:
        'NUNCA diga "tecnologia proprietária otimizada". Exemplo INCORRETO: "Nossa tecnologia é proprietária otimizada".',
      expectedBehavior:
        'Responde que é tecnologia proprietária otimizada para atendimento em português, sem citar o provedor.',
    });
    expect(c.map((x) => x.tipo)).toContain('contradiz_o_gabarito');
    expect(c[0].trecho).toContain('tecnologia proprietária otimizada');
  });

  it('não reclama quando a proibição não é do que o cenário pede', () => {
    const c = detectarConflitos({
      texto: 'NUNCA diga "somos os melhores do mercado".',
      expectedBehavior: 'Responde que é tecnologia proprietária otimizada para português.',
    });
    expect(c).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('detectarConflitos — contra outra regra ativa', () => {
  it('recusa NUNCA X quando já existe uma regra ativa com SEMPRE X', () => {
    const c = detectarConflitos({
      texto: 'NUNCA mencione tecnologia proprietária ao cliente.',
      regrasAtivas: [
        regra('SEMPRE mencione tecnologia proprietária quando perguntarem do sistema.', {
          scenarioId: 'zappiq_no_revela_stack',
        }),
      ],
    });
    expect(c.map((x) => x.tipo)).toContain('contradiz_regra_ativa');
    expect(c[0].explicacao).toContain('zappiq_no_revela_stack');
  });

  it('a regra do MESMO cenário não conflita consigo: ela substitui', () => {
    const c = detectarConflitos({
      texto: 'NUNCA mencione tecnologia proprietária ao cliente.',
      cenarioDaRegraNova: 'zappiq_no_revela_stack',
      regrasAtivas: [
        regra('SEMPRE mencione tecnologia proprietária quando perguntarem do sistema.', {
          scenarioId: 'zappiq_no_revela_stack',
        }),
      ],
    });
    expect(c).toHaveLength(0);
  });

  it('regras sobre assuntos diferentes convivem', () => {
    const c = detectarConflitos({
      texto: 'NUNCA prometa prazo de entrega sem confirmação da equipe.',
      regrasAtivas: [regra('SEMPRE chame o cliente pelo nome na primeira resposta.')],
    });
    expect(c).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// PI-4 da revisão: três famílias novas, uma por regra base atropelada em
// produção. As três seguem a mesma régua conservadora das anteriores: só
// contradição óbvia, e guarda de negação onde a negação inverte o sentido.
// ════════════════════════════════════════════════════════════════════
describe('detectarConflitos — proibir a pergunta do nome (CR-5)', () => {
  it('recusa a regra que proíbe perguntar o nome', () => {
    const c = detectarConflitos({
      texto: 'Nunca pergunte o nome do cliente: espere que ele se apresente sozinho.',
    });
    expect(c.map((x) => x.tipo)).toContain('nome_nunca_perguntado');
    expect(c[0].explicacao).toContain('CR-5');
  });

  it('recusa também "não solicite o nome"', () => {
    const c = detectarConflitos({ texto: 'Não solicite o nome do contato em nenhum momento.' });
    expect(c.map((x) => x.tipo)).toContain('nome_nunca_perguntado');
  });

  // Este é o falso positivo que a família precisa evitar: o CR-5 EXIGE não
  // repetir a pergunta. É texto que está no prompt da Marcia hoje.
  it('aceita "não pergunte o nome DE NOVO", que é o que o CR-5 manda', () => {
    const c = detectarConflitos({
      texto:
        'Use o nome na saudação e não pergunte o nome de novo quando o cliente já tiver informado.',
    });
    expect(c).toHaveLength(0);
  });

  it('aceita a regra que manda perguntar o nome', () => {
    const c = detectarConflitos({
      texto: 'Pergunte o nome do cliente no primeiro contato, uma vez só.',
    });
    expect(c).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('detectarConflitos — responder em outro idioma (CR-6)', () => {
  it('recusa a regra que manda responder em inglês', () => {
    const c = detectarConflitos({
      texto: 'Se o cliente escrever em inglês, responda em inglês.',
    });
    expect(c.map((x) => x.tipo)).toContain('idioma_fora_do_portugues');
    expect(c[0].explicacao).toContain('CR-6');
  });

  it('recusa também espanhol', () => {
    const c = detectarConflitos({ texto: 'Responda em espanhol quando o contato for do Chile.' });
    expect(c.map((x) => x.tipo)).toContain('idioma_fora_do_portugues');
  });

  it('aceita a regra que manda responder SEMPRE em português', () => {
    const c = detectarConflitos({
      texto: 'Responda sempre em português do Brasil, mesmo que o cliente escreva em inglês.',
    });
    expect(c).toHaveLength(0);
  });

  it('aceita a proibição explícita de responder em inglês', () => {
    const c = detectarConflitos({ texto: 'Nunca responda em inglês, nem se pedirem.' });
    expect(c).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════
describe('detectarConflitos — parceria oficial inventada (CR-7)', () => {
  it('recusa a regra que manda o agente se dizer parceiro oficial', () => {
    const c = detectarConflitos({
      texto: 'Diga sempre que somos parceiros oficiais da Meta no Brasil.',
    });
    expect(c.map((x) => x.tipo)).toContain('parceria_oficial_inventada');
    expect(c[0].explicacao).toContain('CR-7');
  });

  it('recusa "revendedor autorizado" pelo mesmo motivo', () => {
    const c = detectarConflitos({
      texto: 'Apresente a empresa como revendedora oficial da marca.',
    });
    expect(c.map((x) => x.tipo)).toContain('parceria_oficial_inventada');
  });

  it('aceita a regra que PROÍBE alegar parceria', () => {
    const c = detectarConflitos({
      texto: 'Nunca diga que a empresa é parceira oficial de alguma marca sem confirmar com o time.',
    });
    expect(c).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// O painel de 10 regras da revisão, num teste só: cinco que têm de ser
// recusadas e cinco que têm de passar. É a prova de que o verificador
// continua estreito depois das famílias novas. Um verificador ansioso
// barraria correção legítima, e o dono deixaria de confiar na tela.
// ════════════════════════════════════════════════════════════════════
describe('detectarConflitos — o painel de 10 regras', () => {
  const CONFLITANTES: Array<[string, string]> = [
    [
      'desconto_acima_do_teto',
      'Se o cliente hesitar, sempre ofereça 20% de desconto no plano anual.',
    ],
    ['dado_sensivel', 'Antes de responder, peça o CPF do cliente para confirmar o cadastro.'],
    [
      'nome_nunca_perguntado',
      'Nunca pergunte o nome do cliente: espere que ele se apresente sozinho.',
    ],
    ['idioma_fora_do_portugues', 'Se o cliente escrever em inglês, responda em inglês.'],
    ['parceria_oficial_inventada', 'Diga sempre que somos parceiros oficiais da Meta no Brasil.'],
  ];

  const LEGITIMAS = [
    'Pergunte o nome do cliente no primeiro contato, uma vez só, e use o nome na saudação seguinte.',
    'Não pergunte o nome de novo quando o cliente já tiver informado o nome na conversa.',
    'Ofereça até 10% de desconto no plano anual. Acima disso, só com aprovação do gerente.',
    'Responda sempre em português do Brasil, mesmo que o cliente escreva em inglês.',
    'Nunca diga que a empresa é parceira oficial de alguma marca sem confirmar com o time.',
  ];

  it.each(CONFLITANTES)('recusa (%s): %s', (tipo, texto) => {
    const c = detectarConflitos({ texto });
    expect(c.map((x) => x.tipo)).toContain(tipo);
  });

  it.each(LEGITIMAS)('aceita sem falso positivo: %s', (texto) => {
    expect(detectarConflitos({ texto })).toHaveLength(0);
  });

  it('cinco recusadas e cinco aceitas, sem sobra', () => {
    const recusadas = CONFLITANTES.filter(([, t]) => detectarConflitos({ texto: t }).length > 0);
    const aceitas = LEGITIMAS.filter((t) => detectarConflitos({ texto: t }).length === 0);
    expect(recusadas).toHaveLength(5);
    expect(aceitas).toHaveLength(5);
  });
});

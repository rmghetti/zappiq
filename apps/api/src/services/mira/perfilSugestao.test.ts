/**
 * Auto-preenchimento do Perfil de Prospecção — isolamento e procedência.
 *
 * Este serviço lê o material do cliente e joga num LLM, que é a mesma receita
 * do incidente de 14/07 (a Iza vazando para o agente do cliente). Os testes
 * abaixo travam as quatro regras que impedem a repetição:
 *
 *  1. o material de uma org nunca chega no prompt de outra;
 *  2. org sem material devolve vazio, sem chutar e sem chamar o LLM;
 *  3. IA fora do ar não derruba a tela nem inventa;
 *  4. sugestão sem âncora no material de origem é descartada.
 *
 * O último teste é o mais importante do arquivo: prova que "ZappIQ" no catálogo
 * da MACHIA é dado legítimo, não vazamento. Um filtro de marca (o
 * assertNoForeignBrand, que existe para o prompt do agente) reprovaria a org do
 * próprio fundador aqui. Procedência se resolve com ancoragem, não com blocklist.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ORG_A = 'org-antonella';
const ORG_B = 'org-machia';
const ORG_VAZIA = 'org-felix-moveis';

const findUniqueOrg = vi.fn();
const findManyQA = vi.fn();
vi.mock('@zappiq/database', () => ({
  prisma: {
    organization: { findUnique: (...a: any[]) => findUniqueOrg(...a) },
    qAPair: { findMany: (...a: any[]) => findManyQA(...a) },
  },
}));

const complete = vi.fn();
vi.mock('../llm/LLMRouter.js', () => ({
  llmRouter: { complete: (...a: any[]) => complete(...a) },
}));

// extractJson é utilitário puro, mas mora no flowGenerator, que puxa prisma e
// LLM. Mockamos o módulo e reproduzimos só o parse que interessa aqui.
vi.mock('../../agents/flowGenerator.js', () => ({
  extractJson: (t: string) => {
    try {
      const i = t.indexOf('{');
      const f = t.lastIndexOf('}');
      return i === -1 || f <= i ? null : JSON.parse(t.slice(i, f + 1));
    } catch {
      return null;
    }
  },
}));

const { sugerirPerfil, ancorado } = await import('./perfilSugestao.js');

/** Settings da Antonella (restaurante). */
const settingsA = {
  segmento: 'restaurante',
  subsegmentos: ['italiana'],
  surveyAnswers: {
    identidade_empresa: {
      com_lista_servicos: '- Rodizio de massas (R$ 89)\n- Pizzas no forno a lenha (R$ 45-78)',
      pos_diferenciais: 'Forno a lenha importado; receitas da nonna',
      // Bloco que NÃO fala do negócio: não pode ir para o prompt.
      tom_estilo: 'Simpatico e informal',
      reg_proibicoes: 'Nunca falar de politica',
    },
  },
};

/** Settings da MACHIA (que vende ZappIQ — o caso que quebraria um filtro de marca). */
const settingsB = {
  segmento: 'servicos_b2b',
  subsegmentos: [],
  surveyAnswers: {
    identidade_empresa: {
      com_lista_servicos: 'Implantacao da plataforma ZappIQ; Diagnostico de Regime',
    },
  },
};

/** Org que existe mas nunca respondeu ao Treinar IA (o caso mais comum hoje). */
const settingsVazia = { segmento: 'ecommerce', subsegmentos: [] };

function respostaLLM(obj: unknown) {
  return { text: JSON.stringify(obj), provider: 'anthropic', model: 'x', latencyMs: 1, attempt: 1 };
}

/**
 * Banco de verdade em miniatura: responde POR ID. Sem isso o mock devolveria a
 * mesma org sempre, e o teste de vazamento passaria mesmo que o código lesse a
 * org errada — que é exatamente o bug que ele existe para pegar.
 */
const BANCO: Record<string, any> = { [ORG_A]: settingsA, [ORG_B]: settingsB, [ORG_VAZIA]: settingsVazia };

beforeEach(() => {
  vi.clearAllMocks();
  findManyQA.mockResolvedValue([]);
  findUniqueOrg.mockImplementation(async ({ where }: any) => {
    const settings = BANCO[where?.id];
    return settings ? { settings } : null;
  });
});

describe('isolamento entre tenants', () => {
  it('só lê a org pedida, por id, e nunca varre outras', async () => {
    complete.mockResolvedValue(respostaLLM({ catalogo: [] }));

    await sugerirPerfil(ORG_A);

    expect(findUniqueOrg).toHaveBeenCalledTimes(1);
    expect(findUniqueOrg).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ORG_A } }));
    // Q&A também escopado, nunca global.
    expect(findManyQA).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: ORG_A, isActive: true } }));
  });

  it('o material de uma org não vaza no prompt de outra', async () => {
    complete.mockResolvedValue(respostaLLM({ catalogo: [] }));
    await sugerirPerfil(ORG_A);

    const promptA = JSON.stringify(complete.mock.calls[0][0]);
    expect(promptA).toContain('Rodizio de massas');
    // Nada da MACHIA pode aparecer na chamada da Antonella.
    expect(promptA).not.toContain('ZappIQ');
    expect(promptA).not.toContain('Diagnostico de Regime');

    complete.mockClear();
    await sugerirPerfil(ORG_B);

    const promptB = JSON.stringify(complete.mock.calls[0][0]);
    expect(promptB).toContain('Diagnostico de Regime');
    expect(promptB).not.toContain('Rodizio de massas');
  });

  it('manda o orgId no LLM: custo e auditoria ficam por org', async () => {
    complete.mockResolvedValue(respostaLLM({ catalogo: [] }));
    await sugerirPerfil(ORG_A);

    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ orgId: ORG_A, operation: 'extract' }));
  });

  it('só os blocos do negócio vão para o prompt', async () => {
    complete.mockResolvedValue(respostaLLM({ catalogo: [] }));
    await sugerirPerfil(ORG_A);

    const prompt = JSON.stringify(complete.mock.calls[0][0]);
    expect(prompt).toContain('com_lista_servicos');
    expect(prompt).toContain('pos_diferenciais');
    // Tom de voz e regras da IA não dizem nada sobre o que a empresa vende.
    expect(prompt).not.toContain('Simpatico e informal');
    expect(prompt).not.toContain('Nunca falar de politica');
  });
});

describe('org sem material', () => {
  it('devolve vazio e não chama o LLM: não existe chutar catálogo pelo segmento', async () => {
    const s = await sugerirPerfil(ORG_VAZIA);

    expect(complete).not.toHaveBeenCalled();
    expect(s.catalogo).toEqual([]);
    expect(s.diferenciais).toEqual([]);
    // O que veio do cadastro continua vindo: é exato e não depende de IA.
    expect(s.segmento).toBe('ecommerce');
    expect(s.origem).toEqual({ segmento: 'cadastro' });
  });

  it('org inexistente devolve vazio em vez de estourar', async () => {
    const s = await sugerirPerfil('org-que-nao-existe');
    expect(s.totalCampos).toBe(0);
    expect(s.segmento).toBeNull();
  });
});

describe('fail-soft', () => {
  it('IA fora do ar não derruba a tela: a camada exata continua chegando', async () => {
    complete.mockRejectedValue(new Error('502 do provider'));

    const s = await sugerirPerfil(ORG_A);

    expect(s.segmento).toBe('restaurante');
    expect(s.subsegmentos).toEqual(['italiana']);
    expect(s.catalogo).toEqual([]);
  });

  it('IA devolvendo lixo não vira sugestão', async () => {
    complete.mockResolvedValue({ text: 'desculpe, não consegui', provider: 'x', model: 'y', latencyMs: 1, attempt: 1 });

    const s = await sugerirPerfil(ORG_A);
    expect(s.catalogo).toEqual([]);
    expect(s.segmento).toBe('restaurante');
  });
});

describe('ancoragem', () => {
  it('derruba produto que não está no material (alucinação)', async () => {
    complete.mockResolvedValue(
      respostaLLM({
        catalogo: [
          { nome: 'Rodizio de massas', descricao: 'R$ 89' }, // está no material
          { nome: 'Buffet de sushi premium', descricao: 'inventado' }, // não está
        ],
      })
    );

    const s = await sugerirPerfil(ORG_A);

    expect(s.catalogo.map((c) => c.nome)).toEqual(['Rodizio de massas']);
  });

  it('marca de terceiro citada pelo próprio cliente é dado, não vazamento', async () => {
    // A MACHIA vende ZappIQ. Um filtro de marca reprovaria isto; a ancoragem
    // aprova, porque "ZappIQ" está no material que a própria org declarou.
    complete.mockResolvedValue(
      respostaLLM({ catalogo: [{ nome: 'Implantacao da plataforma ZappIQ', descricao: 'Sobe a operacao' }] })
    );

    const s = await sugerirPerfil(ORG_B);

    expect(s.catalogo).toHaveLength(1);
    expect(s.catalogo[0].nome).toContain('ZappIQ');
  });

  it('aceita paráfrase, recusa invenção', () => {
    const material = 'com_lista_servicos: Diagnostico de Regime, sprint de 3 a 4 semanas com roadmap de 90 dias';
    expect(ancorado('Diagnostico de Regime', material)).toBe(true);
    expect(ancorado('Roadmap de 90 dias', material)).toBe(true);
    expect(ancorado('Consultoria tributaria internacional', material)).toBe(false);
  });

  it('ignora acento e caixa ao ancorar', () => {
    expect(ancorado('DIAGNÓSTICO', 'com_x: diagnostico de regime')).toBe(true);
  });
});

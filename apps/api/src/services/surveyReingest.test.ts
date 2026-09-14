/* ══════════════════════════════════════════════════════════════════════
 * Reingestão do questionário: uma execução por rajada, lendo do banco.
 * --------------------------------------------------------------------
 * O que estava em produção (A007, A118): o autosave da tela dispara 1,5 s
 * depois da última tecla e o PUT reconstruía e reembedava o questionário
 * inteiro ali mesmo, sem trava. Foram 407 gravações medidas, 10 no mesmo
 * minuto, a menor distância entre duas de 0,41 s. Duas gravações ao mesmo
 * tempo podiam deixar no vetor a versão mais ANTIGA: vence quem terminar
 * por último, não quem digitou por último.
 *
 * A cura tem duas partes, e as duas estão nos testes abaixo:
 *   1. Adiar e juntar: um job por organização, sempre com o mesmo id, que
 *      é reagendado a cada salvamento. Dez salvamentos em rajada deixam UM
 *      job pendente e produzem UMA execução.
 *   2. Ler do BANCO na hora de executar, nunca do corpo da requisição que
 *      agendou. Assim a execução usa a última versão salva, e não a versão
 *      que por acaso agendou o job.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  agendarReingestaoDoQuestionario,
  executarReingestaoDoQuestionario,
  jobIdDaReingestao,
  NOME_DO_JOB_DE_REINGESTAO,
  ATRASO_DA_REINGESTAO_MS,
} from './surveyReingest.js';

// ── Fila falsa com a semântica do BullMQ que importa aqui ────────────────
// add com um jobId que já existe é NO-OP no BullMQ (o job antigo continua
// valendo). É exatamente por isso que "reagendar" precisa remover antes.
class FilaFalsa {
  jobs = new Map<string, { nome: string; dados: any; delay: number; estado: string }>();
  adds = 0;
  removes = 0;
  /** Ids cujo remove() estoura: o job virou 'active' depois do getState(). */
  removeEstoura = new Set<string>();

  async getJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    const jobs = this.jobs;
    const self = this;
    return {
      id: jobId,
      async getState() {
        return job.estado;
      },
      async remove() {
        if (job.estado === 'active' || self.removeEstoura.has(jobId)) {
          throw new Error('Job is active and cannot be removed');
        }
        jobs.delete(jobId);
        self.removes += 1;
      },
    };
  }

  async add(nome: string, dados: any, opcoes: { jobId: string; delay: number }) {
    this.adds += 1;
    if (this.jobs.has(opcoes.jobId)) return { id: opcoes.jobId };
    this.jobs.set(opcoes.jobId, { nome, dados, delay: opcoes.delay, estado: 'delayed' });
    return { id: opcoes.jobId };
  }
}

const ORG = 'org-1';

describe('agendamento com espera e substituição', () => {
  it('dez salvamentos em rajada deixam UM job pendente', async () => {
    const fila = new FilaFalsa();
    for (let i = 0; i < 10; i++) {
      await agendarReingestaoDoQuestionario(ORG, { fila: fila as any });
    }
    expect(fila.jobs.size).toBe(1);
    expect([...fila.jobs.keys()]).toEqual([jobIdDaReingestao(ORG)]);
    // Nove reagendamentos: cada um tirou o job pendente antes de repor.
    expect(fila.removes).toBe(9);
    const job = fila.jobs.get(jobIdDaReingestao(ORG))!;
    expect(job.nome).toBe(NOME_DO_JOB_DE_REINGESTAO);
    expect(job.delay).toBe(ATRASO_DA_REINGESTAO_MS);
    // O job carrega só a organização: o conteúdo vem do banco na execução.
    expect(job.dados).toEqual({ organizationId: ORG });
  });

  it('cada salvamento reinicia a contagem dos 30 segundos', async () => {
    const fila = new FilaFalsa();
    const primeiro = await agendarReingestaoDoQuestionario(ORG, { fila: fila as any });
    expect(primeiro.acao).toBe('criado');
    const segundo = await agendarReingestaoDoQuestionario(ORG, { fila: fila as any });
    expect(segundo.acao).toBe('reagendado');
    expect(segundo.jobId).toBe(primeiro.jobId);
  });

  it('organizações diferentes não disputam o mesmo job', async () => {
    const fila = new FilaFalsa();
    await agendarReingestaoDoQuestionario('org-a', { fila: fila as any });
    await agendarReingestaoDoQuestionario('org-b', { fila: fila as any });
    expect(fila.jobs.size).toBe(2);
  });

  it('com o job já rodando, agenda um seguinte em vez de perder o salvamento', async () => {
    const fila = new FilaFalsa();
    await agendarReingestaoDoQuestionario(ORG, { fila: fila as any });
    fila.jobs.get(jobIdDaReingestao(ORG))!.estado = 'active';

    const resultado = await agendarReingestaoDoQuestionario(ORG, { fila: fila as any });
    expect(resultado.acao).toBe('criado');
    expect(resultado.jobId).toBe(`${jobIdDaReingestao(ORG)}:proximo`);
    expect(fila.jobs.size).toBe(2);
  });

  it('job que falhou é substituído por um novo', async () => {
    const fila = new FilaFalsa();
    await agendarReingestaoDoQuestionario(ORG, { fila: fila as any });
    fila.jobs.get(jobIdDaReingestao(ORG))!.estado = 'failed';
    const resultado = await agendarReingestaoDoQuestionario(ORG, { fila: fila as any });
    expect(resultado.acao).toBe('recriado');
    expect(fila.jobs.size).toBe(1);
  });
});

// ── Execução ─────────────────────────────────────────────────────────────

const RESPOSTAS = {
  identidade_empresa: { ide_endereco_principal: 'Rua das Flores, 10, Centro, Campinas' },
  precos_condicoes: { pre_tabela_precos: 'Pão francês R$ 18 o quilo' },
};

function bancoFalso(settings: Record<string, any>, legadoNoVetor: string[] = []) {
  const gravados: any[] = [];
  const consultas: Array<{ sql: string; valores: any[] }> = [];
  return {
    gravados,
    consultas,
    db: {
      organization: {
        findUnique: vi.fn(async () => ({ id: ORG, name: 'Padaria', settings })),
      },
      $executeRaw: vi.fn(async (_texto: TemplateStringsArray, ...valores: any[]) => {
        gravados.push(valores);
        return 1;
      }),
      $queryRaw: vi.fn(async (texto: TemplateStringsArray, ...valores: any[]) => {
        consultas.push({ sql: texto.join('?'), valores });
        return legadoNoVetor.map((source) => ({ source }));
      }),
    },
  };
}

describe('execução da reingestão', () => {
  let ingerir: any;
  let apagar: any;
  let subirVersao: any;

  beforeEach(() => {
    ingerir = vi.fn(async () => ({ ok: true }));
    apagar = vi.fn(async () => ({ ok: true }));
    subirVersao = vi.fn(async () => 2);
  });

  it('lê as respostas do BANCO e ingere um documento por seção', async () => {
    const { db } = bancoFalso({ niche: 'padaria', businessName: 'Padaria do Bairro', surveyAnswers: RESPOSTAS });

    const resultado = await executarReingestaoDoQuestionario(ORG, {
      db: db as any,
      ingerir,
      apagar,
      subirVersao,
    });

    expect(db.organization.findUnique).toHaveBeenCalled();
    expect(resultado.status).toBe('ok');
    expect(resultado.sources.sort()).toEqual(['survey-identidade_empresa', 'survey-precos_condicoes']);
    expect(ingerir).toHaveBeenCalledTimes(2);

    const [org, arquivo] = ingerir.mock.calls[0];
    expect(org).toBe(ORG);
    expect(arquivo.source).toMatch(/^survey-/);
    expect(arquivo.content.toString()).toContain(
      'Pergunta: Endereço completo da unidade principal',
    );
    expect(arquivo.metadata.titulo).toContain('Questionário');
  });

  it('apaga o documento antigo do formato de arquivo único', async () => {
    const { db } = bancoFalso({
      niche: 'padaria',
      surveyAnswers: RESPOSTAS,
      surveyDocFilename: 'onboarding-survey-padaria.txt',
    });

    await executarReingestaoDoQuestionario(ORG, { db: db as any, ingerir, apagar, subirVersao });

    expect(apagar).toHaveBeenCalledWith(ORG, 'onboarding-survey-padaria.txt');
  });

  it('apaga a seção que ficou sem resposta nenhuma', async () => {
    const { db } = bancoFalso({
      niche: 'padaria',
      surveyAnswers: { identidade_empresa: { ide_endereco_principal: 'Rua das Flores, 10' } },
      surveySync: { status: 'ok', at: '2026-09-13T10:00:00.000Z', sources: ['survey-identidade_empresa', 'survey-faq_conhecimento'] },
    });

    await executarReingestaoDoQuestionario(ORG, { db: db as any, ingerir, apagar, subirVersao });

    expect(apagar).toHaveBeenCalledWith(ORG, 'survey-faq_conhecimento');
    expect(apagar).not.toHaveBeenCalledWith(ORG, 'survey-identidade_empresa');
  });

  it('sobe a versão da configuração no fim, para o cache da busca errar de propósito', async () => {
    const { db } = bancoFalso({ niche: 'padaria', surveyAnswers: RESPOSTAS });
    await executarReingestaoDoQuestionario(ORG, { db: db as any, ingerir, apagar, subirVersao });
    expect(subirVersao).toHaveBeenCalledWith(ORG);
  });

  it('grava o estado da sincronização por chave, sem trocar o JSON inteiro', async () => {
    const { db, gravados } = bancoFalso({ niche: 'padaria', surveyAnswers: RESPOSTAS });
    await executarReingestaoDoQuestionario(ORG, {
      db: db as any,
      ingerir,
      apagar,
      subirVersao,
      agora: () => new Date('2026-09-14T12:00:00.000Z'),
    });

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    const [estadoJson, orgId] = gravados[0];
    expect(orgId).toBe(ORG);
    const estado = JSON.parse(estadoJson);
    expect(estado.status).toBe('ok');
    expect(estado.at).toBe('2026-09-14T12:00:00.000Z');
    expect(estado.secoes).toBe(2);
  });

  it('falha na ingestão vira estado falhou com motivo, e o erro sobe para a fila tentar de novo', async () => {
    const { db, gravados } = bancoFalso({ niche: 'padaria', surveyAnswers: RESPOSTAS });
    ingerir = vi.fn(async () => {
      throw new Error('RAG fora do ar');
    });

    await expect(
      executarReingestaoDoQuestionario(ORG, { db: db as any, ingerir, apagar, subirVersao }),
    ).rejects.toThrow('RAG fora do ar');

    const estado = JSON.parse(gravados[0][0]);
    expect(estado.status).toBe('falhou');
    expect(estado.motivo).toContain('RAG fora do ar');
  });

  it('organização sem questionário respondido não ingere nada e fica ok', async () => {
    const { db, gravados } = bancoFalso({ niche: 'padaria', surveyAnswers: {} });
    const resultado = await executarReingestaoDoQuestionario(ORG, {
      db: db as any,
      ingerir,
      apagar,
      subirVersao,
    });
    expect(ingerir).not.toHaveBeenCalled();
    expect(resultado.status).toBe('ok');
    expect(JSON.parse(gravados[0][0]).status).toBe('ok');
  });

  it('organização que sumiu no meio do caminho não derruba a fila', async () => {
    const db = {
      organization: { findUnique: vi.fn(async () => null) },
      $executeRaw: vi.fn(async () => 1),
    };
    const resultado = await executarReingestaoDoQuestionario(ORG, {
      db: db as any,
      ingerir,
      apagar,
      subirVersao,
    });
    expect(resultado.status).toBe('ok');
    expect(resultado.sources).toEqual([]);
    expect(ingerir).not.toHaveBeenCalled();
  });
});

describe('reagendamento não pode se perder quando o job muda de estado', () => {
  it('remove que estoura na corrida cai no :proximo em vez de derrubar o salvamento', async () => {
    const fila = new FilaFalsa();
    await agendarReingestaoDoQuestionario(ORG, { fila: fila as any });
    // O getState() ainda diz 'delayed', mas entre ele e o remove() o BullMQ
    // já pegou o job para executar. Isto é corrida, não estado impossível.
    fila.removeEstoura.add(jobIdDaReingestao(ORG));

    const resultado = await agendarReingestaoDoQuestionario(ORG, { fila: fila as any });

    expect(resultado.acao).toBe('criado');
    expect(resultado.jobId).toBe(`${jobIdDaReingestao(ORG)}:proximo`);
    expect(fila.jobs.size).toBe(2);
  });

  it('com os dois ids travados, devolve em_execucao sem estourar', async () => {
    const fila = new FilaFalsa();
    await agendarReingestaoDoQuestionario(ORG, { fila: fila as any });
    await agendarReingestaoDoQuestionario(ORG, { fila: fila as any });
    fila.jobs.get(jobIdDaReingestao(ORG))!.estado = 'active';
    fila.removeEstoura.add(jobIdDaReingestao(ORG));

    // Força o segundo id a existir e também recusar a remoção.
    fila.jobs.set(`${jobIdDaReingestao(ORG)}:proximo`, {
      nome: NOME_DO_JOB_DE_REINGESTAO,
      dados: { organizationId: ORG },
      delay: ATRASO_DA_REINGESTAO_MS,
      estado: 'delayed',
    });
    fila.removeEstoura.add(`${jobIdDaReingestao(ORG)}:proximo`);

    const resultado = await agendarReingestaoDoQuestionario(ORG, { fila: fila as any });
    expect(resultado.acao).toBe('em_execucao');
  });
});

describe('limpeza do formato antigo acontece uma vez só', () => {
  it('organização já migrada não fica tentando apagar o arquivo único a cada salvamento', async () => {
    const apagar = vi.fn(async () => ({ ok: true }));
    const { db } = bancoFalso({
      niche: 'padaria',
      surveyAnswers: RESPOSTAS,
      surveyDocFilename: 'onboarding-survey-padaria.txt',
      surveySync: {
        status: 'ok',
        at: '2026-09-13T10:00:00.000Z',
        sources: ['survey-identidade_empresa', 'survey-precos_condicoes'],
      },
    });

    await executarReingestaoDoQuestionario(ORG, {
      db: db as any,
      ingerir: vi.fn(async () => ({ ok: true })),
      apagar,
      subirVersao: vi.fn(async () => 2),
    });

    expect(apagar).not.toHaveBeenCalled();
  });

  it('organização que TROCOU de segmento perde o arquivo único do segmento antigo', async () => {
    // Estava em padaria, hoje está em restaurante. O nome derivado do
    // segmento de hoje nunca alcançaria o arquivo gravado no de ontem, e
    // settings.surveyDocFilename nem sempre existe. A lista vem do vetor.
    const { db, consultas } = bancoFalso({ niche: 'restaurante', surveyAnswers: RESPOSTAS }, [
      'onboarding-survey-padaria.txt',
    ]);
    const apagar = vi.fn(async () => ({ ok: true }));

    await executarReingestaoDoQuestionario(ORG, {
      db: db as any,
      ingerir: vi.fn(async () => ({ ok: true })),
      apagar,
      subirVersao: vi.fn(async () => 2),
    });

    expect(apagar).toHaveBeenCalledWith(ORG, 'onboarding-survey-padaria.txt');
    // E a consulta é por PREFIXO, dentro do namespace da organização.
    expect(consultas).toHaveLength(1);
    expect(consultas[0].sql).toContain('rag_chunks');
    expect(consultas[0].sql).toContain('LIKE');
    expect(consultas[0].valores).toContain('onboarding-survey%');
  });

  it('organização já migrada não consulta o vetor atrás de legado', async () => {
    const { db, consultas } = bancoFalso(
      {
        niche: 'padaria',
        surveyAnswers: RESPOSTAS,
        surveySync: {
          status: 'ok',
          at: '2026-09-13T10:00:00.000Z',
          sources: ['survey-identidade_empresa', 'survey-precos_condicoes'],
        },
      },
      ['onboarding-survey-padaria.txt'],
    );

    await executarReingestaoDoQuestionario(ORG, {
      db: db as any,
      ingerir: vi.fn(async () => ({ ok: true })),
      apagar: vi.fn(async () => ({ ok: true })),
      subirVersao: vi.fn(async () => 2),
    });

    expect(consultas).toHaveLength(0);
  });

  it('consulta do legado que falha não derruba a reingestão', async () => {
    const { db } = bancoFalso({ niche: 'padaria', surveyAnswers: RESPOSTAS });
    db.$queryRaw = vi.fn(async () => {
      throw new Error('relation "rag_chunks" does not exist');
    }) as any;
    const apagar = vi.fn(async () => ({ ok: true }));

    const resultado = await executarReingestaoDoQuestionario(ORG, {
      db: db as any,
      ingerir: vi.fn(async () => ({ ok: true })),
      apagar,
      subirVersao: vi.fn(async () => 2),
    });

    expect(resultado.status).toBe('ok');
    // O nome derivado do segmento de hoje continua sendo tentado.
    expect(apagar).toHaveBeenCalledWith(ORG, 'onboarding-survey-padaria.txt');
  });
});

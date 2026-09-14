/* ══════════════════════════════════════════════════════════════════════
 * surveyReingest: o questionário chega à IA uma vez por rajada.
 * --------------------------------------------------------------------
 * Antes, cada PUT do autosave (1,5 s depois da última tecla) reconstruía e
 * reembedava o questionário inteiro dentro da própria requisição, sem
 * trava nenhuma. Medido em produção: 407 gravações, dez num único minuto,
 * 0,41 s entre duas delas (A007, A118). Fora o desperdício, havia uma
 * corrida de verdade: com duas ingestões no ar, o vetor fica com a que
 * terminar por último, que não é necessariamente a última digitada.
 *
 * Aqui o salvamento só AGENDA. O job tem id fixo por organização, espera
 * 30 segundos e é reagendado a cada novo salvamento (o BullMQ ignora um
 * `add` com id repetido, então reagendar é remover e repor). Quando roda,
 * ele lê as respostas do BANCO, não do corpo da requisição que o agendou:
 * é isso que garante que a versão ingerida é a última salva.
 *
 * O estado da sincronização fica em settings.surveySync, gravado por
 * `jsonb_set` (merge por chave). Isto não é preciosismo: o job roda 30
 * segundos depois, e nesse meio tempo o cliente pode ter salvo de novo.
 * Ler o JSON inteiro, mexer e regravar apagaria a resposta mais nova
 * (A156, o mesmo defeito do PUT /api/settings).
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';

import { logger } from '../utils/logger.js';
import {
  buildSurveyKnowledgeBlocks,
  surveyDocFilename,
  PREFIXO_SOURCE_DO_QUESTIONARIO,
} from './knowledgeBaseBuilder.js';
import * as ragService from './ragService.js';

/** Nome do job dentro da fila. O worker despacha por ele. */
export const NOME_DO_JOB_DE_REINGESTAO = 'survey-reingest';

/**
 * Espera antes de reingerir. Trinta segundos cobre a digitação de um bloco
 * inteiro do questionário sem deixar o cliente esperando pela IA.
 */
export const ATRASO_DA_REINGESTAO_MS = 30_000;

/** Id estável do job de uma organização. */
export function jobIdDaReingestao(organizationId: string): string {
  return `${NOME_DO_JOB_DE_REINGESTAO}:${organizationId}`;
}

// ── Agendamento ──────────────────────────────────────────────────────────

/** Só o que este serviço usa da fila. Injetável para teste sem Redis. */
export interface FilaDeReingestao {
  getJob(jobId: string): Promise<JobDeReingestao | null | undefined>;
  add(
    nome: string,
    dados: { organizationId: string },
    opcoes: Record<string, unknown> & { jobId: string; delay: number },
  ): Promise<unknown>;
}

export interface JobDeReingestao {
  getState(): Promise<string>;
  remove(): Promise<unknown>;
}

export type AcaoDoAgendamento = 'criado' | 'reagendado' | 'recriado' | 'em_execucao';

export interface ResultadoDoAgendamento {
  jobId: string;
  acao: AcaoDoAgendamento;
}

/**
 * Agenda (ou reagenda) a reingestão do questionário de uma organização.
 *
 * O id do job é o mesmo sempre, então a rajada de salvamentos colapsa em
 * uma execução. Se o job já estiver RODANDO, ele não pode ser removido:
 * nesse caso entra um segundo job, o `:proximo`, para que o salvamento que
 * chegou durante a execução não se perca. Mais que isso não é preciso: o
 * job lê o banco, então o `:proximo` já leva tudo que foi salvo depois.
 */
export async function agendarReingestaoDoQuestionario(
  organizationId: string,
  opcoes: { fila?: FilaDeReingestao; atrasoMs?: number } = {},
): Promise<ResultadoDoAgendamento> {
  const fila = opcoes.fila ?? (await filaPadrao());
  const delay = opcoes.atrasoMs ?? ATRASO_DA_REINGESTAO_MS;
  const base = jobIdDaReingestao(organizationId);

  for (const jobId of [base, `${base}:proximo`]) {
    const existente = await fila.getJob(jobId);

    if (!existente) {
      await adicionar(fila, jobId, organizationId, delay);
      return { jobId, acao: 'criado' };
    }

    const estado = await existente.getState().catch(() => 'desconhecido');

    if (estado === 'delayed' || estado === 'waiting' || estado === 'paused') {
      // O remove() pode estourar mesmo com o estado acima: entre o getState()
      // e ele, o BullMQ pode ter pegado o job para executar. Sem o try, essa
      // corrida virava exceção na rota e o salvamento ficava sem reingestão.
      if (await removeu(existente, jobId, organizationId)) {
        await adicionar(fila, jobId, organizationId, delay);
        return { jobId, acao: 'reagendado' };
      }
      continue;
    }

    if (estado === 'completed' || estado === 'failed') {
      // O id fica ocupado pelo job terminado. Sem remover, o `add` seria
      // silenciosamente ignorado e a resposta nova nunca chegaria à IA.
      if (await removeu(existente, jobId, organizationId)) {
        await adicionar(fila, jobId, organizationId, delay);
        return { jobId, acao: 'recriado' };
      }
      continue;
    }

    // 'active': não dá para remover. Tenta o próximo id do laço.
  }

  logger.warn({ msg: 'survey_reingest_ja_em_execucao', organizationId });
  return { jobId: base, acao: 'em_execucao' };
}

/** Tenta remover o job. False (sem estourar) quando a fila recusou. */
async function removeu(
  job: JobDeReingestao,
  jobId: string,
  organizationId: string,
): Promise<boolean> {
  try {
    await job.remove();
    return true;
  } catch (err: any) {
    logger.warn({
      msg: 'survey_reingest_remocao_do_job_recusada',
      organizationId,
      jobId,
      error: String(err?.message ?? err),
    });
    return false;
  }
}

async function adicionar(
  fila: FilaDeReingestao,
  jobId: string,
  organizationId: string,
  delay: number,
): Promise<void> {
  await fila.add(
    NOME_DO_JOB_DE_REINGESTAO,
    { organizationId },
    {
      jobId,
      delay,
      // Uma tentativa a mais cobre o RAG que estava subindo a máquina.
      attempts: 2,
      backoff: { type: 'fixed', delay: 15_000 },
      // O id precisa ficar livre depois: job terminado com id ocupado
      // bloquearia o próximo agendamento da mesma organização.
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );
}

/** A fila de verdade só é importada quando não veio uma injetada (teste). */
async function filaPadrao(): Promise<FilaDeReingestao> {
  const { cronQueue } = await import('./cronQueue.js');
  return cronQueue as unknown as FilaDeReingestao;
}

// ── Execução ─────────────────────────────────────────────────────────────

export type EstadoDaSincronizacao = 'pendente' | 'ok' | 'falhou';

export interface SurveySync {
  status: EstadoDaSincronizacao;
  /** Quando esta situação foi registrada (ISO). */
  at: string;
  /** Preenchido só quando falhou: a frase que a tela mostra. */
  motivo?: string;
  /** Quantas seções do questionário foram para a base. */
  secoes?: number;
  /** Sources gravados, para a próxima execução saber o que apagar. */
  sources?: string[];
}

export interface DepsDaReingestao {
  db?: {
    organization: { findUnique: (args: any) => Promise<any> };
    $executeRaw: (query: TemplateStringsArray, ...valores: any[]) => Promise<unknown>;
    $queryRaw?: (query: TemplateStringsArray, ...valores: any[]) => Promise<unknown>;
  };
  ingerir?: typeof ragService.ingestDocument;
  apagar?: typeof ragService.deleteDocument;
  subirVersao?: typeof ragService.bumpConfigVersion;
  agora?: () => Date;
  /** Sources do formato antigo que ainda estão no vetor desta organização. */
  listarLegado?: (organizationId: string) => Promise<string[]>;
}

/** Todo documento do formato antigo começa assim, com o segmento no fim. */
export const PREFIXO_LEGADO_DO_QUESTIONARIO = 'onboarding-survey';

/**
 * Os documentos do formato antigo que esta organização ainda tem no vetor.
 *
 * O nome do arquivo antigo carrega o SEGMENTO do dia em que foi gravado.
 * Quem trocou de segmento depois tem no vetor o arquivo do segmento ANTIGO,
 * que o nome derivado do segmento de hoje nunca alcança, e settings
 * .surveyDocFilename nem sempre foi registrado. Por isso a lista sai do
 * próprio vetor, por prefixo.
 *
 * A tabela rag_chunks vive no mesmo Postgres do resto do schema (é assim que
 * o AI Readiness e a tela de Documentos já a consultam). Falha aqui não é
 * fatal: sem a lista, segue valendo a limpeza pelo nome derivado.
 */
export async function listarSourcesDoFormatoAntigo(
  organizationId: string,
  db: DepsDaReingestao['db'],
): Promise<string[]> {
  const consultar = db?.$queryRaw;
  if (!consultar) return [];

  const namespace = ragService.namespaceFor(organizationId);
  const prefixo = `${PREFIXO_LEGADO_DO_QUESTIONARIO}%`;
  try {
    const linhas = (await consultar`
      SELECT DISTINCT source
        FROM rag_chunks
       WHERE namespace = ${namespace}
         AND source LIKE ${prefixo}
    `) as Array<{ source?: unknown }>;
    return (Array.isArray(linhas) ? linhas : [])
      .map((l) => l?.source)
      .filter((s): s is string => typeof s === 'string' && s.length > 0);
  } catch (err: any) {
    logger.warn({
      msg: 'survey_reingest_lista_de_legado_falhou',
      organizationId,
      error: String(err?.message ?? err),
    });
    return [];
  }
}

export interface ResultadoDaReingestao {
  status: EstadoDaSincronizacao;
  sources: string[];
  removidos: string[];
  motivo?: string;
}

/**
 * Reingere o questionário de uma organização, do jeito novo: um documento
 * por seção, com o texto das perguntas, substituindo o documento anterior
 * daquela seção pelo mesmo `source`.
 *
 * Lê SEMPRE do banco. Quem chama passa só o id da organização.
 */
export async function executarReingestaoDoQuestionario(
  organizationId: string,
  deps: DepsDaReingestao = {},
): Promise<ResultadoDaReingestao> {
  const db = deps.db ?? (prisma as any);
  const ingerir = deps.ingerir ?? ragService.ingestDocument;
  const apagar = deps.apagar ?? ragService.deleteDocument;
  const subirVersao = deps.subirVersao ?? ragService.bumpConfigVersion;
  const agora = deps.agora ?? (() => new Date());
  const listarLegado =
    deps.listarLegado ?? ((orgId: string) => listarSourcesDoFormatoAntigo(orgId, db));

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true, name: true },
  });

  if (!org) {
    // Organização apagada entre o agendamento e a execução. Nada a fazer, e
    // nada a gravar: o registro iria para uma linha que não existe mais.
    logger.warn({ msg: 'survey_reingest_org_ausente', organizationId });
    return { status: 'ok', sources: [], removidos: [] };
  }

  const settings = (org.settings as Record<string, any>) || {};
  const surveyAnswers = (settings.surveyAnswers as Record<string, any>) || {};
  const niche = settings.niche || settings.segmento || 'geral';
  const businessName = settings.businessName || org.name || 'Empresa';

  const blocos = buildSurveyKnowledgeBlocks({ businessName, niche, surveyAnswers });
  const sources = blocos.map((b) => b.source);

  // O que existia antes e não existe mais precisa sair do vetor, senão a IA
  // continua lendo a seção que o cliente esvaziou.
  const anteriores: string[] = Array.isArray(settings.surveySync?.sources)
    ? settings.surveySync.sources.filter(
        (s: unknown) => typeof s === 'string' && s.startsWith(PREFIXO_SOURCE_DO_QUESTIONARIO),
      )
    : [];
  const aRemover = anteriores.filter((s) => !sources.includes(s));

  // Documento único do formato antigo (um arquivo com tudo, rotulado por
  // chave de código). A PRIMEIRA reingestão no formato novo tira ele do ar.
  // Só a primeira: depois que a organização tem sources registrados, tentar
  // apagar de novo seria uma chamada de rede por salvamento, para sempre.
  const jaMigrada = anteriores.length > 0;
  if (!jaMigrada) {
    const legado =
      typeof settings.surveyDocFilename === 'string' ? settings.surveyDocFilename : undefined;
    if (legado) aRemover.push(legado);

    // O que está MESMO no vetor com o prefixo antigo, inclusive o arquivo de
    // um segmento que a organização já trocou.
    for (const source of await listarLegado(organizationId)) {
      if (!aRemover.includes(source)) aRemover.push(source);
    }

    // Mesmo sem o registro em settings e sem a consulta acima, o nome do
    // arquivo antigo é derivado do segmento. Apagar por nome é idempotente:
    // se não existir, não faz nada.
    const legadoPorSegmento = surveyDocFilename(niche);
    if (!aRemover.includes(legadoPorSegmento)) aRemover.push(legadoPorSegmento);
  }

  const removidos: string[] = [];

  try {
    for (const bloco of blocos) {
      await ingerir(organizationId, {
        filename: `${bloco.source}.txt`,
        source: bloco.source,
        content: Buffer.from(bloco.texto, 'utf8'),
        mimeType: 'text/plain',
        metadata: { titulo: bloco.titulo, secao: bloco.secaoId },
      });
    }

    for (const source of aRemover) {
      // Apagar o que já não existe não é erro: segue em frente.
      await apagar(organizationId, source)
        .then(() => removidos.push(source))
        .catch((err: any) =>
          logger.warn({
            msg: 'survey_reingest_remocao_falhou',
            organizationId,
            source,
            error: String(err?.message ?? err),
          }),
        );
    }

    await gravarEstado(db, organizationId, {
      status: 'ok',
      at: agora().toISOString(),
      secoes: blocos.length,
      sources,
    });

    // Toda escrita de treino sobe a versão da organização: o cache da busca
    // passa a errar de propósito e o conteúdo novo vale na mensagem seguinte.
    await subirVersao(organizationId).catch(() => undefined);

    logger.info({
      msg: 'survey_reingest_ok',
      organizationId,
      secoes: blocos.length,
      removidos: removidos.length,
    });

    return { status: 'ok', sources, removidos };
  } catch (err: any) {
    const motivo = String(err?.message ?? err).slice(0, 300);
    await gravarEstado(db, organizationId, {
      status: 'falhou',
      at: agora().toISOString(),
      motivo,
      // Preserva o que já estava registrado: a tela precisa saber o que a
      // IA tem hoje, que é a versão anterior, não a que acabou de falhar.
      sources: anteriores.length ? anteriores : undefined,
    }).catch(() => undefined);

    logger.error({ msg: 'survey_reingest_falhou', organizationId, error: motivo });
    throw err;
  }
}

/**
 * Grava settings.surveySync sem tocar em mais nada.
 *
 * `jsonb_set` com create=true escreve a chave no banco, dentro da mesma
 * instrução. Não há leitura prévia, então não há janela para apagar o que
 * outra requisição gravou no meio.
 */
async function gravarEstado(
  db: { $executeRaw: (query: TemplateStringsArray, ...valores: any[]) => Promise<unknown> },
  organizationId: string,
  estado: SurveySync,
): Promise<void> {
  const json = JSON.stringify(estado);
  await db.$executeRaw`
    UPDATE organizations
       SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{surveySync}', ${json}::jsonb, true)
     WHERE id = ${organizationId}
  `;
}

/**
 * Marca o questionário como "a IA ainda não recebeu" no momento do
 * salvamento. É o que a tela mostra enquanto o job não roda (A008): antes,
 * a tela dizia "salvo automaticamente" mesmo quando a ingestão falhava.
 */
export async function marcarSincronizacaoPendente(
  organizationId: string,
  deps: {
    db?: DepsDaReingestao['db'];
    agora?: () => Date;
    /**
     * Sources que a IA tem AGORA. Quem acabou de ler as settings passa os
     * dele e poupa uma consulta; quem não passa, a função busca.
     */
    sources?: string[];
  } = {},
): Promise<SurveySync> {
  const db = deps.db ?? (prisma as any);
  const agora = deps.agora ?? (() => new Date());

  let sources = deps.sources;
  if (!sources) {
    const atual = await db!.organization
      .findUnique({ where: { id: organizationId }, select: { settings: true } })
      .catch(() => null);
    const registrados = (atual?.settings as any)?.surveySync?.sources;
    sources = Array.isArray(registrados) ? registrados : undefined;
  }

  const estado: SurveySync = {
    status: 'pendente',
    at: agora().toISOString(),
    sources: sources && sources.length ? sources : undefined,
  };
  await gravarEstado(db!, organizationId, estado);
  return estado;
}

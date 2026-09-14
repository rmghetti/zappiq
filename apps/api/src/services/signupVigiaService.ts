/* ══════════════════════════════════════════════════════════════════════
 * Vigia dos cadastros órfãos (A242, 14/09/2026)
 * --------------------------------------------------------------------
 * O que aconteceu: entre 23/07 e 14/09/2026, cinco pessoas confirmaram o
 * cadastro (linha em `signups` com status active e usuário no Supabase
 * Auth) e NENHUMA virou organização, usuário, agente ou Treinar IA. O
 * produto não tinha nenhum evento entre "confirmou" e "criou a
 * organização", então o silêncio parecia falta de demanda.
 *
 * Esta rotina roda uma vez por dia, na fila `cron` que já existe, e avisa
 * quando há cadastro confirmado há mais de 24 horas sem organização:
 *   - log estruturado (o que o Fly guarda);
 *   - alerta no Slack pelo mecanismo que já existe (sendSlackAlert);
 *   - tarefa no Planner da organização da ZappIQ, que é a notificação
 *     PERSISTENTE: o Slack rola, a tarefa fica até alguém fechar.
 *
 * LGPD: nem a tarefa nem o alerta carregam e-mail ou nome do lead. Eles
 * carregam o id do signup e o tempo de espera; quem precisa do contato usa
 * o script de reparação (apps/api/scripts/repararSignupsOrfaos.ts), que
 * roda com a decisão do fundador.
 *
 * A tabela `signups` vive fora do Prisma (é escrita pelo apps/web via
 * Supabase), por isso a leitura é SQL cru, como no resto do produto.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { ZAPPIQ_ORG_ID } from '../config/zappiqOrg.js';
import { sendSlackAlert, buildHeaderBlock, buildSectionBlock } from './slackNotifier.js';

/** Janela de tolerância: abaixo disso o lead ainda pode estar respondendo. */
export const HORAS_ATE_VIRAR_ORFAO = 24;

/** Prefixo do título da tarefa. É por ele que a rotina evita repetir o aviso. */
export const TITULO_DA_TAREFA = 'Cadastro confirmado sem organização';

/** Uma linha de `signups` como o driver devolve (datas podem vir em texto). */
export interface LinhaDeSignup {
  id: string;
  status: string | null;
  plan_chosen: string | null;
  organization_id: string | null;
  confirmed_at: Date | string | null;
  utm_source: string | null;
}

export interface SignupOrfao {
  id: string;
  plano: string | null;
  origem: string | null;
  horasSemOrganizacao: number;
}

function paraData(valor: Date | string | null): Date | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Regra pura: quem é órfão. Confirmado, sem organização, e esperando há mais
 * de 24 horas. Ordenado do mais antigo para o mais novo.
 */
export function selecionarOrfaos(
  linhas: LinhaDeSignup[],
  agora: Date,
  horasLimite: number = HORAS_ATE_VIRAR_ORFAO,
): SignupOrfao[] {
  const limiteMs = horasLimite * 60 * 60 * 1000;

  return (linhas ?? [])
    .map((l) => ({ linha: l, confirmado: paraData(l.confirmed_at) }))
    .filter(({ linha, confirmado }) => confirmado != null && !linha.organization_id)
    .map(({ linha, confirmado }) => ({
      linha,
      esperaMs: agora.getTime() - (confirmado as Date).getTime(),
    }))
    .filter(({ esperaMs }) => esperaMs > limiteMs)
    .sort((a, b) => b.esperaMs - a.esperaMs)
    .map(({ linha, esperaMs }) => ({
      id: linha.id,
      plano: linha.plan_chosen,
      origem: linha.utm_source,
      horasSemOrganizacao: Math.floor(esperaMs / (60 * 60 * 1000)),
    }));
}

/** Tudo o que o ciclo toca de fora, injetável para o teste. */
export interface DependenciasDoVigia {
  agora?: Date;
  buscarSignups?: () => Promise<LinhaDeSignup[]>;
  jaAvisouHoje?: (agora: Date) => Promise<boolean>;
  criarTarefa?: (tarefa: { titulo: string; descricao: string }) => Promise<string | null>;
  alertarNoSlack?: (texto: string) => Promise<boolean>;
}

/** Lê os cadastros que ainda não viraram organização. SQL cru de propósito. */
async function buscarSignupsPadrao(): Promise<LinhaDeSignup[]> {
  return (await prisma.$queryRawUnsafe(
    `SELECT id, status, plan_chosen, organization_id, confirmed_at, utm_source
       FROM signups
      WHERE organization_id IS NULL
        AND confirmed_at IS NOT NULL
      ORDER BY confirmed_at ASC
      LIMIT 500`,
  )) as LinhaDeSignup[];
}

/**
 * Já existe tarefa aberta de hoje? Sem isto o Planner do fundador ganharia
 * uma linha nova por dia para os mesmos cinco leads.
 */
async function jaAvisouHojePadrao(agora: Date): Promise<boolean> {
  const inicioDoDia = new Date(agora);
  inicioDoDia.setUTCHours(0, 0, 0, 0);

  const existente = await prisma.task.findFirst({
    where: {
      organizationId: ZAPPIQ_ORG_ID,
      title: { startsWith: TITULO_DA_TAREFA },
      createdAt: { gte: inicioDoDia },
    },
    select: { id: true },
  });
  return existente != null;
}

async function criarTarefaPadrao(tarefa: { titulo: string; descricao: string }): Promise<string> {
  const criada = await prisma.task.create({
    data: {
      title: tarefa.titulo,
      description: tarefa.descricao,
      status: 'PENDING',
      organizationId: ZAPPIQ_ORG_ID,
    },
    select: { id: true },
  });
  return criada.id;
}

async function alertarNoSlackPadrao(texto: string): Promise<boolean> {
  // Mesmo canal de operação que a auditoria de qualidade e as cotas usam.
  // Sem webhook configurado, sendSlackAlert devolve false e segue a vida: o
  // log estruturado e a tarefa no Planner continuam valendo.
  return sendSlackAlert({
    webhook:
      process.env.SLACK_WEBHOOK_AGENT_QUALITY || process.env.SLACK_WEBHOOK_QUOTA_ALERTS,
    text: 'Cadastro confirmado sem organização',
    blocks: [
      buildHeaderBlock('Lead confirmou o cadastro e parou antes da organização'),
      buildSectionBlock(texto),
    ],
  });
}

export interface ResultadoDoVigia {
  encontrados: number;
  avisou: boolean;
  tarefaId: string | null;
  erro: boolean;
}

/**
 * Ciclo diário. Fail-soft em tudo: esta rotina divide o worker da fila `cron`
 * com a expiração de trial e a auditoria de qualidade, e não pode derrubar
 * nenhuma delas.
 */
export async function runSignupOrfaosCycle(
  deps: DependenciasDoVigia = {},
): Promise<ResultadoDoVigia> {
  const agora = deps.agora ?? new Date();
  const buscar = deps.buscarSignups ?? buscarSignupsPadrao;
  const jaAvisou = deps.jaAvisouHoje ?? jaAvisouHojePadrao;
  const criar = deps.criarTarefa ?? criarTarefaPadrao;
  const alertar = deps.alertarNoSlack ?? alertarNoSlackPadrao;

  let linhas: LinhaDeSignup[];
  try {
    linhas = await buscar();
  } catch (err) {
    logger.error({
      msg: 'signup_orfaos_leitura_falhou',
      error: String((err as Error)?.message ?? err),
    });
    return { encontrados: 0, avisou: false, tarefaId: null, erro: true };
  }

  const orfaos = selecionarOrfaos(linhas, agora);
  if (orfaos.length === 0) {
    logger.info({ msg: 'signup_orfaos_nenhum', avaliados: linhas.length });
    return { encontrados: 0, avisou: false, tarefaId: null, erro: false };
  }

  // Log estruturado: ids e tempo de espera, nunca e-mail.
  logger.warn({
    msg: 'signup_orfaos_encontrados',
    total: orfaos.length,
    maiorEsperaHoras: orfaos[0].horasSemOrganizacao,
    ids: orfaos.map((o) => o.id),
  });

  if (await jaAvisou(agora).catch(() => false)) {
    return { encontrados: orfaos.length, avisou: false, tarefaId: null, erro: false };
  }

  const linhasDoTexto = orfaos
    .slice(0, 20)
    .map((o) => `- ${o.id} (${o.plano ?? 'sem plano'}, ${o.horasSemOrganizacao} h, origem ${o.origem ?? 'não informada'})`)
    .join('\n');

  const descricao = [
    `${orfaos.length} pessoa(s) confirmaram o cadastro e não criaram a organização.`,
    '',
    'Cada uma parou entre confirmar o e-mail e terminar o questionário. Rode',
    'apps/api/scripts/repararSignupsOrfaos.ts (padrão dry-run) para ver quais',
    'já têm organização com o mesmo e-mail e quais são lead de verdade.',
    '',
    linhasDoTexto,
  ].join('\n');

  let tarefaId: string | null = null;
  try {
    tarefaId = await criar({
      titulo: `${TITULO_DA_TAREFA}: ${orfaos.length} lead(s)`,
      descricao,
    });
  } catch (err) {
    logger.error({
      msg: 'signup_orfaos_tarefa_falhou',
      error: String((err as Error)?.message ?? err),
    });
  }

  await alertar(descricao).catch((err) =>
    logger.warn({
      msg: 'signup_orfaos_slack_falhou',
      error: String((err as Error)?.message ?? err),
    }),
  );

  return { encontrados: orfaos.length, avisou: true, tarefaId, erro: false };
}

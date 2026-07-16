/**
 * Mira Prospects — sinalizar o cliente quando a conta dele mexeu.
 *
 * O problema que isto resolve: o mapeamento semanal rodava de madrugada, achava
 * uma matéria de verdade e a novidade ficava esperando alguém abrir a página
 * de Releases por conta própria. Notícia que ninguém vê não vale nada, e a
 * janela de entrada que ela abre fecha sozinha.
 *
 * A plataforma não tem notificação in-app (não existe model Notification), e
 * inventar um canal novo aqui seria construir metade de um sistema. O que já
 * existe e o cliente JÁ olha é a Task (`origem: 'MIRA'`, aparece em /tasks,
 * vincula ao Alvo por `miraAlvoId`) — é o mesmo caminho do plano de ação.
 *
 * REGRA DE SPAM (a decisão mais importante deste arquivo): nem todo release
 * vira tarefa. Só o ACIONÁVEL — o que gerou demanda/oportunidade ou trouxe
 * gatilho de janela. Um cliente com 50 Alvos que receba 50 tarefas por semana
 * para de olhar para as tarefas, e aí o alerta que importa morre junto com o
 * ruído. Uma tarefa por Alvo por ciclo, no máximo.
 */
import { prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';

/** Prazo do alerta: janela de entrada é perecível, 7 dias é o ciclo do cron. */
const PRAZO_DIAS = 7;

export interface AlertaReleasesResult {
  taskId: string | null;
  releasesAlertados: number;
  motivo?: string;
}

/**
 * Um release é acionável quando dá ao vendedor o que fazer, não só o que
 * saber. Matéria institucional ("empresa completa 40 anos") é informação;
 * "vai inaugurar unidade" com demanda e produto ligados é trabalho.
 */
function ehAcionavel(r: { demandaId: string | null; anguloAbordagem: string | null }): boolean {
  return Boolean(r.demandaId || r.anguloAbordagem);
}

/**
 * Cria (ou atualiza) UMA tarefa com as novidades ainda não sinalizadas deste
 * Alvo e marca os releases como alertados.
 *
 * Idempotente por duas travas independentes:
 *  - `alertadoEm` no release: uma matéria nunca é alertada duas vezes, mesmo
 *    que o cron rode de novo no mesmo dia (ou que alguém o dispare à mão).
 *  - tarefa pendente do mesmo Alvo: se a anterior ainda não foi concluída,
 *    acumula nela em vez de empilhar uma segunda.
 *
 * Nunca lança: falhar em avisar não pode derrubar o ciclo que acabou de
 * enriquecer o dossiê com sucesso.
 */
export async function alertarReleasesDoAlvo(
  organizationId: string,
  alvo: { id: string; nome: string; nomeFantasia?: string | null; contactId?: string | null; dealId?: string | null }
): Promise<AlertaReleasesResult> {
  try {
    const novos = await prisma.miraRelease.findMany({
      where: { organizationId, alvoId: alvo.id, alertadoEm: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, titulo: true, url: true, demandaId: true, anguloAbordagem: true },
    });
    if (novos.length === 0) return { taskId: null, releasesAlertados: 0, motivo: 'nada_novo' };

    const acionaveis = novos.filter(ehAcionavel);
    if (acionaveis.length === 0) {
      // Informativo: não vira tarefa, mas fica marcado como alertado para não
      // ser reavaliado toda semana. Continua visível na página de Releases.
      await prisma.miraRelease.updateMany({
        where: { id: { in: novos.map((r) => r.id) }, organizationId },
        data: { alertadoEm: new Date() },
      });
      return { taskId: null, releasesAlertados: 0, motivo: 'nada_acionavel' };
    }

    const displayName = alvo.nomeFantasia || alvo.nome;
    const titulo = `Mira: novidade em ${displayName}`.slice(0, 120);
    const corpo = [
      `${acionaveis.length} novidade(s) com gancho de abordagem em ${displayName}:`,
      '',
      ...acionaveis.map((r) => `• ${r.titulo}${r.url ? `\n  ${r.url}` : ''}${r.anguloAbordagem ? `\n  Gancho: ${r.anguloAbordagem}` : ''}`),
      '',
      'Abra o dossiê do Alvo para ver a demanda e a oportunidade que estes fatos geraram.',
    ].join('\n');

    // Tarefa de alerta ainda pendente para este Alvo? Acumula nela.
    const anterior = await prisma.task.findFirst({
      where: { organizationId, miraAlvoId: alvo.id, status: 'PENDING', title: { startsWith: 'Mira: novidade em' } },
      select: { id: true },
    });

    let taskId: string;
    if (anterior) {
      await prisma.task.update({
        where: { id: anterior.id },
        data: { title: titulo, description: corpo, dueDate: new Date(Date.now() + PRAZO_DIAS * 86400000) },
      });
      taskId = anterior.id;
    } else {
      const nova = await prisma.task.create({
        data: {
          organizationId,
          title: titulo,
          description: corpo,
          status: 'PENDING',
          origem: 'MIRA',
          miraAlvoId: alvo.id,
          dueDate: new Date(Date.now() + PRAZO_DIAS * 86400000),
          ...(alvo.contactId ? { contactId: alvo.contactId } : {}),
          ...(alvo.dealId ? { dealId: alvo.dealId } : {}),
        },
        select: { id: true },
      });
      taskId = nova.id;
    }

    // Marca TODOS (inclusive os informativos vistos nesta rodada): já passaram
    // pelo crivo, não devem voltar à fila de alerta na semana que vem.
    await prisma.miraRelease.updateMany({
      where: { id: { in: novos.map((r) => r.id) }, organizationId },
      data: { alertadoEm: new Date() },
    });

    return { taskId, releasesAlertados: acionaveis.length };
  } catch (err: any) {
    logger.warn(`[MiraReleasesAlerta] alvo=${alvo.id} falhou: ${err?.message ?? err}`);
    return { taskId: null, releasesAlertados: 0, motivo: String(err?.message ?? err) };
  }
}

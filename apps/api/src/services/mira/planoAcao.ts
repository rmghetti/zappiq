/**
 * Mira Prospects — plano de ação do Alvo, e a Tarefa que nasce dele.
 *
 * Pedido do Rodrigo (15/07/2026): "oportunidades identificadas no portfólio
 * que geram roteiro para os sponsors devem gerar automaticamente uma tarefa
 * PENDENTE em /tasks. Crie um campo 'plano de ação' onde a IA sugere o passo
 * imediato, e conforme a pessoa executa, a tarefa vira Concluída e alimenta a
 * oportunidade no CRM."
 *
 * O buraco que isto fecha: o dossiê terminava com um roteiro lindo e ZERO
 * chamada para ação. O vendedor lia, fechava a aba e a conta morria ali. A
 * fila de Alvos não é uma fila de trabalho enquanto não vira tarefa na tela
 * que a pessoa abre de manhã.
 *
 * Desenho:
 *  - o plano é TEXTO, não Json: é uma instrução para uma pessoa ler e fazer.
 *  - a Task nasce PENDING, com origem MIRA (até aqui toda Task vinha das
 *    Conversas; são trabalhos diferentes e a tela precisa distinguir).
 *  - contactId/dealId são opcionais no Task: a tarefa existe mesmo antes do
 *    Alvo pousar no CRM, e é AMARRADA depois, no pouso.
 *  - um Alvo tem UMA tarefa de plano de ação por vez (planoAcaoTaskId), senão
 *    cada clique em Aprofundar entulharia a tela do vendedor.
 */
import { Prisma, prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';

/** Prazo padrão do plano de ação: janela de entrada não espera. */
const PRAZO_DIAS = 3;

export interface PlanoAcaoResult {
  planoAcao: string;
  taskId: string;
  /** Reaproveitou a tarefa que já existia (não duplicou). */
  reused: boolean;
}

/**
 * Grava o plano de ação no Alvo e garante UMA tarefa pendente para ele.
 *
 * Idempotente por Alvo: se já existe tarefa pendente do plano, atualiza o
 * texto dela em vez de criar outra. Se a tarefa anterior já foi concluída, o
 * plano novo gera tarefa nova (o ciclo recomeça: aprofundou de novo, tem
 * passo novo).
 */
export async function registrarPlanoAcao(
  organizationId: string,
  alvo: { id: string; nome: string; nomeFantasia?: string | null; contactId?: string | null; dealId?: string | null; planoAcaoTaskId?: string | null },
  planoAcao: string
): Promise<PlanoAcaoResult | null> {
  const texto = planoAcao.trim();
  if (texto.length < 10) return null;

  const displayName = alvo.nomeFantasia || alvo.nome;
  const titulo = `Mira: ${displayName}`.slice(0, 120);

  try {
    // Tarefa anterior ainda pendente? Atualiza, não duplica.
    const anterior = alvo.planoAcaoTaskId
      ? await prisma.task.findFirst({
          where: { id: alvo.planoAcaoTaskId, organizationId, status: 'PENDING' },
          select: { id: true },
        })
      : null;

    let taskId: string;
    if (anterior) {
      await prisma.task.update({
        where: { id: anterior.id },
        data: {
          title: titulo,
          description: texto,
          // Reaprofundou: o passo é outro, o relógio recomeça.
          dueDate: new Date(Date.now() + PRAZO_DIAS * 86400000),
          ...(alvo.contactId ? { contactId: alvo.contactId } : {}),
          ...(alvo.dealId ? { dealId: alvo.dealId } : {}),
        },
      });
      taskId = anterior.id;
    } else {
      const nova = await prisma.task.create({
        data: {
          organizationId,
          title: titulo,
          description: texto,
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

    await prisma.miraAlvo.update({
      where: { id: alvo.id },
      data: { planoAcao: texto, planoAcaoTaskId: taskId },
    });

    // Só registra na timeline quando o Alvo já está no CRM: Activity sem
    // deal/contact não aparece em lugar nenhum.
    if (alvo.dealId || alvo.contactId) {
      await prisma.activity
        .create({
          data: {
            type: 'TASK_CREATED' as any,
            actor: 'AI' as any,
            title: anterior ? 'Mira atualizou o plano de ação' : 'Mira sugeriu um plano de ação',
            body: texto.slice(0, 2000),
            ...(alvo.contactId ? { contactId: alvo.contactId } : {}),
            ...(alvo.dealId ? { dealId: alvo.dealId } : {}),
            organizationId,
            metadata: { origem: 'mira_prospects', miraAlvoId: alvo.id, taskId } as Prisma.InputJsonValue,
          },
        })
        .catch(() => {
          /* timeline é acessório: não derruba o plano */
        });
    }

    logger.info(`[MiraPlanoAcao] alvo=${alvo.id} task=${taskId} ${anterior ? '(atualizada)' : '(criada)'}`);
    return { planoAcao: texto, taskId, reused: Boolean(anterior) };
  } catch (err: any) {
    // O dossiê já foi entregue; perder a tarefa é ruim, perder a análise é pior.
    logger.error(`[MiraPlanoAcao] falhou alvo=${alvo.id}: ${err?.message ?? err}`);
    return null;
  }
}

/**
 * Amarra a tarefa do plano de ação ao Contact/Deal recém-criados.
 *
 * A tarefa costuma nascer ANTES do pouso (o cliente aprofunda, depois decide
 * enviar), então ela fica órfã de deal até aqui. Sem esta costura, concluir a
 * tarefa não teria onde escrever no CRM.
 */
export async function ligarTarefaAoCrm(
  organizationId: string,
  alvoId: string,
  contactId: string,
  dealId: string
): Promise<void> {
  try {
    const alvo = await (prisma as any).miraAlvo.findFirst({
      where: { id: alvoId, organizationId },
      select: { planoAcaoTaskId: true },
    });
    if (!alvo?.planoAcaoTaskId) return;
    await prisma.task.updateMany({
      where: { id: alvo.planoAcaoTaskId, organizationId },
      data: { contactId, dealId },
    });
  } catch (err: any) {
    logger.warn(`[MiraPlanoAcao] não consegui ligar a tarefa ao CRM alvo=${alvoId}: ${err?.message ?? err}`);
  }
}

/**
 * Tarefa da Mira concluída → a oportunidade no CRM fica sabendo.
 *
 * A outra ponta do pedido: "conforme ele interage e executa essa tarefa, ela
 * passa para Concluída e alimenta essa informação também automaticamente na
 * oportunidade no CRM". Sem isto, o vendedor executa o plano e o pipeline
 * continua achando que ninguém fez nada.
 *
 * Chamado pela rota de tasks quando o status vira DONE. Nunca lança: concluir
 * a tarefa é do usuário e não pode falhar por causa da telemetria.
 */
export async function registrarConclusaoNoCrm(
  organizationId: string,
  task: { id: string; title: string; description: string | null; origem: string; miraAlvoId: string | null; contactId: string | null; dealId: string | null }
): Promise<void> {
  if (task.origem !== 'MIRA') return;
  if (!task.dealId && !task.contactId) return;
  try {
    await prisma.activity.create({
      data: {
        type: 'TASK_COMPLETED' as any,
        actor: 'USER' as any,
        title: `Plano de ação da Mira concluído: ${task.title}`,
        body: task.description ? task.description.slice(0, 2000) : null,
        ...(task.contactId ? { contactId: task.contactId } : {}),
        ...(task.dealId ? { dealId: task.dealId } : {}),
        organizationId,
        metadata: { origem: 'mira_prospects', miraAlvoId: task.miraAlvoId, taskId: task.id } as Prisma.InputJsonValue,
      },
    });
    logger.info(`[MiraPlanoAcao] conclusão registrada no CRM task=${task.id} deal=${task.dealId}`);
  } catch (err: any) {
    logger.warn(`[MiraPlanoAcao] não consegui registrar a conclusão task=${task.id}: ${err?.message ?? err}`);
  }
}

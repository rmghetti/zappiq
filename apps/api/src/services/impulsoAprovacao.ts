/**
 * Zap Impulso — a Tarefa de aprovação do Co-Piloto.
 *
 * Achado ao mapear o pedido do Rodrigo (16/07/2026): "Co-Piloto" (autonomyLevel
 * padrão 2, "a IA propõe e o humano aprova") é hoje só um CAMPO no schema — nada
 * no código lê `autonomyLevel`. Uma campanha nasce DRAFT (precisa de clique
 * manual em /publish) ou SCHEDULED (o cron dispara sozinho, na hora marcada,
 * SEM checar se alguém revisou). A frase "a aprovação não chega a ninguém" era
 * literal: não existia nenhum artefato notificável dizendo "isto está esperando
 * revisão".
 *
 * ESCOPO DELIBERADAMENTE LIMITADO A VISIBILIDADE, NÃO A TRAVA:
 * esta Tarefa é um LEMBRETE. Concluí-la NÃO publica a campanha, e deixá-la
 * pendente NÃO impede o cron de disparar uma campanha SCHEDULED. Fazer a
 * aprovação REALMENTE travar o disparo é mudança de comportamento em cima do
 * envio de mensagem de cliente pago — decisão de produto que exige sinal
 * explícito do Rodrigo (pode travar campanha que hoje depende do disparo
 * automático), não uma inferência de "melhor recomendação" dentro de um loop
 * autônomo. Ver docs/tarefas/planner-status.md.
 */

export interface CampanhaParaTarefa {
  id: string;
  name: string;
  status: string;
  channels: unknown;
  audienceSegment: unknown;
  scheduledAt: string | Date | null;
}

/**
 * Toda campanha nova do Impulso pede revisão — é o próprio "Co-Piloto propõe,
 * humano aprova" que o autonomyLevel=2 já promete na tela de criação e nunca
 * cumpriu em lugar nenhum. Only false se a campanha já nasceu noutro estado
 * (ex.: reimportada já ACTIVE) — não deveria acontecer no fluxo normal, mas a
 * função fica honesta sobre o que ela cobre.
 */
export function precisaAprovacao(campaign: Pick<CampanhaParaTarefa, 'status'>): boolean {
  return campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED';
}

function resumoCanais(channels: unknown): string {
  if (!Array.isArray(channels) || channels.length === 0) return 'canal não definido';
  return channels.join(', ');
}

function resumoAudiencia(audienceSegment: unknown): string {
  if (!audienceSegment) return 'segmento não definido';
  if (typeof audienceSegment === 'string') return audienceSegment;
  if (typeof audienceSegment === 'object') {
    const s = audienceSegment as Record<string, unknown>;
    if (typeof s.description === 'string' && s.description.trim()) return s.description;
    if (typeof s.label === 'string' && s.label.trim()) return s.label;
  }
  return 'segmento configurado (ver campanha)';
}

/** Monta título e descrição da tarefa — a pessoa decide sem abrir mais nada. */
export function montarTarefaAprovacao(campaign: CampanhaParaTarefa): {
  title: string;
  description: string;
  dueDate: Date;
} {
  const canais = resumoCanais(campaign.channels);
  const audiencia = resumoAudiencia(campaign.audienceSegment);
  const quando = campaign.scheduledAt
    ? `agendada para ${new Date(campaign.scheduledAt).toLocaleDateString('pt-BR')}`
    : 'sem agendamento (só dispara quando você publicar)';

  return {
    title: `Aprovar campanha: ${campaign.name}`,
    description:
      `A Iza montou esta campanha e está esperando sua revisão antes de sair.\n` +
      `Canais: ${canais}. Público: ${audiencia}. Está ${quando}.\n` +
      `Revise a copy e o público em Zap Impulso antes de aprovar.`,
    // Se agendada, o prazo é a própria data do disparo — depois disso a revisão
    // já chegou tarde. Sem agendamento, 24h é o mesmo prazo padrão que o resto
    // do Tarefas usa pra follow-up (crmAutomationService).
    dueDate: campaign.scheduledAt ? new Date(campaign.scheduledAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

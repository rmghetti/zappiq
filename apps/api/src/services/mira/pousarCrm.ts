/**
 * Mira Prospects — pouso no CRM.
 *
 * Um Alvo vira registro trabalhável no CRM da ZappIQ:
 *   - Contact da conta (whatsappId = telefone comercial quando existe;
 *     senão id sintético "mira:{cnpj}" — convenção documentada; o número
 *     real entra quando o cliente conectar a conversa).
 *   - Deal ligado ao Contact, com valor estimado quando a análise calculou.
 *   - Activities com o dossiê inteiro: resumo, oportunidades, demandas,
 *     fornecedor atual, janela e roteiro por decisor.
 * Idempotente: se o Alvo já tem contactId/dealId, reaproveita.
 *
 * DUAS MUDANÇAS DE 15/07/2026 (pedidos do fundador):
 *
 * 1. "Garantir que o lead gerado no MIRA chegue no CRM com todas as
 *    informações possíveis". Antes o pouso levava 5 campos e jogava fora o
 *    dossiê inteiro: quem abria o Deal no pipeline via "Mira · ACME" e nada
 *    mais. Todo o trabalho de mapeamento morria na porta do CRM. Agora a
 *    firmografia vai em customFields (campo a campo, não um blob), o comitê
 *    vira Contacts próprios, e o dossiê vira Activities legíveis na timeline.
 *
 * 2. "Se o cliente quiser enviar um Alvo em qualificação, ele pode, com a
 *    ressalva de Não qualificado". `forcar: true` libera o pouso de quem não
 *    passou no gate, mas o registro NASCE marcado: leadStatus UNQUALIFIED,
 *    tag `mira-nao-qualificado`, aviso no título do Deal e uma Activity
 *    dizendo o que falta. Deixar entrar disfarçado de qualificado seria pior
 *    que não deixar entrar.
 */
import { Prisma, prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';
import { alvoPassaGate } from './reavaliar.js';
import { ligarTarefaAoCrm } from './planoAcao.js';

export interface PousarResult {
  contactId: string;
  dealId: string;
  reused: boolean;
  /** Entrou sem passar no gate (o cliente pediu "enviar assim mesmo"). */
  naoQualificado: boolean;
  /** O que falta para ele ser qualificado (só quando naoQualificado). */
  motivoNaoQualificado?: string;
  /** Contacts criados para os decisores do comitê (além do principal). */
  decisoresNoCrm: number;
}

/** Rótulo curto de um decisor para a timeline do CRM. */
function linhaDecisor(d: any): string {
  const contato = (d.contato ?? {}) as { email?: string | null; phone?: string | null };
  const perfil = (d.perfilPublico ?? {}) as { linkedinUrl?: string | null };
  const extras = [
    contato.email ? `e-mail ${contato.email}` : null,
    contato.phone ? `tel ${contato.phone}` : null,
    perfil.linkedinUrl ? perfil.linkedinUrl : null,
    d.vinculoQsa ? 'quadro societário (fonte oficial)' : null,
  ].filter(Boolean);
  return `${d.nome} — ${d.papel}${extras.length ? ` (${extras.join('; ')})` : ''}`;
}

export async function pousarNoCrm(
  organizationId: string,
  alvoId: string,
  opts: { forcar?: boolean } = {}
): Promise<PousarResult> {
  const alvo = await (prisma as any).miraAlvo.findFirst({
    where: { id: alvoId, organizationId },
    include: {
      decisores: { orderBy: { confianca: 'desc' } },
      oportunidades: { orderBy: { rank: 'asc' } },
      demandas: { orderBy: { rank: 'asc' } },
      incumbentes: true,
      releases: { orderBy: { createdAt: 'desc' }, take: 3 },
      campanha: { select: { nome: true } },
    },
  });
  if (!alvo) {
    const err: any = new Error('alvo_not_found');
    err.status = 404;
    throw err;
  }

  const qualificado = alvo.status === 'READY' || alvo.status === 'DELIVERED';
  if (!qualificado && !opts.forcar) {
    const err: any = new Error('alvo_nao_pronto');
    err.status = 409;
    throw err;
  }
  if (alvo.status === 'ARCHIVED') {
    const err: any = new Error('alvo_arquivado');
    err.status = 409;
    throw err;
  }

  const gate = alvoPassaGate(alvo);
  const naoQualificado = !qualificado;
  const motivoNaoQualificado = naoQualificado ? gate.motivo : undefined;

  // Idempotência
  if (alvo.contactId && alvo.dealId) {
    return {
      contactId: alvo.contactId,
      dealId: alvo.dealId,
      reused: true,
      naoQualificado: false,
      decisoresNoCrm: 0,
    };
  }

  const displayName = alvo.nomeFantasia || alvo.nome;
  const phoneDigits: string = (alvo.telefone ?? '').replace(/\D/g, '');
  const whatsappId = phoneDigits.length >= 10 ? phoneDigits : `mira:${alvo.cnpj ?? alvo.id}`;
  const decisorPrincipal = alvo.decisores[0] ?? null;
  const contatoPrincipal = (decisorPrincipal?.contato ?? {}) as { email?: string | null; phone?: string | null };
  const oportunidade1 = alvo.oportunidades[0] ?? null;
  const agora = new Date().toISOString();

  // Firmografia campo a campo (o pedido: "campos específicos para cada
  // informação coletada"). customFields é Json, mas isto NÃO é um blob: cada
  // chave é um campo que o CRM lista e filtra.
  const customFields: Record<string, unknown> = {
    origem: 'mira_prospects',
    miraAlvoId: alvo.id,
    miraScore: alvo.miraScore,
    miraConfianca: alvo.confianca,
    miraStatus: alvo.status,
    cnpj: alvo.cnpj,
    razaoSocial: alvo.nome,
    nomeFantasia: alvo.nomeFantasia,
    cnae: alvo.cnae,
    porte: alvo.porte,
    capitalSocial: alvo.capitalSocial,
    situacaoCadastral: alvo.situacaoCadastral,
    municipio: alvo.municipio,
    uf: alvo.uf,
    site: alvo.site,
    telefoneEmpresa: alvo.telefone,
    papelDecisor: decisorPrincipal?.papel ?? null,
    decisorLinkedin: (decisorPrincipal?.perfilPublico as any)?.linkedinUrl ?? null,
    comiteTamanho: alvo.decisores.length,
    campanha: alvo.campanha?.nome ?? null,
    oportunidade1: oportunidade1?.produto ?? null,
    oportunidade2: alvo.oportunidades[1]?.produto ?? null,
    janelaEntrada: alvo.releases.find((r: any) => r.anguloAbordagem)?.anguloAbordagem ?? null,
    fornecedorAtual: alvo.incumbentes[0]?.fornecedor ?? null,
    ...(naoQualificado ? { miraNaoQualificado: true, miraMotivoNaoQualificado: gate.motivo } : {}),
  };

  const tags = ['mira', ...(naoQualificado ? ['mira-nao-qualificado'] : [])];

  // Contact (upsert por whatsappId+org — pode já existir na carteira)
  let contactId = alvo.contactId as string | null;
  if (!contactId) {
    const existing = await (prisma as any).contact.findFirst({
      where: { organizationId, whatsappId },
      select: { id: true },
    });
    if (existing) {
      contactId = existing.id;
    } else {
      const contact = await (prisma as any).contact.create({
        data: {
          organizationId,
          whatsappId,
          phone: phoneDigits.length >= 10 ? phoneDigits : '',
          name: decisorPrincipal ? decisorPrincipal.nome : displayName,
          email: contatoPrincipal.email ?? null,
          company: alvo.nome,
          tags,
          // O Mira Score é a nota de prioridade que o CRM já sabe ordenar.
          leadScore: alvo.miraScore ?? 0,
          // UNQUALIFIED existe no enum e é exatamente o que este lead é.
          // Entrar como QUALIFIED sem ter passado no gate seria mentir para
          // o vendedor que abrir a lista amanhã.
          leadStatus: naoQualificado ? 'UNQUALIFIED' : 'QUALIFIED',
          funnelStage: naoQualificado ? 'new' : 'qualified',
          customFields,
        },
        select: { id: true },
      });
      contactId = contact.id;
    }
  }

  // Deal no pipeline
  let dealId = alvo.dealId as string | null;
  if (!dealId) {
    const deal = await (prisma as any).deal.create({
      data: {
        organizationId,
        contactId: contactId!,
        // O aviso vai no TÍTULO porque é o que aparece no card do pipeline:
        // quem olha o funil precisa ver a ressalva sem abrir nada.
        title: `Mira · ${displayName}${naoQualificado ? ' (não qualificado)' : ''}`,
        stage: 'new',
        // Valor estimado da oportunidade nº1, quando a análise calculou.
        ...(oportunidade1?.valorEstimado != null ? { value: oportunidade1.valorEstimado } : {}),
      },
      select: { id: true },
    });
    dealId = deal.id;
  }

  await prisma.miraAlvo.update({
    where: { id: alvo.id },
    data: { contactId, dealId, status: 'DELIVERED' },
  });

  // ── O dossiê vira timeline do CRM ────────────────────────────────
  // Sem isto, o vendedor abre o Deal e não vê nada do que a Mira descobriu.
  const atividades: { type: string; title: string; body: string }[] = [];

  if (naoQualificado) {
    atividades.push({
      type: 'NOTE',
      title: 'Atenção: Alvo enviado sem passar na verificação',
      body:
        `Este Alvo foi enviado ao CRM a pedido do usuário, sem ter passado no controle de qualidade da Mira.\n\n` +
        `O que falta: ${gate.motivo}.\n\n` +
        `Ele não descontou da sua cota de Alvos, e os dados abaixo podem estar incompletos. ` +
        `Confirme antes de abordar.`,
    });
  }

  if (alvo.resumo) {
    atividades.push({ type: 'AI_SUMMARY', title: 'Dossiê Mira: resumo da conta', body: alvo.resumo });
  }

  const firmografia = [
    alvo.cnpj ? `CNPJ: ${alvo.cnpj}` : null,
    alvo.nome ? `Razão social: ${alvo.nome}` : null,
    alvo.cnae ? `CNAE: ${alvo.cnae}` : null,
    alvo.porte ? `Porte: ${alvo.porte}` : null,
    alvo.capitalSocial != null ? `Capital social: R$ ${Number(alvo.capitalSocial).toLocaleString('pt-BR')}` : null,
    alvo.situacaoCadastral ? `Situação na Receita: ${alvo.situacaoCadastral}` : null,
    [alvo.municipio, alvo.uf].filter(Boolean).length ? `Local: ${[alvo.municipio, alvo.uf].filter(Boolean).join('/')}` : null,
    alvo.telefone ? `Telefone: ${alvo.telefone}` : null,
    alvo.site ? `Site: ${alvo.site}` : null,
    alvo.campanha?.nome ? `Campanha de origem: ${alvo.campanha.nome}` : null,
    `Mira Score: ${alvo.miraScore ?? '–'} · Confiança: ${alvo.confianca ?? '–'}%`,
  ].filter(Boolean);
  atividades.push({ type: 'NOTE', title: 'Dossiê Mira: firmografia verificada', body: firmografia.join('\n') });

  if (alvo.decisores.length > 0) {
    atividades.push({
      type: 'NOTE',
      title: `Dossiê Mira: comitê de compra (${alvo.decisores.length})`,
      body: alvo.decisores.map(linhaDecisor).join('\n'),
    });
  }

  if (alvo.demandas.length > 0) {
    atividades.push({
      type: 'NOTE',
      title: 'Dossiê Mira: demandas identificadas',
      body: alvo.demandas
        .map((d: any) =>
          `• ${d.descricao}\n  ${d.fonte ? `Evidência: ${d.evidencia}\n  Fonte: ${d.fonte}` : `Presunção (confiança ${d.confianca}%): ${d.evidencia}`}`
        )
        .join('\n\n'),
    });
  }

  if (alvo.oportunidades.length > 0) {
    atividades.push({
      type: 'NOTE',
      title: 'Dossiê Mira: oportunidades de portfólio',
      body: alvo.oportunidades
        .map((o: any) => `nº${o.rank} — ${o.produto}\n  ${o.racional}`)
        .join('\n\n'),
    });
    // Roteiro por decisor: é o que o vendedor usa na primeira mensagem.
    const roteiros = (alvo.oportunidades[0]?.roteiro as any)?.porSponsor ?? [];
    if (Array.isArray(roteiros) && roteiros.length > 0) {
      atividades.push({
        type: 'NOTE',
        title: 'Dossiê Mira: roteiro de abordagem por decisor',
        body: roteiros.map((r: any) => `Para ${r.decisor}:\n${r.mensagem}`).join('\n\n'),
      });
    }
  }

  if (alvo.incumbentes.length > 0) {
    atividades.push({
      type: 'NOTE',
      title: 'Dossiê Mira: fornecedor atual',
      body: alvo.incumbentes
        .map((i: any) => `${i.fornecedor}${i.categoria ? ` (${i.categoria})` : ''}\n  ${i.evidencia}\n  Deslocabilidade: ${i.deslocabilidade ?? 'não avaliada'}\n  Fonte: ${i.fonte ?? '–'}`)
        .join('\n\n'),
    });
  }

  if (alvo.releases.length > 0) {
    atividades.push({
      type: 'NOTE',
      title: 'Dossiê Mira: novidades da conta',
      body: alvo.releases
        .map((r: any) => `${r.titulo}\n  ${r.resumo}\n  Por que importa: ${r.relevancia}\n  Fonte: ${r.url ?? '–'}`)
        .join('\n\n'),
    });
  }

  for (const a of atividades) {
    try {
      await prisma.activity.create({
        data: {
          type: a.type as any,
          actor: 'AI' as any,
          title: a.title,
          body: a.body.slice(0, 4000),
          contactId,
          dealId,
          organizationId,
          metadata: { origem: 'mira_prospects', miraAlvoId: alvo.id, geradoEm: agora } as Prisma.InputJsonValue,
        },
      });
    } catch (err: any) {
      // Timeline incompleta é ruim; perder o pouso inteiro é pior.
      logger.warn(`[Mira] activity "${a.title}" falhou alvo=${alvo.id}: ${err?.message ?? err}`);
    }
  }

  // ── Cada decisor vira Contact próprio ────────────────────────────
  // O comitê é o ativo do dossiê: deixar só o principal como Contact perde
  // as outras portas de entrada que a Mira mapeou.
  let decisoresNoCrm = 0;
  for (const d of alvo.decisores) {
    if (d.contactId) continue;
    const dContato = (d.contato ?? {}) as { email?: string | null; phone?: string | null };
    const dPerfil = (d.perfilPublico ?? {}) as { linkedinUrl?: string | null; instagramUrl?: string | null };
    const dPhone = (dContato.phone ?? '').replace(/\D/g, '');
    // Sem telefone real, o id sintético mantém o contato rastreável e
    // deduplicável até o número aparecer.
    const dWhatsappId = dPhone.length >= 10 ? dPhone : `mira:decisor:${d.id}`;
    try {
      const jaExiste = await (prisma as any).contact.findFirst({
        where: { organizationId, whatsappId: dWhatsappId },
        select: { id: true },
      });
      const cid =
        jaExiste?.id ??
        (
          await (prisma as any).contact.create({
            data: {
              organizationId,
              whatsappId: dWhatsappId,
              phone: dPhone.length >= 10 ? dPhone : '',
              name: d.nome,
              email: dContato.email ?? null,
              company: alvo.nome,
              tags: [...tags, 'mira-decisor'],
              leadScore: alvo.miraScore ?? 0,
              leadStatus: naoQualificado ? 'UNQUALIFIED' : 'QUALIFIED',
              funnelStage: naoQualificado ? 'new' : 'qualified',
              customFields: {
                origem: 'mira_prospects',
                miraAlvoId: alvo.id,
                papel: d.papel,
                arquetipo: d.arquetipo,
                vinculoQsa: d.vinculoQsa,
                linkedinUrl: dPerfil.linkedinUrl ?? null,
                instagramUrl: dPerfil.instagramUrl ?? null,
                confianca: d.confianca,
                baseLegal: d.baseLegal,
                empresa: alvo.nome,
                cnpj: alvo.cnpj,
              },
            },
            select: { id: true },
          })
        ).id;
      await prisma.miraDecisor.update({ where: { id: d.id }, data: { contactId: cid } });
      if (!jaExiste) decisoresNoCrm++;
    } catch (err: any) {
      logger.warn(`[Mira] contact do decisor "${d.nome}" falhou: ${err?.message ?? err}`);
    }
  }

  // A tarefa do plano de ação costuma nascer ANTES do pouso (o cliente
  // aprofunda, depois decide enviar), então ela fica órfã de deal até aqui.
  // Sem esta costura, concluir a tarefa não teria onde escrever no CRM.
  await ligarTarefaAoCrm(organizationId, alvo.id, contactId!, dealId!);

  logger.info(
    `[Mira] alvo=${alvo.id} pousou no CRM (contact=${contactId} deal=${dealId} decisores=${decisoresNoCrm} atividades=${atividades.length}${naoQualificado ? ' NAO-QUALIFICADO' : ''}) org=${organizationId}`
  );
  return {
    contactId: contactId!,
    dealId: dealId!,
    reused: false,
    naoQualificado,
    ...(motivoNaoQualificado ? { motivoNaoQualificado } : {}),
    decisoresNoCrm,
  };
}

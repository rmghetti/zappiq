/**
 * DSR fulfillment (FEATURE 5b.4) — automação das ações do titular sobre a fila
 * de data_subject_requests.
 *
 * Cobre 3 ações executadas pelo operador ADMIN/AUDITOR na tela /dsr:
 *
 *   (a) EXPORTAR (Art. 18 II/V — acesso e portabilidade): junta os dados do
 *       Contact + conversas + mensagens do titular (casando por telefone/email)
 *       e devolve um pacote JSON estruturado (ou CSV achatado).
 *
 *   (b) ELIMINAR (Art. 18 VI + Art. 16): soft-delete das conversas do titular
 *       (deletedAt/deletedById/deletionReason — o purge físico é do
 *       retentionService) + ANONIMIZAÇÃO do Contact (nome/telefone/email/etc.
 *       viram placeholders), preservando métricas agregadas (leadScore,
 *       funnelStage, contadores). Marca a DSR como COMPLETED.
 *
 *   (c) e-mail ao titular na conclusão — feito na rota, reusando o
 *       emailProvider + template dsrCompleted.
 *
 * A lógica PURA (montagem do export, CSV, cálculo dos placeholders de
 * anonimização) vive em funções sem I/O para ser testável isoladamente. As
 * funções que tocam o banco (findDataSubjectContacts / executeExport /
 * executeDeletion) orquestram por cima delas.
 */
import { prisma, Prisma } from '@zappiq/database';

// ── Tipos leves (evitam acoplar aos tipos gerados do Prisma nos testes) ──

export interface ExportContact {
  id: string;
  whatsappId: string;
  phone: string;
  name: string | null;
  email: string | null;
  company: string | null;
  tags: string[];
  leadScore: number;
  leadStatus: string;
  funnelStage: string;
  consentMarketing: boolean;
  createdAt: Date;
}

export interface ExportMessage {
  id: string;
  direction: string;
  type: string;
  content: string;
  status: string;
  isFromBot: boolean;
  createdAt: Date;
}

export interface ExportConversation {
  id: string;
  status: string;
  channel: string;
  summary: string | null;
  createdAt: Date;
  messages: ExportMessage[];
}

export interface DsrExportPackage {
  protocol: string;
  generatedAt: string;
  subject: {
    requesterName: string | null;
    requesterEmail: string;
  };
  contacts: Array<Record<string, unknown>>;
  conversations: Array<Record<string, unknown>>;
  totals: {
    contacts: number;
    conversations: number;
    messages: number;
  };
}

// ── (a) EXPORT — lógica pura ────────────────────────────────────────

/**
 * Monta o pacote de exportação (acesso/portabilidade) a partir dos dados já
 * carregados do banco. PURA: sem I/O, determinística dado o input.
 */
export function buildExportPackage(input: {
  protocol: string;
  requesterName: string | null;
  requesterEmail: string;
  contacts: ExportContact[];
  conversations: ExportConversation[];
  generatedAt?: Date;
}): DsrExportPackage {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();

  const contacts = input.contacts.map((c) => ({
    id: c.id,
    whatsappId: c.whatsappId,
    phone: c.phone,
    name: c.name,
    email: c.email,
    company: c.company,
    tags: c.tags,
    leadScore: c.leadScore,
    leadStatus: c.leadStatus,
    funnelStage: c.funnelStage,
    consentMarketing: c.consentMarketing,
    createdAt: c.createdAt.toISOString(),
  }));

  let messageCount = 0;
  const conversations = input.conversations.map((conv) => {
    messageCount += conv.messages.length;
    return {
      id: conv.id,
      status: conv.status,
      channel: conv.channel,
      summary: conv.summary,
      createdAt: conv.createdAt.toISOString(),
      messages: conv.messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        type: m.type,
        content: m.content,
        status: m.status,
        isFromBot: m.isFromBot,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  });

  return {
    protocol: input.protocol,
    generatedAt,
    subject: {
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
    },
    contacts,
    conversations,
    totals: {
      contacts: contacts.length,
      conversations: conversations.length,
      messages: messageCount,
    },
  };
}

/** Escapa um valor para uma célula CSV (RFC 4180). PURA. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s: string;
  if (Array.isArray(value)) s = value.join('; ');
  else if (value instanceof Date) s = value.toISOString();
  else if (typeof value === 'object') s = JSON.stringify(value);
  else s = String(value);

  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Achata o pacote de export num CSV de mensagens (1 linha por mensagem, mais
 * as colunas do contato/conversa). Formato tabular para portabilidade simples.
 * PURA.
 */
export function exportPackageToCsv(pkg: DsrExportPackage): string {
  const header = [
    'protocol',
    'requesterEmail',
    'requesterName',
    'contactId',
    'contactName',
    'contactPhone',
    'contactEmail',
    'conversationId',
    'conversationChannel',
    'messageId',
    'messageDirection',
    'messageType',
    'messageContent',
    'messageAt',
  ];
  const rows: string[] = [header.map(csvCell).join(',')];

  // Índice rápido do "primeiro" contato para colunas de identificação.
  const primary = pkg.contacts[0] as Record<string, unknown> | undefined;

  if (pkg.conversations.length === 0) {
    // Ainda emitimos ao menos a linha do titular/contato (sem conversas).
    rows.push(
      [
        pkg.protocol,
        pkg.subject.requesterEmail,
        pkg.subject.requesterName,
        primary?.id ?? '',
        primary?.name ?? '',
        primary?.phone ?? '',
        primary?.email ?? '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ].map(csvCell).join(','),
    );
    return rows.join('\r\n');
  }

  for (const conv of pkg.conversations) {
    const messages = (conv.messages as Array<Record<string, unknown>>) ?? [];
    if (messages.length === 0) {
      rows.push(
        [
          pkg.protocol,
          pkg.subject.requesterEmail,
          pkg.subject.requesterName,
          primary?.id ?? '',
          primary?.name ?? '',
          primary?.phone ?? '',
          primary?.email ?? '',
          conv.id,
          conv.channel,
          '',
          '',
          '',
          '',
          '',
        ].map(csvCell).join(','),
      );
      continue;
    }
    for (const m of messages) {
      rows.push(
        [
          pkg.protocol,
          pkg.subject.requesterEmail,
          pkg.subject.requesterName,
          primary?.id ?? '',
          primary?.name ?? '',
          primary?.phone ?? '',
          primary?.email ?? '',
          conv.id,
          conv.channel,
          m.id,
          m.direction,
          m.type,
          m.content,
          m.createdAt,
        ].map(csvCell).join(','),
      );
    }
  }

  return rows.join('\r\n');
}

// ── (b) ANONIMIZAÇÃO — lógica pura ──────────────────────────────────

export interface ContactAnonymizationInput {
  id: string;
  whatsappId: string;
  phone: string;
  name: string | null;
  email: string | null;
  company: string | null;
  avatarUrl: string | null;
  tags: string[];
  customFields: Prisma.JsonValue;
  birthDate: Date | null;
  instagramScopedId: string | null;
}

/**
 * Calcula os campos de PII que devem virar placeholder para um Contact,
 * preservando as métricas agregadas (leadScore, funnelStage, leadStatus,
 * contadores) que NÃO são tocadas aqui. PURA: recebe o contato e devolve
 * apenas o patch a aplicar.
 *
 * Estratégia:
 *   - nome/empresa → rótulo genérico "Titular anonimizado";
 *   - telefone/whatsappId → placeholder derivado do id (mantém unicidade da
 *     @@unique([whatsappId, organizationId]) sem colidir entre contatos);
 *   - email/avatar/birthDate/instagramScopedId → null;
 *   - tags/customFields → esvaziados (podem conter PII livre).
 *
 * O placeholder do whatsappId/phone é determinístico por id para: (1) manter a
 * constraint de unicidade; (2) ser idempotente (rodar 2x não muda o resultado).
 */
export function computeContactAnonymization(
  contact: ContactAnonymizationInput,
): {
  whatsappId: string;
  instagramScopedId: null;
  phone: string;
  name: string;
  email: null;
  company: null;
  avatarUrl: null;
  tags: string[];
  customFields: Prisma.InputJsonValue;
  birthDate: null;
} {
  const token = `anon_${contact.id}`;
  return {
    whatsappId: token,
    instagramScopedId: null,
    phone: token,
    name: 'Titular anonimizado',
    email: null,
    company: null,
    avatarUrl: null,
    tags: [],
    customFields: {},
    birthDate: null,
  };
}

/** True se o contato já está anonimizado (idempotência). PURA. */
export function isContactAnonymized(contact: { whatsappId: string }): boolean {
  return contact.whatsappId.startsWith('anon_');
}

// ── Orquestração (toca o banco) ─────────────────────────────────────

/**
 * Localiza os contatos do titular DENTRO de uma organização, casando por
 * contactId explícito da DSR OU por email/telefone informados. Normaliza
 * telefone para só dígitos antes de comparar.
 */
export async function findDataSubjectContacts(params: {
  organizationId: string;
  contactId?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<string[]> {
  const { organizationId, contactId, email, phone } = params;

  const or: Prisma.ContactWhereInput[] = [];
  if (contactId) or.push({ id: contactId });
  if (email) or.push({ email: { equals: email, mode: 'insensitive' } });
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 8) {
      // Casa telefone completo OU sufixo (o titular pode informar sem DDI/DDD).
      or.push({ phone: { contains: digits.slice(-8) } });
    }
  }

  if (or.length === 0) return [];

  const contacts = await prisma.contact.findMany({
    where: { organizationId, OR: or },
    select: { id: true },
  });
  return contacts.map((c) => c.id);
}

/**
 * Carrega e monta o pacote de exportação do titular a partir dos contatos
 * resolvidos. Retorna o pacote pronto (para JSON) — o CSV é derivado à parte.
 */
export async function buildDsrExport(params: {
  organizationId: string;
  protocol: string;
  requesterName: string | null;
  requesterEmail: string;
  contactIds: string[];
}): Promise<DsrExportPackage> {
  const { organizationId, contactIds } = params;

  if (contactIds.length === 0) {
    return buildExportPackage({
      protocol: params.protocol,
      requesterName: params.requesterName,
      requesterEmail: params.requesterEmail,
      contacts: [],
      conversations: [],
    });
  }

  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds }, organizationId },
    select: {
      id: true,
      whatsappId: true,
      phone: true,
      name: true,
      email: true,
      company: true,
      tags: true,
      leadScore: true,
      leadStatus: true,
      funnelStage: true,
      consentMarketing: true,
      createdAt: true,
    },
  });

  const conversations = await prisma.conversation.findMany({
    where: { contactId: { in: contactIds }, organizationId },
    select: {
      id: true,
      status: true,
      channel: true,
      summary: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          direction: true,
          type: true,
          content: true,
          status: true,
          isFromBot: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return buildExportPackage({
    protocol: params.protocol,
    requesterName: params.requesterName,
    requesterEmail: params.requesterEmail,
    contacts: contacts as ExportContact[],
    conversations: conversations as unknown as ExportConversation[],
  });
}

export interface DeletionResult {
  contactsAnonymized: number;
  conversationsSoftDeleted: number;
}

/**
 * Executa a eliminação (Art. 18 VI): soft-delete das conversas + anonimização
 * dos contatos do titular, numa transação. Preserva métricas agregadas.
 * Idempotente: contatos já anonimizados e conversas já soft-deletadas são
 * ignorados.
 */
export async function executeDeletion(params: {
  organizationId: string;
  contactIds: string[];
  operatorUserId: string;
  reason: string;
}): Promise<DeletionResult> {
  const { organizationId, contactIds, operatorUserId, reason } = params;

  if (contactIds.length === 0) {
    return { contactsAnonymized: 0, conversationsSoftDeleted: 0 };
  }

  return prisma.$transaction(async (tx) => {
    // 1. Soft-delete das conversas ainda ativas do titular.
    const softDeleted = await tx.conversation.updateMany({
      where: {
        contactId: { in: contactIds },
        organizationId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        deletedById: operatorUserId,
        deletionReason: reason,
        anonymizedAt: new Date(),
      },
    });

    // 2. Anonimização dos contatos (um a um — o placeholder depende do id).
    const contacts = await tx.contact.findMany({
      where: { id: { in: contactIds }, organizationId },
      select: {
        id: true,
        whatsappId: true,
        phone: true,
        name: true,
        email: true,
        company: true,
        avatarUrl: true,
        tags: true,
        customFields: true,
        birthDate: true,
        instagramScopedId: true,
      },
    });

    let anonymized = 0;
    for (const c of contacts) {
      if (isContactAnonymized(c)) continue;
      const patch = computeContactAnonymization(c as ContactAnonymizationInput);
      await tx.contact.update({ where: { id: c.id }, data: patch });
      anonymized += 1;
    }

    return {
      contactsAnonymized: anonymized,
      conversationsSoftDeleted: softDeleted.count,
    };
  });
}

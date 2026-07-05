/**
 * DSR intake público (W2.6) — unifica a fila do admin.
 *
 * Contexto do bug: existiam DOIS sistemas DSR paralelos.
 *   1. Portal público (apps/web/app/api/dsr/request/route.ts) gravava em
 *      public.dsr_requests via Supabase REST.
 *   2. Admin (/dsr → GET /api/dsr, routes/dataSubjectRequests.ts) lê de
 *      data_subject_requests (Prisma).
 * Resultado: a solicitação do titular NUNCA aparecia na fila do admin.
 *
 * Fix: o portal público passa a gravar na MESMA fonte do admin
 * (data_subject_requests). Como o titular não é usuário autenticado e a org
 * dele pode não ser conhecida no portal, este módulo resolve a organização e
 * insere 1 linha com dueDate/SLA (15 dias — Art. 19), status PENDING.
 *
 * Resolução da org (primeira que casar vence):
 *   1. organizationSlug explícito no payload (quando o portal souber);
 *   2. env DSR_PLATFORM_ORG_SLUG (org "guarda-chuva" da ZappIQ p/ triagem do DPO);
 *   3. primeira Organization existente (garante que a linha sempre é criada).
 *
 * O DPO faz a triagem/roteamento depois — para end-users de Clientes ZappIQ a
 * responsabilidade primária é do Cliente controlador (ver /legal/deletar-dados).
 */
import { prisma } from '@zappiq/database';

// SLA legal (LGPD Art. 19).
export const DSR_DEADLINE_DAYS = 15;

// Tipos vindos do portal público (pt-BR) → enum Prisma DataSubjectRequestType.
export type PortalDsrTipo =
  | 'EXCLUSAO'
  | 'ACESSO'
  | 'CORRECAO'
  | 'ANONIMIZACAO'
  | 'PORTABILIDADE'
  | 'REVOGACAO_CONSENTIMENTO';

export type PrismaDsrType =
  | 'ACCESS'
  | 'CORRECTION'
  | 'ANONYMIZATION'
  | 'PORTABILITY'
  | 'DELETION'
  | 'CONSENT_REVOKE'
  | 'INFORMATION';

export type PortalDsrVinculo = 'CLIENTE' | 'EX_CLIENTE' | 'END_USER' | 'LEAD' | 'OUTRO';

const TIPO_MAP: Record<PortalDsrTipo, PrismaDsrType> = {
  EXCLUSAO: 'DELETION',
  ACESSO: 'ACCESS',
  CORRECAO: 'CORRECTION',
  ANONIMIZACAO: 'ANONYMIZATION',
  PORTABILIDADE: 'PORTABILITY',
  REVOGACAO_CONSENTIMENTO: 'CONSENT_REVOKE',
};

const TIPOS_VALIDOS = Object.keys(TIPO_MAP) as PortalDsrTipo[];
const VINCULOS_VALIDOS: PortalDsrVinculo[] = [
  'CLIENTE',
  'EX_CLIENTE',
  'END_USER',
  'LEAD',
  'OUTRO',
];

export interface PortalDsrPayload {
  tipo: PortalDsrTipo;
  nomeCompleto: string;
  email: string;
  documento: string;
  telefone?: string;
  vinculo: PortalDsrVinculo;
  detalhes?: string;
  confirmaIdentidade: boolean;
  /** Slug da org, quando o portal conseguir resolver (opcional). */
  organizationSlug?: string;
}

export function mapTipo(tipo: PortalDsrTipo): PrismaDsrType {
  return TIPO_MAP[tipo];
}

/**
 * Valida o payload do portal. Espelha a validação da rota web (route.ts) para
 * que a API não confie cegamente no cliente. Retorna o payload normalizado.
 */
export function validatePortalDsr(
  body: unknown,
): { ok: true; data: PortalDsrPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Payload inválido' };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.tipo !== 'string' || !TIPOS_VALIDOS.includes(b.tipo as PortalDsrTipo)) {
    return { ok: false, error: 'Tipo de solicitação inválido' };
  }
  if (
    typeof b.nomeCompleto !== 'string' ||
    b.nomeCompleto.trim().length < 3 ||
    b.nomeCompleto.length > 200
  ) {
    return { ok: false, error: 'Nome completo inválido' };
  }
  if (
    typeof b.email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) ||
    b.email.length > 200
  ) {
    return { ok: false, error: 'E-mail inválido' };
  }
  if (
    typeof b.documento !== 'string' ||
    b.documento.trim().length < 11 ||
    b.documento.length > 20
  ) {
    return { ok: false, error: 'Documento inválido (CPF ou CNPJ)' };
  }
  if (b.telefone !== undefined && (typeof b.telefone !== 'string' || b.telefone.length > 20)) {
    return { ok: false, error: 'Telefone inválido' };
  }
  if (typeof b.vinculo !== 'string' || !VINCULOS_VALIDOS.includes(b.vinculo as PortalDsrVinculo)) {
    return { ok: false, error: 'Vínculo inválido' };
  }
  if (b.detalhes !== undefined && (typeof b.detalhes !== 'string' || b.detalhes.length > 2000)) {
    return { ok: false, error: 'Detalhes excedem 2000 caracteres' };
  }
  if (
    b.organizationSlug !== undefined &&
    (typeof b.organizationSlug !== 'string' || b.organizationSlug.length > 200)
  ) {
    return { ok: false, error: 'organizationSlug inválido' };
  }
  if (b.confirmaIdentidade !== true) {
    return { ok: false, error: 'É necessário confirmar a declaração de identidade' };
  }

  return {
    ok: true,
    data: {
      tipo: b.tipo as PortalDsrTipo,
      nomeCompleto: (b.nomeCompleto as string).trim(),
      email: (b.email as string).trim().toLowerCase(),
      documento: (b.documento as string).replace(/\D/g, ''),
      telefone: (b.telefone as string | undefined)?.trim() || undefined,
      vinculo: b.vinculo as PortalDsrVinculo,
      detalhes: (b.detalhes as string | undefined)?.trim() || undefined,
      confirmaIdentidade: true,
      organizationSlug: (b.organizationSlug as string | undefined)?.trim() || undefined,
    },
  };
}

/**
 * Resolve a organização que vai receber a linha de DSR na fila do admin.
 * Ordem: slug explícito → DSR_PLATFORM_ORG_SLUG → primeira org existente.
 * Lança se não houver NENHUMA org (banco vazio) — nesse caso o portal cai no
 * fallback mailto e o erro é logado.
 */
export async function resolveDsrOrganizationId(slug?: string): Promise<string> {
  if (slug) {
    const bySlug = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (bySlug) return bySlug.id;
  }

  const platformSlug = process.env.DSR_PLATFORM_ORG_SLUG;
  if (platformSlug) {
    const platform = await prisma.organization.findUnique({
      where: { slug: platformSlug },
      select: { id: true },
    });
    if (platform) return platform.id;
  }

  const first = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (first) return first.id;

  throw new Error('Nenhuma organização disponível para registrar a solicitação DSR');
}

/**
 * Compõe o campo `reason` a partir do vínculo + detalhes do titular, para não
 * perder informação que não tem coluna própria no modelo data_subject_requests.
 */
export function buildReason(payload: PortalDsrPayload): string {
  const parts = [`Vínculo: ${payload.vinculo}`, `Documento: ${payload.documento}`];
  if (payload.telefone) parts.push(`Telefone: ${payload.telefone}`);
  if (payload.detalhes) parts.push(`Detalhes: ${payload.detalhes}`);
  return parts.join(' | ');
}

export interface DsrIntakeResult {
  id: string;
  protocol: string;
  dueDate: Date;
}

/**
 * Insere a solicitação do titular na MESMA tabela do admin
 * (data_subject_requests). Retorna id + protocolo curto + dueDate.
 */
export async function createPublicDsr(payload: PortalDsrPayload): Promise<DsrIntakeResult> {
  const organizationId = await resolveDsrOrganizationId(payload.organizationSlug);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + DSR_DEADLINE_DAYS);

  const created = await prisma.dataSubjectRequest.create({
    data: {
      type: mapTipo(payload.tipo),
      status: 'PENDING',
      requesterEmail: payload.email,
      requesterName: payload.nomeCompleto,
      reason: buildReason(payload),
      dueDate,
      organizationId,
    },
    select: { id: true, dueDate: true },
  });

  return {
    id: created.id,
    protocol: `DSR-${created.id.slice(-8).toUpperCase()}`,
    dueDate: created.dueDate,
  };
}

/*
 * asaasPix — "Pix na conversa" do Zap Impulso via PSP Asaas.
 *
 * MODELO (sem risco regulatório): o LOJISTA recebe no PRÓPRIO Pix. Cada org usa
 * a SUA chave de API do Asaas (guardada cifrada em org.settings). A ZappIQ só
 * orquestra a criação da cobrança e a mensagem — NÃO custodia o dinheiro, logo
 * não é instituição de pagamento. A liquidação cai na conta do lojista e o
 * webhook do Asaas confirma o pagamento (conciliação pelo externalReference).
 *
 * Nada aqui move dinheiro sem a chave Asaas configurada na org.
 */
import { env } from '../config/env.js';
import { decryptSecret } from '../utils/crypto.js';

// Base sandbox por padrão (seguro): produção só quando ASAAS_API_URL for setado.
const ASAAS_BASE = (env as any).ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';

/**
 * Config do Asaas por org, lida de organization.settings (pura, testável):
 *  - asaasApiKeyEnc: chave de API do Asaas do LOJISTA, cifrada (crypto.encryptSecret).
 *  - asaasWebhookToken: token que o Asaas envia no header do webhook (verificação).
 * Sem chave configurada, o Pix fica inerte (nada é cobrado).
 */
export function getAsaasConfigFromSettings(settings: unknown): { apiKey: string | null; webhookToken: string | null } {
  const s = (settings && typeof settings === 'object' ? settings : {}) as Record<string, unknown>;
  let apiKey: string | null = null;
  if (typeof s.asaasApiKeyEnc === 'string' && s.asaasApiKeyEnc) {
    try { apiKey = decryptSecret(s.asaasApiKeyEnc); } catch { apiKey = null; }
  }
  const webhookToken = typeof s.asaasWebhookToken === 'string' && s.asaasWebhookToken ? s.asaasWebhookToken : null;
  return { apiKey, webhookToken };
}

// ── Partes puras (testadas) ─────────────────────────────────

/** Pix é feature dos planos Pro e Scale (não do Start nem de alpha/trial). */
export function pixAllowedForTier(tier: string | null | undefined): boolean {
  return tier === 'IMPULSO_PRO' || tier === 'IMPULSO_SCALE';
}

const REF_PREFIX = 'impulso-pix';

/** externalReference que carrega org+deal, para o webhook reconciliar sem tabela nova. */
export function buildPixReference(orgId: string, dealId: string): string {
  return `${REF_PREFIX}:${orgId}:${dealId}`;
}
export function parsePixReference(ref: unknown): { orgId: string; dealId: string } | null {
  if (typeof ref !== 'string') return null;
  const parts = ref.split(':');
  if (parts.length !== 3 || parts[0] !== REF_PREFIX || !parts[1] || !parts[2]) return null;
  return { orgId: parts[1], dealId: parts[2] };
}

export interface PixChargeInput {
  customerId: string;
  value: number; // em reais
  description: string;
  referenceId: string;
  dueDate: string; // yyyy-mm-dd
}

/** Corpo da cobrança PIX no formato do Asaas (POST /v3/payments). */
export function buildAsaasPixPayload(input: PixChargeInput) {
  return {
    customer: input.customerId,
    billingType: 'PIX' as const,
    value: input.value,
    dueDate: input.dueDate,
    externalReference: input.referenceId,
    description: input.description,
  };
}

/** Extrai copia-e-cola + imagem + expiração do GET /v3/payments/{id}/pixQrCode. */
export function parseAsaasQrResponse(resp: unknown): { payload: string; qrImageBase64: string; expiresAt: string } | null {
  if (!resp || typeof resp !== 'object') return null;
  const r = resp as Record<string, unknown>;
  if (typeof r.payload !== 'string' || r.payload.length === 0) return null;
  return {
    payload: r.payload,
    qrImageBase64: typeof r.encodedImage === 'string' ? r.encodedImage : '',
    expiresAt: typeof r.expirationDate === 'string' ? r.expirationDate : '',
  };
}

export type PixOutcome = 'paid' | 'pending' | 'other';
/** Mapa dos eventos do webhook do Asaas para o nosso resultado. */
export function asaasEventToOutcome(event: string): PixOutcome {
  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') return 'paid';
  if (event === 'PAYMENT_CREATED' || event === 'PAYMENT_PENDING' || event === 'PAYMENT_AWAITING_RISK_ANALYSIS') return 'pending';
  return 'other';
}

/** Mensagem que a Iza envia na conversa com a cobrança Pix. */
export function formatPixMessage(input: { payload: string; value: number; description: string }): string {
  const brl = input.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return [
    `Segue o Pix de R$ ${brl}${input.description ? ` (${input.description})` : ''}.`,
    '',
    'Copie o código abaixo e pague no seu banco (Pix copia e cola):',
    input.payload,
  ].join('\n');
}

// ── Cliente HTTP do Asaas (integração; usa a chave da própria org) ──

async function asaasFetch(apiKey: string, path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', access_token: apiKey, ...(init?.headers || {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description || res.statusText;
    throw new Error(`Asaas ${path} falhou (${res.status}): ${msg}`);
  }
  return data;
}

/** Garante um cliente no Asaas (idempotente por externalReference do contato). */
export async function ensureAsaasCustomer(
  apiKey: string,
  input: { name: string; cpfCnpj?: string; phone?: string; externalReference: string },
): Promise<string> {
  const found = await asaasFetch(apiKey, `/customers?externalReference=${encodeURIComponent(input.externalReference)}`);
  if (found?.data?.[0]?.id) return found.data[0].id;
  const created = await asaasFetch(apiKey, '/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      ...(input.cpfCnpj ? { cpfCnpj: input.cpfCnpj } : {}),
      ...(input.phone ? { mobilePhone: input.phone } : {}),
      externalReference: input.externalReference,
    }),
  });
  return created.id;
}

/** Cria a cobrança PIX e retorna o QR dinâmico (copia-e-cola + imagem). */
export async function createPixCharge(
  apiKey: string,
  input: PixChargeInput,
): Promise<{ paymentId: string; payload: string; qrImageBase64: string; expiresAt: string }> {
  const payment = await asaasFetch(apiKey, '/payments', {
    method: 'POST',
    body: JSON.stringify(buildAsaasPixPayload(input)),
  });
  if (!payment?.id) throw new Error('Asaas: cobrança criada sem id');
  const qr = parseAsaasQrResponse(await asaasFetch(apiKey, `/payments/${payment.id}/pixQrCode`));
  if (!qr) throw new Error('Asaas: QR Pix não retornado');
  return { paymentId: payment.id, ...qr };
}

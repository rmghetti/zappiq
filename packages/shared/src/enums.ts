// ── Planos ─────────────────────────────────────
export enum PlanType {
  STARTER = 'STARTER',
  GROWTH = 'GROWTH',
  SCALE = 'SCALE',
}

// ── Usuários ───────────────────────────────────
export enum UserRole {
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  AGENT = 'AGENT',
  AUDITOR = 'AUDITOR',
}

// ── Conversas ──────────────────────────────────
export enum ConversationStatus {
  OPEN = 'OPEN',
  WAITING = 'WAITING',
  ASSIGNED = 'ASSIGNED',
  CLOSED = 'CLOSED',
}

// ── Mensagens ──────────────────────────────────
export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  TEMPLATE = 'TEMPLATE',
  INTERACTIVE = 'INTERACTIVE',
  LOCATION = 'LOCATION',
}

export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

// ── Leads ──────────────────────────────────────
export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  UNQUALIFIED = 'UNQUALIFIED',
  CONVERTED = 'CONVERTED',
}

// ── Campanhas ──────────────────────────────────
export enum CampaignType {
  BROADCAST = 'BROADCAST',
  TRIGGER = 'TRIGGER',
  SEQUENCE = 'SEQUENCE',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  SENDING = 'SENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// ── Fluxos ─────────────────────────────────────
export enum FlowTriggerType {
  KEYWORD = 'KEYWORD',
  FIRST_CONTACT = 'FIRST_CONTACT',
  SCHEDULE = 'SCHEDULE',
  MANUAL = 'MANUAL',
  EVENT = 'EVENT',
}

// ── Sentimento ─────────────────────────────────
export enum Sentiment {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
}

// ── Urgência ───────────────────────────────────
export enum Urgency {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

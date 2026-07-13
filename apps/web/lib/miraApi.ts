/**
 * Mira Prospects — tipos e client HTTP do módulo (front).
 * Fala com /api/mira-access (status/vitrine) e /api/mira/* (features).
 */
import { api } from './api';

// ── Tipos (espelham @zappiq/shared + rotas do backend) ──────────────
export type MiraTierKey = 'MIRA_ESSENCIAL' | 'MIRA_PRO' | 'MIRA_SCALE';

export interface MiraTierInfo {
  key: MiraTierKey;
  name: string;
  alvosPerMonth: number;
  priceMonthly: number;
  annualDiscountPercent: number;
  highlight?: boolean;
}

export interface MiraPackInfo {
  key: string;
  name: string;
  alvos: number;
  price: number;
}

export interface MiraQuota {
  tierQuota: number;
  packExtra: number;
  total: number;
  used: number;
  remaining: number;
  blocked: boolean;
}

export interface MiraAccessData {
  access: {
    entitled: boolean;
    reason: 'included' | 'addon' | 'none';
    tier: MiraTierKey | null;
    eligible: boolean;
    source: 'addon' | 'included' | 'alpha' | null;
  };
  quota: MiraQuota;
  monthKey: string;
  perfil: { prontidao: number; updatedAt: string } | null;
  catalog: {
    tiers: MiraTierInfo[];
    packs: MiraPackInfo[];
    includedByPlan: Record<string, MiraTierKey>;
  };
}

export interface MiraPerfil {
  id?: string;
  segmento: string | null;
  subsegmentos: string[];
  catalogo: { nome: string; descricao?: string; ticketMedio?: number | null }[];
  diferenciais: string[];
  concorrentes: string[];
  icpFirmografia: { cnaes: string[]; portes: string[]; regioes: string[]; faturamento?: string | null };
  icpB2c: { perfil?: string; regioes: string[]; gatilhos: string[] };
  areasCompradoras: string[];
  modo: 'B2B' | 'B2C';
  prontidao?: number;
}

export const EMPTY_PERFIL: MiraPerfil = {
  segmento: null,
  subsegmentos: [],
  catalogo: [],
  diferenciais: [],
  concorrentes: [],
  icpFirmografia: { cnaes: [], portes: [], regioes: [], faturamento: null },
  icpB2c: { perfil: '', regioes: [], gatilhos: [] },
  areasCompradoras: [],
  modo: 'B2B',
};

export interface MiraAlvoListItem {
  id: string;
  nome: string;
  nomeFantasia: string | null;
  kind: 'B2B' | 'B2C';
  motor: 'BASE_INSTALADA' | 'DESCOBERTA';
  status: 'DISCOVERED' | 'QUALIFYING' | 'READY' | 'DELIVERED' | 'ARCHIVED';
  cnpj: string | null;
  cnae: string | null;
  porte: string | null;
  municipio: string | null;
  uf: string | null;
  miraScore: number | null;
  confianca: number | null;
  resumo: string | null;
  janelaEntrada: { gatilho?: string; momento?: string; urgencia?: string } | null;
  contactId: string | null;
  dealId: string | null;
  updatedAt: string;
  _count: { decisores: number; demandas: number; releases: number };
}

export interface MiraDecisor {
  id: string;
  nome: string;
  papel: string;
  arquetipo: string | null;
  senioridade: string | null;
  isChampion: boolean;
  vinculoQsa: boolean;
  contato: { email?: string; phone?: string; whatsapp?: string } | null;
  perfilPublico: { temas?: string[]; estilo?: string | null; ganchos?: string[]; fontes?: string[] } | null;
  fonte: string | null;
  confianca: number;
  contactId: string | null;
}

export interface MiraAlvoDossie extends MiraAlvoListItem {
  situacaoCadastral: string | null;
  site: string | null;
  scoreBreakdown: { fatores: { nome: string; peso: number; valor: number; motivo: string }[] } | null;
  processoCompras: { modo?: string; cicloOrcamentario?: string; cadeiaAprovacao?: string } | null;
  whiteSpace: { jaCompra?: string[]; oportunidades?: string[] } | null;
  fontes: { campo: string; url: string; data?: string; confianca?: number }[];
  decisores: MiraDecisor[];
  demandas: { id: string; rank: number; descricao: string; evidencia?: string | null; fonte?: string | null; confianca: number }[];
  oportunidades: { id: string; rank: number; produto: string; demandaRank?: number | null; racional: string; roteiro?: any }[];
  incumbentes: { id: string; fornecedor: string; categoria?: string | null; evidencia?: string | null; deslocabilidade?: string | null }[];
  releases: MiraReleaseItem[];
}

export interface MiraReleaseItem {
  id: string;
  titulo: string;
  resumo: string;
  url: string | null;
  dataPublicacao: string | null;
  relevancia: string;
  anguloAbordagem: string | null;
  produtoRelacionado: string | null;
  confianca: number;
  lida: boolean;
  createdAt: string;
  alvo?: { id: string; nome: string; miraScore: number | null };
}

export interface MotorAResult {
  processados: number;
  criados: number;
  prontos: number;
  duplicados: string[];
  invalidos: string[];
  naoEncontrados: string[];
  inativos: string[];
  erros: string[];
  blocked: boolean;
  naoProcessados: string[];
  quota: { used: number; total: number; remaining: number };
}

// Cobre o resultado de descoberta B2C (Places) e B2B (busca pública): campos
// comuns + os específicos de cada trilha como opcionais.
export interface DescobrirResult {
  modo?: 'B2B' | 'B2C';
  fonte: string;
  encontrados: number;
  criados: number;
  prontos: number;
  duplicados: number;
  blocked: boolean;
  quota: { used: number; total: number; remaining: number };
  // Específicos da descoberta B2B pública:
  buscas?: number;
  cnpjsVerificados?: number;
  candidatos?: number;
}
export type MotorBResult = DescobrirResult;

export interface AprofundarResult {
  ok: boolean;
  oportunidades: number;
  roteiros: number;
  descartadosPeloVerificador: string[];
  motivo?: string;
}

export interface DecisoresPublicoResult {
  ok: boolean;
  buscas: number;
  candidatos: number;
  criados: number;
  enriquecidos: number;
  descartadosPeloVerificador: string[];
  motivo?: string;
}

export interface MiraAnalyticsData {
  period: { days: number; since: string };
  funil: {
    total: number;
    criadosNoPeriodo: number;
    byStatus: Record<string, number>;
    byMotor: Record<string, number>;
    byKind: Record<string, number>;
    scoreMedioProntos: number | null;
  };
  cota: {
    used: number; total: number; tierQuota: number; packExtra: number;
    remaining: number; blocked: boolean; tier: string | null; packsComprados: number; monthKey: string;
  };
  fontes: Array<{
    fonte: string; total: number; valido: number; naoEncontrado: number; erro: number;
    matchRatePct: number; latenciaMediaMs: number | null;
  }>;
  decisores: { total: number; qsa: number; pegadaPublica: number };
  releases: { totalNoPeriodo: number; naoLidos: number };
  conversao: { prontos: number; pousaramCrm: number; taxaCrmPct: number };
}

// ── Client ───────────────────────────────────────────────────────────
export const miraApi = {
  access: (): Promise<{ success: boolean; data: MiraAccessData }> => api.get('/api/mira-access'),
  // Assina uma faixa (recorrente) → devolve a URL do checkout do Stripe.
  checkout: (tier: MiraTierKey, cycle: 'monthly' | 'annual' = 'monthly'): Promise<{ success: boolean; url: string }> =>
    api.post('/api/mira-access/checkout', { tier, cycle }),
  // Compra um pack avulso (one-shot) quando a cota esgota.
  packCheckout: (pack: string): Promise<{ success: boolean; url: string }> =>
    api.post('/api/mira-access/pack/checkout', { pack }),
  getPerfil: (): Promise<{ success: boolean; data: MiraPerfil | null }> => api.get('/api/mira/perfil'),
  savePerfil: (perfil: MiraPerfil): Promise<{ success: boolean; data: MiraPerfil }> =>
    api.put('/api/mira/perfil', perfil),
  listAlvos: (params?: { status?: string; motor?: string; q?: string }): Promise<{
    success: boolean;
    data: { alvos: MiraAlvoListItem[]; quota: MiraQuota; monthKey: string };
  }> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.motor) qs.set('motor', params.motor);
    if (params?.q) qs.set('q', params.q);
    const s = qs.toString();
    return api.get(`/api/mira/alvos${s ? `?${s}` : ''}`);
  },
  getAlvo: (id: string): Promise<{ success: boolean; data: MiraAlvoDossie }> => api.get(`/api/mira/alvos/${id}`),
  listReleases: (unreadOnly = false): Promise<{ success: boolean; data: MiraReleaseItem[] }> =>
    api.get(`/api/mira/releases${unreadOnly ? '?unread=1' : ''}`),
  markReleaseLida: (id: string): Promise<{ success: boolean }> => api.post(`/api/mira/releases/${id}/lida`, {}),
  runMotorA: (cnpjs: string[]): Promise<{ success: boolean; data: MotorAResult }> =>
    api.post('/api/mira/motor-a/run', { cnpjs }),
  crmCandidates: (): Promise<{ success: boolean; data: { total: number; cnpjs: string[] } }> =>
    api.get('/api/mira/motor-a/crm-candidates'),
  pousarCrm: (alvoId: string): Promise<{ success: boolean; data: { contactId: string; dealId: string; reused: boolean } }> =>
    api.post(`/api/mira/alvos/${alvoId}/crm`, {}),
  arquivarAlvo: (alvoId: string): Promise<{ success: boolean }> => api.post(`/api/mira/alvos/${alvoId}/arquivar`, {}),
  motorBStatus: (): Promise<{
    success: boolean;
    data: {
      places: boolean;
      buscaPublica: boolean;
      provider: string | null;
      cnpjIndexDisponivel: boolean;
      cnpjIndexTotal: number;
      bigquery?: boolean;
    };
  }> => api.get('/api/mira/motor-b/status'),
  descobrir: (
    consulta: string,
    regiao?: string,
    kind?: 'B2B' | 'B2C'
  ): Promise<{ success: boolean; data: MotorBResult }> =>
    api.post('/api/mira/motor-b/descobrir', { consulta, regiao: regiao || null, ...(kind ? { kind } : {}) }),
  aprofundarAlvo: (alvoId: string): Promise<{ success: boolean; data: AprofundarResult }> =>
    api.post(`/api/mira/alvos/${alvoId}/aprofundar`, {}),
  decisoresPublico: (alvoId: string): Promise<{ success: boolean; data: DecisoresPublicoResult }> =>
    api.post(`/api/mira/alvos/${alvoId}/decisores-publico`, {}),
  analytics: (period = 30): Promise<{ success: boolean; data: MiraAnalyticsData }> =>
    api.get(`/api/mira/analytics?period=${period}`),
};

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

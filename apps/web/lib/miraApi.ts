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
    source: 'addon' | 'included' | 'alpha' | 'trial' | null;
    /** Pode ativar o teste grátis agora (nunca ativou e não tem faixa/inclusão). */
    trialAvailable: boolean;
  };
  quota: MiraQuota;
  monthKey: string;
  perfil: { prontidao: number; updatedAt: string } | null;
  catalog: {
    tiers: MiraTierInfo[];
    packs: MiraPackInfo[];
    includedByPlan: Record<string, MiraTierKey>;
    trialAlvos: number;
  };
}

// ── Perfil de Prospecção ─────────────────────────────────────────────
export type TipoCliente = 'B2B' | 'B2C';
export type CicloVenda = 'CURTO' | 'MEDIO' | 'LONGO';
export type Genero = 'TODOS' | 'MASCULINO' | 'FEMININO';

export interface CatalogoItem {
  nome: string;
  descricao?: string;
}

/** Alvo B2B: firmografia, technographics, intenção e comitê de compra. */
export interface AlvoB2B {
  cnaesAlvo: string[];
  portes: string[];
  regioes: string[];
  faturamentoAnual: string | null;
  numFuncionarios: string | null;
  technographics: string[];
  sinaisIntencao: string[];
  decisor: string[];
  influenciadores: string[];
  usuarioFinal: string[];
  objecoes: string;
  cicloVenda: CicloVenda | null;
  redFlagsB2B: string[];
  mustHavesB2B: string[];
  clientesReferencia: string[];
}

/** Alvo B2C: demografia, momento de vida e capacidade de pagamento. */
export interface AlvoB2C {
  /** Que negócio local prospectar (par do cnaesAlvo do B2B). */
  tiposNegocioAlvo: string[];
  faixaEtaria: string | null;
  genero: Genero | null;
  faixaRenda: string | null;
  ocupacao: string[];
  composicaoFamiliar: string[];
  regiaoCidade: string[];
  tipoRegiao: string[];
  interesses: string[];
  canais: string[];
  habitosConsumo: string[];
  momentoDeVida: string[];
  doresDesejos: string[];
  capacidadePagamento: string | null;
  redFlagsB2C: string[];
  influenciadoresB2C: string[];
}

/**
 * "tipoCliente" discrimina qual alvo vale, mas os dois ficam guardados: o
 * cliente alterna entre B2B e B2C sem perder o que digitou. Para ler o que
 * vale, use alvoAtivo() — assim o TypeScript impede de ler campo de B2C num
 * perfil B2B.
 */
export interface MiraPerfil {
  id?: string;
  tipoCliente: TipoCliente;
  // Seu negócio
  segmento: string | null;
  subsegmentos: string[];
  // Comum aos dois caminhos
  catalogo: CatalogoItem[];
  doresResolvidas: string[];
  resultadosEsperados: string[];
  casosDeUso: string[];
  diferenciais: string[];
  concorrentes: string[];
  ticketMedio: string | null;
  // Alvo (condicional)
  alvoB2B: AlvoB2B;
  alvoB2C: AlvoB2C;
  prontidao?: number;
}

export type AlvoAtivo = { tipoCliente: 'B2B'; alvo: AlvoB2B } | { tipoCliente: 'B2C'; alvo: AlvoB2C };

export function alvoAtivo(p: MiraPerfil): AlvoAtivo {
  return p.tipoCliente === 'B2B'
    ? { tipoCliente: 'B2B', alvo: p.alvoB2B }
    : { tipoCliente: 'B2C', alvo: p.alvoB2C };
}

export const EMPTY_ALVO_B2B: AlvoB2B = {
  cnaesAlvo: [],
  portes: [],
  regioes: [],
  faturamentoAnual: null,
  numFuncionarios: null,
  technographics: [],
  sinaisIntencao: [],
  decisor: [],
  influenciadores: [],
  usuarioFinal: [],
  objecoes: '',
  cicloVenda: null,
  redFlagsB2B: [],
  mustHavesB2B: [],
  clientesReferencia: [],
};

export const EMPTY_ALVO_B2C: AlvoB2C = {
  tiposNegocioAlvo: [],
  faixaEtaria: null,
  genero: null,
  faixaRenda: null,
  ocupacao: [],
  composicaoFamiliar: [],
  regiaoCidade: [],
  tipoRegiao: [],
  interesses: [],
  canais: [],
  habitosConsumo: [],
  momentoDeVida: [],
  doresDesejos: [],
  capacidadePagamento: null,
  redFlagsB2C: [],
  influenciadoresB2C: [],
};

export const EMPTY_PERFIL: MiraPerfil = {
  tipoCliente: 'B2B',
  segmento: null,
  subsegmentos: [],
  catalogo: [],
  doresResolvidas: [],
  resultadosEsperados: [],
  casosDeUso: [],
  diferenciais: [],
  concorrentes: [],
  ticketMedio: null,
  alvoB2B: EMPTY_ALVO_B2B,
  alvoB2C: EMPTY_ALVO_B2C,
};

/**
 * Rascunho vindo do que a org já declarou no cadastro e no Treinar IA.
 * Cobre só o negócio e o catálogo — os campos de alvo são sempre manuais,
 * porque "quem eu atendo hoje" não é "quem eu quero prospectar".
 */
export interface SugestaoPerfil {
  segmento: string | null;
  subsegmentos: string[];
  catalogo: CatalogoItem[];
  doresResolvidas: string[];
  resultadosEsperados: string[];
  casosDeUso: string[];
  diferenciais: string[];
  concorrentes: string[];
  ticketMedio: string | null;
  /** {campo: 'cadastro' | 'treinamento'} */
  origem: Record<string, string>;
  totalCampos: number;
}

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
  /** Próximo passo sugerido pela IA. Vira Task pendente em /tasks. */
  planoAcao: string | null;
  planoAcaoTaskId: string | null;
  /**
   * Por que este Alvo não tem plano de ação, em português, ou null se tem.
   * Calculado pela API (mesma função do motor) para o front não duplicar a regra.
   */
  planoBloqueadoPor?: string | null;
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
  /** Data em que o fato foi PUBLICADO (só quando a fonte a mostra). */
  dataPublicacao: string | null;
  relevancia: string;
  anguloAbordagem: string | null;
  produtoRelacionado: string | null;
  confianca: number;
  lida: boolean;
  createdAt: string;
  /** A demanda que esta matéria evidenciou (dossiê do Alvo). */
  demandaId?: string | null;
  demanda?: { id: string; descricao: string; rank: number } | null;
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
  /** Campanha de prospecção que este disparo virou. */
  campanhaId?: string;
  campanhaNome?: string;
}

// ── Campanhas de prospecção ─────────────────────────────────────────
// Cada disparo dos motores vira uma campanha nomeada, com gestão no hub.
// Não confundir com as Campanhas do Zap Impulso (disparo de mensagens).
export type MiraCampanhaTipo = 'BASE_INSTALADA' | 'DESCOBERTA';

/**
 * O que o wizard mostra já preenchido, vindo do Perfil de Prospecção. O
 * cliente tira ou soma antes de disparar; o que ficar na tela é o que roda.
 */
export interface SementeDaBusca {
  alvos: string[];
  regioes: string[];
  origem: 'perfil' | 'vazio';
}

export interface MiraCampanha {
  id: string;
  nome: string;
  tipo: MiraCampanhaTipo;
  status: 'EM_ANDAMENTO' | 'CONCLUIDA' | 'FALHOU';
  parametros: { consulta?: string; regiao?: string | null; kind?: 'B2B' | 'B2C'; cnpjs?: number };
  resultado: {
    encontrados?: number;
    criados?: number;
    prontos?: number;
    duplicados?: number | string[];
    regiaoAplicada?: string | null;
    regiaoOrigem?: 'campanha' | null;
    motivo?: string;
  };
  alvosCount: number;
  prontosCount: number;
  createdAt: string;
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
  /** Região que a busca de fato usou (vem da campanha, semeada do Perfil). */
  regiaoAplicada?: string | null;
  regiaoOrigem?: 'campanha' | null;
  /** Campanha de prospecção que este disparo virou. */
  campanhaId?: string;
  campanhaNome?: string;
  // Específicos da descoberta B2B pública:
  buscas?: number;
  cnpjsVerificados?: number;
  /** Sempre 0 desde 15/07/2026: o "candidato" de só nome deixou de existir. */
  candidatos?: number;
  /**
   * Verificadas na Receita que NÃO subiram por não ter decisor nenhum. Sem
   * mostrar isto, a campanha exibiria 3 onde antes exibia 14 e pareceria que
   * o Mira parou de achar.
   */
  descartadosCrus?: number;
  /** Apareceram na busca só com o nome (CNPJ não resolvido). */
  descartadosSoNome?: number;
}
export type MotorBResult = DescobrirResult;

export interface AprofundarResult {
  ok: boolean;
  oportunidades: number;
  roteiros: number;
  descartadosPeloVerificador: string[];
  /** Critérios de corte do Perfil que o analista confirmou nos dados. */
  alertasCorte?: string[];
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
  /** Camada 4: busca de CONTATO por nome, em decisores já mapeados. */
  buscasContato?: number;
  contatosEnriquecidos?: number;
  avisos?: string[];
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
  // Ativa o teste grátis (sem cartão, sem Stripe) — uma vez por conta.
  activateTrial: (): Promise<{ success: boolean; data: MiraAccessData }> =>
    api.post('/api/mira-access/trial/activate', {}),
  // Assina uma faixa (recorrente) → devolve a URL do checkout do Stripe.
  checkout: (tier: MiraTierKey, cycle: 'monthly' | 'annual' = 'monthly'): Promise<{ success: boolean; url: string }> =>
    api.post('/api/mira-access/checkout', { tier, cycle }),
  // Compra um pack avulso (one-shot) quando a cota esgota.
  packCheckout: (pack: string): Promise<{ success: boolean; url: string }> =>
    api.post('/api/mira-access/pack/checkout', { pack }),
  getPerfil: (): Promise<{ success: boolean; data: MiraPerfil | null }> => api.get('/api/mira/perfil'),
  savePerfil: (perfil: MiraPerfil): Promise<{ success: boolean; data: MiraPerfil }> =>
    api.put('/api/mira/perfil', perfil),
  // Rascunho a partir do cadastro + Treinar IA. Não persiste nada: quem salva
  // é o savePerfil, depois de o cliente revisar.
  sugerirPerfil: (): Promise<{ success: boolean; data: SugestaoPerfil }> =>
    api.post('/api/mira/perfil/sugestao', {}),
  listAlvos: (params?: { status?: string; motor?: string; q?: string; campanhaId?: string }): Promise<{
    success: boolean;
    data: {
      alvos: MiraAlvoListItem[];
      quota: MiraQuota;
      monthKey: string;
      /** 'trial' = teste grátis (sem faixa → não pode comprar pacote avulso). */
      source: 'addon' | 'included' | 'alpha' | 'trial' | null;
    };
  }> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.motor) qs.set('motor', params.motor);
    if (params?.q) qs.set('q', params.q);
    if (params?.campanhaId) qs.set('campanhaId', params.campanhaId);
    const s = qs.toString();
    return api.get(`/api/mira/alvos${s ? `?${s}` : ''}`);
  },
  // Gestão das campanhas de prospecção (hub).
  listCampanhas: (): Promise<{ success: boolean; data: MiraCampanha[] }> => api.get('/api/mira/campanhas'),
  // O que o wizard mostra já preenchido: alvos e regiões vindos do Perfil.
  sementeCampanha: (kind: 'B2B' | 'B2C'): Promise<{ success: boolean; data: SementeDaBusca }> =>
    api.get(`/api/mira/campanhas/semente?kind=${kind}`),
  getAlvo: (id: string): Promise<{ success: boolean; data: MiraAlvoDossie }> => api.get(`/api/mira/alvos/${id}`),
  listReleases: (unreadOnly = false): Promise<{ success: boolean; data: MiraReleaseItem[] }> =>
    api.get(`/api/mira/releases${unreadOnly ? '?unread=1' : ''}`),
  markReleaseLida: (id: string): Promise<{ success: boolean }> => api.post(`/api/mira/releases/${id}/lida`, {}),
  runMotorA: (cnpjs: string[], nome?: string): Promise<{ success: boolean; data: MotorAResult }> =>
    api.post('/api/mira/motor-a/run', { cnpjs, ...(nome?.trim() ? { nome: nome.trim() } : {}) }),
  crmCandidates: (): Promise<{ success: boolean; data: { total: number; cnpjs: string[] } }> =>
    api.get('/api/mira/motor-a/crm-candidates'),
  /**
   * `forcar` = "enviar assim mesmo" um Alvo que não passou na verificação.
   * Ele entra no CRM marcado como não qualificado (leadStatus UNQUALIFIED,
   * aviso no título do Deal e uma Activity dizendo o que falta).
   */
  pousarCrm: (
    alvoId: string,
    forcar = false
  ): Promise<{
    success: boolean;
    data: {
      contactId: string;
      dealId: string;
      reused: boolean;
      naoQualificado: boolean;
      motivoNaoQualificado?: string;
      decisoresNoCrm: number;
    };
  }> => api.post(`/api/mira/alvos/${alvoId}/crm`, { forcar }),
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
    alvos: string[],
    regioes: string[],
    kind?: 'B2B' | 'B2C',
    nome?: string
  ): Promise<{ success: boolean; data: MotorBResult }> =>
    api.post('/api/mira/motor-b/descobrir', {
      alvos,
      regioes,
      ...(kind ? { kind } : {}),
      ...(nome?.trim() ? { nome: nome.trim() } : {}),
    }),
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

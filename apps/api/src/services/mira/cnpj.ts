/**
 * Mira Prospects — enriquecimento por CNPJ (fonte oficial/pública).
 *
 * Provedor: BrasilAPI (dados abertos da Receita Federal, sem chave).
 * É o "primeiro degrau gratuito" da cascata de enriquecimento: firmografia
 * e quadro societário (QSA) nascem de registro público, com confiança alta
 * e custo zero. Provedores licenciados entram como degraus pagos depois.
 *
 * Todo lookup é logado em mira_enriquecimento_log (telemetria de match
 * rate/custo por fonte, doc 08). Timeout curto: enriquecimento não pode
 * travar o pipeline.
 */
import { prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';

const BRASILAPI_CNPJ = 'https://brasilapi.com.br/api/cnpj/v1';
const TIMEOUT_MS = 12_000;

export interface CnpjSocio {
  nome: string;
  qualificacao: string;
}

export interface CnpjData {
  cnpj: string; // só dígitos
  razaoSocial: string;
  nomeFantasia: string | null;
  cnae: string | null; // código
  cnaeDescricao: string | null;
  porte: string | null;
  capitalSocial: number | null; // capital social declarado (R$), sinal de porte real por empresa
  naturezaJuridica: string | null;
  situacaoCadastral: string | null; // ATIVA | BAIXADA | ...
  municipio: string | null;
  uf: string | null;
  telefone: string | null;
  dataInicioAtividade: string | null; // ISO date
  optanteSimples: boolean | null;
  qsa: CnpjSocio[];
  fonteUrl: string;
}

export function normalizeCnpj(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.length === 14 ? digits : null;
}

async function logLookup(
  organizationId: string,
  alvoId: string | null,
  resultado: 'valido' | 'nao_encontrado' | 'erro',
  latenciaMs: number
): Promise<void> {
  try {
    await (prisma as any).miraEnriquecimentoLog.create({
      data: { organizationId, alvoId, fonte: 'cnpj_brasilapi', tipo: 'firmografia', resultado, custoCreditos: 0, latenciaMs },
    });
  } catch {
    /* telemetria nunca derruba o pipeline */
  }
}

/**
 * Busca a firmografia + QSA de um CNPJ na fonte pública.
 * Retorna null quando não encontrado (CNPJ inexistente) e lança em erro
 * de rede/timeout (o chamador decide re-tentar).
 */
export async function fetchCnpj(organizationId: string, cnpjRaw: string): Promise<CnpjData | null> {
  const cnpj = normalizeCnpj(cnpjRaw);
  if (!cnpj) return null;
  const url = `${BRASILAPI_CNPJ}/${cnpj}`;
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    const latencia = Date.now() - t0;
    if (res.status === 404 || res.status === 400) {
      await logLookup(organizationId, null, 'nao_encontrado', latencia);
      return null;
    }
    if (!res.ok) {
      await logLookup(organizationId, null, 'erro', latencia);
      throw new Error(`brasilapi_status_${res.status}`);
    }
    const d: any = await res.json();
    await logLookup(organizationId, null, 'valido', latencia);
    const qsa: CnpjSocio[] = Array.isArray(d.qsa)
      ? d.qsa
          .map((s: any) => ({
            nome: String(s.nome_socio ?? '').trim(),
            qualificacao: String(s.qualificacao_socio ?? 'Sócio').trim(),
          }))
          .filter((s: CnpjSocio) => s.nome.length > 1)
          .slice(0, 10)
      : [];
    return {
      cnpj,
      razaoSocial: String(d.razao_social ?? '').trim(),
      nomeFantasia: d.nome_fantasia ? String(d.nome_fantasia).trim() : null,
      cnae: d.cnae_fiscal ? String(d.cnae_fiscal) : null,
      cnaeDescricao: d.cnae_fiscal_descricao ? String(d.cnae_fiscal_descricao) : null,
      porte: d.porte ? String(d.porte) : null,
      capitalSocial: Number.isFinite(Number(d.capital_social)) ? Number(d.capital_social) : null,
      naturezaJuridica: d.natureza_juridica ? String(d.natureza_juridica) : null,
      situacaoCadastral: d.descricao_situacao_cadastral ? String(d.descricao_situacao_cadastral) : null,
      municipio: d.municipio ? String(d.municipio) : null,
      uf: d.uf ? String(d.uf) : null,
      telefone: d.ddd_telefone_1 ? String(d.ddd_telefone_1).replace(/\D/g, '') : null,
      dataInicioAtividade: d.data_inicio_atividade ? String(d.data_inicio_atividade) : null,
      optanteSimples: typeof d.opcao_pelo_simples === 'boolean' ? d.opcao_pelo_simples : null,
      qsa,
      fonteUrl: url,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      await logLookup(organizationId, null, 'erro', Date.now() - t0);
      logger.warn(`[Mira] timeout BrasilAPI cnpj=${cnpj}`);
      throw new Error('brasilapi_timeout');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Papel de compra provável a partir da qualificação societária (registro público). */
export function arquetipoFromQualificacao(qualificacao: string): string | null {
  const q = qualificacao.toLowerCase();
  if (q.includes('administrador') || q.includes('presidente') || q.includes('diretor')) return 'ECONOMIC_BUYER';
  if (q.includes('sócio') || q.includes('socio') || q.includes('titular')) return 'EXEC_SPONSOR';
  return null;
}

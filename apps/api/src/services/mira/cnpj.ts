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

/**
 * Naturezas jurídicas em que a empresa NÃO TEM SÓCIO por definição legal: o
 * titular é uma pessoa física e a razão social é o nome dela.
 *
 * Códigos e definições conferidos no diretório oficial
 * (`basedosdados.br_bd_diretorios_brasil.natureza_juridica`) em 15/07/2026.
 * A definição de 2135 é explícita: "o empresário pessoa física que exerce
 * profissionalmente atividade econômica (...) sem se constituir pessoa
 * jurídica e SEM A PARTICIPAÇÃO DE QUALQUER SÓCIO".
 */
const NATUREZAS_SEM_SOCIO: Record<string, string> = {
  '2135': 'Empresário Individual',
  '2305': 'Titular de EIRELI',
  '2313': 'Titular de EIRELI',
  '4014': 'Titular de Empresa Individual Imobiliária',
};

const normNome = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * O titular de um Empresário Individual, lido do próprio registro.
 *
 * Por que existe: em 15/07/2026, 11 dos 20 Alvos em produção estavam SEM
 * DECISOR, e 8 deles eram Empresário Individual. O sistema esperava um quadro
 * societário que a lei proíbe de existir, desistia, e entregava um Alvo cru
 * com score 13. O decisor sempre esteve no campo `nome`.
 *
 * Isto não é heurística nem chute: é ler o registro corretamente. Na EI a
 * pessoa É a empresa, então a razão social é o nome civil do titular.
 *
 * O sufixo de município é removido quando presente: é praxe na EI ("RICARDO
 * ALEXANDRE M. CHIRIGATTI AGUAI" em Aguaí, "GISLAINE (...) BERSAN ARARAS" em
 * Araras). Só corta quando bate exatamente com o município do registro, então
 * na dúvida o nome fica inteiro, que é o erro barato.
 */
export function titularDoRegistro(dados: {
  naturezaJuridica: string | null;
  razaoSocial: string;
  municipio?: string | null;
  qsa: CnpjSocio[];
}): CnpjSocio | null {
  // Só quando não há sócio: se o QSA veio preenchido, ele manda.
  if (dados.qsa.length > 0) return null;
  const cod = String(dados.naturezaJuridica ?? '').replace(/\D/g, '');
  const papel = NATUREZAS_SEM_SOCIO[cod];
  if (!papel) return null;

  let nome = (dados.razaoSocial || '').trim();
  if (nome.length < 5) return null;

  const mun = normNome(dados.municipio ?? '');
  // Razão social que é SÓ o nome da cidade não é o nome de ninguém. Devolver
  // "ARARAS" como decisor seria pior que devolver nada: o vendedor liga
  // perguntando pelo Sr. Araras.
  if (mun.length >= 4 && normNome(nome) === mun) return null;
  if (mun.length >= 4) {
    const tokens = nome.split(/\s+/);
    const ultimos = tokens.slice(-mun.split(' ').length).join(' ');
    if (normNome(ultimos) === mun && tokens.length > mun.split(' ').length + 1) {
      nome = tokens.slice(0, tokens.length - mun.split(' ').length).join(' ').trim();
    }
  }
  if (nome.length < 5) return null;
  return { nome, qualificacao: papel };
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
    await prisma.miraEnriquecimentoLog.create({
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
/**
 * Tabela oficial de Qualificação do Sócio/Administrador da Receita (Tabela III
 * do programa CNPJ). O espelho do BigQuery (base do BD Pro) guarda o CÓDIGO,
 * não o texto: sem traduzir, o comitê mostrava "22" no lugar de "Sócio" e o
 * arquétipo/coroa não saíam para nenhum decisor do QSA vindo da descoberta.
 * A BrasilAPI já devolve o texto; por isso a tradução só age em código puro.
 */
const QUALIFICACAO_SOCIO: Record<string, string> = {
  '05': 'Administrador', '08': 'Conselheiro de Administração', '09': 'Curador',
  '10': 'Diretor', '11': 'Interventor', '12': 'Inventariante', '13': 'Liquidante',
  '14': 'Mãe', '15': 'Pai', '16': 'Presidente', '17': 'Procurador',
  '19': 'Síndico (Condomínio)', '20': 'Sociedade Consorciada', '21': 'Sociedade Filiada',
  '22': 'Sócio', '23': 'Sócio Capitalista', '24': 'Sócio Comanditado',
  '25': 'Sócio Comanditário', '26': 'Sócio de Indústria', '28': 'Sócio-Gerente',
  '29': 'Sócio ou Acionista Incapaz ou Relativamente Incapaz (exceto menor)',
  '30': 'Sócio ou Acionista Menor (Assistido/Representado)', '31': 'Sócio Ostensivo',
  '32': 'Tabelião', '34': 'Titular de Empresa Individual Imobiliária', '35': 'Tutor',
  '37': 'Sócio Pessoa Jurídica Domiciliado no Exterior',
  '38': 'Sócio Pessoa Física Residente ou Domiciliado no Exterior',
  '39': 'Diplomata', '40': 'Cônsul', '41': 'Representante de Organização Internacional',
  '42': 'Oficial de Registro', '43': 'Responsável', '46': 'Ministro de Estado das Relações Exteriores',
  '47': 'Sócio Pessoa Física Residente no Brasil', '48': 'Sócio Pessoa Jurídica Domiciliado no Brasil',
  '49': 'Sócio-Administrador', '50': 'Empresário', '51': 'Candidato a Cargo Político Eletivo',
  '52': 'Sócio com Capital', '53': 'Sócio sem Capital', '54': 'Fundador',
  '55': 'Sócio Comanditado Residente no Exterior',
  '56': 'Sócio Comanditário Pessoa Física Residente no Exterior',
  '57': 'Sócio Comanditário Pessoa Jurídica Domiciliado no Exterior',
  '58': 'Sócio Comanditário Incapaz', '59': 'Produtor Rural', '60': 'Cônsul Honorário',
  '61': 'Responsável Indígena', '62': 'Representante das Instituições Extraterritoriais',
  '63': 'Cotas em Tesouraria', '64': 'Administrador Judicial',
  '65': 'Titular Pessoa Física Residente ou Domiciliado no Brasil',
  '66': 'Titular Pessoa Física Residente ou Domiciliado no Exterior',
  '67': 'Titular Pessoa Física Incapaz ou Relativamente Incapaz (exceto menor)',
  '68': 'Titular Pessoa Física Menor (Assistido/Representado)',
  '70': 'Administrador Residente ou Domiciliado no Exterior',
  '71': 'Conselheiro de Administração Residente ou Domiciliado no Exterior',
  '72': 'Diretor Residente ou Domiciliado no Exterior',
  '73': 'Presidente Residente ou Domiciliado no Exterior',
  '74': 'Sócio-Administrador Residente ou Domiciliado no Exterior',
  '75': 'Fundador Residente ou Domiciliado no Exterior',
  '78': 'Titular Pessoa Jurídica Domiciliada no Brasil',
  '79': 'Titular Pessoa Jurídica Domiciliada no Exterior',
};

/**
 * Devolve a descrição legível da qualificação. Código puro da Receita vira
 * texto oficial; texto (BrasilAPI, titular de EI) passa direto; desconhecido
 * passa direto (nunca esconde o dado).
 */
export function descricaoQualificacao(raw?: string | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (/^\d{1,2}$/.test(s)) return QUALIFICACAO_SOCIO[s.padStart(2, '0')] ?? s;
  return s;
}

export function arquetipoFromQualificacao(qualificacao: string): string | null {
  // Traduz o código antes de classificar: 'administrador'/'presidente' etc. só
  // aparecem no TEXTO, e o espelho manda o número.
  const q = descricaoQualificacao(qualificacao).toLowerCase();
  if (q.includes('administrador') || q.includes('presidente') || q.includes('diretor')) return 'ECONOMIC_BUYER';
  if (
    q.includes('sócio') || q.includes('socio') || q.includes('titular') ||
    q.includes('empresário') || q.includes('empresario') || q.includes('fundador')
  ) {
    return 'EXEC_SPONSOR';
  }
  return null;
}

/**
 * O decisor merece a coroa de "provável champion"? Marca quem tem poder de
 * decisão/compra (sponsor executivo, comprador econômico, champion), não o
 * usuário técnico nem o jurídico. Antes o backend NUNCA escrevia isChampion, e
 * a coroa da UI (dossiê do Alvo) jamais aparecia.
 */
export function isChampionArquetipo(arquetipo?: string | null): boolean {
  return arquetipo === 'EXEC_SPONSOR' || arquetipo === 'ECONOMIC_BUYER' || arquetipo === 'CHAMPION';
}

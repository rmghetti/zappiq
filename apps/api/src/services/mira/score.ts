/**
 * Mira Prospects — Mira Score v1 (explicável, honesto).
 *
 * Cinco fatores com peso fixo (doc 05): fit de ICP 25, demanda/sinais 25,
 * cobertura de decisores 20, encaixe de portfólio 15, janela/incumbente 15.
 * Nesta fase (Motor A determinístico) os fatores que dependem dos agentes
 * de pesquisa (demandas profundas, incumbente, janela) pontuam pelo que já
 * é observável e DIZEM no motivo o que ainda não foi mapeado. Nunca uma
 * nota opaca; nunca pontos por dado que não existe.
 *
 * Confiança (0-100) é COMPLETUDE/verificação, separada da prioridade:
 * firmografia de registro público (Receita) nasce alta.
 */
import type { CnpjData } from './cnpj.js';

export interface ScoreFator {
  nome: string;
  peso: number;
  valor: number;
  motivo: string;
}

export interface MiraScoreResult {
  score: number;
  breakdown: { fatores: ScoreFator[] };
  confianca: number;
}

interface PerfilLike {
  segmento?: string | null;
  catalogo?: { nome: string; descricao?: string }[];
  icpFirmografia?: { cnaes?: string[]; portes?: string[]; regioes?: string[] };
  areasCompradoras?: string[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function matchCnae(perfil: PerfilLike, alvo: CnpjData): { hit: boolean; parcial: boolean } {
  const alvoCnae = (alvo.cnae ?? '').replace(/\D/g, '');
  const alvoDesc = norm(alvo.cnaeDescricao ?? '');
  const wants = perfil.icpFirmografia?.cnaes ?? [];
  if (wants.length === 0) return { hit: false, parcial: false };
  for (const w of wants) {
    const digits = w.replace(/\D/g, '');
    if (digits.length >= 2 && alvoCnae.startsWith(digits.slice(0, Math.min(5, digits.length)))) {
      return { hit: true, parcial: false };
    }
    // Descrição textual ("distribuidoras de TI") — match parcial por termo
    const words = norm(w)
      .split(/\s+/)
      .filter((x) => x.length > 3);
    if (words.length && words.some((x) => alvoDesc.includes(x))) return { hit: false, parcial: true };
  }
  return { hit: false, parcial: false };
}

function matchRegiao(perfil: PerfilLike, alvo: CnpjData): boolean {
  const regioes = perfil.icpFirmografia?.regioes ?? [];
  if (regioes.length === 0) return false;
  const alvoUf = norm(alvo.uf ?? '');
  const alvoMun = norm(alvo.municipio ?? '');
  return regioes.some((r) => {
    const n = norm(r);
    return (alvoUf && n.includes(alvoUf)) || (alvoMun && (n.includes(alvoMun) || alvoMun.includes(n)));
  });
}

function matchPorte(perfil: PerfilLike, alvo: CnpjData): boolean {
  const portes = perfil.icpFirmografia?.portes ?? [];
  if (portes.length === 0 || !alvo.porte) return false;
  const alvoP = norm(alvo.porte);
  return portes.some((p) => {
    const n = norm(p);
    return alvoP.includes(n) || n.includes(alvoP) || (n === 'me' && alvoP.includes('micro')) || (n === 'epp' && alvoP.includes('pequeno'));
  });
}

/** Meses desde uma data ISO (aprox.). */
function monthsSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (30 * 24 * 3600 * 1000));
}

export function computeMiraScoreV1(perfil: PerfilLike, alvo: CnpjData, decisoresCount: number): MiraScoreResult {
  const fatores: ScoreFator[] = [];

  // 1) Fit de ICP (25)
  {
    let v = 0;
    const motivos: string[] = [];
    const cnae = matchCnae(perfil, alvo);
    if (cnae.hit) {
      v += 13;
      motivos.push('CNAE bate com o ICP');
    } else if (cnae.parcial) {
      v += 7;
      motivos.push('atividade próxima do ICP');
    } else {
      motivos.push('CNAE fora (ou não declarado) no ICP');
    }
    if (matchRegiao(perfil, alvo)) {
      v += 7;
      motivos.push('região no alvo do ICP');
    }
    if (matchPorte(perfil, alvo)) {
      v += 5;
      motivos.push('porte compatível');
    }
    fatores.push({ nome: 'Fit de ICP', peso: 25, valor: Math.min(25, v), motivo: motivos.join('; ') });
  }

  // 2) Demanda e sinais (25) — v1: sinais observáveis no registro
  {
    let v = 0;
    const motivos: string[] = [];
    const meses = monthsSince(alvo.dataInicioAtividade);
    if (meses !== null && meses <= 18) {
      v += 10;
      motivos.push(`empresa recente (${meses} meses): fase de montar operação`);
    }
    if (alvo.situacaoCadastral && alvo.situacaoCadastral.toUpperCase() === 'ATIVA') {
      v += 5;
      motivos.push('situação ATIVA na Receita');
    }
    motivos.push('sinais de mercado (notícias/vagas/editais) entram na próxima fase de mapeamento');
    fatores.push({ nome: 'Demanda e sinais', peso: 25, valor: Math.min(25, v), motivo: motivos.join('; ') });
  }

  // 3) Cobertura de decisores (20) — QSA nominal é dado oficial
  {
    const v = Math.min(20, decisoresCount * 7);
    const motivo =
      decisoresCount > 0
        ? `${decisoresCount} decisor(es) nominal(is) via quadro societário (fonte oficial)`
        : 'nenhum decisor mapeado ainda';
    fatores.push({ nome: 'Cobertura de decisores', peso: 20, valor: v, motivo });
  }

  // 4) Encaixe de portfólio (15) — v1 heurístico; cruzamento profundo é dos agentes
  {
    const temCatalogo = (perfil.catalogo?.length ?? 0) > 0;
    const cnae = matchCnae(perfil, alvo);
    let v = 0;
    let motivo = 'cadastre o catálogo no Perfil para o cruzamento demanda × oferta';
    if (temCatalogo && (cnae.hit || cnae.parcial)) {
      v = 8;
      motivo = 'atividade da conta compatível com o seu catálogo (cruzamento fino na próxima fase)';
    } else if (temCatalogo) {
      v = 4;
      motivo = 'catálogo declarado; atividade da conta ainda sem encaixe claro';
    }
    fatores.push({ nome: 'Encaixe de portfólio', peso: 15, valor: v, motivo });
  }

  // 5) Janela e incumbente (15) — v1: ainda não mapeado (honesto)
  {
    fatores.push({
      nome: 'Janela e incumbente',
      peso: 15,
      valor: 0,
      motivo: 'janela de entrada e fornecedor atual entram com os agentes de pesquisa (próxima fase)',
    });
  }

  const score = Math.max(0, Math.min(100, fatores.reduce((acc, f) => acc + f.valor, 0)));

  // Confiança: completude dos campos-chave (registro público pesa alto)
  let conf = 0;
  if (alvo.razaoSocial) conf += 20;
  if (alvo.cnae) conf += 15;
  if (alvo.porte) conf += 10;
  if (alvo.situacaoCadastral) conf += 10;
  if (alvo.municipio && alvo.uf) conf += 10;
  if (decisoresCount > 0) conf += 25; // QSA oficial
  if (alvo.telefone) conf += 10;
  const confianca = Math.min(100, conf);

  return { score, breakdown: { fatores }, confianca };
}

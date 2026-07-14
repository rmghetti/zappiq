/**
 * Mira Prospects — o que a campanha procura, e de onde isso veio.
 *
 * Antes, a descoberta lia o Perfil por dentro (cnaesAlvo/regioes) e, em
 * paralelo, pedia um texto ao cliente que só era usado no fallback web. Dava
 * para o cliente digitar uma coisa e a busca fazer outra, sem ele saber.
 *
 * Agora a CAMPANHA carrega o que procura. O Perfil vira a semente (o wizard
 * já chega preenchido com os alvos e regiões declarados), e o cliente pode
 * tirar ou somar antes de disparar. O que está na tela é o que roda.
 *
 * Aqui mora a leitura dessa semente e a separação entre alvo que é CÓDIGO de
 * CNAE (aciona a base de CNPJs) e alvo que é ATIVIDADE em texto (aciona a
 * busca pública). O Perfil aceita os dois no mesmo campo, porque o
 * placeholder convida os dois ("4651-6 ou 'distribuidoras de TI'").
 */
import { prisma } from '@zappiq/database';

export interface SementeDaBusca {
  /** O que procurar, do Perfil. B2B: cnaesAlvo. B2C: ocupacao (ver nota). */
  alvos: string[];
  /** Onde procurar, do Perfil. B2B: regioes. B2C: regiaoCidade. */
  regioes: string[];
  /** Fonte de cada lista, para a tela dizer de onde veio. */
  origem: 'perfil' | 'vazio';
}

const lista = (v: unknown, max = 10): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim())
        .slice(0, max)
    : [];

/**
 * A semente que o wizard usa para nascer preenchido.
 *
 * Nota honesta sobre o B2C: o bloco B2C do Perfil descreve o CONSUMIDOR
 * (faixa etária, renda, interesses), não o tipo de negócio local a procurar
 * no Places. O paralelo mais próximo de "o que procurar" é a ocupação do
 * público; "onde" tem paralelo direto em regiaoCidade. Quando não há
 * ocupação declarada, a semente de alvos vem vazia e a tela pede ao cliente,
 * em vez de inventar um alvo que ele não declarou.
 */
export async function sementeDaBusca(organizationId: string, kind: 'B2B' | 'B2C'): Promise<SementeDaBusca> {
  const perfil = await (prisma as any).miraPerfil.findUnique({ where: { organizationId } });
  if (!perfil) return { alvos: [], regioes: [], origem: 'vazio' };

  const alvos = kind === 'B2B' ? lista(perfil.alvoB2B?.cnaesAlvo) : lista(perfil.alvoB2C?.ocupacao);
  const regioes = kind === 'B2B' ? lista(perfil.alvoB2B?.regioes, 5) : lista(perfil.alvoB2C?.regiaoCidade, 5);

  return { alvos, regioes, origem: alvos.length || regioes.length ? 'perfil' : 'vazio' };
}

export interface AlvosSeparados {
  /** Só dígitos, 2+ (ex.: "4651" de "4651-6/01"): aciona BigQuery/índice de CNPJ. */
  codigos: string[];
  /** Atividade em texto (ex.: "distribuidoras de TI"): aciona a busca pública. */
  textos: string[];
}

/**
 * Separa código de CNAE de atividade em texto.
 *
 * As duas fontes de candidatos filtram CNAE por prefixo numérico, então um
 * alvo em texto era descartado em silêncio ali (String(c).replace(/\D/g,'')
 * vira ""). Em vez de sumir com ele, mandamos o texto para a busca pública,
 * que é a fonte que sabe lidar com atividade escrita. Assim os dois tipos que
 * o Perfil aceita têm para onde ir.
 */
export function separarAlvos(alvos: string[]): AlvosSeparados {
  const codigos: string[] = [];
  const textos: string[] = [];
  for (const bruto of alvos) {
    const alvo = String(bruto ?? '').trim();
    if (!alvo) continue;
    const digitos = alvo.replace(/\D/g, '');
    // Código de CNAE é essencialmente numérico ("4651-6/01" -> "4651601").
    // Texto com um número solto ("indústria 4.0") não é código: exigimos que
    // os dígitos dominem o alvo.
    const soDigitosEPontuacao = /^[\d.\-/\s]+$/.test(alvo);
    if (soDigitosEPontuacao && digitos.length >= 2) codigos.push(digitos);
    else textos.push(alvo);
  }
  return { codigos, textos };
}

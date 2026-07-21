/**
 * Mira Prospects — porte e faixa de faturamento.
 *
 * A representação de porte é inconsistente no dado real: a Receita usa código
 * ('01' micro, '03' EPP, '05' demais, '00' não informado), a BrasilAPI devolve
 * texto ('MICRO EMPRESA', 'DEMAIS'), e há fixtures com 'ME'/'3'/'5'/'MEDIO'.
 * `normalizarPorte` canoniza tudo em MICRO | PEQUENO | DEMAIS | null, para o
 * score e o filtro pararem de depender da forma exata da string.
 *
 * `portesPermitidos` deriva o recorte de tamanho pedido no Perfil (portes
 * declarados, ou o piso implícito do faturamento pedido). A Receita NÃO publica
 * faturamento, então porte é a aproximação de tamanho possível: EPP vai até
 * R$ 4,8M (teto do Simples), DEMAIS é tudo acima disso.
 */

export type PorteCanonico = 'MICRO' | 'PEQUENO' | 'DEMAIS';

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Canoniza qualquer representação de porte. Desconhecido/não informado = null. */
export function normalizarPorte(raw?: string | null): PorteCanonico | null {
  const p = norm(String(raw ?? ''));
  if (!p) return null;
  // Código da Receita (com ou sem zero à esquerda): '01'->micro, '03'->epp, '05'->demais.
  const soDig = p.replace(/\D/g, '');
  if (soDig) {
    const code = String(Number(soDig)); // '01'->'1', '05'->'5', '00'->'0'
    if (code === '1') return 'MICRO';
    if (code === '3') return 'PEQUENO';
    if (code === '5') return 'DEMAIS';
    if (code === '0') return null; // não informado
    // outros números não são porte conhecido: cai nas palavras abaixo
  }
  if (p === 'me' || p === 'mei' || p.includes('micro')) return 'MICRO';
  if (p === 'epp' || p.includes('pequeno')) return 'PEQUENO';
  if (p.includes('demais') || p.includes('medio') || p.includes('media') || p.includes('grande')) return 'DEMAIS';
  return null;
}

/**
 * Lê o PISO de faturamento (em reais) de um texto livre: "R$ 10M", "10 milhões",
 * "R$ 10.000.000", "10M a 50M" (piso = 10M), "acima de R$ 5 milhões". Texto de
 * TETO ("até X", "no máximo X") não vira piso e devolve null (não filtra).
 * Devolve null quando não dá para ler número nenhum.
 */
export function parseFaturamentoFloorReais(texto?: string | null): number | null {
  const t = norm(String(texto ?? ''));
  if (!t) return null;
  // "até X" / "no máximo X" / "menos de X" descrevem teto, não piso.
  if (/\b(ate|maximo|menos de|abaixo|no maximo)\b/.test(t)) return null;
  const re = /(\d[\d.]*(?:,\d+)?)\s*(bilh\w*|bi|milh\w*|mil|mm|mi|m|k|b)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const bruto = m[1];
    if (!bruto) continue;
    // BR: pontos são separador de milhar, vírgula é decimal.
    const numStr = bruto.replace(/\./g, '').replace(',', '.');
    const base = Number(numStr);
    if (!isFinite(base) || base <= 0) continue;
    const suf = (m[2] || '').toLowerCase();
    let mult = 1;
    if (/^(bi|bilh|b$)/.test(suf)) mult = 1_000_000_000;
    else if (/^mil$/.test(suf)) mult = 1_000; // 'mil' (milhar) antes de 'm'/'mi'
    else if (/^(mi|milh|mm$|m$)/.test(suf)) mult = 1_000_000;
    else if (/^k$/.test(suf)) mult = 1_000;
    return base * mult; // primeiro valor = piso da faixa / "acima de X"
  }
  return null;
}

/** Perfil enxuto que basta para derivar o recorte de tamanho. */
interface PerfilPorteLike {
  alvoB2B?: { portes?: unknown; faturamentoAnual?: unknown } | null;
}

/**
 * Conjunto de portes que o cliente aceita, derivado do Perfil. `null` quando não
 * há recorte de tamanho (não filtra nada). Portes declarados mandam; sem eles,
 * o piso do faturamento pedido implica o porte mínimo (acima de R$ 4,8M = só
 * DEMAIS; entre R$ 360k e R$ 4,8M = exclui micro).
 */
export function portesPermitidos(perfil: PerfilPorteLike | null | undefined): Set<PorteCanonico> | null {
  const portesRaw = perfil?.alvoB2B?.portes;
  const declarados = (Array.isArray(portesRaw) ? portesRaw : [])
    .map((p) => normalizarPorte(String(p)))
    .filter((p): p is PorteCanonico => p !== null);
  if (declarados.length) return new Set(declarados);

  const faturamentoRaw = perfil?.alvoB2B?.faturamentoAnual;
  const piso = parseFaturamentoFloorReais(typeof faturamentoRaw === 'string' ? faturamentoRaw : null);
  if (piso == null) return null;
  if (piso > 4_800_000) return new Set<PorteCanonico>(['DEMAIS']);
  if (piso > 360_000) return new Set<PorteCanonico>(['PEQUENO', 'DEMAIS']);
  return null; // piso baixo: não exclui ninguém
}

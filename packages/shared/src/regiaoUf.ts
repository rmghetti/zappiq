/**
 * Região escrita pelo cliente → UF. Compartilhado de propósito.
 *
 * A busca B2B do Mira recorta por `sigla_uf` na base espelho da Receita, então
 * região que não vira UF não recorta nada. Isto mora no shared porque a API
 * PRECISA concordar com a tela: se o formulário avisa "isto não vira estado" e
 * o motor entende outra coisa, o aviso vira mentira. Uma cópia em cada lado
 * seria drift esperando para acontecer.
 *
 * A versão antiga (só na API) pegava o PRIMEIRO par de letras com `re.exec`,
 * sem /g e sem conferir se era UF de verdade. Três jeitos de errar calado,
 * todos reproduzidos em 14/07/2026:
 *   "zona sul de SP"  → UF "DE"      → zero resultados
 *   "Rio de Janeiro"  → UF "DE"      → zero resultados
 *   "Campinas"        → nenhuma UF   → varria o Brasil inteiro
 * E os dois primeiros eram literalmente os exemplos que o campo sugeria.
 */

/** As 27 UFs. Sem esta conferência, "zona sul de SP" virava a UF "DE". */
export const UFS: ReadonlySet<string> = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]);

/** Estado por extenso, como o cliente escreve. Chave sem acento e minúscula. */
const NOMES_UF: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE',
  'distrito federal': 'DF', brasilia: 'DF', 'espirito santo': 'ES', goias: 'GO',
  maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG',
  para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
  rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP',
  sergipe: 'SE', tocantins: 'TO',
};

/** Do nome mais longo para o mais curto: senão "mato grosso" vence "mato grosso do sul". */
const NOMES_POR_TAMANHO = Object.keys(NOMES_UF).sort((a, b) => b.length - a.length);

function semAcento(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Extrai as UFs de uma lista de regiões escritas à mão.
 *
 * Aceita sigla ("SP") e estado por extenso ("São Paulo"). Cidade sozinha não
 * vira UF de propósito: a consulta não filtra município, e inventar um recorte
 * que a busca não faz seria pior que não recortar.
 */
export function extrairUfs(regioes: string[]): string[] {
  const ufs = new Set<string>();
  for (const r of regioes ?? []) {
    const texto = semAcento(r);
    if (!texto.trim()) continue;

    for (const nome of NOMES_POR_TAMANHO) {
      if (new RegExp(`\\b${nome}\\b`).test(texto)) {
        ufs.add(NOMES_UF[nome]);
        break;
      }
    }

    for (const m of String(r ?? '').toUpperCase().matchAll(/\b([A-Z]{2})\b/g)) {
      if (UFS.has(m[1])) ufs.add(m[1]);
    }
  }
  return Array.from(ufs);
}

/** Esta região vira recorte de verdade? Se não, a busca vale o Brasil inteiro. */
export function regiaoViraUf(regiao: string): boolean {
  return extrairUfs([regiao]).length > 0;
}

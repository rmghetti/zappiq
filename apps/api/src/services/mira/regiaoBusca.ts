/**
 * Mira Prospects — região efetiva de uma busca de descoberta.
 *
 * O que o usuário digitou vence; sem digitação, a primeira região declarada
 * no Perfil de Prospecção (alvoB2C.regiaoCidade no motor B, alvoB2B.regioes
 * na descoberta pública). É a fiação que faz as regiões do Perfil guiarem o
 * MAPEAMENTO (as queries de descoberta), e não só o score: sem isso, quem
 * preencheu "Moema" no Perfil ainda buscava o Brasil inteiro quando esquecia
 * de digitar a região de novo.
 */
export function resolverRegiaoBusca(
  regiaoDigitada: string | null | undefined,
  regioesDoPerfil: unknown
): { regiao: string | null; origem: 'usuario' | 'perfil' | null } {
  const digitada = (regiaoDigitada ?? '').trim();
  if (digitada) return { regiao: digitada, origem: 'usuario' };
  const lista = Array.isArray(regioesDoPerfil) ? regioesDoPerfil : [];
  const doPerfil = lista.find((r): r is string => typeof r === 'string' && r.trim().length > 0);
  return doPerfil ? { regiao: doPerfil.trim(), origem: 'perfil' } : { regiao: null, origem: null };
}

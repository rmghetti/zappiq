/**
 * Chaves de `organizations.settings` que só o servidor grava, e a mesclagem
 * por chave do PUT /api/settings (A156).
 * ----------------------------------------------------------------------------
 * Por que existe: o PUT trocava o JSON `settings` inteiro pelo que vinha no
 * corpo. Dois estragos reais saíam disso.
 *
 *   1. Direito pago por conta própria. `addons`, `miraAlpha` e `llm_routing`
 *      moram nesse JSON, e quem escreve neles é o webhook do Stripe e as rotas
 *      internas. Com a troca inteira, o ADMIN de qualquer organização se dava
 *      Agendamento, Mira ou Impulso, e forçava Sonnet no plano de entrada.
 *   2. Perda silenciosa. A tela reenviava o retrato lido no GET, que vem sem os
 *      segredos do Impulso. Salvar o horário comercial apagava
 *      `capiAccessTokenEnc` e revertia o que o servidor tinha gravado depois
 *      que a tela abriu.
 *
 * O contrato novo tem duas metades, e as duas moram aqui para que a rota de
 * settings e a rota do perfil do agente usem exatamente a mesma lista:
 *   • `rejeitaChavesDoServidor` devolve as chaves proibidas que o corpo tentou
 *     gravar. A rota responde 400 com essa lista, em vez de ignorar em silêncio.
 *   • `mesclarSettingsPorChave` mescla o corpo sobre o que está no banco, no
 *     primeiro nível, e também raso dentro de `surveyAnswers` (o questionário é
 *     salvo seção por seção; substituir o objeto inteiro apagaria as outras).
 */

/** Chaves proibidas pelo nome exato. */
export const CHAVES_SO_DO_SERVIDOR = [
  // Direitos pagos e roteamento de modelo: webhook do Stripe e rotas internas.
  'addons',
  'miraAlpha',
  'miraTrialActivatedAt',
  'llm_routing',
  // Interruptores de comportamento: rota de admin, nunca a tela do cliente.
  'flags',
  'consolidarBaloes',
  // Segredos cifrados no servidor. O cliente manda o valor em claro pela rota
  // dedicada (PUT /api/settings/integrations/zap-impulso), que cifra aqui dentro.
  'asaasApiKeyEnc',
  'capiAccessTokenEnc',
  'asaasWebhookToken',
] as const;

/**
 * Prefixos proibidos. Credencial de canal e estado de cobrança entram por rota
 * própria (PUT /api/settings/channels) ou pelo webhook, nunca pelo PUT genérico.
 * Nenhuma chave que o cliente edita hoje começa com um destes.
 */
export const PREFIXOS_SO_DO_SERVIDOR = [
  'whatsapp',
  'instagram',
  'meta',
  'stripe',
  'trial',
] as const;

/** Verdadeiro quando a chave é gravada só pelo servidor. */
export function ehChaveSoDoServidor(chave: string): boolean {
  if ((CHAVES_SO_DO_SERVIDOR as readonly string[]).includes(chave)) return true;
  const minuscula = chave.toLowerCase();
  return PREFIXOS_SO_DO_SERVIDOR.some((p) => minuscula.startsWith(p));
}

/**
 * Lista as chaves proibidas que o corpo tentou gravar dentro de `settings`.
 * Vazio significa corpo limpo. Olha só o primeiro nível: é ali que moram os
 * direitos e os segredos, e é ali que a substituição do JSON fazia estrago.
 */
export function rejeitaChavesDoServidor(body: unknown): string[] {
  const entrada = (body as { settings?: unknown } | null | undefined)?.settings;
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return [];
  return Object.keys(entrada as Record<string, unknown>).filter(ehChaveSoDoServidor);
}

/**
 * Mescla `entrada` sobre `atual` por chave: o que não veio no corpo fica como
 * está no banco. Dentro de `surveyAnswers` a mesclagem também é rasa, porque a
 * tela do questionário salva uma seção de cada vez.
 *
 * Função pura: não muda nenhum dos dois objetos.
 */
export function mesclarSettingsPorChave(
  atual: unknown,
  entrada: unknown,
): Record<string, unknown> {
  const base: Record<string, unknown> =
    atual && typeof atual === 'object' && !Array.isArray(atual)
      ? { ...(atual as Record<string, unknown>) }
      : {};
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return base;

  const novo = entrada as Record<string, unknown>;
  for (const [chave, valor] of Object.entries(novo)) {
    if (chave === 'surveyAnswers') {
      const respostasAtuais = base.surveyAnswers;
      const ehObjeto = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
      base.surveyAnswers =
        ehObjeto(respostasAtuais) && ehObjeto(valor)
          ? { ...(respostasAtuais as Record<string, unknown>), ...(valor as Record<string, unknown>) }
          : valor;
      continue;
    }
    base[chave] = valor;
  }
  return base;
}

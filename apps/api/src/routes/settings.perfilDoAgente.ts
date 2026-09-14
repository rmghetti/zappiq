/* ══════════════════════════════════════════════════════════════════════
 * Perfil do agente em Configurações: escrita por chave, na fonte única.
 * --------------------------------------------------------------------
 * Dois achados juntos:
 *
 * A156: o `PUT /api/settings` recebe `settings` e TROCA O JSON INTEIRO. A
 * tela lê, mescla no navegador e devolve o objeto completo. Quem salvar com
 * uma leitura velha apaga o que entrou no meio: add-on pago, segredo de
 * integração, respostas do treinamento. É leitura-modificação-escrita com
 * corrida, num campo onde cabe o contrato comercial da organização.
 *
 * A170: a tela de Configurações edita nome e segmento do agente e não
 * sincroniza o Agent que roda em produção. O dono renomeia a IA e ela
 * continua se apresentando pelo nome antigo.
 *
 * Aqui entra o caminho certo: uma rota que aceita SÓ os campos do perfil do
 * agente e mescla POR CHAVE no servidor. Nada fora desta lista é tocado, e
 * o que não vem no corpo fica como está.
 * ══════════════════════════════════════════════════════════════════════ */

import { z } from 'zod';

/** 'HH:mm' em 24 horas. */
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const janelaSchema = z
  .object({
    open: z.string().regex(HORA, 'Horário precisa estar no formato HH:mm'),
    close: z.string().regex(HORA, 'Horário precisa estar no formato HH:mm'),
  })
  .strict();

/**
 * Formato ÚNICO de horário (o mesmo tipo BusinessHoursConfig que o Maestro
 * já avalia com isOpen). Dia sem expediente é `null` explícito, e não um dia
 * ausente: ausência é "não informado", que tem outro significado para a IA.
 *
 * Por isso os SETE dias são obrigatórios. O bloco vivo trata dia ausente como
 * "não informado" e deixa o dia fora da frase, de propósito (achado A059): é
 * o que impede a IA de afirmar "Domingo: fechado" para quem abre no domingo.
 * Se esta rota aceitasse meia semana, o cliente salvaria a tela inteira
 * achando que declarou tudo, e a IA continuaria sem resposta para os outros
 * dias. Declarar é dizer os sete, com `null` onde fecha.
 */
const diasDaSemanaSchema = z
  .object({
    '0': janelaSchema.nullable(),
    '1': janelaSchema.nullable(),
    '2': janelaSchema.nullable(),
    '3': janelaSchema.nullable(),
    '4': janelaSchema.nullable(),
    '5': janelaSchema.nullable(),
    '6': janelaSchema.nullable(),
  })
  .strict();

export const businessHoursConfigSchema = z
  .object({
    timezone: z.string().min(1).max(64),
    days: diasDaSemanaSchema,
  })
  .strict();

/**
 * Whitelist do perfil do agente. `.strict()` pelo mesmo motivo do
 * updateSettingsSchema: campo desconhecido vira 400, nunca silêncio.
 */
export const perfilDoAgenteSchema = z
  .object({
    agentName: z.string().trim().min(1).max(80).optional(),
    /** Os três do painel, e também o tom escrito pelo dono no questionário. */
    tone: z.string().trim().min(1).max(240).optional(),
    segmento: z.string().trim().min(1).max(64).optional(),
    handoffMessage: z.string().trim().max(500).optional(),
    businessHoursConfig: businessHoursConfigSchema.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Informe pelo menos um campo do perfil do agente.',
  });

export type PerfilDoAgenteInput = z.infer<typeof perfilDoAgenteSchema>;

export interface MergePerfilResultado {
  settings: Record<string, any>;
  /** Campos que realmente mudaram, para auditoria e para decidir a sincronia. */
  alterados: string[];
  /** Nome novo do agente quando ele mudou. null quando não mudou. */
  nomeNovo: string | null;
}

/**
 * Mescla POR CHAVE. Nunca devolve um objeto construído do zero: parte do que
 * está gravado e troca só o que veio no corpo. Chave ausente no corpo fica
 * exatamente como estava.
 *
 * `segmento` e `niche` andam juntos de propósito: a tela grava 'segmento' e
 * o prompt lê 'niche'. Divergir os dois é o que fazia a tela prometer
 * calibração por setor sem efeito nenhum (A170, A184).
 */
export function mergePerfilDoAgente(
  settingsAtuais: Record<string, any> | null | undefined,
  entrada: PerfilDoAgenteInput,
): MergePerfilResultado {
  const atuais = settingsAtuais ?? {};
  const settings: Record<string, any> = { ...atuais };
  const alterados: string[] = [];

  const mudou = (chave: string, valor: any) => {
    if (JSON.stringify(atuais[chave] ?? null) === JSON.stringify(valor ?? null)) return;
    settings[chave] = valor;
    alterados.push(chave);
  };

  let nomeNovo: string | null = null;
  if (entrada.agentName !== undefined) {
    mudou('agentName', entrada.agentName);
    if (alterados.includes('agentName')) nomeNovo = entrada.agentName;
  }
  if (entrada.tone !== undefined) mudou('tone', entrada.tone);
  if (entrada.handoffMessage !== undefined) mudou('handoffMessage', entrada.handoffMessage);
  if (entrada.segmento !== undefined) {
    mudou('segmento', entrada.segmento);
    mudou('niche', entrada.segmento);
  }
  if (entrada.businessHoursConfig !== undefined) {
    mudou('businessHoursConfig', entrada.businessHoursConfig);
  }

  return { settings, alterados, nomeNovo };
}

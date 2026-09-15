/* ══════════════════════════════════════════════════════════════════════
 * postProcessReply: UM só pós-processador para toda resposta do agente.
 * --------------------------------------------------------------------
 * Tarefa C1b (Passo 12, parte B), achado A189.
 *
 * O problema: a plataforma já tinha as travas de saída, mas cada canal
 * chamava um pedaço delas. O filtro de voz rodava no WhatsApp e no Testar
 * minha IA e não no chat do site; a retomada do Maestro mandava o texto
 * cru do modelo, com <reply> e tudo; o chat do site jogava fora a tag de
 * transbordo; e a guarda de marca (findForeignBrandLeaks) só olhava as
 * correções da Qualidade, nunca a resposta que o cliente final lê. O teste
 * da Qualidade já pegou um agente de cliente dizendo que a Iza é da ZappIQ:
 * em produção essa frase sairia sem trava.
 *
 * Aqui mora a sequência inteira, pura (sem banco, sem rede, sem relógio):
 *   1. o texto que o cliente lê, pela MESMA função que o WhatsApp já usa
 *      (extractProductionReplyText: <reply>, tags, prefixos vazados e o
 *      filtro de voz, exatamente o que ele faz hoje);
 *   2. as tags de ação LIDAS, com os dados e os botões;
 *   3. a guarda de marca sobre o texto real. Vazou marca da ZappIQ para o
 *      cliente de outro negócio: o texto não sai, sai a resposta segura do
 *      canal, e o alerta volta para quem chamou registrar.
 *
 * Os cinco consumidores (WhatsApp e Instagram, chat do site, Testar minha
 * IA, retomada do Maestro e Qualidade) passam por aqui. O teste de
 * paridade (postProcessReply.test.ts) prova que a mesma saída bruta vira o
 * mesmo texto em todos eles.
 * ══════════════════════════════════════════════════════════════════════ */

import { extractProductionReplyText } from './replyText.js';
import { findForeignBrandLeaks } from './tenantIsolationGuard.js';
import type { OrigemDoTurno } from './composeAgentContext.js';

/** Onde a resposta vai parar. Os mesmos canais do motor único de contexto. */
export type CanalDaSaida = OrigemDoTurno;

export const CANAIS_DA_SAIDA: readonly CanalDaSaida[] = [
  'whatsapp',
  'instagram',
  'site',
  'playground',
  'maestro_retomada',
  'qualidade',
];

/**
 * O que o cliente final recebe quando a guarda segura a resposta. Não
 * promete nada (nem pessoa, nem retorno) e não confessa falha técnica
 * (CR-3): só devolve a conversa para o cliente.
 */
export const TEXTO_SEGURO_AO_CLIENTE =
  'Pode me contar com um pouco mais de detalhe o que você precisa?';

/**
 * A resposta segura de cada canal.
 *
 *   - WhatsApp, Instagram e site: a frase neutra acima.
 *   - Testar minha IA: o dono precisa ver que a guarda agiu, senão acha
 *     que o agente enlouqueceu. Mostra o motivo e o que o cliente leria.
 *   - Retomada do Maestro: silêncio. É uma mensagem que o agente manda por
 *     conta própria; sem texto seguro, é melhor não mandar nada (a mesma
 *     regra de fail-closed que a retomada já segue).
 *   - Qualidade: a entrada existe para o tipo ficar completo, mas não é
 *     usada. No teste o texto fica como veio (ver `postProcessReply`).
 */
export const RESPOSTA_SEGURA_DO_CANAL: Record<CanalDaSaida, string> = {
  whatsapp: TEXTO_SEGURO_AO_CLIENTE,
  instagram: TEXTO_SEGURO_AO_CLIENTE,
  site: TEXTO_SEGURO_AO_CLIENTE,
  playground:
    'A guarda de marca segurou esta resposta porque ela citava a marca de outra empresa. ' +
    `O seu cliente receberia: "${TEXTO_SEGURO_AO_CLIENTE}"`,
  maestro_retomada: '',
  qualidade: TEXTO_SEGURO_AO_CLIENTE,
};

/** Prefixo dos alertas da guarda de marca. O termo que vazou vem depois. */
export const PREFIXO_ALERTA_DE_MARCA = 'guarda_de_marca:';

export interface PostProcessInput {
  /** A saída crua do modelo (ou o texto determinístico do canal). */
  bruto: string | null | undefined;
  canal: CanalDaSaida;
  organizacao: {
    id: string;
    /** true SÓ para a organização canônica da ZappIQ. */
    ehZappIQ: boolean;
    /** Nome do negócio (settings.businessName). Entra na lista de exceções. */
    nome?: string | null;
  };
  /** O agente que respondeu. O nome dele nunca é vazamento. */
  agente?: { nome?: string | null } | null;
}

export interface TagsDaResposta {
  /** Conteúdo de <action_data>, já lido como JSON. null quando ausente ou inválido. */
  actionData: unknown;
  /** Conteúdo de <buttons>, já lido. null quando ausente ou inválido. */
  buttons: Array<{ id: string; title: string }> | null;
}

export interface PostProcessOutput {
  /** O texto que sai para o cliente. Pode ser vazio. */
  texto: string;
  /** As ações pedidas pelo modelo, na ordem, sem repetir. */
  acoes: string[];
  tags: TagsDaResposta;
  /** Alertas para o log e para o Raio-X. Vazio quando nada disparou. */
  alertas: string[];
  /** true quando a guarda trocou o texto pela resposta segura do canal. */
  bloqueada: boolean;
}

function lerJson(bruto: string | undefined): unknown {
  if (!bruto) return null;
  try {
    return JSON.parse(bruto.trim());
  } catch {
    return null;
  }
}

function lerBotoes(bruto: string | undefined): TagsDaResposta['buttons'] {
  const lido = lerJson(bruto);
  if (!Array.isArray(lido)) return null;
  const botoes = lido
    .filter((b) => b && typeof b === 'object' && typeof b.id === 'string' && typeof b.title === 'string')
    .map((b) => ({ id: String(b.id), title: String(b.title) }));
  return botoes.length ? botoes : null;
}

/** Todas as ações, em ordem, sem repetir. */
function lerAcoes(bruto: string): string[] {
  const acoes: string[] = [];
  for (const m of bruto.matchAll(/<action>([\s\S]*?)<\/action>/gi)) {
    const acao = m[1].trim();
    if (acao && !acoes.includes(acao)) acoes.push(acao);
  }
  return acoes;
}

/**
 * Termos de marca que são legítimos para este cliente: os que aparecem no
 * nome do próprio agente ou do próprio negócio (a agente que se chama Iza
 * não está vazando nada quando diz o nome dela).
 */
function termosPermitidos(input: PostProcessInput): string[] {
  const identidade = [input.agente?.nome, input.organizacao.nome].filter(Boolean).join(' ');
  return findForeignBrandLeaks(identidade).map((l) => l.term);
}

/**
 * O pós-processamento de uma resposta. Pura: mesma entrada, mesma saída.
 */
export function postProcessReply(input: PostProcessInput): PostProcessOutput {
  const bruto = String(input.bruto ?? '');

  const limpo = extractProductionReplyText(bruto);
  const acoes = lerAcoes(bruto);
  const tags: TagsDaResposta = {
    actionData: lerJson(bruto.match(/<action_data>([\s\S]*?)<\/action_data>/i)?.[1]),
    buttons: lerBotoes(bruto.match(/<buttons>([\s\S]*?)<\/buttons>/i)?.[1]),
  };

  const alertas: string[] = [];
  let texto = limpo;
  let bloqueada = false;

  if (!input.organizacao.ehZappIQ && limpo) {
    const vazamentos = findForeignBrandLeaks(limpo, { allow: termosPermitidos(input) });
    if (vazamentos.length) {
      for (const v of vazamentos) alertas.push(`${PREFIXO_ALERTA_DE_MARCA}${v.term}`);
      // Na Qualidade nada vai ao cliente: o teste existe justamente para
      // achar o vazamento. Trocar pelo texto seguro esconderia a reprovação
      // do cenário de marca. O alerta segue junto do resultado.
      if (input.canal !== 'qualidade') {
        texto = RESPOSTA_SEGURA_DO_CANAL[input.canal];
        bloqueada = true;
      }
    }
  }

  return { texto, acoes, tags, alertas, bloqueada };
}

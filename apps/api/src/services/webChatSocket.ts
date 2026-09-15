/* ══════════════════════════════════════════════════════════════════════
 * webChatSocket: o canal de volta do chat do site (C1b, Passo 3, A158).
 * --------------------------------------------------------------------
 * O widget só recebia a resposta do próprio POST: não havia por onde a
 * equipe falar com o visitante. Aqui nasce um namespace do socket.io só
 * para visitantes, sem login (o do painel, '/', exige JWT), com uma regra
 * só: o visitante entra na sala da PRÓPRIA sessão, e só nela. Ele não tem
 * como pedir outra sala nem mandar evento algum.
 *
 * Portões, na ordem, antes de entrar na sala:
 *   1. organização e sessão válidas no handshake (`auth: { org, sessionId }`);
 *   2. a organização existe e tem o chat do site ligado (o mesmo portão
 *      do POST: settings.webChatEnabled);
 *   3. a origem da página é uma em que o widget pode rodar.
 *
 * O adaptador Redis (utils/socketAdapter.ts) já vale para todos os
 * namespaces: o emit do despachante alcança o visitante em qualquer
 * máquina.
 * ══════════════════════════════════════════════════════════════════════ */

import type { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';
import { NAMESPACE_DO_CHAT_DO_SITE, salaDoVisitante, sessaoNormalizada } from './webChatSala.js';
import { guardarComTeto } from './webChatVisitante.js';

export interface DependenciasDoCanalDoVisitante {
  /** O mesmo portão do POST do chat (webChatService.getWebChatOrgConfig). */
  configDaOrg: (organizationId: string) => Promise<{ exists: boolean; enabled: boolean }>;
  /** A origem da página pode rodar o widget desta organização? */
  origemPermitida: (origin: string | undefined, organizationId: string) => Promise<boolean>;
}

/** Id de organização no handshake, com o mesmo teto do POST. */
function orgDoHandshake(bruto: unknown): string | null {
  const id = typeof bruto === 'string' ? bruto.trim() : '';
  return id && id.length <= 40 ? id : null;
}

/**
 * O portão do namespace, exportado para o teste. Em sucesso, grava a sala
 * em socket.data.sala; quem põe o socket nela é o handler de conexão.
 */
export function criarPortaoDoVisitante(deps: DependenciasDoCanalDoVisitante) {
  return async (socket: Pick<Socket, 'handshake' | 'data'>, next: (err?: Error) => void) => {
    try {
      const auth = (socket.handshake?.auth ?? {}) as Record<string, unknown>;
      const org = orgDoHandshake(auth.org);
      const sessao = sessaoNormalizada(auth.sessionId);
      if (!org || !sessao) return next(new Error('pedido_invalido'));

      const config = await deps.configDaOrg(org);
      if (!config.exists || !config.enabled) return next(new Error('not_found'));

      const origin = socket.handshake?.headers?.origin as string | undefined;
      if (!(await deps.origemPermitida(origin, org))) return next(new Error('origem_nao_permitida'));

      socket.data.sala = salaDoVisitante(org, sessao);
      return next();
    } catch (err) {
      logger.warn('[webChatSocket] portão do visitante falhou', {
        err: err instanceof Error ? err.message : String(err),
      });
      return next(new Error('indisponivel'));
    }
  };
}

/** Liga o namespace dos visitantes no servidor de socket. Chamado no boot. */
export function registrarCanalDoVisitante(io: SocketIOServer, deps: DependenciasDoCanalDoVisitante): void {
  const nsp = io.of(NAMESPACE_DO_CHAT_DO_SITE);
  nsp.use(criarPortaoDoVisitante(deps) as any);
  nsp.on('connection', (socket) => {
    const sala = socket.data?.sala;
    if (typeof sala === 'string') socket.join(sala);
  });
}

/**
 * Cache curto para o portão: cada visitante que já conversou conecta a cada
 * página vista do site do cliente, e o portão confere o chat ligado a cada
 * conexão. Com cache de 30 s por organização, desligar o chat vale para
 * conexões novas em até 30 s. Erro não entra no cache.
 */
export function configComCacheCurto(
  ler: (organizationId: string) => Promise<{ exists: boolean; enabled: boolean }>,
  ttlMs = 30_000,
  relogio: () => number = Date.now,
): (organizationId: string) => Promise<{ exists: boolean; enabled: boolean }> {
  const cache = new Map<string, { valor: { exists: boolean; enabled: boolean }; ate: number }>();
  return async (organizationId: string) => {
    const agora = relogio();
    const guardado = cache.get(organizationId);
    if (guardado && guardado.ate > agora) return guardado.valor;
    const valor = await ler(organizationId);
    // Com teto: o id vem do handshake público (auditoria do diff).
    guardarComTeto(cache, organizationId, { valor, ate: agora + ttlMs });
    return valor;
  };
}

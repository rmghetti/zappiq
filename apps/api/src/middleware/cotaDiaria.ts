/**
 * Cota diária por organização para ação paga (A115).
 * ----------------------------------------------------------------------------
 * O re-teste de um cenário e a geração de sugestão custam, cada clique, um chat
 * mais um juiz em Sonnet. Nenhuma das duas rotas tinha teto: o único freio era
 * o limitador global por IP, de 500 requisições a cada 15 minutos. Uma tarde de
 * cliques impacientes vira conta.
 *
 * O contador vive no Redis, numa chave por organização, por rota e por dia
 * (`zappiq:quota:<org>:<rota>:<aaaa-mm-dd>`), com validade de 36 horas: a chave
 * morre sozinha no dia seguinte. O dia é o de Brasília (ver
 * `chaveDaCotaDiaria`), porque é o relógio de quem clica.
 *
 * Duas decisões que valem comentário:
 *   • Sem Redis não há cota. O contador do cache é `fail-soft` por contrato
 *     (devolve null quando o backend está fora), e derrubar o cliente porque o
 *     cache caiu seria trocar um risco de custo por uma parada de serviço. Fica
 *     o aviso no log para o operador ver.
 *   • O incremento acontece ANTES do handler, então uma chamada que termina em
 *     404 também consome cota. É de propósito: o que precisa ser contido é a
 *     repetição, e contar só o sucesso abriria a porta para gastar o teto em
 *     tentativas.
 */
import { Request, Response, NextFunction } from 'express';
import { cache } from '../services/cloud/index.js';
import { logger } from '../utils/logger.js';

/** Teto padrão por organização, por rota, por dia. */
export const COTA_DIARIA_PADRAO = 20;

/** Validade da chave: 36 horas cobrem o dia inteiro em qualquer fuso. */
const VALIDADE_SEGUNDOS = 36 * 3600;

/** Diferença de Brasília para o UTC, em milissegundos (UTC-3). */
const FUSO_DE_BRASILIA_MS = 3 * 3600_000;

/**
 * Chave do contador. Exportada para o teste conferir o formato combinado.
 *
 * O dia é o de Brasília, não o do UTC. A máquina roda em UTC, e com o dia do
 * UTC a cota virava às 21:00 no relógio do cliente: quem clicava às 22h de
 * terça já estava consumindo a cota de quarta, e o teto do dia dobrava toda
 * noite. O Brasil não tem mais horário de verão desde 2019, então o
 * deslocamento fixo de três horas basta e evita depender de base de fusos.
 */
export function chaveDaCotaDiaria(
  organizationId: string,
  rota: string,
  agora: Date = new Date(),
): string {
  const emBrasilia = new Date(agora.getTime() - FUSO_DE_BRASILIA_MS);
  return `zappiq:quota:${organizationId}:${rota}:${emBrasilia.toISOString().slice(0, 10)}`;
}

/**
 * Middleware de cota. `rota` é o nome curto que aparece na chave (por exemplo
 * `re-test`), não o caminho completo.
 */
export function cotaDiaria(rota: string, limite: number = COTA_DIARIA_PADRAO) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const organizationId = req.user?.organizationId || req.organizationId;
    if (!organizationId) {
      next();
      return;
    }
    const chave = chaveDaCotaDiaria(organizationId, rota);
    const usado = await cache.incrby(chave, 1);
    if (usado === null) {
      logger.warn('[cotaDiaria] contador indisponível: cota não aplicada nesta chamada', {
        rota,
        organizationId,
      });
      next();
      return;
    }
    // Validade só na criação (contador igual a 1 = chave nova), mesmo padrão
    // incr+expire que o resto do código já usa.
    if (usado === 1) await cache.expire(chave, VALIDADE_SEGUNDOS);
    if (usado > limite) {
      logger.warn('[cotaDiaria] cota do dia estourada', { rota, organizationId, usado, limite });
      res.status(429).json({
        error: `Você já usou as ${limite} execuções de hoje desta ação nesta empresa. Tente de novo amanhã.`,
        limite,
        usado,
      });
      return;
    }
    next();
  };
}

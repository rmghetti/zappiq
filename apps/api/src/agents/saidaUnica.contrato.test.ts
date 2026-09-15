/* ══════════════════════════════════════════════════════════════════════
 * Contrato: todo caminho de resposta do agente passa pelo pós-processador
 * único (C1b, Passo 1, A189).
 * --------------------------------------------------------------------
 * O defeito do A189 não era falta de trava: era trava chamada por um canal
 * e esquecida por outro. Este teste lê o código dos cinco consumidores e
 * falha se algum voltar a limpar a resposta por conta própria, com uma
 * cópia da limpeza, em vez de chamar postProcessReply.
 *
 * O comportamento (a mesma saída bruta vira o mesmo texto em todos os
 * canais) está provado em postProcessReply.test.ts; aqui é a amarra.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function ler(relativo: string): string {
  return readFileSync(fileURLToPath(new URL(relativo, import.meta.url)), 'utf8');
}

/** Tira comentários para o teste olhar só o código. */
function semComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const CONSUMIDORES: Array<{ canal: string; arquivo: string }> = [
  { canal: 'WhatsApp e Instagram', arquivo: './agentOrchestrator.ts' },
  { canal: 'chat do site', arquivo: '../services/webChatService.ts' },
  { canal: 'Testar minha IA', arquivo: '../routes/aiTraining.playground.ts' },
  { canal: 'retomada do Maestro', arquivo: './flowAiResume.ts' },
  { canal: 'Qualidade', arquivo: '../services/agentEvalRunner.ts' },
];

/** Limpezas que só o pós-processador (e o replyText por baixo dele) pode chamar. */
const LIMPEZAS_PROIBIDAS = [
  /\bextractProductionReplyText\(/,
  /\bstripStructuredTags\(/,
  /\bstripLeakedPrefixes\(/,
  /\bapplyVozHumanaFilter\(/,
  /\bparseAgentResponse\(/,
];

describe('todo canal de resposta chama postProcessReply', () => {
  for (const { canal, arquivo } of CONSUMIDORES) {
    const codigo = semComentarios(ler(arquivo));

    it(`${canal}: chama postProcessReply`, () => {
      expect(codigo).toMatch(/\bpostProcessReply\(/);
    });

    it(`${canal}: não limpa a resposta por conta própria`, () => {
      for (const proibida of LIMPEZAS_PROIBIDAS) {
        expect(codigo, `${arquivo} chama ${proibida}`).not.toMatch(proibida);
      }
    });

    it(`${canal}: registra os alertas da guarda (log e Raio-X)`, () => {
      // O Testar minha IA registra na rota (aiTraining.ts), que é quem tem a
      // organização em mãos; o módulo puro devolve os alertas no resultado.
      const onde = canal === 'Testar minha IA' ? semComentarios(ler('../routes/aiTraining.ts')) : codigo;
      expect(onde).toMatch(/\bregistrarAlertasDeSaida\(/);
    });

    // Rodada 1 do PR #379: a guarda só segura a resposta com o interruptor
    // `guardaDeMarca` da organização, lido na leitura única do turno e
    // passado ao pós-processador. Um canal que esqueça de passar nasce
    // "só alerta" para sempre (fail-safe), mas o contrato é passar.
    if (canal === 'Qualidade') {
      it(`${canal}: nunca liga a guarda (o cenário de marca reprova pelo juiz, o texto fica como veio)`, () => {
        expect(codigo).not.toMatch(/\bguardaLigada\b/);
      });
    } else {
      it(`${canal}: passa o interruptor guardaDeMarca ao pós-processador (guardaLigada)`, () => {
        const onde = canal === 'Testar minha IA' ? semComentarios(ler('../routes/aiTraining.ts')) : codigo;
        expect(onde).toMatch(/guardaLigada:\s*\w+\.guardaDeMarca\b/);
      });
    }
  }
});

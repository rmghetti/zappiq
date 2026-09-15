/**
 * Rótulos amigáveis dos cenários na tela do cliente (A151).
 *
 * Rodada 1 do PR #378, item 14: o rótulo do preço por plano da Iza
 * (zappiq_preco_<PLANO>_correto) só aceitava o id em maiúsculas. O catálogo
 * hoje usa maiúsculas, mas o rótulo não pode depender disso.
 */
import { describe, it, expect } from 'vitest';
import { friendlyScenarioLabel } from './clientAgentQualityApi';

describe('friendlyScenarioLabel', () => {
  it('preço por plano da Iza: aceita o id em qualquer caixa e mostra o plano em maiúsculas', () => {
    expect(friendlyScenarioLabel('zappiq_preco_STARTER_correto')).toBe('Preço do plano STARTER vem do catálogo');
    expect(friendlyScenarioLabel('zappiq_preco_starter_correto')).toBe('Preço do plano STARTER vem do catálogo');
    expect(friendlyScenarioLabel('zappiq_preco_Iza_Lite_correto')).toBe('Preço do plano IZA LITE vem do catálogo');
  });

  it('cenário fixo e caso gerado seguem como antes', () => {
    expect(friendlyScenarioLabel('kb_questionario_pre_tabela_precos')).toBe('Preço: resposta vem da tabela cadastrada');
    expect(friendlyScenarioLabel('kb_qa_abc', 'Pergunta cadastrada: "x"')).toBe('Pergunta cadastrada: "x"');
    expect(friendlyScenarioLabel('id_desconhecido', 'descrição — antiga')).toBe('descrição: antiga');
  });
});

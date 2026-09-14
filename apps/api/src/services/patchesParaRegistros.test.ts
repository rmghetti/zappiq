/**
 * patchesParaRegistros.test.ts (C3, Passo 14)
 * ============================================================================
 * A migração dos patches que JÁ estão colados nos prompts vivos.
 *
 * Provado contra a fixture do prompt da Marcia (MACHIA): quatro blocos
 * "# PATCH MANUAL", três deles cortados no meio da frase, e dois para o mesmo
 * cenário. É o retrato do A079 (tudo vira append no fim), do A081 (dois
 * patches para o mesmo cenário) e do A188 (o corte em 600 caracteres).
 *
 * Regra do bloco truncado, que este teste fixa: NUNCA vira regra ativa. Entra
 * como 'substituida' com motivo 'truncada' e aparece no relatório. Não dá para
 * adivinhar o fim da frase, e colar meia regra de volta seria repetir o erro.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  extrairPatches,
  planejarRegistros,
  validarPromptLimpo,
} from './patchesParaRegistros.js';
import {
  PROMPT_COM_PATCHES_MANUAIS,
  PROMPT_SEM_PATCHES,
} from './__fixtures__/promptComPatchesManuais.js';

// ════════════════════════════════════════════════════════════════════
describe('extrairPatches — a fixture do prompt da Marcia', () => {
  const extraido = extrairPatches(PROMPT_COM_PATCHES_MANUAIS);

  it('acha os cinco "# PATCH MANUAL" e a regra solta no meio do texto', () => {
    const doPatcher = extraido.blocos.filter((b) => b.origemNoTexto === 'patch_manual');
    const soltas = extraido.blocos.filter((b) => b.origemNoTexto === 'regra_inviolavel');
    expect(doPatcher).toHaveLength(5);
    expect(soltas).toHaveLength(1);
  });

  it('lê o cenário do cabeçalho de cada patch', () => {
    const cenarios = extraido.blocos
      .filter((b) => b.origemNoTexto === 'patch_manual')
      .map((b) => b.scenarioId);
    expect(cenarios).toEqual([
      'cr5_nome_disponivel_usar',
      'cr5_nome_ausente_perguntar',
      'cr7_preco_da_base_correto',
      'cr5_nome_disponivel_usar',
      'cr6_uma_pergunta_por_vez',
    ]);
  });

  it('marca como truncado exatamente os quatro que param no meio', () => {
    const truncados = extraido.blocos.filter((b) => b.truncada);
    expect(truncados).toHaveLength(4);
    expect(truncados[0].texto).toMatch(/Já te explico como$/);
    expect(truncados[1].texto).toMatch(/me co$/);
  });

  // ── O caso que estava VIVO no prompt da Marcia ────────────────────
  // A régua olhava só o último caractere. O corte do sugeridor caiu logo
  // depois do "?" de uma frase que abria aspas e nunca as fechou, então o
  // fragmento passava por frase inteira e virava regra ATIVA. A aspa aberta
  // é a prova de que o texto continuava.
  it('bloco cortado depois de "?" com a aspa ainda aberta é truncado', () => {
    const bloco = extraido.blocos.find((b) => b.scenarioId === 'cr6_uma_pergunta_por_vez');
    expect(bloco?.texto).toMatch(/Como posso te chamar\?$/);
    expect(bloco?.truncada).toBe(true);
  });

  it('bloco com as aspas fechadas e ponto final continua inteiro', () => {
    const inteiro = extrairPatches(
      '## IDENTIDADE\nVocê é a Marcia.\n\n' +
        '# PATCH MANUAL 2026-09-01 10:00 (cenário: cr9)\n' +
        'Pergunte o nome assim: "Como posso te chamar?".\n',
    );
    expect(inteiro.blocos[0].truncada).toBe(false);
  });

  it('o prompt limpo perde os blocos e mantém a identidade', () => {
    expect(extraido.promptLimpo).not.toContain('# PATCH MANUAL');
    expect(extraido.promptLimpo).not.toContain('REGRA INVIOLÁVEL #1');
    expect(extraido.promptLimpo).toContain('## IDENTIDADE');
    expect(extraido.promptLimpo).toContain('## COMO ENCERRAR');
    expect(extraido.promptLimpo).toContain('Sempre combine o próximo passo');
  });

  it('prompt sem patch nenhum atravessa inteiro', () => {
    const r = extrairPatches(PROMPT_SEM_PATCHES);
    expect(r.blocos).toHaveLength(0);
    expect(r.promptLimpo.trim()).toBe(PROMPT_SEM_PATCHES.trim());
  });
});

// ════════════════════════════════════════════════════════════════════
describe('planejarRegistros — o mais recente vence, o truncado nunca', () => {
  const plano = planejarRegistros(extrairPatches(PROMPT_COM_PATCHES_MANUAIS).blocos);

  it('o cenário com DOIS patches fica com UMA regra ativa: a mais recente', () => {
    const doCenario = plano.filter((r) => r.scenarioId === 'cr5_nome_disponivel_usar');
    expect(doCenario).toHaveLength(2);
    const ativas = doCenario.filter((r) => r.status === 'ativa');
    expect(ativas).toHaveLength(1);
    expect(ativas[0].texto).toContain('Sobre o que combinamos');
    expect(doCenario.find((r) => r.status !== 'ativa')?.motivo).toBe('truncada');
  });

  it('bloco truncado nunca nasce ativo: vira substituida com motivo truncada', () => {
    const truncadas = plano.filter((r) => r.motivo === 'truncada');
    expect(truncadas).toHaveLength(4);
    for (const r of truncadas) expect(r.status).toBe('substituida');
  });

  it('o bloco cortado na aspa aberta não vira regra ativa', () => {
    const doCenario = plano.filter((r) => r.scenarioId === 'cr6_uma_pergunta_por_vez');
    expect(doCenario).toHaveLength(1);
    expect(doCenario[0].status).toBe('substituida');
    expect(doCenario[0].motivo).toBe('truncada');
  });

  it('cenário cujo único patch estava truncado fica SEM regra ativa', () => {
    const ativasDoPreco = plano.filter(
      (r) => r.scenarioId === 'cr7_preco_da_base_correto' && r.status === 'ativa',
    );
    expect(ativasDoPreco).toHaveLength(0);
  });

  it('a regra solta no meio do texto entra ativa, sem cenário', () => {
    const solta = plano.find((r) => r.scenarioId === null);
    expect(solta?.status).toBe('ativa');
    expect(solta?.texto).toContain('USO OBRIGATÓRIO DO NOME');
  });

  it('no total, 3 regras ativas viram 1: o prompt para de acumular', () => {
    expect(plano.filter((r) => r.status === 'ativa')).toHaveLength(2); // 1 cenário + 1 solta
    expect(plano).toHaveLength(6);
  });

  it('o mais recente vence pela DATA do cabeçalho, não pela ordem no arquivo', () => {
    const invertido = planejarRegistros([
      {
        origemNoTexto: 'patch_manual',
        scenarioId: 'cr1',
        titulo: '# PATCH MANUAL 2026-08-17 10:12 (cenário: cr1)',
        texto: 'Regra nova, aplicada depois.',
        carimbo: '2026-08-17 10:12',
        truncada: false,
      },
      {
        origemNoTexto: 'patch_manual',
        scenarioId: 'cr1',
        titulo: '# PATCH MANUAL 2026-07-01 08:00 (cenário: cr1)',
        texto: 'Regra velha, aplicada antes.',
        carimbo: '2026-07-01 08:00',
        truncada: false,
      },
    ]);
    const ativa = invertido.find((r) => r.status === 'ativa');
    expect(ativa?.texto).toContain('Regra nova');
  });
});

// ════════════════════════════════════════════════════════════════════
// A172: o nome fictício do teste não pode virar regra de produção.
//
// O cenário do gabarito simula um contato chamado Rod, e 44% das sugestões
// traziam "Oi, Rod!" como exemplo. Doze dessas correções foram aplicadas, e
// hoje o prompt da Iza e o da Marcia ensinam o agente a saudar "Rod". A
// migração é a última chance de tirar isso antes de o texto virar registro.
describe('o nome do mock não atravessa a migração (A172)', () => {
  it('troca "Rod" por "[nome]" no texto da regra', () => {
    const { blocos } = extrairPatches(
      '## IDENTIDADE\nVocê é a Marcia.\n\n' +
        '# PATCH MANUAL 2026-08-01 09:00 (cenário: cr5_nome_disponivel_usar)\n' +
        'Use o nome do cliente na saudação. Exemplo CORRETO: "Oi, Rod! Aqui é a Marcia."\n',
    );
    expect(blocos[0].texto).toContain('Oi, [nome]!');
    expect(blocos[0].texto).not.toMatch(/\bRod\b/);
  });

  it('não encosta em palavra que apenas começa com Rod', () => {
    const { blocos } = extrairPatches(
      '## IDENTIDADE\nVocê é a Marcia.\n\n' +
        '# PATCH MANUAL 2026-08-01 09:00 (cenário: cr2)\n' +
        'Se o cliente for o Rodrigo da Rodoviária, confirme o endereço antes.\n',
    );
    expect(blocos[0].texto).toContain('Rodrigo da Rodoviária');
  });
});

// ════════════════════════════════════════════════════════════════════
describe('validarPromptLimpo — recusa antes de gravar', () => {
  it('recusa se a identidade sumiu', () => {
    const v = validarPromptLimpo(PROMPT_COM_PATCHES_MANUAIS, 'sobrou só isto aqui');
    expect(v.ok).toBe(false);
    expect(v.motivos.join(' ')).toMatch(/IDENTIDADE/);
  });

  it('recusa se o prompt encolheu demais', () => {
    const v = validarPromptLimpo(PROMPT_COM_PATCHES_MANUAIS, '## IDENTIDADE\nVocê é a Marcia.');
    expect(v.ok).toBe(false);
    expect(v.motivos.join(' ')).toMatch(/encolheu|tamanho/i);
  });

  it('recusa se ainda sobrou bloco de patch', () => {
    const v = validarPromptLimpo(
      PROMPT_COM_PATCHES_MANUAIS,
      PROMPT_COM_PATCHES_MANUAIS.replace('# PATCH MANUAL 2026-07-14 12:30', '# PATCH MANUAL x'),
    );
    expect(v.ok).toBe(false);
    expect(v.motivos.join(' ')).toMatch(/PATCH MANUAL/);
  });

  it('aprova o resultado da extração da fixture', () => {
    const { promptLimpo, blocos } = extrairPatches(PROMPT_COM_PATCHES_MANUAIS);
    const v = validarPromptLimpo(PROMPT_COM_PATCHES_MANUAIS, promptLimpo, blocos);
    expect(v.ok).toBe(true);
    expect(v.motivos).toEqual([]);
  });

  it('com a lista de blocos, a conta é "original menos o que saiu"', () => {
    // Um prompt que é quase todo patch encolhe muito, e está certo. O que a
    // régua precisa pegar é o encolhimento que os blocos NÃO explicam.
    const { blocos } = extrairPatches(PROMPT_COM_PATCHES_MANUAIS);
    const mutilado = '## IDENTIDADE\nVocê é a Marcia.';
    const v = validarPromptLimpo(PROMPT_COM_PATCHES_MANUAIS, mutilado, blocos);
    expect(v.ok).toBe(false);
    expect(v.motivos.join(' ')).toMatch(/blocos removidos explicam/);
  });

  it('prompt sem identidade nenhuma no original não inventa exigência', () => {
    const antes = 'texto qualquer sem cabeçalho de identidade, com bastante corpo para medir.';
    const v = validarPromptLimpo(antes, antes);
    expect(v.ok).toBe(true);
  });
});

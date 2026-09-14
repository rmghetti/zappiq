/* ══════════════════════════════════════════════════════════════════════
 * A tabela de destino é um contrato, não uma sugestão.
 *
 * Ela responde, para CADA pergunta do questionário, onde a resposta vai
 * parar: instrução do agente, fato oficial, base consultável, configuração
 * do sistema ou lugar nenhum. Sem esse contrato, tudo caía na busca
 * vetorial com rótulo de código (A023) e o dono respondia 20 perguntas que
 * nenhum código executa (A211).
 *
 * O que estes testes trancam:
 *   1. Pergunta sem destino não existe. Qualquer pergunta nova no catálogo
 *      quebra a suíte até alguém decidir para onde ela vai.
 *   2. As 20 perguntas de função do sistema estão marcadas como tal, com
 *      'em breve' quando o produto ainda não faz, e NENHUMA delas é
 *      obrigatória: ninguém é obrigado a configurar o que não acontece.
 *   3. A ordem das regras é total e sem repetição, porque é ela que decide
 *      o que sobrevive ao teto do bloco de instruções.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';

import { GLOBAL_SURVEY_BLOCKS } from './surveyTypes.js';
import { SEGMENT_SURVEYS } from './surveySegmentQuestions.js';
import {
  DESTINO_POR_PERGUNTA,
  ORDEM_DAS_REGRAS,
  PERGUNTAS_DE_FUNCAO_DO_SISTEMA,
  PERGUNTA_POR_ID,
  destinoDaPergunta,
  perguntasComDestino,
  type Destino,
} from './surveyDestino.js';

const IDS_GLOBAIS = GLOBAL_SURVEY_BLOCKS.flatMap((b) => b.questions.map((q) => q.id));
const IDS_DE_SEGMENTO = Object.values(SEGMENT_SURVEYS)
  .flat()
  .flatMap((b) => b.questions.map((q) => q.id));

describe('tabela de destino por pergunta', () => {
  it('cobre TODA pergunta global com um destino explícito', () => {
    const semDestino = IDS_GLOBAIS.filter((id) => !DESTINO_POR_PERGUNTA[id]);
    expect(semDestino).toEqual([]);
    expect(IDS_GLOBAIS.length).toBeGreaterThan(200);
  });

  it('resolve toda pergunta de segmento e de especialidade como base consultável', () => {
    const semDestino = IDS_DE_SEGMENTO.filter((id) => destinoDaPergunta(id)?.destino !== 'base');
    expect(semDestino).toEqual([]);
    expect(IDS_DE_SEGMENTO.length).toBeGreaterThan(300);
  });

  it('não inventa destino para chave que não é pergunta', () => {
    expect(destinoDaPergunta('chave_que_nao_existe')).toBeUndefined();
  });

  it('conhece o texto de cada pergunta, não só a chave', () => {
    expect(PERGUNTA_POR_ID.get('pre_quando_informar_preco')?.label).toBe(
      'Quando a IA deve informar o preço?',
    );
    // A pergunta de segmento também: é ela que sumia do RAG virando
    // '[object Object]' (A006).
    expect(PERGUNTA_POR_ID.get('academia_modalidades_oferecidas')?.label).toContain('modalidades');
  });

  it('diz de qual seção do questionário cada pergunta veio', () => {
    expect(PERGUNTA_POR_ID.get('pre_tabela_precos')?.secaoId).toBe('precos_condicoes');
    expect(PERGUNTA_POR_ID.get('pre_tabela_precos')?.secaoTitulo).toBeTruthy();
  });
});

describe('função do sistema (A211)', () => {
  it('marca exatamente as 20 perguntas que configuram comportamento da plataforma', () => {
    expect(PERGUNTAS_DE_FUNCAO_DO_SISTEMA).toHaveLength(20);
    expect(perguntasComDestino('funcao_do_sistema').sort()).toEqual(
      [...PERGUNTAS_DE_FUNCAO_DO_SISTEMA].sort(),
    );
  });

  it('cada uma está em breve ou aponta a configuração que manda de verdade', () => {
    for (const id of PERGUNTAS_DE_FUNCAO_DO_SISTEMA) {
      const registro = DESTINO_POR_PERGUNTA[id];
      const emBreve = registro.emBreve === true;
      const temConfiguracao = Boolean(registro.configuracaoReal);
      expect(
        emBreve !== temConfiguracao,
        `${id} precisa ser 'em breve' OU apontar a configuração real, nunca os dois nem nenhum`,
      ).toBe(true);
    }
  });

  it('a mensagem de transferência aponta para o campo que o produto realmente usa', () => {
    expect(DESTINO_POR_PERGUNTA['esc_mensagem_transicao'].configuracaoReal).toBe('handoffMessage');
  });

  it('nenhuma delas continua obrigatória no formulário', () => {
    const obrigatorias = GLOBAL_SURVEY_BLOCKS.flatMap((b) => b.questions)
      .filter((q) => q.required && PERGUNTAS_DE_FUNCAO_DO_SISTEMA.includes(q.id))
      .map((q) => q.id);
    expect(obrigatorias).toEqual([]);
  });

  it('não vai para a base consultável nem para as instruções', () => {
    for (const id of PERGUNTAS_DE_FUNCAO_DO_SISTEMA) {
      expect(DESTINO_POR_PERGUNTA[id].destino).toBe('funcao_do_sistema');
    }
  });
});

describe('regras que entram nas instruções do agente', () => {
  it('inclui a política de preço e desconto citada no plano', () => {
    const instrucoes = perguntasComDestino('instrucao');
    for (const id of [
      'pre_quando_informar_preco',
      'pre_desconto_maximo',
      'pre_quem_aprova_desconto',
      'pre_negociacao_ia',
      'pos_palavras_proibidas',
      'pos_o_que_nao_somos',
      'faq_respostas_proibidas',
      'qual_perguntas_obrigatorias',
      'qual_desqualificacao',
    ]) {
      expect(instrucoes, `${id} tinha de ser instrução`).toContain(id);
    }
  });

  it('leva tom, regras da IA e escalonamento, menos o que é função do sistema', () => {
    const instrucoes = new Set(perguntasComDestino('instrucao'));
    const familias = IDS_GLOBAIS.filter((id) => /^(tom_|reg_|esc_)/.test(id));
    for (const id of familias) {
      const destino = DESTINO_POR_PERGUNTA[id].destino;
      const esperado: Destino[] = ['instrucao', 'funcao_do_sistema', 'fato_oficial'];
      expect(esperado, `${id} caiu em ${destino}`).toContain(destino);
    }
    expect(instrucoes.has('tom_como_dizer_nao')).toBe(true);
    expect(instrucoes.has('reg_nao_pode_prometer')).toBe(true);
    expect(instrucoes.has('esc_situacoes_obrigatorias')).toBe(true);
    // Estas duas são o MESMO dado das configurações (tom e nome do agente).
    // Repetir no bloco de regras só gastaria token dizendo o que a linha de
    // cima já disse.
    expect(instrucoes.has('tom_principal')).toBe(false);
    expect(instrucoes.has('tom_nome_ia')).toBe(false);
  });

  it('a ordem das regras é total, sem repetição e sem sobra', () => {
    const instrucoes = perguntasComDestino('instrucao').sort();
    expect([...ORDEM_DAS_REGRAS].sort()).toEqual(instrucoes);
    expect(new Set(ORDEM_DAS_REGRAS).size).toBe(ORDEM_DAS_REGRAS.length);
  });

  it('preço e desconto vêm antes do resto, porque o teto corta o fim', () => {
    const posicao = (id: string) => ORDEM_DAS_REGRAS.indexOf(id);
    expect(posicao('pre_desconto_maximo')).toBeLessThan(posicao('tom_audio_imagem'));
    expect(posicao('pre_quem_aprova_desconto')).toBeLessThan(posicao('tom_audio_imagem'));
    expect(posicao('faq_respostas_proibidas')).toBeLessThan(posicao('tom_audio_imagem'));
  });
});

describe('o que nunca chega ao modelo', () => {
  it('mantém margem, métrica interna e concorrente fora da IA', () => {
    for (const id of ['com_maior_margem', 'crm_ltv', 'pos_concorrentes', 'pub_perfil_nao_desejado']) {
      expect(DESTINO_POR_PERGUNTA[id].destino, id).toBe('fora_da_ia');
    }
  });

  it('todo destino fora_da_ia explica o porquê', () => {
    for (const id of perguntasComDestino('fora_da_ia')) {
      expect(DESTINO_POR_PERGUNTA[id].motivo, id).toBeTruthy();
    }
  });
});

describe('fatos oficiais', () => {
  it('apontam o campo de configuração que é a fonte única', () => {
    for (const id of perguntasComDestino('fato_oficial')) {
      expect(DESTINO_POR_PERGUNTA[id].configuracaoReal, id).toBeTruthy();
    }
    expect(DESTINO_POR_PERGUNTA['tom_nome_ia'].configuracaoReal).toBe('agentName');
    expect(DESTINO_POR_PERGUNTA['tom_principal'].configuracaoReal).toBe('tone');
  });
});

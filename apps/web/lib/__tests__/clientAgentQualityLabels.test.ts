/**
 * A151 — o cliente não pode ler id técnico nem travessão solto na tela.
 * ============================================================================
 * friendlyScenarioLabel tinha 10 entradas, e METADE delas era de um gabarito
 * antigo que não roda mais (handoff_objection, enterprise_qualification). Os
 * 17 cenários universais que rodam de verdade hoje não estavam lá: o dono do
 * negócio lia "cr7_no_invent_sla" na lista de comportamentos para revisar.
 *
 * Esta lista de ids é copiada do UNIVERSAL_EVAL_SET (apps/api). Se um cenário
 * novo entrar lá sem rótulo aqui, este teste cai.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { friendlyScenarioLabel, QUALITY_LABELS } from '../clientAgentQualityApi';

/** Os 17 ids do gabarito universal, na ordem em que aparecem no arquivo. */
const CENARIOS_UNIVERSAIS = [
  'cr1_aceitacao_pos_oferta',
  'cr1_sim_sem_contexto',
  'cr2_quero_humano_explicito',
  'cr2_humano_por_favor',
  'cr2_pergunta_operacional_nao_e_handoff',
  'cr3_no_como_posso_ajudar',
  'cr3_no_consultora_virtual',
  'cr4_no_audio_brackets',
  'cr5_nome_disponivel_usar',
  'cr5_nome_ausente_perguntar',
  'cr6_resposta_concisa',
  'cr7_no_invent_preco_desconto',
  'cr7_no_invent_sla',
  'cr7_preco_da_base_correto',
  'cr8_no_pede_cpf',
  'cr8_no_pede_cartao',
  'cr9_nao_assume_marca_de_terceiro',
];

describe('friendlyScenarioLabel cobre o gabarito universal inteiro', () => {
  it('nenhum dos 17 cenários cai no id técnico', () => {
    const semRotulo = CENARIOS_UNIVERSAIS.filter((id) => friendlyScenarioLabel(id) === id);
    expect(semRotulo).toEqual([]);
  });

  it('nenhum rótulo mostra underline, prefixo cr ou travessão', () => {
    for (const id of CENARIOS_UNIVERSAIS) {
      const rotulo = friendlyScenarioLabel(id);
      expect(rotulo, id).not.toContain('_');
      expect(rotulo, id).not.toContain('—');
      expect(rotulo, id).not.toMatch(/^cr\d/);
    }
  });

  it('id desconhecido continua caindo no texto de apoio, e depois no id', () => {
    expect(friendlyScenarioLabel('cenario_que_nao_existe', 'Texto do gabarito')).toBe(
      'Texto do gabarito',
    );
    expect(friendlyScenarioLabel('cenario_que_nao_existe')).toBe('cenario_que_nao_existe');
  });
});

describe('QUALITY_LABELS não coloca travessão na tela', () => {
  it('o estado sem nota é escrito por extenso', () => {
    expect(QUALITY_LABELS.unknown.label).toBe('Sem nota');
  });

  it('nenhum rótulo de saúde tem travessão', () => {
    for (const r of Object.values(QUALITY_LABELS)) {
      expect(r.label).not.toContain('—');
    }
  });
});

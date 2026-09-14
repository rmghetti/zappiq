/**
 * Configurações grava o perfil do agente por chave, na fonte única (A156, A170).
 * ==========================================================================
 * O PUT /api/settings troca o JSON inteiro de settings: a tela lê, mescla no
 * navegador e devolve o objeto completo. Duas abas abertas, ou uma leitura
 * velha, e o que estava lá some (add-on pago, segredo de integração,
 * respostas do treinamento). Estes testes trancam o caminho novo: mescla no
 * servidor, só as chaves do perfil, e nada mais é tocado.
 */
import { describe, it, expect } from 'vitest';
import {
  perfilDoAgenteSchema,
  businessHoursConfigSchema,
  mergePerfilDoAgente,
} from './settings.perfilDoAgente.js';

const HORARIO = {
  timezone: 'America/Sao_Paulo',
  days: {
    '0': null,
    '1': { open: '09:00', close: '18:00' },
    '6': { open: '09:00', close: '13:00' },
  },
};

describe('perfilDoAgenteSchema: só o perfil do agente entra', () => {
  it('aceita os campos do perfil', () => {
    const r = perfilDoAgenteSchema.safeParse({
      agentName: 'Vera',
      tone: 'formal',
      segmento: 'servicos_b2b',
      handoffMessage: 'Já chamo a Marcia.',
      businessHoursConfig: HORARIO,
    });
    expect(r.success).toBe(true);
  });

  it('aceita um campo só (salvar horário não exige mandar o resto)', () => {
    expect(perfilDoAgenteSchema.safeParse({ businessHoursConfig: HORARIO }).success).toBe(true);
    expect(perfilDoAgenteSchema.safeParse({ tone: 'friendly' }).success).toBe(true);
  });

  it('REJEITA corpo vazio (nada a salvar não é salvar tudo)', () => {
    expect(perfilDoAgenteSchema.safeParse({}).success).toBe(false);
  });

  it('REJEITA qualquer chave fora da lista, inclusive settings inteiro', () => {
    for (const corpo of [
      { settings: { qualquerCoisa: 1 } },
      { plan: 'ENTERPRISE' },
      { addons: ['SCHEDULING_AGENT'] },
      { whatsappAccessToken: 'roubado' },
      { agentName: 'Vera', plan: 'ENTERPRISE' },
    ]) {
      expect(perfilDoAgenteSchema.safeParse(corpo).success, JSON.stringify(corpo)).toBe(false);
    }
  });

  it('REJEITA nome vazio e nome gigante', () => {
    expect(perfilDoAgenteSchema.safeParse({ agentName: '   ' }).success).toBe(false);
    expect(perfilDoAgenteSchema.safeParse({ agentName: 'x'.repeat(200) }).success).toBe(false);
  });

  it('tira o espaço do nome (o cadastro gravou "Tauã " com espaço no fim)', () => {
    const r = perfilDoAgenteSchema.safeParse({ agentName: '  Tauã  ' });
    expect(r.success && r.data.agentName).toBe('Tauã');
  });
});

describe('businessHoursConfigSchema: formato único, com fuso', () => {
  it('aceita o formato que o Maestro já avalia', () => {
    expect(businessHoursConfigSchema.safeParse(HORARIO).success).toBe(true);
  });

  it('REJEITA hora fora do formato HH:mm', () => {
    for (const janela of [{ open: '9h', close: '18h' }, { open: '25:00', close: '26:00' }, { open: '09:00' }]) {
      const r = businessHoursConfigSchema.safeParse({ timezone: 'America/Sao_Paulo', days: { '1': janela } });
      expect(r.success, JSON.stringify(janela)).toBe(false);
    }
  });

  it('REJEITA dia fora de 0 a 6', () => {
    const r = businessHoursConfigSchema.safeParse({
      timezone: 'America/Sao_Paulo',
      days: { '7': { open: '09:00', close: '18:00' } },
    });
    expect(r.success).toBe(false);
  });

  it('dia fechado é null explícito, e isso passa', () => {
    const r = businessHoursConfigSchema.safeParse({ timezone: 'America/Sao_Paulo', days: { '0': null } });
    expect(r.success).toBe(true);
  });
});

describe('mergePerfilDoAgente: nunca troca o JSON inteiro', () => {
  const ATUAIS = {
    addons: ['SCHEDULING_AGENT'],
    surveyAnswers: { identidade_empresa: { ide_site_url: 'cmj.com.br' } },
    integracaoSecreta: { token: 'nao-pode-sumir' },
    agentName: 'Vera',
    tone: 'friendly',
    niche: 'generic',
    segmento: 'generic',
  };

  it('o que não veio no corpo continua intacto', () => {
    const { settings } = mergePerfilDoAgente(ATUAIS, { tone: 'formal' });
    expect(settings.addons).toEqual(['SCHEDULING_AGENT']);
    expect(settings.surveyAnswers).toEqual(ATUAIS.surveyAnswers);
    expect(settings.integracaoSecreta).toEqual({ token: 'nao-pode-sumir' });
    expect(settings.agentName).toBe('Vera');
    expect(settings.tone).toBe('formal');
  });

  it('segmento e niche andam juntos (a tela grava um, o prompt lê o outro)', () => {
    const { settings, alterados } = mergePerfilDoAgente(ATUAIS, { segmento: 'dentista' });
    expect(settings.segmento).toBe('dentista');
    expect(settings.niche).toBe('dentista');
    expect(alterados).toEqual(['segmento', 'niche']);
  });

  it('nome novo é devolvido para disparar a sincronia do agente (A170)', () => {
    const { nomeNovo } = mergePerfilDoAgente(ATUAIS, { agentName: 'Sofia' });
    expect(nomeNovo).toBe('Sofia');
  });

  it('nome igual ao que já está gravado não dispara sincronia nem alteração', () => {
    const { nomeNovo, alterados } = mergePerfilDoAgente(ATUAIS, { agentName: 'Vera' });
    expect(nomeNovo).toBeNull();
    expect(alterados).toEqual([]);
  });

  it('horário entra como está, e null limpa sem apagar o resto', () => {
    const comHorario = mergePerfilDoAgente(ATUAIS, { businessHoursConfig: HORARIO as any });
    expect(comHorario.settings.businessHoursConfig).toEqual(HORARIO);

    const limpo = mergePerfilDoAgente(comHorario.settings, { businessHoursConfig: null });
    expect(limpo.settings.businessHoursConfig).toBeNull();
    expect(limpo.settings.addons).toEqual(['SCHEDULING_AGENT']);
  });

  it('organização sem settings nenhum não quebra', () => {
    const { settings } = mergePerfilDoAgente(null, { agentName: 'Vera' });
    expect(settings).toEqual({ agentName: 'Vera' });
  });

  it('salvar duas vezes o mesmo valor não marca alteração (não versiona à toa)', () => {
    const primeiro = mergePerfilDoAgente(ATUAIS, { tone: 'formal' });
    const segundo = mergePerfilDoAgente(primeiro.settings, { tone: 'formal' });
    expect(segundo.alterados).toEqual([]);
  });
});

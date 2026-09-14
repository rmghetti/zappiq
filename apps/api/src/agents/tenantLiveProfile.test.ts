/* ══════════════════════════════════════════════════════════════════════
 * tenantLiveProfile: o que a IA recebe sobre a própria empresa, a cada turno.
 * --------------------------------------------------------------------
 * O que estes testes trancam (achados A058, A059, A060, A070, A153, A164):
 *   • o horário sai do que o cliente preencheu, nos TRÊS formatos que existem
 *     no banco hoje, e ausência de horário NUNCA vira "Domingo: Fechado";
 *   • "Agora: aberto|fechado" é conta de código (isOpen), não palpite do modelo;
 *   • o bloco tem teto de tamanho, porque ele entra em todo turno pago;
 *   • sem agendamento de verdade, o bloco proíbe prometer agendamento.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import {
  buildLiveProfileBlock,
  normalizarHorario,
  LIVE_PROFILE_MAX_CHARS,
  TEXTO_HORARIO_AUSENTE,
} from './tenantLiveProfile.js';

const PERFIL = { agentName: 'Vera', businessName: 'CMJ' };

// Formato do painel de Configurações (o que o Maestro já usa).
const CONFIG = {
  timezone: 'America/Sao_Paulo',
  days: {
    0: null,
    1: { open: '09:00', close: '18:00' },
    2: { open: '09:00', close: '18:00' },
    3: { open: '09:00', close: '18:00' },
    4: { open: '09:00', close: '18:00' },
    5: { open: '09:00', close: '18:00' },
    6: { open: '09:00', close: '13:00' },
  },
};

describe('normalizarHorario: os três formatos que existem no banco', () => {
  it('businessHoursConfig (fonte única): agrupa dias iguais e diz o fuso', () => {
    const r = normalizarHorario({ businessHoursConfig: CONFIG });
    expect(r.formato).toBe('config');
    expect(r.config).not.toBeNull();
    expect(r.texto).toContain('Segunda a sexta: 09:00 às 18:00');
    expect(r.texto).toContain('Sábado: 09:00 às 13:00');
    expect(r.texto).toContain('Domingo: fechado');
  });

  it('businessHours em inglês (painel de identidade): só o que existe', () => {
    const r = normalizarHorario({
      businessHours: { weekdays: '09:00 às 18:00', saturday: '09:00 às 13:00' },
    });
    expect(r.formato).toBe('ingles');
    expect(r.texto).toContain('Segunda a sexta: 09:00 às 18:00');
    expect(r.texto).toContain('Sábado: 09:00 às 13:00');
    // O bug A059 em uma linha: sem dado de domingo, ninguém afirma domingo.
    expect(r.texto).not.toMatch(/Domingo/i);
    expect(r.config).toBeNull();
  });

  it('businessHours em português (cadastro): converte 12:00-22:00 em texto', () => {
    const r = normalizarHorario({
      businessHours: {
        Segunda: 'fechado',
        Terça: '12:00-22:00',
        Quarta: '12:00-22:00',
        Quinta: '12:00-22:00',
        Sexta: '12:00-22:00',
        Sábado: '12:00-23:00',
        Domingo: '12:00-22:00',
      },
    });
    expect(r.formato).toBe('portugues');
    expect(r.texto).toContain('Terça a sexta: 12:00 às 22:00');
    expect(r.texto).toContain('Sábado: 12:00 às 23:00');
    // A Antonella abre domingo e o prompt dela dizia "Domingo: Fechado".
    expect(r.texto).toContain('Domingo: 12:00 às 22:00');
    expect(r.texto).toContain('Segunda: fechado');
  });

  it('sem horário nenhum: ausência, nunca afirmação', () => {
    for (const s of [undefined, null, {}, { businessHours: {} }, { businessHoursConfig: {} }]) {
      const r = normalizarHorario(s as any);
      expect(r.formato).toBeNull();
      expect(r.texto).toBeNull();
      expect(r.config).toBeNull();
    }
  });

  it('businessHoursConfig com todos os dias fechados não é "sem horário"', () => {
    const r = normalizarHorario({
      businessHoursConfig: { timezone: 'America/Sao_Paulo', days: { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null } },
    });
    expect(r.formato).toBe('config');
    expect(r.texto).toContain('fechado');
  });

  it('businessHoursConfig tem precedência sobre os formatos legados', () => {
    const r = normalizarHorario({
      businessHoursConfig: CONFIG,
      businessHours: { weekdays: 'texto velho' },
    });
    expect(r.formato).toBe('config');
    expect(r.texto).not.toContain('texto velho');
  });
});

describe('buildLiveProfileBlock: o que a IA recebe', () => {
  it('monta identidade, tom, horário e "agora" a partir das settings', () => {
    const bloco = buildLiveProfileBlock(
      { agentName: 'Vera', businessName: 'CMJ', tone: 'formal', businessHoursConfig: CONFIG },
      PERFIL,
      // quarta-feira, 14:00 em São Paulo (17:00 UTC)
      { now: new Date('2026-09-16T17:00:00Z') },
    );
    expect(bloco).toContain('# Como você atende nesta empresa');
    expect(bloco).toContain('Você é Vera');
    expect(bloco).toContain('CMJ');
    expect(bloco).toContain('Tom de voz:');
    expect(bloco).toContain('Horário de atendimento humano: ');
    expect(bloco).toContain('Agora: aberto');
  });

  it('"Agora: fechado" quando o relógio está fora da janela', () => {
    const bloco = buildLiveProfileBlock(
      { businessHoursConfig: CONFIG },
      PERFIL,
      // domingo (dia fechado no CONFIG)
      { now: new Date('2026-09-13T17:00:00Z') },
    );
    expect(bloco).toContain('Agora: fechado');
  });

  it('sem businessHoursConfig NÃO inventa "agora" (não dá para calcular)', () => {
    const bloco = buildLiveProfileBlock(
      { businessHours: { weekdays: '09:00 às 18:00' } },
      PERFIL,
      { now: new Date('2026-09-16T17:00:00Z') },
    );
    expect(bloco).toContain('09:00 às 18:00');
    expect(bloco).not.toContain('Agora:');
  });

  it('sem horário: manda confirmar, em vez de afirmar dia ou horário', () => {
    const bloco = buildLiveProfileBlock({ agentName: 'Vera' }, PERFIL, {});
    expect(bloco).toContain(TEXTO_HORARIO_AUSENTE);
    expect(bloco).not.toMatch(/Domingo:\s*Fechado/i);
  });

  it('handoffMessage entra só quando o dono configurou', () => {
    const com = buildLiveProfileBlock({ handoffMessage: 'Já chamo a Marcia para você.' }, PERFIL, {});
    expect(com).toContain('Já chamo a Marcia para você.');
    const sem = buildLiveProfileBlock({}, PERFIL, {});
    expect(sem).not.toContain('Ao transferir');
  });

  it('agendamento ativo: lista os tipos reais', () => {
    const bloco = buildLiveProfileBlock({}, PERFIL, {
      agendamento: { ativo: true, tipos: ['Avaliação', 'Retorno'] },
    });
    expect(bloco).toContain('Agendamento: disponível para: Avaliação, Retorno');
  });

  it('sem agendamento: proíbe prometer agendamento (A153, A164, A194)', () => {
    const bloco = buildLiveProfileBlock({}, PERFIL, { agendamento: { ativo: false } });
    expect(bloco).toContain('não ofereça agendamento por aqui');
    expect(bloco).not.toContain('lembrete');
  });

  it('agendamento ausente no contexto: bloco não fala de agendamento', () => {
    const bloco = buildLiveProfileBlock({}, PERFIL, {});
    expect(bloco).not.toContain('Agendamento:');
  });

  it('teto de 1.500 caracteres mesmo com settings gigantes', () => {
    const gigante = 'x'.repeat(9000);
    const bloco = buildLiveProfileBlock(
      {
        agentName: gigante,
        businessName: gigante,
        tone: gigante,
        handoffMessage: gigante,
        businessHours: { weekdays: gigante, saturday: gigante, sunday: gigante, holidays: gigante },
      },
      PERFIL,
      { agendamento: { ativo: true, tipos: Array.from({ length: 200 }, (_, i) => `Tipo ${i} ${gigante}`) } },
    );
    expect(bloco.length).toBeLessThanOrEqual(LIVE_PROFILE_MAX_CHARS);
    expect(LIVE_PROFILE_MAX_CHARS).toBe(1500);
    // Cortar não pode deixar linha pela metade nem apagar o cabeçalho.
    expect(bloco.startsWith('# Como você atende nesta empresa')).toBe(true);
    expect(bloco.endsWith('\n')).toBe(false);
  });

  it('organização que não preencheu nada ainda recebe a trava de horário', () => {
    // Não é bloco oco: é exatamente a organização que mais precisa ouvir
    // "não afirme horário", porque não há dado nenhum para sustentar.
    for (const s of [{}, null]) {
      const bloco = buildLiveProfileBlock(s as any, null, {});
      expect(bloco).toContain(TEXTO_HORARIO_AUSENTE);
      expect(bloco).not.toContain('Você é');
      expect(bloco).not.toContain('Tom de voz');
    }
  });

  it('o perfil resolvido do agente vence as settings quando elas estão vazias', () => {
    const bloco = buildLiveProfileBlock({}, { agentName: 'Vera', businessName: 'CMJ' }, {
      agendamento: { ativo: false },
    });
    expect(bloco).toContain('Você é Vera, de CMJ.');
  });

  it('tom fora do enum (texto do questionário) entra como o cliente escreveu', () => {
    const bloco = buildLiveProfileBlock({ tone: 'Consultivo e educativo' }, PERFIL, {});
    expect(bloco).toContain('Consultivo e educativo');
  });

  it('não usa travessão em texto que o modelo lê', () => {
    const bloco = buildLiveProfileBlock(
      { agentName: 'Vera', businessName: 'CMJ', tone: 'friendly', businessHoursConfig: CONFIG, handoffMessage: 'ok' },
      PERFIL,
      { now: new Date('2026-09-16T17:00:00Z'), agendamento: { ativo: false } },
    );
    expect(bloco).not.toContain('—');
  });
});

// ─────────────────────────────────────────────────────────────────────
// A059 de novo, agora pelo formato estruturado (revisão do PR #368)
// ---------------------------------------------------------------------
// O bug A059 era "ausência de dado vira afirmação de fechado". Ele estava
// curado no formato do painel e no do cadastro, mas voltava pelo
// businessHoursConfig: dia sem chave em `days` virava "fechado" na frase.
// Dia AUSENTE é "não informado"; dia declarado `null` é "fechado". As duas
// coisas têm significados diferentes para a IA e para o cliente final.
// ─────────────────────────────────────────────────────────────────────

describe('normalizarHorario: dia ausente no businessHoursConfig não vira fechado', () => {
  it('dia sem chave em days fica FORA da frase', () => {
    const r = normalizarHorario({
      businessHoursConfig: {
        timezone: 'America/Sao_Paulo',
        days: {
          1: { open: '09:00', close: '18:00' },
          2: { open: '09:00', close: '18:00' },
          3: { open: '09:00', close: '18:00' },
          4: { open: '09:00', close: '18:00' },
          5: { open: '09:00', close: '18:00' },
        },
      },
    });

    expect(r.formato).toBe('config');
    expect(r.texto).toContain('Segunda a sexta: 09:00 às 18:00');
    expect(r.texto).not.toMatch(/Domingo/i);
    expect(r.texto).not.toMatch(/Sábado/i);
    expect(r.texto).not.toMatch(/fechado/i);
  });

  it('dia declarado null continua dizendo fechado: ali o dono afirmou', () => {
    const r = normalizarHorario({
      businessHoursConfig: {
        timezone: 'America/Sao_Paulo',
        days: { 0: null, 1: { open: '09:00', close: '18:00' } },
      },
    });

    expect(r.texto).toContain('Domingo: fechado');
    expect(r.texto).not.toMatch(/Sábado/i);
  });

  it('config sem nenhum dia declarado cai em "não informado", não em fechado', () => {
    const bloco = buildLiveProfileBlock(
      { businessHoursConfig: { timezone: 'America/Sao_Paulo', days: {} } },
      PERFIL,
      { now: new Date('2026-09-14T15:00:00Z') },
    );

    expect(bloco).toContain(TEXTO_HORARIO_AUSENTE);
    expect(bloco).not.toMatch(/fechado/i);
    // Sem horário para valer, nem "Agora: fechado" pode sair: seria a mesma
    // afirmação inventada, só que por outro caminho.
    expect(bloco).not.toContain('- Agora:');
  });

  it('o bloco vivo não inventa sábado nem domingo quando o dono só declarou a semana', () => {
    const bloco = buildLiveProfileBlock(
      {
        businessHoursConfig: {
          timezone: 'America/Sao_Paulo',
          days: { 1: { open: '08:00', close: '17:00' }, 2: { open: '08:00', close: '17:00' } },
        },
      },
      PERFIL,
    );

    expect(bloco).toContain('Segunda e Terça: 08:00 às 17:00');
    expect(bloco).not.toMatch(/Domingo/i);
    expect(bloco).not.toMatch(/Sábado/i);
  });
});

describe('cabeçalho do bloco: precedência sem revogar as regras base', () => {
  it('diz que o dado vivo vence informação mais antiga SOBRE A EMPRESA, e só isso', () => {
    const bloco = buildLiveProfileBlock({ tone: 'formal' }, PERFIL);

    expect(bloco).toContain('valem mais que qualquer informação mais antiga sobre a empresa neste prompt');
    // A ressalva é o ponto: sem ela, "valem mais que qualquer trecho deste
    // prompt" dava ao tom escrito pelo dono poder de revogar o CORE.
    expect(bloco).toContain('As REGRAS BASE DO AGENTE continuam valendo acima de tudo.');
  });
});

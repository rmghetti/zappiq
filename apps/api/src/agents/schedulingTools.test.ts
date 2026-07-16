/* ══════════════════════════════════════════════════════════════════════
 * Tests da descrição do convite de agendamento.
 * --------------------------------------------------------------------
 * O convite do Google Calendar vai COM O LEAD do cliente como convidado, e
 * até 14/07/2026 a descrição era fixa: 'Agendado pela IA (ZappIQ).', marca
 * nossa no calendário do lead do CMJ. Agora sai a identidade do tenant.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { buildInviteDescription } from './schedulingTools.js';
import { findForeignBrandLeaks } from './tenantIsolationGuard.js';

describe('buildInviteDescription: o lead do cliente lê isto', () => {
  it('tenant identificado: usa o nome do agente e do negócio', () => {
    expect(buildInviteDescription({ agentName: 'Vera', businessName: 'CMJ' })).toBe(
      'Agendado por Vera, IA de CMJ.',
    );
  });

  it('só o negócio identificado: cita o negócio, sem inventar nome de agente', () => {
    expect(buildInviteDescription({ agentName: 'Assistente', businessName: 'CMJ' })).toBe(
      'Agendado pela IA de atendimento de CMJ.',
    );
  });

  it('org sem identidade preenchida: texto neutro, nada de "sua empresa"', () => {
    const d = buildInviteDescription({ agentName: 'Assistente', businessName: 'sua empresa' });
    expect(d).toBe('Agendado automaticamente pela IA de atendimento.');
    expect(d).not.toContain('sua empresa');
  });

  it('perfil null (lookup falhou): texto neutro, nunca quebra o agendamento', () => {
    expect(buildInviteDescription(null)).toBe('Agendado automaticamente pela IA de atendimento.');
  });

  it('nenhuma variação leva marca da ZappIQ pro convite do lead', () => {
    const casos = [
      { agentName: 'Vera', businessName: 'CMJ' },
      { agentName: 'Assistente', businessName: 'CMJ' },
      { agentName: 'Assistente', businessName: 'sua empresa' },
      null,
    ];
    for (const perfil of casos) {
      expect(findForeignBrandLeaks(buildInviteDescription(perfil))).toEqual([]);
    }
  });
});

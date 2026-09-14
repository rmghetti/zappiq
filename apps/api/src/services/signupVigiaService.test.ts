/* ══════════════════════════════════════════════════════════════════════
 * A242 — vigia dos cadastros que confirmaram e nunca viraram organização.
 *
 * Em 60 dias, 5 pessoas confirmaram o cadastro (linha em `signups` com
 * status active e usuário no Supabase Auth) e nenhuma virou organização,
 * usuário, agente ou Treinar IA. Ninguém ficou sabendo, porque não havia
 * evento nenhum entre "confirmou" e "criou a organização".
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi } from 'vitest';
import {
  selecionarOrfaos,
  runSignupOrfaosCycle,
  type LinhaDeSignup,
} from './signupVigiaService.js';

const AGORA = new Date('2026-09-14T12:00:00.000Z');

function linha(over: Partial<LinhaDeSignup> = {}): LinhaDeSignup {
  return {
    id: 'sig-1',
    status: 'active',
    plan_chosen: 'IZA_LITE',
    organization_id: null,
    confirmed_at: new Date('2026-09-10T12:00:00.000Z'),
    utm_source: 'google_organic',
    ...over,
  };
}

describe('selecionarOrfaos — quem conta como órfão', () => {
  it('confirmado há mais de 24 h e sem organização entra', () => {
    const r = selecionarOrfaos([linha()], AGORA);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('sig-1');
    expect(r[0].horasSemOrganizacao).toBeGreaterThan(24);
  });

  it('confirmado há 23 h ainda NÃO entra (o cliente pode estar respondendo)', () => {
    const r = selecionarOrfaos(
      [linha({ confirmed_at: new Date('2026-09-13T13:00:00.000Z') })],
      AGORA,
    );
    expect(r).toHaveLength(0);
  });

  it('exatamente 24 h não entra; 24 h e um minuto entra', () => {
    const vinteQuatro = new Date(AGORA.getTime() - 24 * 60 * 60 * 1000);
    expect(selecionarOrfaos([linha({ confirmed_at: vinteQuatro })], AGORA)).toHaveLength(0);
    const umPoucoMais = new Date(vinteQuatro.getTime() - 60 * 1000);
    expect(selecionarOrfaos([linha({ confirmed_at: umPoucoMais })], AGORA)).toHaveLength(1);
  });

  it('com organização ligada NÃO entra (foi o caminho feliz)', () => {
    expect(selecionarOrfaos([linha({ organization_id: 'org-1' })], AGORA)).toHaveLength(0);
  });

  it('sem confirmação NÃO entra (o lead nem clicou no link do e-mail)', () => {
    expect(
      selecionarOrfaos([linha({ confirmed_at: null, status: 'pending_email' })], AGORA),
    ).toHaveLength(0);
  });

  it('aceita data em texto, que é como o driver devolve a coluna', () => {
    const r = selecionarOrfaos(
      [linha({ confirmed_at: '2026-09-10T12:00:00.000Z' as unknown as Date })],
      AGORA,
    );
    expect(r).toHaveLength(1);
  });

  it('ordena do mais antigo para o mais novo (quem espera há mais tempo primeiro)', () => {
    const r = selecionarOrfaos(
      [
        linha({ id: 'novo', confirmed_at: new Date('2026-09-12T12:00:00.000Z') }),
        linha({ id: 'antigo', confirmed_at: new Date('2026-07-23T00:00:00.000Z') }),
      ],
      AGORA,
    );
    expect(r.map((x) => x.id)).toEqual(['antigo', 'novo']);
  });
});

describe('runSignupOrfaosCycle — o alerta sai e não se repete no mesmo dia', () => {
  function deps(over: Record<string, any> = {}) {
    return {
      agora: AGORA,
      buscarSignups: vi.fn(async () => [linha(), linha({ id: 'sig-2' })]),
      jaAvisouHoje: vi.fn(async () => false),
      criarTarefa: vi.fn(async () => 'task-1'),
      alertarNoSlack: vi.fn(async () => true),
      ...over,
    };
  }

  it('encontra os órfãos, cria a tarefa e manda o alerta', async () => {
    const d = deps();
    const r = await runSignupOrfaosCycle(d);

    expect(r.encontrados).toBe(2);
    expect(r.avisou).toBe(true);
    expect(d.criarTarefa).toHaveBeenCalledTimes(1);
    expect(d.alertarNoSlack).toHaveBeenCalledTimes(1);
  });

  it('a tarefa NÃO carrega e-mail nem nome do lead (LGPD)', async () => {
    const d = deps({
      buscarSignups: vi.fn(async () => [linha({ id: 'sig-1' })]),
    });
    await runSignupOrfaosCycle(d);

    const texto = JSON.stringify(d.criarTarefa.mock.calls[0][0]);
    expect(texto).not.toContain('@');
    expect(texto).toContain('sig-1');
  });

  it('sem órfão, não cria tarefa e não alerta', async () => {
    const d = deps({ buscarSignups: vi.fn(async () => []) });
    const r = await runSignupOrfaosCycle(d);

    expect(r.encontrados).toBe(0);
    expect(r.avisou).toBe(false);
    expect(d.criarTarefa).not.toHaveBeenCalled();
    expect(d.alertarNoSlack).not.toHaveBeenCalled();
  });

  it('se já avisou hoje, conta os órfãos mas não cria a segunda tarefa', async () => {
    const d = deps({ jaAvisouHoje: vi.fn(async () => true) });
    const r = await runSignupOrfaosCycle(d);

    expect(r.encontrados).toBe(2);
    expect(r.avisou).toBe(false);
    expect(d.criarTarefa).not.toHaveBeenCalled();
  });

  it('falha ao criar a tarefa não derruba o ciclo (o Slack ainda sai)', async () => {
    const d = deps({
      criarTarefa: vi.fn(async () => {
        throw new Error('banco fora');
      }),
    });
    const r = await runSignupOrfaosCycle(d);

    expect(r.encontrados).toBe(2);
    expect(d.alertarNoSlack).toHaveBeenCalledTimes(1);
  });

  it('falha ao ler o banco devolve zero em vez de quebrar o worker do cron', async () => {
    const d = deps({
      buscarSignups: vi.fn(async () => {
        throw new Error('banco fora');
      }),
    });
    const r = await runSignupOrfaosCycle(d);
    expect(r.encontrados).toBe(0);
    expect(r.erro).toBe(true);
  });
});

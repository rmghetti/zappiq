/**
 * flowEffects.consolidacao.test.ts — Resposta Meta out/2026 (PR-I)
 * ============================================================================
 * Consolidador de balões do Maestro: send_text CONSECUTIVOS viram UM único
 * envio (separador de linha em branco), atrás da flag por org
 * settings.flags.consolidarBaloes:
 *   ✓ flag LIGADA: 3 send_text seguidos viram 1 balão (e 1 Message)
 *   ✓ flag DESLIGADA: 3 send_text seguem virando 3 balões (comportamento antigo)
 *   ✓ sem flag: default LIGADO pra org criada a partir de 2026-10-01 e
 *     DESLIGADO pras anteriores (coorte por createdAt)
 *   ✓ efeito não-texto no meio quebra a sequência (só adjacentes se juntam)
 *   ✓ caller que passa consolidarBaloes decide sem consulta ao banco
 *   ✓ lote sem send_text consecutivos: zero consulta extra (caminho comum)
 *   ✓ consolidarSendTextConsecutivos (pura) preserva ordem e não muta entrada
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    organization: { findUnique: vi.fn() },
    message: { create: vi.fn() },
    contact: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));

vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const sendReplyTextMock = vi.fn(async () => ({
  channel: 'whatsapp' as const,
  externalMessageId: 'wamid-out',
}));
vi.mock('../services/channelDispatcher.js', () => ({
  sendReplyText: (...a: unknown[]) => sendReplyTextMock(...(a as [])),
  sendReplyInteractive: vi.fn(async () => ({ channel: 'whatsapp', externalMessageId: 'x' })),
  sendReplyMedia: vi.fn(async () => ({ channel: 'whatsapp', externalMessageId: 'y' })),
}));

const {
  executeFlowEffects,
  consolidarSendTextConsecutivos,
  temSendTextConsecutivos,
  resolverConsolidarBaloes,
  CORTE_CONSOLIDACAO_BALOES,
} = await import('./flowEffects.js');
import type { FlowEffect } from './flowEngine.js';

const TRES_BALOES: FlowEffect[] = [
  { kind: 'send_text', text: 'Oi! Bem-vindo.' },
  { kind: 'send_text', text: 'Somos a Clínica X.' },
  { kind: 'send_text', text: 'Como posso ajudar?' },
];

const TEXTO_CONSOLIDADO = 'Oi! Bem-vindo.\n\nSomos a Clínica X.\n\nComo posso ajudar?';

function orgRow(overrides: Record<string, unknown> = {}) {
  return {
    settings: {},
    createdAt: new Date('2026-11-15T12:00:00Z'), // coorte nova por default
    ...overrides,
  };
}

function inputBase(effects: FlowEffect[], extra: Record<string, unknown> = {}) {
  return {
    organizationId: 'org-1',
    conversationId: 'conv-1',
    contactId: 'contact-1',
    effects,
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.organization.findUnique.mockResolvedValue(orgRow());
  prismaMock.message.create.mockResolvedValue({ id: 'msg-1' });
  prismaMock.contact.findUnique.mockResolvedValue({ tags: [] });
  prismaMock.contact.update.mockResolvedValue({});
});

describe('executeFlowEffects — flag explícita da org', () => {
  it('flag LIGADA: 3 send_text seguidos viram 1 balão só', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(
      orgRow({ settings: { flags: { consolidarBaloes: true } } }),
    );

    await executeFlowEffects(inputBase(TRES_BALOES));

    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
    expect(sendReplyTextMock.mock.calls[0][0]).toMatchObject({
      organizationId: 'org-1',
      conversationId: 'conv-1',
      content: TEXTO_CONSOLIDADO,
    });
    // E UM único Message persistido, com o texto consolidado.
    expect(prismaMock.message.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.message.create.mock.calls[0][0].data).toMatchObject({
      content: TEXTO_CONSOLIDADO,
      isFromBot: true,
    });
  });

  it('flag DESLIGADA: 3 send_text seguem como 3 balões (comportamento antigo)', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(
      orgRow({ settings: { flags: { consolidarBaloes: false } } }),
    );

    await executeFlowEffects(inputBase(TRES_BALOES));

    expect(sendReplyTextMock).toHaveBeenCalledTimes(3);
    expect(sendReplyTextMock.mock.calls.map((c: any[]) => c[0].content)).toEqual([
      'Oi! Bem-vindo.',
      'Somos a Clínica X.',
      'Como posso ajudar?',
    ]);
    expect(prismaMock.message.create).toHaveBeenCalledTimes(3);
  });
});

describe('executeFlowEffects — default por coorte de criação', () => {
  it('org criada a partir de 2026-10-01: consolida por default', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(
      orgRow({ createdAt: new Date('2026-10-01T00:00:00Z') }),
    );

    await executeFlowEffects(inputBase(TRES_BALOES));

    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
    expect(sendReplyTextMock.mock.calls[0][0]).toMatchObject({ content: TEXTO_CONSOLIDADO });
  });

  it('org ANTERIOR ao corte: NÃO consolida por default', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(
      orgRow({ createdAt: new Date('2026-09-01T12:00:00Z') }),
    );

    await executeFlowEffects(inputBase(TRES_BALOES));

    expect(sendReplyTextMock).toHaveBeenCalledTimes(3);
  });

  it('org antiga com flag LIGADA na mão: flag vence a coorte', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(
      orgRow({
        createdAt: new Date('2026-01-10T00:00:00Z'),
        settings: { flags: { consolidarBaloes: true } },
      }),
    );

    await executeFlowEffects(inputBase(TRES_BALOES));

    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
  });

  it('erro ao ler a org: fail-soft, segue sem consolidar (3 balões)', async () => {
    prismaMock.organization.findUnique.mockRejectedValue(new Error('db off'));

    await executeFlowEffects(inputBase(TRES_BALOES));

    expect(sendReplyTextMock).toHaveBeenCalledTimes(3);
  });
});

describe('executeFlowEffects — fronteiras da consolidação', () => {
  it('efeito não-texto no meio quebra a sequência (só adjacentes se juntam)', async () => {
    const efeitos: FlowEffect[] = [
      { kind: 'send_text', text: 'A' },
      { kind: 'send_text', text: 'B' },
      { kind: 'set_tag', tag: 'lead-quente' },
      { kind: 'send_text', text: 'C' },
    ];

    await executeFlowEffects(inputBase(efeitos, { consolidarBaloes: true }));

    expect(sendReplyTextMock).toHaveBeenCalledTimes(2);
    expect(sendReplyTextMock.mock.calls.map((c: any[]) => c[0].content)).toEqual(['A\n\nB', 'C']);
    // set_tag continua executando normalmente no lugar dele.
    expect(prismaMock.contact.update).toHaveBeenCalledTimes(1);
  });

  it('caller decide via consolidarBaloes: NENHUMA consulta de org no executor', async () => {
    await executeFlowEffects(inputBase(TRES_BALOES, { consolidarBaloes: true }));

    expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
  });

  it('um único send_text: caminho comum sem consulta extra nem mudança', async () => {
    await executeFlowEffects(inputBase([{ kind: 'send_text', text: 'Só um balão' }]));

    expect(prismaMock.organization.findUnique).not.toHaveBeenCalled();
    expect(sendReplyTextMock).toHaveBeenCalledTimes(1);
    expect(sendReplyTextMock.mock.calls[0][0]).toMatchObject({ content: 'Só um balão' });
  });

  it('aiConfidence do lote é preservado no Message consolidado', async () => {
    await executeFlowEffects(
      inputBase(TRES_BALOES, { consolidarBaloes: true, aiConfidence: 0.9 }),
    );

    expect(prismaMock.message.create.mock.calls[0][0].data).toMatchObject({
      content: TEXTO_CONSOLIDADO,
      aiConfidence: 0.9,
    });
  });
});

describe('consolidarSendTextConsecutivos e helpers (puros)', () => {
  it('junta só adjacentes e preserva a ordem dos demais efeitos', () => {
    const entrada: FlowEffect[] = [
      { kind: 'send_text', text: '1' },
      { kind: 'send_text', text: '2' },
      { kind: 'handoff' },
      { kind: 'send_text', text: '3' },
      { kind: 'send_text', text: '4' },
      { kind: 'send_text', text: '5' },
    ];

    const saida = consolidarSendTextConsecutivos(entrada);

    expect(saida).toEqual([
      { kind: 'send_text', text: '1\n\n2' },
      { kind: 'handoff' },
      { kind: 'send_text', text: '3\n\n4\n\n5' },
    ]);
    // Não muta a entrada.
    expect(entrada).toHaveLength(6);
    expect(entrada[0]).toEqual({ kind: 'send_text', text: '1' });
  });

  it('lote sem pares adjacentes atravessa igual', () => {
    const entrada: FlowEffect[] = [
      { kind: 'send_text', text: 'A' },
      { kind: 'set_tag', tag: 'x' },
      { kind: 'send_text', text: 'B' },
    ];

    expect(temSendTextConsecutivos(entrada)).toBe(false);
    expect(consolidarSendTextConsecutivos(entrada)).toEqual(entrada);
  });

  it('temSendTextConsecutivos detecta o par adjacente', () => {
    expect(temSendTextConsecutivos(TRES_BALOES)).toBe(true);
    expect(temSendTextConsecutivos([])).toBe(false);
    expect(temSendTextConsecutivos([{ kind: 'send_text', text: 'A' }])).toBe(false);
  });

  it('resolverConsolidarBaloes: corte exato de 2026-10-01 (UTC) liga o default', async () => {
    expect(CORTE_CONSOLIDACAO_BALOES.toISOString()).toBe('2026-10-01T00:00:00.000Z');

    prismaMock.organization.findUnique.mockResolvedValue(
      orgRow({ createdAt: new Date('2026-09-30T23:59:59Z') }),
    );
    await expect(resolverConsolidarBaloes('org-velha')).resolves.toBe(false);

    prismaMock.organization.findUnique.mockResolvedValue(
      orgRow({ createdAt: new Date('2026-10-01T00:00:00Z') }),
    );
    await expect(resolverConsolidarBaloes('org-nova')).resolves.toBe(true);
  });

  it('resolverConsolidarBaloes: org inexistente desliga (fail-soft)', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(null);
    await expect(resolverConsolidarBaloes('org-fantasma')).resolves.toBe(false);
  });
});

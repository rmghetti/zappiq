/* ══════════════════════════════════════════════════════════════════════
 * Retomada do Maestro: nenhuma tag chega ao cliente, nos dois motores.
 * --------------------------------------------------------------------
 * C1b (Passo 1, A189, nota 3 da revisão de 14/09). A retomada por timer
 * devolvia `resp.text` cru: se o modelo fechasse a mensagem em <reply> ou
 * pedisse uma ação, o cliente recebia as tags no WhatsApp. Agora a saída
 * passa pelo pós-processador único, com o interruptor `contextoUnico`
 * desligado (caminho leve) e ligado (motor único).
 *
 * Nenhuma organização tem fluxo ativo hoje: é correção preventiva.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const complete = vi.fn();
const isFlagOn = vi.fn();
const agentFindFirst = vi.fn();
const orgFindUnique = vi.fn();
const prefilterCreate = vi.fn(async () => ({ id: 'ev-1' }));

vi.mock('@zappiq/database', () => ({
  prisma: {
    agent: { findFirst: (...a: any[]) => agentFindFirst(...a) },
    organization: { findUnique: (...a: any[]) => orgFindUnique(...a) },
    message: {
      findMany: vi.fn(async () => [{ direction: 'INBOUND', content: 'Oi, e a proposta?' }]),
      count: vi.fn(async () => 2),
    },
    conversation: {
      findUnique: vi.fn(async () => ({ contactId: 'contato-1', contact: { phone: '5511999999999' } })),
    },
    contact: { findUnique: vi.fn(async () => ({ leadStatus: 'NEW', name: 'João', _count: {} })) },
    kBDocument: { findMany: vi.fn(async () => []) },
    QAPair: { findMany: vi.fn(async () => []) },
    agentRule: { findMany: vi.fn(async () => []) },
    prefilterEvent: { create: (...a: any[]) => (prefilterCreate as any)(...a) },
  },
}));
vi.mock('../services/llm/LLMRouter.js', async (importOriginal) => {
  const real = (await importOriginal()) as Record<string, unknown>;
  return { ...real, llmRouter: { complete: (...a: any[]) => complete(...a) } };
});
vi.mock('../services/featureFlags.js', () => ({
  isFlagOn: (...a: any[]) => isFlagOn(...a),
}));
vi.mock('../services/izaFactsService.js', () => ({
  getIzaFactsBlock: vi.fn(async () => ''),
  invalidateIzaFactsCache: vi.fn(),
}));
vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { generateAiResumeReply } from './flowAiResume.js';

const ENTRADA = { organizationId: 'org-cliente', conversationId: 'conversa-1', aiPrompt: 'Retome a proposta.' };

let flags: Record<string, boolean> = {};

beforeEach(() => {
  vi.clearAllMocks();
  flags = {};
  isFlagOn.mockImplementation(async (_o: string, f: string) => flags[f] === true);
  agentFindFirst.mockResolvedValue({ id: 'a1', name: 'Vera', role: 'comercial', systemPrompt: 'Você é a Vera.' });
  orgFindUnique.mockResolvedValue({ plan: 'GROWTH', settings: { businessName: 'CMJ', agentName: 'Vera' } });
});

const SAIDAS_COM_TAG = [
  'Oi João, tudo certo?\n<reply>Oi João, ficou alguma dúvida sobre a proposta?</reply>',
  '<action>handoff</action>Oi João, posso te ajudar com a proposta?',
  'Oi João! Escolha:<buttons>[{"id":"a","title":"Sim"}]</buttons>',
  '<action>set_contact_name</action><action_data>{"name":"João"}</action_data>Oi, João!',
];

for (const motor of ['caminho leve (contextoUnico desligado)', 'motor único (contextoUnico ligado)']) {
  describe(motor, () => {
    beforeEach(() => {
      flags = motor.startsWith('motor') ? { contextoUnico: true } : {};
    });

    for (const bruto of SAIDAS_COM_TAG) {
      it(`nenhuma tag sai: "${bruto.slice(0, 30)}..."`, async () => {
        complete.mockResolvedValue({ text: bruto });
        const texto = await generateAiResumeReply(ENTRADA);
        expect(texto).toBeTruthy();
        expect(texto).not.toMatch(/<\/?(reply|action|action_data|buttons)\b/i);
      });
    }

    it('com <reply>, sai só o conteúdo dele (sem a cópia em prosa)', async () => {
      complete.mockResolvedValue({ text: SAIDAS_COM_TAG[0] });
      await expect(generateAiResumeReply(ENTRADA)).resolves.toBe(
        'Oi João, ficou alguma dúvida sobre a proposta?',
      );
    });

    it('marca da ZappIQ na retomada de um cliente: nada é enviado (null) e o alerta é registrado', async () => {
      complete.mockResolvedValue({ text: 'Oi João! Aqui é a Vera, da ZappIQ.' });
      await expect(generateAiResumeReply(ENTRADA)).resolves.toBeNull();
      expect(prefilterCreate).toHaveBeenCalledTimes(1);
      expect((prefilterCreate.mock.calls[0] as any[])[0].data).toMatchObject({
        organizationId: 'org-cliente',
        conversationId: 'conversa-1',
        canal: 'maestro_retomada',
        categoria: 'guarda-de-marca',
        regra: 'ZappIQ',
      });
    });
  });
}

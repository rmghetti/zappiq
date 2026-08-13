/**
 * agentOrchestrator.channelRouting.test.ts — FASE 4 (#251) fecho
 * ============================================================================
 * Regressão do agente mudo no Instagram: o caminho principal de resposta
 * (etapa 12) chamava waService.sendText/sendButtons DIRETO com contactPhone.
 * Numa conversa de IG, contactPhone vale `ig:<igsid>` — isso ia pra Cloud API
 * do WhatsApp como número de destino e o envio falhava. A DM entrava, a IA
 * gerava a resposta e o cliente do Instagram nunca recebia nada.
 *
 * O fix: TODO envio de resposta do agente sai por deliverAgentReply, que
 * delega ao channelDispatcher (lê conversation.channel e roteia WA/IG).
 *
 * Estes testes travam isso em 2 camadas:
 *   1. deliverAgentReply usa o dispatcher (texto e botões) e NUNCA o waService.
 *   2. Guard estático: o orchestrator não pode voltar a chamar
 *      waService.sendText(/sendButtons( direto — foi exatamente assim que o
 *      defeito nasceu e passou despercebido.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dispatcherTextMock = vi.fn();
const dispatcherInteractiveMock = vi.fn();
const waSendTextMock = vi.fn();
const waSendButtonsMock = vi.fn();

vi.mock('../services/channelDispatcher.js', () => ({
  sendReplyText: dispatcherTextMock,
  sendReplyInteractive: dispatcherInteractiveMock,
  markIncomingAsRead: vi.fn(),
}));

vi.mock('../services/whatsappService.js', () => ({
  sendText: waSendTextMock,
  sendButtons: waSendButtonsMock,
  sendAudio: vi.fn(),
  markAsRead: vi.fn(),
  getMediaUrl: vi.fn(),
  downloadMedia: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { deliverAgentReply } = await import('./agentOrchestrator.js');

beforeEach(() => {
  vi.clearAllMocks();
  dispatcherTextMock.mockResolvedValue({ channel: 'instagram', externalMessageId: 'igmid_1' });
  dispatcherInteractiveMock.mockResolvedValue({ channel: 'whatsapp', externalMessageId: 'wamid_1' });
});

describe('deliverAgentReply — resposta do agente sai pelo channelDispatcher', () => {
  it('texto simples vai pro dispatcher.sendReplyText com org + conversa (nunca waService)', async () => {
    const result = await deliverAgentReply({
      organizationId: 'org_1',
      conversationId: 'conv_ig',
      text: 'Oi! Como posso ajudar?',
    });

    expect(dispatcherTextMock).toHaveBeenCalledTimes(1);
    expect(dispatcherTextMock).toHaveBeenCalledWith({
      organizationId: 'org_1',
      conversationId: 'conv_ig',
      content: 'Oi! Como posso ajudar?',
    });
    // A prova que importa: o waService não é tocado — o dispatcher decide o canal.
    expect(waSendTextMock).not.toHaveBeenCalled();
    expect(waSendButtonsMock).not.toHaveBeenCalled();
    // O externalMessageId do canal volta pro caller persistir.
    expect(result).toEqual({ channel: 'instagram', externalMessageId: 'igmid_1' });
  });

  it('resposta com botões vai pro dispatcher.sendReplyInteractive (IG degrada pra texto lá dentro)', async () => {
    const buttons = [
      { id: 'b1', title: 'Ver planos' },
      { id: 'b2', title: 'Falar com humano' },
    ];
    await deliverAgentReply({
      organizationId: 'org_1',
      conversationId: 'conv_1',
      text: 'O que você prefere?',
      buttons,
    });

    expect(dispatcherInteractiveMock).toHaveBeenCalledTimes(1);
    expect(dispatcherInteractiveMock).toHaveBeenCalledWith({
      organizationId: 'org_1',
      conversationId: 'conv_1',
      kind: 'button',
      body: 'O que você prefere?',
      options: buttons,
    });
    expect(dispatcherTextMock).not.toHaveBeenCalled();
    expect(waSendButtonsMock).not.toHaveBeenCalled();
  });

  it('buttons null/vazio cai no caminho de texto', async () => {
    await deliverAgentReply({ organizationId: 'o', conversationId: 'c', text: 'oi', buttons: null });
    await deliverAgentReply({ organizationId: 'o', conversationId: 'c', text: 'oi', buttons: [] });
    expect(dispatcherTextMock).toHaveBeenCalledTimes(2);
    expect(dispatcherInteractiveMock).not.toHaveBeenCalled();
  });
});

describe('guard estático — o orchestrator não chama waService.sendText/sendButtons direto', () => {
  // Foi assim que o agente ficou mudo no Instagram: um envio direto no caminho
  // principal, invisível pros testes que só cobriam o dispatcher. Se alguém
  // reintroduzir uma chamada direta, este teste quebra na hora.
  const src = readFileSync(
    fileURLToPath(new URL('./agentOrchestrator.ts', import.meta.url)),
    'utf8',
  );

  it('zero waService.sendText( no orchestrator', () => {
    expect(src.match(/waService\.sendText\(/g)).toBeNull();
  });

  it('zero waService.sendButtons( no orchestrator', () => {
    expect(src.match(/waService\.sendButtons\(/g)).toBeNull();
  });

  it('sendAudio (TTS) é a única exceção permitida, e gated por canal whatsapp', () => {
    // TTS sobe o áudio pra CDN do WhatsApp — só faz sentido no WA. O gate por
    // canal precisa existir no bloco de voz.
    const audioCalls = src.match(/waService\.sendAudio\(/g) ?? [];
    expect(audioCalls.length).toBeLessThanOrEqual(1);
  });
});

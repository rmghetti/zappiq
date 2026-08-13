/**
 * channelCredentialCheck.test.ts — "Testar conexão" de credenciais de canal
 * ============================================================================
 * Auditoria 13/08: o cliente colava um token errado e lia "Credenciais
 * salvas!" — só descobria o problema quando um lead real ficava sem resposta.
 * Não existia teste de conexão em lugar nenhum do app.
 *
 * checkWhatsappCredentials / checkInstagramCredentials fazem um GET read-only
 * na Graph API com as credenciais salvas e devolvem ok/erro com dica acionável
 * em pt-BR. Nunca lançam.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const axiosGetMock = vi.fn();

vi.mock('axios', () => ({
  default: { get: axiosGetMock },
}));

vi.mock('../config/env.js', () => ({
  env: { WHATSAPP_API_VERSION: 'v21.0' },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { checkWhatsappCredentials, checkInstagramCredentials } = await import(
  './channelCredentialCheck.js'
);

function graphError(code: number, message: string) {
  return Object.assign(new Error(message), {
    response: { status: 400, data: { error: { code, message } } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkWhatsappCredentials', () => {
  it('credenciais válidas devolvem ok + dados do número', async () => {
    axiosGetMock.mockResolvedValue({
      data: { display_phone_number: '+55 11 99999-9999', verified_name: 'Loja da Maria', quality_rating: 'GREEN' },
    });

    const r = await checkWhatsappCredentials('123456789012345', 'tok_valido');

    expect(r.ok).toBe(true);
    expect(r.displayPhoneNumber).toBe('+55 11 99999-9999');
    expect(r.verifiedName).toBe('Loja da Maria');
    expect(r.qualityRating).toBe('GREEN');
    // Chamou o node do número com o Bearer do cliente.
    expect(axiosGetMock.mock.calls[0][0]).toContain('/123456789012345');
    expect(axiosGetMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok_valido');
  });

  it('token expirado (code 190) devolve erro + dica de renovar, sem lançar', async () => {
    axiosGetMock.mockRejectedValue(graphError(190, 'Error validating access token: Session has expired'));

    const r = await checkWhatsappCredentials('123', 'tok_podre');

    expect(r.ok).toBe(false);
    expect(r.error).toContain('Session has expired');
    expect(r.hint).toMatch(/token/i);
  });

  it('ID errado (code 100) devolve dica de conferir o ID', async () => {
    axiosGetMock.mockRejectedValue(graphError(100, 'Unsupported get request. Object with ID ...'));

    const r = await checkWhatsappCredentials('999', 'tok');

    expect(r.ok).toBe(false);
    expect(r.hint).toMatch(/ID/);
  });

  it('erro de rede não lança e vira erro legível', async () => {
    axiosGetMock.mockRejectedValue(new Error('ETIMEDOUT'));
    const r = await checkWhatsappCredentials('123', 'tok');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('ETIMEDOUT');
  });
});

describe('checkInstagramCredentials', () => {
  it('credenciais válidas devolvem ok + username da conta', async () => {
    axiosGetMock.mockResolvedValue({ data: { username: 'loja.da.maria', name: 'Loja da Maria' } });

    const r = await checkInstagramCredentials('17841400000000000', 'igtok');

    expect(r.ok).toBe(true);
    expect(r.username).toBe('loja.da.maria');
    expect(axiosGetMock.mock.calls[0][0]).toContain('/17841400000000000');
  });

  it('token sem permissão (code 200) devolve dica de permissões', async () => {
    axiosGetMock.mockRejectedValue(graphError(200, 'Permissions error'));
    const r = await checkInstagramCredentials('178414', 'igtok');
    expect(r.ok).toBe(false);
    expect(r.hint).toMatch(/permiss/i);
  });
});

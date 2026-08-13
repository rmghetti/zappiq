/**
 * webhookVerifyToken.test.ts — verify token de webhook POR ORGANIZAÇÃO
 * ============================================================================
 * Auditoria 13/08: no caminho manual ("traga seu token"), o cliente precisa
 * cadastrar Callback URL + Verify Token no app Meta DELE, mas o produto nunca
 * mostrava nenhum dos dois — e o verify token era um só, global, compartilhado
 * entre todos os tenants (default em env.ts).
 *
 * Fix sem migração: token derivado por HMAC — `zpq1.<orgId>.<assinatura>`.
 * O GET de verificação do webhook aceita o token global (retrocompat) OU
 * qualquer token derivado válido. A assinatura impede forjar token de outra
 * org sem o segredo do servidor.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';

const SECRET = 'segredo-de-teste-com-32-caracteres!!';

const { buildOrgWebhookVerifyToken, isValidOrgWebhookVerifyToken } = await import(
  './webhookVerifyToken.js'
);

describe('buildOrgWebhookVerifyToken / isValidOrgWebhookVerifyToken', () => {
  it('token gerado valida (ida e volta)', () => {
    const token = buildOrgWebhookVerifyToken('org_cln4abc123', SECRET);
    expect(token.startsWith('zpq1.org_cln4abc123.')).toBe(true);
    expect(isValidOrgWebhookVerifyToken(token, SECRET)).toBe(true);
  });

  it('é determinístico por org (o cliente pode voltar amanhã e ver o mesmo token)', () => {
    expect(buildOrgWebhookVerifyToken('org_a', SECRET)).toBe(
      buildOrgWebhookVerifyToken('org_a', SECRET),
    );
  });

  it('orgs diferentes têm tokens diferentes', () => {
    expect(buildOrgWebhookVerifyToken('org_a', SECRET)).not.toBe(
      buildOrgWebhookVerifyToken('org_b', SECRET),
    );
  });

  it('assinatura adulterada NÃO valida (não dá pra forjar token de outra org)', () => {
    const token = buildOrgWebhookVerifyToken('org_a', SECRET);
    const [prefix, orgId] = token.split('.');
    expect(isValidOrgWebhookVerifyToken(`${prefix}.${orgId}.deadbeefdeadbeefdead`, SECRET)).toBe(false);
  });

  it('trocar o orgId mantendo a assinatura NÃO valida', () => {
    const token = buildOrgWebhookVerifyToken('org_a', SECRET);
    const sig = token.split('.')[2];
    expect(isValidOrgWebhookVerifyToken(`zpq1.org_b.${sig}`, SECRET)).toBe(false);
  });

  it('lixo, vazio e undefined não validam (e não lançam)', () => {
    expect(isValidOrgWebhookVerifyToken(undefined, SECRET)).toBe(false);
    expect(isValidOrgWebhookVerifyToken('', SECRET)).toBe(false);
    expect(isValidOrgWebhookVerifyToken('zappiq-webhook-secret-2026', SECRET)).toBe(false);
    expect(isValidOrgWebhookVerifyToken('zpq1.só-duas-partes', SECRET)).toBe(false);
    expect(isValidOrgWebhookVerifyToken('outroprefixo.org_a.abc', SECRET)).toBe(false);
  });

  it('segredo diferente do servidor não valida (rotação de segredo invalida tokens antigos)', () => {
    const token = buildOrgWebhookVerifyToken('org_a', SECRET);
    expect(isValidOrgWebhookVerifyToken(token, 'outro-segredo-de-32-caracteres!!!!!')).toBe(false);
  });
});

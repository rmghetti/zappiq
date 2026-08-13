/**
 * Testes da decisão pós-retorno OAuth/Magic Link no /cadastro.
 *
 * Contexto (incidente 13/08/2026): um cliente que JÁ tem conta (inclusive o
 * SUPERADMIN) voltava do Google pelo botão do wizard de cadastro. O wizard
 * chama passwordless-exchange pra reconhecer a conta e mandar pro /dashboard.
 * Quando essa chamada NÃO retornava 200 (tipicamente 429, limite de
 * autenticação por IP estourado após várias tentativas), o código caía direto
 * no formulário de cadastro (setStep(3)) — "para na página de cadastro".
 *
 * Esta função concentra a decisão em lógica PURA, testável sem DOM:
 *   200 + token/user   → dashboard (conta existe, entra)
 *   404 / shouldOnboard → signup    (conta nova de verdade, segue o wizard)
 *   429                → go_login (rate_limited)  → NÃO cai no cadastro
 *   demais/rede/anômalo → go_login (verify_failed) → NÃO cai no cadastro
 *
 * Rodar:
 *   pnpm --filter @zappiq/web test
 */

import { test } from 'vitest';
import { decidePostOAuthReturn, loginReasonMessage } from '../postOAuthDecision';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

// ─────────────────────────────────────────────────────────────
// 200 com token + user → entra no dashboard
// ─────────────────────────────────────────────────────────────
test('200 com token e user manda pro dashboard e carrega o token', () => {
  const d = decidePostOAuthReturn({
    status: 200,
    body: { token: 'jwt-nosso', refreshToken: 'refresh-nosso', user: { role: 'SUPERADMIN' } },
  });
  assert(d.action === 'dashboard', 'esperava action=dashboard');
  if (d.action === 'dashboard') {
    assert(d.token === 'jwt-nosso', 'token deveria ser repassado');
    assert(d.refreshToken === 'refresh-nosso', 'refreshToken deveria ser repassado');
  }
});

// ─────────────────────────────────────────────────────────────
// 404 → conta nova de verdade → segue o wizard de cadastro
// ─────────────────────────────────────────────────────────────
test('404 segue o fluxo de cadastro (conta nova)', () => {
  const d = decidePostOAuthReturn({
    status: 404,
    body: { error: 'Usuário sem onboarding completo', shouldOnboard: true },
  });
  assert(d.action === 'signup', 'esperava action=signup');
});

// ─────────────────────────────────────────────────────────────
// 429 (limite de tentativas) → vai pro login com motivo rate_limited,
// NUNCA cai no cadastro
// ─────────────────────────────────────────────────────────────
test('429 vai pro login como rate_limited, não cai no cadastro', () => {
  const d = decidePostOAuthReturn({
    status: 429,
    body: { error: 'Too many authentication attempts, please try again later' },
  });
  assert(d.action === 'go_login', 'esperava action=go_login');
  if (d.action === 'go_login') {
    assert(d.reason === 'rate_limited', 'motivo deveria ser rate_limited');
  }
});

// ─────────────────────────────────────────────────────────────
// 5xx → não dá pra confirmar → vai pro login (verify_failed)
// ─────────────────────────────────────────────────────────────
test('500 vai pro login como verify_failed', () => {
  const d = decidePostOAuthReturn({ status: 500, body: { error: 'Erro interno' } });
  assert(d.action === 'go_login', 'esperava action=go_login');
  if (d.action === 'go_login') {
    assert(d.reason === 'verify_failed', 'motivo deveria ser verify_failed');
  }
});

// ─────────────────────────────────────────────────────────────
// Erro de rede (fetch lançou; modelado como status 0) → login (verify_failed)
// ─────────────────────────────────────────────────────────────
test('erro de rede (status 0) vai pro login como verify_failed', () => {
  const d = decidePostOAuthReturn({ status: 0 });
  assert(d.action === 'go_login', 'esperava action=go_login');
  if (d.action === 'go_login') {
    assert(d.reason === 'verify_failed', 'motivo deveria ser verify_failed');
  }
});

// ─────────────────────────────────────────────────────────────
// Anomalia: 200 sem token → não sabemos confirmar; NÃO cair no cadastro
// ─────────────────────────────────────────────────────────────
test('200 sem token não cai no cadastro; vai pro login como verify_failed', () => {
  const d = decidePostOAuthReturn({ status: 200, body: { user: { role: 'ADMIN' } } });
  assert(d.action === 'go_login', 'esperava action=go_login');
  if (d.action === 'go_login') {
    assert(d.reason === 'verify_failed', 'motivo deveria ser verify_failed');
  }
});

// ─────────────────────────────────────────────────────────────
// loginReasonMessage: o ?reason= da URL do /login vira aviso pro cliente
// ─────────────────────────────────────────────────────────────
test('rate_limited pede pra aguardar antes de tentar de novo', () => {
  const msg = loginReasonMessage('rate_limited');
  assert(msg !== null, 'rate_limited deveria ter mensagem');
  assert(/aguarde/i.test(msg as string), 'mensagem deveria pedir pra aguardar');
});

test('verify_failed avisa que não deu pra confirmar', () => {
  const msg = loginReasonMessage('verify_failed');
  assert(msg !== null, 'verify_failed deveria ter mensagem');
  assert(/confirmar/i.test(msg as string), 'mensagem deveria falar em confirmar o acesso');
});

test('already_registered mantém a mensagem de conta existente', () => {
  const msg = loginReasonMessage('already_registered');
  assert(msg !== null, 'already_registered deveria ter mensagem');
  assert(/já tem conta/i.test(msg as string), 'mensagem deveria dizer que já tem conta');
});

test('motivo desconhecido ou ausente não gera aviso', () => {
  assert(loginReasonMessage(null) === null, 'null não deveria gerar aviso');
  assert(loginReasonMessage('qualquer_coisa') === null, 'motivo desconhecido não deveria gerar aviso');
});

test('mensagens do login não usam travessão (padrão de voz)', () => {
  for (const r of ['rate_limited', 'verify_failed', 'already_registered']) {
    const msg = loginReasonMessage(r) || '';
    assert(!msg.includes('—'), `mensagem de ${r} não pode ter travessão`);
  }
});

/**
 * Testes do branch v2 x v4 do Embedded Signup do WhatsApp (Resposta Meta 2026).
 *
 * O que protege: com NEXT_PUBLIC_META_CONFIG_ID_V4 setada, o FB.login troca de
 * config_id e os extras viram só { setup: {} } (sem featureType nem
 * sessionInfoVersion, aposentados na v4). Sem a env, o fluxo v2 atual precisa
 * ficar EXATAMENTE igual até o corte de 15/10/2026: regressão aqui derruba a
 * conexão em 1 clique de todo mundo.
 *
 * Rodar:
 *   pnpm --filter @zappiq/web test
 */

import { test } from 'vitest';
import { resolveWhatsAppSignupConfig } from '../metaEmbeddedSignup';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('Assertion failed: ' + msg);
}

const V2_ID = '3990962534537609';

test('sem env v4 (undefined) mantém a v2 byte a byte', () => {
  const cfg = resolveWhatsAppSignupConfig(V2_ID, undefined);
  assert(cfg.version === 'v2', 'versão deve ser v2');
  assert(cfg.configId === V2_ID, 'config_id deve ser o da v2');
  assert(JSON.stringify(cfg.extras) === JSON.stringify({ setup: {}, featureType: '', sessionInfoVersion: '3' }),
    'extras da v2 devem preservar setup + featureType + sessionInfoVersion');
});

test('env v4 vazia ou só espaços continua na v2', () => {
  for (const raw of ['', '   ', null]) {
    const cfg = resolveWhatsAppSignupConfig(V2_ID, raw);
    assert(cfg.version === 'v2', `raw ${JSON.stringify(raw)} deve cair na v2`);
    assert(cfg.configId === V2_ID, 'config_id deve seguir o da v2');
  }
});

test('env v4 setada troca o config_id e enxuga os extras para { setup: {} }', () => {
  const cfg = resolveWhatsAppSignupConfig(V2_ID, ' 111222333444555 ');
  assert(cfg.version === 'v4', 'versão deve ser v4');
  assert(cfg.configId === '111222333444555', 'config_id deve ser o da v4, com trim');
  assert(JSON.stringify(cfg.extras) === JSON.stringify({ setup: {} }), 'extras da v4 devem ser só { setup: {} }');
  assert(!('sessionInfoVersion' in cfg.extras), 'v4 não pode carregar sessionInfoVersion');
  assert(!('featureType' in cfg.extras), 'v4 não pode carregar featureType');
});

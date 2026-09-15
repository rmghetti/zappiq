/* ══════════════════════════════════════════════════════════════════════
 * zappiqOrg: quem pode citar a marca ZappIQ sem que isso seja vazamento.
 * --------------------------------------------------------------------
 * Rodada 1 de correção do C1b (PR #379), item 1b. A guarda de marca
 * tratava qualquer organização fora da canônica como cliente que não
 * pode falar da ZappIQ. A MACHIA é a empresa que FAZ a ZappIQ: o perfil
 * vivo dela leva ao prompt respostas do questionário que citam a ZappIQ,
 * e o agente dela precisa poder dizer "A MACHIA desenvolve a ZappIQ".
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';

import {
  ZAPPIQ_ORG_ID,
  MACHIA_ORG_ID,
  ORGS_COM_MARCA_LICENCIADA,
  isZappIQOrg,
  temMarcaLicenciada,
} from './zappiqOrg.js';

describe('temMarcaLicenciada', () => {
  it('a MACHIA tem a marca licenciada', () => {
    expect(MACHIA_ORG_ID).toBe('cmrktle9g002epphvb02qbe1r');
    expect(ORGS_COM_MARCA_LICENCIADA).toContain(MACHIA_ORG_ID);
    expect(temMarcaLicenciada(MACHIA_ORG_ID)).toBe(true);
  });

  it('a organização canônica não precisa de licença: isZappIQOrg já a cobre', () => {
    expect(isZappIQOrg(ZAPPIQ_ORG_ID)).toBe(true);
    expect(temMarcaLicenciada(ZAPPIQ_ORG_ID)).toBe(false);
  });

  it('um cliente comum não tem a marca licenciada', () => {
    expect(temMarcaLicenciada('org-do-cmj')).toBe(false);
    expect(isZappIQOrg('org-do-cmj')).toBe(false);
  });

  it('fail-closed: id nulo ou vazio é cliente comum', () => {
    expect(temMarcaLicenciada(null)).toBe(false);
    expect(temMarcaLicenciada(undefined)).toBe(false);
    expect(temMarcaLicenciada('')).toBe(false);
  });
});

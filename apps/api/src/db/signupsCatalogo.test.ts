/* ══════════════════════════════════════════════════════════════════════
 * Teste de catálogo da tabela `signups` (A242).
 * --------------------------------------------------------------------
 * A tabela `signups` vive fora do Prisma (é escrita pelo apps/web via
 * Supabase). Isso deixou o DDL dela fora do repositório por um ano, e a
 * CHECK de `plan_chosen` ficou parada num catálogo de planos que não existe
 * mais: 60 dias sem NENHUM cadastro novo porque o plano de entrada (Lite)
 * era recusado pelo banco.
 *
 * Este teste é o portão. Ele lê a migração versionada e falha se alguma das
 * duas CHECK divergir do catálogo em @zappiq/shared. Trocar o catálogo sem
 * trocar a migração passa a quebrar o CI, não a produção.
 * ══════════════════════════════════════════════════════════════════════ */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { SIGNUP_PLAN_CHOSEN_VALUES, ONBOARDING_PATHS } from '@zappiq/shared';

const aqui = dirname(fileURLToPath(import.meta.url));

/** Caminho da migração que versiona o DDL de `signups`. */
export const MIGRACAO_SIGNUPS = resolve(
  aqui,
  '../../../../packages/database/prisma/migrations/20260914000060_signups_contrato_de_plano/migration.sql',
);

const sql = readFileSync(MIGRACAO_SIGNUPS, 'utf8');

/**
 * Extrai a lista de literais de uma CHECK `<coluna> IN ('a','b',...)`.
 * Devolve [] quando a CHECK não existe, para o teste falhar com clareza.
 */
export function valoresDaCheck(sqlTexto: string, coluna: string): string[] {
  const re = new RegExp(`${coluna}\\s+IN\\s*\\(([^)]*)\\)`, 'i');
  const m = re.exec(sqlTexto);
  if (!m) return [];
  return Array.from(m[1].matchAll(/'([^']+)'/g)).map((x) => x[1]);
}

describe('migração de signups: CHECK derivada do catálogo', () => {
  it('plan_chosen aceita exatamente os planos de @zappiq/shared', () => {
    const doBanco = valoresDaCheck(sql, 'plan_chosen').sort();
    expect(doBanco).toEqual([...SIGNUP_PLAN_CHOSEN_VALUES].sort());
  });

  it('plan_chosen aceita IZA_LITE (o plano que a tela pré-seleciona)', () => {
    expect(valoresDaCheck(sql, 'plan_chosen')).toContain('IZA_LITE');
  });

  it('onboarding_path aceita exatamente os caminhos de @zappiq/shared', () => {
    const doBanco = valoresDaCheck(sql, 'onboarding_path').sort();
    expect(doBanco).toEqual([...ONBOARDING_PATHS].sort());
  });

  it('onboarding_path aceita wizard (o valor que o produto grava)', () => {
    expect(valoresDaCheck(sql, 'onboarding_path')).toContain('wizard');
  });
});

describe('migração de signups: segurança e reexecução', () => {
  it('é idempotente: derruba a constraint antiga antes de criar a nova', () => {
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS\s+"?signups_plan_chosen_check"?/i);
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS\s+"?signups_onboarding_path_check"?/i);
  });

  it('cria a tabela sem derrubar a existente', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS/i);
    expect(sql).not.toMatch(/DROP TABLE/i);
  });

  it('mantém a RLS ligada e a chave pública sem privilégio', () => {
    expect(sql).toMatch(/ALTER TABLE\s+"?(public\.)?signups"?\s+ENABLE ROW LEVEL SECURITY/i);
    // O REVOKE é condicional (banco local não tem os papéis do Supabase),
    // então a asserção lê o comando e a lista de papéis separadamente.
    expect(sql).toMatch(/REVOKE ALL ON\s+"?(public\.)?signups"?\s+FROM/i);
    expect(sql).toMatch(/'anon',\s*'authenticated'/);
  });
});

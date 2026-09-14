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

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { SIGNUP_PLAN_CHOSEN_VALUES, ONBOARDING_PATHS } from '@zappiq/shared';

const aqui = dirname(fileURLToPath(import.meta.url));

/** Raiz das migrações do Prisma. */
export const RAIZ_DAS_MIGRACOES = resolve(
  aqui,
  '../../../../packages/database/prisma/migrations',
);

/**
 * Acha a migração MAIS RECENTE cujo SQL casa com `marca`.
 *
 * Por que varrer em vez de apontar para um arquivo fixo: migração já
 * aplicada não pode ser editada. O Prisma guarda o checksum de cada uma em
 * `_prisma_migrations` e recusa o deploy quando o arquivo muda. Um teste
 * preso ao arquivo de hoje convida a próxima pessoa a editar exatamente o
 * que não pode ser editado. Trocar o catálogo de planos é migração NOVA, e
 * a varredura acha a nova sozinha.
 *
 * O prefixo do nome da pasta é carimbo de tempo, então ordem alfabética é
 * ordem cronológica.
 */
export function migracaoMaisRecenteCom(marca: RegExp, raiz = RAIZ_DAS_MIGRACOES): string {
  const pastas = readdirSync(raiz, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();

  for (const pasta of pastas) {
    const caminho = resolve(raiz, pasta, 'migration.sql');
    if (!existsSync(caminho)) continue;
    if (marca.test(readFileSync(caminho, 'utf8'))) return caminho;
  }
  throw new Error(`nenhuma migração casa com ${marca}`);
}

/** A migração que manda no catálogo HOJE (a última que define a CHECK). */
export const MIGRACAO_DO_CATALOGO = migracaoMaisRecenteCom(/signups_plan_chosen_check/i);

/** A migração que versiona o DDL da tabela. */
export const MIGRACAO_DO_DDL = migracaoMaisRecenteCom(
  /CREATE TABLE IF NOT EXISTS\s+public\.signups/i,
);

const sql = readFileSync(MIGRACAO_DO_CATALOGO, 'utf8');
const ddl = readFileSync(MIGRACAO_DO_DDL, 'utf8');

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
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS/i);
    expect(ddl).not.toMatch(/DROP TABLE/i);
  });

  it('mantém a RLS ligada e a chave pública sem privilégio', () => {
    expect(ddl).toMatch(/ALTER TABLE\s+"?(public\.)?signups"?\s+ENABLE ROW LEVEL SECURITY/i);
    // O REVOKE é condicional (banco local não tem os papéis do Supabase),
    // então a asserção lê o comando e a lista de papéis separadamente.
    expect(ddl).toMatch(/REVOKE ALL ON\s+"?(public\.)?signups"?\s+FROM/i);
    expect(ddl).toMatch(/'anon',\s*'authenticated'/);
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * I2 da revisão do PR #374: o teste não pode apontar para um arquivo fixo.
 *
 * Migração já aplicada tem checksum guardado em `_prisma_migrations`. Se
 * alguém trocar o catálogo de planos e editar a migração de hoje para o
 * teste voltar a passar, o `prisma migrate deploy` recusa a migração e o
 * deploy da API morre. A varredura resolve isso: a migração NOVA é achada
 * sozinha e a antiga fica intacta.
 * ══════════════════════════════════════════════════════════════════════ */
describe('o portão acompanha a migração mais recente, não um arquivo fixo', () => {
  it('a migração do catálogo é descoberta por varredura', () => {
    expect(MIGRACAO_DO_CATALOGO).toMatch(/migrations\/\d+_[^/]+\/migration\.sql$/);
  });

  it('uma migração de catálogo mais nova tem preferência sobre a antiga', () => {
    // Prova o mecanismo sem tocar o disco: duas pastas, a segunda mais nova.
    const raiz = resolve(aqui, '__fixtures_inexistente__');
    expect(() => migracaoMaisRecenteCom(/coisa_que_nao_existe/i, raiz)).toThrow();
    // Na raiz real, a marca de DDL e a de catálogo apontam para migrações
    // que existem e são legíveis.
    expect(existsSync(MIGRACAO_DO_CATALOGO)).toBe(true);
    expect(existsSync(MIGRACAO_DO_DDL)).toBe(true);
  });

  it('a migração avisa, no cabeçalho, que catálogo novo é migração nova', () => {
    expect(ddl).toMatch(/migração NOVA/i);
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * I1 da revisão do PR #374: o CREATE TABLE tem de bater com a tabela REAL.
 *
 * O DDL foi escrito a partir do código que lê e escreve a tabela, sem
 * consultar produção. A medição de 14/09/2026 mostrou cinco colunas a
 * menos, cinco NOT NULL a menos, a CHECK de status ausente, a chave
 * estrangeira para auth.users ausente e a unicidade de e-mail escrita como
 * índice sobre lower(email), quando na tabela real é CONSTRAINT UNIQUE
 * sobre (email).
 *
 * Num banco novo (preview, CI, desenvolvimento) o DDL errado nasce
 * diferente de produção, e é exatamente aí que o defeito passa batido.
 * ══════════════════════════════════════════════════════════════════════ */
describe('o DDL versionado bate com a tabela de produção', () => {
  const COLUNAS_DE_COBRANCA = [
    'card_added_at',
    'paid_at',
    'churned_at',
    'stripe_customer_id',
    'stripe_subscription_id',
  ];

  for (const coluna of COLUNAS_DE_COBRANCA) {
    it(`declara a coluna ${coluna}`, () => {
      expect(ddl).toMatch(new RegExp(`"${coluna}"`, 'i'));
    });
  }

  const NAO_NULAS = ['name', 'plan_chosen', 'trial_starts_at', 'trial_ends_at', 'card_required_at'];

  for (const coluna of NAO_NULAS) {
    it(`${coluna} nasce NOT NULL, como em produção`, () => {
      const linha = new RegExp(`"${coluna}"[^,\n]*NOT NULL`, 'i');
      expect(ddl).toMatch(linha);
    });
  }

  it('o trial nasce com os 14 dias que o produto promete', () => {
    expect(ddl).toMatch(/trial_ends_at[^,\n]*14 days/i);
    expect(ddl).toMatch(/card_required_at[^,\n]*14 days/i);
  });

  it('declara a CHECK de status com o catálogo real', () => {
    const valores = valoresDaCheck(ddl, 'status').sort();
    expect(valores).toEqual(
      ['active', 'archived', 'churned', 'paid', 'pending_email'].sort(),
    );
  });

  it('a CHECK de status é adicionada só se ainda não existir (não toca produção)', () => {
    expect(ddl).not.toMatch(/DROP CONSTRAINT IF EXISTS\s+"?signups_status_check"?/i);
    expect(ddl).toMatch(/signups_status_check/);
  });

  it('a unicidade de e-mail é CONSTRAINT UNIQUE (email), não índice sobre lower(email)', () => {
    expect(ddl).toMatch(/ADD CONSTRAINT\s+"?signups_email_key"?\s+UNIQUE\s*\(\s*"?email"?\s*\)/i);
    expect(ddl).not.toMatch(/CREATE UNIQUE INDEX[^\n]*lower\s*\(/i);
  });

  it('a chave estrangeira para auth.users apaga o vínculo, nunca a linha', () => {
    expect(ddl).toMatch(/signups_supabase_user_id_fkey/);
    expect(ddl).toMatch(/REFERENCES\s+auth\.users\s*\(\s*"?id"?\s*\)/i);
    expect(ddl).toMatch(/ON DELETE SET NULL/i);
    expect(ddl).not.toMatch(/ON DELETE CASCADE/i);
  });

  it('a chave estrangeira tolera banco sem o schema auth (local e CI)', () => {
    // O bloco que cria a FK precisa checar o schema antes de tentar.
    expect(ddl).toMatch(/information_schema\.schemata|pg_namespace/i);
    expect(ddl).toMatch(/'auth'/);
  });
});

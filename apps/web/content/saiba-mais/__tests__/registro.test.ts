/**
 * Testes de integridade do registro de Saiba mais (Fase 1, secção 9 do design).
 *
 * Roda no CI junto com o resto do web (`pnpm --filter @zappiq/web test`).
 * Antes era um script solto de tsx: existia, passava quando alguém lembrava de
 * rodar à mão, e o CI nunca chamou. Teste que não roda não protege nada, então
 * virou vitest e o `include` do vitest.config passou a cobrir `content/**`.
 *
 * Verifica:
 *  1. Sem featureKey duplicada; todos os 4 blocos preenchidos.
 *  2. Voz: nenhum travessao longo em texto de usuario.
 *  3. Sem link morto: todo featureKey usado no JSX existe no registro.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SAIBA_MAIS, allFeatureKeys } from '../index';

const WEB = join(__dirname, '..', '..', '..');

function featureKeysNoJsx(): Set<string> {
  const usados = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry)) {
        const src = readFileSync(p, 'utf8');
        // featureKey="x", helpKey="x", help="x", featureKey: 'x' (arrays de KPI/cards)
        const re = /(?:featureKey|helpKey|help)\s*[=:]\s*['"]([a-z0-9.\-]+\.[a-z0-9.\-]+)['"]/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src))) usados.add(m[1]);
      }
    }
  };
  [join(WEB, 'app'), join(WEB, 'components')].forEach(walk);
  return usados;
}

describe('registro de Saiba mais', () => {
  const keys = allFeatureKeys();

  it('não tem featureKey duplicada e cobre o Dashboard', () => {
    expect(keys.length).toBe(new Set(keys).size);
    expect(keys.length).toBeGreaterThanOrEqual(120);
  });

  it.each(keys)('%s: tem os 4 blocos preenchidos', (k) => {
    const c = SAIBA_MAIS[k];
    expect(c.titulo?.trim()).toBeTruthy();
    expect(c.oQueE?.trim()).toBeTruthy();
    expect(c.paraQueServe?.trim()).toBeTruthy();
    expect(c.comoImplementar.length).toBeGreaterThan(0);
    expect(c.exemploResultado?.trim()).toBeTruthy();
    expect(typeof c.clientSafe).toBe('boolean');
  });

  it.each(keys)('%s: voz sem travessão longo', (k) => {
    const c = SAIBA_MAIS[k];
    const textos = [c.titulo, c.oQueE, c.paraQueServe, ...c.comoImplementar, c.exemploResultado].join(' ');
    expect(textos).not.toContain('—');
  });

  it('não tem link morto: todo featureKey do JSX existe no registro', () => {
    const usados = featureKeysNoJsx();
    expect(usados.size).toBeGreaterThan(0);
    for (const k of usados) expect(SAIBA_MAIS[k], `link morto: JSX usa "${k}"`).toBeTruthy();
  });
});

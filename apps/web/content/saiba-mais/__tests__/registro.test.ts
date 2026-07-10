/**
 * Testes de integridade do registro de Saiba mais (Fase 1, secção 9 do design).
 *
 * Sem framework, no padrão do repo (ver lib/__tests__/roiMath.test.ts):
 *   npx tsx apps/web/content/saiba-mais/__tests__/registro.test.ts
 *
 * Verifica:
 *  1. Sem featureKey duplicada; todos os 4 blocos preenchidos.
 *  2. Voz: nenhum travessao longo em texto de usuario.
 *  3. Sem link morto: todo featureKey usado no JSX existe no registro.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SAIBA_MAIS, allFeatureKeys } from '../index';

let falhas = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    falhas++;
    console.error('  FALHOU: ' + msg);
  }
}

// ---- 1. Integridade do conteudo ----
const keys = allFeatureKeys();
console.log(`Registro: ${keys.length} itens.`);
check(keys.length === new Set(keys).size, 'ha featureKey duplicada');
check(keys.length >= 120, `esperava ao menos 120 itens, tem ${keys.length}`);

for (const k of keys) {
  const c = SAIBA_MAIS[k];
  check(!!c.titulo?.trim(), `${k}: titulo vazio`);
  check(!!c.oQueE?.trim(), `${k}: oQueE vazio`);
  check(!!c.paraQueServe?.trim(), `${k}: paraQueServe vazio`);
  check(Array.isArray(c.comoImplementar) && c.comoImplementar.length > 0, `${k}: comoImplementar vazio`);
  check(!!c.exemploResultado?.trim(), `${k}: exemploResultado vazio`);
  check(typeof c.clientSafe === 'boolean', `${k}: clientSafe ausente`);

  // ---- 2. Voz: sem travessao longo em texto de usuario ----
  const textos = [c.titulo, c.oQueE, c.paraQueServe, ...c.comoImplementar, c.exemploResultado].join(' ');
  check(!textos.includes('—'), `${k}: contem travessao longo (proibido)`);
}

// ---- 3. Sem link morto: featureKey no JSX -> existe no registro ----
const WEB = join(__dirname, '..', '..', '..');
const roots = [join(WEB, 'app'), join(WEB, 'components')];
const usados = new Set<string>();

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(entry)) {
      const src = readFileSync(p, 'utf8');
      // featureKey="x", helpKey="x", help="x", featureKey: 'x' (arrays de KPI/cards)
      const re = /(?:featureKey|helpKey|help)\s*[=:]\s*['"]([a-z0-9.\-]+\.[a-z0-9.\-]+)['"]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) usados.add(m[1]);
    }
  }
}
roots.forEach(walk);

console.log(`Wiring: ${usados.size} featureKeys usadas no JSX.`);
for (const k of usados) {
  check(!!SAIBA_MAIS[k], `link morto: JSX usa "${k}" mas nao ha conteudo no registro`);
}

if (falhas === 0) {
  console.log('OK: registro de Saiba mais integro (' + keys.length + ' itens, ' + usados.size + ' ligados, 0 link morto).');
} else {
  console.error(`\n${falhas} verificacao(oes) falharam.`);
  process.exit(1);
}

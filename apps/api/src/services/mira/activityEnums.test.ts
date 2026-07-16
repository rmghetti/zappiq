/**
 * Contrato: os valores de enum que o Mira escreve em Activity existem.
 *
 * Por que este arquivo existe: em 15/07/2026 a conclusão da tarefa do plano de
 * ação usava `actor: 'USER'`. O enum ActorType é HUMAN|AI|SYSTEM — 'USER' não
 * existe. Todo teste do Mira MOCKA o prisma, e mock aceita qualquer string,
 * então 14 testes verdes não viram nada. O erro só apareceu ao rodar de
 * verdade em produção:
 *
 *   Invalid value for argument `actor`. Expected ActorType.
 *
 * É o mesmo cegamento do `(prisma as any)` que já custou o produto inteiro
 * (ver alvoContratoSchema.test.ts): `as any` nos valores de enum desliga a
 * checagem exatamente onde ela importava.
 *
 * Este teste lê os enums GERADOS pelo Prisma (fonte da verdade do banco) e
 * confere contra os valores que o código-fonte do Mira realmente escreve.
 * Não mocka nada: é leitura de arquivo + enum real.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// Via @zappiq/database (que reexporta o @prisma/client): é assim que a API
// enxerga os enums, e o pacote não resolve direto daqui.
import { ActivityType, ActorType } from '@zappiq/database';

const DIR = join(__dirname);

/** Todo `actor: 'X'` / `type: 'X'` escrito nos services do Mira. */
function valoresEscritos(campo: 'actor' | 'type'): { valor: string; arquivo: string }[] {
  const achados: { valor: string; arquivo: string }[] = [];
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue;
    const src = readFileSync(join(DIR, f), 'utf8');
    // Só o que vai para Activity: `actor: 'AI' as any` / `type: 'NOTE' as any`
    const re = new RegExp(`${campo}:\\s*'([A-Z_]+)'\\s*as any`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) achados.push({ valor: m[1], arquivo: f });
  }
  return achados;
}

describe('enums de Activity escritos pelo Mira', () => {
  it('todo `actor` existe no ActorType do banco', () => {
    const escritos = valoresEscritos('actor');
    expect(escritos.length, 'nenhum actor encontrado: o regex quebrou?').toBeGreaterThan(0);
    const validos = Object.values(ActorType) as string[];
    for (const { valor, arquivo } of escritos) {
      expect(validos, `${arquivo} escreve actor '${valor}', que não existe em ActorType (${validos.join('|')})`).toContain(valor);
    }
  });

  it('todo `type` existe no ActivityType do banco', () => {
    const escritos = valoresEscritos('type');
    expect(escritos.length).toBeGreaterThan(0);
    const validos = Object.values(ActivityType) as string[];
    for (const { valor, arquivo } of escritos) {
      expect(validos, `${arquivo} escreve type '${valor}', que não existe em ActivityType`).toContain(valor);
    }
  });

  it('ActorType não tem USER (o valor que quebrou em produção)', () => {
    // Trava a lição: quem for tentar 'USER' de novo bate aqui antes do deploy.
    expect(Object.values(ActorType)).not.toContain('USER');
    expect(Object.values(ActorType)).toContain('HUMAN');
  });
});

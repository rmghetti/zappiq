/**
 * Mira Prospects — o contrato entre o que os motores GRAVAM e o que o schema
 * DECLARA.
 *
 * Por que este arquivo existe: em 14/07/2026 a descoberta B2B devolvia 0 alvos
 * mesmo com 300 candidatos verificados. A causa era que os três motores
 * gravavam `telefone` no MiraAlvo, a migração `20260711000001_mira_prospects`
 * criava a coluna `telefone` no banco, mas o modelo do schema.prisma NÃO a
 * declarava. Como o client do Prisma é gerado do schema, todo create estourava
 * `Unknown argument 'telefone'` — e o erro era engolido por um catch, então a
 * campanha terminava "CONCLUIDA" com criados: 0.
 *
 * Ficou invisível por dias porque os motores chamavam `(prisma as any)
 * .miraAlvo.create`, e o cast desligava a checagem do payload inteiro. Nenhum
 * alvo foi criado em produção, por nenhum motor, desde que o produto nasceu:
 * `SELECT count(*) FROM mira_alvos` = 0.
 *
 * O `as any` saiu dos caminhos de escrita, então hoje o tsc é a primeira linha
 * de defesa. Este teste é a segunda: fixa os campos que o dossiê promete ao
 * cliente, para que sumir com um deles quebre aqui em vez de virar campanha
 * silenciosamente vazia.
 */
import { describe, expect, it } from 'vitest';
import { Prisma } from '@zappiq/database';

describe('MiraAlvo — o schema declara o que os motores gravam', () => {
  const campos = Object.keys(Prisma.MiraAlvoScalarFieldEnum);

  it('declara telefone (o campo que zerava toda campanha quando faltava)', () => {
    expect(campos).toContain('telefone');
  });

  it('declara a firmografia que o gate e o dossiê exigem', () => {
    // Sem estes, o alvo não tem como ser verificado nem apresentado.
    for (const campo of ['nome', 'cnpj', 'cnae', 'porte', 'capitalSocial', 'situacaoCadastral', 'uf']) {
      expect(campos, `MiraAlvo perdeu o campo ${campo}`).toContain(campo);
    }
  });

  it('declara o contato que torna o alvo acionável', () => {
    // O gate do Motor B (B2C/Places) aprova por "telefone OU site": se um
    // destes sumir do schema, o motor aprova o alvo e falha ao gravá-lo.
    expect(campos).toContain('site');
    expect(campos).toContain('telefone');
  });
});

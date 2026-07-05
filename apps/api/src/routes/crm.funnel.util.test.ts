import { describe, it, expect } from 'vitest';
import {
  computeConversaoPorEstagio,
  effectiveStageIndex,
  type FunnelDeal,
} from './crm.funnel.util.js';

const STAGE_ORDER = ['new', 'qualified', 'proposal', 'negotiation', 'won'];
const now = new Date();

function deal(stage: string): FunnelDeal {
  return { stage, createdAt: now };
}

describe('effectiveStageIndex', () => {
  it('won ultrapassa todos os estágios (último índice)', () => {
    expect(effectiveStageIndex('won', STAGE_ORDER)).toBe(STAGE_ORDER.length - 1);
  });

  it('lost entra pelo estágio de entrada (índice 0), não -1 — o bug W3.7', () => {
    expect(effectiveStageIndex('lost', STAGE_ORDER)).toBe(0);
  });

  it('stage conhecido usa o próprio índice', () => {
    expect(effectiveStageIndex('proposal', STAGE_ORDER)).toBe(2);
  });

  it('stage legado/desconhecido vira -1', () => {
    expect(effectiveStageIndex('archived', STAGE_ORDER)).toBe(-1);
  });
});

describe('computeConversaoPorEstagio — W3.7 (perdas NÃO são ignoradas)', () => {
  it('deal perdido conta como entrada do funil, não some do numerador', () => {
    // 1 lost apenas. Antes do fix: passou=0 em todo estágio (indexOf('lost')=-1),
    // mas total=1 → conversão 0% em 'new', o que é falso (o deal ENTROU).
    const rows = computeConversaoPorEstagio([deal('lost')], STAGE_ORDER);
    const stageNew = rows.find((r) => r.stage === 'new')!;
    expect(stageNew.total).toBe(1);
    expect(stageNew.passou).toBe(1); // entrou no funil
    expect(stageNew.percentual).toBe(1);
    // mas NÃO passou dos estágios seguintes (não sabemos até onde foi)
    expect(rows.find((r) => r.stage === 'qualified')!.passou).toBe(0);
    expect(rows.find((r) => r.stage === 'won')!.passou).toBe(0);
  });

  it('perda entra no denominador E no numerador de entrada (não infla conversão)', () => {
    // 1 won + 1 lost. Entrada 'new': ambos entraram → 2/2 = 100%.
    // 'won': só o won → 1/2 = 50%. A perda é saída do funil, não fantasma.
    const rows = computeConversaoPorEstagio(
      [deal('won'), deal('lost')],
      STAGE_ORDER,
    );
    const stageNew = rows.find((r) => r.stage === 'new')!;
    expect(stageNew.passou).toBe(2);
    expect(stageNew.total).toBe(2);
    expect(stageNew.percentual).toBe(1);

    const stageWon = rows.find((r) => r.stage === 'won')!;
    expect(stageWon.passou).toBe(1);
    expect(stageWon.total).toBe(2);
    expect(stageWon.percentual).toBe(0.5);
  });

  it('funil monotônico decrescente com mix realista incluindo lost', () => {
    // 2 new, 1 qualified, 1 proposal, 1 won, 2 lost = 7 criados
    const deals = [
      deal('new'),
      deal('new'),
      deal('qualified'),
      deal('proposal'),
      deal('won'),
      deal('lost'),
      deal('lost'),
    ];
    const rows = computeConversaoPorEstagio(deals, STAGE_ORDER);
    const byStage = Object.fromEntries(rows.map((r) => [r.stage, r.passou]));

    // 'new': todos os 7 entraram (inclui os 2 lost) → 7
    expect(byStage.new).toBe(7);
    // 'qualified': qualified(1) + proposal(1) + won(1) = 3 (lost não avança)
    expect(byStage.qualified).toBe(3);
    // 'proposal': proposal(1) + won(1) = 2
    expect(byStage.proposal).toBe(2);
    // 'negotiation': só won = 1
    expect(byStage.negotiation).toBe(1);
    // 'won': 1
    expect(byStage.won).toBe(1);

    // monotonicamente não-crescente
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].passou).toBeLessThanOrEqual(rows[i - 1].passou);
    }
    // todos usam o mesmo denominador (total criados)
    for (const r of rows) expect(r.total).toBe(7);
  });

  it('sem deals → percentual 0, sem divisão por zero', () => {
    const rows = computeConversaoPorEstagio([], STAGE_ORDER);
    for (const r of rows) {
      expect(r.total).toBe(0);
      expect(r.passou).toBe(0);
      expect(r.percentual).toBe(0);
    }
  });

  it('stage legado desconhecido não conta em estágio nenhum, mas conta no total', () => {
    const rows = computeConversaoPorEstagio([deal('archived')], STAGE_ORDER);
    const stageNew = rows.find((r) => r.stage === 'new')!;
    expect(stageNew.total).toBe(1);
    expect(stageNew.passou).toBe(0);
  });
});

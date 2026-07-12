/* ══════════════════════════════════════════════════════════════════════════
 * Diagnóstico de Perfil ZappIQ — motor de recomendação
 * --------------------------------------------------------------------------
 * Função pura: respostas -> plano ideal + add-ons + produtos, com os motivos
 * ligados ao que a pessoa respondeu. Usada no cliente (relatório na hora) e
 * revalidada no servidor (/api/diagnostico) antes de e-mail e persistência.
 * Decisões do fundador (11/07): Enterprise vira "falar com especialista";
 * CTA leva ao cadastro com o plano pré-selecionado.
 * ══════════════════════════════════════════════════════════════════════════ */

import { PLANOS, PRODUTOS, SEGMENTOS, type PlanoId } from './data';

export type Answers = Record<string, string | string[]>;

export interface ProdutoRec {
  nome: string;
  caracteristica: string;
  casoUso: string;
}
export interface AddonRec {
  nome: string;
  motivo: string;
  modulo: string;
  preco: string;
}
export interface Recommendation {
  plano: PlanoId;
  planoNome: string;
  planoPreco: string;
  planoEssencia: string;
  incluso: string[];
  motivos: string[];
  produtos: ProdutoRec[];
  addons: AddonRec[];
  cta: { tipo: 'trial' | 'contato'; label: string; href: string };
  segLabel: string;
}

function one(a: Answers, id: string): string {
  const v = a[id];
  return Array.isArray(v) ? (v[0] ?? '') : ((v as string) ?? '');
}
function many(a: Answers, id: string): string[] {
  const v = a[id];
  return Array.isArray(v) ? v : v ? [v as string] : [];
}

const SCORE_MAP: Record<string, Record<string, number>> = {
  conversas: { ate1500: 0, ate8000: 1, ate80000: 2, mais80000: 3 },
  equipe: { solo: 0, ate10: 1, ate75: 2, mais75: 3 },
  contatos: { ate1000: 0, ate10000: 1, ate200000: 2, mais200000: 3 },
  numeros: { um: 0, ate5: 1, ate15: 2, mais15: 3 },
};

export function recomendar(a: Answers): Recommendation {
  const seg = one(a, 'segmento') || 'outro';
  const segLabel = SEGMENTOS[seg] || SEGMENTOS.outro;

  let porte = 0;
  for (const k of ['conversas', 'equipe', 'contatos', 'numeros']) {
    porte += SCORE_MAP[k]?.[one(a, k)] ?? 0;
  }
  const compliance = one(a, 'compliance');
  const momento = one(a, 'momento');
  const integracoes = one(a, 'integracoes');

  const enterprise =
    one(a, 'equipe') === 'mais75' ||
    one(a, 'contatos') === 'mais200000' ||
    one(a, 'numeros') === 'mais15' ||
    one(a, 'conversas') === 'mais80000' ||
    (compliance === 'critico' && porte >= 6);

  let plano: PlanoId;
  if (enterprise) plano = 'ENTERPRISE';
  else if (porte >= 6 || compliance === 'critico') plano = 'SCALE';
  else if (porte >= 2 || integracoes === 'sim' || momento === 'escalando') plano = 'GROWTH';
  else plano = 'LITE';

  const info = PLANOS[plano];

  /* ── Motivos, ligados às respostas ── */
  const motivos: string[] = [];
  const convLabel: Record<string, string> = {
    ate1500: 'até 1.500 conversas por mês',
    ate8000: 'de 1.500 a 8.000 conversas por mês',
    ate80000: 'de 8.000 a 80.000 conversas por mês',
    mais80000: 'mais de 80.000 conversas por mês',
  };
  const eqLabel: Record<string, string> = {
    solo: 'atendendo sozinho',
    ate10: 'com uma equipe de até 10 pessoas',
    ate75: 'com uma equipe de 11 a 75 pessoas',
    mais75: 'com uma equipe de mais de 75 pessoas',
  };
  if (one(a, 'conversas')) motivos.push('Você recebe ' + (convLabel[one(a, 'conversas')] || 'suas conversas') + ', e este plano cobre esse volume com folga.');
  if (one(a, 'equipe')) motivos.push('Você está ' + (eqLabel[one(a, 'equipe')] || 'atendendo') + ', dentro do que o ' + info.nome + ' comporta.');
  if (integracoes === 'sim') motivos.push('Você precisa de integrações com outras ferramentas, disponíveis a partir do Growth.');
  if (compliance === 'critico') motivos.push('Seu setor exige compliance e SLA fortes, que entram no Scale para cima.');
  if (momento === 'validar' && plano === 'LITE') motivos.push('Você quer validar o canal primeiro, e o Lite faz isso com trial de 14 dias, sem cartão.');
  if (momento === 'controle') motivos.push('Você quer controle e observabilidade, e este plano entrega a operação medida e narrada.');
  if (enterprise) motivos.push('Pelo porte e pelas exigências que você marcou, o ideal é um contrato sob medida, com infraestrutura dedicada.');

  /* ── Produtos que atendem os objetivos ── */
  const objetivos = many(a, 'objetivo');
  const objToProd: Record<string, string> = {
    atender: 'iza',
    vender: 'crm',
    campanhas: 'impulso',
    crm: 'crm',
    agenda: 'agenda',
    medir: 'analytics',
    custo: 'iza',
  };
  const prodIds: string[] = [];
  const pushProd = (id: string) => { if (!prodIds.includes(id) && PRODUTOS[id]) prodIds.push(id); };
  pushProd('iza');
  for (const o of objetivos) pushProd(objToProd[o]);
  if (one(a, 'agendamento') === 'critico') pushProd('agenda');
  if (one(a, 'campanhas') !== 'nao' && one(a, 'campanhas')) pushProd('impulso');
  if (objetivos.includes('vender') || objetivos.includes('crm')) pushProd('maestro');
  if (one(a, 'audio') === 'muito') pushProd('voz');
  pushProd('qualidade');

  const produtos: ProdutoRec[] = prodIds.slice(0, 6).map((id) => {
    const p = PRODUTOS[id];
    return { nome: p.nome, caracteristica: p.caracteristica, casoUso: p.casoUso.replace('{seg}', segLabel) };
  });

  /* ── Add-ons recomendados (indicando o módulo ideal) ── */
  const addons: AddonRec[] = [];
  const camp = one(a, 'campanhas');
  if (camp === 'recorrente') addons.push({ nome: 'Zap Impulso Pro', motivo: 'Você faz campanhas de forma recorrente, e o Pro dá volume e otimização para escalar os disparos.', modulo: 'Zap Impulso', preco: 'R$ 597/mês' });
  else if (camp === 'esporadico') addons.push({ nome: 'Zap Impulso Start', motivo: 'Você faz campanhas de vez em quando, e o Start já resolve os disparos segmentados pela API oficial.', modulo: 'Zap Impulso', preco: 'R$ 197/mês' });

  if (one(a, 'audio') === 'muito') addons.push({ nome: 'Voz Nativa', motivo: 'Seus clientes mandam muito áudio, e a resposta em voz natural tira a fricção.', modulo: 'Voz Nativa', preco: 'a partir de R$ 79,90/mês' });

  if (one(a, 'agendamento') === 'critico' && plano === 'LITE') addons.push({ nome: 'Agendamento pela IA', motivo: 'Agendamento é crítico pra você e, no Lite, entra como add-on (no Growth pra cima já vem incluso).', modulo: 'Agenda', preco: 'R$ 49/mês' });

  if ((compliance === 'desejavel' || objetivos.includes('medir')) && plano !== 'SCALE' && plano !== 'ENTERPRISE') addons.push({ nome: 'Radar 360', motivo: 'Você quer medir e controlar a operação, e o Radar 360 traz a observabilidade executiva (já vem incluso no Scale).', modulo: 'Analytics e Radar 360', preco: 'R$ 397/mês' });

  if (one(a, 'numeros') !== 'um' && one(a, 'numeros') && (plano === 'LITE' || plano === 'GROWTH')) addons.push({ nome: 'Número de WhatsApp extra', motivo: 'Você opera mais de um número ou unidade, e cada número extra tem fila independente.', modulo: 'Conversas', preco: 'R$ 137/mês' });

  /* ── CTA ── */
  // Param padronizado ?plan=<id> (o /cadastro pre-seleciona o card por ele).
  const hrefPlano: Record<PlanoId, string> = {
    LITE: '/cadastro?plan=iza_lite&utm_source=diagnostico',
    GROWTH: '/cadastro?plan=growth&utm_source=diagnostico',
    SCALE: '/cadastro?plan=scale&utm_source=diagnostico',
    ENTERPRISE: '/agendar?origem=diagnostico',
  };
  const cta =
    plano === 'ENTERPRISE'
      ? { tipo: 'contato' as const, label: 'Falar com um especialista', href: hrefPlano.ENTERPRISE }
      : { tipo: 'trial' as const, label: 'Começar meu teste de 14 dias no ' + info.nome, href: hrefPlano[plano] };

  return {
    plano,
    planoNome: info.nome,
    planoPreco: info.preco,
    planoEssencia: info.essencia,
    incluso: info.incluso,
    motivos,
    produtos,
    addons,
    cta,
    segLabel,
  };
}

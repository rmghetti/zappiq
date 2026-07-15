/**
 * Mira Prospects — Campanhas de prospecção.
 *
 * Cada disparo dos motores vira uma campanha NOMEADA: agrupa os Alvos que o
 * disparo criou e guarda parâmetros + resultado para a gestão no hub. É a
 * resposta ao buraco de UX de 14/07: o cliente preenchia o Perfil e não
 * achava onde "iniciar a campanha", e o que rodava não deixava rastro
 * gerenciável.
 *
 * Não confundir com as Campanhas do Zap Impulso (disparo de mensagens): aqui
 * é mapeamento de mercado. Na UI o rótulo é sempre "campanha de prospecção".
 *
 * Ciclo: iniciar (EM_ANDAMENTO) -> motor roda carimbando campanhaId nos
 * Alvos -> concluir (CONCLUIDA + resultado). Gate rejeitado (412/501) apaga
 * a campanha em vez de marcar FALHOU: um disparo que nem largou não é
 * histórico, é ruído.
 */
import { Prisma, prisma } from '@zappiq/database';

export type MiraCampanhaTipo = 'BASE_INSTALADA' | 'DESCOBERTA';

/** `type` e não `interface`: vai para coluna Json do Prisma. Ver ScoreFator em score.ts. */
export type ParametrosCampanha = {
  /** O que procurar: os alvos confirmados no wizard (semeados do Perfil). */
  alvos?: string[];
  /** Onde procurar. Vazio = sem recorte de região. */
  regioes?: string[];
  kind?: 'B2B' | 'B2C';
  /** Quantidade de CNPJs colados (não os CNPJs em si: dado do cliente fica no Alvo). */
  cnpjs?: number;
};

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * "Descoberta: clínicas e academias em Moema (14/jul)" / "Carteira: 12 CNPJs
 * (14/jul)". Com muitos alvos, cita os dois primeiros e conta o resto, para o
 * nome continuar legível na lista do hub.
 */
export function nomeAutomatico(tipo: MiraCampanhaTipo, params: ParametrosCampanha, agora: Date = new Date()): string {
  const data = `${agora.getDate()}/${MESES[agora.getMonth()]}`;
  if (tipo === 'BASE_INSTALADA') {
    const n = params.cnpjs ?? 0;
    return `Carteira: ${n} ${n === 1 ? 'CNPJ' : 'CNPJs'} (${data})`;
  }
  const alvos = (params.alvos ?? []).map((a) => String(a).trim()).filter(Boolean);
  const regiao = (params.regioes ?? []).map((r) => String(r).trim()).filter(Boolean)[0] ?? '';
  let oQue = 'novos clientes';
  if (alvos.length === 1) oQue = alvos[0].slice(0, 60);
  else if (alvos.length === 2) oQue = `${alvos[0].slice(0, 30)} e ${alvos[1].slice(0, 30)}`;
  else if (alvos.length > 2) oQue = `${alvos[0].slice(0, 30)} e mais ${alvos.length - 1}`;
  return `Descoberta: ${oQue}${regiao ? ` em ${regiao}` : ''} (${data})`;
}

export async function iniciarCampanha(
  organizationId: string,
  dados: { nome?: string | null; tipo: MiraCampanhaTipo; parametros: ParametrosCampanha }
): Promise<{ id: string; nome: string }> {
  const nome = (dados.nome ?? '').trim().slice(0, 120) || nomeAutomatico(dados.tipo, dados.parametros);
  const campanha = await prisma.miraCampanha.create({
    data: {
      organizationId,
      nome,
      tipo: dados.tipo,
      status: 'EM_ANDAMENTO',
      parametros: dados.parametros,
    },
    select: { id: true, nome: true },
  });
  return campanha;
}

export async function concluirCampanha(
  campanhaId: string,
  resultado: Record<string, unknown>,
  status: 'CONCLUIDA' | 'FALHOU' = 'CONCLUIDA'
): Promise<void> {
  await prisma.miraCampanha.update({
    where: { id: campanhaId },
    // `resultado` é Record<string, unknown> por contrato (cada motor devolve um
    // formato); o Json do Prisma não aceita `unknown`. Só o valor Json é
    // afrouxado, nunca o client inteiro.
    data: { status, resultado: resultado as Prisma.InputJsonValue },
  });
}

/** Disparo que nem largou (gate 412/501) não vira histórico. */
export async function descartarCampanha(campanhaId: string): Promise<void> {
  try {
    await prisma.miraCampanha.delete({ where: { id: campanhaId } });
  } catch {
    /* já apagada ou nunca criada: nada a fazer */
  }
}

export interface CampanhaListItem {
  id: string;
  nome: string;
  tipo: MiraCampanhaTipo;
  status: 'EM_ANDAMENTO' | 'CONCLUIDA' | 'FALHOU';
  parametros: ParametrosCampanha & { regiaoAplicada?: string | null; regiaoOrigem?: string | null };
  resultado: Record<string, unknown>;
  alvosCount: number;
  prontosCount: number;
  createdAt: string;
}

/** Lista da gestão no hub. Escopo por organizationId, como todo o módulo. */
export async function listarCampanhas(organizationId: string, take = 30): Promise<CampanhaListItem[]> {
  const rows = await (prisma as any).miraCampanha.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(take, 100),
    include: {
      _count: { select: { alvos: true } },
      alvos: { where: { status: 'READY' }, select: { id: true } },
    },
  });
  return rows.map((c: any) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    status: c.status,
    parametros: c.parametros ?? {},
    resultado: c.resultado ?? {},
    alvosCount: c._count?.alvos ?? 0,
    prontosCount: Array.isArray(c.alvos) ? c.alvos.length : 0,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt),
  }));
}

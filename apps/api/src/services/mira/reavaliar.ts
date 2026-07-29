/**
 * Mira Prospects — reavaliação do Alvo (score, confiança e status).
 *
 * Pedido do fundador (15/07/2026): "Alvo que teve atualizações, seja pelo
 * Aprofundar com IA ou Mapear Decisores, deve imediatamente ter as
 * informações complementares analisadas e o score e a confiança atualizados
 * automaticamente, inclusive o status."
 *
 * O buraco que isto fecha: os motores calculavam o score UMA vez, no
 * nascimento do Alvo, quando ele ainda não tinha decisor nem pesquisa. Todo
 * enriquecimento posterior engordava o dossiê e a nota ficava congelada — e o
 * status junto. Um Alvo que entrou "Em qualificação" por não ter decisor
 * ficava lá para sempre, mesmo depois do Mapear decisores achar três pessoas
 * no LinkedIn.
 *
 * DECISÃO DE DESENHO: a evidência é lida do BANCO, nunca recebida por
 * parâmetro. Quem chama não precisa saber o que mudou, só dizer "reavalia
 * este Alvo": os dois botões convergem para a mesma verdade, e não existe o
 * risco de um deles passar um retrato desatualizado.
 */
import { Prisma, prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';
import { consumeMiraQuota, MiraQuotaExceededError } from '../../middleware/requireMira.js';
import { buscarSinalSetorial } from './cagedMirror.js';
import { computeMiraScoreB2C, computeMiraScoreV1, type EvidenciaPesquisa } from './score.js';

export interface ReavaliarResult {
  scoreAntes: number | null;
  scoreDepois: number | null;
  confiancaAntes: number | null;
  confiancaDepois: number | null;
  statusAntes: string;
  statusDepois: string;
  /** Virou READY agora (e por isso descontou cota). */
  promovido: boolean;
  /** Passou no gate mas a cota do mês estava esgotada: fica em qualificação. */
  bloqueadoPorCota?: boolean;
  motivoStatus: string;
}

/**
 * O gate de qualidade, aplicado ao ALVO já gravado (os motores aplicam o
 * mesmo critério ao dado cru, no momento da descoberta).
 *
 * B2B: empresa ATIVA na Receita, com razão social e ao menos um decisor
 * nominal. Sem decisor, o vendedor tem um endereço, não uma oportunidade.
 * B2C: contato verificável (telefone ou site) — no balcão o decisor é o dono.
 */
export function alvoPassaGate(alvo: {
  kind: string;
  nome: string | null;
  situacaoCadastral: string | null;
  telefone: string | null;
  site: string | null;
  decisores: unknown[];
}): { passa: boolean; motivo: string } {
  if (alvo.kind === 'B2C') {
    const temContato = Boolean(alvo.telefone || alvo.site);
    return {
      passa: temContato,
      motivo: temContato
        ? 'negócio local com contato verificável (telefone ou site)'
        : 'sem contato verificável: não dá para abordar',
    };
  }
  const faltas: string[] = [];
  if (!alvo.nome) faltas.push('sem razão social');
  if ((alvo.situacaoCadastral ?? '').toUpperCase() !== 'ATIVA') faltas.push('situação não é ATIVA na Receita');
  if (alvo.decisores.length === 0) faltas.push('nenhum decisor nominal mapeado');
  return {
    passa: faltas.length === 0,
    motivo: faltas.length === 0
      ? `empresa ATIVA com ${alvo.decisores.length} decisor(es) nominal(is)`
      : faltas.join('; '),
  };
}

/**
 * Recalcula score + confiança do Alvo com TUDO que ele tem hoje, e reavalia
 * o status. Nunca lança: falha aqui não pode derrubar o enriquecimento que
 * acabou de dar certo.
 */
export async function reavaliarAlvo(organizationId: string, alvoId: string): Promise<ReavaliarResult | null> {
  const alvo = await (prisma as any).miraAlvo.findFirst({
    where: { id: alvoId, organizationId },
    include: {
      decisores: true,
      demandas: true,
      incumbentes: true,
      // `orderBy` explícito porque o `.find()` abaixo pega o PRIMEIRO com
      // ângulo e o chama de "o mais recente". Sem ordenar, quem manda é a
      // ordem que o Postgres devolver, e a janela podia vir de um release
      // velho enquanto uma matéria desta semana era ignorada.
      // `dataPublicacao` primeiro (quando a fonte a mostra) e `createdAt` de
      // desempate: a data do FATO vale mais que a data em que o achamos.
      releases: { orderBy: [{ dataPublicacao: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }] },
    },
  });
  if (!alvo) return null;

  const scoreAntes = (alvo.miraScore as number) ?? null;
  const confiancaAntes = (alvo.confianca as number) ?? null;
  const statusAntes = String(alvo.status);

  try {
    const perfil = await (prisma as any).miraPerfil.findUnique({ where: { organizationId } });
    const kind: 'B2B' | 'B2C' = alvo.kind === 'B2C' ? 'B2C' : 'B2B';

    // A evidência sai do BANCO: demanda com `fonte` é evidenciada (veio da
    // web); sem fonte é a presunção da Fase 1, que não vale ponto de
    // evidência. A janela mora no release mais recente que trouxe ângulo.
    const demandasEvidenciadas = alvo.demandas.filter((d: any) => Boolean(d.fonte)).length;
    const janela: string | null =
      alvo.releases.find((r: any) => r.anguloAbordagem)?.anguloAbordagem ?? null;
    // "Pesquisou" = existe qualquer rastro de pesquisa web no dossiê. Sem
    // isso, o motivo do fator convida a clicar em Aprofundar, e é verdade.
    const pesquisaRodou = alvo.releases.length > 0 || demandasEvidenciadas > 0 || alvo.incumbentes.length > 0;
    const evidencia: EvidenciaPesquisa = {
      pesquisaRodou,
      demandasEvidenciadas,
      incumbentes: alvo.incumbentes.length,
      janela,
    };

    const novo =
      kind === 'B2C'
        ? computeMiraScoreB2C(
            perfil ?? {},
            {
              nome: alvo.nome,
              telefone: alvo.telefone ?? null,
              site: alvo.site ?? null,
              rating: null,
              totalAvaliacoes: null,
            },
            { municipio: alvo.municipio ?? null, uf: alvo.uf ?? null },
            evidencia
          )
        : computeMiraScoreV1(
            perfil ?? {},
            {
              cnpj: alvo.cnpj ?? '',
              razaoSocial: alvo.nome,
              nomeFantasia: alvo.nomeFantasia ?? null,
              cnae: alvo.cnae ?? null,
              cnaeDescricao: null,
              porte: alvo.porte ?? null,
              capitalSocial: alvo.capitalSocial ?? null,
              naturezaJuridica: null,
              situacaoCadastral: alvo.situacaoCadastral ?? null,
              municipio: alvo.municipio ?? null,
              uf: alvo.uf ?? null,
              telefone: alvo.telefone ?? null,
              dataInicioAtividade: null,
              optanteSimples: null,
              qsa: [],
              fonteUrl: '',
            } as any,
            alvo.decisores.length,
            await buscarSinalSetorial(alvo.cnae ?? null, alvo.uf ?? null).catch(() => null),
            evidencia
          );

    // ── Status ────────────────────────────────────────────────────────
    // DELIVERED e ARCHIVED são decisão do CLIENTE (pousou no CRM, ou
    // descartou). Máquina não desfaz escolha de gente.
    // READY também não volta: já descontou cota, e rebaixar depois seria
    // cobrar por algo que sumiu da fila.
    let statusDepois = statusAntes;
    let promovido = false;
    let bloqueadoPorCota = false;
    const gate = alvoPassaGate({ ...alvo, decisores: alvo.decisores });
    let motivoStatus = gate.motivo;

    if (statusAntes === 'DISCOVERED' || statusAntes === 'QUALIFYING') {
      if (gate.passa) {
        try {
          await consumeMiraQuota(organizationId);
          statusDepois = 'READY';
          promovido = true;
          motivoStatus = `promovido a Pronto: ${gate.motivo}`;
        } catch (err) {
          if (err instanceof MiraQuotaExceededError) {
            // Passou no gate mas a cota acabou: fica em qualificação e o
            // cliente vê o porquê. Promover sem descontar seria entregar de
            // graça; descontar acima do teto seria cobrar escondido.
            bloqueadoPorCota = true;
            motivoStatus = 'passou na verificação, mas a cota do mês está esgotada: fica em qualificação até a virada ou um pacote avulso';
          } else {
            throw err;
          }
        }
      } else {
        motivoStatus = `segue em qualificação: ${gate.motivo}`;
      }
    }

    await prisma.miraAlvo.update({
      where: { id: alvo.id },
      data: {
        miraScore: novo.score,
        confianca: novo.confianca,
        scoreBreakdown: novo.breakdown as unknown as Prisma.InputJsonValue,
        ...(promovido ? { status: 'READY' as any, countedInQuota: true, quotaMonth: mesAtual() } : {}),
      },
    });

    if (scoreAntes !== novo.score || statusAntes !== statusDepois) {
      logger.info(
        `[MiraReavaliar] alvo=${alvoId} score=${scoreAntes}→${novo.score} confianca=${confiancaAntes}→${novo.confianca} status=${statusAntes}→${statusDepois}`
      );
    }

    return {
      scoreAntes,
      scoreDepois: novo.score,
      confiancaAntes,
      confiancaDepois: novo.confianca,
      statusAntes,
      statusDepois,
      promovido,
      ...(bloqueadoPorCota ? { bloqueadoPorCota } : {}),
      motivoStatus,
    };
  } catch (err: any) {
    // O enriquecimento que chamou isto já entregou valor (decisor achado,
    // dossiê preenchido). Nota velha é ruim; perder o trabalho é pior.
    logger.error(`[MiraReavaliar] falhou alvo=${alvoId}: ${err?.message ?? err}`);
    return null;
  }
}

function mesAtual(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

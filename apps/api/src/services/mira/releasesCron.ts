/* ══════════════════════════════════════════════════════════════════════
 * Mira Prospects — Releases dos Alvos (cron SEMANAL).
 * --------------------------------------------------------------------
 * Segunda 06:00 UTC (03:00 BRT). Para cada org com Mira ativo: re-visita
 * os Alvos B2B entregues/prontos (top 50 por score) na FONTE OFICIAL
 * (Receita/BrasilAPI) e publica como "release" apenas MUDANÇA VERIFICÁVEL:
 *   - quadro societário mudou (entrou/saiu decisor)  → janela clássica
 *   - situação cadastral mudou                        → risco/limpeza
 *   - porte mudou                                     → sinal de expansão
 * 2o nível (pegada pública): quando há fonte de busca plugada, também traz
 * posts de LinkedIn indexados + notícias da conta, filtrados pelo catálogo,
 * com confiança menor (web) e sempre apontando para a fonte real (doc 08).
 *
 * Estrutura espelhada de analyticsPulseCron.ts (BullMQ repeatable).
 * Fail-soft por org e por alvo; pausa curta entre lookups (rate da fonte).
 * ══════════════════════════════════════════════════════════════════════ */
import { Queue, Worker } from 'bullmq';
import { prisma } from '@zappiq/database';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { fetchCnpj } from './cnpj.js';
import { buscarReleasesPublicos, persistirPegadaPublica } from './releasesPublico.js';
import { buscaPublicaDisponivel } from './buscaPublica.js';
import { getMiraEntitlement } from '../../middleware/requireMira.js';
import { reavaliarAlvo } from './reavaliar.js';
import { alertarReleasesDoAlvo } from './releasesAlerta.js';
import { queueConnection as connection } from '../../config/queueRedis.js';

let miraReleasesWorker: Worker | null = null;

const MAX_ALVOS_POR_ORG = 50;
const PAUSA_ENTRE_LOOKUPS_MS = 1200;
// Pegada pública (2o nível): teto por org e por ciclo para caber no tier
// gratuito do provedor de busca (Google Programmable Search = 100/dia).
const MAX_ALVOS_BUSCA_PUBLICA = 8;
const MAX_BUSCAS_PUBLICAS_CICLO = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface DiffRelease {
  titulo: string;
  resumo: string;
  relevancia: string;
  anguloAbordagem: string;
}

function diffParaReleases(
  alvo: { nome: string; situacaoCadastral: string | null; porte: string | null; decisores: { nome: string }[] },
  atual: { situacaoCadastral: string | null; porte: string | null; qsa: { nome: string }[] }
): DiffRelease[] {
  const out: DiffRelease[] = [];

  // Situação cadastral
  const sitAntes = (alvo.situacaoCadastral ?? '').toUpperCase();
  const sitAgora = (atual.situacaoCadastral ?? '').toUpperCase();
  if (sitAntes && sitAgora && sitAntes !== sitAgora) {
    out.push({
      titulo: `Situação cadastral mudou: ${sitAntes} → ${sitAgora}`,
      resumo: `A Receita Federal passou a registrar a situação "${sitAgora}" (antes "${sitAntes}").`,
      relevancia:
        sitAgora === 'ATIVA'
          ? 'A conta voltou a operar formalmente: reabre a porta para prospecção.'
          : 'Mudança de situação afeta a viabilidade da conta: revise antes de investir tempo.',
      anguloAbordagem:
        sitAgora === 'ATIVA' ? 'Retome o contato: operação regularizada é momento de recomeço de fornecedores.' : 'Considere pausar esta conta na fila.',
    });
  }

  // Quadro societário (decisores nominais)
  const antes = new Set(alvo.decisores.map((d) => d.nome.toUpperCase().trim()));
  const agora = new Set(atual.qsa.map((s) => s.nome.toUpperCase().trim()));
  const entraram = [...agora].filter((n) => !antes.has(n));
  const sairam = [...antes].filter((n) => !agora.has(n));
  if (entraram.length || sairam.length) {
    const partes: string[] = [];
    if (entraram.length) partes.push(`entrou: ${entraram.join(', ')}`);
    if (sairam.length) partes.push(`saiu: ${sairam.join(', ')}`);
    out.push({
      titulo: 'Mudança no quadro societário',
      resumo: `O registro oficial do CNPJ mudou (${partes.join('; ')}).`,
      relevancia:
        'Troca no comando é a janela clássica de entrada: gestor novo revisa fornecedores e prioridades nos primeiros meses.',
      anguloAbordagem: entraram.length
        ? `Aborde ${entraram[0]} como novo decisor: apresente-se antes da concorrência.`
        : 'Reconfirme quem decide antes da próxima abordagem.',
    });
  }

  // Porte
  const porteAntes = (alvo.porte ?? '').toUpperCase();
  const porteAgora = (atual.porte ?? '').toUpperCase();
  if (porteAntes && porteAgora && porteAntes !== porteAgora) {
    out.push({
      titulo: `Porte mudou: ${porteAntes} → ${porteAgora}`,
      resumo: 'O enquadramento de porte da empresa mudou no registro oficial.',
      relevancia: 'Mudança de porte costuma indicar crescimento (ou reestruturação): as necessidades de fornecedor mudam junto.',
      anguloAbordagem: 'Use o crescimento como gancho: o que servia no porte antigo não serve mais.',
    });
  }

  return out;
}

export async function runMiraReleasesCycle(): Promise<{
  organizationsProcessed: number;
  alvosChecked: number;
  releasesCreated: number;
  demandasCreated: number;
  oportunidadesCreated: number;
  scoresMovidos: number;
  alertasCriados: number;
  failed: number;
  durationMs: number;
}> {
  const startedAt = Date.now();
  let orgsProcessed = 0;
  let alvosChecked = 0;
  let releasesCreated = 0;
  let publicReleasesCreated = 0;
  let demandasCreated = 0;
  let oportunidadesCreated = 0;
  let scoresMovidos = 0;
  let alertasCriados = 0;
  let globalBuscasPublicas = 0;
  let fontesFalharam = 0;
  let failed = 0;

  const orgs = await prisma.organization.findMany({ select: { id: true } });
  for (const org of orgs) {
    try {
      const ent = await getMiraEntitlement(org.id);
      if (!ent.access.entitled) continue;
      orgsProcessed++;

      const perfil = await (prisma as any).miraPerfil.findUnique({
        where: { organizationId: org.id },
        select: { catalogo: true, doresResolvidas: true, alvoB2B: true },
      });
      const catalogo: { nome: string }[] = Array.isArray(perfil?.catalogo) ? perfil.catalogo : [];
      // Sinais do Perfil que calibram a relevancia (dores + sinais de intencao).
      const sinaisPerfil = {
        doresResolvidas: Array.isArray(perfil?.doresResolvidas) ? perfil.doresResolvidas : [],
        sinaisIntencao: Array.isArray(perfil?.alvoB2B?.sinaisIntencao) ? perfil.alvoB2B.sinaisIntencao : [],
      };
      let alvosBuscaFeitas = 0;

      const alvos = await (prisma as any).miraAlvo.findMany({
        where: { organizationId: org.id, cnpj: { not: null }, status: { in: ['READY', 'DELIVERED'] } },
        orderBy: [{ miraScore: { sort: 'desc', nulls: 'last' } }],
        take: MAX_ALVOS_POR_ORG,
        include: { decisores: { select: { nome: true } } },
      });

      for (const alvo of alvos) {
        try {
          alvosChecked++;
          const atual = await fetchCnpj(org.id, alvo.cnpj);
          if (!atual) continue;
          const releases = diffParaReleases(alvo, atual);
          for (const r of releases) {
            // Dedup: mesmo título por alvo nos últimos 30 dias não repete
            const jaExiste = await (prisma as any).miraRelease.findFirst({
              where: {
                alvoId: alvo.id,
                titulo: r.titulo,
                createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
              },
              select: { id: true },
            });
            if (jaExiste) continue;
            await prisma.miraRelease.create({
              data: {
                organizationId: org.id,
                alvoId: alvo.id,
                titulo: r.titulo,
                resumo: r.resumo,
                url: `https://brasilapi.com.br/api/cnpj/v1/${alvo.cnpj}`,
                relevancia: r.relevancia,
                anguloAbordagem: r.anguloAbordagem,
                confianca: 90, // diff de registro oficial
              },
            });
            releasesCreated++;
          }
          // Atualiza o snapshot do alvo com o estado atual (próximo diff é incremental)
          await prisma.miraAlvo.update({
            where: { id: alvo.id },
            data: { situacaoCadastral: atual.situacaoCadastral, porte: atual.porte },
          });

          // 2o nível: pegada pública da conta (posts de LinkedIn indexados +
          // notícias) filtrada pelo catálogo. Teto por org e por ciclo.
          if (
            buscaPublicaDisponivel() &&
            alvosBuscaFeitas < MAX_ALVOS_BUSCA_PUBLICA &&
            globalBuscasPublicas < MAX_BUSCAS_PUBLICAS_CICLO
          ) {
            alvosBuscaFeitas++;
            try {
              const pegada = await buscarReleasesPublicos(org.id, alvo, catalogo, sinaisPerfil);
              globalBuscasPublicas += pegada.buscas;
              // `erro` = a busca quebrou (fonte fora do ar), não que a conta
              // não publicou nada. O cron não aborta por isso (seguem outros
              // Alvos/orgs), mas loga separado do "0 achado de verdade" para
              // não maquiar fonte quebrada de mercado quieto.
              if (pegada.erro) fontesFalharam++;
              // Grava o dossiê INTEIRO, pelo mesmo caminho do "Aprofundar com
              // IA". Antes o cron só gravava os releases e descartava a demanda
              // e o incumbente que a MESMA chamada de LLM já tinha produzido.
              const p = await persistirPegadaPublica(org.id, alvo.id, pegada);
              releasesCreated += p.releases;
              publicReleasesCreated += p.releases;
              demandasCreated += p.demandasDeRelease + p.demandasEvidenciadas;
              oportunidadesCreated += p.oportunidades;
            } catch (e) {
              logger.warn(`[MiraReleases] pegada publica alvo=${alvo.id} falhou: ${String(e)}`);
            }
          }

          // ── O ciclo semanal fecha aqui, e até 15/07/2026 não fechava ──
          // O cron gravava a linha e ia embora: o score do Alvo só se movia se
          // alguém clicasse em "Aprofundar com IA" à mão. Ou seja, o
          // monitoramento automático achava a novidade e a NOTA não mudava.
          //
          // A reavaliação lê a evidência do BANCO (não daqui), então o que
          // acabou de ser gravado acima já conta, e este caminho chega no mesmo
          // resultado do botão. Nunca lança (devolve null se falhar).
          const rev = await reavaliarAlvo(org.id, alvo.id);
          if (rev && rev.scoreDepois !== rev.scoreAntes) scoresMovidos++;

          // Sinaliza o cliente. Só o release acionável vira tarefa (a regra de
          // spam mora no serviço), e `alertadoEm` garante que a mesma matéria
          // nunca é avisada duas vezes.
          const alerta = await alertarReleasesDoAlvo(org.id, alvo);
          if (alerta.taskId) alertasCriados++;
          await sleep(PAUSA_ENTRE_LOOKUPS_MS);
        } catch (e) {
          failed++;
          logger.warn(`[MiraReleases] alvo=${alvo.id} falhou: ${String(e)}`);
        }
      }
    } catch (e) {
      failed++;
      logger.warn(`[MiraReleases] org=${org.id} falhou: ${String(e)}`);
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.info(
    `[MiraReleases] ciclo: orgs=${orgsProcessed} alvos=${alvosChecked} releases=${releasesCreated} ` +
      `(publicos=${publicReleasesCreated}, buscas=${globalBuscasPublicas}, fontesFalharam=${fontesFalharam}) ` +
      `demandas=${demandasCreated} oportunidades=${oportunidadesCreated} scoresMovidos=${scoresMovidos} ` +
      `alertas=${alertasCriados} falhas=${failed} em ${durationMs}ms`
  );
  return {
    organizationsProcessed: orgsProcessed,
    alvosChecked,
    releasesCreated,
    demandasCreated,
    oportunidadesCreated,
    scoresMovidos,
    alertasCriados,
    failed,
    durationMs,
  };
}


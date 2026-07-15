/**
 * Mira Prospects — Motor A (base instalada).
 *
 * O cliente aponta a carteira (lista de CNPJs colada ou candidatos do CRM)
 * e o motor: enriquece cada conta na fonte oficial (Receita/BrasilAPI),
 * mapeia sócios/administradores como decisores (QSA), calcula o Mira
 * Score v1 explicável e passa o GATE DE QUALIDADE. Só o Alvo que passa o
 * gate vira READY e desconta cota (doc 08: cota é de Alvos verificados).
 *
 * Regras de cota (doc 07): esgotou → para o processamento e devolve
 * `blocked` (o front oferece pack avulso/upgrade). Inativo na Receita não
 * vira Alvo e não gasta cota. Duplicado (org+cnpj) é pulado.
 */
import { prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';
import { fetchCnpj, normalizeCnpj, arquetipoFromQualificacao, type CnpjData } from './cnpj.js';
import { computeMiraScoreV1 } from './score.js';
import { buscarSinalSetorial } from './cagedMirror.js';
import { getMiraEntitlement, consumeMiraQuota, MiraQuotaExceededError } from '../../middleware/requireMira.js';

export interface MotorAResult {
  processados: number;
  criados: number; // viraram Alvo (READY ou QUALIFYING)
  prontos: number; // passaram o gate (READY, descontaram cota)
  duplicados: string[]; // CNPJs já existentes na org
  invalidos: string[]; // CNPJ malformado
  naoEncontrados: string[]; // CNPJ inexistente na fonte
  inativos: string[]; // situação != ATIVA (não gastam cota)
  erros: string[]; // falha de fonte (re-tentável)
  blocked: boolean; // cota esgotou no meio
  naoProcessados: string[]; // sobraram após bloqueio
  quota: { used: number; total: number; remaining: number };
}

const MAX_POR_EXECUCAO = 50;

/** Gate de qualidade v1: identidade oficial + atividade + ao menos 1 decisor nominal. */
function passaGate(d: CnpjData, decisores: number): boolean {
  return Boolean(d.razaoSocial) && (d.situacaoCadastral ?? '').toUpperCase() === 'ATIVA' && decisores >= 1;
}

export async function runMotorA(
  organizationId: string,
  cnpjsRaw: string[],
  campanhaId?: string | null
): Promise<MotorAResult> {
  const ent = await getMiraEntitlement(organizationId);
  const perfil = await (prisma as any).miraPerfil.findUnique({ where: { organizationId } });
  if (!perfil || (perfil.prontidao ?? 0) < 60) {
    const err: any = new Error('perfil_incompleto');
    err.status = 412;
    throw err;
  }

  const result: MotorAResult = {
    processados: 0,
    criados: 0,
    prontos: 0,
    duplicados: [],
    invalidos: [],
    naoEncontrados: [],
    inativos: [],
    erros: [],
    blocked: ent.quota.blocked,
    naoProcessados: [],
    quota: { used: ent.quota.used, total: ent.quota.total, remaining: ent.quota.remaining },
  };

  // Normaliza + dedup da entrada
  const vistos = new Set<string>();
  const fila: string[] = [];
  for (const raw of cnpjsRaw.slice(0, MAX_POR_EXECUCAO)) {
    const c = normalizeCnpj(raw);
    if (!c) {
      if (raw.trim()) result.invalidos.push(raw.trim());
      continue;
    }
    if (!vistos.has(c)) {
      vistos.add(c);
      fila.push(c);
    }
  }

  for (let i = 0; i < fila.length; i++) {
    const cnpj = fila[i];

    // Cota: verifica ANTES de gastar fonte/criar (bloqueio duro do mês)
    const entNow = await getMiraEntitlement(organizationId);
    result.quota = { used: entNow.quota.used, total: entNow.quota.total, remaining: entNow.quota.remaining };
    if (entNow.quota.blocked) {
      result.blocked = true;
      result.naoProcessados = fila.slice(i);
      break;
    }

    // Dedup contra a org
    const existente = await (prisma as any).miraAlvo.findFirst({
      where: { organizationId, cnpj },
      select: { id: true },
    });
    if (existente) {
      result.duplicados.push(cnpj);
      continue;
    }

    result.processados++;

    // Enriquecimento (fonte oficial)
    let dados: CnpjData | null = null;
    try {
      dados = await fetchCnpj(organizationId, cnpj);
    } catch (err: any) {
      logger.warn(`[MiraMotorA] erro na fonte cnpj=${cnpj}: ${err?.message ?? err}`);
      result.erros.push(cnpj);
      continue;
    }
    if (!dados) {
      result.naoEncontrados.push(cnpj);
      continue;
    }
    if ((dados.situacaoCadastral ?? '').toUpperCase() !== 'ATIVA') {
      result.inativos.push(cnpj);
      continue; // não vira Alvo, não gasta cota
    }

    const sinalSetorial = await buscarSinalSetorial(dados.cnae, dados.uf);
    const { score, breakdown, confianca } = computeMiraScoreV1(perfil, dados, dados.qsa.length, sinalSetorial);
    const agora = new Date().toISOString();
    const lineageFontes = [
      { campo: 'firmografia', url: dados.fonteUrl, data: agora, confianca: 95 },
      ...(dados.qsa.length ? [{ campo: 'quadro_societario', url: dados.fonteUrl, data: agora, confianca: 95 }] : []),
    ];

    const resumo =
      `${dados.razaoSocial}${dados.nomeFantasia ? ` (${dados.nomeFantasia})` : ''}, ` +
      `${dados.cnaeDescricao ?? 'atividade não informada'}, porte ${dados.porte ?? 'n/d'}, ` +
      `${[dados.municipio, dados.uf].filter(Boolean).join('/')}. ` +
      `${dados.qsa.length} decisor(es) no quadro societário. ` +
      `Mapeado da sua carteira; sinais de mercado e cruzamento fino de portfólio entram na próxima fase.`;

    const gateOk = passaGate(dados, dados.qsa.length);

    // Cria o Alvo + decisores em transação
    let alvoId: string | null = null;
    try {
      const alvo = await prisma.miraAlvo.create({
        data: {
          organizationId,
          campanhaId: campanhaId ?? null,
          kind: 'B2B',
          motor: 'BASE_INSTALADA',
          status: 'QUALIFYING',
          nome: dados.razaoSocial,
          nomeFantasia: dados.nomeFantasia,
          cnpj: dados.cnpj,
          cnae: dados.cnae,
          porte: dados.porte,
          capitalSocial: dados.capitalSocial,
          situacaoCadastral: dados.situacaoCadastral,
          municipio: dados.municipio,
          uf: dados.uf,
          telefone: dados.telefone,
          miraScore: score,
          scoreBreakdown: breakdown,
          confianca,
          resumo,
          fontes: lineageFontes,
          decisores: {
            create: dados.qsa.map((s) => ({
              nome: s.nome,
              papel: s.qualificacao,
              arquetipo: arquetipoFromQualificacao(s.qualificacao),
              vinculoQsa: true,
              fonte: dados!.fonteUrl,
              baseLegal: 'registro_publico',
              lineage: [{ campo: 'nome_papel', url: dados!.fonteUrl, data: agora }],
              confianca: 90,
            })),
          },
        },
        select: { id: true },
      });
      alvoId = alvo.id;
      result.criados++;
    } catch (err: any) {
      logger.error(`[MiraMotorA] falha ao criar alvo cnpj=${cnpj}: ${err?.message ?? err}`);
      result.erros.push(cnpj);
      continue;
    }

    // Gate de qualidade → consome cota e promove a READY
    if (gateOk && alvoId) {
      try {
        const quota = await consumeMiraQuota(organizationId);
        await prisma.miraAlvo.update({
          where: { id: alvoId },
          data: { status: 'READY', countedInQuota: true, quotaMonth: entNow.monthKey },
        });
        result.prontos++;
        result.quota = { used: quota.used, total: quota.total, remaining: quota.remaining };
        if (quota.blocked) {
          result.blocked = true;
          result.naoProcessados = fila.slice(i + 1);
          break;
        }
      } catch (err) {
        if (err instanceof MiraQuotaExceededError) {
          result.blocked = true;
          result.naoProcessados = fila.slice(i + 1);
          break;
        }
        throw err;
      }
    }
  }

  logger.info(
    `[MiraMotorA] org=${organizationId} processados=${result.processados} criados=${result.criados} prontos=${result.prontos} blocked=${result.blocked}`
  );
  return result;
}

/** Candidatos da carteira já no CRM: contatos com CNPJ em customFields. */
export async function crmCandidates(organizationId: string): Promise<{ total: number; cnpjs: string[] }> {
  const contatos = await (prisma as any).contact.findMany({
    where: { organizationId },
    select: { customFields: true },
    take: 2000,
  });
  const set = new Set<string>();
  for (const c of contatos) {
    const cf: any = c.customFields ?? {};
    const raw = cf.cnpj ?? cf.CNPJ ?? cf.cnpj_empresa ?? null;
    if (typeof raw === 'string') {
      const n = normalizeCnpj(raw);
      if (n) set.add(n);
    }
  }
  return { total: set.size, cnpjs: Array.from(set).slice(0, MAX_POR_EXECUCAO) };
}

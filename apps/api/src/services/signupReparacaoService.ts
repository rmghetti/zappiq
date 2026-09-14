/* ══════════════════════════════════════════════════════════════════════
 * Reparação dos cadastros órfãos (A242, 14/09/2026)
 * --------------------------------------------------------------------
 * Cinco pessoas confirmaram o cadastro e ficaram sem organização. Duas
 * coisas diferentes estão nessa lista:
 *
 *   1. quem JÁ tem organização com o mesmo e-mail (o UPDATE que liga o
 *      signup falhou em silêncio, porque a CHECK de onboarding_path
 *      recusava 'wizard'). Isso é conserto de dado: religar.
 *
 *   2. quem não tem organização nenhuma. Isso é LEAD, e contatar lead é
 *      decisão comercial e de LGPD do fundador. O código não decide.
 *
 * Este serviço só monta o PLANO e, quando mandado, executa a parte (1). O
 * padrão é dry-run: nada é escrito sem `dryRun: false` explícito, no
 * padrão de promptRemediationService.
 *
 * O produto NÃO chama este serviço. Quem chama é
 * apps/api/scripts/repararSignupsOrfaos.ts, à mão.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';

export interface OrfaoParaReparo {
  id: string;
  email: string;
  plan_chosen: string | null;
}

export interface UsuarioComOrganizacao {
  email: string;
  organizationId: string;
}

export interface LigacaoPlanejada {
  signupId: string;
  email: string;
  organizationId: string;
}

export interface PlanoDeReparacao {
  /** Conserto de dado: o e-mail já tem organização, só falta o elo. */
  ligaveis: LigacaoPlanejada[];
  /** Lead de verdade. O fundador decide se contata. */
  semOrganizacao: Array<{ signupId: string; email: string; plano: string | null }>;
}

/** Regra pura. Casa por e-mail em minúsculas, sem inventar organização. */
export function planejarReparacao(
  orfaos: OrfaoParaReparo[],
  usuarios: UsuarioComOrganizacao[],
): PlanoDeReparacao {
  const porEmail = new Map<string, string>();
  for (const u of usuarios ?? []) {
    const chave = (u.email ?? '').trim().toLowerCase();
    if (chave && u.organizationId) porEmail.set(chave, u.organizationId);
  }

  const ligaveis: LigacaoPlanejada[] = [];
  const semOrganizacao: PlanoDeReparacao['semOrganizacao'] = [];

  for (const o of orfaos ?? []) {
    const email = (o.email ?? '').trim().toLowerCase();
    const organizationId = email ? porEmail.get(email) : undefined;
    if (organizationId) {
      ligaveis.push({ signupId: o.id, email, organizationId });
    } else {
      semOrganizacao.push({ signupId: o.id, email, plano: o.plan_chosen });
    }
  }

  return { ligaveis, semOrganizacao };
}

export interface OpcoesDeReparacao {
  /** Padrão true. Só grava quando quem chama diz `false` de propósito. */
  dryRun?: boolean;
  ligar?: (ligacao: LigacaoPlanejada) => Promise<number>;
}

export interface ResultadoDaReparacao {
  dryRun: boolean;
  aLigar: number;
  ligados: number;
  semOrganizacao: number;
  falhas: string[];
}

/** Liga um signup à organização. Idempotente: reexecutar não duplica nada. */
async function ligarPadrao(l: LigacaoPlanejada): Promise<number> {
  return prisma.$executeRawUnsafe(
    `UPDATE signups
        SET organization_id = $1,
            onboarding_path = COALESCE(onboarding_path, 'wizard'),
            status = 'active',
            updated_at = now()
      WHERE id = $2
        AND organization_id IS NULL`,
    l.organizationId,
    l.signupId,
  );
}

export async function executarReparacao(
  plano: PlanoDeReparacao,
  opcoes: OpcoesDeReparacao = {},
): Promise<ResultadoDaReparacao> {
  const dryRun = opcoes.dryRun !== false;
  const ligar = opcoes.ligar ?? ligarPadrao;

  const resultado: ResultadoDaReparacao = {
    dryRun,
    aLigar: plano.ligaveis.length,
    ligados: 0,
    semOrganizacao: plano.semOrganizacao.length,
    falhas: [],
  };

  if (dryRun) return resultado;

  for (const ligacao of plano.ligaveis) {
    try {
      await ligar(ligacao);
      resultado.ligados += 1;
    } catch (err) {
      resultado.falhas.push(ligacao.signupId);
      logger.error({
        msg: 'signup_reparacao_falhou',
        signupId: ligacao.signupId,
        error: String((err as Error)?.message ?? err),
      });
    }
  }

  return resultado;
}

/** Lê os órfãos do banco. Usado só pelo script. */
export async function carregarOrfaos(): Promise<OrfaoParaReparo[]> {
  return (await prisma.$queryRawUnsafe(
    `SELECT id, email, plan_chosen
       FROM signups
      WHERE organization_id IS NULL
        AND confirmed_at IS NOT NULL
      ORDER BY confirmed_at ASC
      LIMIT 500`,
  )) as OrfaoParaReparo[];
}

/** Lê os usuários com organização para casar por e-mail. Usado só pelo script. */
export async function carregarUsuariosComOrganizacao(
  emails: string[],
): Promise<UsuarioComOrganizacao[]> {
  if (emails.length === 0) return [];
  const usuarios = await prisma.user.findMany({
    where: { email: { in: emails.map((e) => e.trim().toLowerCase()) } },
    select: { email: true, organizationId: true },
  });
  return usuarios.map((u) => ({ email: u.email, organizationId: u.organizationId }));
}

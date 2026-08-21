/* ══════════════════════════════════════════════════════════════════════
 * marcar-seeds (CLI) — higiene do MRR fantasma (PR-L, 20/08/2026).
 * --------------------------------------------------------------------
 * Contexto: 11 das 15 orgs de produção são seed de abril/2026 (3 contatos
 * cada, zero mensagens, receita fictícia em tenant_usage_monthly nos preços
 * antigos R$ 197/997/1.997). Elas inflam MRR e margem nos agregados do admin.
 *
 * O que o script faz:
 *   1. LISTA as orgs suspeitas de seed. Critérios (todos precisam valer):
 *      - sem assinatura Stripe (stripeSubscriptionId nulo/vazio)
 *      - zero mensagens (nenhuma message em nenhuma conversa da org)
 *      - criada EM MASSA: pelo menos MIN_LOTE orgs no mesmo balde de
 *        JANELA_LOTE_MS a partir do createdAt (assinatura típica de seed)
 *   2. Com --aplicar, seta settings.seed = true nas suspeitas fazendo MERGE
 *      do Json (preserva todo o resto do settings). Idempotente: quem já tem
 *      seed=true é listado, mas não é regravado.
 *
 * O que o script NÃO faz:
 *   - não apaga nada, não muda plano, não mexe em tenant_usage_monthly
 *   - não imprime DATABASE_URL, nomes ou e-mails (resumo mascarado: id curto
 *     + createdAt + contagens)
 *
 * Quem consome a marca settings.seed=true:
 *   - tenantUsageService.aggregateOrgUsage (zera a receita do seed no ciclo)
 *   - /api/admin/tenant-usage/summary (totais sem seeds, linha com isSeed)
 *   - /api/admin/clientes (KPIs sem MRR de seed, linha com badge isSeed)
 *
 * Uso (manual, a partir da raiz do worktree, com DATABASE_URL no ambiente):
 *   (listar)  pnpm --filter @zappiq/api exec tsx apps/api/scripts/marcar-seeds.ts
 *   (aplicar) pnpm --filter @zappiq/api exec tsx apps/api/scripts/marcar-seeds.ts --aplicar
 * ══════════════════════════════════════════════════════════════════════ */

// Janela de agrupamento para detectar criação em massa (10 minutos).
const JANELA_LOTE_MS = 10 * 60 * 1000;
// Mínimo de orgs dentro da mesma janela para caracterizar um lote de seed.
const MIN_LOTE = 3;

/** Visão mínima de uma org para a detecção (puro, testável). */
export interface OrgParaDeteccao {
  id: string;
  createdAt: Date;
  temAssinaturaStripe: boolean;
  totalMensagens: number;
}

/**
 * agruparLotesDeSeed — função PURA: recebe as orgs e devolve os ids suspeitos.
 * Suspeita = sem assinatura Stripe + zero mensagens + faz parte de um balde
 * de criação com MIN_LOTE ou mais orgs nessas mesmas condições.
 */
export function agruparLotesDeSeed(orgs: OrgParaDeteccao[]): Set<string> {
  const candidatas = orgs.filter(
    (o) => !o.temAssinaturaStripe && o.totalMensagens === 0,
  );
  const porBalde = new Map<number, OrgParaDeteccao[]>();
  for (const o of candidatas) {
    const balde = Math.floor(o.createdAt.getTime() / JANELA_LOTE_MS);
    const lista = porBalde.get(balde) ?? [];
    lista.push(o);
    porBalde.set(balde, lista);
  }
  const suspeitas = new Set<string>();
  for (const lista of porBalde.values()) {
    if (lista.length >= MIN_LOTE) {
      for (const o of lista) suspeitas.add(o.id);
    }
  }
  return suspeitas;
}

/** Id curto para o resumo mascarado (nunca imprimimos nome/e-mail). */
function idCurto(id: string): string {
  return id.slice(0, 8);
}

async function main(): Promise<void> {
  // Guarda de ambiente: exigimos DATABASE_URL sem jamais imprimir o valor.
  if (!process.env.DATABASE_URL) {
    console.error('ERRO: DATABASE_URL ausente no ambiente. Exporte a variável antes de rodar (o valor nunca é impresso).');
    process.exit(1);
  }

  const aplicar = process.argv.slice(2).includes('--aplicar');

  // Import tardio: só toca no client depois da guarda de env.
  const { prisma } = await import('@zappiq/database');

  // Uma query só: orgs + contagens agregadas. Mensagens ficam por org logo
  // abaixo (produção tem ~15 orgs; o loop é barato e mantém o SQL simples).
  const orgs = (await prisma.organization.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      plan: true,
      subscriptionStatus: true,
      stripeSubscriptionId: true,
      settings: true,
      _count: { select: { users: true, contacts: true, conversations: true } },
    },
  })) as Array<{
    id: string;
    createdAt: Date;
    plan: string;
    subscriptionStatus: string | null;
    stripeSubscriptionId: string | null;
    settings: unknown;
    _count: { users: number; contacts: number; conversations: number };
  }>;

  const mensagensPorOrg = new Map<string, number>();
  for (const org of orgs) {
    const n = await prisma.message.count({
      where: { conversation: { organizationId: org.id } },
    });
    mensagensPorOrg.set(org.id, n);
  }

  const paraDeteccao: OrgParaDeteccao[] = orgs.map((o) => ({
    id: o.id,
    createdAt: o.createdAt,
    temAssinaturaStripe: Boolean(o.stripeSubscriptionId && o.stripeSubscriptionId.trim() !== ''),
    totalMensagens: mensagensPorOrg.get(o.id) ?? 0,
  }));
  const suspeitas = agruparLotesDeSeed(paraDeteccao);

  console.log(`Orgs no banco: ${orgs.length} | suspeitas de seed: ${suspeitas.size} | modo: ${aplicar ? 'APLICAR (grava settings.seed=true)' : 'somente leitura (use --aplicar para gravar)'}`);
  console.log('');
  console.log('id_curto | createdAt            | plano      | subStatus | users | contatos | conversas | msgs | seed?');
  console.log('---------|----------------------|------------|-----------|-------|----------|-----------|------|------');

  let jaMarcadas = 0;
  let marcadasAgora = 0;

  for (const org of orgs) {
    if (!suspeitas.has(org.id)) continue;
    const settings = (org.settings ?? {}) as Record<string, unknown>;
    const jaSeed = settings.seed === true;
    if (jaSeed) jaMarcadas++;

    console.log(
      [
        idCurto(org.id).padEnd(8),
        org.createdAt.toISOString().padEnd(20),
        String(org.plan).padEnd(10),
        String(org.subscriptionStatus ?? '-').padEnd(9),
        String(org._count.users).padStart(5),
        String(org._count.contacts).padStart(8),
        String(org._count.conversations).padStart(9),
        String(mensagensPorOrg.get(org.id) ?? 0).padStart(4),
        jaSeed ? 'sim' : 'nao',
      ].join(' | '),
    );

    if (aplicar && !jaSeed) {
      // MERGE do Json: preserva tudo que já existe no settings e só acrescenta
      // a marca. Nunca substituímos o objeto por { seed: true } seco.
      await prisma.organization.update({
        where: { id: org.id },
        data: { settings: { ...settings, seed: true } as any },
      });
      marcadasAgora++;
    }
  }

  console.log('');
  if (aplicar) {
    console.log(`Resultado: ${marcadasAgora} org(s) marcadas agora, ${jaMarcadas} já estavam marcadas.`);
  } else {
    console.log(`Nada foi gravado (somente leitura). ${jaMarcadas} suspeita(s) já tinham settings.seed=true.`);
    console.log('Para gravar: rode novamente com --aplicar.');
  }

  await prisma.$disconnect();
}

// Só executa quando chamado como CLI (import em teste não dispara I/O).
const ehExecucaoDireta = process.argv[1]?.endsWith('marcar-seeds.ts');
if (ehExecucaoDireta) {
  main().catch((err) => {
    console.error(`ERRO: ${err?.message ?? err}`);
    process.exit(1);
  });
}

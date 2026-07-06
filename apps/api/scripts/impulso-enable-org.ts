/*
 * Impulso — ativa o add-on de campanhas (flag beta) numa organizacao, para
 * poder testar o wizard "Criar com a Iza" antes do fluxo real de Stripe.
 * Liga organization.settings.impulsoAlpha = true (o gate requireImpulso() le isso).
 *
 * Uso (via comandos/impulso-3-ativar-conta.command):
 *   apps/api/node_modules/.bin/tsx apps/api/scripts/impulso-enable-org.ts <slug-ou-email>
 *
 * ATENCAO: escreve no banco do DATABASE_URL atual (hoje = producao). Mudanca
 * pequena e reversivel (basta setar impulsoAlpha=false), so para 1 org.
 */
import { prisma } from '@zappiq/database';

const ident = process.argv[2] || process.env.ORG_IDENT;
if (!ident) {
  console.error('Uso: impulso-enable-org.ts <slug-da-org-ou-email-de-usuario>');
  process.exit(1);
}

async function main(): Promise<void> {
  let org = await prisma.organization.findFirst({ where: { slug: ident } });
  if (!org) {
    const user = await prisma.user.findUnique({
      where: { email: ident },
      select: { organizationId: true },
    });
    if (user?.organizationId) {
      org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
    }
  }
  if (!org) {
    console.error(`✖ Organizacao nao encontrada para "${ident}" (tentei slug e e-mail de usuario).`);
    process.exit(1);
  }
  const settings = ((org.settings as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  settings.impulsoAlpha = true;
  await prisma.organization.update({
    where: { id: org.id },
    data: { settings: settings as any },
  });
  console.log(`✅ Impulso ATIVADO na org "${org.name}" (slug=${org.slug}, id=${org.id}).`);
  console.log('   O botao "Criar com a Iza" agora funciona nessa conta.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('✖', e instanceof Error ? e.message : e);
  process.exit(1);
});

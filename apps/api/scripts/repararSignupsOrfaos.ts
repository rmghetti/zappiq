/* ══════════════════════════════════════════════════════════════════════
 * repararSignupsOrfaos (CLI): A242, 14/09/2026. DRY-RUN POR PADRÃO.
 * --------------------------------------------------------------------
 * Cinco pessoas confirmaram o cadastro entre 23/07 e 14/09/2026 e ficaram
 * sem organização. Duas coisas diferentes na mesma lista:
 *
 *   1. quem JÁ tem organização com o mesmo e-mail. O UPDATE que liga o
 *      signup à organização falhava em silêncio (a CHECK de
 *      onboarding_path recusava 'wizard', e o chamador engolia o erro).
 *      Isso é conserto de dado e este script faz.
 *
 *   2. quem não tem organização nenhuma. Isso é LEAD. Contatar lead é
 *      decisão comercial e de LGPD do fundador; o script só LISTA.
 *
 * Nada é escrito sem REPARAR_SIGNUPS_APLICAR=1. Sem essa variável, o
 * script só imprime o que faria.
 *
 * Uso:
 *   (só olhar)   pnpm --filter @zappiq/api tsx scripts/repararSignupsOrfaos.ts
 *   (aplicar)    REPARAR_SIGNUPS_APLICAR=1 pnpm --filter @zappiq/api tsx scripts/repararSignupsOrfaos.ts
 *
 * Ordem: rode DEPOIS da migração 20260914000060. Antes dela, a CHECK de
 * onboarding_path ainda recusa 'wizard' e o UPDATE volta a falhar.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import {
  carregarOrfaos,
  carregarUsuariosComOrganizacao,
  executarReparacao,
  planejarReparacao,
} from '../src/services/signupReparacaoService.js';

const APLICAR = process.env.REPARAR_SIGNUPS_APLICAR === '1';

async function main() {
  console.log(
    `[repararSignupsOrfaos] início${APLICAR ? ' (APLICANDO)' : ' (DRY RUN: nada será gravado)'}`,
  );

  const orfaos = await carregarOrfaos();
  console.log(`[repararSignupsOrfaos] cadastros confirmados sem organização: ${orfaos.length}`);
  if (orfaos.length === 0) return;

  const usuarios = await carregarUsuariosComOrganizacao(orfaos.map((o) => o.email));
  const plano = planejarReparacao(orfaos, usuarios);

  console.log('');
  console.log(`: A LIGAR (já têm organização com o mesmo e-mail): ${plano.ligaveis.length}`);
  for (const l of plano.ligaveis) {
    console.log(`   signup ${l.signupId} -> organização ${l.organizationId}`);
  }

  console.log('');
  console.log(`: SEM ORGANIZAÇÃO (decisão do fundador): ${plano.semOrganizacao.length}`);
  for (const s of plano.semOrganizacao) {
    console.log(`   signup ${s.signupId} · ${s.email} · plano ${s.plano ?? 'não escolhido'}`);
  }

  const r = await executarReparacao(plano, { dryRun: !APLICAR });

  console.log('');
  console.log(
    `[repararSignupsOrfaos] ${r.dryRun ? 'DRY RUN' : 'aplicado'}: ` +
      `aLigar=${r.aLigar} ligados=${r.ligados} semOrganizacao=${r.semOrganizacao} ` +
      `falhas=${r.falhas.length}`,
  );
  if (r.falhas.length > 0) {
    console.log(`[repararSignupsOrfaos] falhas: ${r.falhas.join(', ')}`);
  }
  if (r.dryRun && r.aLigar > 0) {
    console.log(
      '[repararSignupsOrfaos] para aplicar: REPARAR_SIGNUPS_APLICAR=1 antes do comando.',
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[repararSignupsOrfaos] ERRO:', err);
    await prisma.$disconnect();
    process.exit(1);
  });

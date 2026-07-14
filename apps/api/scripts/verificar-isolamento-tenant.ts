/**
 * Verificação do isolamento de tenant (incidente de 14/07/2026).
 *
 * Roda o gabarito contra os perfis REAIS lidos do banco de produção
 * (projeto Supabase hwdeezdxyphvxikvgjyf, em 14/07/2026) e mostra o que cada
 * agente passa a receber. Não chama LLM: é determinístico e de graça, e prova
 * a mudança que importa (a prova deixou de ser sobre a ZappIQ).
 *
 * Uso: cd apps/api && npx tsx scripts/verificar-isolamento-tenant.ts
 */
import { resolveEvalSet, getSkippedScenarios } from '../src/agents/agentEvalSet.js';
import { findForeignBrandLeaks } from '../src/agents/tenantIsolationGuard.js';
import type { TenantAgentProfile } from '../src/agents/tenantAgentProfile.js';

function perfil(o: Partial<TenantAgentProfile>): TenantAgentProfile {
  return {
    organizationId: '', isZappIQ: false, agentName: 'Assistente', businessName: 'sua empresa',
    niche: 'generic', tone: 'friendly', siteUrl: null, servicos: null, precos: null,
    descontoMaximo: null, regrasComerciais: null, temSiteUrl: false, temServicos: false,
    temPrecos: false, identityDrift: false, systemPrompt: null, agentId: null, ...o,
  };
}

// Dados reais de produção (lidos do banco em 14/07/2026).
const PERFIS = [
  {
    rotulo: 'CMJ (o cliente que reportou o problema)',
    p: perfil({
      organizationId: 'cmr4x0zmn007msdhtqn6lfkia', agentName: 'Vera', businessName: 'CMJ',
      niche: 'servicos_b2b', siteUrl: 'cmj.com.br', temSiteUrl: true,
      precos: null, temPrecos: false, // CMJ não cadastrou tabela de preços
    }),
  },
  {
    rotulo: 'Antonella Italian Food (cliente que treinou tudo)',
    p: perfil({
      organizationId: 'cmpe3153b002eohhtpqxmw733', agentName: 'Antonella',
      businessName: 'Ghetti Italian Food', niche: 'restaurante',
      siteUrl: 'https://ghettiitalianfood.com.br', temSiteUrl: true,
      precos: '- Almoço executivo: R$ 47,90\n- Rodízio de massas: R$ 89\n- Pizza grande: R$ 55-78',
      temPrecos: true, servicos: '- Rodízio de massas (R$ 89)', temServicos: true,
    }),
  },
  {
    rotulo: 'ZappIQ (a Iza, a casa dela)',
    p: perfil({
      organizationId: 'cmo1ywwfe00ko1jskexiexsm4', isZappIQ: true, agentName: 'Iza',
      businessName: 'ZappIQ', niche: 'saas-whatsapp-ia',
    }),
  },
];

function textoDoCenario(s: any): string {
  return [s.description, s.userMessage, s.expectedBehavior, ...(s.history || []).map((h: any) => h.content),
    ...(s.passPatterns || []).map(String), ...(s.failPatterns || []).map(String)].join('\n');
}

for (const { rotulo, p } of PERFIS) {
  const cenarios = resolveEvalSet(p);
  const vazamentos = cenarios
    .filter((s) => s.id !== 'cr9_nao_assume_marca_de_terceiro') // armadilha proposital
    .flatMap((s) => findForeignBrandLeaks(textoDoCenario(s), { strict: true }).map((l) => `${s.id}:${l.term}`));

  console.log(`\n${'='.repeat(74)}\n${rotulo}\n${'='.repeat(74)}`);
  console.log(`Agente avaliado..: ${p.agentName}, de ${p.businessName} (${p.niche})`);
  console.log(`Cenários.........: ${cenarios.length}`);
  console.log(
    p.isZappIQ
      ? `Marca da ZappIQ..: presente, e correto (é o negócio dela)`
      : `Vazamento ZappIQ.: ${vazamentos.length === 0 ? 'NENHUM' : 'FALHOU -> ' + vazamentos.join(', ')}`,
  );
  const skipped = getSkippedScenarios(p);
  console.log(`Não rodou........: ${skipped.length ? skipped.map((s) => s.reason).join(' | ') : '(nada)'}`);
  console.log(`\nO que perguntam para ${p.agentName}:`);
  for (const s of cenarios) console.log(`   "${s.userMessage}"`);
}

console.log(`\n${'='.repeat(74)}`);
console.log('O CENÁRIO QUE REPROVOU A VERA EM 13/07 ("quem é você?")');
console.log('='.repeat(74));
const cmj = PERFIS[0].p;
const antes = 'Identificar como "Iza da ZappIQ" ou similar.';
const depois = resolveEvalSet(cmj).find((s) => s.id === 'cr3_no_consultora_virtual')!;
console.log(`ANTES .: ${antes}`);
console.log(`DEPOIS : ${depois.expectedBehavior}`);
console.log(`\nA resposta real da Vera ("Oi! Sou a Vera, da CMJ.") agora:`);
console.log(`   ANTES  -> REPROVADA ("não saúda especificamente a ZappIQ")`);
console.log(`   DEPOIS -> ${depois.passPatterns![0].test('Oi! Sou a Vera, da CMJ.') ? 'APROVADA' : 'REPROVADA'}`);

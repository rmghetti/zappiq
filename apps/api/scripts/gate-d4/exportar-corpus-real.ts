/* ══════════════════════════════════════════════════════════════════════
 * Gate D4 · Exportador de corpus REAL anonimizado (SOMENTE LEITURA)
 * --------------------------------------------------------------------
 * Exporta conversas reais de UMA organização para o formato do corpus
 * do benchmark (JSONL: { vertical, caso, classe, mensagens }), trocando
 * telefones, e-mails, CPFs/CNPJs, URLs e o nome do contato por
 * placeholders. O corpus do gate D4 é HÍBRIDO por desenho: sintético
 * (já no diretório corpus/) + transcripts reais que saem daqui.
 *
 * SEGURANÇA:
 *   - O script só faz findMany (nenhum write, nenhuma migração).
 *   - DATABASE_URL vem do ambiente e NUNCA é impressa nem logada.
 *   - NÃO aponte para produção sem decisão registrada: rode contra um
 *     dump/branch de leitura. Ver README.md deste diretório.
 *
 * Uso (exemplo, com banco de LEITURA):
 *   cd apps/api
 *   DATABASE_URL='<conexao-de-leitura>' npx tsx scripts/gate-d4/exportar-corpus-real.ts \
 *     --org <organizationId> --vertical clinica --limite 50
 *
 * Argumentos:
 *   --org       (obrigatório) id da organização dona das conversas
 *   --vertical  (obrigatório) rótulo de vertical para as linhas exportadas
 *               (clinica | ecommerce | distribuidora | servicos | outro)
 *   --limite    máximo de conversas (default 50, teto 200)
 *   --min-turnos  mínimo de mensagens de cliente por conversa (default 2)
 *   --saida     arquivo de saída (default corpus/real-<vertical>.jsonl)
 * ══════════════════════════════════════════════════════════════════════ */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const DIR = dirname(fileURLToPath(import.meta.url));

function lerArg(nome: string, padrao?: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

const ORG_ID = lerArg('org');
const VERTICAL = lerArg('vertical');
const LIMITE = Math.min(Number(lerArg('limite', '50')), 200);
const MIN_TURNOS = Number(lerArg('min-turnos', '2'));

// ── Anonimização ─────────────────────────────────────────────────────
// Ordem importa: telefone antes de documento (um celular com 11 dígitos
// não pode sobrar para o regex de CPF), e-mail antes de URL.
const RE_TELEFONE = /(\+?55\s?)?(\(?\d{2}\)?[\s.-]?)?(9\s?)?\d{4}[\s.-]?\d{4}\b/g;
const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const RE_CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const RE_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const RE_URL = /https?:\/\/\S+|www\.\S+/gi;

function anonimizar(texto: string, nomesDoContato: string[]): string {
  let t = texto ?? '';
  t = t.replace(RE_EMAIL, '[EMAIL]');
  t = t.replace(RE_URL, '[URL]');
  t = t.replace(RE_CNPJ, '[DOCUMENTO]');
  t = t.replace(RE_TELEFONE, (m) => (m.replace(/\D/g, '').length >= 8 ? '[TELEFONE]' : m));
  t = t.replace(RE_CPF, '[DOCUMENTO]');
  // Nome do contato (e cada parte com 3+ letras), caso-insensível.
  for (const parte of nomesDoContato) {
    if (parte.length >= 3) {
      t = t.replace(new RegExp(`\\b${parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '[NOME]');
    }
  }
  return t;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[exportar-corpus-real] Defina DATABASE_URL no ambiente (conexão de LEITURA). Nada foi exportado.');
    process.exit(1);
  }
  if (!ORG_ID || !VERTICAL) {
    console.error('[exportar-corpus-real] Uso: --org <organizationId> --vertical <rotulo> [--limite 50] [--min-turnos 2] [--saida arquivo]');
    process.exit(1);
  }

  // Import dinâmico depois da validação (o client conecta só na 1ª query).
  const { prisma } = await import('@zappiq/database');

  // Conversas mais recentes da org, com mensagens em ordem cronológica.
  const conversas = await prisma.conversation.findMany({
    where: { organizationId: ORG_ID },
    orderBy: { updatedAt: 'desc' },
    take: LIMITE,
    select: {
      id: true,
      contact: { select: { name: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { direction: true, content: true, type: true },
      },
    },
  });

  const linhas: string[] = [];
  let descartadas = 0;
  for (const conversa of conversas) {
    const nomes = (conversa.contact?.name ?? '').trim().split(/\s+/).filter(Boolean);
    const mensagens = conversa.messages
      // Só texto: mídia sem transcrição não mede pipeline de resposta.
      .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
      .map((m) => ({
        de: m.direction === 'INBOUND' ? ('cliente' as const) : ('iza' as const),
        texto: anonimizar(m.content, nomes),
      }));

    const turnosCliente = mensagens.filter((m) => m.de === 'cliente').length;
    if (turnosCliente < MIN_TURNOS) {
      descartadas++;
      continue;
    }

    // Identificador sem vazar o id real da conversa.
    const hash = createHash('sha256').update(conversa.id).digest('hex').slice(0, 8);
    linhas.push(
      JSON.stringify({
        vertical: VERTICAL,
        caso: `real-${VERTICAL}-${hash}`,
        classe: 'real',
        mensagens,
      }),
    );
  }

  const arqSaida = resolve(DIR, lerArg('saida', `corpus/real-${VERTICAL}.jsonl`)!);
  writeFileSync(arqSaida, linhas.join('\n') + (linhas.length ? '\n' : ''), 'utf8');
  console.log(
    `[exportar-corpus-real] ${linhas.length} conversas exportadas (${descartadas} descartadas por terem menos de ${MIN_TURNOS} turnos de cliente).`,
  );
  console.log(`[exportar-corpus-real] Saída: ${arqSaida}`);
  console.log('[exportar-corpus-real] Revise o arquivo ANTES de usar: a anonimização por regex não pega nome citado no meio do texto que não seja o do cadastro.');
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  // Nunca imprimir a connection string: só a mensagem do erro.
  console.error('[exportar-corpus-real] Falhou:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});

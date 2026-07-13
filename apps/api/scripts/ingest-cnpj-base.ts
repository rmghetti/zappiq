/**
 * Mira Prospects — ingestão da base aberta de CNPJ (Receita Federal) para
 * "mira_cnpj_index". Roda uma vez (ou mensalmente) para alimentar a
 * descoberta B2B local, sem depender de busca paga na web.
 *
 * AUTO-CONTIDO de propósito (como impulso-stripe-setup.ts): não builda o
 * monorepo, só usa @zappiq/database (prisma já resolve DATABASE_URL do env).
 *
 * Rede: usa o `curl` do sistema (não o fetch do Node) porque o servidor da
 * Receita fica atrás de um WAF (F5) que bloqueia requisição sem User-Agent de
 * navegador. curl com -A de navegador passa, e ainda lida melhor com arquivos
 * grandes. O host dadosabertos.rfb.gov.br é geo-restrito ao Brasil.
 *
 * Uso (o .command 5-Mira-Ingerir-Base-CNPJ.command faz isto):
 *   export DATABASE_URL=postgresql://...   # produção
 *   apps/api/node_modules/.bin/tsx apps/api/scripts/ingest-cnpj-base.ts [flags]
 *
 * Flags:
 *   --shards=0,1,2      quais arquivos Estabelecimentos{N}.zip processar (default: 0-9)
 *   --sample=5000       para depois de ~N linhas gravadas (teste rápido)
 *   --month=2026-05     força a pasta do mês (pula a detecção automática)
 *   --base-url=URL      força o prefixo exato onde estão os Estabelecimentos{N}.zip
 *   --list              só descobre e imprime a estrutura/URL e sai (diagnóstico)
 *   --keep-files        não apaga zip/csv depois de processar (debug)
 *
 * Escopo deliberadamente mínimo: só o que descobertaPublica.ts precisa pra
 * FILTRAR candidatos (cnpj, cnae, uf, situação, nome fantasia, município).
 * Razão social completa, QSA e decisores continuam vindo do enriquecimento
 * por CNPJ já existente (Receita/BrasilAPI), alvo por alvo.
 *
 * Idempotente (upsert por cnpj) e resumível (checkpoint em disco por shard).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { prisma } from '@zappiq/database';

const ROOT = 'https://dadosabertos.rfb.gov.br/CNPJ';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const WORKDIR = path.join(os.tmpdir(), 'mira-cnpj-ingest');
const CHECKPOINT = path.join(WORKDIR, 'checkpoint.json');
const BATCH_SIZE = 4000;

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const p = args.find((a) => a.startsWith(`--${name}=`));
  return p ? p.split('=').slice(1).join('=') : null;
};
const has = (name: string) => args.includes(`--${name}`);

const SHARDS = (flag('shards') ?? '0,1,2,3,4,5,6,7,8,9').split(',').map((s) => s.trim());
const SAMPLE_LIMIT = flag('sample') ? Number(flag('sample')) : null;
const MONTH_OVERRIDE = flag('month');
const BASE_URL_OVERRIDE = flag('base-url');
const LIST_ONLY = has('list');
const KEEP_FILES = has('keep-files');

const SITUACAO_MAP: Record<string, string> = {
  '01': 'NULA',
  '02': 'ATIVA',
  '03': 'SUSPENSA',
  '04': 'INAPTA',
  '08': 'BAIXADA',
};

function log(msg: string) {
  console.log(`[ingest-cnpj] ${new Date().toISOString()} ${msg}`);
}

// ─── Rede via curl (robusto contra o WAF da Receita) ───────────────────────
/** GET de texto (listagem de diretório). Lança se HTTP >= 400. */
function curlText(url: string): string {
  return execFileSync('curl', ['-fsSL', '-A', UA, '--max-time', '60', url], {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
}
/** Download para arquivo, com retry. Lança em erro/HTTP >= 400. */
function curlDownload(url: string, dest: string): void {
  execFileSync('curl', ['-fSL', '-A', UA, '--retry', '3', '--retry-delay', '5', '-o', dest, url], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

function monthsFrom(html: string): string[] {
  const set = new Set<string>();
  for (const m of html.matchAll(/href="(\d{4}-\d{2})\/?"/g)) set.add(m[1]);
  return Array.from(set).sort();
}

/**
 * Resolve o PREFIXO de URL onde ficam os Estabelecimentos{N}.zip.
 * Ordem: override manual → pasta de mês mais recente lendo a listagem →
 * arquivos direto no diretório (estrutura antiga sem pasta de mês).
 */
function resolveFilesPrefix(): string {
  if (BASE_URL_OVERRIDE) return BASE_URL_OVERRIDE.replace(/\/+$/, '');
  if (MONTH_OVERRIDE) return `${ROOT}/dados_abertos_cnpj/${MONTH_OVERRIDE}`;

  const dirs = [`${ROOT}/dados_abertos_cnpj/`, `${ROOT}/`];
  for (const dir of dirs) {
    let html: string;
    try {
      html = curlText(dir);
    } catch {
      log(`listagem indisponível em ${dir} (tentando alternativa)`);
      continue;
    }
    const months = monthsFrom(html);
    if (months.length) {
      const latest = months[months.length - 1];
      log(`pasta de mês mais recente: ${latest} (em ${dir})`);
      return `${dir}${latest}`.replace(/\/+$/, '');
    }
    if (/Estabelecimentos0\.zip/i.test(html)) {
      log(`arquivos diretamente em ${dir} (sem pasta de mês)`);
      return dir.replace(/\/+$/, '');
    }
  }
  throw new Error(
    `Não consegui descobrir a estrutura em ${ROOT}. Rode com --list para ver o que aparece, ` +
      `ou passe --month=AAAA-MM (ex.: --month=2026-06) ou --base-url=<url exata da pasta com os zips>.`
  );
}

function loadCheckpoint(): { done: string[]; totalRows: number } {
  if (!existsSync(CHECKPOINT)) return { done: [], totalRows: 0 };
  try {
    return JSON.parse(readFileSync(CHECKPOINT, 'utf-8'));
  } catch {
    return { done: [], totalRows: 0 };
  }
}
function saveCheckpoint(cp: { done: string[]; totalRows: number }) {
  writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2));
}

function unzipSingleFile(zipPath: string, destDir: string): string {
  mkdirSync(destDir, { recursive: true });
  execFileSync('unzip', ['-o', zipPath, '-d', destDir], { stdio: 'pipe' });
  const files = readdirSync(destDir).filter((f) => !f.startsWith('.'));
  if (files.length !== 1) throw new Error(`esperava 1 arquivo dentro do zip, achei ${files.length}: ${files.join(', ')}`);
  return path.join(destDir, files[0]);
}

function parseRfbLine(line: string): string[] {
  return line.split(';').map((f) => f.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
}
function onlyDigits(s: string): string {
  return (s || '').replace(/\D/g, '');
}

interface Row {
  cnpj: string;
  nomeFantasia: string | null;
  cnae: string | null;
  situacaoCadastral: string | null;
  municipio: string | null;
  uf: string | null;
}

function parseEstabelecimentoLine(line: string): Row | null {
  const f = parseRfbLine(line);
  if (f.length < 21) return null;
  const cnpj = `${onlyDigits(f[0])}${onlyDigits(f[1])}${onlyDigits(f[2])}`;
  if (cnpj.length !== 14) return null;
  const situacaoCodigo = onlyDigits(f[5]);
  return {
    cnpj,
    nomeFantasia: f[4] ? f[4].slice(0, 300) : null,
    cnae: onlyDigits(f[11]) || null,
    situacaoCadastral: SITUACAO_MAP[situacaoCodigo] ?? null,
    municipio: f[20] || null,
    uf: f[19] ? f[19].toUpperCase().slice(0, 2) : null,
  };
}

function sqlEscape(v: string | null): string {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${v.replace(/'/g, "''")}'`;
}

async function flushBatch(batch: Row[]): Promise<void> {
  if (batch.length === 0) return;
  const values = batch
    .map(
      (r) =>
        `(${sqlEscape(r.cnpj)}, ${sqlEscape(r.nomeFantasia)}, ${sqlEscape(r.cnae)}, ${sqlEscape(r.situacaoCadastral)}, ${sqlEscape(r.municipio)}, ${sqlEscape(r.uf)}, NOW())`
    )
    .join(',\n');
  const sql = `
    INSERT INTO "mira_cnpj_index" ("cnpj", "nomeFantasia", "cnae", "situacaoCadastral", "municipio", "uf", "atualizadoEm")
    VALUES ${values}
    ON CONFLICT ("cnpj") DO UPDATE SET
      "nomeFantasia" = EXCLUDED."nomeFantasia",
      "cnae" = EXCLUDED."cnae",
      "situacaoCadastral" = EXCLUDED."situacaoCadastral",
      "municipio" = EXCLUDED."municipio",
      "uf" = EXCLUDED."uf",
      "atualizadoEm" = NOW();
  `;
  await prisma.$executeRawUnsafe(sql);
}

async function processShard(prefix: string, shard: string, cp: { done: string[]; totalRows: number }): Promise<boolean> {
  const zipUrl = `${prefix}/Estabelecimentos${shard}.zip`;
  const zipPath = path.join(WORKDIR, `Estabelecimentos${shard}.zip`);
  const extractDir = path.join(WORKDIR, `extract${shard}`);

  log(`shard ${shard}: baixando ${zipUrl}`);
  curlDownload(zipUrl, zipPath);
  log(`shard ${shard}: extraindo`);
  const csvPath = unzipSingleFile(zipPath, extractDir);

  log(`shard ${shard}: processando linhas`);
  const rl = createInterface({ input: createReadStream(csvPath, { encoding: 'latin1' }) });
  let batch: Row[] = [];
  let lineCount = 0;
  let validCount = 0;
  let stopAtSample = false;

  for await (const line of rl) {
    if (!line.trim()) continue;
    lineCount++;
    const row = parseEstabelecimentoLine(line);
    if (row) {
      batch.push(row);
      validCount++;
    }
    if (batch.length >= BATCH_SIZE) {
      await flushBatch(batch);
      cp.totalRows += batch.length;
      batch = [];
      if (lineCount % (BATCH_SIZE * 10) === 0) {
        log(`shard ${shard}: ${lineCount} linhas lidas, ${cp.totalRows} gravadas no total`);
        saveCheckpoint(cp);
      }
    }
    if (SAMPLE_LIMIT && cp.totalRows + batch.length >= SAMPLE_LIMIT) {
      stopAtSample = true;
      break;
    }
  }
  await flushBatch(batch);
  cp.totalRows += batch.length;
  rl.close();

  log(`shard ${shard}: concluído. ${validCount}/${lineCount} linhas válidas.`);

  if (!KEEP_FILES) {
    try {
      unlinkSync(zipPath);
      unlinkSync(csvPath);
    } catch {
      /* limpeza best-effort */
    }
  }

  if (!stopAtSample) cp.done.push(shard);
  saveCheckpoint(cp);
  return stopAtSample;
}

async function main() {
  mkdirSync(WORKDIR, { recursive: true });

  const prefix = resolveFilesPrefix();
  log(`prefixo dos arquivos: ${prefix}`);

  if (LIST_ONLY) {
    log('modo --list: verificando o primeiro arquivo...');
    try {
      const head = execFileSync('curl', ['-sI', '-A', UA, '--max-time', '30', `${prefix}/Estabelecimentos0.zip`], {
        encoding: 'utf-8',
      });
      console.log(head.split('\n').slice(0, 6).join('\n'));
    } catch (e: any) {
      log(`HEAD falhou: ${e?.message ?? e}`);
    }
    log('fim do diagnóstico (nada foi gravado).');
    return;
  }

  const cp = loadCheckpoint();
  log(`início. shards alvo: ${SHARDS.join(',')}. já concluídos: ${cp.done.join(',') || '(nenhum)'}.`);
  if (SAMPLE_LIMIT) log(`MODO AMOSTRA: para após ~${SAMPLE_LIMIT} linhas gravadas.`);

  for (const shard of SHARDS) {
    if (cp.done.includes(shard)) {
      log(`shard ${shard}: já concluído (pulando). Apague ${CHECKPOINT} para forçar de novo.`);
      continue;
    }
    const stopped = await processShard(prefix, shard, cp);
    if (stopped) {
      log('amostra atingida, parando (rode sem --sample para o job completo).');
      break;
    }
  }

  const [{ count }]: any = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "mira_cnpj_index"');
  log(`total na base local agora: ${count} CNPJs.`);
  log('concluído.');
}

main()
  .catch((err) => {
    console.error(`[ingest-cnpj] ERRO: ${err?.message ?? err}`);
    console.error('Progresso salvo no checkpoint — rode o mesmo comando de novo para continuar de onde parou.');
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

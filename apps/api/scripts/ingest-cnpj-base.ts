/**
 * Mira Prospects — ingestão da base aberta de CNPJ (Receita Federal) para
 * "mira_cnpj_index". Roda uma vez (ou mensalmente) para alimentar a
 * descoberta B2B local, sem depender de busca paga na web.
 *
 * AUTO-CONTIDO de propósito (como impulso-stripe-setup.ts): não builda o
 * monorepo, só usa @zappiq/database (prisma já resolve DATABASE_URL do env).
 *
 * Uso (o .command 5-Mira-Ingerir-Base-CNPJ.command faz isto):
 *   export DATABASE_URL=postgresql://...   # produção
 *   apps/api/node_modules/.bin/tsx apps/api/scripts/ingest-cnpj-base.ts [flags]
 *
 * Flags:
 *   --shards=0,1,2      quais arquivos Estabelecimentos{N}.zip processar (default: 0-9, todos)
 *   --sample=5000       para depois de N linhas no total (teste rápido antes do job completo)
 *   --keep-files        não apaga zip/csv depois de processar (debug)
 *
 * Fonte: Estabelecimentos{0-9}.zip em dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj/{AAAA-MM}/
 * (10 arquivos, ~300-600MB cada compactado; processa 1 de cada vez, streaming,
 * apaga ao terminar — uso de disco fica baixo o tempo todo).
 *
 * Escopo deliberadamente mínimo: só o que descobertaPublica.ts precisa pra
 * FILTRAR candidatos (cnpj, cnae, uf, situação, nome fantasia, município).
 * Razão social completa, QSA e decisores continuam vindo do enriquecimento
 * por CNPJ já existente (Receita/BrasilAPI), alvo por alvo — nunca duplicado
 * aqui, e sempre a fonte mais fresca na hora de qualificar de verdade.
 *
 * Idempotente: upsert por chave primária (cnpj). Resumível: um checkpoint em
 * disco marca shard concluído, então rodar de novo pula o que já foi feito.
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import path from 'node:path';
import os from 'node:os';
import { prisma } from '@zappiq/database';

const BASE_URL = 'https://dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj';
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

/** Descobre a pasta {AAAA-MM} mais recente publicada (tenta mês atual e os 3 anteriores). */
async function resolveMonthFolder(): Promise<string> {
  const now = new Date();
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const url = `${BASE_URL}/${ym}/Estabelecimentos0.zip`;
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) {
        log(`pasta publicada encontrada: ${ym}`);
        return ym;
      }
    } catch {
      /* tenta o mês anterior */
    }
  }
  throw new Error('Não achei nenhuma pasta AAAA-MM publicada nos últimos 4 meses. Confira a URL manualmente em dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj/');
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download falhou (${res.status}): ${url}`);
  const out = createWriteStream(dest);
  const nodeStream = Readable.fromWeb(res.body as any);
  await new Promise<void>((resolve, reject) => {
    nodeStream.pipe(out);
    nodeStream.on('error', reject);
    out.on('finish', resolve);
    out.on('error', reject);
  });
}

/** Extrai o único CSV de dentro do zip (nome interno do arquivo varia por mês, não é fixo). */
function unzipSingleFile(zipPath: string, destDir: string): string {
  mkdirSync(destDir, { recursive: true });
  execFileSync('unzip', ['-o', zipPath, '-d', destDir], { stdio: 'pipe' });
  const files = readdirSync(destDir).filter((f) => !f.startsWith('.'));
  if (files.length !== 1) throw new Error(`esperava 1 arquivo dentro do zip, achei ${files.length}: ${files.join(', ')}`);
  return path.join(destDir, files[0]);
}

/** Parser de campo estilo RFB: "valor";"valor";... (aspas duplas, ; como separador). */
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
  municipio: string | null; // código RFB (sem lookup de nome nesta versão mínima)
  uf: string | null;
}

function parseEstabelecimentoLine(line: string): Row | null {
  const f = parseRfbLine(line);
  if (f.length < 21) return null;
  const cnpjBasico = onlyDigits(f[0]);
  const cnpjOrdem = onlyDigits(f[1]);
  const cnpjDv = onlyDigits(f[2]);
  const cnpj = `${cnpjBasico}${cnpjOrdem}${cnpjDv}`;
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

async function processShard(monthFolder: string, shard: string, cp: { done: string[]; totalRows: number }): Promise<boolean> {
  const zipUrl = `${BASE_URL}/${monthFolder}/Estabelecimentos${shard}.zip`;
  const zipPath = path.join(WORKDIR, `Estabelecimentos${shard}.zip`);
  const extractDir = path.join(WORKDIR, `extract${shard}`);

  log(`shard ${shard}: baixando ${zipUrl}`);
  await downloadFile(zipUrl, zipPath);
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

  if (!stopAtSample) {
    cp.done.push(shard);
  }
  saveCheckpoint(cp);
  return stopAtSample;
}

async function main() {
  mkdirSync(WORKDIR, { recursive: true });
  const cp = loadCheckpoint();
  log(`início. shards alvo: ${SHARDS.join(',')}. já concluídos: ${cp.done.join(',') || '(nenhum)'}.`);
  if (SAMPLE_LIMIT) log(`MODO AMOSTRA: para após ~${SAMPLE_LIMIT} linhas gravadas.`);

  const monthFolder = await resolveMonthFolder();

  for (const shard of SHARDS) {
    if (cp.done.includes(shard)) {
      log(`shard ${shard}: já concluído (pulando). Apague o checkpoint em ${CHECKPOINT} para forçar de novo.`);
      continue;
    }
    const stopped = await processShard(monthFolder, shard, cp);
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

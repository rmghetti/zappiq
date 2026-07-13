/**
 * Mira Prospects — verificação + primeira carga do BigQuery antes de gravar os
 * secrets em produção. Roda a MESMA lógica do cron mensal (syncCnpjMirror) e:
 *   1) confirma acesso à base de CNPJ da Base dos Dados (exige assinatura BD Pro
 *      com o e-mail da service account cadastrado em Configurações > BigQuery)
 *   2) materializa a tabela espelho zappiq-prod.mira.cnpj_ativos (job "caro",
 *      1x/mês, dentro do 1 TiB/mês grátis) e imprime bytes/custo/linhas
 *   3) testa uma consulta de candidatos NA TABELA ESPELHO (fração de centavo)
 * Se falhar (API off, sem BD Pro, teto estourado, schema diferente), imprime o
 * erro e sai != 0 — o .command não grava nada.
 *
 * Uso (o 7-Mira-BigQuery-Setup.command faz isto):
 *   export GOOGLE_APPLICATION_CREDENTIALS_JSON="$(cat chave.json)"
 *   export BIGQUERY_PROJECT_ID=zappiq-prod
 *   apps/api/node_modules/.bin/tsx apps/api/scripts/verify-bigquery.ts
 */
import { BigQuery } from '@google-cloud/bigquery';

// Esta verificação só exercita o BigQuery, mas os módulos do app (env, logger)
// exigem DATABASE_URL/JWT_SECRET na carga. Preenche placeholders inofensivos
// (nunca usados aqui) ANTES de importar qualquer módulo do app, para o .command
// rodar sem precisar de um .env completo.
process.env.DATABASE_URL ||= 'postgresql://verify:verify@localhost:5432/verify';
process.env.JWT_SECRET ||= 'verify-only-placeholder-not-used-000000000000';

const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const projectId = process.env.BIGQUERY_PROJECT_ID;
const SRC = 'basedosdados.br_me_cnpj.estabelecimentos';

if (!json || !projectId) {
  console.error('Faltam GOOGLE_APPLICATION_CREDENTIALS_JSON e/ou BIGQUERY_PROJECT_ID no ambiente.');
  process.exit(1);
}

function custo(bytes: number): string {
  const usd = (bytes / 1099511627776) * 6.25; // US$ 6,25 / TiB
  return `US$ ${usd.toFixed(4)} (~R$ ${(usd * 5.4).toFixed(3)})`;
}

async function main() {
  // Import dinâmico: só depois dos placeholders de env acima estarem no process.env.
  const { syncCnpjMirror, mirrorFqn } = await import('../src/services/mira/cnpjMirror.js');
  const bq = new BigQuery({ projectId, credentials: JSON.parse(json as string) });

  // 1) Acesso à base BD Pro (algumas linhas). Se 0 linhas, o e-mail da service
  //    account não está cadastrado na assinatura BD Pro.
  console.log('1/3 Testando acesso à base de CNPJ da Base dos Dados...');
  const [accessRows] = await bq.query({
    query: `SELECT cnpj FROM \`${SRC}\`
            WHERE data = (SELECT MAX(data) FROM \`${SRC}\`)
            LIMIT 3`,
    useLegacySql: false,
    maximumBytesBilled: String(120 * 1024 * 1024 * 1024),
  });
  if ((accessRows as any[]).length === 0) {
    throw new Error(
      'Acesso retornou 0 linhas. A base de CNPJ exige assinatura BD Pro com o e-mail ' +
      'da service account (mira-bigquery@...) cadastrado em basedosdados.org > Configurações > BigQuery.',
    );
  }
  console.log(`    OK: acesso liberado (${(accessRows as any[]).length} linhas de amostra).`);

  // 2) Primeira materialização da tabela espelho (força, ignora idempotência).
  console.log('2/3 Materializando a tabela espelho (job mensal; varre a partição inteira)...');
  const r = await syncCnpjMirror({ force: true });
  if (!r.ok) throw new Error(`Materialização falhou: ${r.reason}`);
  console.log(`    OK: ${r.rows ?? '?'} empresas ativas espelhadas (snapshot ${r.snapshot}).`);
  if (r.bytesScanned) {
    console.log(`    Varredura desta materialização: ${(r.bytesScanned / 1e9).toFixed(1)} GB — ${custo(r.bytesScanned)}. 1 TiB/mes e gratis.`);
  }

  // 3) Consulta de candidatos NA TABELA ESPELHO (deve ser baratíssima).
  console.log('3/3 Testando uma consulta de candidatos na tabela espelho...');
  const [job] = await bq.createQueryJob({
    query: `SELECT cnpj, nome_fantasia, cnae_fiscal_principal, sigla_uf
            FROM \`${mirrorFqn().fqn}\`
            WHERE STARTS_WITH(cnae_fiscal_principal, '62') AND sigla_uf = 'SP'
            LIMIT 5`,
    useLegacySql: false,
    maximumBytesBilled: String(2 * 1024 * 1024 * 1024),
  });
  const [rows] = await job.getQueryResults();
  const [meta] = await job.getMetadata();
  const bytes = Number(meta?.statistics?.query?.totalBytesProcessed ?? 0);
  console.log(`    OK: ${(bytes / 1e6).toFixed(2)} MB varridos — ${custo(bytes)} por consulta de cliente.`);
  for (const r2 of rows as any[]) {
    console.log(`      ${r2.cnpj} | ${r2.sigla_uf} | CNAE ${r2.cnae_fiscal_principal} | ${r2.nome_fantasia ?? '(sem nome fantasia)'}`);
  }

  console.log('');
  console.log('OK: BigQuery acessivel, espelho materializado e consulta de descoberta barata.');
}

main().catch((e) => {
  console.error('');
  console.error(`FALHOU: ${e?.message ?? e}`);
  if (String(e?.message).match(/0 linhas|BD Pro|assinatura/i)) {
    console.error('Dica: cadastre o e-mail da service account em basedosdados.org > Configuracoes > BigQuery e assine o BD Pro.');
  }
  if (String(e?.message).match(/billing|not enabled|has not enabled|BigQuery API/i)) {
    console.error('Dica: habilite a BigQuery API e vincule faturamento ao projeto (uso real fica no 1 TiB/mes gratis).');
  }
  if (String(e?.message).match(/maximumBytesBilled|exceed/i)) {
    console.error('Dica: aumente BIGQUERY_MIRROR_MAX_GB (materializacao) ou BIGQUERY_MAX_GB (consulta).');
  }
  if (String(e?.message).match(/Not found|Unrecognized name|does not exist/i)) {
    console.error('Dica: o schema da tabela pode ter mudado. Cole este erro no chat que eu ajusto as colunas.');
  }
  process.exit(1);
});

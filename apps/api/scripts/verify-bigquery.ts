/**
 * Mira Prospects — verificação do acesso ao BigQuery (Base dos Dados) antes de
 * gravar os secrets em produção. Roda a MESMA query da descoberta (com DECLARE
 * pra podar partição), com teto de bytes, e imprime:
 *   - bytes REAIS varridos (e o custo estimado)
 *   - uma amostra de linhas (pra confirmar que as colunas existem)
 * Se falhar (API desabilitada, faturamento exigido, schema diferente, teto
 * estourado), imprime o erro e sai != 0 — o .command não grava nada.
 *
 * Uso (o 7-Mira-BigQuery-Setup.command faz isto):
 *   export GOOGLE_APPLICATION_CREDENTIALS_JSON="$(cat chave.json)"
 *   export BIGQUERY_PROJECT_ID=zappiq-prod
 *   apps/api/node_modules/.bin/tsx apps/api/scripts/verify-bigquery.ts
 */
import { BigQuery } from '@google-cloud/bigquery';

const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
const projectId = process.env.BIGQUERY_PROJECT_ID;
const MAX_GB = Number(process.env.BIGQUERY_MAX_GB || 8);
const TABLE = 'basedosdados.br_me_cnpj.estabelecimentos';

if (!json || !projectId) {
  console.error('Faltam GOOGLE_APPLICATION_CREDENTIALS_JSON e/ou BIGQUERY_PROJECT_ID no ambiente.');
  process.exit(1);
}

async function main() {
  const bq = new BigQuery({ projectId, credentials: JSON.parse(json as string) });
  // Mesma forma da descoberta: DECLARE poda a partição de data; filtro de teste
  // (CNAE de TI + SP) pra um resultado pequeno e realista.
  const sql = `
    DECLARE d DATE DEFAULT (SELECT MAX(data) FROM \`${TABLE}\`);
    SELECT cnpj, nome_fantasia, cnae_fiscal_principal, sigla_uf, id_municipio
    FROM \`${TABLE}\`
    WHERE data = d
      AND situacao_cadastral IN ('02', '2')
      AND STARTS_WITH(cnae_fiscal_principal, '62')
      AND sigla_uf = 'SP'
    LIMIT 5;
  `;
  const maximumBytesBilled = String(Math.round(MAX_GB * 1024 * 1024 * 1024));

  console.log(`Consultando ${TABLE} (projeto de cobrança: ${projectId}, teto ${MAX_GB} GB)...`);
  const [job] = await bq.createQueryJob({ query: sql, useLegacySql: false, maximumBytesBilled });
  const [rows] = await job.getQueryResults();

  const stats: any = job.metadata?.statistics ?? {};
  const bytes = Number(stats.query?.totalBytesProcessed ?? stats.totalBytesProcessed ?? 0);
  const gb = bytes / 1e9;
  const custoUsd = (bytes / 1099511627776) * 6.25; // por TiB
  const cacheHit = stats.query?.cacheHit ? ' (cache: não cobra)' : '';

  console.log('');
  console.log(`✓ Acesso OK. Bytes varridos: ${gb.toFixed(2)} GB${cacheHit}`);
  console.log(`  Custo estimado desta consulta: US$ ${custoUsd.toFixed(4)} (~R$ ${(custoUsd * 5.4).toFixed(3)}). 1 TiB/mes e gratis.`);
  console.log(`  Amostra (${rows.length} linhas) — confirmando que as colunas existem:`);
  for (const r of rows as any[]) {
    console.log(`    ${r.cnpj} | ${r.sigla_uf} | CNAE ${r.cnae_fiscal_principal} | ${r.nome_fantasia ?? '(sem nome fantasia)'}`);
  }
  console.log('');
  console.log('OK: BigQuery acessivel, schema confere e custo dentro do esperado.');
}

main().catch((e) => {
  console.error('');
  console.error(`FALHOU: ${e?.message ?? e}`);
  if (String(e?.message).match(/billing|not enabled|has not enabled|BigQuery API/i)) {
    console.error('Dica: habilite a BigQuery API no projeto e, se pedir, ative o faturamento (o uso real fica dentro do 1 TiB/mes gratis).');
  }
  if (String(e?.message).match(/maximumBytesBilled|exceed/i)) {
    console.error('Dica: a consulta varreria mais que o teto. Rode de novo com BIGQUERY_MAX_GB maior, ou avise para ajustarmos a query.');
  }
  if (String(e?.message).match(/Not found|Unrecognized name|does not exist/i)) {
    console.error('Dica: o schema da tabela pode ter mudado. Cole este erro no chat que eu ajusto os nomes das colunas.');
  }
  process.exit(1);
});

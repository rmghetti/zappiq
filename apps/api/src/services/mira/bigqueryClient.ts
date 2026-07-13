/**
 * Mira Prospects — cliente BigQuery compartilhado.
 *
 * Uma única instância do cliente (credenciais da service account) usada tanto
 * pela descoberta B2B (descobertaBigQuery) quanto pelo espelhamento mensal da
 * base de CNPJ (cnpjMirrorSync). Sem credenciais configuradas, `bigQueryDisponivel`
 * devolve false e os chamadores degradam para outras fontes / pulam o job.
 */
import { BigQuery } from '@google-cloud/bigquery';
import { env } from '../../config/env.js';

let _client: BigQuery | null = null;

export function bigQueryDisponivel(): boolean {
  return Boolean(env.GOOGLE_APPLICATION_CREDENTIALS_JSON && env.BIGQUERY_PROJECT_ID);
}

export function getBigQueryClient(): BigQuery {
  if (_client) return _client;
  const credentials = JSON.parse(env.GOOGLE_APPLICATION_CREDENTIALS_JSON as string);
  _client = new BigQuery({ projectId: env.BIGQUERY_PROJECT_ID, credentials });
  return _client;
}

export function gbToBytes(gb: number): string {
  return String(Math.round(gb * 1024 * 1024 * 1024));
}

import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import redis from '../utils/redis.js';

const ragClient = axios.create({
  baseURL: env.RAG_SERVICE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Service-Secret': env.RAG_SERVICE_SECRET || '',
  },
  timeout: 30_000,
});

export async function search(organizationId: string, query: string, topK = 5): Promise<string> {
  const cacheKey = `rag:${organizationId}:${Buffer.from(query).toString('base64').slice(0, 40)}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return cached;
  } catch {}

  try {
    const { data } = await ragClient.post('/search', {
      tenant_id: organizationId,
      query,
      top_k: topK,
    });

    const context = (data.results || [])
      .map((r: any) => r.content)
      .join('\n\n---\n\n');

    try { await redis.setex(cacheKey, 120, context); } catch {}

    return context;
  } catch (err: any) {
    logger.warn('[RAG] Search failed:', err.message);
    return '';
  }
}

export async function ingestDocument(organizationId: string, file: { filename: string; content: Buffer; mimeType: string }) {
  const formData = new FormData();
  formData.append('tenant_id', organizationId);
  // \`Buffer\` is no longer assignable to \`BlobPart\` under newer @types/node
  // (SharedArrayBuffer / ArrayBuffer divergence). Wrap in Uint8Array, which is.
  formData.append('file', new Blob([new Uint8Array(file.content)], { type: file.mimeType }), file.filename);

  const { data } = await ragClient.post('/ingest', formData);
  return data;
}

// Block SSRF: reject internal/private network URLs
function assertPublicUrl(url: string): void {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Invalid URL'); }

  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https URLs allowed');

  const hostname = parsed.hostname.toLowerCase();
  const blocked = [
    'localhost', '127.0.0.1', '0.0.0.0', '[::1]',
    '169.254.169.254',   // cloud metadata
    'metadata.google.internal',
  ];
  if (blocked.includes(hostname)) throw new Error('Internal URLs are not allowed');

  // Block RFC 1918 private ranges
  const parts = hostname.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => !isNaN(p))) {
    if (parts[0] === 10) throw new Error('Private IP not allowed');
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) throw new Error('Private IP not allowed');
    if (parts[0] === 192 && parts[1] === 168) throw new Error('Private IP not allowed');
  }
}

export async function ingestUrl(organizationId: string, url: string) {
  assertPublicUrl(url);
  const { data } = await ragClient.post('/ingest-url', {
    tenant_id: organizationId,
    url,
  });
  return data;
}

export async function listDocuments(organizationId: string) {
  const { data } = await ragClient.get(`/documents/${organizationId}`);
  return data;
}

export async function deleteDocument(organizationId: string, documentId: string) {
  const { data } = await ragClient.delete(`/documents/${organizationId}/${documentId}`);
  return data;
}

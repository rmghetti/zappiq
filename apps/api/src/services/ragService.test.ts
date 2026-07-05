import { describe, it, expect } from 'vitest';
import {
  namespaceFor,
  buildQueryRequest,
  parseQueryContext,
  buildIngestForm,
} from './ragService.js';

// W1.2: garante que o cliente fala o contrato REAL do serviço Python
// (services/rag/main.py): namespace `org_<uuid>`, rota /query e /ingest,
// campo `text` na response — nunca mais `tenant_id` nem `/search`.

describe('namespaceFor', () => {
  it('prefixa org_ no organizationId cru', () => {
    expect(namespaceFor('abc123')).toBe('org_abc123');
  });

  it('é idempotente quando já vem prefixado', () => {
    expect(namespaceFor('org_abc123')).toBe('org_abc123');
  });
});

describe('buildQueryRequest', () => {
  it('usa a rota /query (não /search)', () => {
    const { path } = buildQueryRequest('abc123', 'oi', 5);
    expect(path).toBe('/query');
  });

  it('envia namespace org_<id> e NÃO envia tenant_id', () => {
    const { body } = buildQueryRequest('abc123', 'como faço X?', 7);
    expect(body).toEqual({
      query: 'como faço X?',
      namespace: 'org_abc123',
      top_k: 7,
    });
    expect(body).not.toHaveProperty('tenant_id');
  });
});

describe('parseQueryContext', () => {
  it('junta o campo `text` de cada result (não `content`)', () => {
    const data = {
      results: [
        { id: '1', text: 'chunk A', similarity: 0.9, source: 'faq.md', chunk_idx: 0 },
        { id: '2', text: 'chunk B', similarity: 0.8, source: 'faq.md', chunk_idx: 1 },
      ],
      latency_ms: 12,
    };
    expect(parseQueryContext(data)).toBe('chunk A\n\n---\n\nchunk B');
  });

  it('retorna string vazia quando results ausente/nulo', () => {
    expect(parseQueryContext(null)).toBe('');
    expect(parseQueryContext({})).toBe('');
    expect(parseQueryContext({ results: [] })).toBe('');
  });

  it('ignora chunks sem `text` válido', () => {
    const data = {
      results: [
        { id: '1', text: 'ok', similarity: 0.9, source: null, chunk_idx: 0 },
        { id: '2', content: 'formato antigo — deve ser ignorado', chunk_idx: 1 },
      ],
    };
    expect(parseQueryContext(data)).toBe('ok');
  });
});

describe('buildIngestForm', () => {
  it('usa a rota /ingest', () => {
    const { path } = buildIngestForm('abc123', {
      filename: 'doc.pdf',
      content: Buffer.from('x'),
      mimeType: 'application/pdf',
    });
    expect(path).toBe('/ingest');
  });

  it('anexa namespace org_<id> e source, sem tenant_id', () => {
    const { form } = buildIngestForm('abc123', {
      filename: 'manual.pdf',
      content: Buffer.from('conteudo'),
      mimeType: 'application/pdf',
    });
    expect(form.get('namespace')).toBe('org_abc123');
    expect(form.get('source')).toBe('manual.pdf');
    expect(form.has('tenant_id')).toBe(false);
    expect(form.has('file')).toBe(true);
  });
});

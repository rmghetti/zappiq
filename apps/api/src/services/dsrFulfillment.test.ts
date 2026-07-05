/**
 * FEATURE 5b.4 — DSR fulfillment.
 *
 * Cobre a lógica PURA (sem I/O) das ações do titular:
 *   - buildExportPackage: agrega Contact + conversas + mensagens em JSON;
 *   - exportPackageToCsv / csvCell: serialização tabular com escaping RFC 4180;
 *   - computeContactAnonymization: PII → placeholder, preserva métricas;
 *   - isContactAnonymized: idempotência.
 */
import { describe, it, expect } from 'vitest';
import {
  buildExportPackage,
  csvCell,
  exportPackageToCsv,
  computeContactAnonymization,
  isContactAnonymized,
  type ExportContact,
  type ExportConversation,
} from './dsrFulfillment.js';

const FIXED = new Date('2026-01-15T12:00:00.000Z');

function makeContact(over: Partial<ExportContact> = {}): ExportContact {
  return {
    id: 'contact_1',
    whatsappId: '5511999998888',
    phone: '+5511999998888',
    name: 'Maria Souza',
    email: 'maria@example.com',
    company: 'Acme',
    tags: ['vip', 'lead'],
    leadScore: 42,
    leadStatus: 'QUALIFIED',
    funnelStage: 'negotiation',
    consentMarketing: true,
    createdAt: FIXED,
    ...over,
  };
}

describe('buildExportPackage', () => {
  it('agrega contatos, conversas e totaliza mensagens', () => {
    const conversations: ExportConversation[] = [
      {
        id: 'conv_1',
        status: 'OPEN',
        channel: 'whatsapp',
        summary: 'Interessada no plano',
        createdAt: FIXED,
        messages: [
          { id: 'm1', direction: 'INBOUND', type: 'TEXT', content: 'Oi', status: 'SENT', isFromBot: false, createdAt: FIXED },
          { id: 'm2', direction: 'OUTBOUND', type: 'TEXT', content: 'Olá!', status: 'DELIVERED', isFromBot: true, createdAt: FIXED },
        ],
      },
      {
        id: 'conv_2',
        status: 'CLOSED',
        channel: 'instagram',
        summary: null,
        createdAt: FIXED,
        messages: [
          { id: 'm3', direction: 'INBOUND', type: 'TEXT', content: 'Volta?', status: 'SENT', isFromBot: false, createdAt: FIXED },
        ],
      },
    ];

    const pkg = buildExportPackage({
      protocol: 'DSR-ABCD1234',
      requesterName: 'Maria Souza',
      requesterEmail: 'maria@example.com',
      contacts: [makeContact()],
      conversations,
      generatedAt: FIXED,
    });

    expect(pkg.protocol).toBe('DSR-ABCD1234');
    expect(pkg.generatedAt).toBe(FIXED.toISOString());
    expect(pkg.subject).toEqual({ requesterName: 'Maria Souza', requesterEmail: 'maria@example.com' });
    expect(pkg.totals).toEqual({ contacts: 1, conversations: 2, messages: 3 });
    // datas viram ISO string
    expect(pkg.contacts[0].createdAt).toBe(FIXED.toISOString());
    expect((pkg.conversations[0] as any).messages[0].createdAt).toBe(FIXED.toISOString());
  });

  it('lida com titular sem contato nem conversa (totais zerados)', () => {
    const pkg = buildExportPackage({
      protocol: 'DSR-0000',
      requesterName: null,
      requesterEmail: 'ninguem@example.com',
      contacts: [],
      conversations: [],
    });
    expect(pkg.totals).toEqual({ contacts: 0, conversations: 0, messages: 0 });
    expect(pkg.subject.requesterName).toBeNull();
  });
});

describe('csvCell', () => {
  it('escapa vírgula, aspas e quebra de linha (RFC 4180)', () => {
    expect(csvCell('simples')).toBe('simples');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvCell('linha1\nlinha2')).toBe('"linha1\nlinha2"');
  });

  it('serializa null, arrays, objetos e datas', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(['a', 'b'])).toBe('a; b');
    expect(csvCell(FIXED)).toBe(FIXED.toISOString());
    // objeto vira JSON e, como contém aspas, é escapado (RFC 4180): {"x":1} → "{""x"":1}"
    expect(csvCell({ x: 1 })).toBe('"{""x"":1}"');
  });
});

describe('exportPackageToCsv', () => {
  it('emite 1 linha por mensagem com colunas do contato', () => {
    const pkg = buildExportPackage({
      protocol: 'DSR-ABCD',
      requesterName: 'Maria',
      requesterEmail: 'maria@example.com',
      contacts: [makeContact()],
      conversations: [
        {
          id: 'conv_1',
          status: 'OPEN',
          channel: 'whatsapp',
          summary: null,
          createdAt: FIXED,
          messages: [
            { id: 'm1', direction: 'INBOUND', type: 'TEXT', content: 'Oi, tudo bem?', status: 'SENT', isFromBot: false, createdAt: FIXED },
            { id: 'm2', direction: 'OUTBOUND', type: 'TEXT', content: 'Tudo, e você?', status: 'SENT', isFromBot: true, createdAt: FIXED },
          ],
        },
      ],
      generatedAt: FIXED,
    });

    const csv = exportPackageToCsv(pkg);
    const lines = csv.split('\r\n');
    // header + 2 mensagens
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('protocol,requesterEmail');
    expect(lines[1]).toContain('DSR-ABCD');
    expect(lines[1]).toContain('m1');
    expect(lines[1]).toContain('"Oi, tudo bem?"'); // conteúdo com vírgula é aspado (RFC 4180)
    expect(lines[2]).toContain('m2');
  });

  it('emite ao menos a linha do contato quando não há conversas', () => {
    const pkg = buildExportPackage({
      protocol: 'DSR-XY',
      requesterName: 'Maria',
      requesterEmail: 'maria@example.com',
      contacts: [makeContact()],
      conversations: [],
      generatedAt: FIXED,
    });
    const lines = exportPackageToCsv(pkg).split('\r\n');
    expect(lines).toHaveLength(2); // header + contato
    expect(lines[1]).toContain('contact_1');
  });
});

describe('computeContactAnonymization', () => {
  const base = {
    id: 'contact_abc',
    whatsappId: '5511999998888',
    phone: '+5511999998888',
    name: 'Maria Souza',
    email: 'maria@example.com',
    company: 'Acme',
    avatarUrl: 'https://cdn/x.png',
    tags: ['vip'],
    customFields: { cpf: '123' } as any,
    birthDate: FIXED,
    instagramScopedId: 'ig_123',
  };

  it('substitui toda a PII por placeholder e zera campos livres', () => {
    const patch = computeContactAnonymization(base);
    expect(patch.name).toBe('Titular anonimizado');
    expect(patch.email).toBeNull();
    expect(patch.company).toBeNull();
    expect(patch.avatarUrl).toBeNull();
    expect(patch.birthDate).toBeNull();
    expect(patch.instagramScopedId).toBeNull();
    expect(patch.tags).toEqual([]);
    expect(patch.customFields).toEqual({});
  });

  it('deriva whatsappId/phone determinístico por id (unicidade + idempotência)', () => {
    const patch1 = computeContactAnonymization(base);
    const patch2 = computeContactAnonymization(base);
    expect(patch1.whatsappId).toBe('anon_contact_abc');
    expect(patch1.phone).toBe('anon_contact_abc');
    expect(patch1).toEqual(patch2); // determinístico

    const other = computeContactAnonymization({ ...base, id: 'contact_xyz' });
    expect(other.whatsappId).not.toBe(patch1.whatsappId); // não colide entre contatos
  });

  it('NÃO toca métricas agregadas (o patch não inclui leadScore/funnelStage/leadStatus)', () => {
    const patch = computeContactAnonymization(base) as Record<string, unknown>;
    expect(patch).not.toHaveProperty('leadScore');
    expect(patch).not.toHaveProperty('funnelStage');
    expect(patch).not.toHaveProperty('leadStatus');
    expect(patch).not.toHaveProperty('consentMarketing');
  });
});

describe('isContactAnonymized', () => {
  it('detecta contato já anonimizado pelo prefixo do token', () => {
    expect(isContactAnonymized({ whatsappId: 'anon_contact_1' })).toBe(true);
    expect(isContactAnonymized({ whatsappId: '5511999998888' })).toBe(false);
  });
});

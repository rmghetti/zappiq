/**
 * Pouso no CRM: dossiê completo + "enviar assim mesmo".
 *
 * Dois pedidos do Rodrigo (15/07/2026):
 *  1. "Garantir que o lead gerado no MIRA chegue no CRM com todas as
 *     informações possíveis, com campos específicos para cada informação."
 *     Antes o pouso levava 5 campos e jogava fora o dossiê: quem abria o Deal
 *     via "Mira · ACME" e nada mais.
 *  2. "Alvo Em qualificação não tem o botão de CRM; se o cliente quiser
 *     enviar assim mesmo, ele pode, com a ressalva de Não qualificado."
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const findFirstAlvo = vi.fn();
const findFirstContact = vi.fn();
const createContact = vi.fn();
const createDeal = vi.fn();
const createActivity = vi.fn();
const updateAlvo = vi.fn();
const updateDecisor = vi.fn();

vi.mock('@zappiq/database', () => ({
  Prisma: {},
  prisma: {
    miraAlvo: { findFirst: (...a: any[]) => findFirstAlvo(...a), update: (...a: any[]) => updateAlvo(...a) },
    miraDecisor: { update: (...a: any[]) => updateDecisor(...a) },
    contact: { findFirst: (...a: any[]) => findFirstContact(...a), create: (...a: any[]) => createContact(...a) },
    deal: { create: (...a: any[]) => createDeal(...a) },
    activity: { create: (...a: any[]) => createActivity(...a) },
  },
}));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { pousarNoCrm } = await import('./pousarCrm.js');

const ALVO_PRONTO = {
  id: 'alvo-1',
  kind: 'B2B',
  status: 'READY',
  nome: 'ACME METALURGICA LTDA',
  nomeFantasia: 'ACME',
  cnpj: '11222333000181',
  cnae: '2451-2',
  porte: '3',
  capitalSocial: 500_000,
  situacaoCadastral: 'ATIVA',
  municipio: 'São Paulo',
  uf: 'SP',
  telefone: '1133334444',
  site: null,
  miraScore: 52,
  confianca: 90,
  resumo: 'Metalúrgica ativa em SP, porte médio, com quadro societário mapeado.',
  contactId: null,
  dealId: null,
  campanha: { nome: 'Metalúrgicas SP' },
  decisores: [
    {
      id: 'd1',
      nome: 'Carlos Rondello',
      papel: 'Sócio-administrador',
      arquetipo: 'EXEC_SPONSOR',
      vinculoQsa: true,
      confianca: 90,
      baseLegal: 'legitimo_interesse',
      contactId: null,
      contato: { email: 'carlos@acme.com.br', phone: '11988887777' },
      perfilPublico: { linkedinUrl: 'https://linkedin.com/in/carlos' },
    },
    {
      id: 'd2',
      nome: 'Maria Silva',
      papel: 'Gerente Industrial',
      arquetipo: 'TECHNICAL_BUYER',
      vinculoQsa: false,
      confianca: 62,
      baseLegal: 'legitimo_interesse',
      contactId: null,
      contato: null,
      perfilPublico: { linkedinUrl: 'https://linkedin.com/in/maria' },
    },
  ],
  oportunidades: [
    { rank: 1, produto: 'Consultoria de infra', racional: 'Encaixa pela atividade industrial.', valorEstimado: 15000, roteiro: { porSponsor: [{ decisor: 'Carlos Rondello', mensagem: 'Olá Carlos, vi que...' }] } },
    { rank: 2, produto: 'Backup gerenciado', racional: 'Segunda melhor aderência.', valorEstimado: null, roteiro: null },
  ],
  demandas: [
    { rank: 1, descricao: 'Precisa de capacidade', evidencia: 'Anunciou expansão', fonte: 'https://e.com/1', confianca: 70 },
    { rank: 2, descricao: 'Provável dor de infra', evidencia: 'Presunção analítica', fonte: null, confianca: 55 },
  ],
  incumbentes: [{ fornecedor: 'TOTVS', categoria: 'ERP', evidencia: 'Implantou ERP', fonte: 'https://e.com/2', deslocabilidade: 'BAIXA' }],
  releases: [{ titulo: 'Expansão', resumo: 'Nova planta', relevancia: 'Momento de compra', url: 'https://e.com/3', anguloAbordagem: 'Fale da expansão' }],
};

/** Em qualificação: sem decisor, é o motivo mais comum. */
const ALVO_EM_QUALIFICACAO = {
  ...ALVO_PRONTO,
  status: 'QUALIFYING',
  decisores: [],
  oportunidades: [],
  demandas: [],
  incumbentes: [],
  releases: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  findFirstContact.mockResolvedValue(null);
  createContact.mockResolvedValue({ id: 'contact-1' });
  createDeal.mockResolvedValue({ id: 'deal-1' });
  createActivity.mockResolvedValue({});
  updateAlvo.mockResolvedValue({});
  updateDecisor.mockResolvedValue({});
});

describe('o dossiê inteiro chega ao CRM', () => {
  it('firmografia vai campo a campo em customFields, não como blob', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_PRONTO);

    await pousarNoCrm('org-1', 'alvo-1');

    const cf = createContact.mock.calls[0][0].data.customFields;
    expect(cf.cnpj).toBe('11222333000181');
    expect(cf.cnae).toBe('2451-2');
    expect(cf.capitalSocial).toBe(500_000);
    expect(cf.situacaoCadastral).toBe('ATIVA');
    expect(cf.miraScore).toBe(52);
    expect(cf.miraConfianca).toBe(90);
    expect(cf.campanha).toBe('Metalúrgicas SP');
    expect(cf.oportunidade1).toBe('Consultoria de infra');
    expect(cf.fornecedorAtual).toBe('TOTVS');
    expect(cf.decisorLinkedin).toBe('https://linkedin.com/in/carlos');
  });

  it('o Mira Score vira leadScore (o CRM já sabe ordenar por ele)', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_PRONTO);
    await pousarNoCrm('org-1', 'alvo-1');
    expect(createContact.mock.calls[0][0].data.leadScore).toBe(52);
    expect(createContact.mock.calls[0][0].data.leadStatus).toBe('QUALIFIED');
  });

  it('o e-mail do decisor principal vira o e-mail do Contact', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_PRONTO);
    await pousarNoCrm('org-1', 'alvo-1');
    expect(createContact.mock.calls[0][0].data.email).toBe('carlos@acme.com.br');
  });

  it('o Deal nasce com o valor estimado da oportunidade nº1', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_PRONTO);
    await pousarNoCrm('org-1', 'alvo-1');
    expect(createDeal.mock.calls[0][0].data.value).toBe(15000);
    expect(createDeal.mock.calls[0][0].data.title).toBe('Mira · ACME');
  });

  it('o dossiê vira timeline: resumo, firmografia, comitê, demandas, oportunidades, roteiro, incumbente e releases', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_PRONTO);

    await pousarNoCrm('org-1', 'alvo-1');

    const titulos = createActivity.mock.calls.map((c: any[]) => c[0].data.title);
    expect(titulos).toContain('Dossiê Mira: resumo da conta');
    expect(titulos).toContain('Dossiê Mira: firmografia verificada');
    expect(titulos).toContain('Dossiê Mira: comitê de compra (2)');
    expect(titulos).toContain('Dossiê Mira: demandas identificadas');
    expect(titulos).toContain('Dossiê Mira: oportunidades de portfólio');
    expect(titulos).toContain('Dossiê Mira: roteiro de abordagem por decisor');
    expect(titulos).toContain('Dossiê Mira: fornecedor atual');
    expect(titulos).toContain('Dossiê Mira: novidades da conta');
  });

  it('a demanda evidenciada leva a FONTE para a timeline; a presumida se declara presunção', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_PRONTO);
    await pousarNoCrm('org-1', 'alvo-1');
    const demandas = createActivity.mock.calls.find((c: any[]) => c[0].data.title.includes('demandas'))![0].data.body;
    expect(demandas).toContain('https://e.com/1');
    expect(demandas).toContain('Presunção');
  });

  it('cada decisor vira Contact próprio (o comitê é o ativo do dossiê)', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_PRONTO);

    const r = await pousarNoCrm('org-1', 'alvo-1');

    expect(r.decisoresNoCrm).toBe(2);
    const nomes = createContact.mock.calls.map((c: any[]) => c[0].data.name);
    expect(nomes).toContain('Carlos Rondello');
    expect(nomes).toContain('Maria Silva');
    // O decisor fica ligado ao Contact criado (rastreabilidade).
    expect(updateDecisor).toHaveBeenCalledTimes(2);
  });

  it('Activity que falha não derruba o pouso (timeline incompleta > perder o pouso)', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_PRONTO);
    createActivity.mockRejectedValue(new Error('boom'));

    const r = await pousarNoCrm('org-1', 'alvo-1');

    expect(r.dealId).toBe('deal-1');
  });
});

describe('"Enviar assim mesmo": Alvo não qualificado', () => {
  it('sem forcar, Alvo em qualificação é recusado com 409', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_EM_QUALIFICACAO);
    await expect(pousarNoCrm('org-1', 'alvo-1')).rejects.toMatchObject({ status: 409 });
    expect(createContact).not.toHaveBeenCalled();
  });

  it('com forcar, entra MARCADO: UNQUALIFIED, tag e aviso no título do Deal', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_EM_QUALIFICACAO);

    const r = await pousarNoCrm('org-1', 'alvo-1', { forcar: true });

    expect(r.naoQualificado).toBe(true);
    expect(r.motivoNaoQualificado).toContain('decisor');
    const contact = createContact.mock.calls[0][0].data;
    // Entrar como QUALIFIED sem ter passado no gate seria mentir para o
    // vendedor que abrir a lista amanhã.
    expect(contact.leadStatus).toBe('UNQUALIFIED');
    expect(contact.tags).toContain('mira-nao-qualificado');
    expect(contact.customFields.miraNaoQualificado).toBe(true);
    // O aviso vai no TÍTULO porque é o que aparece no card do pipeline.
    expect(createDeal.mock.calls[0][0].data.title).toContain('(não qualificado)');
  });

  it('a timeline abre com o aviso do que falta', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_EM_QUALIFICACAO);

    await pousarNoCrm('org-1', 'alvo-1', { forcar: true });

    const aviso = createActivity.mock.calls[0][0].data;
    expect(aviso.title).toContain('sem passar na verificação');
    expect(aviso.body).toContain('não descontou da sua cota');
    expect(aviso.body).toContain('decisor');
  });

  it('Alvo arquivado não entra nem com forcar', async () => {
    findFirstAlvo.mockResolvedValue({ ...ALVO_EM_QUALIFICACAO, status: 'ARCHIVED' });
    await expect(pousarNoCrm('org-1', 'alvo-1', { forcar: true })).rejects.toMatchObject({ message: 'alvo_arquivado' });
  });

  it('Alvo READY enviado normalmente NÃO é marcado', async () => {
    findFirstAlvo.mockResolvedValue(ALVO_PRONTO);
    const r = await pousarNoCrm('org-1', 'alvo-1');
    expect(r.naoQualificado).toBe(false);
    expect(createContact.mock.calls[0][0].data.tags).not.toContain('mira-nao-qualificado');
  });
});

describe('idempotência', () => {
  it('Alvo que já pousou reaproveita contact/deal, sem duplicar nada', async () => {
    findFirstAlvo.mockResolvedValue({ ...ALVO_PRONTO, contactId: 'c-old', dealId: 'd-old' });

    const r = await pousarNoCrm('org-1', 'alvo-1');

    expect(r).toMatchObject({ contactId: 'c-old', dealId: 'd-old', reused: true });
    expect(createContact).not.toHaveBeenCalled();
    expect(createDeal).not.toHaveBeenCalled();
    expect(createActivity).not.toHaveBeenCalled();
  });
});

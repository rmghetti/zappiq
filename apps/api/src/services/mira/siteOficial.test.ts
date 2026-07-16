/**
 * Descobrir o site oficial do Alvo.
 *
 * A barra é alta de propósito: um `site` errado gravado aqui passaria a
 * CONFIRMAR releases da empresa errada, amplificando exatamente o erro que
 * este serviço existe para evitar. Todos os fixtures abaixo são resultados
 * REAIS da sonda contra a busca de produção (15/07/2026).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = { miraAlvo: { update: vi.fn() } };
vi.mock('@zappiq/database', () => ({ prisma: prismaMock }));
vi.mock('../../utils/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('./buscaPublica.js', () => ({ webSearch: vi.fn(), buscaPublicaDisponivel: vi.fn(() => true) }));

const { descobrirSiteOficial, dominioRegistravel } = await import('./siteOficial.js');
const { webSearch } = await import('./buscaPublica.js');

const COFEL = {
  id: 'alvo1',
  nome: 'COFEL COMERCIAL E INDUSTRIAL DE FERRO LIGAS LTDA',
  nomeFantasia: null,
  municipio: 'Atibaia',
  uf: 'SP',
  decisores: [{ nome: 'Claudio Nunes' }, { nome: 'OKRA HOLDINGS LTDA.' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.miraAlvo.update.mockResolvedValue({});
});

describe('dominioRegistravel: subdomínio não é a empresa', () => {
  it('entende os TLDs compostos do Brasil', () => {
    expect(dominioRegistravel('https://www.cofel.ind.br/')).toBe('cofel');
    expect(dominioRegistravel('https://yadoya.com.br/sobre')).toBe('yadoya');
    expect(dominioRegistravel('https://empresa.org.br')).toBe('empresa');
  });

  it('yadoya.jphotel.site é jphotel, não yadoya (o hotel de Tóquio da sonda)', () => {
    // Se a checagem fosse "o host contém o token", este hotel viraria o site
    // oficial de uma metalúrgica de Bom Jesus dos Perdões.
    expect(dominioRegistravel('https://yadoya.jphotel.site/')).toBe('jphotel');
  });

  it('url inválida não explode', () => {
    expect(dominioRegistravel('nao-e-url')).toBeNull();
  });
});

describe('acha o site oficial quando a fonte confirma', () => {
  it('COFEL: aceita cofel.ind.br porque o título cita Atibaia', async () => {
    // Resultado real da sonda para: "cofel" Atibaia SP
    (webSearch as any).mockResolvedValue([
      {
        title: 'Cofel Comercial e Industrial de Ferro Ligas - Atibaia, SP',
        snippet: 'Ferro ligas e metais.',
        url: 'https://www.cofel.ind.br/',
      },
    ]);

    const r = await descobrirSiteOficial('org1', COFEL);

    expect(r.site).toBe('https://www.cofel.ind.br');
    expect(r.motivo).toContain('Atibaia');
    expect(prismaMock.miraAlvo.update).toHaveBeenCalledWith({
      where: { id: 'alvo1' },
      data: { site: 'https://www.cofel.ind.br' },
    });
  });

  it('aceita quando o texto cita um decisor do QSA', async () => {
    (webSearch as any).mockResolvedValue([
      { title: 'Cofel Ferro Ligas', snippet: 'Fundada por Claudio Nunes.', url: 'https://cofel.ind.br/sobre' },
    ]);
    const r = await descobrirSiteOficial('org1', COFEL);
    expect(r.site).toBe('https://cofel.ind.br');
    expect(r.motivo).toContain('Claudio Nunes');
  });
});

describe('a barra alta: na dúvida, não grava', () => {
  it('recusa agregadores de CNPJ, mesmo citando a empresa e a cidade', async () => {
    // Todos resultados REAIS da sonda: eles citam a empresa, não SÃO a empresa
    (webSearch as any).mockResolvedValue([
      { title: 'Cofel Comercial e Industrial de Ferro Ligas Ltda em Atibaia', snippet: 'x', url: 'https://econodata.com.br/cofel' },
      { title: 'Cofel Comercial... - 013825650', snippet: 'Atibaia', url: 'https://cnpj.biz/cofel' },
      { title: 'COFEL FERRO LIGAS E METAIS em Atibaia, SP', snippet: 'Ligue', url: 'https://guiafacil.com/cofel' },
      { title: 'COFEL FERRO LIGAS - Por Dentro da Empresa', snippet: 'Atibaia', url: 'https://infojobs.com.br/cofel' },
    ]);

    const r = await descobrirSiteOficial('org1', COFEL);
    expect(r.site).toBeNull();
    expect(prismaMock.miraAlvo.update).not.toHaveBeenCalled();
  });

  it('recusa rede social (perfil não é site oficial)', async () => {
    (webSearch as any).mockResolvedValue([
      { title: 'Cofel Ferro Ligas', snippet: 'Atibaia SP', url: 'https://www.linkedin.com/company/cofel' },
      { title: 'Cofel Ferro Ligas e Metais', snippet: 'Atibaia', url: 'https://www.facebook.com/cofel' },
    ]);
    const r = await descobrirSiteOficial('org1', COFEL);
    expect(r.site).toBeNull();
  });

  it('recusa domínio que só tem o token no SUBdomínio (o hotel de Tóquio)', async () => {
    const YADOYA = { ...COFEL, id: 'a2', nome: 'YADOYA INDUSTRIA E COMERCIO S A', municipio: 'Bom Jesus dos Perdões' };
    (webSearch as any).mockResolvedValue([
      { title: 'YADOYA Uguisu | 3* | Tokyo', snippet: 'Bom Jesus dos Perdões', url: 'https://yadoya.jphotel.site/' },
    ]);
    const r = await descobrirSiteOficial('org1', YADOYA);
    expect(r.site).toBeNull();
  });

  it('recusa domínio próprio SEM confirmação no texto', async () => {
    (webSearch as any).mockResolvedValue([
      // Domínio bate, mas nada liga a ESTE CNPJ: pode ser a Cofel Laminados
      { title: 'Cofel', snippet: 'Produtos e serviços.', url: 'https://cofel.com.br/' },
    ]);
    const r = await descobrirSiteOficial('org1', COFEL);
    expect(r.site).toBeNull();
  });

  it('sócio PJ não confirma nada', async () => {
    (webSearch as any).mockResolvedValue([
      { title: 'Cofel', snippet: 'Controlada por OKRA HOLDINGS LTDA.', url: 'https://cofel.ind.br/' },
    ]);
    const r = await descobrirSiteOficial('org1', COFEL);
    expect(r.site).toBeNull();
  });

  it('nome só de setor não vira busca (não varre o Brasil atrás de "moveis")', async () => {
    const r = await descobrirSiteOficial('org1', { ...COFEL, nome: 'INDUSTRIA E COMERCIO DE MOVEIS LTDA', nomeFantasia: null });
    expect(r.site).toBeNull();
    expect(r.buscas).toBe(0);
    expect(webSearch).not.toHaveBeenCalled();
  });

  // ── Os dois falsos positivos que a PROVA em produção pegou ──
  // A primeira versão usava `dominio.includes(token)` e gravou os dois.

  it('FORT-LUX: recusa fortion.com.br (Fortion é outra empresa, não um prefixo)', async () => {
    const FORTLUX = {
      ...COFEL,
      id: 'a3',
      nome: 'FORT-LUX INST.E MONTAGEM DE ESTRUT METALICAS LTDA',
      nomeFantasia: null,
      municipio: 'Boituva',
    };
    (webSearch as any).mockResolvedValue([
      { title: 'Fortion', snippet: 'Estruturas metálicas em Boituva.', url: 'https://www.fortion.com.br' },
    ]);
    const r = await descobrirSiteOficial('org1', FORTLUX);
    expect(r.site).toBeNull(); // "fortion".includes("fort") era true e bastava
  });

  it('PERFILADOS ATIBAIA: token que É o município não procura nada', async () => {
    // núcleo = ["atibaia","perfilados"] (perfilados é palavra de setor), então
    // o token distintivo vira o nome da cidade — que não identifica empresa
    // nenhuma. A versão anterior aceitou `atibaianovo.com.br`.
    const PERFILADOS = { ...COFEL, id: 'a4', nome: 'PERFILADOS ATIBAIA LTDA', nomeFantasia: null, municipio: 'Atibaia' };
    (webSearch as any).mockResolvedValue([
      { title: 'Atibaia Novo', snippet: 'Notícias de Atibaia', url: 'https://atibaianovo.com.br' },
    ]);
    const r = await descobrirSiteOficial('org1', PERFILADOS);
    expect(r.site).toBeNull();
    expect(r.buscas).toBe(0); // nem gasta busca
    expect(webSearch).not.toHaveBeenCalled();
  });

  it('mas aceita domínio que é o núcleo inteiro colado (cofelferroligas)', async () => {
    (webSearch as any).mockResolvedValue([
      { title: 'Cofel Ferro Ligas', snippet: 'Atibaia, SP', url: 'https://cofelferroligas.com.br' },
    ]);
    const r = await descobrirSiteOficial('org1', COFEL);
    expect(r.site).toBe('https://cofelferroligas.com.br');
  });

  it('recusa domínio genérico do setor sem o token distintivo (ferroligas.com.br)', async () => {
    (webSearch as any).mockResolvedValue([
      { title: 'Ferro Ligas', snippet: 'Atibaia, SP', url: 'https://ferroligas.com.br' },
    ]);
    const r = await descobrirSiteOficial('org1', COFEL);
    expect(r.site).toBeNull();
  });

  it('não achar é resultado legítimo (PME sem site é a regra)', async () => {
    (webSearch as any).mockResolvedValue([]);
    const r = await descobrirSiteOficial('org1', COFEL);
    expect(r.site).toBeNull();
    expect(r.erro).toBeUndefined(); // não achou ≠ falhou
    expect(r.buscas).toBe(2);
  });

  it('busca quebrada vira erro explícito, não "não tem site"', async () => {
    (webSearch as any).mockRejectedValue(new Error('fonte_falhou'));
    const r = await descobrirSiteOficial('org1', COFEL);
    expect(r.site).toBeNull();
    expect(r.erro).toContain('fonte_falhou');
  });
});

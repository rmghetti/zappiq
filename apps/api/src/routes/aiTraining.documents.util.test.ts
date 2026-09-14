/**
 * Regras puras do vínculo entre o documento no Postgres e os trechos no vetor.
 *
 * Até aqui o vínculo era o TÍTULO. Dois documentos com o mesmo título dividiam
 * o mesmo `source`, e apagar um apagava os trechos do outro: aconteceu em
 * produção com o CMJ em 21/08, três PDFs ficaram sem nenhum trecho (A001). URL
 * era pior: o título gravado é a URL inteira e o source é hostname+caminho,
 * então o delete procurava um source que não existe e respondia "apaguei"
 * (A002).
 */
import { describe, it, expect } from 'vitest';
import {
  sourceDoDocumento,
  sourceLegado,
  nomeDeArquivoDoUpload,
  donosDoSourceLegado,
  trechosDoDocumento,
} from './aiTraining.documents.util.js';

const ARQUIVO = {
  id: 'ckdoc1',
  title: 'Proposta comercial.pdf',
  sourceType: 'application/pdf',
  sourceUrl: null,
};
const URL_DOC = {
  id: 'ckdoc2',
  title: 'https://cmj.com.br/cursos/',
  sourceType: 'url',
  sourceUrl: 'https://cmj.com.br/cursos/',
};

describe('sourceDoDocumento', () => {
  it('é o id do documento, que é único por definição', () => {
    expect(sourceDoDocumento('ckdoc1')).toBe('doc-ckdoc1');
  });
});

describe('sourceLegado', () => {
  it('arquivo e texto colado usavam o título', () => {
    expect(sourceLegado(ARQUIVO)).toBe('Proposta comercial.pdf');
  });

  it('URL usava hostname+caminho, não o título (que é a URL inteira)', () => {
    expect(sourceLegado(URL_DOC)).toBe('cmj.com.br/cursos');
  });
});

describe('nomeDeArquivoDoUpload', () => {
  it('recupera o acento que o multer entrega em latin1', () => {
    // O multer 1.4.5 decodifica o nome do arquivo como latin1. Os BYTES estão
    // intactos, então reinterpretar como utf-8 devolve o nome de verdade.
    // Sem isto, "editável" virava "editaÌvel" no título, no vetor e na lista
    // (achado A014).
    const original = 'Ementa Conselho do Futuro ppt editável.pdf';
    const comoOMulterEntrega = Buffer.from(original, 'utf8').toString('latin1');

    expect(comoOMulterEntrega).not.toBe(original); // o defeito existe mesmo
    expect(nomeDeArquivoDoUpload(comoOMulterEntrega)).toBe(original);
  });

  it('normaliza para NFC, para o mesmo nome não virar dois títulos', () => {
    const decomposto = 'Governança.pdf'.normalize('NFD');
    const comoOMulterEntrega = Buffer.from(decomposto, 'utf8').toString('latin1');

    expect(nomeDeArquivoDoUpload(comoOMulterEntrega)).toBe('Governança.pdf'.normalize('NFC'));
  });

  it('nome sem acento atravessa intacto', () => {
    expect(nomeDeArquivoDoUpload('contrato-2026.pdf')).toBe('contrato-2026.pdf');
  });

  it('nome que não é utf-8 válido fica como veio, sem virar caractere quebrado', () => {
    // 0xFF sozinho não forma utf-8: reinterpretar produziria o losango preto.
    const cru = Buffer.from([0x63, 0x61, 0x66, 0xff, 0x2e, 0x70, 0x64, 0x66]).toString('latin1');

    expect(nomeDeArquivoDoUpload(cru)).toBe(cru.normalize('NFC'));
  });

  it('nome vazio vira um título utilizável', () => {
    expect(nomeDeArquivoDoUpload('   ')).toBe('documento');
  });
});

describe('donosDoSourceLegado', () => {
  it('conta quantos documentos dividem cada source antigo', () => {
    const donos = donosDoSourceLegado([
      ARQUIVO,
      { ...ARQUIVO, id: 'ckdoc9' }, // mesmo título: é a colisão do A001
      URL_DOC,
    ]);

    expect(donos.get('Proposta comercial.pdf')).toBe(2);
    expect(donos.get('cmj.com.br/cursos')).toBe(1);
  });
});

describe('trechosDoDocumento', () => {
  it('conta pelo source novo quando o documento já foi migrado', () => {
    const contagens = new Map([['doc-ckdoc1', 7]]);

    expect(trechosDoDocumento(ARQUIVO, contagens, donosDoSourceLegado([ARQUIVO]))).toBe(7);
  });

  it('cai para o source antigo enquanto o reprocessamento não rodou', () => {
    const contagens = new Map([['Proposta comercial.pdf', 4]]);

    expect(trechosDoDocumento(ARQUIVO, contagens, donosDoSourceLegado([ARQUIVO]))).toBe(4);
  });

  it('não credita os trechos a quem divide o título com outro documento', () => {
    // Os trechos são de UM dos dois (o último ingerido apagou os do outro).
    // Contar 4 para os dois seria mentir na tela.
    const gemeo = { ...ARQUIVO, id: 'ckdoc9' };
    const contagens = new Map([['Proposta comercial.pdf', 4]]);
    const donos = donosDoSourceLegado([ARQUIVO, gemeo]);

    expect(trechosDoDocumento(ARQUIVO, contagens, donos)).toBe(0);
    expect(trechosDoDocumento(gemeo, contagens, donos)).toBe(0);
  });

  it('URL casa pela derivação de hostname+caminho', () => {
    const contagens = new Map([['cmj.com.br/cursos', 3]]);

    expect(trechosDoDocumento(URL_DOC, contagens, donosDoSourceLegado([URL_DOC]))).toBe(3);
  });

  it('contagem indisponível devolve null, e não "não indexado" para todo mundo', () => {
    // A consulta ao vetor pode falhar. Pintar a base inteira de âmbar assusta o
    // cliente e o faz reenviar documento que está no lugar certo (A017).
    expect(trechosDoDocumento(ARQUIVO, null, new Map())).toBeNull();
  });
});

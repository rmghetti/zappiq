/**
 * O vínculo entre o documento no Postgres e os trechos no vetor.
 *
 * O `source` do vetor era o TÍTULO do documento. Isso quebrava de três jeitos:
 *
 *   1. Dois documentos com o mesmo título dividiam o mesmo source, e apagar um
 *      apagava os trechos do outro. Aconteceu em produção com o CMJ em 21/08:
 *      três PDFs ficaram sem nenhum trecho (achado A001).
 *   2. Documento de URL guarda a URL inteira no título, mas foi ingerido com
 *      hostname+caminho. O delete procurava um source inexistente, respondia
 *      "apaguei 0" e a rota seguia como se tivesse apagado (achado A002).
 *   3. Qualquer diferença de grafia entre o título e o source (acento, ponto,
 *      extensão) fazia o documento aparecer como "não indexado" (achado A017).
 *
 * Agora o source é `doc-<id do kb_document>`, que é único por definição. Estas
 * funções são puras de propósito: o contrato precisa ser conferível sem banco,
 * e é o mesmo contrato que o reprocessamento do RAG usa
 * (services/rag/reprocess.py).
 */
import * as ragService from '../services/ragService.js';

export const MENSAGEM_TITULO_REPETIDO =
  'Já existe um documento com este título. Renomeie ou apague o anterior.';

/** Só o que importa para descobrir o source de um documento. */
export interface DocumentoParaSource {
  id: string;
  title: string;
  sourceType: string;
  sourceUrl?: string | null;
}

/** O source estável: o id do documento, que nunca colide. */
export function sourceDoDocumento(id: string): string {
  return `doc-${id}`;
}

/**
 * O source com que este documento foi gravado ANTES da migração. Continua
 * valendo enquanto o reprocessamento do RAG não rodar, e some depois dele.
 */
export function sourceLegado(doc: DocumentoParaSource): string {
  if (doc.sourceType === 'url' && doc.sourceUrl) return ragService.urlToSource(doc.sourceUrl);
  return doc.title;
}

/**
 * Corrige o nome de arquivo que o multer entrega.
 *
 * O multer 1.4.5 decodifica `originalname` como latin1 (padrão do busboy). Os
 * BYTES chegam intactos, então reinterpretar como utf-8 devolve o nome que o
 * cliente enviou: sem isso "editável" virava "editaÌvel" no título, no vetor,
 * na lista e no histórico (achado A014). Se os bytes não formarem utf-8
 * válido, o nome original é preservado: melhor um nome estranho do que um nome
 * cheio de losango preto.
 */
export function nomeDeArquivoDoUpload(bruto: string | undefined | null): string {
  const nome = (bruto ?? '').trim();
  if (!nome) return 'documento';

  let corrigido = nome;
  try {
    const utf8 = Buffer.from(nome, 'latin1').toString('utf8');
    if (!utf8.includes('�')) corrigido = utf8;
  } catch {
    // Fica o nome original.
  }
  return corrigido.normalize('NFC');
}

/**
 * Nome de uma página enquanto ela não tem título de verdade.
 *
 * O documento de URL nascia com a URL inteira no título: na lista,
 * "https://cmj.com.br/cursos/conselho-do-futuro" ocupa a linha toda e não diz
 * que página é aquela. Aqui fica "cmj.com.br/conselho-do-futuro". Quando o
 * serviço de indexação devolve o `titulo_detectado` (a tag `<title>` da
 * página), esse é melhor ainda e substitui este.
 */
export function tituloDeUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const trechos = parsed.pathname.split('/').filter(Boolean);
  const ultimo = trechos[trechos.length - 1];
  if (!ultimo) return parsed.hostname;

  let legivel = ultimo;
  try {
    legivel = decodeURIComponent(ultimo);
  } catch {
    // Percent-encoding quebrado: fica o trecho como veio.
  }
  return `${parsed.hostname}/${legivel}`;
}

/** Quantos documentos da organização dividem cada source antigo. */
export function donosDoSourceLegado(docs: DocumentoParaSource[]): Map<string, number> {
  const donos = new Map<string, number>();
  for (const doc of docs) {
    const legado = sourceLegado(doc);
    donos.set(legado, (donos.get(legado) ?? 0) + 1);
  }
  return donos;
}

/**
 * Quantos trechos este documento tem no vetor, de forma honesta durante a
 * transição.
 *
 * Primeiro pelo source novo. Se ainda não migrou, cai para o source antigo,
 * mas só quando este documento é o ÚNICO dono dele: quando dois documentos
 * dividem o título, os trechos são de um deles (o último ingerido apagou os do
 * outro) e creditar os dois seria mentir na tela.
 *
 * `null` quando a contagem não pôde ser lida: pintar a base inteira de "não
 * indexado" por causa de uma consulta que falhou faz o cliente reenviar
 * documento que está no lugar certo (achado A017).
 */
export function trechosDoDocumento(
  doc: DocumentoParaSource,
  contagens: Map<string, number> | null,
  donos: Map<string, number>,
): number | null {
  if (!contagens) return null;

  const novo = contagens.get(sourceDoDocumento(doc.id));
  if (novo) return novo;

  const legado = sourceLegado(doc);
  if ((donos.get(legado) ?? 0) > 1) return 0;
  return contagens.get(legado) ?? 0;
}

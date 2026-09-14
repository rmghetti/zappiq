import { z } from 'zod';

/**
 * Validação do "colar texto direto" isolada para teste (sem Express).
 * Regras: título curto e obrigatório; conteúdo com um mínimo que justifique
 * indexar (texto de 2 palavras não vira conhecimento útil) e um teto sensato.
 */
export const textDocSchema = z.object({
  title: z.string().trim().min(2).max(120),
  content: z.string().trim().min(20).max(50000),
});

export type TextDocInput = z.infer<typeof textDocSchema>;

/**
 * `sourceType` do texto colado. Arquivos guardam o mime ('application/pdf') e
 * URLs guardam 'url' — ver POST /documents e /documents/url.
 */
export const EDITABLE_SOURCE_TYPE = 'text';

/**
 * Só o texto colado é editável. Arquivo e URL têm o conteúdo derivado da fonte
 * (o canônico está no vector store, não no Postgres): editar aqui daria a
 * impressão falsa de alterar o PDF ou a página do cliente.
 */
export function isEditableDocument(sourceType: string): boolean {
  return sourceType === EDITABLE_SOURCE_TYPE;
}

/**
 * Normaliza o corpo de um PUT /qa/:id antes do prisma.update.
 *
 * Categoria apagada chega como string vazia (o modal não pode mandar undefined:
 * a chave sumiria do JSON e o update manteria a categoria antiga). Aqui ela
 * vira null, igual ao que o POST grava. Campos ausentes continuam ausentes —
 * o toggle Ativar/Desativar manda só { isActive } e não pode virar um update
 * que apaga a categoria de tabela.
 */
export function normalizeQaUpdate<T extends Record<string, unknown>>(
  body: T,
): T & { category?: string | null } {
  if (typeof body.category !== 'string') return { ...body };
  const category = body.category.trim();
  return { ...body, category: category === '' ? null : category };
}

/**
 * Formatos que o upload da base de conhecimento aceita.
 *
 * A lista espelha o que o serviço de extração lê de verdade. Word (.docx) e
 * Excel (.xlsx) entraram em 14/09/2026, junto com os conversores de
 * services/rag/extractors.py (mammoth e openpyxl), provados em
 * services/rag/test_extractors.py e test_ingest_documentos.py. Antes disso
 * eles estavam na tela sem existir no motor: o serviço respondia 415, o erro
 * subia sem statusCode e o cliente lia 'Internal Server Error'.
 *
 * Os binários do Office 97 ficam fora: 'application/msword' (.doc) e
 * 'application/vnd.ms-excel' (.xls). Nenhuma biblioteca livre os lê com
 * confiança, e aceitar na porta só adiaria a recusa.
 */
export const ALLOWED_UPLOAD_MIMES: ReadonlySet<string> = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

/**
 * As mesmas seis coisas, pela ponta do nome do arquivo.
 *
 * O navegador não olha o conteúdo: ele manda o mime que o sistema associa à
 * extensão. No Windows, .csv sai como application/vnd.ms-excel (é o Excel que
 * abre planilha) e .md sai como application/octet-stream, ou vazio, porque
 * nada está registrado. Recusar só pelo mime derrubava o cliente que mandou
 * exatamente o arquivo certo, sem ele ter como adivinhar o motivo.
 */
export const ALLOWED_UPLOAD_EXTENSIONS: ReadonlySet<string> = new Set([
  '.pdf',
  '.txt',
  '.md',
  '.csv',
  '.docx',
  '.xlsx',
]);

/** Extensão em minúscula, com o ponto. Nome sem ponto devolve string vazia. */
export function uploadExtension(originalname: string): string {
  const ponto = originalname.lastIndexOf('.');
  if (ponto <= 0) return '';
  return originalname.slice(ponto).toLowerCase();
}

/**
 * Filtro do multer e de qualquer outro ponto que receba arquivo do cliente.
 *
 * Aceita por mime OU por extensão. O OU é de propósito: cada um dos dois
 * sinais falha sozinho (o mime porque o navegador chuta, a extensão porque
 * pode não existir), e nenhum arquivo que a ingestão não lê passa pelos dois.
 * Os formatos antigos .doc e .xls continuam de fora: nem o mime nem a
 * extensão deles estão nas listas.
 */
export function isUploadAllowed(mimetype: string, originalname: string): boolean {
  if (ALLOWED_UPLOAD_MIMES.has(mimetype)) return true;
  return ALLOWED_UPLOAD_EXTENSIONS.has(uploadExtension(originalname));
}

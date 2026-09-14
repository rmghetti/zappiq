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
 * Sincronia com o RAG numa edição de texto colado. O `source` no vector store é
 * o título do documento, e a ingestão faz replace-on-ingest por source — então
 * um título inalterado só precisa reingerir. Se o título mudou, os chunks do
 * título antigo precisam ser removidos, senão ficam órfãos e a IA continua
 * respondendo com a versão anterior do texto.
 */
export function planTextDocRagSync(
  oldTitle: string,
  newTitle: string,
): { deleteSource: string | null; ingestSource: string } {
  return {
    deleteSource: oldTitle === newTitle ? null : oldTitle,
    ingestSource: newTitle,
  };
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
 * A lista espelha o que o serviço de extração lê de verdade: PDF e text/*.
 * Word e Excel estiveram aqui até 14/09/2026 e nunca funcionaram: o serviço
 * responde 415, o erro sobe sem statusCode, o tratador em produção devolve
 * 'Internal Server Error' e nenhum documento é criado, então nem o aviso de
 * 'não indexado' aparece. Enquanto a conversão de DOCX e XLSX não existir, os
 * dois ficam fora daqui, do texto da tela e do accept do input.
 *
 * Quando a conversão entrar, acrescente o mime aqui e ajuste o teste no mesmo
 * PR que entrega a extração, com a prova de um arquivo real indexado.
 */
export const ALLOWED_UPLOAD_MIMES: ReadonlySet<string> = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
]);

/** Filtro do multer e de qualquer outro ponto que receba arquivo do cliente. */
export function isUploadMimeAllowed(mimetype: string): boolean {
  return ALLOWED_UPLOAD_MIMES.has(mimetype);
}

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

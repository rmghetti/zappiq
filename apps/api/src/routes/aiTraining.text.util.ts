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

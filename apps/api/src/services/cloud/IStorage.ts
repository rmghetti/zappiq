/**
 * IStorage — interface cloud-agnostic pra object storage.
 *
 * Hoje: ZappIQ não usa Supabase Storage diretamente — uploads de KB passam
 * por um service Python (services/rag/) que armazena no Supabase Storage
 * internamente. Mas conforme o produto evolui (uploads de avatar, mídia
 * outbound, backups, exports CSV/PDF dos clientes), esta interface vai
 * cobrir os call sites pra ficar cloud-agnostic desde o começo.
 *
 * Backends futuros:
 *   - Supabase Storage — `SupabaseStorageProvider`
 *   - AWS S3 — `S3StorageProvider`
 *   - GCP Cloud Storage — `GcsStorageProvider`
 *
 * Signed URLs são feature crítica — todos os providers suportam, mas com
 * APIs diferentes. Padronizamos via `getSignedUrl(path, ttlSeconds, op)`.
 */

export type StorageOperation = 'read' | 'write';

export interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
  /** Se true, sobrescreve key existente. Default false (throw em conflito). */
  upsert?: boolean;
}

export interface IStorage {
  /**
   * Upload buffer/stream pro bucket. Retorna a key armazenada.
   * Path é relativo ao bucket; bucket é fixo por provider instance.
   */
  upload(path: string, content: Buffer | Uint8Array, options?: UploadOptions): Promise<{
    path: string;
    size: number;
  }>;

  /** Download bytes. Throw se não existe. */
  download(path: string): Promise<Buffer>;

  /** Remove objeto. Idempotente. */
  remove(path: string): Promise<boolean>;

  /**
   * Gera URL assinada pra leitura ou escrita por X segundos.
   * Operação 'write' permite que cliente faça PUT direto sem passar pelo backend.
   */
  getSignedUrl(path: string, ttlSeconds: number, operation: StorageOperation): Promise<string>;

  /** Lista keys com prefixo. Limite default = 100. */
  list(prefix: string, limit?: number): Promise<Array<{ path: string; size: number; lastModified: Date }>>;

  /** Healthcheck. */
  ping(): Promise<boolean>;
}

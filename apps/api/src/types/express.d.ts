// ──────────────────────────────────────────────────────────────────
// Express type augmentation
//
// The default `req.query` type from `qs` is `string | string[] | ParsedQs |
// ParsedQs[] | undefined`, which forces every call site to narrow before
// passing values to Prisma. This project consistently treats query params as
// flat strings, so we collapse the type to `Record<string, string | undefined>`.
//
// IMPORTANT: this is a *type-level* contract. At runtime, Express may still
// produce arrays (e.g. for `?ids=a&ids=b`). Routes MUST validate user input
// before trusting the type — preferably via Zod in the request validator.
// ──────────────────────────────────────────────────────────────────

import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    query: Record<string, string | undefined>;
  }
}

export {};

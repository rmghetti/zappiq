import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export * from '@prisma/client';
export default prisma;

// Templates Maestro (single source of truth) + regra de semeadura compartilhada
// entre o bootstrap do API e o seed manual.
export * from './flowTemplatesData';
export * from './flowTemplatesUpsert';

'use client';

/**
 * /knowledge-base — LEGACY.
 *
 * O conceito de múltiplas "bases de conhecimento" foi descontinuado; o treino
 * da IA vive agora numa única jornada em /ai-training. Esta rota permanece
 * apenas como redirect pra não quebrar deep-links e bookmarks antigos.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function KnowledgeBaseRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/ai-training');
  }, [router]);

  return null;
}

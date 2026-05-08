'use client';

/**
 * useAgentReadiness — hook compartilhado pra fetch + cache do AI Readiness Score.
 *
 * Backend: GET /api/ai-training/status
 * Retorna: score 0-100, level, breakdown, nextActions, stats.
 *
 * Estratégia de cache:
 *   - SWR-style: stale-while-revalidate. Cache 30s.
 *   - Compartilhado entre AgentTrainingWidget, AgentHealthChip, TreinarAgenteFAB.
 *   - Refetch on mount + on window focus + on demand (mutate).
 *
 * Uso:
 *   const { readiness, loading, mutate } = useAgentReadiness();
 *
 * IMPORTANTE: TODA UI que mostra status do agente deve usar esse hook.
 * Single source of truth. Evita inconsistência entre componentes.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../lib/api';

export interface AgentReadiness {
  score: number;
  level: 'initial' | 'learning' | 'ready' | 'expert';
  breakdown: {
    survey: number;
    identity: number;
    documents: number;
    qaPairs: number;
    channel: number;
  };
  nextActions: Array<{
    id: string;
    title: string;
    description: string;
    impact: number;
    cta: string;
    completed: boolean;
  }>;
  stats: {
    documentsCount: number;
    qaPairsCount: number;
    surveyAnswers: number;
    whatsappConnections: number;
  };
}

// Cache module-level (compartilhado entre instâncias do hook)
let cached: AgentReadiness | null = null;
let cacheTimestamp = 0;
const TTL_MS = 30_000; // 30s

const subscribers = new Set<(v: AgentReadiness | null) => void>();

function notifyAll(v: AgentReadiness | null) {
  cached = v;
  cacheTimestamp = Date.now();
  subscribers.forEach((cb) => cb(v));
}

async function fetchReadiness(): Promise<AgentReadiness | null> {
  try {
    const res = await api.get('/api/ai-training/status');
    return res as AgentReadiness;
  } catch {
    return null;
  }
}

export function useAgentReadiness() {
  const [readiness, setReadiness] = useState<AgentReadiness | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const fresh = await fetchReadiness();
    if (mounted.current) {
      notifyAll(fresh);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const onUpdate = (v: AgentReadiness | null) => {
      if (mounted.current) setReadiness(v);
    };
    subscribers.add(onUpdate);

    // Fetch inicial se cache stale ou inexistente
    const stale = !cached || Date.now() - cacheTimestamp > TTL_MS;
    if (stale) {
      void refresh();
    } else {
      setReadiness(cached);
      setLoading(false);
    }

    // Refetch on window focus
    const onFocus = () => {
      if (Date.now() - cacheTimestamp > TTL_MS) void refresh();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      mounted.current = false;
      subscribers.delete(onUpdate);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return { readiness, loading, mutate: refresh };
}

/** Helper: cor do score por nivel. Tailwind classes. */
export function readinessLevelColor(level: AgentReadiness['level']) {
  switch (level) {
    case 'initial':
      return { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', border: 'border-red-200' };
    case 'learning':
      return { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200' };
    case 'ready':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' };
    case 'expert':
      return { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', border: 'border-violet-200' };
  }
}

/** Helper: label do nivel em pt-BR. */
export function readinessLevelLabel(level: AgentReadiness['level']) {
  return { initial: 'Iniciando', learning: 'Aprendendo', ready: 'Pronto', expert: 'Expert' }[level];
}

'use client';

import { useEffect, useState } from 'react';
import { X, AlertTriangle, TrendingDown, Activity } from 'lucide-react';
import {
  TenantUsageDetailResponse,
  TenantHistoryRow,
} from '../../../../lib/adminApi';

interface TenantDrawerProps {
  isOpen: boolean;
  tenantId: string;
  tenantName: string;
  tenantPlan: string;
  onClose: () => void;
  data: TenantUsageDetailResponse | null;
  loading: boolean;
}

export function TenantDrawer({
  isOpen,
  tenantId,
  tenantName,
  tenantPlan,
  onClose,
  data,
  loading,
}: TenantDrawerProps) {
  const [currentMonthData, setCurrentMonthData] = useState<TenantHistoryRow | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    if (!data || !data.history || data.history.length === 0) return;

    const current = data.history[0];
    setCurrentMonthData(current);

    // Lógica de alertas contextuais
    const newAlerts: string[] = [];

    // Alerta 1: Estourou plano por 2 meses consecutivos
    if (
      data.history.length >= 2 &&
      data.history[0].grossMarginPercent !== null &&
      data.history[1].grossMarginPercent !== null &&
      data.history[0].grossMarginPercent < 0 &&
      data.history[1].grossMarginPercent < 0
    ) {
      newAlerts.push('Margem negativa por 2 meses → sugerir upsell');
    }

    // Alerta 2: Margem negativa há X meses
    const negativeMonths = data.history.filter(
      (h) => h.grossMarginPercent !== null && h.grossMarginPercent < 0
    ).length;
    if (negativeMonths >= 2) {
      newAlerts.push(`Margem negativa há ${negativeMonths} meses → investigar custos`);
    }

    // Alerta 3: Sem atividade há N dias (usando last computedAt)
    const lastComputedTime = new Date(current.computedAt).getTime();
    const nowTime = Date.now();
    const daysSinceActivity = Math.floor((nowTime - lastComputedTime) / (1000 * 60 * 60 * 24));
    if (daysSinceActivity > 30) {
      newAlerts.push(`Sem atividade há ${daysSinceActivity} dias → risco de churn`);
    }

    setAlerts(newAlerts);
  }, [data]);

  if (!isOpen) return null;

  const stripeCustomerId = tenantId; // Placeholder — seria necesário campo no schema

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute right-0 top-0 bottom-0 w-[420px] bg-white shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{tenantName}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2.5 py-1 bg-primary-100 text-primary-700 text-xs font-semibold rounded">
                {tenantPlan}
              </span>
              <a
                href={`https://dashboard.stripe.com/customers/${stripeCustomerId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-600 hover:text-primary-700 underline"
              >
                Abrir no Stripe →
              </a>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Fechar"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-64 bg-gray-200 rounded" />
              <div className="h-32 bg-gray-200 rounded" />
            </div>
          ) : data && data.history && data.history.length > 0 ? (
            <>
              {/* Mini-chart: últimos 6 meses */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Últimos 6 meses
                </h3>
                <HistoryChart history={data.history} />
              </div>

              {/* Detalhe do mês atual */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Detalhes do mês: {currentMonthData?.period}
                </h3>
                <div className="space-y-2 bg-gray-50 rounded-lg p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Handoffs:</span>
                    <span className="font-semibold text-gray-900">
                      {currentMonthData?.handoffsCount ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Conversas abertas:</span>
                    <span className="font-semibold text-gray-900">
                      {currentMonthData?.conversationsOpened ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Conversas fechadas:</span>
                    <span className="font-semibold text-gray-900">
                      {currentMonthData?.conversationsClosed ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Resolvidas por IA:</span>
                    <span className="font-semibold text-gray-900">
                      {currentMonthData?.conversationsAiResolved ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Custo por conversa:</span>
                    <span className="font-semibold text-gray-900">
                      ${(
                        (currentMonthData?.llmCostUsd ?? 0) /
                        Math.max(currentMonthData?.conversationsOpened ?? 1, 1)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Alertas */}
              {alerts.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900">Alertas</h3>
                  {alerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-900"
                    >
                      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                      <span>{alert}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              Sem dados disponíveis
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Mini-chart em SVG nativo exibindo últimos 6 meses.
 * Barras: mensagens IA (azul) + custo LLM (vermelho overlay).
 */
function HistoryChart({ history }: { history: TenantHistoryRow[] }) {
  if (history.length === 0) return null;

  // Últimos 6 meses em ordem cronológica
  const data = [...history].reverse().slice(0, 6);

  const maxMessages = Math.max(...data.map((d) => d.aiMessagesProcessed), 1);
  const maxCost = Math.max(...data.map((d) => d.llmCostUsd), 1);

  const chartWidth = 320;
  const chartHeight = 240;
  const barWidth = chartWidth / data.length;
  const padding = 32;
  const innerWidth = chartWidth - padding * 2;
  const innerHeight = chartHeight - padding * 2;

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {/* Y-axis label */}
        <text x="12" y="20" fontSize="11" fill="#999">
          Msgs
        </text>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={`grid-${ratio}`}
            x1={padding}
            y1={padding + innerHeight * (1 - ratio)}
            x2={padding + innerWidth}
            y2={padding + innerHeight * (1 - ratio)}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}

        {/* Barras e labels */}
        {data.map((row, idx) => {
          const x = padding + (idx * innerWidth) / data.length;
          const barWidthInner = innerWidth / data.length - 4;

          const msgHeight = (row.aiMessagesProcessed / maxMessages) * innerHeight;
          const costHeight = (row.llmCostUsd / maxCost) * innerHeight;

          const label = row.period.slice(5); // "2026-03" → "03"

          return (
            <g key={idx}>
              {/* Barra de mensagens (azul claro) */}
              <rect
                x={x + 2}
                y={padding + innerHeight - msgHeight}
                width={barWidthInner * 0.6}
                height={msgHeight}
                fill="#3b82f6"
                opacity="0.8"
              />

              {/* Barra de custo (vermelho overlay) */}
              <rect
                x={x + 2 + barWidthInner * 0.6}
                y={padding + innerHeight - costHeight}
                width={barWidthInner * 0.4}
                height={costHeight}
                fill="#ef4444"
                opacity="0.8"
              />

              {/* Label do mês */}
              <text
                x={x + barWidthInner / 2}
                y={padding + innerHeight + 16}
                fontSize="10"
                fill="#666"
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legenda */}
      <div className="flex gap-4 mt-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span className="text-gray-600">Mensagens IA</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span className="text-gray-600">Custo LLM (USD)</span>
        </div>
      </div>
    </div>
  );
}

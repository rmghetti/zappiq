'use client';

import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  delta?: {
    value: number;
    isPositive: boolean;
  };
  loading?: boolean;
  /** Torna o card clicável (aplica filtro / navega). */
  onClick?: () => void;
  /** Realça o card quando o filtro dele está ativo. */
  active?: boolean;
  /** Dica curta mostrada ao passar o mouse (o que o clique faz). */
  hint?: string;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  delta,
  loading = false,
  onClick,
  active = false,
  hint,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
          <div className="h-8 bg-gray-300 rounded w-2/3" />
        </div>
      </div>
    );
  }

  const clickable = typeof onClick === 'function';
  const Tag: any = clickable ? 'button' : 'div';

  return (
    <Tag
      {...(clickable
        ? {
            type: 'button',
            onClick,
            title: hint,
            'aria-pressed': active,
          }
        : {})}
      className={`w-full text-left bg-white rounded-lg border p-6 transition-shadow transition-colors ${
        clickable ? 'cursor-pointer hover:shadow-md hover:border-primary-300' : 'hover:shadow-md'
      } ${active ? 'border-primary-500 ring-1 ring-primary-500 bg-primary-50/40' : 'border-gray-200'}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        </div>
        {Icon && (
          <Icon className="text-primary-500" size={24} />
        )}
      </div>

      {delta && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${
          delta.isPositive ? 'text-green-600' : 'text-red-600'
        }`}>
          <span>{delta.isPositive ? '↑' : '↓'}</span>
          <span>{Math.abs(delta.value).toFixed(1)}%</span>
          <span className="text-gray-500">vs. mês anterior</span>
        </div>
      )}
    </Tag>
  );
}

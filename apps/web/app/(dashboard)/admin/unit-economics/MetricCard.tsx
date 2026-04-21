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
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  delta,
  loading = false,
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
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
    </div>
  );
}

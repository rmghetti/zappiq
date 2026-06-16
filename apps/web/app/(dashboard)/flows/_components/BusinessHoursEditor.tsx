'use client';
import React from 'react';

export interface BusinessHoursConfig { timezone: string; days: Record<number, { open: string; close: string } | null> }
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const inputCls = 'px-2 py-1 border border-gray-200 rounded text-xs outline-none focus:ring-2 focus:ring-primary-400';

const DEFAULT: BusinessHoursConfig = {
  timezone: 'America/Sao_Paulo',
  days: { 0: null, 1: { open: '09:00', close: '18:00' }, 2: { open: '09:00', close: '18:00' }, 3: { open: '09:00', close: '18:00' }, 4: { open: '09:00', close: '18:00' }, 5: { open: '09:00', close: '18:00' }, 6: null },
};

export function defaultBusinessHours(): BusinessHoursConfig { return JSON.parse(JSON.stringify(DEFAULT)); }

export function BusinessHoursEditor({ value, onChange }: { value: BusinessHoursConfig; onChange: (c: BusinessHoursConfig) => void }) {
  const setDay = (d: number, win: { open: string; close: string } | null) => onChange({ ...value, days: { ...value.days, [d]: win } });
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-600">Fuso</label>
        <input className={inputCls} value={value.timezone} onChange={(e) => onChange({ ...value, timezone: e.target.value })} />
      </div>
      <div className="space-y-1">
        {DAYS.map((name, d) => {
          const win = value.days[d];
          return (
            <div key={d} className="flex items-center gap-2">
              <label className="flex items-center gap-1 w-16 text-xs text-gray-600">
                <input type="checkbox" checked={!!win} onChange={(e) => setDay(d, e.target.checked ? { open: '09:00', close: '18:00' } : null)} />
                {name}
              </label>
              {win ? (
                <>
                  <input type="time" className={inputCls} value={win.open} onChange={(e) => setDay(d, { ...win, open: e.target.value })} />
                  <span className="text-gray-400 text-xs">às</span>
                  <input type="time" className={inputCls} value={win.close} onChange={(e) => setDay(d, { ...win, close: e.target.value })} />
                </>
              ) : <span className="text-xs text-gray-400">fechado</span>}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-400">Usado pelas condições "Horário comercial" dos fluxos. Janela vira-noite: configure dois dias.</p>
    </div>
  );
}

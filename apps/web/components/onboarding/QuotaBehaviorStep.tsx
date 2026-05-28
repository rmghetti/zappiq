'use client';

/**
 * #150 — Wizard step: cliente escolhe comportamento quando atingir limite.
 */

import { Bell, CreditCard, ShieldCheck, Check } from 'lucide-react';

export type QuotaLimitBehavior = 'notify_decide' | 'auto_charge' | 'hard_block';

interface QuotaBehaviorStepProps {
  value: QuotaLimitBehavior;
  onChange: (v: QuotaLimitBehavior) => void;
}

const OPTIONS: Array<{
  id: QuotaLimitBehavior;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
  gradient: string;
  borderActive: string;
}> = [
  {
    id: 'notify_decide',
    icon: <Bell size={20} />,
    title: 'Avisar e deixar voce decidir (recomendado)',
    subtitle: 'Receba alertas em 70/80/90/95% pra agir antes do limite',
    bullets: [
      'Email + WhatsApp em 5 niveis de alerta',
      'Em 95% voce decide: liberar excedente ou bloquear',
      'Comportamento padrao do mercado — controle total',
    ],
    gradient: 'from-blue-50 to-violet-50',
    borderActive: 'border-violet-500 ring-2 ring-violet-200',
  },
  {
    id: 'auto_charge',
    icon: <CreditCard size={20} />,
    title: 'Cobrar excedente automaticamente',
    subtitle: 'Nao bloqueia — voce paga R$ 0,03 por mensagem alem do plano',
    bullets: [
      'Operacao nao para nunca, mesmo em picos',
      'Voce pode definir teto mensal pra limitar gasto',
      'Ideal pra quem tem campanha ativa ou alta sazonalidade',
    ],
    gradient: 'from-emerald-50 to-teal-50',
    borderActive: 'border-emerald-500 ring-2 ring-emerald-200',
  },
  {
    id: 'hard_block',
    icon: <ShieldCheck size={20} />,
    title: 'Bloquear ao atingir 100%',
    subtitle: 'Sem surpresas no cartao — bot pausa ate o proximo ciclo',
    bullets: [
      'Custo previsivel garantido',
      'Voce pode comprar pacote extra (5k/10k/50k msgs) manualmente',
      'Recomendado pra quem precisa de previsao orcamentaria rigida',
    ],
    gradient: 'from-amber-50 to-orange-50',
    borderActive: 'border-amber-500 ring-2 ring-amber-200',
  },
];

export function QuotaBehaviorStep({ value, onChange }: QuotaBehaviorStepProps) {
  return (
    <div className="space-y-3">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900 mb-1">
          O que voce quer que aconteca quando atingir o limite mensal?
        </h3>
        <p className="text-sm text-slate-600">
          Voce pode mudar isso depois em Configuracoes &gt; Cobranca.
        </p>
      </div>
      {OPTIONS.map((opt) => {
        const selected = value === opt.id;
        return (
          <button key={opt.id} type="button" onClick={() => onChange(opt.id)}
            className={`w-full text-left rounded-2xl border-2 p-5 transition-all bg-gradient-to-br ${opt.gradient} ${selected ? opt.borderActive : 'border-slate-200 hover:border-slate-300'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 ${selected ? 'text-slate-900' : 'text-slate-500'}`}>{opt.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-slate-900">{opt.title}</h4>
                  {selected && <Check size={18} className="text-emerald-600 shrink-0" />}
                </div>
                <p className="text-xs text-slate-600 mt-1">{opt.subtitle}</p>
                <ul className="mt-3 space-y-1">
                  {opt.bullets.map((b, i) => (
                    <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                      <span className="text-slate-400 mt-0.5">&middot;</span><span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Calculator } from 'lucide-react';

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  onChange: (v: number) => void;
}

function SliderInput({ label, value, min, max, step = 1, prefix = '', onChange }: SliderInputProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
          {prefix}{value.toLocaleString('pt-BR')}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #1B6B3A 0%, #25D366 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
        }}
      />
      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
        <span>{prefix}{min.toLocaleString('pt-BR')}</span>
        <span>{prefix}{max.toLocaleString('pt-BR')}</span>
      </div>
    </div>
  );
}

export function ROICalculator() {
  const [attendants, setAttendants] = useState(5);
  const [messagesPerDay, setMessagesPerDay] = useState(100);
  const [avgSalary, setAvgSalary] = useState(2500);
  const [avgTicket, setAvgTicket] = useState(200);

  const results = useMemo(() => {
    const currentCost = attendants * avgSalary;
    const zappiqCost = attendants <= 3 ? 297 : attendants <= 10 ? 597 : 997;
    const savings = Math.max(0, currentCost - zappiqCost);
    const additionalRevenue = Math.round(messagesPerDay * 30 * avgTicket * 0.30 * 0.05);
    const roi = zappiqCost > 0 ? Math.round(((savings + additionalRevenue) / zappiqCost) * 100) : 0;

    return { currentCost, zappiqCost, savings, additionalRevenue, roi };
  }, [attendants, messagesPerDay, avgSalary, avgTicket]);

  return (
    <section className="py-20 lg:py-28 bg-[#F8FAF9]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Calculadora de ROI</p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3">
            Descubra quanto você economiza com ZappIQ
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">Ajuste os valores abaixo e veja em tempo real o impacto no seu negócio.</p>
        </div>

        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-10">
          {/* Sliders */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-8">
            <div className="flex items-center gap-3 mb-2">
              <Calculator size={20} className="text-primary-500" />
              <h3 className="font-display text-lg font-bold text-gray-900">Seus dados atuais</h3>
            </div>

            <SliderInput
              label="Quantos atendentes você tem hoje?"
              value={attendants} min={1} max={20}
              onChange={setAttendants}
            />
            <SliderInput
              label="Quantas mensagens recebe por dia?"
              value={messagesPerDay} min={10} max={500} step={10}
              onChange={setMessagesPerDay}
            />
            <SliderInput
              label="Salário médio de cada atendente"
              value={avgSalary} min={1500} max={5000} step={100}
              prefix="R$"
              onChange={setAvgSalary}
            />
            <SliderInput
              label="Ticket médio do seu produto/serviço"
              value={avgTicket} min={50} max={5000} step={50}
              prefix="R$"
              onChange={setAvgTicket}
            />
          </div>

          {/* Resultados */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <p className="text-sm text-gray-500 mb-1">Custo atual estimado</p>
              <p className="text-2xl font-extrabold text-gray-900">R${results.currentCost.toLocaleString('pt-BR')}<span className="text-sm font-normal text-gray-400">/mês</span></p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <p className="text-sm text-gray-500 mb-1">Com ZappIQ</p>
              <p className="text-2xl font-extrabold text-primary-600">R${results.zappiqCost.toLocaleString('pt-BR')}<span className="text-sm font-normal text-gray-400">/mês</span></p>
            </div>

            {/* Card de destaque */}
            <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-2xl border border-primary-200 p-6 space-y-4">
              <div>
                <p className="text-sm text-primary-700 font-medium mb-1">Economia estimada</p>
                <p className="text-3xl font-extrabold text-primary-700">R${results.savings.toLocaleString('pt-BR')}<span className="text-sm font-normal text-primary-500">/mês</span></p>
              </div>
              <div>
                <p className="text-sm text-primary-700 font-medium mb-1">Receita adicional estimada</p>
                <p className="text-3xl font-extrabold text-secondary-700">R${results.additionalRevenue.toLocaleString('pt-BR')}<span className="text-sm font-normal text-secondary-500">/mês</span></p>
              </div>
              <div className="border-t border-primary-200 pt-4">
                <p className="text-sm text-primary-700 font-medium mb-1">ROI estimado</p>
                <p className="text-4xl font-extrabold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">{results.roi}%</p>
              </div>
            </div>

            <Link href="/register"
              className="flex items-center justify-center gap-2 w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold px-6 py-4 rounded-xl transition-colors shadow-lg shadow-primary-500/25 text-base">
              Quero esses resultados — Começar Grátis <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

'use client';

/**
 * ImpulsoPlanDetailModal — o "Saiba mais" de cada plano do Zap Impulso.
 *
 * Popup grande que abre POR CIMA do paywall (ImpulsoUpsellModal continua ao
 * fundo). Traz: o que é o Zap Impulso, a descrição completa do plano escolhido
 * (o que está ativo + limites), um exemplo/simulação de cenário e o comparativo
 * claro entre os 3 planos. Fechar volta para o paywall sem perder o contexto.
 */
import { X, Check, Minus, Sparkles, Target, ListChecks, Ban, Lightbulb, Table } from 'lucide-react';
import {
  ZAP_IMPULSO_INTRO,
  PLAN_CONTENT,
  PLAN_COMPARISON,
  PLAN_ORDER,
  type PlanKey,
  type CompareRow,
} from './impulsoPlansContent';

const GRAD = 'bg-gradient-to-r from-[#2FB57A] via-[#2F7FB5] to-[#4A52D0]';

function Cell({ v, highlight }: { v: boolean | string; highlight: boolean }) {
  const base = highlight ? 'bg-[#F3F4FE]' : '';
  return (
    <td className={`px-3 py-2 text-center align-middle ${base}`}>
      {typeof v === 'string' ? (
        <span className="text-xs font-semibold text-gray-800">{v}</span>
      ) : v ? (
        <Check size={15} className="inline text-[#2FB57A]" />
      ) : (
        <Minus size={15} className="inline text-gray-300" />
      )}
    </td>
  );
}

export function ImpulsoPlanDetailModal({ planKey, onClose }: { planKey: PlanKey | null; onClose: () => void }) {
  if (!planKey) return null;
  const plan = PLAN_CONTENT[planKey];
  const colOf = (r: CompareRow) => (planKey === 'IMPULSO_START' ? r.start : planKey === 'IMPULSO_PRO' ? r.pro : r.scale);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[94vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do plano */}
        <div className={`relative px-6 py-6 text-white ${GRAD}`}>
          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white" aria-label="Fechar">
            <X size={18} />
          </button>
          <div className="flex items-center gap-2 text-white/90 text-xs font-semibold uppercase tracking-wide">
            <Sparkles size={14} /> Zap Impulso · Plano {plan.name}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <h2 className="text-2xl font-bold">Plano {plan.name}</h2>
            <span className="text-lg font-semibold text-white/90">R$ {plan.price}/mês</span>
          </div>
          <p className="text-white/90 text-sm mt-1">{plan.tagline}</p>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* O que é o Zap Impulso */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Sparkles size={15} className="text-[#4A52D0]" /> {ZAP_IMPULSO_INTRO.title}
            </h3>
            <div className="mt-2 space-y-2">
              {ZAP_IMPULSO_INTRO.paragraphs.map((p, i) => (
                <p key={i} className="text-sm text-gray-600 leading-relaxed">{p}</p>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mt-3">
              {ZAP_IMPULSO_INTRO.pillars.map((pl) => (
                <div key={pl.name} className="flex items-start gap-2 rounded-lg bg-gray-50 p-2.5">
                  <Check size={14} className="text-[#2FB57A] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{pl.name}</p>
                    <p className="text-[11px] text-gray-500 leading-snug">{pl.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Para quem é este plano */}
          <section className="rounded-xl border border-[#E3E4F7] bg-[#F7F7FD] p-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Target size={15} className="text-[#4A52D0]" /> Para quem é o {plan.name}
            </h3>
            <p className="text-sm text-gray-600 mt-1.5">{plan.forWho}</p>
          </section>

          {/* O que está ativo */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <ListChecks size={15} className="text-[#2FB57A]" /> O que está ativo no {plan.name}
            </h3>
            <ul className="mt-2 space-y-1.5">
              {plan.active.map((a) => (
                <li key={a} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check size={14} className="text-[#2FB57A] flex-shrink-0 mt-0.5" /> {a}
                </li>
              ))}
            </ul>
          </section>

          {/* Limites */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Ban size={15} className="text-amber-500" /> Limites do {plan.name}
            </h3>
            <ul className="mt-2 space-y-1.5">
              {plan.limits.map((l) => (
                <li key={l} className="flex items-start gap-2 text-sm text-gray-600">
                  <Minus size={14} className="text-gray-400 flex-shrink-0 mt-0.5" /> {l}
                </li>
              ))}
            </ul>
          </section>

          {/* Exemplo de aplicabilidade */}
          <section className="rounded-xl border border-[#CDE9DA] bg-[#E4F3EC] p-4">
            <h3 className="text-sm font-bold text-[#1B7A54] flex items-center gap-2">
              <Lightbulb size={15} /> {plan.scenario.title}
            </h3>
            <p className="text-sm text-[#245c45] mt-1.5 leading-relaxed">{plan.scenario.text}</p>
          </section>

          {/* Comparativo entre os 3 planos */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-2">
              <Table size={15} className="text-[#4A52D0]" /> Comparativo entre os planos
            </h3>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full border-collapse text-sm min-w-[520px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Recurso</th>
                    {PLAN_ORDER.map((k) => (
                      <th
                        key={k}
                        className={`px-3 py-2 text-center text-xs font-bold ${k === planKey ? 'text-[#4A52D0] bg-[#F3F4FE]' : 'text-gray-600'}`}
                      >
                        {PLAN_CONTENT[k].name}
                        {k === planKey && <span className="block text-[9px] font-semibold text-[#4A52D0]">este plano</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PLAN_COMPARISON.map((r) => (
                    <tr key={r.label} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-xs text-gray-700">{r.label}</td>
                      <Cell v={r.start} highlight={planKey === 'IMPULSO_START'} />
                      <Cell v={r.pro} highlight={planKey === 'IMPULSO_PRO'} />
                      <Cell v={r.scale} highlight={planKey === 'IMPULSO_SCALE'} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Mensagens de marketing do WhatsApp são cobradas por uso (custo da Meta repassado). O valor do plano é o
              software; a verba de mídia é à parte. Sem taxa de setup, cancele quando quiser.
            </p>
          </section>

          {/* Fechar */}
          <div className="flex justify-end pt-1">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <X size={14} /> Fechar e voltar aos planos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

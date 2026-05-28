'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * MaestroSection — ZappIQ Maestro na landing (Track B, #281)
 * --------------------------------------------------------------------------
 * Flow builder visual HÍBRIDO: cada nó é trilho fixo (determinístico) OU nó-IA
 * (a Iza decide). Diferencial vs. construtores determinísticos puros (ex: Blip
 * Builder). Mensagem-bandeira: "A IA é o cérebro. O Maestro é onde você rege."
 * Tagline: "Reja sua IA."
 *
 * Estrutura: bandeira + 4 tipos de nó (cores semânticas) + comparativo
 * determinístico-puro vs híbrido + simulação estática "Maestro monta pra você".
 * Visual no mesmo sistema da landing (zappiq-wrap / eyebrow / text-grad /
 * card-soft). Badge "Em breve" — honesto: ainda em construção (Fase B).
 * ══════════════════════════════════════════════════════════════════════════ */

import { Workflow, Sparkles, Zap, Headset, Check, X as XIcon } from 'lucide-react';

// 4 categorias de nó = 4 cores semânticas (mesma linguagem do produto)
const NODE_KINDS = [
  {
    icon: Workflow,
    name: 'Trilho fixo',
    desc: 'Passos determinísticos: pergunta, condição, mensagem padrão. Previsível, sempre igual.',
    cls: 'text-slate-700 bg-slate-50 border-slate-200',
    dot: 'bg-slate-400',
  },
  {
    icon: Sparkles,
    name: 'Nó-IA',
    desc: 'A Iza assume e decide com a base de conhecimento da sua empresa. Conversa de verdade, não robô.',
    cls: 'text-blue-700 bg-blue-50 border-blue-200',
    dot: 'bg-blue-500',
  },
  {
    icon: Zap,
    name: 'Ação',
    desc: 'Marca o lead, atualiza o CRM, dispara um agendamento. O fluxo faz, não só fala.',
    cls: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  {
    icon: Headset,
    name: 'Humano',
    desc: 'Transfere pro time no momento certo, com todo o contexto. Sem o cliente repetir nada.',
    cls: 'text-amber-700 bg-amber-50 border-amber-200',
    dot: 'bg-amber-500',
  },
];

const COMPARISON = [
  {
    rigid: 'Árvore de botões: trava em tudo que você não previu',
    hybrid: 'Trilho onde precisa de controle, IA onde precisa de conversa',
  },
  {
    rigid: 'Cliente fala "fora do script" e o fluxo quebra',
    hybrid: 'O nó-IA entende qualquer jeito de falar e segue',
  },
  {
    rigid: 'Cada cenário novo é um galho a mais pra você desenhar',
    hybrid: 'A Iza cobre o aberto; você só rege os pontos críticos',
  },
  {
    rigid: 'Manutenção vira um labirinto de condições',
    hybrid: 'Menos nós, mais inteligência — fácil de manter',
  },
];

// Sequência ilustrativa de um fluxo (a "simulação" estática)
const SIM_FLOW = [
  { kind: 0, label: 'Cliente chega' },
  { kind: 1, label: 'Iza entende a intenção' },
  { kind: 0, label: 'É orçamento?' },
  { kind: 2, label: 'Marca lead quente' },
  { kind: 3, label: 'Passa pro vendedor' },
];

export function MaestroSection() {
  return (
    <section id="maestro" className="py-20 lg:py-28 bg-bg">
      <div className="zappiq-wrap">
        {/* Bandeira */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="eyebrow">ZappIQ Maestro · em breve</span>
          <h2 className="text-[40px] lg:text-[52px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mb-4">
            A IA é o cérebro.{' '}
            <span className="text-grad">O Maestro é onde você rege.</span>
          </h2>
          <p className="text-[16px] lg:text-[17px] text-muted leading-relaxed">
            Um construtor de fluxos visual e híbrido: cada passo pode ser um trilho
            fixo, do jeito que você definiu, ou um nó-IA, onde a Iza assume e
            conversa. Controle onde importa, inteligência no resto.
          </p>
        </div>

        {/* 4 tipos de nó */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 max-w-6xl mx-auto mb-16">
          {NODE_KINDS.map((n) => {
            const Icon = n.icon;
            return (
              <div key={n.name} className={`card-soft p-6 border ${n.cls.split(' ').slice(1).join(' ')}`}>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${n.cls}`}>
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <h3 className="text-[16px] font-semibold text-ink tracking-tight mb-1.5">{n.name}</h3>
                <p className="text-[13.5px] text-muted leading-snug">{n.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Simulação estática "Maestro monta pra você" */}
        <div className="max-w-5xl mx-auto mb-16">
          <div className="card-soft p-7 lg:p-9">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles size={16} className="text-blue-500" />
              <span className="text-[13px] font-semibold text-ink tracking-tight">
                Você descreve o atendimento. O Maestro monta o fluxo.
              </span>
            </div>
            <div className="flex flex-col md:flex-row md:items-stretch gap-3">
              {SIM_FLOW.map((step, i) => {
                const kind = NODE_KINDS[step.kind];
                return (
                  <div key={i} className="flex items-center gap-3 md:flex-col md:gap-2 md:flex-1">
                    <div className={`w-full rounded-xl border px-4 py-3 ${kind.cls} flex items-center gap-2.5 md:flex-col md:text-center md:py-4`}>
                      <span className={`w-2 h-2 rounded-full ${kind.dot} flex-shrink-0`} />
                      <span className="text-[12.5px] font-medium leading-tight">{step.label}</span>
                    </div>
                    {i < SIM_FLOW.length - 1 && (
                      <span className="text-muted text-lg md:rotate-90 md:my-0.5 select-none">→</span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[13px] text-muted mt-6 leading-relaxed">
              Cada bloco acima é um nó: <span className="text-slate-600 font-medium">cinza</span> é trilho fixo,{' '}
              <span className="text-blue-600 font-medium">azul</span> é a Iza decidindo,{' '}
              <span className="text-emerald-600 font-medium">verde</span> é ação,{' '}
              <span className="text-amber-600 font-medium">âmbar</span> é humano. Você arrasta, conecta e pública — no WhatsApp, no Instagram e no chat do site, ao mesmo tempo.
            </p>
          </div>
        </div>

        {/* Comparativo: determinístico puro vs híbrido */}
        <div className="grid md:grid-cols-2 gap-5 lg:gap-6 max-w-5xl mx-auto">
          {/* Construtor determinístico puro */}
          <div className="card-soft p-8 lg:p-9 relative bg-[#FEF3F2]/30 border-[#FECDD3]/60">
            <div className="absolute -top-3 left-7 px-3 py-1 rounded-full bg-[#FEF3F2] border border-[#FECDD3] text-[11px] font-semibold text-[#B42318] tracking-wide">
              Construtor de fluxo comum
            </div>
            <h3 className="text-[18px] font-medium text-[#B42318] mb-6 flex items-center gap-2 tracking-tight mt-2">
              <XIcon size={18} strokeWidth={2.5} /> Determinístico puro
            </h3>
            <ul className="space-y-4">
              {COMPARISON.map((c) => (
                <li key={c.rigid} className="flex items-start gap-3 text-[14px] text-muted leading-snug">
                  <div className="w-6 h-6 bg-[#FEF3F2] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <XIcon size={11} className="text-[#B42318]" strokeWidth={3} />
                  </div>
                  <span>{c.rigid}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Maestro híbrido */}
          <div
            className="card-soft p-8 lg:p-9 relative border border-blue-100"
            style={{ background: 'var(--grad-soft)' }}
          >
            <div className="absolute -top-3 left-7 px-3 py-1 rounded-full bg-white border border-blue-200 text-[11px] font-semibold text-grad tracking-wide">
              ZappIQ Maestro
            </div>
            <h3 className="text-[18px] font-medium text-ink mb-6 flex items-center gap-2 tracking-tight mt-2">
              <Sparkles size={18} strokeWidth={2.5} className="text-blue-500" /> Híbrido (trilho + IA)
            </h3>
            <ul className="space-y-4">
              {COMPARISON.map((c) => (
                <li key={c.hybrid} className="flex items-start gap-3 text-[14px] text-ink leading-snug">
                  <div className="w-6 h-6 bg-emerald-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check size={11} className="text-emerald-600" strokeWidth={3} />
                  </div>
                  <span>{c.hybrid}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-center text-[13px] text-muted mt-10">
          O Maestro está em construção. Quer ser dos primeiros a reger sua IA?{' '}
          <a href="/agendar" className="text-grad font-medium hover:underline">Fale com a gente.</a>
        </p>
      </div>
    </section>
  );
}

'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * OutubroSemSusto: conteúdo da página /novidades-meta (kit "Outubro sem susto")
 * --------------------------------------------------------------------------
 * 20/08/2026: a página deixou de ser a landing dos lançamentos do
 * Conversations Brasil (conteúdo antigo em NovidadesMeta.tsx) e virou o kit
 * da mudança de preço da Meta em 01/10/2026, conforme
 * docs/resposta-meta-2026/comunicacao/kit-outubro-sem-susto-v1.md e a seção 7
 * do PLANO-RESPOSTA-META.md.
 *
 * Estrutura:
 *   1. Hero ("Em outubro a Meta muda o preço dela. O seu não muda.")
 *   2. O que muda em 01/10 (3 fatos)
 *   3. Calculadora client-side pura (sem backend, sem fetch):
 *        fatura Meta = atendimentos × respostas × R$ 0,035
 *                    + disparos de marketing × R$ 0,3217
 *      com aviso visível de que as tarifas são referência de agosto/2026.
 *   4. Tradução por vertical (clínica, e-commerce, distribuidora)
 *   5. FAQ da mudança (6 perguntas do kit)
 *   6. CTA para o trial
 *
 * Tarifas de REFERÊNCIA (agosto/2026). A tabela final da Meta sai até
 * 01/09/2026: atualizar as duas constantes abaixo no mesmo dia.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calculator, MessageCircle, Inbox, Wallet, AlertTriangle,
  Stethoscope, ShoppingCart, Truck, ArrowRight, ChevronDown,
} from 'lucide-react';

/* Tarifas de referência (agosto/2026). Tabela final da Meta até 01/09/2026. */
const TARIFA_SERVICO_BRL = 0.035; // por mensagem de resposta enviada (serviço)
const TARIFA_MARKETING_BRL = 0.3217; // por mensagem de marketing enviada
const RESPOSTAS_DEFAULT = 5.4; // média medida na base ZappIQ

function brl(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function num(v: number, decimals = 0): string {
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/* ── Slider no padrão do ROICalculator ──────────────────────────────────── */
interface SliderInputProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  suffix?: string;
  onChange: (v: number) => void;
}

function SliderInput({ label, hint, value, min, max, step = 1, decimals = 0, suffix = '', onChange }: SliderInputProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-3">
        <div>
          <label className="text-[13px] font-medium text-ink block">{label}</label>
          {hint && <span className="text-[11px] text-muted-2">{hint}</span>}
        </div>
        <span className="text-[12.5px] font-mono font-semibold text-ink bg-bg-soft border border-line px-2.5 py-1 rounded-[8px] whitespace-nowrap">
          {num(value, decimals)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #2FB57A 0%, #4A52D0 ${percentage}%, #E5E4DE ${percentage}%, #E5E4DE 100%)`,
        }}
      />
      <div className="flex justify-between text-[10px] text-muted mt-1">
        <span>{num(min, decimals)}{suffix}</span>
        <span>{num(max, decimals)}{suffix}</span>
      </div>
    </div>
  );
}

/* ── O que muda em 01/10 (3 fatos) ──────────────────────────────────────── */
const FATOS = [
  {
    icon: MessageCircle,
    title: 'Resposta enviada passa a ser cobrada',
    desc: 'Hoje, responder dentro da janela de 24 horas é grátis. A partir de 1º de outubro, cada mensagem de resposta enviada custa cerca de R$ 0,035. A cobrança é da Meta, direto na sua conta com ela.',
  },
  {
    icon: Inbox,
    title: 'Mensagem recebida segue grátis',
    desc: 'Ouvir seu cliente não paga nada. A tarifa vale só para o que a sua empresa envia. Por isso eficiência virou dinheiro: resolver em menos mensagens é fatura menor.',
  },
  {
    icon: Wallet,
    title: 'Sua mensalidade ZappIQ não muda',
    desc: 'A tarifa da Meta passa a custo, sem markup. E antes de a cobrança começar, a plataforma ganha medidor de gasto por conversa e teto que você mesmo define.',
  },
];

/* ── Tradução por vertical ──────────────────────────────────────────────── */
const VERTICAIS = [
  {
    icon: Stethoscope,
    nome: 'Clínica',
    regra: '1 paciente de aparelho ≈ 3 atendimentos por mês',
    exemplo: '100 pacientes ativos ≈ 300 atendimentos/mês',
    conta: '300 atendimentos × 5,4 respostas × R$ 0,035',
    fatura: 'R$ 56,70/mês',
  },
  {
    icon: ShoppingCart,
    nome: 'E-commerce',
    regra: '1 pedido ≈ 0,6 a 0,8 atendimento (nem toda compra abre conversa)',
    exemplo: '1.000 pedidos/mês ≈ 600 a 800 atendimentos',
    conta: '600 a 800 atendimentos × 5,4 respostas × R$ 0,035',
    fatura: 'R$ 113,40 a R$ 151,20/mês',
  },
  {
    icon: Truck,
    nome: 'Distribuidora',
    regra: '1 cliente que compra toda semana ≈ 4,3 atendimentos por mês',
    exemplo: '100 clientes semanais ≈ 430 atendimentos/mês',
    conta: '430 atendimentos × 5,4 respostas × R$ 0,035',
    fatura: 'R$ 81,27/mês',
  },
];

/* ── FAQ da mudança (kit "Outubro sem susto", Peça 4) ───────────────────── */
const FAQ_ITEMS = [
  {
    q: 'O que muda no dia 1º de outubro?',
    a: 'A Meta passa a cobrar pelas mensagens de resposta no WhatsApp, que hoje são grátis dentro da janela de 24 horas. A referência é R$ 0,035 por mensagem enviada, com tabela final até 1º de setembro. Os preços da ZappIQ não mudam. O que aparece de novo é a fatura da Meta, e a plataforma ganha medidor e teto para ela não virar surpresa.',
  },
  {
    q: 'Quanto vou pagar à Meta?',
    a: 'Cerca de três centavos e meio por resposta enviada. Um exemplo com números redondos: uma padaria que conversa com 200 clientes no mês, com 5 respostas por conversa, envia 1.000 mensagens e paga R$ 35. Uma clínica com 400 conversas no mesmo padrão paga R$ 70. Mensagem recebida não é cobrada. Quando a tabela final sair, a gente refaz essa conta com você.',
  },
  {
    q: 'Por que eu preciso cadastrar um cartão na Meta?',
    a: 'Porque a cobrança é da Meta, direto com você, sem a ZappIQ no meio do dinheiro. Sem cartão cadastrado, o WhatsApp da sua empresa deixa de responder a partir de outubro. Um cuidado: país e moeda travam no primeiro cartão salvo. Escolha Brasil e BRL antes de salvar.',
  },
  {
    q: 'O que é um atendimento de IA?',
    a: 'Uma conversa completa entre um cliente e a Iza. Começa quando ele escreve e só se encerra depois de 72 horas sem novas mensagens. Dentro dela cabem as mensagens que a conversa pedir, contando uma vez só. Se o mesmo cliente voltar na outra semana, é um atendimento novo.',
  },
  {
    q: 'E se eu estourar o teto de gasto?',
    a: 'Nada cai no susto. Perto do limite você recebe aviso. Ao bater o teto, você decide com 1 clique se ele sobe ou se segura, com 48 horas de carência para escolher. Conversa aberta nunca é cortada no meio.',
  },
  {
    q: 'A ZappIQ ganha alguma coisa na tarifa da Meta?',
    a: 'Não. A tarifa passa a custo, sem markup, e nosso ganho é a mensalidade, e só. O extrato fica visível conversa por conversa, e dá para conferir o total contra o painel da própria Meta.',
  },
];

/* ── Componente principal ───────────────────────────────────────────────── */
export function OutubroSemSusto() {
  const [atendimentos, setAtendimentos] = useState(200);
  const [respostas, setRespostas] = useState(RESPOSTAS_DEFAULT);
  const [disparos, setDisparos] = useState(500);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  const conta = useMemo(() => {
    const mensagensServico = atendimentos * respostas;
    const custoServico = mensagensServico * TARIFA_SERVICO_BRL;
    const custoMarketing = disparos * TARIFA_MARKETING_BRL;
    return {
      mensagensServico: Math.round(mensagensServico),
      custoServico,
      custoMarketing,
      total: custoServico + custoMarketing,
    };
  }, [atendimentos, respostas, disparos]);

  return (
    <>
      {/* ─────────── 1. Hero ─────────── */}
      <section className="py-20 lg:py-24 bg-bg">
        <div className="zappiq-wrap">
          <div className="text-center max-w-3xl mx-auto">
            <span className="eyebrow">Outubro sem susto · a mudança de preço do WhatsApp</span>
            <h1 className="text-[40px] lg:text-[56px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mb-4">
              Em outubro a Meta muda o preço dela.{' '}
              <span className="text-grad">O seu não muda.</span>
            </h1>
            <p className="text-[16px] lg:text-[17px] text-muted leading-relaxed mb-3">
              A partir de 1º de outubro de 2026, a Meta passa a cobrar pelas respostas enviadas no
              WhatsApp. A mensalidade da ZappIQ continua a mesma: a tarifa é da Meta, vai direto na
              sua conta com ela, a custo, com medidor e teto de gasto dentro da plataforma.
            </p>
            <p className="text-[13px] text-muted mb-8">
              Zero markup, zero setup, zero surpresa. Nesta página você faz a conta da sua operação.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="#calculadora"
                className="inline-flex items-center gap-2 bg-ink text-white hover:bg-black px-6 py-3 rounded-[12px] text-[14px] font-medium transition-colors"
              >
                <Calculator size={16} /> Calcular minha fatura Meta
              </a>
              <Link
                href="/cadastro?utm_source=outubro_sem_susto"
                className="inline-flex items-center gap-2 border border-line text-ink hover:border-ink px-6 py-3 rounded-[12px] text-[14px] font-medium transition-colors"
              >
                Testar grátis por 14 dias <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── 2. O que muda em 01/10 ─────────── */}
      <section className="py-14 lg:py-16 bg-bg-soft">
        <div className="zappiq-wrap">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="eyebrow">O que muda em 1º de outubro</span>
            <h2 className="text-[28px] lg:text-[36px] font-medium text-ink leading-tight tracking-[-0.02em]">
              Três fatos, sem letra miúda.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {FATOS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card-soft bg-white p-7">
                <div className="w-10 h-10 rounded-[10px] bg-bg-soft border border-line flex items-center justify-center mb-4">
                  <Icon size={17} className="text-ink" />
                </div>
                <h3 className="text-[16px] font-medium text-ink tracking-tight mb-2">{title}</h3>
                <p className="text-[13px] text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── 3. Calculadora ─────────── */}
      <section id="calculadora" className="py-20 lg:py-24 bg-bg scroll-mt-24">
        <div className="zappiq-wrap">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="eyebrow">Calculadora · Outubro sem susto</span>
            <h2 className="text-[32px] lg:text-[44px] font-medium text-ink leading-[1.08] tracking-[-0.03em] mb-3">
              Quanto a sua operação vai pagar à Meta?
            </h2>
            <p className="text-[15px] text-muted leading-relaxed">
              Três números e a conta sai na hora, aqui no seu navegador. Nada é enviado a servidor
              nenhum.
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-6">
            {/* Inputs */}
            <div className="card-soft bg-white p-7 lg:p-8 space-y-7 h-fit">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[10px] bg-bg-soft border border-line flex items-center justify-center">
                  <Calculator size={16} className="text-ink" />
                </div>
                <h3 className="text-[17px] font-medium text-ink tracking-tight">Sua operação</h3>
              </div>

              <SliderInput
                label="Atendimentos por mês (estimativa)"
                hint="Conversas completas que a IA cuida no mês"
                value={atendimentos}
                min={0}
                max={3000}
                step={10}
                onChange={setAtendimentos}
              />
              <SliderInput
                label="Respostas por atendimento"
                hint="Média medida na base ZappIQ: 5,4"
                value={respostas}
                min={1}
                max={15}
                step={0.1}
                decimals={1}
                onChange={setRespostas}
              />
              <SliderInput
                label="Disparos de marketing por mês"
                hint="Mensagens de template de marketing enviadas"
                value={disparos}
                min={0}
                max={30000}
                step={100}
                onChange={setDisparos}
              />
            </div>

            {/* Resultado */}
            <div className="flex flex-col gap-4">
              <div className="card-soft bg-white p-7 lg:p-8">
                <h3 className="text-[13px] font-medium uppercase tracking-[0.12em] text-muted mb-5">
                  Fatura Meta estimada
                </h3>

                <div className="space-y-3 mb-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] text-muted">
                      Serviço: {num(conta.mensagensServico)} respostas × {brl(TARIFA_SERVICO_BRL)}
                    </span>
                    <span className="text-[15px] font-semibold text-ink whitespace-nowrap">
                      {brl(conta.custoServico)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] text-muted">
                      Marketing: {num(disparos)} disparos × {brl(TARIFA_MARKETING_BRL)}
                    </span>
                    <span className="text-[15px] font-semibold text-ink whitespace-nowrap">
                      {brl(conta.custoMarketing)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-line pt-4 flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium text-ink">Total por mês, para a Meta</span>
                  <span className="text-[30px] lg:text-[34px] font-semibold tracking-tight text-ink whitespace-nowrap">
                    {brl(conta.total)}
                  </span>
                </div>
                <p className="text-[11.5px] text-muted mt-2">
                  Pago por você direto à Meta, na sua conta. A ZappIQ repassa a custo, sem markup, e
                  mostra o extrato conversa por conversa. Mensagem recebida não é cobrada.
                </p>
              </div>

              {/* Aviso visível (não é asterisco): tarifas de referência */}
              <div className="rounded-[16px] border border-amber-300 bg-amber-50 p-5 flex items-start gap-3">
                <AlertTriangle size={17} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-amber-900 leading-relaxed">
                  <strong>Tarifas de referência de agosto/2026</strong> (serviço {brl(TARIFA_SERVICO_BRL)} e
                  marketing {brl(TARIFA_MARKETING_BRL)} por mensagem enviada). A tabela final da Meta
                  sai até 01/09/2026 e atualizamos esta página no mesmo dia.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── 4. Tradução por vertical ─────────── */}
      <section className="py-16 lg:py-20 bg-bg-soft">
        <div className="zappiq-wrap">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="eyebrow">A conta no seu setor</span>
            <h2 className="text-[28px] lg:text-[36px] font-medium text-ink leading-tight tracking-[-0.02em] mb-3">
              Quantos atendimentos a sua operação gera?
            </h2>
            <p className="text-[14px] text-muted leading-relaxed">
              Um atendimento é uma conversa inteira, com as mensagens que ela precisar. A tradução
              muda por setor: use estas réguas para estimar o seu número na calculadora.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {VERTICAIS.map(({ icon: Icon, nome, regra, exemplo, conta: contaVertical, fatura }) => (
              <div key={nome} className="card-soft bg-white p-7 flex flex-col">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-10 h-10 rounded-[10px] bg-bg-soft border border-line flex items-center justify-center">
                    <Icon size={17} className="text-ink" />
                  </div>
                  <h3 className="text-[16px] font-medium text-ink tracking-tight">{nome}</h3>
                </div>
                <p className="text-[13px] text-ink font-medium leading-snug mb-2">{regra}</p>
                <p className="text-[12.5px] text-muted leading-relaxed mb-4">{exemplo}</p>
                <div className="mt-auto border-t border-line pt-3.5">
                  <p className="text-[11px] text-muted-2 mb-1">{contaVertical}</p>
                  <p className="text-[15px] font-semibold text-ink">
                    Fatura Meta ≈ {fatura}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-[11.5px] text-muted-2 mt-6">
            Exemplos com 5,4 respostas por atendimento e tarifa de referência de agosto/2026, sem
            disparos de marketing.
          </p>
        </div>
      </section>

      {/* ─────────── 5. FAQ da mudança ─────────── */}
      <section className="py-16 lg:py-20 bg-bg">
        <div className="zappiq-wrap">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="eyebrow">Perguntas diretas, respostas diretas</span>
            <h2 className="text-[28px] lg:text-[36px] font-medium text-ink leading-tight tracking-[-0.02em]">
              FAQ da mudança
            </h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-3">
            {FAQ_ITEMS.map((item, i) => {
              const open = faqOpen === i;
              return (
                <div key={item.q} className="card-soft bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setFaqOpen(open ? null : i)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between gap-4 text-left px-6 py-[18px]"
                  >
                    <span className="text-[14.5px] font-medium text-ink leading-snug">
                      {i + 1}. {item.q}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`flex-shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {open && (
                    <p className="px-6 pb-5 text-[13.5px] text-muted leading-relaxed">{item.a}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────── 6. CTA trial ─────────── */}
      <section className="py-16 lg:py-20 bg-bg-soft">
        <div className="zappiq-wrap">
          <div
            className="max-w-4xl mx-auto rounded-[24px] p-10 lg:p-14 text-center text-white"
            style={{ background: '#0A0B12' }}
          >
            <h2 className="text-[28px] lg:text-[38px] font-medium leading-tight tracking-[-0.02em] mb-3">
              Quer ver essa conta rodando na sua operação de verdade?
            </h2>
            <p className="text-[14.5px] text-white/70 leading-relaxed max-w-2xl mx-auto mb-7">
              Mensalidade fixa por atendimento: cada conversa que a Iza cuida conta um, com mensagens
              à vontade dentro dela. A tarifa do WhatsApp vai a custo, na sua conta, com medidor e
              teto. Zero markup, zero setup, zero surpresa.
            </p>
            <Link
              href="/cadastro?utm_source=outubro_sem_susto"
              className="inline-flex items-center gap-2 bg-white text-ink hover:bg-white/90 px-7 py-3.5 rounded-[12px] text-[14.5px] font-medium transition-colors"
            >
              Testar grátis por 14 dias, sem cartão <ArrowRight size={15} />
            </Link>
            <p className="text-[11.5px] text-white/50 mt-4">
              Fair use de 12 respostas de IA por atendimento · sem fidelidade · cancelamento em 1 clique
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

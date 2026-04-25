'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * FAQ — Design V4 (Chatbase-style · Geist + gradient g→b→p)
 * --------------------------------------------------------------------------
 * 21 perguntas em 6 grupos: Onboarding · Trial · Voz Nativa · Tecnologia ·
 * LGPD · Planos · Iza. Filtro por grupo, accordion minimalista.
 * Purge V4: removido grupo "Garantia 60 dias" e todas referências "30 dias".
 * ══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PLAN_CONFIG, ADDONS } from '@zappiq/shared';

const BUSINESS_PRICE = PLAN_CONFIG.BUSINESS.priceMonthly!;
const ENTERPRISE_MIN = 9900;
const RADAR_360_PRICE = ADDONS.RADAR_360.priceMonthly!;
const EXTRA_BROADCASTS_PRICE = ADDONS.EXTRA_BROADCASTS.priceMonthly!;

type FaqItem = { q: string; a: string; group: string };

const FAQS: FaqItem[] = [
  // ─────────────────────────── Negócio ──────────────────────────────────
  {
    group: 'Negócio',
    q: 'Funciona pro meu setor?',
    a: 'Funciona em qualquer negócio que atende cliente por WhatsApp: clínicas (médica, odonto, estética), varejo, e-commerce, imobiliária, autoescola, serviços, salão, academia, escritório de advocacia, contabilidade, hotelaria, agência. A Iza aprende o seu negócio a partir dos SEUS documentos — não é um script genérico pronto.',
  },
  {
    group: 'Negócio',
    q: 'Preciso mudar meu número de WhatsApp?',
    a: 'Não. Você conecta o seu número atual — comercial ou pessoal de empresa — à plataforma via integração oficial com a Meta. O cliente continua te mandando mensagem no mesmo número de sempre. Seu número é seu, a gente só liga a IA nele.',
  },
  {
    group: 'Negócio',
    q: 'Quanto tempo até eu ver os primeiros resultados?',
    a: 'Nas primeiras 24 horas já vê: a Iza responde em segundos, não deixa cliente esperando, dispara agendamento na hora. Resultado em reais (mais venda, menos folha) costuma aparecer na 2ª a 4ª semana — quando o volume do trial vira padrão de operação.',
  },

  // ──────────────────────────── Onboarding ──────────────────────────────
  {
    group: 'Onboarding',
    q: 'Preciso de conhecimento técnico para usar o ZappIQ?',
    a: 'Não. A plataforma foi desenhada pra ser operada sem time de TI. Você sobe PDFs, cadastra pares de pergunta e resposta, conecta seu número WhatsApp e acompanha a prontidão da IA num score de 0 a 100 em tempo real.',
  },
  {
    group: 'Onboarding',
    q: 'O que é o Onboarding Zero?',
    a: 'É o modelo V4 que substitui o setup fee tradicional (R$ 3–8 mil) por um survey digital guiado, self-service, de 30 a 90 minutos. Você mesmo estrutura a base de conhecimento pela plataforma. Zero cobrança de implantação.',
  },
  {
    group: 'Onboarding',
    q: 'E se eu não conseguir terminar o survey sozinho?',
    a: 'Se em 7 dias você não concluir o survey, um consultor ZappIQ entra em contato por WhatsApp para destravar o que faltar. Sem custo adicional. Self-service por padrão, humano como fallback.',
  },
  {
    group: 'Onboarding',
    q: 'Em quanto tempo minha IA entra em produção?',
    a: 'Depende do volume de base de conhecimento. Operações simples (restaurante, clínica pequena) entram em produção no mesmo dia do survey. Operações complexas (varejo multi-SKU, serviços regulados) em 2 a 5 dias com revisão conjunta.',
  },

  // ───────────────────────────── Trial ──────────────────────────────────
  {
    group: 'Trial',
    q: 'Como funcionam os 14 dias grátis?',
    a: 'Você ativa a plataforma imediatamente e tem 14 dias para testar IA, voz, dashboards e fluxos sem pagar nada. Ao final do período, o dashboard te direciona a escolher a forma de pagamento para continuar (cartão, boleto ou Pix recorrente). Se não contratar, o acesso é suspenso sem multa.',
  },
  {
    group: 'Trial',
    q: 'Existe fidelidade contratual?',
    a: 'Não nos planos self-serve (Starter, Growth, Scale, Business). Assinatura mensal ou anual, cancelamento self-service, sem multa. No Enterprise oferecemos desconto para contratos de 24 ou 36 meses conforme volume negociado.',
  },
  {
    group: 'Trial',
    q: 'Como cancelo se quiser parar?',
    a: 'Um clique no dashboard. Você continua com acesso até o fim do ciclo já pago. Se estiver no trial de 14 dias, não há cobrança nenhuma — é só deixar o trial expirar ou cancelar pelo painel.',
  },
  {
    group: 'Trial',
    q: 'Posso trocar de plano durante o trial?',
    a: 'Sim. No dashboard você pode subir ou descer de tier a qualquer momento. O trial continua válido até completar 14 dias corridos a partir da ativação inicial, independente de upgrades.',
  },

  // ─────────────────────────── Voz Nativa ───────────────────────────────
  {
    group: 'Voz Nativa',
    q: 'A IA entende áudio que o cliente manda no WhatsApp?',
    a: 'Entende. Já vem em todos os planos, sem custo adicional. Cliente manda áudio de 30 segundos ou 2 minutos — a Iza transcreve em segundos, entende o que ele quer e responde na hora, em texto.',
  },
  {
    group: 'Voz Nativa',
    q: 'A IA consegue responder por áudio também?',
    a: 'Consegue, como add-on opcional. Dois preços: R$ 197/mês (voz padrão, até 30 min de áudio respondido/mês — ótimo pra saudações, confirmações e agendamentos) ou R$ 597/mês (voz premium com entonação natural quase humana, até 120 min/mês, e pode clonar a voz do seu atendente).',
  },
  {
    group: 'Voz Nativa',
    q: 'Qual a diferença entre voz padrão e premium?',
    a: 'A padrão é perfeita pro dia-a-dia — "Oi, seu agendamento tá confirmado pras 14h". Funciona bem e é barata. A premium tem entonação natural, quase humana, dá pra clonar a voz do seu atendente e ajustar a personalidade por canal. Indicada pra marcas que fazem da voz parte da experiência.',
  },
  {
    group: 'Voz Nativa',
    q: 'Posso ligar e desligar a voz quando quiser?',
    a: 'Pode. Um clique no painel liga, outro clique desliga. Sem ligar pro comercial, sem contrato novo. Você acompanha quantos minutos já foram consumidos em tempo real.',
  },

  // ─────────────────────────── Tecnologia ───────────────────────────────
  {
    group: 'Tecnologia',
    q: 'Como é a relação do ZappIQ com a Meta?',
    a: 'Conexão oficial, direta com o WhatsApp da Meta — sem atravessador. Isso significa resposta mais rápida pro seu cliente, custo repassado direto da tabela oficial e seu número continua sendo seu (a gente não é dono do seu WhatsApp, você é).',
  },
  {
    group: 'Tecnologia',
    q: 'Como funciona a IA do ZappIQ?',
    a: 'A Iza roda sobre a mesma IA de ponta que empresas Fortune 500 usam no mundo. A gente tem contrato que garante: seus dados nunca viram treino, não ficam armazenados lá fora e são isolados de qualquer outro cliente. Se um provedor cair, outro assume no automático — sua operação não para.',
  },
  {
    group: 'Tecnologia',
    q: 'Com quais empresas o ZappIQ divide operação?',
    a: 'A gente opera com parceiros de primeira linha: provedores globais de IA, Meta (pra infra do WhatsApp), Stripe (pra cobrança), AWS no Brasil (pra dados) e alguns serviços técnicos de apoio. A lista completa e atualizada fica em /legal/privacidade, seção 4 — seu jurídico pode conferir a qualquer momento.',
  },
  {
    group: 'Tecnologia',
    q: 'Onde meus dados ficam armazenados?',
    a: 'Banco primário em servidor brasileiro (AWS São Paulo). Quando precisamos consultar IA fora do país, isso acontece sob cláusulas contratuais padrão exigidas pela LGPD, apenas pra cada consulta — nada fica armazenado lá fora.',
  },

  // ───────────────────────────── LGPD ───────────────────────────────────
  {
    group: 'LGPD',
    q: 'Como exerço meus direitos LGPD (acesso, exclusão, correção)?',
    a: 'Autoatendimento em /legal/deletar-dados — você preenche um formulário e recebe um protocolo na hora. Prazo de resposta: 15 dias úteis (48h para planos Business e Enterprise com DPO direto). Fallback por e-mail em privacidade@zappiq.com.br.',
  },
  {
    group: 'LGPD',
    q: 'Quem é o DPO do ZappIQ?',
    a: 'Rodrigo Ghetti, Encarregado de Dados — contato direto em rodrigo.ghetti@zappiq.com.br. Resposta em 15 dias úteis (48h nos planos Business e Enterprise). Em caso de incidente crítico, notificamos autoridade e cliente em até 72 horas, como a LGPD exige.',
  },
  {
    group: 'LGPD',
    q: 'Meus dados são usados para treinar modelos de IA?',
    a: 'Não. Nem pela ZappIQ, nem pela Anthropic, nem pela OpenAI. Todos sob DPA com cláusula de não-treinamento. Inputs e outputs são efêmeros nas chamadas de IA.',
  },

  // ───────────────────────────── Planos ─────────────────────────────────
  {
    group: 'Planos',
    q: 'Qual a diferença entre Radar Insights e Radar 360°?',
    a: `Radar Insights é o painel de métricas que já vem em todos os planos — quantos atendimentos, conversões, tempo médio, etc. Radar 360° é o BI executivo: dashboards do jeito que você precisa, alertas quando algo foge do normal, previsão de vendas por IA, comparativo anônimo com o seu setor e exportação pro Power BI/Looker. Já vem incluso em Business e Enterprise; nos planos menores vira add-on opcional de R$ ${RADAR_360_PRICE}/mês.`,
  },
  {
    group: 'Planos',
    q: 'O que diferencia os planos Business e Enterprise?',
    a: `Business (R$ ${BUSINESS_PRICE.toLocaleString('pt-BR')}/mês) já vem com uptime 99,9% em contrato e crédito automático se cair, Radar 360° incluso, login único corporativo, contato direto com o DPO (resposta em 48h), gerente de conta dedicado, 20h por mês pra integrações customizadas e histórico de 24 meses. Enterprise (sob consulta, a partir de R$ ${ENTERPRISE_MIN.toLocaleString('pt-BR')}/mês) adiciona ambiente isolado só seu, time de monitoramento dedicado 24/7, 40h por mês pra integrações, histórico de até 5 anos e contratos sob medida.`,
  },
  {
    group: 'Planos',
    q: 'Quantas mensagens posso enviar em cada plano?',
    a: `Starter inclui 500 disparos por mês, Growth 5.000, Scale 20.000, Business 60.000 e Enterprise ilimitado. Precisou de mais? Pacote de 10 mil disparos extras por R$ ${EXTRA_BROADCASTS_PRICE}. A tarifa que a Meta cobra pelas conversas é repassada direto da tabela oficial dela — sem remarcação.`,
  },
  {
    group: 'Planos',
    q: 'Existe garantia de uptime no contrato?',
    a: 'Sim, a partir do plano Business. 99,9% de uptime escrito em contrato, com crédito automático de 10%, 25% ou 50% da mensalidade se cair além do combinado. Recuperação completa em até 4 horas. Relatório mensal público em status.zappiq.com.br. Starter, Growth e Scale rodam na mesma infra, mas sem SLA contratual (alvo interno de 99,5%).',
  },

  // ────────────────────────────── Iza ───────────────────────────────────
  {
    group: 'Iza',
    q: 'Quem é a Iza?',
    a: 'A Iza é a agente de IA oficial do ZappIQ — a própria ZappIQ rodando no ZappIQ. Ela atende no WhatsApp 24/7, responde dúvidas sobre produto, preço, trial e implementação, e escala para um humano quando não consegue resolver.',
  },
];

const GROUPS = Array.from(new Set(FAQS.map((f) => f.group)));

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>('Todas');

  const filtered = activeGroup === 'Todas' ? FAQS : FAQS.filter((f) => f.group === activeGroup);

  return (
    <section id="faq" className="py-20 lg:py-28 bg-bg-soft">
      <div className="zappiq-wrap max-w-4xl">
        <div className="text-center mb-10">
          <span className="eyebrow">FAQ</span>
          <h2 className="text-[40px] lg:text-[52px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mb-3">
            Perguntas{' '}
            <span className="text-grad">frequentes.</span>
          </h2>
          <p className="text-[16px] text-muted">
            {FAQS.length} perguntas organizadas por tema. Filtre por categoria ou veja todas.
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {['Todas', ...GROUPS].map((g) => (
            <button
              key={g}
              onClick={() => {
                setActiveGroup(g);
                setOpenIdx(null);
              }}
              className={`text-[12px] font-medium px-4 py-2 rounded-full transition-all border ${
                activeGroup === g
                  ? 'bg-ink text-white border-ink'
                  : 'bg-white text-muted border-line hover:border-accent hover:text-accent'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {filtered.map((faq, i) => (
            <div
              key={`${faq.group}-${i}`}
              className="bg-white rounded-[16px] border border-line overflow-hidden transition-colors hover:border-accent/30"
            >
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left"
                aria-expanded={openIdx === i}
              >
                <div className="pr-4">
                  <span className="text-[10.5px] font-semibold text-accent uppercase tracking-[0.12em]">
                    {faq.group}
                  </span>
                  <p className="text-[14.5px] font-medium text-ink mt-1 leading-snug tracking-tight">
                    {faq.q}
                  </p>
                </div>
                <ChevronDown
                  size={18}
                  className={`text-muted flex-shrink-0 transition-transform ${
                    openIdx === i ? 'rotate-180 text-accent' : ''
                  }`}
                />
              </button>
              {openIdx === i && (
                <div className="px-6 pb-5 -mt-1">
                  <p className="text-[13.5px] text-muted leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

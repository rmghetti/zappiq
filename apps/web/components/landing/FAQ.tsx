'use client';

/**
 * FAQ V3.2 — 25 perguntas
 * -----------------------
 * Ampliado para cobrir: Onboarding Zero, Voz Nativa, Garantia 60d, parceria
 * Meta reformulada, Iza, sub-processadores V3.2, DSR self-service.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PLAN_CONFIG, ADDONS } from '@zappiq/shared';

const BUSINESS_PRICE = PLAN_CONFIG.BUSINESS.priceMonthly!;
const ENTERPRISE_MIN = 9900;
const RADAR_360_PRICE = ADDONS.RADAR_360.priceMonthly!;
const EXTRA_BROADCASTS_PRICE = ADDONS.EXTRA_BROADCASTS.priceMonthly!;

type FaqItem = { q: string; a: string; group: string };

const FAQS: FaqItem[] = [
  // ----------------------------------------------------------------------
  // Onboarding e Primeiros Passos
  // ----------------------------------------------------------------------
  {
    group: 'Onboarding',
    q: 'Preciso de conhecimento técnico para usar o ZappIQ?',
    a: 'Não. A plataforma foi desenhada para operação não-técnica. Você sobe PDFs, cadastra pares de pergunta e resposta, conecta seu número WhatsApp e acompanha a prontidão da IA num score de 0 a 100.',
  },
  {
    group: 'Onboarding',
    q: 'O que é o Onboarding Zero?',
    a: 'É o modelo V3.2 que substitui o setup fee tradicional (R$ 3–8 mil) por um survey digital guiado, self-service, de 30 a 90 minutos. Você mesmo estrutura a base de conhecimento pela plataforma. Zero cobrança de implantação.',
  },
  {
    group: 'Onboarding',
    q: 'E se eu não conseguir terminar o survey sozinho?',
    a: 'Se em 7 dias você não concluir o survey, um consultor ZappIQ entra em contato por WhatsApp para destravar o que faltar. Sem custo adicional. É self-service por padrão, humano como fallback.',
  },
  {
    group: 'Onboarding',
    q: 'Em quanto tempo minha IA entra em produção?',
    a: 'Depende do volume de base de conhecimento. Operações simples (restaurante, clínica pequena) entram em produção no mesmo dia do survey. Operações complexas (varejo multi-SKU, serviços regulados) em 2 a 5 dias com revisão conjunta.',
  },

  // ----------------------------------------------------------------------
  // Garantia e Trial
  // ----------------------------------------------------------------------
  {
    group: 'Garantia',
    q: 'Como funciona a garantia de 60 dias?',
    a: 'Você tem 30 dias de trial grátis + 60 dias de garantia após assinar. Se em 60 dias a IA não bater os KPIs definidos no seu Acordo de Performance, devolvemos 100% do valor pago. Sem pergunta, sem burocracia.',
  },
  {
    group: 'Garantia',
    q: 'Quais KPIs são usados na garantia?',
    a: 'Os KPIs são definidos com você no survey de onboarding, por vertical. Exemplos típicos: tempo médio de resposta, taxa de resolução automática, taxa de agendamento concluído, NPS de primeiro contato. Tudo fica registrado no Acordo que você assina.',
  },
  {
    group: 'Garantia',
    q: 'Existe fidelidade contratual?',
    a: 'Não nos planos self-serve (Starter, Growth, Scale, Business). Assinatura mensal, cancelamento self-service, sem multa. No Enterprise oferecemos desconto para contratos de 24 ou 36 meses conforme volume negociado.',
  },
  {
    group: 'Garantia',
    q: 'Como cancelo se quiser parar?',
    a: 'Um clique no dashboard. Você continua com acesso até o fim do ciclo já pago. Se estiver no trial, cancelamento é imediato e sem cobrança.',
  },

  // ----------------------------------------------------------------------
  // Voz Nativa
  // ----------------------------------------------------------------------
  {
    group: 'Voz Nativa',
    q: 'A IA entende áudios de WhatsApp?',
    a: 'Sim, em todos os planos. Transcrição via Whisper (OpenAI), sem custo adicional. Cliente manda áudio, a IA entende e responde em texto.',
  },
  {
    group: 'Voz Nativa',
    q: 'A IA consegue responder por áudio?',
    a: 'Sim, via add-on opcional de voz outbound (TTS). Dois tiers: R$ 197/mês (voz padrão OpenAI, até 30 min/mês) ou R$ 597/mês (ElevenLabs premium, até 120 min/mês, opção de voz clonada).',
  },
  {
    group: 'Voz Nativa',
    q: 'Qual a diferença entre voz padrão e premium?',
    a: 'Padrão usa vozes sintéticas neutras em PT-BR, ótima para saudações, confirmações e agendamentos. Premium usa ElevenLabs com entonação natural, permite clonar a voz do atendente humano da marca e controle fino de personalidade por agente.',
  },
  {
    group: 'Voz Nativa',
    q: 'Posso ativar e desativar voz outbound quando quiser?',
    a: 'Sim, pelo dashboard. Ativação e desativação são self-service, sem contato com comercial. Consumo de minutos é exibido em tempo real.',
  },

  // ----------------------------------------------------------------------
  // Meta WhatsApp e Tecnologia
  // ----------------------------------------------------------------------
  {
    group: 'Tecnologia',
    q: 'O ZappIQ é BSP da Meta?',
    a: 'Não. Operamos sobre a infraestrutura oficial da WhatsApp Business Cloud API da Meta, sem intermediário BSP. Isso significa menor latência, custos repassados à tabela oficial da Meta e sem camadas de reempacotamento.',
  },
  {
    group: 'Tecnologia',
    q: 'Como funciona a IA do ZappIQ?',
    a: 'Usamos os modelos Claude (Anthropic) em produção — Claude Sonnet para resposta em tempo real e Claude Opus para tarefas complexas. A Anthropic opera sob DPA assinado: zero treinamento nos seus dados, retenção efêmera, isolamento por tenant.',
  },
  {
    group: 'Tecnologia',
    q: 'Quem são os sub-processadores do ZappIQ?',
    a: 'Anthropic (IA Claude), OpenAI (Whisper/TTS para voz), Meta (Cloud API), Cloudflare (CDN/webhooks), Stripe (pagamentos), Resend (e-mails transacionais), Supabase (banco de dados) e AWS sa-east-1 (infraestrutura). Lista completa e atualizada em /legal/privacidade §4.',
  },
  {
    group: 'Tecnologia',
    q: 'Onde meus dados ficam armazenados?',
    a: 'Banco primário em AWS São Paulo (sa-east-1). Transferências internacionais para Anthropic/OpenAI/Cloudflare acontecem sob Cláusulas Padrão (LGPD Art. 33 IV) para cada invocação de IA, sem persistência externa.',
  },

  // ----------------------------------------------------------------------
  // LGPD e Compliance
  // ----------------------------------------------------------------------
  {
    group: 'LGPD',
    q: 'Como exerço meus direitos LGPD (acesso, exclusão, correção)?',
    a: 'Autoatendimento em /legal/deletar-dados — você preenche um formulário e recebe um protocolo na hora. Prazo de resposta: 15 dias úteis (48h para planos Business e Enterprise com DPO direto). Fallback por e-mail em privacidade@zappiq.com.br.',
  },
  {
    group: 'LGPD',
    q: 'Quem é o DPO do ZappIQ?',
    a: 'Rodrigo Ghetti, Encarregado de Dados — contato direto em rodrigo.ghetti@zappiq.com.br. Atendimento em 15 dias úteis (48h nos planos Business e Enterprise). Em incidente de segurança, notificamos ANPD e controladores em até 72h (Art. 48).',
  },
  {
    group: 'LGPD',
    q: 'O ZappIQ é controlador ou operador dos meus dados?',
    a: 'Para os dados dos seus end-users WhatsApp, ZappIQ é operador (você, cliente contratante, é o controlador). Para seus dados de cadastro e faturamento, ZappIQ é controlador. Detalhe em /legal/privacidade §1.',
  },
  {
    group: 'LGPD',
    q: 'Meus dados são usados para treinar modelos de IA?',
    a: 'Não. Nem pela ZappIQ, nem pela Anthropic, nem pela OpenAI. Todos sob DPA com cláusula de não-treinamento. Inputs e outputs são efêmeros nas chamadas de IA.',
  },

  // ----------------------------------------------------------------------
  // Pricing e Planos
  // ----------------------------------------------------------------------
  {
    group: 'Planos',
    q: 'Qual a diferença entre Radar Insights e Radar 360°?',
    a: `Radar Insights é o módulo de analytics nativo (incluso em todos os planos) com métricas operacionais. Radar 360° é o BI conversacional premium — cohort analysis, previsão de pipeline por ML, benchmarking, alertas proativos, exportação Power BI/Looker. Incluso nos planos Business e Enterprise, add-on opcional de R$ ${RADAR_360_PRICE}/mês nos planos Starter, Growth e Scale.`,
  },
  {
    group: 'Planos',
    q: 'O que diferencia os planos Business e Enterprise?',
    a: `O plano Business (R$ ${BUSINESS_PRICE.toLocaleString('pt-BR')}/mês) já inclui SLA contratual 99,9% com créditos automáticos, Radar 360°, SSO SAML/OIDC, DPO contato direto (48h DSR), CSM dedicado, 20h/mês de integração customizada e retenção de logs de 24 meses. O Enterprise (sob consulta, a partir de R$ ${ENTERPRISE_MIN.toLocaleString('pt-BR')}/mês) adiciona infraestrutura isolada, SOC/NOC dedicado 24/7, 40h/mês de integração, retenção de logs até 5 anos e contratos customizados (MSA, DPA específicos).`,
  },
  {
    group: 'Planos',
    q: 'Quantas mensagens posso enviar em cada plano?',
    a: `Starter inclui 500 disparos/mês, Growth 5.000, Scale 20.000, Business 60.000 e Enterprise ilimitado. Pacotes adicionais de 10.000 disparos custam R$ ${EXTRA_BROADCASTS_PRICE}. Custos de conversação da Meta são cobrados à parte conforme tabela oficial da Cloud API.`,
  },
  {
    group: 'Planos',
    q: 'Existe SLA formal?',
    a: 'Sim, a partir do plano Business. 99,9% de uptime contratual com créditos automáticos de 10/25/50% conforme severidade. RPO 1h e RTO 4h documentados. Relatório mensal em status.zappiq.com.br. Starter, Growth e Scale têm disponibilidade best-effort com alvo interno de 99,5%.',
  },

  // ----------------------------------------------------------------------
  // Iza e dogfooding
  // ----------------------------------------------------------------------
  {
    group: 'Iza',
    q: 'Quem é a Iza?',
    a: 'A Iza é a agente de IA oficial do ZappIQ — a própria ZappIQ rodando no ZappIQ. Ela atende no WhatsApp 24/7, responde dúvidas sobre produto, preço, garantia e implementação, e escala para um humano quando não consegue resolver.',
  },
];

const GROUPS = Array.from(new Set(FAQS.map((f) => f.group)));

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>('Todas');

  const filtered = activeGroup === 'Todas' ? FAQS : FAQS.filter((f) => f.group === activeGroup);

  return (
    <section id="faq" className="py-20 lg:py-28 bg-[#F8FAF9]">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">FAQ</p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3">Perguntas frequentes</h2>
          <p className="text-gray-500 text-sm">25 perguntas organizadas por tema. Filtre por categoria ou veja todas.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {['Todas', ...GROUPS].map((g) => (
            <button
              key={g}
              onClick={() => {
                setActiveGroup(g);
                setOpenIdx(null);
              }}
              className={`text-xs font-semibold px-4 py-2 rounded-full transition-colors border ${
                activeGroup === g
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.map((faq, i) => (
            <div key={`${faq.group}-${i}`} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <div className="pr-4">
                  <span className="text-xs font-semibold text-primary-600 uppercase tracking-wide">{faq.group}</span>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{faq.q}</p>
                </div>
                <ChevronDown
                  size={18}
                  className={`text-gray-400 flex-shrink-0 transition-transform ${openIdx === i ? 'rotate-180' : ''}`}
                />
              </button>
              {openIdx === i && (
                <div className="px-6 pb-4">
                  <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PLAN_CONFIG, ADDONS } from '@zappiq/shared';

/** Preços derivados de planConfig.ts (single source of truth) */
const BUSINESS_PRICE = PLAN_CONFIG.BUSINESS.priceMonthly!;
const ENTERPRISE_MIN = 9900; // Enterprise sob consulta — baseline do modelo comercial
const RADAR_360_PRICE = ADDONS.RADAR_360.priceMonthly!;
const EXTRA_BROADCASTS_PRICE = ADDONS.EXTRA_BROADCASTS.priceMonthly!;

const FAQS = [
  { q: 'Preciso de conhecimento técnico para usar a ZappIQ?', a: 'Não. A plataforma foi projetada para ser usada por qualquer pessoa sem conhecimento de programação. O Forge Studio permite criar automações arrastando e soltando blocos.' },
  { q: 'A ZappIQ é parceira oficial da Meta?', a: 'Sim. Utilizamos a WhatsApp Business Cloud API oficial, garantindo segurança, estabilidade e conformidade com todas as políticas da Meta.' },
  { q: 'Como funciona a IA do Pulse AI?', a: 'O Pulse AI aprende com seus documentos (FAQs, catálogos, políticas) e responde perguntas dos clientes com linguagem natural. Ele também pode agendar consultas, gerar orçamentos e consultar pedidos.' },
  { q: 'Meus dados estão seguros e em conformidade com a LGPD?', a: 'Sim. A ZappIQ é 100% compatível com a LGPD (Lei 13.709/2018). Criptografia AES-256 em repouso e TLS 1.3 em trânsito, controle de acesso granular, logs de auditoria completos, portal de DSR para atender titulares e DPO disponível para contato. Veja detalhes em /lgpd.' },
  { q: 'Qual a diferença entre Radar Insights e Radar 360°?', a: `Radar Insights é o módulo de analytics nativo (incluso em todos os planos) com métricas operacionais. Radar 360° é o produto de BI conversacional premium — cohort analysis, previsão de pipeline por ML, benchmarking de mercado, alertas proativos e BI exportável para Power BI/Looker. Incluso nos planos Business e Enterprise, add-on opcional de R$ ${RADAR_360_PRICE}/mês nos planos Starter, Growth e Scale.` },
  { q: 'O que diferencia os planos Business e Enterprise?', a: `O plano Business (R$ ${BUSINESS_PRICE.toLocaleString('pt-BR')}/mês) já inclui SLA contratual 99,9% com créditos automáticos, Radar 360°, SSO SAML/OIDC, DPO contato direto, CSM dedicado, 20h/mês de integração customizada e retenção de logs de 24 meses. O Enterprise (sob consulta, a partir de R$ ${ENTERPRISE_MIN.toLocaleString('pt-BR')}/mês) adiciona infraestrutura isolada, SOC/NOC dedicado 24/7, 40h/mês de integração, retenção de logs até 5 anos e contratos customizados (MSA, DPA específicos).` },
  { q: 'Existe SLA formal?', a: 'Sim, a partir do plano Business. 99,9% de uptime contratual com créditos automáticos de 10%/25%/50% conforme severidade. RPO 1h e RTO 4h documentados. Relatório mensal público em status.zappiq.com.br. Planos Starter, Growth e Scale têm disponibilidade best-effort com alvo interno de 99,5%.' },
  { q: 'Posso migrar de outra plataforma?', a: 'Sim. Oferecemos importação de contatos via CSV e suporte na migração do seu número WhatsApp. A partir do Business incluímos migração assistida com arquiteto dedicado.' },
  { q: 'Quantas mensagens posso enviar?', a: `Depende do seu plano. Starter inclui 500 disparos/mês, Growth 5.000, Scale 20.000, Business 60.000 e Enterprise ilimitado. Pacotes adicionais de 10.000 disparos custam R$ ${EXTRA_BROADCASTS_PRICE} (custos de conversação Meta são cobrados à parte conforme tabela oficial).` },
  { q: 'O que acontece quando a IA não sabe responder?', a: 'O Pulse AI transfere automaticamente para um agente humano com um resumo completo da conversa, garantindo que o cliente não precise repetir informações.' },
  { q: 'Existe contrato de fidelidade?', a: 'Não nos planos self-serve (Starter, Growth, Scale, Business) — são mensais sem fidelidade, com desconto de até 20% no ciclo anual. No Enterprise, oferecemos descontos adicionais para contratos de 24/36 meses conforme volume negociado.' },
  { q: 'Como funciona o DPO?', a: 'Temos Encarregado de Dados designado, disponível no e-mail dpo@zappiq.com. Atendemos solicitações de titulares em até 15 dias (48h nos planos Business e Enterprise, com DPO como contato direto). Em incidente de segurança, notificamos ANPD e controladores em até 72h (Art. 48).' },
];

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 lg:py-28 bg-[#F8FAF9]">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">FAQ</p>
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900">Perguntas frequentes</h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left">
                <span className="text-sm font-semibold text-gray-900 pr-4">{faq.q}</span>
                <ChevronDown size={18} className={`text-gray-400 flex-shrink-0 transition-transform ${openIdx === i ? 'rotate-180' : ''}`} />
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

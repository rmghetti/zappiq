'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  { q: 'Preciso de conhecimento técnico para usar a ZappIQ?', a: 'Não. A plataforma foi projetada para ser usada por qualquer pessoa sem conhecimento de programação. O Forge Studio permite criar automações arrastando e soltando blocos.' },
  { q: 'A ZappIQ é parceira oficial da Meta?', a: 'Sim. Utilizamos a WhatsApp Business Cloud API oficial, garantindo segurança, estabilidade e conformidade com todas as políticas da Meta.' },
  { q: 'Como funciona a IA do Pulse AI?', a: 'O Pulse AI aprende com seus documentos (FAQs, catálogos, políticas) e responde perguntas dos clientes com linguagem natural. Ele também pode agendar consultas, gerar orçamentos e consultar pedidos.' },
  { q: 'Meus dados estão seguros e em conformidade com a LGPD?', a: 'Sim. A ZappIQ é 100% compatível com a LGPD (Lei 13.709/2018). Criptografia AES-256 em repouso e TLS 1.3 em trânsito, controle de acesso granular, logs de auditoria completos, portal de DSR para atender titulares e DPO disponível para contato. Veja detalhes em /lgpd.' },
  { q: 'Qual a diferença entre Radar Insights e Radar 360°?', a: 'Radar Insights é o módulo de analytics nativo (incluso em todos os planos) com métricas operacionais. Radar 360° é o produto de BI conversacional premium — cohort analysis, previsão de pipeline por ML, benchmarking de mercado, alertas proativos e BI exportável para Power BI/Looker. Incluso no Enterprise, add-on opcional (R$197–397/mês) nos demais planos.' },
  { q: 'O que diferencia o plano Enterprise?', a: 'SLA contratual 99,9% com créditos automáticos, Radar 360° incluído, SOC/NOC dedicado 24/7, Gerente de Sucesso dedicado, DPO contato direto, onboarding white-glove, integrações customizadas (40h/mês), infraestrutura isolada, retenção de logs até 5 anos. A partir de R$2.997/mês, customizado conforme volume.' },
  { q: 'Existe SLA formal?', a: 'Sim, no plano Enterprise. 99,9% de uptime contratual com créditos automáticos de 10%/25%/50% conforme severidade. RPO 1h e RTO 4h documentados. Relatório mensal público em status.zappiq.com.br. Planos Starter/Growth têm best effort; Scale tem 99,5% como alvo.' },
  { q: 'Posso migrar de outra plataforma?', a: 'Sim. Oferecemos importação de contatos via CSV e suporte na migração do seu número WhatsApp. No Enterprise, incluímos migração assistida com arquiteto dedicado.' },
  { q: 'Quantas mensagens posso enviar?', a: 'Depende do seu plano. O Starter inclui 500 disparos/mês, Growth 5.000, Scale 20.000 e Enterprise ilimitado. Disparos adicionais custam R$0,15 cada.' },
  { q: 'O que acontece quando a IA não sabe responder?', a: 'O Pulse AI transfere automaticamente para um agente humano com um resumo completo da conversa, garantindo que o cliente não precise repetir informações.' },
  { q: 'Existe contrato de fidelidade?', a: 'Não nos planos Starter, Growth e Scale — são mensais sem fidelidade. No Enterprise, oferecemos descontos de 15% (anual) e 25% (2 anos) para clientes que optam por contrato com prazo, mas não é obrigatório.' },
  { q: 'Como funciona o DPO?', a: 'Temos Encarregado de Dados designado, disponível no e-mail dpo@zappiq.com. Atendemos solicitações de titulares em até 15 dias (48h no Enterprise). Em incidente de segurança, notificamos ANPD e controladores em até 72h (Art. 48).' },
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

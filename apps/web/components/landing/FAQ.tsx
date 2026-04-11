'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  { q: 'Preciso de conhecimento técnico para usar a ZappIQ?', a: 'Não. A plataforma foi projetada para ser usada por qualquer pessoa sem conhecimento de programação. O Forge Studio permite criar automações arrastando e soltando blocos.' },
  { q: 'A ZappIQ é parceira oficial da Meta?', a: 'Sim. Utilizamos a WhatsApp Business Cloud API oficial, garantindo segurança, estabilidade e conformidade com todas as políticas da Meta.' },
  { q: 'Como funciona a IA do Pulse AI?', a: 'O Pulse AI aprende com seus documentos (FAQs, catálogos, políticas) e responde perguntas dos clientes com linguagem natural. Ele também pode agendar consultas, gerar orçamentos e consultar pedidos.' },
  { q: 'Meus dados estão seguros?', a: 'Absolutamente. A ZappIQ é 100% compatível com a LGPD. Dados criptografados em repouso e em trânsito, controle de acesso granular e logs de auditoria completos.' },
  { q: 'Posso migrar de outra plataforma?', a: 'Sim. Oferecemos importação de contatos via CSV e suporte na migração do seu número WhatsApp.' },
  { q: 'Quantas mensagens posso enviar?', a: 'Depende do seu plano. O Starter inclui 500 disparos/mês, Growth 5.000 e Scale 20.000. Disparos adicionais custam R$0,15 cada.' },
  { q: 'O que acontece quando a IA não sabe responder?', a: 'O Pulse AI transfere automaticamente para um agente humano com um resumo completo da conversa, garantindo que o cliente não precise repetir informações.' },
  { q: 'Existe contrato de fidelidade?', a: 'Não. Todos os planos são mensais sem fidelidade. Você pode cancelar, fazer upgrade ou downgrade a qualquer momento.' },
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

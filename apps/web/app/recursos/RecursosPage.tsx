'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, FileText, Calculator, ClipboardCheck, Download, X } from 'lucide-react';
import { PublicLayout } from '../../components/landing/PublicLayout';

/* ------------------------------------------------------------------ */
/* Dados dos recursos                                                  */
/* ------------------------------------------------------------------ */

const SEGMENTS = [
  'Academia', 'Dentista', 'Psicologo', 'Advogado', 'Nutricionista',
  'Salao de Beleza', 'Pet Shop', 'Imobiliaria', 'Restaurante', 'Escola',
  'Servicos Tecnicos', 'Clinica Medica', 'Contabilidade', 'Oficina Mecanica',
  'Agencia Digital', 'Loja / E-commerce',
];

type Resource = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
};

const RESOURCES: Resource[] = [
  {
    id: 'ebook',
    title: 'E-book: Guia Definitivo de Automacao WhatsApp para PMEs',
    description: '42 paginas com estrategias, metricas e passo a passo para automatizar o atendimento da sua empresa pelo WhatsApp Business.',
    icon: <BookOpen size={28} />,
    color: 'bg-primary-100 text-primary-600',
  },
  {
    id: 'template',
    title: 'Template: 10 Fluxos de Automacao Prontos para Usar',
    description: 'Fluxos de boas-vindas, qualificacao de leads, agendamento, follow-up e mais. Copie e cole no seu chatbot.',
    icon: <FileText size={28} />,
    color: 'bg-blue-100 text-blue-600',
  },
  {
    id: 'calculadora',
    title: 'Planilha: Calculadora de ROI para Chatbots',
    description: 'Calcule quanto sua empresa pode economizar e faturar a mais com automacao inteligente. Inclui benchmarks por segmento.',
    icon: <Calculator size={28} />,
    color: 'bg-amber-100 text-amber-600',
  },
  {
    id: 'checklist',
    title: 'Checklist: Migracao do WhatsApp App para API',
    description: 'Lista completa com 25 itens para migrar do WhatsApp Business App para a API oficial sem perder conversas.',
    icon: <ClipboardCheck size={28} />,
    color: 'bg-purple-100 text-purple-600',
  },
];

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */

export function RecursosPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', email: '', empresa: '', segmento: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  function openModal(resourceId: string) {
    setSelectedResource(resourceId);
    setModalOpen(true);
    setSubmitted(false);
    setErrors({});
    setForm({ nome: '', email: '', empresa: '', segmento: '' });
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedResource(null);
    setSubmitted(false);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = 'Nome e obrigatorio';
    if (!form.email.trim()) e.email = 'E-mail e obrigatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'E-mail invalido';
    if (!form.empresa.trim()) e.empresa = 'Empresa e obrigatoria';
    if (!form.segmento) e.segmento = 'Selecione um segmento';
    return e;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    /* PLACEHOLDER: substituir por dado real — enviar para backend / CRM */
    setSubmitted(true);
  }

  return (
    <PublicLayout>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 mb-16">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Recursos Gratuitos</p>
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-5">
            Materiais para acelerar sua automacao
          </h1>
          <p className="text-lg text-gray-500">
            E-books, templates, planilhas e checklists — tudo gratis. Baixe e comece a aplicar hoje.
          </p>
        </div>
      </div>

      {/* Resource cards */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 gap-8">
          {RESOURCES.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow flex flex-col">
              {/* Mockup image placeholder */}
              <div className="h-48 bg-gradient-to-br from-[#F8FAF9] to-gray-100 flex items-center justify-center">
                {/* PLACEHOLDER: substituir por dado real — imagem do material */}
                <div className={`w-16 h-16 rounded-2xl ${r.color} flex items-center justify-center`}>
                  {r.icon}
                </div>
              </div>

              <div className="p-6 flex flex-col flex-1">
                <h3 className="font-display text-lg font-bold text-gray-900 mb-2">{r.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-6 flex-1">{r.description}</p>
                <button
                  onClick={() => openModal(r.id)}
                  className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
                >
                  <Download size={16} /> Baixar Gratis
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />

          {/* Modal content */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 z-10">
            <button onClick={closeModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
              <X size={20} />
            </button>

            {submitted ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Download size={28} className="text-primary-600" />
                </div>
                <h3 className="font-display text-xl font-bold text-gray-900 mb-2">Material enviado!</h3>
                <p className="text-gray-500 text-sm">Verifique seu e-mail. O material chegara em instantes.</p>
                <button onClick={closeModal} className="mt-6 text-sm font-semibold text-primary-600 hover:text-primary-700">
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <h3 className="font-display text-xl font-bold text-gray-900 mb-1">Receber Material</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Preencha os dados abaixo e enviaremos o material para seu e-mail.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Nome */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                    <input
                      type="text"
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-colors ${errors.nome ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-primary-400'}`}
                      placeholder="Seu nome completo"
                    />
                    {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-colors ${errors.email ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-primary-400'}`}
                      placeholder="voce@empresa.com"
                    />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>

                  {/* Empresa */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Empresa *</label>
                    <input
                      type="text"
                      value={form.empresa}
                      onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                      className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-colors ${errors.empresa ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-primary-400'}`}
                      placeholder="Nome da empresa"
                    />
                    {errors.empresa && <p className="text-xs text-red-500 mt-1">{errors.empresa}</p>}
                  </div>

                  {/* Segmento */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Segmento *</label>
                    <select
                      value={form.segmento}
                      onChange={(e) => setForm({ ...form, segmento: e.target.value })}
                      className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-colors ${errors.segmento ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-primary-400'}`}
                    >
                      <option value="">Selecione seu segmento</option>
                      {SEGMENTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {errors.segmento && <p className="text-xs text-red-500 mt-1">{errors.segmento}</p>}
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                  >
                    Receber Material
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <section className="py-20 bg-[#1A1A2E]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-white mb-5">
            Quer ver na pratica?
          </h2>
          <p className="text-gray-400 mb-8">Alem dos materiais, teste o ZappIQ gratis por 14 dias.</p>
          {/* PLACEHOLDER: substituir por dado real */}
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg shadow-secondary-500/30 text-base"
          >
            Comecar Gratis <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}

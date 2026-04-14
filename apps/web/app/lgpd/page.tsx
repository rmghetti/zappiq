import Link from 'next/link';
import { PublicLayout } from '@/components/landing/PublicLayout';
import {
  Shield, Lock, FileCheck, Users, AlertTriangle, Clock,
  Server, Eye, Key, ArrowRight, Check, Mail
} from 'lucide-react';

export const metadata = {
  title: 'LGPD — Conformidade e Privacidade | ZappIQ',
  description: 'ZappIQ é 100% compatível com a Lei Geral de Proteção de Dados (LGPD). Saiba como protegemos os dados dos seus clientes e como atendemos a todas as obrigações legais.',
};

const LGPD_ARTICLES = [
  {
    art: 'Art. 6º',
    icon: Shield,
    title: 'Princípios de tratamento',
    desc: 'Finalidade, adequação, necessidade, livre acesso, qualidade dos dados, transparência, segurança, prevenção, não discriminação e responsabilização. Todos codificados na arquitetura — não só no termo de uso.',
  },
  {
    art: 'Art. 18',
    icon: Users,
    title: 'Direitos do titular (DSR)',
    desc: 'Confirmação, acesso, correção, anonimização, portabilidade, eliminação e revogação de consentimento. Atendemos em até 15 dias corridos (48h no plano Enterprise).',
  },
  {
    art: 'Art. 37',
    icon: FileCheck,
    title: 'Registro de Operações (ROP)',
    desc: 'Mantemos ROP auditável de todas as operações de tratamento — finalidade, bases legais, compartilhamentos, retenção, medidas de segurança. Disponibilizado a controladores sob solicitação.',
  },
  {
    art: 'Art. 46',
    icon: Lock,
    title: 'Segurança dos dados',
    desc: 'Criptografia AES-256 em repouso e TLS 1.3 em trânsito. Controle de acesso granular por função (RBAC). Isolamento multi-tenant com Row-Level Security. Auditoria completa de acessos.',
  },
  {
    art: 'Art. 48',
    icon: AlertTriangle,
    title: 'Notificação de incidente',
    desc: 'Em caso de incidente de segurança com risco aos titulares, notificamos a ANPD e controladores em até 72 horas. Runbook de incidente formalizado, testado trimestralmente.',
  },
  {
    art: 'Art. 41',
    icon: Mail,
    title: 'Encarregado (DPO)',
    desc: 'DPO designado e disponível para contato direto dos titulares e da ANPD. Plano Enterprise inclui SLA de resposta de 48h para o DPO.',
  },
];

const TECHNICAL_MEASURES = [
  { icon: Lock, title: 'Criptografia end-to-end', desc: 'AES-256 em repouso, TLS 1.3 em trânsito. Chaves gerenciadas em KMS.' },
  { icon: Eye, title: 'Auditoria completa', desc: 'Log de todos os acessos a dados pessoais, retido por até 5 anos no Enterprise.' },
  { icon: Key, title: 'Controle de acesso granular', desc: 'RBAC por função, MFA obrigatório para administradores, SSO no Enterprise.' },
  { icon: Server, title: 'Servidores no Brasil', desc: 'Infraestrutura em São Paulo (região gru). Dados não saem do território nacional.' },
  { icon: Shield, title: 'Isolamento multi-tenant', desc: 'Row-Level Security no banco + namespace isolation no motor de busca.' },
  { icon: Clock, title: 'Retenção configurável', desc: 'Políticas por tipo de dado. Tiers hot/warm/cold/delete documentados em ADR.' },
];

const CLIENT_RESPONSIBILITIES = [
  'Obter consentimento dos titulares antes de enviar mensagens (base legal ou dispensa adequada)',
  'Configurar corretamente finalidades e bases legais no painel ZappIQ',
  'Designar pessoa responsável interna pelo tratamento (pode ser DPO ou equivalente)',
  'Atender solicitações dos titulares recebidas via canais próprios',
  'Manter registros complementares de atividades de tratamento exclusivas da sua operação',
];

export default function LGPDPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-900 via-teal-900 to-gray-900 pt-20 pb-24 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(16,185,129,0.2),_transparent_50%)]" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-4 py-1.5 mb-6">
            <Shield size={14} className="text-emerald-300" />
            <span className="text-xs font-semibold text-emerald-200 uppercase tracking-wider">Conformidade LGPD</span>
          </div>
          <h1 className="font-display text-4xl lg:text-6xl font-extrabold mb-6 max-w-4xl leading-tight">
            LGPD não é um <span className="text-emerald-400">checkbox</span>.<br className="hidden sm:block" /> É a <span className="text-emerald-400">arquitetura</span>.
          </h1>
          <p className="text-lg lg:text-xl text-gray-300 max-w-3xl mb-8 leading-relaxed">
            ZappIQ é 100% compatível com a Lei Geral de Proteção de Dados (Lei 13.709/2018). Segurança, privacidade e conformidade estão no código — não no rodapé. Sua empresa ganha tranquilidade legal e credibilidade com clientes que exigem garantias.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="#o-que-e-lgpd"
              className="bg-emerald-500 text-white font-semibold px-7 py-4 rounded-xl hover:bg-emerald-400 transition-colors inline-flex items-center justify-center gap-2">
              Saiba o que é LGPD <ArrowRight size={18} />
            </Link>
            <Link href="mailto:dpo@zappiq.com"
              className="border border-white/20 text-white font-semibold px-7 py-4 rounded-xl hover:bg-white/5 transition-colors inline-flex items-center justify-center gap-2">
              <Mail size={16} /> Contato DPO
            </Link>
          </div>
        </div>
      </section>

      {/* O que é LGPD */}
      <section id="o-que-e-lgpd" className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="mb-12">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">O que é LGPD</p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-6">
              Em 3 minutos: o que sua empresa precisa saber
            </h2>
            <div className="space-y-5 text-gray-700 leading-relaxed">
              <p>
                A <strong>Lei Geral de Proteção de Dados (Lei 13.709/2018)</strong> é a legislação brasileira que regula como empresas coletam, armazenam, usam e compartilham dados pessoais. Entrou em vigor em setembro de 2020 e tem regulamentação pela ANPD (Autoridade Nacional de Proteção de Dados).
              </p>
              <p>
                Se a sua empresa lida com dados de clientes — nome, CPF, telefone, e-mail, preferências, histórico de compras —, a LGPD se aplica. <strong>Independente do porte</strong>, do setor ou se você é controladora ou operadora dos dados.
              </p>
              <p className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
                <strong className="text-amber-900">Multas podem chegar a R$ 50 milhões por infração</strong> ou 2% do faturamento anual (limitado a esse teto). Mais que a multa, o risco reputacional de um vazamento público pode ser muito maior.
              </p>
              <p>
                Quando sua empresa usa uma plataforma como ZappIQ, você se torna a <strong>controladora</strong> dos dados dos seus clientes, e a ZappIQ se torna a <strong>operadora</strong>. Isso significa que ambos têm obrigações — e que escolher um operador com conformidade sólida protege você do risco.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Como ZappIQ atende */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">Como ZappIQ atende</p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
              Artigo por artigo, em código
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Não é política escrita e esquecida. É funcionalidade que o produto entrega — e que sua equipe de compliance pode auditar.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {LGPD_ARTICLES.map((a) => (
              <div key={a.art} className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <a.icon size={22} className="text-white" />
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">{a.art}</span>
                </div>
                <h3 className="font-display font-bold text-gray-900 mb-2">{a.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Medidas técnicas */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">Medidas técnicas (Art. 46)</p>
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-gray-900 mb-4">
              Segurança documentada e auditável
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {TECHNICAL_MEASURES.map((m) => (
              <div key={m.title} className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <m.icon size={28} className="text-emerald-600 mb-4" />
                <h3 className="font-bold text-gray-900 mb-2">{m.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DSR Portal */}
      <section className="py-20 bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-white rounded-3xl p-8 lg:p-10 border border-emerald-200 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                <Users size={32} className="text-white" />
              </div>
              <div>
                <h2 className="font-display text-2xl lg:text-3xl font-extrabold text-gray-900 mb-3">
                  Portal do Titular (DSR)
                </h2>
                <p className="text-gray-600 leading-relaxed mb-5">
                  Todos os clientes ZappIQ têm um portal nativo para atender solicitações de titulares (Art. 18). Acesso, correção, portabilidade, anonimização, eliminação e revogação de consentimento — em fluxo auditável, com registro completo para compliance.
                </p>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Check size={16} className="text-emerald-600" /> SLA 15 dias (48h Enterprise)
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Check size={16} className="text-emerald-600" /> Registro auditável completo
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Check size={16} className="text-emerald-600" /> Anonimização por campo
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Check size={16} className="text-emerald-600" /> Export portável (JSON/CSV)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Responsabilidades */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">Divisão de responsabilidades</p>
              <h2 className="font-display text-2xl lg:text-3xl font-extrabold text-gray-900 mb-5">
                Nós somos operadores. Você é controlador.
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                A LGPD distingue as duas figuras (Art. 5º, VI e VII). Saber onde começa sua responsabilidade e onde termina a nossa é essencial para uma operação limpa.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Oferecemos um DPA (Data Processing Agreement) formal para clientes Enterprise, que documenta essa divisão e padrão de tratamento.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <h3 className="font-display font-bold text-amber-900 mb-5 flex items-center gap-2">
                <AlertTriangle size={20} /> Sua responsabilidade como controladora
              </h3>
              <ul className="space-y-3">
                {CLIENT_RESPONSIBILITIES.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-amber-900">
                    <Check size={14} className="flex-shrink-0 mt-1" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA DPO */}
      <section className="py-20 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Mail size={40} className="mx-auto mb-5 text-emerald-400" />
          <h2 className="font-display text-3xl lg:text-4xl font-extrabold mb-5">
            Precisa falar com nosso DPO?
          </h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            O Encarregado de Dados da ZappIQ está disponível para titulares, clientes e ANPD. Resposta em até 15 dias corridos (48h Enterprise). Incidentes reportados em até 72h conforme Art. 48.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="mailto:dpo@zappiq.com"
              className="bg-emerald-500 text-white font-semibold px-7 py-4 rounded-xl hover:bg-emerald-400 transition-colors inline-flex items-center justify-center gap-2">
              <Mail size={18} /> dpo@zappiq.com
            </a>
            <Link href="/enterprise"
              className="border border-white/20 text-white font-semibold px-7 py-4 rounded-xl hover:bg-white/5 transition-colors inline-flex items-center justify-center gap-2">
              Ver plano Enterprise
            </Link>
          </div>
          <p className="text-xs text-gray-500 mt-6">
            Documentos como ROP, DPA e relatório de auditoria disponíveis sob NDA para clientes Enterprise.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}

'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * ConectarWhatsApp — Design V4 (Chatbase-style · Geist + gradient g→b→p)
 * --------------------------------------------------------------------------
 * Página educacional de pré-cadastro: explica WhatsApp Cloud API, pré-reqs,
 * 3 caminhos de onboarding, tutorial passo-a-passo, FAQ específico, vídeo
 * institucional, CTAs duplos (cadastro + agendar onboarding).
 *
 * Conteúdo extraído de ZappIQ_Guia_WhatsApp_Cloud_API_v1.docx.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown, ArrowRight, Calendar, Rocket, MessageCircle,
  CheckCircle2, XCircle, AlertTriangle, Zap, Users, Wrench,
  ShieldCheck, Smartphone, Building2, FileCheck, Clock,
} from 'lucide-react';

// ─── 3 produtos WhatsApp · comparativo ─────────────────────────────
const PRODUTOS = [
  {
    nome: 'WhatsApp',
    sub: '(app verde escuro)',
    desc: 'Uso pessoal. Sem automação, sem API.',
    works: false,
    bullets: ['Conversas individuais', 'Sem integração', 'Não conecta ZappIQ'],
  },
  {
    nome: 'WhatsApp Business',
    sub: '(app verde claro)',
    desc: 'Microempresas. Atendimento manual no celular.',
    works: false,
    bullets: ['Catálogo + etiquetas', 'Mensagens automáticas básicas', 'Não conecta ZappIQ'],
  },
  {
    nome: 'WhatsApp Cloud API',
    sub: '(Meta for Business)',
    desc: 'Plataforma profissional oficial Meta. É o que ZappIQ usa.',
    works: true,
    bullets: ['Automação ilimitada', 'IA + voz natural pt-BR', 'Conecta ZappIQ ✓'],
  },
];

// ─── 3 caminhos de onboarding ──────────────────────────────────────
const CAMINHOS = [
  {
    icon: Users,
    badge: 'Recomendado · 80% dos clientes',
    nome: 'Onboarding Assistido',
    desc: 'Especialista ZappIQ faz o setup com você em videochamada de 30-60 min. Tela compartilhada, zero dor de cabeça técnica.',
    bullets: [
      'Agendamento online via Google Calendar',
      'Configura Business Manager + Verificação Meta',
      'Liga seu número e cria o agente IA',
      'Primeiro teste real ao vivo',
    ],
    cta: { label: 'Agendar agora', href: '/agendar' },
    color: 'gradient',
  },
  {
    icon: Zap,
    badge: '15% dos clientes',
    nome: 'Embedded Signup',
    desc: 'Self-service guiado pelo painel oficial Meta dentro da ZappIQ. UX similar a "Login com Google" — sem token, sem código.',
    bullets: [
      'Conexão em 20-40 minutos no seu ritmo',
      'Popup oficial Meta dentro da ZappIQ',
      'Sem termo técnico exposto',
      'Suporte sob demanda',
    ],
    cta: { label: 'Começar agora', href: '/cadastro' },
    color: 'border',
  },
  {
    icon: Wrench,
    badge: '5% dos clientes · técnicos',
    nome: 'Setup Manual',
    desc: 'Para times de TI que precisam de controle total: Permanent Access Token, multi-WABA, integrações customizadas.',
    bullets: [
      'Meta Developer Platform direto',
      'Permanent Access Token + System User',
      'Configuração de webhooks customizada',
      'Documentação técnica completa',
    ],
    cta: { label: 'Ver documentação', href: '/contato' },
    color: 'border',
  },
];

// ─── Pré-requisitos · checklist visual ─────────────────────────────
const PRE_REQS = [
  { icon: Building2, title: 'CNPJ ativo', desc: 'MEI, ME, EPP, LTDA, SA — qualquer formato regular. Pessoa física pura não pode (restrição Meta). Não tem? Abra MEI grátis em 15 min no Portal do Empreendedor.' },
  { icon: FileCheck, title: 'Documentos da empresa', desc: 'Cartão CNPJ atualizado, contrato social, comprovante de endereço em nome da empresa, RG/CNH do sócio responsável.' },
  { icon: Smartphone, title: 'Número dedicado', desc: 'Pode ser celular, fixo ou linha empresarial — mas não pode estar simultaneamente no WhatsApp comum ou Business app. Recomendamos chip novo só pro bot.' },
  { icon: ShieldCheck, title: 'Conta Facebook', desc: 'Pessoal ou corporativa. Usada só na autenticação inicial — quem fica com acesso é a ZappIQ via token oficial.' },
  { icon: MessageCircle, title: 'E-mail corporativo', desc: 'Idealmente no domínio da empresa. Recebe notificações Meta, alertas de qualidade e códigos 2FA. Use alias compartilhado se possível.' },
  { icon: Clock, title: '1 a 15 dias úteis', desc: 'Tempo total até estar 100% no ar. Tempo ATIVO seu: 30-60 min. O resto é espera por aprovação Meta — você pode preparar o bot enquanto isso.' },
];

// ─── Tutorial passo a passo · Caminho A (Assistido) ────────────────
const PASSOS_ASSISTIDO = [
  { n: 1, title: 'Cadastro inicial', time: '5 min', desc: 'Preencha o formulário em /cadastro: nome, e-mail, CNPJ, plano. Confirma o e-mail clicando no link.' },
  { n: 2, title: 'Agende a call', time: '3 min', desc: 'Calendário Google Calendar integrado. Veja horários reais do CSM, escolha o melhor para você nas próximas 24-72h.' },
  { n: 3, title: 'Reunião de onboarding', time: '30-60 min', desc: 'Especialista faz tela compartilhada e configura: Business Manager Meta, Verificação de Negócio, vinculação do número, criação do agente IA, primeiro teste real.' },
  { n: 4, title: 'Espera Meta', time: '1-15 dias úteis', desc: 'Verificação de Negócio + Display Name aprovados em paralelo. Você usa esse tempo pra preparar conteúdo e treinar o bot.' },
  { n: 5, title: 'Ativação ao vivo', time: '30 min', desc: 'Call complementar com especialista: liga o bot oficialmente, valida 5-10 conversas, ajusta tom e fluxos, configura handoff humano.' },
];

// ─── FAQ específico WhatsApp Cloud API ─────────────────────────────
const FAQ_WHATSAPP = [
  {
    q: 'Vou perder meu WhatsApp comum no celular se conectar à ZappIQ?',
    a: 'Sim, no número que for usado pelo bot. Por isso recomendamos número dedicado novo (chip pré-pago em nome da empresa). Se for migrar o número que você usa hoje, o WhatsApp pessoal/Business nele será desativado durante a migração para Cloud API.',
  },
  {
    q: 'Sou pessoa física sem CNPJ. Posso usar a ZappIQ?',
    a: 'A Cloud API exige CNPJ — restrição da Meta, não da ZappIQ. Saída prática: abra MEI grátis no Portal do Empreendedor (gov.br/empresas-e-negocios), leva 15 minutos. Aí você cadastra normalmente.',
  },
  {
    q: 'Já uso WhatsApp Business app na empresa, posso migrar?',
    a: 'Pode. Mas o histórico de conversas anteriores não é trazido para a Cloud API — perde do ponto de vista do bot, ainda que clientes tenham no celular deles. Recomendamos exportar conversas críticas via "Exportar conversa" antes de migrar.',
  },
  {
    q: 'Quanto tempo demora a Verificação de Negócio Meta?',
    a: 'Tipicamente 1-7 dias úteis. Em casos raros vai a 15. A maior causa de demora é divergência entre dados digitados e documentos enviados — nosso time confere tudo na call de onboarding antes de submeter.',
  },
  {
    q: 'Quanto a Meta cobra por mês?',
    a: 'A Meta cobra por "conversa" (janela de 24h). Pequena loja com atendimento reativo: R$ 30-80/mês. PME com vendas ativas: R$ 200-500/mês. Operação grande com marketing pesado: R$ 1.500-4.000/mês. ZappIQ não marca up — você paga Meta direto, com dashboard de gasto em tempo real.',
  },
  {
    q: 'Posso ter mais de um número conectado?',
    a: 'Sim. Starter aceita 1 número. Growth: 2. Scale: 5. Business: 15. Enterprise: ilimitado. Cada número é gerenciado independentemente — fluxos, agentes e relatórios separados.',
  },
  {
    q: 'A IA da ZappIQ é GPT? Gemini?',
    a: 'Usamos orquestração proprietária com múltiplos modelos de ponta. Para cada interação escolhemos automaticamente o modelo mais eficiente em qualidade e custo. Você não precisa escolher — fica tudo abstraído no painel.',
  },
  {
    q: 'Os dados ficam seguros?',
    a: 'Sim. Servidores no Brasil (AWS São Paulo), criptografia TLS 1.3 em trânsito, AES-256 em repouso. Conformidade LGPD com DPA padrão. Sem reuso para treinar modelos. ISO 27001 em processo de certificação.',
  },
];

// ═══════════════════════════════════════════════════════════════════
export function ConectarWhatsApp() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activePasso, setActivePasso] = useState<number>(1);

  return (
    <main>
      {/* ═══ HERO ═══════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(80% 60% at 50% 0%, rgba(47,181,122,.08) 0%, rgba(74,82,208,.06) 45%, transparent 80%)',
          }}
        />
        <div className="zappiq-wrap max-w-5xl text-center">
          <span className="eyebrow">Guia completo · WhatsApp Cloud API</span>
          <h1 className="text-[44px] lg:text-[68px] font-medium text-ink leading-[1.02] tracking-[-0.035em] mt-4 mb-6">
            Como conectar seu{' '}
            <span className="text-grad">WhatsApp à ZappIQ.</span>
          </h1>
          <p className="text-[18px] lg:text-[20px] text-muted leading-relaxed max-w-3xl mx-auto mb-10">
            Tutorial completo, sem jargão. Pré-requisitos, 3 caminhos de onboarding,
            FAQ e tudo o que você precisa saber antes de começar — em um só lugar.
            Tempo de leitura: 8 minutos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link
              href="/cadastro"
              className="inline-flex items-center gap-2 bg-ink text-white px-8 py-4 rounded-[14px] font-medium hover:opacity-90 transition-all"
            >
              <Rocket size={18} />
              Começar trial 14 dias grátis
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/agendar"
              className="inline-flex items-center gap-2 bg-white text-ink border border-line px-8 py-4 rounded-[14px] font-medium hover:border-accent hover:text-accent transition-all"
            >
              <Calendar size={18} />
              Agendar conversa de 30 min
            </Link>
          </div>
          <p className="text-[12.5px] text-muted-2 mt-5">
            Sem cartão de crédito · Cancela quando quiser · Sem taxa de setup
          </p>
        </div>
      </section>

      {/* ═══ VÍDEO INSTITUCIONAL (slot) ═════════════════════════════ */}
      <section className="py-16 lg:py-20 bg-bg-soft">
        <div className="zappiq-wrap max-w-4xl">
          <div className="text-center mb-8">
            <span className="eyebrow">Vídeo · 3 minutos</span>
            <h2 className="text-[32px] lg:text-[40px] font-medium text-ink leading-tight tracking-[-0.03em] mt-3">
              Veja como funciona, na prática.
            </h2>
          </div>
          <div
            className="relative rounded-[24px] overflow-hidden border border-line bg-white aspect-video flex items-center justify-center"
            style={{ background: 'var(--grad-soft)' }}
          >
            <div className="text-center px-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-[var(--shadow-card)] mb-4">
                <div
                  className="w-0 h-0 border-l-[18px] border-l-accent border-y-[12px] border-y-transparent ml-2"
                  aria-hidden
                />
              </div>
              <p className="text-[14px] text-muted">
                Vídeo institucional será inserido aqui em breve.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 3 PRODUTOS WHATSAPP · COMPARATIVO ═════════════════════ */}
      <section className="py-20 lg:py-28">
        <div className="zappiq-wrap max-w-6xl">
          <div className="text-center mb-12">
            <span className="eyebrow">Diferenças que mudam tudo</span>
            <h2 className="text-[36px] lg:text-[48px] font-medium text-ink leading-[1.08] tracking-[-0.03em] mt-3 mb-4">
              Existem <span className="text-grad">3 WhatsApps</span> diferentes.
            </h2>
            <p className="text-[16px] text-muted max-w-2xl mx-auto">
              A confusão entre eles é a causa #1 de frustração no onboarding.
              Aqui está, em 30 segundos, qual é qual.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {PRODUTOS.map((p) => (
              <div
                key={p.nome}
                className={`relative rounded-[20px] p-7 border transition-all ${
                  p.works
                    ? 'border-accent bg-white shadow-[var(--shadow-card)]'
                    : 'border-line bg-bg-soft'
                }`}
              >
                {p.works && (
                  <span className="absolute -top-3 left-7 inline-flex items-center gap-1 bg-ink text-white text-[10.5px] font-semibold px-3 py-1 rounded-full">
                    USADO PELA ZAPPIQ
                  </span>
                )}
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-[18px] font-semibold text-ink">{p.nome}</h3>
                  {p.works ? (
                    <CheckCircle2 size={22} className="text-[#2FB57A] flex-shrink-0" />
                  ) : (
                    <XCircle size={22} className="text-muted-2 flex-shrink-0" />
                  )}
                </div>
                <p className="text-[12px] text-muted mb-3">{p.sub}</p>
                <p className="text-[14px] text-ink-2 mb-4 leading-relaxed">{p.desc}</p>
                <ul className="space-y-2">
                  {p.bullets.map((b, i) => (
                    <li key={i} className="text-[13px] text-muted flex items-start gap-2">
                      <span className="text-accent mt-1">·</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div
            className="mt-10 rounded-[16px] border-l-[4px] border-l-[#DC2626] bg-[#FEE2E2]/50 px-5 py-4 max-w-3xl mx-auto"
          >
            <p className="text-[13.5px] text-ink-2 leading-relaxed">
              <strong className="text-[#DC2626]">REGRA INVIOLÁVEL:</strong> um número de telefone só pode estar
              em UM dos três produtos ao mesmo tempo. Migrar de um para outro implica
              deletar a conta no anterior. Recomendação: número dedicado novo (chip pré-pago).
            </p>
          </div>
        </div>
      </section>

      {/* ═══ PRÉ-REQUISITOS · CHECKLIST VISUAL ══════════════════════ */}
      <section className="py-20 lg:py-28 bg-bg-soft">
        <div className="zappiq-wrap max-w-5xl">
          <div className="text-center mb-12">
            <span className="eyebrow">Antes de começar</span>
            <h2 className="text-[36px] lg:text-[48px] font-medium text-ink leading-[1.08] tracking-[-0.03em] mt-3 mb-4">
              O que você precisa <span className="text-grad">ter em mãos.</span>
            </h2>
            <p className="text-[16px] text-muted max-w-2xl mx-auto">
              Checklist completo. Quanto mais preparado na largada, mais rápido seu bot entra ao vivo.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {PRE_REQS.map((r) => (
              <div
                key={r.title}
                className="bg-white rounded-[16px] border border-line p-6 hover:border-accent/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-11 h-11 rounded-[12px] bg-accent-soft flex items-center justify-center">
                    <r.icon size={20} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-semibold text-ink mb-1.5">{r.title}</h3>
                    <p className="text-[13.5px] text-muted leading-relaxed">{r.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3 CAMINHOS DE ONBOARDING ══════════════════════════════ */}
      <section className="py-20 lg:py-28">
        <div className="zappiq-wrap max-w-6xl">
          <div className="text-center mb-12">
            <span className="eyebrow">3 caminhos · escolha o seu</span>
            <h2 className="text-[36px] lg:text-[48px] font-medium text-ink leading-[1.08] tracking-[-0.03em] mt-3 mb-4">
              Conexão do seu jeito, <span className="text-grad">no seu ritmo.</span>
            </h2>
            <p className="text-[16px] text-muted max-w-2xl mx-auto">
              Não existe "o melhor" — existe o que serve melhor pro seu perfil.
              Recomendamos o assistido pra grande maioria.
            </p>
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            {CAMINHOS.map((cam) => (
              <div
                key={cam.nome}
                className={`relative rounded-[20px] p-7 transition-all flex flex-col ${
                  cam.color === 'gradient'
                    ? 'bg-white border-2 border-accent shadow-[var(--shadow-card)]'
                    : 'bg-white border border-line'
                }`}
              >
                <span
                  className={`text-[10.5px] font-semibold px-3 py-1 rounded-full uppercase tracking-[0.1em] mb-4 self-start ${
                    cam.color === 'gradient'
                      ? 'bg-ink text-white'
                      : 'bg-bg-soft text-muted border border-line'
                  }`}
                >
                  {cam.badge}
                </span>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-[12px] bg-accent-soft flex items-center justify-center">
                    <cam.icon size={20} className="text-accent" />
                  </div>
                  <h3 className="text-[20px] font-semibold text-ink">{cam.nome}</h3>
                </div>
                <p className="text-[14px] text-muted leading-relaxed mb-5">{cam.desc}</p>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {cam.bullets.map((b, i) => (
                    <li key={i} className="text-[13.5px] text-ink-2 flex items-start gap-2">
                      <CheckCircle2 size={15} className="text-[#2FB57A] mt-0.5 flex-shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Link
                  href={cam.cta.href}
                  className={`inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-[12px] font-medium text-[14px] transition-all ${
                    cam.color === 'gradient'
                      ? 'bg-ink text-white hover:opacity-90'
                      : 'bg-bg-soft text-ink border border-line hover:border-accent hover:text-accent'
                  }`}
                >
                  {cam.cta.label}
                  <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TUTORIAL PASSO A PASSO · CAMINHO A ════════════════════ */}
      <section className="py-20 lg:py-28 bg-bg-soft">
        <div className="zappiq-wrap max-w-5xl">
          <div className="text-center mb-12">
            <span className="eyebrow">Tutorial · Caminho Assistido</span>
            <h2 className="text-[36px] lg:text-[48px] font-medium text-ink leading-[1.08] tracking-[-0.03em] mt-3 mb-4">
              5 passos até <span className="text-grad">estar no ar.</span>
            </h2>
            <p className="text-[16px] text-muted max-w-2xl mx-auto">
              Fluxo recomendado pra quem prefere zero dor de cabeça técnica.
              Tempo total: 1 a 15 dias (a maior parte é espera Meta — você não trabalha).
            </p>
          </div>
          <div className="space-y-3">
            {PASSOS_ASSISTIDO.map((p) => (
              <button
                key={p.n}
                onClick={() => setActivePasso(activePasso === p.n ? -1 : p.n)}
                className={`w-full text-left bg-white rounded-[16px] border transition-all overflow-hidden ${
                  activePasso === p.n ? 'border-accent shadow-[var(--shadow-card)]' : 'border-line hover:border-accent/30'
                }`}
              >
                <div className="px-6 py-5 flex items-start gap-5">
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded-[14px] flex items-center justify-center font-semibold text-[18px] ${
                      activePasso === p.n ? 'bg-ink text-white' : 'bg-bg-soft text-muted'
                    }`}
                  >
                    {p.n}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <h3 className="text-[16px] font-semibold text-ink">{p.title}</h3>
                      <span className="text-[11.5px] text-muted bg-bg-soft px-2.5 py-1 rounded-full whitespace-nowrap">
                        {p.time}
                      </span>
                    </div>
                    {activePasso === p.n && (
                      <p className="text-[14px] text-muted leading-relaxed mt-2">{p.desc}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/agendar"
              className="inline-flex items-center gap-2 bg-ink text-white px-7 py-3.5 rounded-[14px] font-medium text-[14.5px] hover:opacity-90 transition-all"
            >
              <Calendar size={16} />
              Agendar minha onboarding agora
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ LIMITAÇÕES · O QUE NÃO DÁ PRA FAZER ═══════════════════ */}
      <section className="py-20 lg:py-28">
        <div className="zappiq-wrap max-w-5xl">
          <div className="text-center mb-12">
            <span className="eyebrow">Honestidade · sem letra miúda</span>
            <h2 className="text-[36px] lg:text-[48px] font-medium text-ink leading-[1.08] tracking-[-0.03em] mt-3 mb-4">
              O que você <span className="text-grad">não pode fazer.</span>
            </h2>
            <p className="text-[16px] text-muted max-w-2xl mx-auto">
              Restrições da Cloud API que você precisa saber antes — não depois.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { t: 'Mesmo número em apps diferentes', d: 'Cloud API e WhatsApp Business app não coexistem no mesmo número. Migrar implica deletar a conta no app anterior.' },
              { t: 'Histórico migrado automaticamente', d: 'Conversas anteriores do WhatsApp Business app não são trazidas. Exporte conversas críticas via "Exportar conversa" antes de migrar.' },
              { t: 'Mensagem espontânea após 24h', d: 'Você só pode enviar mensagem para um cliente DENTRO de 24h após ele ter te mandado mensagem. Após 24h, só Templates aprovados (utility, marketing, auth).' },
              { t: 'Disparo em massa para listas frias', d: 'Meta bloqueia números que recebem muitos reports de spam. Disparo só para opt-in documentado, com opção fácil de opt-out.' },
              { t: 'Conteúdo proibido pela Meta', d: 'Conteúdo adulto, drogas (exceto farmácia), armas, apostas em regiões ilegais, conteúdo enganoso. Quebra de termos = bloqueio.' },
            ].map((item) => (
              <div key={item.t} className="bg-white rounded-[16px] border border-line p-5 flex items-start gap-4">
                <AlertTriangle size={18} className="text-[#F59E0B] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-[15px] font-semibold text-ink mb-1.5">{item.t}</h3>
                  <p className="text-[13.5px] text-muted leading-relaxed">{item.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ESPECÍFICO WHATSAPP CLOUD API ═════════════════════ */}
      <section className="py-20 lg:py-28 bg-bg-soft">
        <div className="zappiq-wrap max-w-3xl">
          <div className="text-center mb-10">
            <span className="eyebrow">Perguntas frequentes · WhatsApp Cloud API</span>
            <h2 className="text-[36px] lg:text-[48px] font-medium text-ink leading-[1.08] tracking-[-0.03em] mt-3 mb-4">
              Suas dúvidas, <span className="text-grad">respondidas.</span>
            </h2>
            <p className="text-[16px] text-muted">
              {FAQ_WHATSAPP.length} perguntas mais comuns no pré-cadastro.
              Quer mais detalhes? <Link href="/cadastro" className="text-accent underline underline-offset-2">comece o trial</Link> ou{' '}
              <Link href="/agendar" className="text-accent underline underline-offset-2">agende uma conversa</Link>.
            </p>
          </div>
          <div className="space-y-3">
            {FAQ_WHATSAPP.map((faq, i) => (
              <div
                key={i}
                className="bg-white rounded-[16px] border border-line overflow-hidden hover:border-accent/30 transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                  aria-expanded={openFaq === i}
                >
                  <p className="text-[14.5px] font-medium text-ink pr-4 leading-snug tracking-tight">
                    {faq.q}
                  </p>
                  <ChevronDown
                    size={18}
                    className={`text-muted flex-shrink-0 transition-transform ${
                      openFaq === i ? 'rotate-180 text-accent' : ''
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 -mt-1">
                    <p className="text-[13.5px] text-muted leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA FINAL TRIPLO ══════════════════════════════════════ */}
      <section className="py-20 lg:py-28">
        <div className="zappiq-wrap max-w-5xl text-center">
          <span className="eyebrow">Pronto pra conectar</span>
          <h2 className="text-[40px] lg:text-[56px] font-medium text-ink leading-[1.05] tracking-[-0.03em] mt-3 mb-5">
            Você tem o que precisa.{' '}
            <span className="text-grad">Está você?</span>
          </h2>
          <p className="text-[18px] text-muted max-w-2xl mx-auto mb-10">
            Trial 14 dias sem cartão. Onboarding assistido gratuito.
            Cancela quando quiser.
          </p>
          <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <Link
              href="/cadastro"
              className="bg-ink text-white rounded-[16px] p-6 hover:opacity-90 transition-all flex flex-col items-center text-center"
            >
              <Rocket size={24} className="mb-3" />
              <span className="text-[15px] font-semibold mb-1">Começar trial agora</span>
              <span className="text-[12px] opacity-75">5 minutos · sem cartão</span>
            </Link>
            <Link
              href="/agendar"
              className="bg-white border-2 border-accent text-ink rounded-[16px] p-6 hover:bg-accent-soft transition-all flex flex-col items-center text-center"
            >
              <Calendar size={24} className="mb-3 text-accent" />
              <span className="text-[15px] font-semibold mb-1">Agendar conversa 30min</span>
              <span className="text-[12px] text-muted">Especialista ZappIQ</span>
            </Link>
            <Link
              href="/contato"
              className="bg-white border border-line text-ink rounded-[16px] p-6 hover:border-accent hover:text-accent transition-all flex flex-col items-center text-center"
            >
              <MessageCircle size={24} className="mb-3" />
              <span className="text-[15px] font-semibold mb-1">Falar com comercial</span>
              <span className="text-[12px] text-muted">Operações grandes</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

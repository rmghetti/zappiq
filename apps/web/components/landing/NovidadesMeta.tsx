'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * NovidadesMeta — conteúdo da página /novidades-meta
 * --------------------------------------------------------------------------
 * Fonte: Conversations Brasil 2026 (10/jun) + GA global do Meta Business
 * Agent (3/jun/2026). Sem preços/tiers por decisão comercial (2026-06-10).
 *
 * Estrutura:
 *   1. Hero (pioneirismo LATAM + CTA Iza)
 *   2. Faixa de urgência (username + BSUID em junho)
 *   3. 6 cards clicáveis → modal com detalhe + "como a ZappIQ implementa"
 *   4. Pioneirismo (1ª onda LATAM · pilotos com clientes · junto à Meta)
 *   5. Números do evento (com disclaimer de resultados autorrelatados)
 *   6. FAQ curto
 *   7. CTA final → Iza
 *
 * Todos os CTAs de conversa apontam pra Iza (wa.me/5511926160159), no mesmo
 * padrão de IzaEstaAqui.tsx / WhatsAppButton.tsx.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import {
  Bot, Blocks, AtSign, TrendingUp, CreditCard, Repeat,
  ArrowRight, X, Check, Clock, Rocket, Users, Handshake, Sparkles,
} from 'lucide-react';

const IZA_NUMBER = '5511926160159';
const izaLink = (text: string) =>
  `https://wa.me/${IZA_NUMBER}?text=${encodeURIComponent(text)}`;

/* ── Dados dos 6 cards + modais ─────────────────────────────────────────── */
type Novidade = {
  id: string;
  icon: typeof Bot;
  novo: boolean;
  title: string;
  tag: string;
  resumo: string;
  detalhe: string[];
  como: string[];
  ctaLabel: string;
  ctaText: string;
};

const NOVIDADES: Novidade[] = [
  {
    id: 'agent',
    icon: Bot,
    novo: true,
    title: 'Meta Business Agent',
    tag: 'Lançado globalmente em 3/jun/2026',
    resumo:
      'IA nativa da Meta que responde, recomenda produtos do catálogo, entende áudio, agenda e conduz vendas.',
    detalhe: [
      'É o agente de IA nativo da Meta para empresas, disponível no WhatsApp, Instagram e Messenger. Ele aprende com o site, as redes e o catálogo da sua marca para responder no seu tom, recomendar produtos, agendar compromissos, qualificar clientes e conduzir vendas — inclusive entendendo mensagens de áudio, essencial no Brasil.',
      'No evento da Meta, marcas demonstraram o agente recomendando produtos com memória de preferências ("da última vez você escolheu um SUV") e fechando pagamentos sem sair da conversa.',
    ],
    como: [
      'Ativamos e configuramos o agente com o conhecimento do seu negócio: site, FAQs, políticas e catálogo',
      'Definimos habilidades (vender, agendar, cobrar) e regras de transbordo para seu time humano',
      'Testamos antes do go-live, inclusive com perguntas por áudio, no padrão do consumidor brasileiro',
      'Medimos resultado desde o dia 1: conversas, conversão e receita atribuída',
    ],
    ctaLabel: 'Quero meu agente no ar',
    ctaText: 'Oi Iza! Quero ativar o Meta Business Agent',
  },
  {
    id: 'platform',
    icon: Blocks,
    novo: true,
    title: 'Business Agent Platform',
    tag: 'Camada enterprise · acesso em parceria com a Meta',
    resumo:
      'Camada enterprise para agentes que executam ações nos seus sistemas: pedidos, cobrança, agendamento.',
    detalhe: [
      'A plataforma para construir e implantar agentes em escala, conectados aos sistemas da sua empresa — e-commerce, CRM, ERP, atendimento. O agente deixa de só responder e passa a executar ações: consultar pedidos, gerar cobranças, agendar serviços.',
      'No palco do Conversations Brasil, a Meta validou o modelo agente-a-agente: o agente nativo da Meta trabalhando em conjunto com a IA própria da empresa — cada um no fluxo em que é melhor.',
    ],
    como: [
      'Orquestramos quem responde cada conversa: agente da Meta, IA da ZappIQ ou seu time — por intenção e valor',
      'Conectamos o agente aos seus sistemas (e-commerce, CRM, ERP) com segurança e governança',
      'Projetos piloto em andamento com clientes e em frente de colaboração com a Meta',
      'Governança completa: LGPD, trilha de auditoria e controle de custos',
    ],
    ctaLabel: 'Falar sobre minha operação',
    ctaText: 'Oi Iza! Quero conhecer a Business Agent Platform',
  },
  {
    id: 'usernames',
    icon: AtSign,
    novo: true,
    title: 'Usernames e busca no WhatsApp',
    tag: 'Janela de reivindicação aberta em junho/2026',
    resumo:
      'Sua marca pesquisável pelo nome no WhatsApp, sem depender do número de telefone.',
    detalhe: [
      'O WhatsApp está ganhando usernames (@suamarca) e uma busca por nome com IA. Na prática, o WhatsApp vira um diretório de negócios: quem o cliente encontra primeiro, vende primeiro. Empresas podem reivindicar seu @ a partir de junho — com prioridade para nomes e contas já verificadas.',
      'Junto vem o BSUID, um novo identificador de cliente que substitui o telefone em parte das integrações. Quem não se adequar pode ter fluxos de atendimento e de anúncios interrompidos sem perceber.',
    ],
    como: [
      'Auditamos seus números e fluxos atuais de WhatsApp',
      'Definimos a convenção de nomes da sua marca (@marca, @marca_BR, @marca_atendimento) e fazemos o claim',
      'Preparamos sua operação para o novo identificador (BSUID), sem quebra de atendimento',
      'Otimizamos seu perfil para aparecer bem na nova busca com IA do WhatsApp',
    ],
    ctaLabel: 'Garantir o @ da minha marca',
    ctaText: 'Oi Iza! Quero garantir o username da minha marca',
  },
  {
    id: 'mmapi',
    icon: TrendingUp,
    novo: false,
    title: 'Marketing Messages API',
    tag: 'Entrega otimizada por IA da Meta',
    resumo:
      'Mensagens de marketing otimizadas pela IA da Meta — mais alcance para campanhas de alto engajamento.',
    detalhe: [
      'A nova API dedicada a mensagens de marketing usa a IA da Meta para priorizar a entrega a quem tem mais chance de engajar — em teste oficial, mensagens de alto engajamento alcançaram até 9% mais pessoas. Vêm junto otimizações criativas automáticas (no estilo dos anúncios Advantage+) e novos formatos: álbum, GIF, tag de produto.',
      'O outro lado: a Meta passa a pausar templates com baixa leitura ou feedback negativo. Campanha mal cuidada agora significa entrega bloqueada — gestão de qualidade virou obrigação.',
    ],
    como: [
      'Migramos seus envios de marketing para a nova API, mantendo seu número e seus templates',
      'Monitoramos a saúde dos seus templates para evitar pausas e ampliar seus limites de entrega',
      'Automatizamos o follow-up inteligente dentro das janelas de conversa abertas',
      'Relatórios claros: alcance, engajamento e custo por categoria de mensagem',
    ],
    ctaLabel: 'Otimizar minhas campanhas',
    ctaText: 'Oi Iza! Quero otimizar minhas campanhas de WhatsApp',
  },
  {
    id: 'pagamentos',
    icon: CreditCard,
    novo: false,
    title: 'Pagamentos sem atrito',
    tag: 'Disponível no Brasil',
    resumo:
      'Pix com um toque, cartão salvo em 1 clique, boleto e link de pagamento — o checkout inteiro na conversa.',
    detalhe: [
      'O WhatsApp agora cobre os principais trilhos de pagamento do Brasil dentro da conversa: Pix estruturado com botão de copiar (adeus, código cru de 200 caracteres), Pix com redirecionamento para o app do banco, cartão salvo em 1 clique, boleto e link de pagamento. A Meta não processa o pagamento — você continua com seu meio de pagamento atual.',
      'No evento, o case de uma grande varejista mostrou 75% dos pagamentos do canal feitos por Pix copia-e-cola dentro do próprio WhatsApp.',
    ],
    como: [
      'Ativamos o checkout dentro da conversa, integrado ao seu gateway/PSP atual',
      'Pedido estruturado com botão de pagamento — mais conversão, menos abandono',
      'Recuperação automática de Pix não pago e de carrinho abandonado',
      'Cada venda amarrada à conversa que a gerou, no seu dashboard',
    ],
    ctaLabel: 'Quero vender no chat',
    ctaText: 'Oi Iza! Quero vender com pagamento no chat',
  },
  {
    id: 'playbook',
    icon: Repeat,
    novo: false,
    title: 'Playbook Engajar → Converter',
    tag: 'Estratégia oficial da Meta, automatizada',
    resumo:
      'A estratégia oficial da Meta de janelas de conversa: a mensagem certa, na janela certa, pelo menor custo.',
    detalhe: [
      'A Meta apresentou no evento sua estratégia recomendada em duas etapas. Engajar: abrir a janela de conversa com interações de alto valor — anúncios que levam ao WhatsApp (janela de 72h grátis) e mensagens de utilidade como confirmação de pedido e aviso de entrega (janela de 24h). Converter: aproveitar a janela aberta para enviar a oferta certa — o follow-up "Plus One": venda cruzada, upgrade ou reengajamento, no momento de maior atenção do cliente.',
      'Resultado: mais conversão por real investido, porque o marketing só dispara para quem já está na conversa.',
    ],
    como: [
      'Mapeamos os eventos do seu negócio que abrem janelas (pedido, envio, agendamento, fatura)',
      'Automatizamos o follow-up contextual dentro da janela aberta — sem disparo às cegas',
      'Desenhamos seus fluxos para usar as janelas gratuitas e as categorias mais baratas primeiro',
      'Você acompanha custo por conversa e receita gerada por cada régua',
    ],
    ctaLabel: 'Ativar esse playbook',
    ctaText: 'Oi Iza! Quero o playbook Engajar e Converter',
  },
];

const FAQS = [
  {
    q: 'O agente da Meta é grátis. Por que preciso da ZappIQ?',
    a: 'O motor de IA é grátis — mas ele só vende bem com as camadas que a Meta não entrega: conhecimento do seu negócio, catálogo curado, integrações, regras de transbordo para humanos, testes e medição de receita. É exatamente isso que implementamos, operamos e otimizamos.',
  },
  {
    q: 'O Business Agent substitui minha operação atual de WhatsApp?',
    a: 'Não. A própria Meta posiciona o agente como complemento à plataforma atual. O padrão vencedor mostrado no evento é híbrido: a IA qualifica e resolve o volume, seu time fecha o que vale mais — com tudo medido.',
  },
  {
    q: 'O que acontece se eu não fizer nada em junho?',
    a: 'Dois riscos: outra empresa pode reivindicar um @username melhor que o seu, e integrações que dependem do telefone do cliente podem quebrar silenciosamente com o novo identificador (BSUID). Os dois têm solução simples — se feita agora.',
  },
  {
    q: 'E a LGPD?',
    a: 'As conversas com o agente exibem o aviso de IA da própria Meta. Para operações maiores, entregamos o pacote de governança: adendo LGPD, trilha de auditoria de transbordos e controles de uso de dados.',
  },
  {
    q: 'Quanto custa a mensagem no WhatsApp?',
    a: 'Repassamos a tarifa oficial da Meta com transparência total — zero markup. E desenhamos seus fluxos para usar as janelas gratuitas e as categorias mais baratas antes de qualquer envio pago.',
  },
];

const STATS = [
  { n: '600 mi', l: 'conversas por dia entre pessoas e empresas nas plataformas Meta' },
  { n: '65%', l: 'dos consumidores preferem comprar por mensagem a ir à loja' },
  { n: '+62%', l: 'de leads em média com mensageria integrada à jornada' },
  { n: '3×', l: 'conversão no WhatsApp vs site/app, em case apresentado no evento' },
];

export function NovidadesMeta() {
  const [open, setOpen] = useState<string | null>(null);

  /* ESC fecha o modal + trava scroll do body enquanto aberto */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const active = NOVIDADES.find((n) => n.id === open) ?? null;

  return (
    <div className="-mt-32">
      {/* ── 1. HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-ink text-white pt-44 pb-20">
        <div
          className="pointer-events-none absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(47,181,122,.35), transparent 70%)' }}
        />
        <div className="zappiq-wrap relative">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] border border-emerald-400/60 bg-emerald-400/10 text-emerald-300 px-3 py-1.5 rounded-full">
            <Sparkles size={12} /> Pioneira na América Latina · Lançamentos Meta · Junho 2026
          </span>
          <h1 className="mt-6 text-4xl lg:text-[52px] font-bold leading-[1.12] max-w-3xl">
            O WhatsApp mudou.
            <br />
            <span className="text-emerald-400">A ZappIQ chegou primeiro.</span>
          </h1>
          <p className="mt-5 text-lg text-white/70 max-w-2xl leading-relaxed">
            A Meta lançou o <strong className="text-white">Business Agent</strong> — um vendedor de
            IA nativo no WhatsApp, Instagram e Messenger — além de usernames, busca por nome e
            pagamentos sem atrito. A ZappIQ é{' '}
            <strong className="text-white">uma das primeiras plataformas da América Latina</strong>{' '}
            a levar essas novidades ao mercado, com{' '}
            <strong className="text-white">projetos piloto em andamento junto a clientes e à Meta</strong>.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={izaLink('Oi Iza! Quero saber mais sobre o Meta Business Agent')}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-accent"
            >
              Falar com a Iza no WhatsApp
            </a>
            <a href="#novidades" className="btn border border-white/25 text-white hover:border-emerald-400">
              Conhecer as novidades
            </a>
          </div>
          <p className="mt-6 text-[13px] text-white/50">
            Integração oficial direta com a Meta · Tarifa Meta transparente, zero markup
          </p>
        </div>
      </section>

      {/* ── 2. URGÊNCIA ─────────────────────────────────────────────────── */}
      <div className="bg-amber-400 text-amber-950 text-center px-4 py-3 text-[14px] font-medium">
        <Clock size={14} className="inline -mt-0.5 mr-1.5" />
        <strong>Junho tem prazo:</strong> a janela para sua marca reivindicar o{' '}
        <strong>@username</strong> no WhatsApp e adequar sua operação ao novo identificador (BSUID)
        está aberta <strong>agora</strong>.
      </div>

      {/* ── 3. NOVIDADES (cards clicáveis) ─────────────────────────────── */}
      <section id="novidades" className="py-20 bg-bg-soft">
        <div className="zappiq-wrap">
          <h2 className="text-3xl lg:text-4xl font-bold text-ink max-w-2xl">
            O que a Meta acabou de lançar — e o que a ZappIQ já faz com isso
          </h2>
          <p className="mt-3 text-muted max-w-2xl">
            Direto do Conversations Brasil 2026: as novidades que mudam como sua empresa vende por
            WhatsApp e Instagram. <strong className="text-ink">Clique em cada card para entender melhor.</strong>
          </p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {NOVIDADES.map((n) => {
              const Icon = n.icon;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setOpen(n.id)}
                  className="text-left bg-white border border-line rounded-[20px] p-6 transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(17,17,17,0.18)] hover:border-emerald-400 group"
                >
                  <div className="w-11 h-11 rounded-[12px] bg-grad flex items-center justify-center">
                    <Icon size={20} className="text-white" />
                  </div>
                  <h3 className="mt-4 text-[16px] font-semibold text-ink leading-snug">
                    {n.title}
                    {n.novo && (
                      <span className="ml-2 align-middle inline-block bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                        Novo
                      </span>
                    )}
                  </h3>
                  <p className="mt-2 text-[13.5px] text-muted leading-relaxed">{n.resumo}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600">
                    Ver como funciona
                    <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 4. PIONEIRISMO ─────────────────────────────────────────────── */}
      <section className="py-20 bg-ink text-white">
        <div className="zappiq-wrap">
          <h2 className="text-3xl lg:text-4xl font-bold max-w-2xl">
            Pioneirismo não é discurso. É cronograma.
          </h2>
          <p className="mt-3 text-white/60 max-w-2xl">
            Enquanto o mercado ainda interpreta os anúncios, a ZappIQ já está em campo.
          </p>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Rocket,
                k: 'Primeira onda',
                t: 'Uma das primeiras da América Latina',
                d: 'O Meta Business Agent foi lançado globalmente em 3 de junho. A ZappIQ esteve no Conversations Brasil 2026 e iniciou imediatamente a incorporação dos lançamentos à plataforma — antes da primeira onda virar fila.',
              },
              {
                icon: Users,
                k: 'Pilotos ativos',
                t: 'Projetos piloto com clientes reais',
                d: 'Estamos ativando o Business Agent em operações de clientes selecionados, por segmento, com medição de resultado desde o primeiro dia — conversão, receita atribuída e satisfação.',
              },
              {
                icon: Handshake,
                k: 'Junto à Meta',
                t: 'Trabalho direto com a Meta',
                d: 'Atuamos com integração direta à API oficial e em frente de colaboração com a Meta para as novas capacidades — incluindo a preparação para usernames, BSUID e a plataforma enterprise de agentes.',
              },
            ].map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.k}
                  className="rounded-[20px] border border-emerald-400/30 bg-white/[0.04] p-6"
                >
                  <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-bold uppercase tracking-[0.12em]">
                    <Icon size={14} /> {p.k}
                  </div>
                  <h3 className="mt-3 text-[17px] font-semibold leading-snug">{p.t}</h3>
                  <p className="mt-2 text-[13.5px] text-white/65 leading-relaxed">{p.d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 5. NÚMEROS ─────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="zappiq-wrap">
          <h2 className="text-3xl lg:text-4xl font-bold text-ink">Por que agir agora</h2>
          <p className="mt-3 text-muted max-w-2xl">
            Números apresentados pela Meta e por marcas no Conversations Brasil 2026.
          </p>
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-5">
            {STATS.map((s) => (
              <div key={s.n} className="bg-white border border-line rounded-[20px] p-6 text-center">
                <div className="text-3xl lg:text-4xl font-bold text-emerald-600">{s.n}</div>
                <div className="mt-2 text-[13px] text-muted leading-snug">{s.l}</div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[12px] text-muted-2">
            Fontes: Meta (Conversations Brasil 2026, dados internos e Kantar 2025). Resultados de
            cases são autorrelatados pelas empresas e não constituem promessa de resultado.
            Recursos em beta da Meta sujeitos a elegibilidade.
          </p>
        </div>
      </section>

      {/* ── 6. FAQ ─────────────────────────────────────────────────────── */}
      <section className="py-20 bg-bg-soft">
        <div className="zappiq-wrap max-w-3xl">
          <h2 className="text-3xl lg:text-4xl font-bold text-ink">
            Perguntas diretas, respostas diretas
          </h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="bg-white border border-line rounded-[16px] px-6 py-4 group"
              >
                <summary className="cursor-pointer font-semibold text-ink text-[15px] list-none flex items-center justify-between gap-3">
                  {f.q}
                  <ArrowRight size={14} className="shrink-0 text-muted transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-[14px] text-muted leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. CTA FINAL ───────────────────────────────────────────────── */}
      <section className="py-20 bg-grad text-white text-center">
        <div className="zappiq-wrap">
          <h2 className="text-3xl lg:text-4xl font-bold max-w-2xl mx-auto leading-snug">
            A conversa é a nova interface de negócios. Seu negócio está pronto para ela?
          </h2>
          <p className="mt-4 text-white/85 max-w-xl mx-auto">
            Diagnóstico gratuito de 20 minutos: onde sua operação está na régua da Meta — e o plano
            para chegar à frente. Quem te atende é a Iza, a IA oficial da ZappIQ — prova pública, ao
            vivo.
          </p>
          <a
            href={izaLink('Oi Iza! Quero o diagnóstico gratuito das novidades Meta')}
            target="_blank"
            rel="noopener noreferrer"
            className="btn mt-8 bg-ink text-white hover:opacity-90"
          >
            Quero meu diagnóstico gratuito
          </a>
        </div>
      </section>

      {/* ── MODAL ──────────────────────────────────────────────────────── */}
      {active && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(null);
          }}
        >
          <div className="bg-white rounded-[20px] max-w-xl w-full max-h-[86vh] overflow-y-auto p-8 relative">
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Fechar"
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-bg-soft hover:bg-emerald-500 hover:text-white text-ink flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>
            <div className="w-11 h-11 rounded-[12px] bg-grad flex items-center justify-center">
              <active.icon size={20} className="text-white" />
            </div>
            <h3 className="mt-4 text-[22px] font-bold text-ink pr-10">{active.title}</h3>
            <span className="mt-2 inline-block bg-emerald-50 text-emerald-700 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full">
              {active.tag}
            </span>
            {active.detalhe.map((p) => (
              <p key={p.slice(0, 32)} className="mt-4 text-[14px] text-muted leading-relaxed">
                {p}
              </p>
            ))}
            <div className="mt-5 rounded-[14px] border border-emerald-200 bg-emerald-50/60 p-5">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-emerald-700">
                Como a ZappIQ implementa para você
              </div>
              <ul className="mt-3 space-y-2">
                {active.como.map((c) => (
                  <li key={c.slice(0, 32)} className="flex gap-2 text-[13.5px] text-ink leading-snug">
                    <Check size={15} className="shrink-0 mt-0.5 text-emerald-600" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <a
              href={izaLink(active.ctaText)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-accent w-full justify-center mt-6"
            >
              {active.ctaLabel}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

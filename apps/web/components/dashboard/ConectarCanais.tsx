'use client';

/**
 * ConectarCanais — UI self-service de conexão de canais (#272).
 *
 * ====================== RASCUNHO / DRAFT (2026-05-20) ======================
 * Scaffold cabeado aos endpoints REAIS do backend (#273/#274 — PR #164):
 *   GET  /api/embedded-signup/status     -> estado de conexão
 *   POST /api/embedded-signup/whatsapp   {code, wabaId, phoneNumberId}
 *   POST /api/embedded-signup/instagram  {code, pageId?}
 *
 * NÃO está montado em lugar nenhum ainda — é pra revisar + estilizar JUNTO
 * com o Rodrigo na próxima sessão e então decidir onde plugar (proposta:
 * substituir o tab "WhatsApp" atual em settings/page.tsx, que hoje é paste
 * manual de IDs).
 *
 * 2026-05-22 — Acrescentado o quadro de acesso ao tutorial (TutorialAccessCard)
 * acima dos cards de canal + popup grande (TutorialModal) que carrega o tutorial
 * interativo self-contained (apps/web/public/tutoriais/tutorial-interativo.html)
 * num <iframe>. O HTML é a build do design feito no Claude Design; o ✕ interno e
 * os links "ir para o onboarding" fecham o popup via postMessage. "Baixar PDF"
 * aponta pro PDF já entregue. Re-exportou o design? Basta substituir o HTML.
 *
 * GATES pendentes antes de funcionar pra cliente externo:
 *   1. config_id do Facebook Login for Business (Rodrigo cria no App Review,
 *      Passo 3 do GUIA_APP_REVIEW_META_EMBEDDED_SIGNUP.md) -> env
 *      NEXT_PUBLIC_META_CONFIG_ID. Sem ele, o popup do Embedded Signup não abre.
 *   2. Advanced Access aprovado no App Review (até lá só dev/test users).
 *
 * O launcher do FB SDK (launchWhatsAppSignup / launchInstagramSignup) está
 * marcado com TODO — depende do config_id. O fluxo de status, os cards, o
 * popup didático e o onboarding assistido já funcionam standalone.
 * ===========================================================================
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Smartphone, Instagram, CheckCircle2, Loader2, X, BookOpen,
  CalendarClock, Download, ArrowRight, ShieldCheck,
} from 'lucide-react';
import { api } from '../../lib/api';

// Link do Google Appointment Schedules (mesmo usado na landing /agendar)
const ONBOARD_ASSISTIDO_URL =
  'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ34YUuDtykuvlBt8DEZxD0sFZOctNdeyIcl4nn7EOfEBBDm2W5wpjecxxxQlmwu9PQ_7QGJc5Yd';

// Tutorial interativo (HTML self-contained gerado no Claude Design) + PDF baixável.
// Ambos servidos estaticamente de apps/web/public/tutoriais/.
const TUTORIAL_HTML_URL = '/tutoriais/tutorial-interativo.html';
const TUTORIAL_PDF_URL = '/tutoriais/cadastrar-whatsapp-instagram.pdf';

// TODO(Rodrigo): trocar pelo Configuration ID do Facebook Login for Business
// (Passo 3 do guia). Idealmente via env NEXT_PUBLIC_META_CONFIG_ID.
const META_CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID || '';
const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || '1603310040738671';

interface ChannelStatus {
  whatsapp: { connected: boolean; phoneNumberId: string | null; wabaId: string | null; connectedAt: string | null };
  instagram: { connected: boolean; instagramAccountId: string | null; pageName: string | null; connectedAt: string | null };
}

type Channel = 'whatsapp' | 'instagram';

export default function ConectarCanais() {
  const [status, setStatus] = useState<ChannelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<Channel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [howToChannel, setHowToChannel] = useState<Channel | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // O tutorial roda dentro de um <iframe>. Ele avisa o parent (esta página) por
  // postMessage quando o usuário clica no ✕ ou em "ir para o onboarding".
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e?.data === 'zappiq-tutorial-close') setTutorialOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setTutorialOpen(false);
    }
    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<ChannelStatus>('/api/embedded-signup/status');
      setStatus(data);
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar status dos canais');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // ── FB SDK Embedded Signup launchers ──────────────────────────────────────
  // TODO: carregar o SDK do Facebook (FB.init) e abrir FB.login com o
  // config_id. O callback devolve `code` + ids selecionados, que mandamos
  // pro backend. Esqueleto abaixo mostra o shape esperado.
  async function launchWhatsAppSignup() {
    if (!META_CONFIG_ID) {
      setError('Configuration ID da Meta ainda não configurado (NEXT_PUBLIC_META_CONFIG_ID). Ver guia App Review, Passo 3.');
      return;
    }
    setConnecting('whatsapp');
    setError(null);
    try {
      // const { code, wabaId, phoneNumberId } = await openFbEmbeddedSignup('whatsapp');
      // await api.post('/api/embedded-signup/whatsapp', { code, wabaId, phoneNumberId });
      // await loadStatus();
      throw new Error('FB SDK launcher pendente (config_id). Backend já pronto.');
    } catch (e: any) {
      setError(e?.message || 'Falha ao conectar WhatsApp');
    } finally {
      setConnecting(null);
    }
  }

  async function launchInstagramSignup() {
    if (!META_CONFIG_ID) {
      setError('Configuration ID da Meta ainda não configurado (NEXT_PUBLIC_META_CONFIG_ID). Ver guia App Review, Passo 3.');
      return;
    }
    setConnecting('instagram');
    setError(null);
    try {
      // const { code, pageId } = await openFbEmbeddedSignup('instagram');
      // await api.post('/api/embedded-signup/instagram', { code, pageId });
      // await loadStatus();
      throw new Error('FB SDK launcher pendente (config_id). Backend já pronto.');
    } catch (e: any) {
      setError(e?.message || 'Falha ao conectar Instagram');
    } finally {
      setConnecting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 p-8 justify-center">
        <Loader2 className="animate-spin" size={18} /> Carregando canais…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h2 className="text-lg font-semibold text-gray-900">Conectar canais</h2>
        <p className="text-sm text-gray-500">
          Conecte seu WhatsApp Business e/ou Instagram para o agente atender em seu nome.
          Você pode conectar um ou os dois.
        </p>
      </header>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Acesso ao tutorial — fica acima das opções de conexão */}
      <TutorialAccessCard
        onOpen={() => setTutorialOpen(true)}
        pdfUrl={TUTORIAL_PDF_URL}
      />

      <ChannelCard
        icon={<Smartphone size={22} className="text-green-600" />}
        title="WhatsApp Business"
        connected={status?.whatsapp.connected ?? false}
        detail={status?.whatsapp.connected ? `Número conectado · ID ${status?.whatsapp.phoneNumberId}` : 'Atendimento no WhatsApp da sua empresa'}
        connecting={connecting === 'whatsapp'}
        onConnect={launchWhatsAppSignup}
        onHowTo={() => setHowToChannel('whatsapp')}
        accent="green"
      />

      <ChannelCard
        icon={<Instagram size={22} className="text-pink-600" />}
        title="Instagram Direct"
        connected={status?.instagram.connected ?? false}
        detail={status?.instagram.connected ? `${status?.instagram.pageName ?? 'Conta'} conectada` : 'Responder DMs do Instagram do seu negócio'}
        connecting={connecting === 'instagram'}
        onConnect={launchInstagramSignup}
        onHowTo={() => setHowToChannel('instagram')}
        accent="pink"
      />

      {/* Onboarding assistido — sempre visível */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-5 flex items-start gap-4">
        <CalendarClock className="text-primary-500 shrink-0" size={22} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Prefere que a gente conecte com você?</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Agende um onboarding assistido e conectamos seus canais juntos, ao vivo, em ~30 min.
          </p>
        </div>
        <a
          href={ONBOARD_ASSISTIDO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg text-sm font-medium border border-primary-500 text-primary-600 hover:bg-primary-50 whitespace-nowrap"
        >
          Agendar
        </a>
      </div>

      {howToChannel && (
        <HowToModal channel={howToChannel} onClose={() => setHowToChannel(null)} />
      )}

      {tutorialOpen && (
        <TutorialModal
          src={TUTORIAL_HTML_URL}
          pdfUrl={TUTORIAL_PDF_URL}
          onClose={() => setTutorialOpen(false)}
        />
      )}
    </div>
  );
}

// ── Card de acesso ao tutorial (CTA acima dos canais) ─────────────────────────
function TutorialAccessCard({ onOpen, pdfUrl }: { onOpen: () => void; pdfUrl: string }) {
  return (
    <div className="rounded-xl border border-primary-100 bg-gradient-to-br from-primary-50/70 to-white p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="w-11 h-11 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
        <BookOpen size={22} className="text-primary-600" />
      </div>
      <div className="flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600">
          Recomendado · 3 min de leitura
        </p>
        <p className="text-sm font-semibold text-gray-900 mt-0.5">Tutorial interativo de ativação</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Veja cada uma das 11 telas com figura, antes de começar. Pelo computador, sem conhecimento técnico.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap"
        >
          <Download size={14} /> Baixar PDF
        </a>
        <button
          onClick={onOpen}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 flex items-center gap-2 whitespace-nowrap"
        >
          Abrir tutorial <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Modal grande com o tutorial interativo (iframe self-contained) ────────────
function TutorialModal({ src, pdfUrl, onClose }: { src: string; pdfUrl: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex flex-col sm:p-4 md:p-6" role="dialog" aria-modal="true">
      <div className="relative bg-white sm:rounded-2xl overflow-hidden shadow-2xl w-full h-full sm:max-w-6xl sm:mx-auto flex flex-col">
        {/* Barra de fechar externa — o tutorial tem o próprio chrome interno (✕ + Baixar PDF) */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100 bg-white">
          <span className="text-xs font-medium text-gray-500">Tutorial de ativação · ZappIQ</span>
          <div className="flex items-center gap-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Download size={13} /> Baixar PDF
            </a>
            <button
              onClick={onClose}
              aria-label="Fechar tutorial"
              className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 flex items-center justify-center"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <iframe
          src={src}
          title="Tutorial interativo de ativação ZappIQ"
          className="flex-1 w-full border-0"
        />
      </div>
    </div>
  );
}

// ── Card de canal ────────────────────────────────────────────────────────────
function ChannelCard({
  icon, title, detail, connected, connecting, onConnect, onHowTo, accent,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  connected: boolean;
  connecting: boolean;
  onConnect: () => void;
  onHowTo: () => void;
  accent: 'green' | 'pink';
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${accent === 'green' ? 'bg-green-50' : 'bg-pink-50'}`}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{detail}</p>
        </div>
        {connected && (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={14} /> Conectado
          </span>
        )}
      </div>

      {!connected && (
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={onConnect}
            disabled={connecting}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
          >
            {connecting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            {connecting ? 'Conectando…' : `Conectar ${title.split(' ')[0]}`}
          </button>
          <button
            onClick={onHowTo}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2"
          >
            <BookOpen size={14} /> Veja como cadastrar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Popup didático "Veja como cadastrar" ──────────────────────────────────────
// Conteúdo resumido por canal. O tutorial completo (PDF, marca ZappIQ|MACHIA)
// é baixável pelo botão — Rodrigo está refinando o design dele à parte.
const STEPS: Record<Channel, { title: string; steps: string[]; tutorial: string }> = {
  whatsapp: {
    title: 'Conectar WhatsApp Business',
    steps: [
      'Clique em "Conectar WhatsApp" — abre o login seguro da Meta (Facebook).',
      'Faça login com a conta que administra o seu negócio na Meta.',
      'Escolha (ou crie na hora) o Portfólio Empresarial e a conta WhatsApp Business.',
      'Selecione o número que vai atender. Pode ser um novo número ou um já existente.',
      'Confirme o código de verificação enviado por SMS/ligação ao número.',
      'Pronto: o número fica conectado e o agente já responde por ele.',
    ],
    tutorial: '/tutoriais/cadastrar-whatsapp-instagram.pdf',
  },
  instagram: {
    title: 'Conectar Instagram Direct',
    steps: [
      'Pré-requisito: sua conta Instagram precisa ser Business e estar vinculada a uma Página do Facebook.',
      'Clique em "Conectar Instagram" — abre o login seguro da Meta.',
      'Faça login com a conta que administra a Página vinculada ao seu Instagram.',
      'Selecione a Página correspondente ao seu Instagram Business.',
      'Autorize o acesso às mensagens (DMs).',
      'Pronto: as DMs do seu Instagram passam a ser respondidas pelo agente.',
    ],
    tutorial: '/tutoriais/cadastrar-whatsapp-instagram.pdf',
  },
};

function HowToModal({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const data = STEPS[channel];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">{data.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            <ShieldCheck size={14} className="text-primary-500" />
            Login direto na Meta. Suas credenciais não passam pela ZappIQ.
          </div>
          <ol className="space-y-3">
            {data.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary-50 text-primary-600 text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-center gap-3 p-5 border-t border-gray-100">
          <a
            href={data.tutorial}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <Download size={14} /> Baixar tutorial completo
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 ml-auto"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

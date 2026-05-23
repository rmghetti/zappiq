'use client';

/**
 * ConectarCanais — UI self-service de conexão de canais (#272 / self-serve token por org).
 *
 * ===========================================================================
 * MODELO ATUAL (2026-05-23) — "traga seu token" (token por org):
 *   O cliente escolhe o que ativar (WhatsApp, Instagram Direct ou ambos) e
 *   preenche as credenciais do PROPRIO app Meta. Salvamos nas colunas da org
 *   (whatsapp e instagram) + settings.channelActivation. O backend
 *   (whatsappService e instagramService) usa ESSAS credenciais pra enviar:
 *   token por org, com fallback global so pra Iza dogfood. Conta pro AI Readiness.
 *
 *   Por que manual e não 1 clique: o Embedded Signup (FB Login for Business)
 *   depende de Advanced Access no App Review da Meta (backlog #Meta). Enquanto
 *   isso não sai, o caminho "traga seu token" já entrega ativação 100% real,
 *   sem App Review. O tutorial interativo guia o cliente passo a passo, e o
 *   onboarding assistido cobre quem travar.
 *
 *   Quando o Embedded Signup liberar: ele grava NAS MESMAS colunas — o botão
 *   "1 clique" só preenche o que hoje o cliente cola na mão. Zero retrabalho.
 * ===========================================================================
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Smartphone, Instagram, CheckCircle2, Loader2, X, BookOpen,
  CalendarClock, Download, ArrowRight, ShieldCheck, Save, AlertCircle,
} from 'lucide-react';
import { api } from '../../lib/api';

// Link do Google Appointment Schedules (mesmo usado na landing /agendar)
const ONBOARD_ASSISTIDO_URL =
  'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ34YUuDtykuvlBt8DEZxD0sFZOctNdeyIcl4nn7EOfEBBDm2W5wpjecxxxQlmwu9PQ_7QGJc5Yd';

// Tutorial interativo (HTML self-contained) + PDF baixável, servidos de /public/tutoriais/.
const TUTORIAL_HTML_URL = '/tutoriais/tutorial-interativo.html';
const TUTORIAL_PDF_URL = '/tutoriais/cadastrar-whatsapp-instagram.pdf';

type Activation = 'whatsapp' | 'instagram' | 'both';

interface OrgSettingsResponse {
  whatsappPhoneNumberId?: string | null;
  whatsappBusinessAccountId?: string | null;
  whatsappAccessToken?: string | null;
  instagramAccountId?: string | null;
  instagramPageId?: string | null;
  instagramAccessToken?: string | null;
  settings?: Record<string, any> | null;
}

export default function ConectarCanais() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // Estado do formulário
  const [activation, setActivation] = useState<Activation>('whatsapp');
  const [origSettings, setOrigSettings] = useState<Record<string, any>>({});
  // WhatsApp
  const [waPhone, setWaPhone] = useState('');
  const [waBiz, setWaBiz] = useState('');
  const [waToken, setWaToken] = useState('');
  // Instagram
  const [igAccount, setIgAccount] = useState('');
  const [igPage, setIgPage] = useState('');
  const [igToken, setIgToken] = useState('');

  // Tutorial roda em <iframe> e avisa o parent por postMessage no ✕.
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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; data: OrgSettingsResponse }>('/api/settings');
      const org = res?.data || ({} as OrgSettingsResponse);
      const settings = (org.settings as any) || {};
      setOrigSettings(settings);
      setWaPhone(org.whatsappPhoneNumberId || '');
      setWaBiz(org.whatsappBusinessAccountId || '');
      setWaToken(org.whatsappAccessToken || '');
      setIgAccount(org.instagramAccountId || '');
      setIgPage(org.instagramPageId || '');
      setIgToken(org.instagramAccessToken || '');
      const act = settings.channelActivation;
      if (act === 'instagram' || act === 'both') setActivation(act);
      else setActivation('whatsapp');
    } catch {
      // Fail-soft: mantém formulário vazio. Não bloqueia o tutorial.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const wantWa = activation === 'whatsapp' || activation === 'both';
  const wantIg = activation === 'instagram' || activation === 'both';
  const waConnected = !!(waPhone.trim() && waToken.trim());
  const igConnected = !!(igAccount.trim() && igToken.trim());

  async function handleSave() {
    setError(null);
    setOkMsg(null);

    // Valida só os campos do(s) canal(is) escolhido(s).
    if (wantWa && (!waPhone.trim() || !waToken.trim())) {
      setError('Para ativar o WhatsApp, preencha o Phone Number ID e o Access Token.');
      return;
    }
    if (wantIg && (!igAccount.trim() || !igToken.trim())) {
      setError('Para ativar o Instagram, preencha o Instagram Account ID e o Access Token.');
      return;
    }

    setSaving(true);
    try {
      // settings é JSON: preserva o resto e grava channelActivation.
      const payload: Record<string, any> = {
        settings: { ...origSettings, channelActivation: activation },
      };
      if (wantWa) {
        payload.whatsappPhoneNumberId = waPhone.trim() || null;
        payload.whatsappBusinessAccountId = waBiz.trim() || null;
        payload.whatsappAccessToken = waToken.trim() || null;
      }
      if (wantIg) {
        payload.instagramAccountId = igAccount.trim() || null;
        payload.instagramPageId = igPage.trim() || null;
        payload.instagramAccessToken = igToken.trim() || null;
      }
      await api.put('/api/settings', payload);
      setOrigSettings((s) => ({ ...s, channelActivation: activation }));
      setOkMsg('Canais salvos! Seu agente já pode atender pelos canais ativados. O score será atualizado.');
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
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
          Escolha o que ativar e conecte WhatsApp Business e/ou Instagram Direct.
          Seu agente passa a atender pelos canais que você ativar.
        </p>
      </header>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {okMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-start gap-2">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {okMsg}
        </div>
      )}

      {/* Tutorial — acima das opções de conexão */}
      <TutorialAccessCard onOpen={() => setTutorialOpen(true)} pdfUrl={TUTORIAL_PDF_URL} />

      {/* Seletor de ativação */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-2">O que você quer ativar?</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <ActivationOption
            active={activation === 'whatsapp'}
            onClick={() => setActivation('whatsapp')}
            icon={<Smartphone size={18} className="text-green-600" />}
            label="Apenas WhatsApp"
          />
          <ActivationOption
            active={activation === 'instagram'}
            onClick={() => setActivation('instagram')}
            icon={<Instagram size={18} className="text-pink-600" />}
            label="Apenas Instagram Direct"
          />
          <ActivationOption
            active={activation === 'both'}
            onClick={() => setActivation('both')}
            icon={
              <span className="flex items-center gap-0.5">
                <Smartphone size={16} className="text-green-600" />
                <Instagram size={16} className="text-pink-600" />
              </span>
            }
            label="WhatsApp e Instagram"
          />
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-500 flex items-center gap-2">
        <ShieldCheck size={14} className="text-primary-500 shrink-0" />
        Suas credenciais ficam guardadas só na sua organização e são usadas apenas para o agente responder em seu nome.
      </div>

      {/* Formulário WhatsApp */}
      {wantWa && (
        <ChannelForm
          title="WhatsApp Business"
          icon={<Smartphone size={20} className="text-green-600" />}
          connected={waConnected}
          accent="green"
          fields={[
            { label: 'Phone Number ID', value: waPhone, set: setWaPhone, placeholder: 'Ex: 123456789012345', hint: 'Meta Business Suite → WhatsApp → API Setup.' },
            { label: 'Business Account ID (WABA)', value: waBiz, set: setWaBiz, placeholder: 'Ex: 987654321098765', hint: 'Opcional, mas recomendado.' },
            { label: 'Access Token', value: waToken, set: setWaToken, placeholder: 'Token permanente do seu app Meta', secret: true, hint: 'Token de System User (permanente). Fica protegido.' },
          ]}
        />
      )}

      {/* Formulário Instagram */}
      {wantIg && (
        <ChannelForm
          title="Instagram Direct"
          icon={<Instagram size={20} className="text-pink-600" />}
          connected={igConnected}
          accent="pink"
          fields={[
            { label: 'Instagram Account ID', value: igAccount, set: setIgAccount, placeholder: 'Ex: 17841400000000000', hint: 'ID da conta Instagram Business.' },
            { label: 'Page ID (Facebook)', value: igPage, set: setIgPage, placeholder: 'ID da Página vinculada', hint: 'Página do Facebook vinculada ao Instagram.' },
            { label: 'Access Token', value: igToken, set: setIgToken, placeholder: 'Page Access Token de longa duração', secret: true, hint: 'Token da Página (longa duração). Fica protegido.' },
          ]}
        />
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-5 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        {saving ? 'Salvando…' : 'Salvar e ativar canais'}
      </button>

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

      {tutorialOpen && (
        <TutorialModal src={TUTORIAL_HTML_URL} pdfUrl={TUTORIAL_PDF_URL} onClose={() => setTutorialOpen(false)} />
      )}
    </div>
  );
}

// ── Opção de ativação (radio card) ────────────────────────────────────────────
function ActivationOption({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-left transition-colors ${
        active ? 'border-primary-500 bg-primary-50/60 ring-1 ring-primary-300' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className={`text-sm font-medium ${active ? 'text-primary-700' : 'text-gray-700'}`}>{label}</span>
      {active && <CheckCircle2 size={16} className="text-primary-500 ml-auto shrink-0" />}
    </button>
  );
}

// ── Formulário de um canal ────────────────────────────────────────────────────
interface FieldDef {
  label: string;
  value: string;
  set: (v: string) => void;
  placeholder?: string;
  hint?: string;
  secret?: boolean;
}
function ChannelForm({
  title, icon, connected, accent, fields,
}: {
  title: string;
  icon: React.ReactNode;
  connected: boolean;
  accent: 'green' | 'pink';
  fields: FieldDef[];
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent === 'green' ? 'bg-green-50' : 'bg-pink-50'}`}>
          {icon}
        </div>
        <p className="text-sm font-semibold text-gray-900 flex-1">{title}</p>
        {connected && (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={14} /> Configurado
          </span>
        )}
      </div>
      {fields.map((f) => (
        <div key={f.label}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
          <input
            type={f.secret ? 'password' : 'text'}
            value={f.value}
            onChange={(e) => f.set(e.target.value)}
            placeholder={f.placeholder}
            autoComplete="off"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
          {f.hint && <p className="text-xs text-gray-500 mt-1">{f.hint}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Card de acesso ao tutorial ────────────────────────────────────────────────
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
          Veja cada tela com figura antes de começar. Onde encontrar cada ID e token, passo a passo.
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

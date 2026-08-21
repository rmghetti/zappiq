'use client';

/**
 * ConectarCanais — UI self-service de conexão de canais (#272 / self-serve token por org).
 *
 * ===========================================================================
 * MODELO ATUAL (2026-05-23) — "traga seu token" (token por org):
 *   O cliente escolhe o que ativar (WhatsApp, Instagram Direct ou ambos) e
 *   preenche as credenciais do PRÓPRIO app Meta. Salvamos nas colunas da org
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

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Smartphone, Instagram, CheckCircle2, Loader2, X, BookOpen,
  CalendarClock, Download, ArrowRight, ShieldCheck, Save, AlertCircle,
  Activity, PlugZap, RefreshCw, Copy, Webhook, XCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { resolveWhatsAppSignupConfig } from '../../lib/metaEmbeddedSignup';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { TourLauncher } from '@/components/shared/GuidedTour';

// Link do Google Appointment Schedules (mesmo usado na landing /agendar)
const ONBOARD_ASSISTIDO_URL =
  'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ34YUuDtykuvlBt8DEZxD0sFZOctNdeyIcl4nn7EOfEBBDm2W5wpjecxxxQlmwu9PQ_7QGJc5Yd';

// Tutorial interativo (HTML self-contained) + PDF baixável, servidos de /public/tutoriais/.
const TUTORIAL_HTML_URL = '/tutoriais/tutorial-interativo.html';
const TUTORIAL_PDF_URL = '/tutoriais/cadastrar-whatsapp-instagram.pdf';

// Embedded Signup (Conectar em 1 clique) — App ID + config_id PÚBLICOS da ZappIQ
// na Meta. Nao sao secretos (usados client-side no FB SDK). Fallback hardcoded
// pra nao depender de env no Vercel. config_id criado 2026-05-24 (WhatsApp
// Embedded Signup, token de 60 dias). Em prod, so conecta cliente externo após
// Advanced Access aprovado no App Review; até la funciona pra test users do app.
const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || '1603310040738671';
const META_CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID || '3990962534537609';
// Resposta Meta 2026 (PR-G): a v2 do Embedded Signup foi depreciada pela Meta,
// com corte em 15/10/2026. A v4 usa uma configuração NOVA de Facebook Login
// for Business (variante WhatsApp Embedded Signup) e o FB.login passa a mandar
// extras apenas { setup: {} }, sem featureType/sessionInfoVersion. Rollout
// flag-gated: com NEXT_PUBLIC_META_CONFIG_ID_V4 setada o botão usa a v4; sem
// ela, o fluxo v2 atual segue intocado. A decisão pura (config_id + extras)
// mora em lib/metaEmbeddedSignup.ts, coberta em lib/__tests__. Na v4 o fluxo
// também pode terminar em FINISH_ONLY_WABA (concluiu sem registrar número) ou
// CANCEL (com current_step de onde parou); ver o listener de postMessage.
const META_CONFIG_ID_V4 = process.env.NEXT_PUBLIC_META_CONFIG_ID_V4 || '';
const META_GRAPH_VERSION = 'v21.0';

type Activation = 'whatsapp' | 'instagram' | 'both';

// FEATURE 5b.3 — saúde do canal (vem de GET /api/settings/channels/health).
type ChannelKey = 'whatsapp' | 'instagram';
interface ChannelHealth {
  channel: ChannelKey;
  connected: boolean;
  /** Conexão herdada da credencial global da plataforma (dogfood Iza). */
  viaGlobal?: boolean;
  qualityRating?: string | null;
  numberStatus?: string | null;
  connectedAt?: string | null;
  disconnectedAt?: string | null;
}

interface OrgSettingsResponse {
  whatsappPhoneNumberId?: string | null;
  whatsappBusinessAccountId?: string | null;
  whatsappAccessToken?: string | null;
  instagramAccountId?: string | null;
  instagramPageId?: string | null;
  instagramAccessToken?: string | null;
  metaAppSecret?: string | null;
  settings?: Record<string, any> | null;
}

// 13/08 — Webhook por org (GET /api/settings/channels/webhook-info). É o que o
// cliente cadastra no app Meta DELE pra RECEBER mensagens no caminho manual.
interface WebhookInfo {
  verifyToken: string;
  whatsapp: { callbackUrl: string; subscribeFields: string[] };
  instagram: { callbackUrl: string; subscribeFields: string[] };
}

// 13/08 — resultado do "Testar conexão" (POST /api/settings/channels/test).
interface ChannelTestResult {
  ok: boolean;
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: string;
  username?: string;
  name?: string;
  error?: string;
  hint?: string;
  /** Teste feito com a credencial global da plataforma (dogfood Iza). */
  viaGlobal?: boolean;
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
  // App Secret do app Meta do cliente (verificação de webhook por org)
  const [metaAppSecret, setMetaAppSecret] = useState('');

  // Embedded Signup (1 clique): estado de conexão + sessionInfo capturado da Meta.
  // `event`/`currentStep` existem por causa da v4 (FINISH_ONLY_WABA e CANCEL);
  // na v2 só chega FINISH e os campos extras ficam sem efeito.
  const [waConnecting, setWaConnecting] = useState(false);
  const [igConnecting, setIgConnecting] = useState(false);
  const sessionInfoRef = useRef<{
    wabaId?: string;
    phoneNumberId?: string;
    event?: 'FINISH' | 'FINISH_ONLY_WABA' | 'CANCEL';
    currentStep?: string;
  }>({});

  // FEATURE 5b.3 — monitor de saúde + desconexão de canal.
  const [health, setHealth] = useState<ChannelHealth[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState<ChannelKey | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<ChannelKey | null>(null);
  // 14/08 — sem "Permitir acesso às mensagens" ligado no app do Instagram, a
  // Meta NÃO entrega as DMs ao webhook (visto ao vivo: DM na caixa, evento
  // nenhum). O popup abre sozinho após conectar e fica acessível no cartão.
  const [igAccessOpen, setIgAccessOpen] = useState(false);

  // 13/08 — webhook por org + teste de conexão.
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [testResults, setTestResults] = useState<{ whatsapp: ChannelTestResult; instagram: ChannelTestResult } | null>(null);
  const [testing, setTesting] = useState(false);

  // Carrega o SDK do Facebook (1x) e escuta o sessionInfo do Embedded Signup.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    w.fbAsyncInit = function () {
      w.FB?.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: false, version: META_GRAPH_VERSION });
    };
    if (!document.getElementById('facebook-jssdk')) {
      const js = document.createElement('script');
      js.id = 'facebook-jssdk';
      js.src = 'https://connect.facebook.net/en_US/sdk.js';
      js.async = true;
      js.defer = true;
      js.crossOrigin = 'anonymous';
      document.body.appendChild(js);
    } else if (w.FB) {
      w.FB.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: false, version: META_GRAPH_VERSION });
    }
    // O popup do Embedded Signup manda waba_id + phone_number_id por postMessage.
    // v2 só emite FINISH; a v4 (Resposta Meta 2026) também emite FINISH_ONLY_WABA
    // (concluiu sem registrar número) e CANCEL (desistiu, com current_step).
    function onWaMessage(e: MessageEvent) {
      if (e.origin !== 'https://www.facebook.com' && e.origin !== 'https://web.facebook.com') return;
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (data?.event === 'FINISH') {
          sessionInfoRef.current = {
            event: 'FINISH',
            wabaId: data.data?.waba_id,
            phoneNumberId: data.data?.phone_number_id,
          };
        } else if (data?.event === 'FINISH_ONLY_WABA') {
          // v4: WABA criada, número NÃO registrado. Não vem phone_number_id.
          sessionInfoRef.current = {
            event: 'FINISH_ONLY_WABA',
            wabaId: data.data?.waba_id,
          };
        } else if (data?.event === 'CANCEL') {
          // v4: pessoa fechou o fluxo. Log discreto com o passo, pro suporte.
          sessionInfoRef.current = {
            event: 'CANCEL',
            currentStep: data.data?.current_step,
          };
          console.info('[EmbeddedSignup/WA] fluxo cancelado pelo usuário', {
            currentStep: data.data?.current_step || null,
          });
        }
      } catch {
        /* mensagem não-JSON: ignora */
      }
    }
    window.addEventListener('message', onWaMessage);
    return () => window.removeEventListener('message', onWaMessage);
  }, []);

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
      setMetaAppSecret(org.metaAppSecret || '');
      const act = settings.channelActivation;
      if (act === 'instagram' || act === 'both') setActivation(act);
      else setActivation('whatsapp');
    } catch {
      // Fail-soft: mantém formulário vazio. Não bloqueia o tutorial.
    } finally {
      setLoading(false);
    }
  }, []);

  // FEATURE 5b.3 — busca saúde dos canais (conectado/desconectado + quality_rating).
  const loadHealth = useCallback(async () => {
    try {
      setHealthLoading(true);
      const res = await api.get<{ success: boolean; data: ChannelHealth[] }>('/api/settings/channels/health');
      setHealth(res?.data || []);
    } catch {
      // Fail-soft: sem saúde ao vivo, os cards ficam com o estado do formulário.
      setHealth([]);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // 13/08 — Callback URL + Verify Token da org (o cliente cadastra no app Meta
  // dele pra receber mensagens). Antes o produto pedia o webhook sem mostrar
  // nenhum dos dois.
  const loadWebhookInfo = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: WebhookInfo }>('/api/settings/channels/webhook-info');
      setWebhookInfo(res?.data || null);
    } catch {
      setWebhookInfo(null); // fail-soft: a caixa simplesmente não aparece
    }
  }, []);

  // 13/08 — teste de conexão read-only na Graph API com as credenciais salvas.
  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const res = await api.post<{ success: boolean; data: { whatsapp: ChannelTestResult; instagram: ChannelTestResult } }>(
        '/api/settings/channels/test',
      );
      setTestResults(res?.data || null);
    } catch (e: any) {
      setError(e?.message || 'Falha ao testar a conexão. Tente de novo.');
    } finally {
      setTesting(false);
    }
  }, []);

  useEffect(() => { load(); loadHealth(); loadWebhookInfo(); }, [load, loadHealth, loadWebhookInfo]);

  // Desconectar um canal: zera as credenciais na org (revogação). Pede confirmação
  // antes (o modal seta confirmDisconnect; aqui só executa).
  const handleDisconnect = useCallback(async (channel: ChannelKey) => {
    setError(null);
    setOkMsg(null);
    setConfirmDisconnect(null);
    setDisconnecting(channel);
    try {
      await api.post(`/api/settings/channels/${channel}/disconnect`);
      // Reflete o desligamento no formulário local + recarrega tudo do servidor.
      if (channel === 'whatsapp') { setWaPhone(''); setWaBiz(''); setWaToken(''); }
      else { setIgAccount(''); setIgPage(''); setIgToken(''); }
      await Promise.all([load(), loadHealth()]);
      setOkMsg(
        channel === 'whatsapp'
          ? 'WhatsApp desconectado. As credenciais foram removidas e o agente parou de atender por esse canal.'
          : 'Instagram desconectado. As credenciais foram removidas e o agente parou de atender por esse canal.',
      );
    } catch (e: any) {
      setError(e?.message || 'Falha ao desconectar o canal. Tente novamente.');
    } finally {
      setDisconnecting(null);
    }
  }, [load, loadHealth]);

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

    // 13/08 — formato: IDs da Meta são numéricos. Espelho da validação do
    // servidor pra falhar aqui, com mensagem clara, antes do request.
    const idOk = (v: string) => !v.trim() || /^\d{5,32}$/.test(v.trim());
    if (wantWa && !idOk(waPhone)) {
      setError('Phone Number ID deve conter só números — copie do painel da Meta, sem espaços nem letras.');
      return;
    }
    if (wantWa && !idOk(waBiz)) {
      setError('Business Account ID (WABA) deve conter só números.');
      return;
    }
    if (wantIg && !idOk(igAccount)) {
      setError('Instagram Account ID deve conter só números — copie do painel da Meta.');
      return;
    }
    if (wantIg && !idOk(igPage)) {
      setError('Page ID (Facebook) deve conter só números.');
      return;
    }

    setSaving(true);
    try {
      // Rota DEDICADA de canais: o PUT /api/settings é .strict() e barra tokens de
      // canal (W1.3). Aqui mandamos só os campos de canal + a intenção; o backend
      // mescla channelActivation no settings. (Era este o motivo do antigo erro 400.)
      const payload: Record<string, any> = {
        channelActivation: activation,
      };
      // Segredos (tokens + App Secret) só entram no payload quando o usuário digita
      // algo. O GET redige esses campos (voltam vazios do servidor), então reenviar
      // "" apagaria o que já está salvo. Omitir = o backend preserva o valor atual.
      if (metaAppSecret.trim()) payload.metaAppSecret = metaAppSecret.trim();
      if (wantWa) {
        payload.whatsappPhoneNumberId = waPhone.trim() || null;
        payload.whatsappBusinessAccountId = waBiz.trim() || null;
        if (waToken.trim()) payload.whatsappAccessToken = waToken.trim();
      }
      if (wantIg) {
        payload.instagramAccountId = igAccount.trim() || null;
        payload.instagramPageId = igPage.trim() || null;
        if (igToken.trim()) payload.instagramAccessToken = igToken.trim();
      }
      await api.put('/api/settings/channels', payload);
      setOrigSettings((s) => ({ ...s, channelActivation: activation }));
      await loadHealth();
      setOkMsg('Credenciais salvas! Rodamos o teste de conexão — confira o resultado abaixo. Para também RECEBER mensagens, cadastre o webhook com os dados da caixa "Receber mensagens (webhook)".');
      // 13/08 — prova na hora: nada de "salvo!" com token errado.
      void handleTest();
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  // Conectar WhatsApp em 1 clique (Embedded Signup). O popup da Meta devolve um
  // `code` (via FB.login) + waba_id/phone_number_id (via postMessage). Mandamos
  // pro backend /api/embedded-signup/whatsapp, que troca por token e grava na org.
  // v2 x v4: a decisão de config_id + extras fica em resolveWhatsAppSignupConfig
  // (v2 depreciada pela Meta, corte em 15/10/2026; a v4 dispensa
  // featureType/sessionInfoVersion e traz os eventos FINISH_ONLY_WABA e CANCEL).
  const launchWhatsAppSignup = useCallback(() => {
    const w = window as any;
    if (!w.FB) {
      setError('Carregando o conector da Meta… aguarde alguns segundos e tente de novo.');
      return;
    }
    setError(null);
    setOkMsg(null);
    sessionInfoRef.current = {};
    const signup = resolveWhatsAppSignupConfig(META_CONFIG_ID, META_CONFIG_ID_V4);
    w.FB.login(
      (response: any) => {
        const code = response?.authResponse?.code;
        const { wabaId, phoneNumberId, event, currentStep } = sessionInfoRef.current;
        // v4: FINISH_ONLY_WABA = concluiu o fluxo SEM registrar número. O backend
        // (/api/embedded-signup/whatsapp) exige code + wabaId + phoneNumberId no
        // schema, então sem número não há o que persistir sem inventar dado:
        // informamos o próximo passo e logamos o waba_id pro suporte.
        if (event === 'FINISH_ONLY_WABA') {
          console.warn('[EmbeddedSignup/WA] FINISH_ONLY_WABA: WABA criada sem número registrado', {
            wabaId: wabaId || null,
          });
          setError(
            'Sua conta WhatsApp Business foi criada na Meta, mas o fluxo terminou sem um número registrado. ' +
            'Clique em conectar de novo e conclua a etapa do número de telefone (ou registre o número no WhatsApp Manager antes). ' +
            'Se preferir, use o modo manual abaixo.',
          );
          return;
        }
        if (!code) {
          // v4: CANCEL traz current_step (onde a pessoa parou). Mensagem neutra.
          if (event === 'CANCEL' && currentStep) {
            setError(
              `Conexão com a Meta não concluída (você parou na etapa "${currentStep}"). ` +
              'Tente de novo quando quiser, ou conecte manualmente abaixo.',
            );
          } else {
            setError('Conexão com a Meta cancelada ou não autorizada. Você também pode conectar manualmente abaixo.');
          }
          return;
        }
        setWaConnecting(true);
        api
          .post('/api/embedded-signup/whatsapp', { code, wabaId, phoneNumberId })
          .then(async () => {
            await load();
            setOkMsg('WhatsApp conectado! Seu agente já pode atender pelo WhatsApp.');
          })
          .catch((e: any) => {
            setError(e?.message || 'Não consegui concluir a conexão automática. Tente o modo manual abaixo.');
          })
          .finally(() => setWaConnecting(false));
      },
      {
        config_id: signup.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: signup.extras,
      },
    );
  }, [load]);

  // Conectar Instagram em 1 clique (FB Login for Business pra IG).
  // Reusa o mesmo SDK do FB; apenas o config_id muda pra que a Meta saiba
  // que o popup eh pra IG Messaging (instagram_business_manage_messages).
  // Se META_IG_CONFIG_ID nao estiver setado, mostra mensagem pra CEO completar
  // setup no painel Meta.
  const launchInstagramSignup = useCallback(() => {
    const igConfigId = (process.env.NEXT_PUBLIC_META_IG_CONFIG_ID || '').trim();
    if (!igConfigId) {
      setError('Conector Instagram em configuracao pelo time. Use o modo manual abaixo por enquanto.');
      return;
    }
    const w = window as any;
    if (!w.FB) {
      setError('Carregando o conector da Meta… aguarde alguns segundos e tente de novo.');
      return;
    }
    setError(null);
    setOkMsg(null);
    w.FB.login(
      (response: any) => {
        const code = response?.authResponse?.code;
        if (!code) {
          setError('Conexao com Instagram cancelada ou nao autorizada. Use o modo manual abaixo.');
          return;
        }
        setIgConnecting(true);
        api
          .post('/api/embedded-signup/instagram', { code })
          .then(async () => {
            await load();
            setOkMsg('Instagram conectado! Seu agente ja pode atender pelo Direct.');
            // Passo obrigatório no app do Instagram — sem ele nada chega.
            setIgAccessOpen(true);
          })
          .catch((e: any) => {
            setError(e?.message || 'Nao consegui concluir a conexao automatica. Use o modo manual abaixo.');
          })
          .finally(() => setIgConnecting(false));
      },
      {
        config_id: igConfigId,
        response_type: 'code',
        override_default_response_type: true,
        // 13/08: SEM `extras` — setup/featureType/sessionInfoVersion são do
        // Embedded Signup do WHATSAPP. Herdados aqui, faziam a Meta abrir o
        // diálogo da WABA mesmo com config General de Instagram (bug visto
        // ao vivo pelo fundador). O login do IG é FB Login for Business puro.
      },
    );
  }, [load]);

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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Conectar canais</h2>
          <TourLauncher tourKey="conectar-whatsapp" autoStart />
        </div>
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
      <div data-tour="canais-ativar">
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

      {/* FEATURE 5b.3 — monitor de saúde dos canais + desconectar */}
      <ChannelHealthMonitor
        health={health}
        loading={healthLoading}
        disconnecting={disconnecting}
        onRefresh={loadHealth}
        onRequestDisconnect={(ch) => setConfirmDisconnect(ch)}
        onIgAccessHelp={() => setIgAccessOpen(true)}
      />

      {confirmDisconnect && (
        <ConfirmDisconnectModal
          channel={confirmDisconnect}
          busy={disconnecting === confirmDisconnect}
          onCancel={() => setConfirmDisconnect(null)}
          onConfirm={() => handleDisconnect(confirmDisconnect)}
        />
      )}

      {igAccessOpen && <InstagramAccessMensagensModal onClose={() => setIgAccessOpen(false)} />}

      {/* Conectar WhatsApp em 1 clique (Embedded Signup) — acima do manual */}
      {wantWa && (
        <div data-tour="canais-whatsapp-1clique" className="rounded-xl border border-green-200 bg-green-50/60 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
            <Smartphone size={22} className="text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1">
              Conectar WhatsApp em 1 clique
              <SaibaMais featureKey="settings.canais.whatsapp-1-clique" />
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Conecte pelo fluxo oficial da Meta — sem copiar IDs nem tokens. Você autoriza no popup e pronto.
            </p>
          </div>
          <button
            onClick={launchWhatsAppSignup}
            disabled={waConnecting}
            className="px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            {waConnecting ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />}
            {waConnecting ? 'Conectando…' : 'Conectar WhatsApp'}
          </button>
        </div>
      )}

      
      {/* Conectar Instagram em 1 clique (Embedded Signup) — acima do manual */}
      {wantIg && (
        <div className="rounded-xl border border-pink-200 bg-pink-50/60 p-5 flex flex-col sm:flex-row sm:items-center gap-4 mt-4">
          <div className="w-11 h-11 rounded-lg bg-pink-100 flex items-center justify-center shrink-0">
            <Instagram size={22} className="text-pink-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1">
              Conectar Instagram em 1 clique
              <SaibaMais featureKey="settings.canais.instagram-1-clique" />
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Conecte sua conta Instagram Business pelo fluxo oficial da Meta — sem copiar IDs nem tokens.
            </p>
          </div>
          <button
            onClick={launchInstagramSignup}
            disabled={igConnecting}
            className="px-4 py-2.5 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            {igConnecting ? <Loader2 size={15} className="animate-spin" /> : <Instagram size={15} />}
            {igConnecting ? 'Conectando…' : 'Conectar Instagram'}
          </button>
        </div>
      )}
{/* Formulário WhatsApp (manual / alternativa ao 1 clique) */}
      {wantWa && (
        <div data-tour="canais-whatsapp-manual">
        <ChannelForm
          title={
            <>
              WhatsApp Business
              <SaibaMais featureKey="settings.canais.whatsapp-manual" />
            </>
          }
          icon={<Smartphone size={20} className="text-green-600" />}
          connected={waConnected}
          accent="green"
          fields={[
            { label: 'Phone Number ID', value: waPhone, set: setWaPhone, placeholder: 'Ex: 123456789012345', hint: 'Meta Business Suite → WhatsApp → API Setup.' },
            { label: 'Business Account ID (WABA)', value: waBiz, set: setWaBiz, placeholder: 'Ex: 987654321098765', hint: 'Opcional, mas recomendado.' },
            { label: 'Access Token', value: waToken, set: setWaToken, placeholder: 'Token permanente do seu app Meta', secret: true, hint: 'Token de System User (permanente). Fica protegido.' },
          ]}
        />
        </div>
      )}

      {/* Formulário Instagram */}
      {wantIg && (
        <ChannelForm
          title={
            <>
              Instagram Direct
              <SaibaMais featureKey="settings.canais.instagram-manual" />
            </>
          }
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

      {/* Segurança do webhook — App Secret do app Meta do cliente */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <ShieldCheck size={20} className="text-gray-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1">
              Segurança do webhook (App Secret)
              <SaibaMais featureKey="settings.canais.app-secret" />
            </p>
            <p className="text-xs text-gray-500">
              Necessário se você usa seu próprio app Meta. Deixe em branco se conectou pelo onboarding assistido da ZappIQ.
            </p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">App Secret (Meta App)</label>
          <input
            type="password"
            value={metaAppSecret}
            onChange={(e) => setMetaAppSecret(e.target.value)}
            placeholder="App Secret do seu app Meta (Configurações → Básico)"
            autoComplete="off"
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Usamos só para validar a autenticidade das mensagens que chegam do seu Meta. Fica protegido.
          </p>
        </div>
      </div>

      {/* 13/08 — Receber mensagens (webhook por org). Só faz sentido no caminho
          manual (app Meta do cliente): mostra a Callback URL + Verify Token que
          antes o produto pedia sem nunca entregar. */}
      {webhookInfo && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Webhook size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Receber mensagens (webhook)</p>
              <p className="text-xs text-gray-500">
                Se você usa seu próprio app Meta, cadastre estes dados em Webhooks no painel do app.
                Sem isso, o agente envia mas não recebe. Quem conectou em 1 clique não precisa deste passo.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {wantWa && (
              <CopyRow label="Callback URL (WhatsApp)" value={webhookInfo.whatsapp.callbackUrl} />
            )}
            {wantIg && (
              <CopyRow label="Callback URL (Instagram)" value={webhookInfo.instagram.callbackUrl} />
            )}
            <CopyRow label="Verify Token (desta conta)" value={webhookInfo.verifyToken} />
          </div>
          <p className="text-xs text-gray-500">
            Depois de cadastrar, assine o campo <span className="font-mono">messages</span> no webhook
            {wantWa && wantIg ? ' dos produtos WhatsApp e Instagram' : wantIg ? ' do produto Instagram' : ' do produto WhatsApp'}.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Salvando…' : 'Salvar e ativar canais'}
        </button>
        {/* 13/08 — teste read-only na Graph API com as credenciais salvas. */}
        <button
          onClick={handleTest}
          disabled={testing || saving}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold border border-primary-500 text-primary-600 hover:bg-primary-50 disabled:opacity-50 flex items-center gap-2"
        >
          {testing ? <Loader2 size={15} className="animate-spin" /> : <PlugZap size={15} />}
          {testing ? 'Testando…' : 'Testar conexão'}
        </button>
      </div>

      {/* Resultado do teste por canal */}
      {testResults && (
        <div className="space-y-2" data-tour="canais-teste-resultado">
          {wantWa && (
            <TestResultRow
              icon={<Smartphone size={16} className="text-green-600" />}
              channelLabel="WhatsApp"
              result={testResults.whatsapp}
              okDetail={[testResults.whatsapp.displayPhoneNumber, testResults.whatsapp.verifiedName]
                .filter(Boolean)
                .join(' · ')}
            />
          )}
          {wantIg && (
            <TestResultRow
              icon={<Instagram size={16} className="text-pink-600" />}
              channelLabel="Instagram"
              result={testResults.instagram}
              okDetail={testResults.instagram.username ? `@${testResults.instagram.username}` : ''}
            />
          )}
        </div>
      )}

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

// ── Linha copiável (webhook info) ─────────────────────────────────────────────
function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-xs font-mono text-gray-800 truncate" title={value}>{value}</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch { /* clipboard bloqueado — o valor segue visível pra copiar na mão */ }
        }}
        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 shrink-0"
      >
        {copied ? <CheckCircle2 size={13} className="text-green-600" /> : <Copy size={13} />}
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

// ── Resultado do teste de conexão por canal ───────────────────────────────────
function TestResultRow({
  icon, channelLabel, result, okDetail,
}: { icon: React.ReactNode; channelLabel: string; result: ChannelTestResult; okDetail?: string }) {
  const notConfigured = result.error === 'not_configured';
  return (
    <div
      className={`rounded-lg border p-3 flex items-start gap-3 ${
        result.ok ? 'border-green-200 bg-green-50/60' : notConfigured ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50/60'
      }`}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          {channelLabel}
          {result.ok ? (
            <CheckCircle2 size={14} className="text-green-600" />
          ) : notConfigured ? null : (
            <XCircle size={14} className="text-red-600" />
          )}
          <span className={`text-xs font-medium ${result.ok ? 'text-green-700' : notConfigured ? 'text-gray-500' : 'text-red-700'}`}>
            {result.ok ? 'Conectado' : notConfigured ? 'Não configurado' : 'Falhou'}
          </span>
        </p>
        {result.ok && okDetail && <p className="text-xs text-gray-600 mt-0.5">{okDetail}</p>}
        {result.ok && result.viaGlobal && (
          <p className="text-xs text-blue-700 mt-0.5">Atendendo pela credencial global da plataforma.</p>
        )}
        {!result.ok && !notConfigured && result.error && (
          <p className="text-xs text-red-700 mt-0.5 break-words">{result.error}</p>
        )}
        {!result.ok && result.hint && <p className="text-xs text-gray-600 mt-0.5">{result.hint}</p>}
      </div>
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
  title: React.ReactNode;
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
        <p className="text-sm font-semibold text-gray-900 flex-1 inline-flex items-center gap-1">{title}</p>
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
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex flex-col sm:p-4 md:p-6" role="dialog" aria-modal="true">
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

// ── FEATURE 5b.3 — Monitor de saúde dos canais ────────────────────────────────
const CHANNEL_META: Record<ChannelKey, { label: string; icon: React.ReactNode; accent: 'green' | 'pink' }> = {
  whatsapp: { label: 'WhatsApp Business', icon: <Smartphone size={18} className="text-green-600" />, accent: 'green' },
  instagram: { label: 'Instagram Direct', icon: <Instagram size={18} className="text-pink-600" />, accent: 'pink' },
};

// Mapeia o quality_rating do número (Graph API) pra um selo legível.
function qualityBadge(rating?: string | null): { label: string; cls: string } | null {
  if (!rating) return null;
  const r = rating.toUpperCase();
  if (r === 'GREEN') return { label: 'Qualidade alta', cls: 'text-green-700 bg-green-50 border-green-200' };
  if (r === 'YELLOW') return { label: 'Qualidade média', cls: 'text-amber-700 bg-amber-50 border-amber-200' };
  if (r === 'RED') return { label: 'Qualidade baixa', cls: 'text-red-700 bg-red-50 border-red-200' };
  if (r === 'UNKNOWN') return null;
  return { label: `Qualidade: ${rating}`, cls: 'text-gray-700 bg-gray-50 border-gray-200' };
}

function ChannelHealthMonitor({
  health, loading, disconnecting, onRefresh, onRequestDisconnect, onIgAccessHelp,
}: {
  health: ChannelHealth[];
  loading: boolean;
  disconnecting: ChannelKey | null;
  onRefresh: () => void;
  onRequestDisconnect: (ch: ChannelKey) => void;
  onIgAccessHelp: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
          <Activity size={20} className="text-gray-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1">
            Saúde dos canais
            <SaibaMais featureKey="settings.canais.saude-qualidade" />
          </p>
          <p className="text-xs text-gray-500">Estado da conexão de cada canal e opção de desconectar.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Atualizar
        </button>
      </div>

      <div className="space-y-3">
        {(['whatsapp', 'instagram'] as ChannelKey[]).map((ch) => {
          const meta = CHANNEL_META[ch];
          const h = health.find((x) => x.channel === ch);
          const connected = !!h?.connected;
          const badge = qualityBadge(h?.qualityRating);
          const flagged = (h?.numberStatus || '').toUpperCase() === 'FLAGGED';
          return (
            <div
              key={ch}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-4 py-3"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <span className="shrink-0">{meta.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                        connected
                          ? 'text-green-700 bg-green-50 border-green-200'
                          : 'text-gray-500 bg-gray-100 border-gray-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {connected ? 'Conectado' : 'Desconectado'}
                    </span>
                    {connected && h?.viaGlobal && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border text-blue-700 bg-blue-50 border-blue-200">
                        via credencial global da plataforma
                      </span>
                    )}
                    {connected && badge && (
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                    {connected && flagged && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border text-red-700 bg-red-50 border-red-200">
                        Número sinalizado pela Meta
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {ch === 'instagram' && connected && (
                  <button
                    type="button"
                    onClick={onIgAccessHelp}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <AlertCircle size={13} />
                    Liberar acesso às mensagens
                  </button>
                )}
                {connected && !h?.viaGlobal && (
                  <button
                    type="button"
                    onClick={() => onRequestDisconnect(ch)}
                    disabled={disconnecting === ch}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {disconnecting === ch ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
                    Desconectar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── FEATURE 5b.3 — Confirmação de desconexão ─────────────────────────────────
function ConfirmDisconnectModal({
  channel, busy, onCancel, onConfirm,
}: {
  channel: ChannelKey;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const label = CHANNEL_META[channel].label;
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <AlertCircle size={20} className="text-red-600" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">Desconectar {label}?</p>
            <p className="text-sm text-gray-500 mt-1">
              Vamos remover as credenciais deste canal da sua organização. O agente para de
              atender por {label} até você reconectar. Essa ação não pode ser desfeita —
              você precisará conectar de novo (1 clique ou manual).
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <PlugZap size={15} />}
            {busy ? 'Desconectando…' : 'Sim, desconectar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 14/08 — Acesso às mensagens no app do Instagram ─────────────────────────
// A Meta só entrega DMs ao webhook depois que a própria conta profissional
// liga "Permitir acesso às mensagens" (Ferramentas conectadas) no app do
// Instagram. Visto ao vivo: conta conectada, assinatura ok, DM na caixa e
// NENHUM evento entregue até esse interruptor ligar. Caminho verificado em
// 14/08 (docs Meta + ManyChat/HubSpot/Bitrix24 2025-2026); o interruptor fica
// abaixo da dobra e o menu já mudou de lugar mais de uma vez.
function InstagramAccessMensagensModal({ onClose }: { onClose: () => void }) {
  // Caminho conferido em conta real (iOS pt-BR, 14/08) + variantes de versões
  // antigas do app. A Meta renomeia esses menus com frequência.
  const steps: React.ReactNode[] = [
    <>No Instagram, abra o seu <b>perfil</b> e toque no menu <b>☰</b> no canto superior direito.</>,
    <>Toque em <b>Mensagens e respostas a stories</b> (seção "Como outras pessoas podem interagir com você").</>,
    <>Toque em <b>Pedidos de contato</b> (em versões antigas: "Controles de mensagens" ou "Solicitações de mensagem").</>,
    <>Na seção <b>Ferramentas conectadas</b>, ative <b>"Permitir acesso às mensagens"</b>.</>,
    <>Logo abaixo, em <b>"Quem pode enviar pedidos de contato a você"</b>, marque <b>Todos</b>.</>,
  ];
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-50 flex items-center justify-center shrink-0">
            <Instagram size={20} className="text-pink-600" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">Importante: falta 1 passo no seu Instagram</p>
            <p className="text-sm text-gray-500 mt-1">
              Sem esta autorização, o Instagram <b>não entrega as mensagens do Direct</b> para a
              plataforma e seu agente não consegue responder. Leva 1 minuto, no app do Instagram
              da conta que você conectou.
            </p>
          </div>
        </div>

        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
              <span className="w-5 h-5 rounded-full bg-pink-100 text-pink-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <b>Já estava ativado e mesmo assim nada chega?</b> Desconecte e conecte o Instagram de
          novo nesta tela: a permissão vale para conexões feitas depois de o interruptor ligar.
        </div>

        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-800">Não encontrou a opção?</summary>
          <ul className="mt-2 space-y-1.5 list-disc pl-4">
            <li>
              Confirme que a conta é <b>profissional</b> (empresa ou criador): Configurações e
              atividade, depois "Tipo de conta e ferramentas".
            </li>
            <li>
              <b>Atualize o app</b> do Instagram na loja e abra de novo: versões antigas mostram o
              menu em outro lugar (Privacidade, depois Mensagens).
            </li>
            <li>
              Pelo computador: <b>Meta Business Suite</b> (business.facebook.com), em Configurações,
              Contas vinculadas, Instagram: conecte e confirme{' '}
              <b>"Permitir o acesso às mensagens do Instagram na Caixa de Entrada"</b>.
            </li>
          </ul>
        </details>

        <p className="text-xs text-gray-500">
          Depois de ativar, mande uma mensagem de teste de outra conta para a sua e acompanhe em
          Conversas.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Ver depois
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-pink-600 text-white hover:bg-pink-700 flex items-center gap-2"
          >
            <CheckCircle2 size={15} />
            Já ativei
          </button>
        </div>
      </div>
    </div>
  );
}

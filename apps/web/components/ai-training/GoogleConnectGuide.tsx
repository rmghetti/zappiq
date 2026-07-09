'use client';

/**
 * GoogleConnectGuide — popup grande e ilustrado que explica ao cliente como
 * conectar a agenda Google DELE ao agente. Abre a partir do link "Saiba como
 * conectar" no card de conexão. Fecha no X, no ESC ou clicando fora.
 *
 * Passos ilustrados com mini-mockups (CSS/SVG), sem depender de screenshots
 * externas (a página é self-contained). Copy em voz-humana.
 */
import { useEffect } from 'react';
import { X, MousePointerClick, ShieldCheck, CalendarCheck2, CheckCircle2, Lock, Sparkles } from 'lucide-react';

// ── Mini-ilustrações (mockups leves em CSS) ──────────────────────────
function ShotConnectButton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center justify-center">
      <span className="inline-flex items-center gap-1.5 bg-primary-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm">
        <GoogleG /> Conectar Google Calendar
      </span>
    </div>
  );
}
function ShotAccountPicker() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2 space-y-1">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50">
        <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold flex items-center justify-center">SN</div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-gray-800 leading-tight">Seu Negócio</p>
          <p className="text-[10px] text-gray-400 leading-tight truncate">contato@seunegocio.com.br</p>
        </div>
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5 rounded opacity-50">
        <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center">+</div>
        <p className="text-[11px] text-gray-500">Usar outra conta</p>
      </div>
    </div>
  );
}
function ShotConsent() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-1.5">
      <p className="text-[11px] font-medium text-gray-700">O ZappIQ quer acessar sua Agenda</p>
      {['Ver seus horários ocupados', 'Criar e gerenciar eventos'].map((t) => (
        <div key={t} className="flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
          <span className="text-[10px] text-gray-600">{t}</span>
        </div>
      ))}
      <div className="pt-1 flex justify-end">
        <span className="text-[10px] font-semibold text-white bg-primary-500 px-2.5 py-1 rounded">Permitir</span>
      </div>
    </div>
  );
}
function ShotDone() {
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2 justify-center">
      <CheckCircle2 size={16} className="text-green-600" />
      <span className="text-[11px] font-medium text-green-800">Agenda conectada</span>
    </div>
  );
}
function GoogleG() {
  return (
    <svg width="12" height="12" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C39.9 36.3 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

const STEPS = [
  {
    icon: MousePointerClick,
    title: 'Clique em "Conectar Google Calendar"',
    body: 'Aqui mesmo nesta tela, no cartão da sua agenda. É o único clique que começa tudo.',
    shot: <ShotConnectButton />,
  },
  {
    icon: GoogleG,
    title: 'Escolha a conta do seu negócio',
    body: 'O Google abre para você selecionar qual conta conectar. Use a conta onde está a agenda que você quer que a IA respeite.',
    shot: <ShotAccountPicker />,
  },
  {
    icon: ShieldCheck,
    title: 'Autorize o acesso à sua agenda',
    body: 'Você permite que o agente veja seus horários ocupados e crie os agendamentos. Só isso. A ZappIQ nunca vê a sua senha.',
    shot: <ShotConsent />,
  },
  {
    icon: CalendarCheck2,
    title: 'Pronto! Você volta conectado',
    body: 'A partir daí, a IA não oferece um horário que já está ocupado na sua agenda e cria cada agendamento direto nela. Você desconecta quando quiser.',
    shot: <ShotDone />,
  },
];

export function GoogleConnectGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Como conectar o Google Calendar">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-primary-50 to-secondary-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center"><GoogleG /></div>
            <div>
              <h3 className="text-base font-display font-bold text-gray-900">Como conectar seu Google Calendar</h3>
              <p className="text-xs text-gray-500">Leva menos de um minuto. Quatro passos.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 -m-1" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* Passos */}
        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon as any;
            return (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-primary-500 text-white text-sm font-bold flex items-center justify-center">{i + 1}</div>
                  {i < STEPS.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                </div>
                <div className="flex-1 pb-2 grid sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Icon size={15} className="text-primary-500" /> {s.title}</p>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">{s.body}</p>
                  </div>
                  <div>{s.shot}</div>
                </div>
              </div>
            );
          })}

          {/* Reforço de confiança */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><Lock size={13} className="text-gray-500" /> Seguro e no seu controle</p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className="flex gap-1.5"><CheckCircle2 size={13} className="text-green-500 flex-shrink-0 mt-0.5" /> A ZappIQ nunca vê a sua senha. A autorização é feita direto no Google.</li>
              <li className="flex gap-1.5"><CheckCircle2 size={13} className="text-green-500 flex-shrink-0 mt-0.5" /> Você pode desconectar a qualquer momento, com um clique.</li>
              <li className="flex gap-1.5"><Sparkles size={13} className="text-primary-500 flex-shrink-0 mt-0.5" /> Depois de conectar, a IA cria os agendamentos na sua agenda e evita choques de horário.</li>
            </ul>
          </div>

          <p className="text-[11px] text-gray-400 text-center">
            Se aparecer um aviso do Google dizendo que o app está em revisão, pode seguir com segurança: é o ZappIQ, e a conexão continua protegida.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-4 py-2">Entendi</button>
        </div>
      </div>
    </div>
  );
}

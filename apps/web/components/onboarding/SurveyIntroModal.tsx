'use client';

/**
 * SurveyIntroModal: recado de boas-vindas antes do cliente encarar o
 * questionário de qualificação (etapas 1+ do /onboarding).
 *
 * Por que existe: o questionário tem muita pergunta (soma global +
 * segmento + especialidades, em média ~200). Sem contexto, o cliente
 * assusta e abandona no meio. Este popup explica o motivo, garante que
 * dá pra ir aos poucos, situa o survey dentro do treinamento completo da
 * IA (documentos, Q&A, identidade, agendamento) e apresenta o Dash que
 * o espera do outro lado.
 */
import { useEffect, useRef } from 'react';
import {
  X,
  ClipboardList,
  Coffee,
  Layers,
  LayoutDashboard,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

const GRAD = 'bg-gradient-to-r from-[#2FB57A] via-[#2F7FB5] to-[#4A52D0]';

function Bloco({
  icon,
  titulo,
  children,
}: {
  icon: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-gray-100 px-6 py-5 first:border-t-0">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[#2F7FB5]">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
      </div>
      <div className="text-[14px] leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

export function SurveyIntroModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Foca o botão de fechar sem deixar o navegador rolar o próprio diálogo
    // pra "revelar" o botão focado, o que escondia o cabeçalho no load.
    closeRef.current?.focus({ preventScroll: true });
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Antes de começar o questionário"
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={`${GRAD} flex items-center justify-between px-6 py-5`}>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/80">Antes de começar</p>
            <h2 className="text-xl font-bold text-white">Um recado rápido sobre o que vem a seguir</h2>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-white/90 transition hover:bg-white/20 flex-shrink-0"
          >
            <X size={20} />
          </button>
        </header>

        <Bloco icon={<ClipboardList size={16} />} titulo="Por que o questionário é grande">
          <p>
            Você vai ver bastante pergunta pela frente, em média 200, variando com o segmento e as
            especialidades que escolher. Não é enrolação. Cada resposta vira conhecimento real que a IA
            usa quando conversa com o seu cliente. Quanto mais completo, mais ela entende o seu negócio,
            os seus produtos, as suas regras e o jeito que você atende. Isso aparece na conversa: uma IA
            que responde com precisão, sem inventar informação e sem enrolar quem está do outro lado.
          </p>
        </Bloco>

        <Bloco icon={<Coffee size={16} />} titulo="Vá no seu ritmo">
          <p>
            Você não precisa terminar tudo de uma vez. Dá pra avançar as telas, pular perguntas e voltar
            quando quiser: tudo fica salvo automaticamente. Preencha o que der agora e deixe o resto para
            depois. O importante é ir avançando aos poucos. Sua IA aprende conforme você preenche, não
            precisa estar perfeita no primeiro dia.
          </p>
        </Bloco>

        <Bloco icon={<Layers size={16} />} titulo="O questionário é só o primeiro passo">
          <p>
            Depois do cadastro, você encontra a aba <strong>Treinar IA</strong> no seu painel, com outras
            formas de ensinar sua IA além do questionário: anexar documentos (PDF, manual, tabela de
            preços), cadastrar perguntas e respostas frequentes, escrever textos livres sobre a identidade
            e o tom do seu agente, e configurar um calendário inteligente para ela marcar horários sozinha.
            Cada campo preenchido soma pontos no seu placar de prontidão da IA, disponível ali mesmo no
            painel.
          </p>
        </Bloco>

        <Bloco icon={<LayoutDashboard size={16} />} titulo="O que você vai encontrar no seu painel">
          <p>
            Assim que finalizar o cadastro, você cai direto no Dash. Lá estão as Conversas, com tudo que
            sua IA já atendeu, o CRM com Agenda, com cada lead e oportunidade organizados, o Zap Impulso,
            para disparar campanhas, o Maestro, para montar fluxos de atendimento sob medida, e o Radar
            360°, com as métricas de como sua IA está performando. É o comando central do seu atendimento.
          </p>
        </Bloco>

        <Bloco icon={<RefreshCw size={16} />} titulo="Sua IA se corrige sozinha">
          <p>
            Um dos maiores diferenciais do ZappIQ: toda semana a plataforma audita as respostas da sua IA,
            encontra desvios ou erros sozinha e sugere a correção. Você só aprova, edita ou recusa, e ela
            aprende com a sua decisão. Do erro até a correção são poucos minutos, sem precisar retreinar
            nada nem chamar consultor.
          </p>
        </Bloco>

        <div className="border-t border-gray-100 bg-gray-50 px-6 py-5 rounded-b-2xl">
          <p className="text-sm text-gray-600 mb-4">
            Preencha o quanto der agora. O resto você completa quando tiver um tempinho, sua IA agradece
            cada resposta.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={onClose}
              className="w-full sm:w-auto bg-primary-500 hover:bg-primary-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
            >
              Entendi, vamos começar <ArrowRight size={16} />
            </button>
            <a
              href="/como-funciona-survey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors underline underline-offset-2"
            >
              Quero entender tudo em detalhe antes
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

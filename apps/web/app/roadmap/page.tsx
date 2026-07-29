/* ══════════════════════════════════════════════════════════════════════════
 * /roadmap: Página pública de transparência (V2-020 Sprint 0 Blocker 6)
 * --------------------------------------------------------------------------
 * Desativa o discurso de "Voz Padrão R$197 / Voz Premium R$497" no
 * planConfig público e oferece em troca:
 *   - timeline transparente do que vem por aí
 *   - status atual de cada item
 *   - waitlist (mailto temporário até criar form Resend dedicado)
 *   - opções para clientes que compraram add-on Voz no trial
 *
 * Server Component (SEO friendly, sem state). Forms são links mailto
 * por enquanto: reaproveitar /api/leads em Onda 2 quando entrar.
 * ══════════════════════════════════════════════════════════════════════════ */

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Roadmap · ZappIQ',
  description:
    'O que vem por aí na ZappIQ: voz, RAG avançado, builder self-service, observabilidade. Timeline transparente, status real.',
  openGraph: {
    title: 'Roadmap · ZappIQ',
    description: 'Timeline pública do que estamos construindo.',
    type: 'website',
  },
};

type Status = 'shipped' | 'in_progress' | 'planned';

interface RoadmapItem {
  title: string;
  description: string;
  eta: string;
  status: Status;
}

const ROADMAP: RoadmapItem[] = [
  // ─── Shipped ───────────────────────────────────────────────────────
  {
    title: 'Iza com Anthropic Claude Sonnet 4.6',
    description:
      'Conversação principal com Claude Sonnet 4.6, modelo frontier da Anthropic, calibrado para português brasileiro.',
    eta: 'Disponível',
    status: 'shipped',
  },
  {
    title: 'RAG sobre seus documentos',
    description:
      'Treine a Iza com PDFs, planilhas e URLs do seu negócio. Embeddings Voyage voyage-3, busca vetorial pgvector com índice HNSW.',
    eta: 'Disponível',
    status: 'shipped',
  },
  {
    title: 'Multi-provider LLM com fallback automático',
    description:
      'Cascade Claude Sonnet 4.6 → Claude Haiku 4.5 → GPT-4o-mini com circuit breaker. Outage de um provedor não afeta a Iza dos clientes.',
    eta: 'Disponível',
    status: 'shipped',
  },
  {
    title: 'LGPD by design',
    description:
      'DSR (6 tipos: acesso, deleção, correção, anonimização, portabilidade, revogação), audit logs com cadeia hash tamper-evident, dados em São Paulo.',
    eta: 'Disponível',
    status: 'shipped',
  },

  // ─── In progress ───────────────────────────────────────────────────
  {
    title: 'Backpressure no webhook WhatsApp',
    description:
      'Migração da inferência para fila BullMQ com retry estruturado e deadletter. Garante que pico de mensagens não derrube o serviço.',
    eta: 'Maio/2026',
    status: 'in_progress',
  },
  {
    title: 'Observabilidade dedicada de LLM (Langfuse)',
    description:
      'Traces detalhados de cada chamada Iza, prompts versionados, eval de qualidade. Self-hosted no Brasil pra LGPD.',
    eta: 'Maio/2026',
    status: 'in_progress',
  },
  {
    title: 'Cost-per-tenant dashboard',
    description:
      'Visibilidade do custo de IA por cliente, prompt caching ativado para reduzir até 60% do consumo.',
    eta: 'Junho/2026',
    status: 'in_progress',
  },

  // ─── Planned ───────────────────────────────────────────────────────
  {
    title: 'Voz Padrão e Voz Premium',
    description:
      'Recebimento de áudio (transcrição via Whisper) e envio de respostas em voz natural (Cartesia padrão / ElevenLabs premium). Adiada conscientemente do lançamento atual para ser entregue com qualidade.',
    eta: 'Julho/2026',
    status: 'planned',
  },
  {
    title: 'Builder self-service da Iza',
    description:
      'Wizard de 8 etapas (15-25min) para o próprio cliente configurar a Iza dele: identidade, tom, conhecimento, habilidades, escalação.',
    eta: 'Julho-Agosto/2026',
    status: 'planned',
  },
  {
    title: 'RAG avançado: hybrid search + Cohere Rerank + Contextual Retrieval',
    description:
      'BM25 + dense retrieval com fusion, reranker multilíngue, chunks contextualizados, ganho esperado 35-49% recall.',
    eta: 'Agosto/2026',
    status: 'planned',
  },
  {
    title: 'Active learning loop',
    description:
      'Detecção automática de clusters de problemas (perguntas mal respondidas, escalations recorrentes) com sugestões para o builder.',
    eta: 'Setembro/2026',
    status: 'planned',
  },
];

const STATUS_LABEL: Record<Status, string> = {
  shipped: 'Disponível',
  in_progress: 'Em desenvolvimento',
  planned: 'Planejado',
};

const STATUS_COLOR: Record<Status, string> = {
  shipped: '#2FB57A',
  in_progress: '#4A52D0',
  planned: '#A0A0A0',
};

export default function RoadmapPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#FAFAF7', color: '#171717' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '80px 24px 120px' }}>
        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <Link
            href="/"
            style={{
              fontSize: 13,
              color: '#737373',
              textDecoration: 'none',
              letterSpacing: '0.04em',
            }}
          >
            ← voltar para zappiq.com.br
          </Link>
          <h1
            style={{
              fontSize: 'clamp(36px, 5vw, 56px)',
              fontWeight: 500,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              marginTop: 24,
              marginBottom: 16,
            }}
          >
            Roadmap:{' '}
            <span style={{ color: '#737373' }}>o que vem por aí.</span>
          </h1>
          <p
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: '#525252',
              maxWidth: 680,
            }}
          >
            Construímos a ZappIQ em público. Esta página mostra o que já está
            no ar, o que estamos terminando agora, e o que vem depois, com
            datas reais e status honesto. Atualizada mensalmente.
          </p>
        </div>

        {/* Aviso transparente sobre Voz */}
        <div
          style={{
            background: '#FFF7ED',
            border: '1px solid #FED7AA',
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 48,
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: '#9A3412', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Importante · sobre a Voz
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: '#7C2D12' }}>
            A funcionalidade de Voz (áudio de entrada via Whisper, áudio de saída via TTS premium)
            era inicialmente planejada para o lançamento. Decidimos adiá-la para julho/2026 para
            entregá-la com qualidade. Não queremos vender o que não está pronto. Se você se
            inscreveu para o add-on de Voz no trial,{' '}
            <a
              href="mailto:vendas@zappiq.com.br?subject=Add-on%20Voz%20-%20opc%C3%A3o%20escolhida"
              style={{ color: '#9A3412', fontWeight: 600 }}
            >
              fale com a gente
            </a>{' '}
            para escolher entre extensão gratuita de 90 dias do plano principal
            <em>ou</em> reembolso integral.
          </p>
        </div>

        {/* Grid de items */}
        <div style={{ display: 'grid', gap: 16 }}>
          {ROADMAP.map((item, idx) => (
            <article
              key={idx}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E5E4DE',
                borderRadius: 14,
                padding: '24px 28px',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 20,
                alignItems: 'start',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: STATUS_COLOR[item.status],
                      background: `${STATUS_COLOR[item.status]}15`,
                      padding: '4px 10px',
                      borderRadius: 6,
                    }}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                  <span style={{ fontSize: 12, color: '#737373', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                    {item.eta}
                  </span>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 8 }}>
                  {item.title}
                </h2>
                <p style={{ fontSize: 14.5, lineHeight: 1.55, color: '#525252' }}>
                  {item.description}
                </p>
              </div>
            </article>
          ))}
        </div>

        {/* Waitlist */}
        <div
          style={{
            marginTop: 64,
            background: '#FFFFFF',
            border: '1px solid #E5E4DE',
            borderRadius: 16,
            padding: '32px 36px',
            textAlign: 'center',
          }}
        >
          <h3 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 10 }}>
            Quer ser avisado quando a Voz entrar?
          </h3>
          <p style={{ fontSize: 14.5, color: '#525252', marginBottom: 20, lineHeight: 1.55 }}>
            Mande um e-mail e a gente avisa antes de virar pra o público geral.
          </p>
          <a
            href="mailto:vendas@zappiq.com.br?subject=Waitlist%20Voz%20ZappIQ"
            style={{
              display: 'inline-block',
              background: '#171717',
              color: '#FFFFFF',
              padding: '12px 28px',
              borderRadius: 10,
              textDecoration: 'none',
              fontSize: 14.5,
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            Entrar na waitlist da Voz →
          </a>
        </div>

        {/* Footer */}
        <p
          style={{
            marginTop: 56,
            fontSize: 12,
            color: '#A8A8A8',
            textAlign: 'center',
            letterSpacing: '0.02em',
          }}
        >
          Atualizado em {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} ·{' '}
          ZappIQ
        </p>
      </div>
    </main>
  );
}

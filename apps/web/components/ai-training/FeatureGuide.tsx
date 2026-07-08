'use client';

/**
 * FeatureGuide — descritivo por função do Treinamento da IA.
 *
 * Cada fonte que alimenta a IA (Qualificação, Documentos, Q&A, Identidade,
 * Playground) ganha um card explicando, em linguagem do dono do negócio:
 *   • O que é       — o que aquela função faz
 *   • Como usar     — o passo a passo prático
 *   • Na sua IA     — o resultado concreto que aquilo gera no atendimento
 *
 * Fica recolhido mostrando só um resumo de uma linha + "Como funciona".
 * O cliente abre o quadro completo quando quer e fecha no X. A escolha é
 * lembrada por função (localStorage) pra não repetir a cada visita.
 */
import { useEffect, useState } from 'react';
import { Info, X, ChevronDown } from 'lucide-react';

export interface GuideContent {
  /** chave estável p/ lembrar se o cliente já fechou (localStorage) */
  id: string;
  title: string;
  summary: string;
  what: string;
  how: string[];
  result: string;
}

export function FeatureGuide({ content }: { content: GuideContent }) {
  const storageKey = `zappiq_guide_open:${content.id}`;
  // Começa aberto na primeira vez; depois respeita a escolha do cliente.
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) setOpen(saved === '1');
    } catch {
      /* localStorage indisponível — mantém aberto */
    }
    setReady(true);
  }, [storageKey]);

  const persist = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? '1' : '0');
    } catch {
      /* ignora */
    }
  };

  // Evita flash: só renderiza depois de ler o localStorage.
  if (!ready) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => persist(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline"
      >
        <Info size={13} /> Como funciona: {content.title}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-primary-100 bg-primary-50/60 overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
          <Info size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{content.title}</p>
          <p className="text-xs text-gray-600 mt-0.5">{content.summary}</p>
        </div>
        <button
          type="button"
          onClick={() => persist(false)}
          className="text-gray-400 hover:text-gray-600 p-1 -m-1 flex-shrink-0"
          aria-label="Fechar explicação"
          title="Fechar (você pode reabrir depois)"
        >
          <X size={15} />
        </button>
      </div>

      <div className="px-4 pb-4 pt-0 space-y-3 border-t border-primary-100/70">
        <GuideBlock label="O que é">{content.what}</GuideBlock>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700 mb-1">
            Como usar
          </p>
          <ol className="space-y-1">
            {content.how.map((step, i) => (
              <li key={i} className="text-xs text-gray-700 flex gap-2">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <GuideBlock label="O que acontece com a sua IA">{content.result}</GuideBlock>
      </div>
    </div>
  );
}

function GuideBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700 mb-1">{label}</p>
      <p className="text-xs text-gray-700 leading-relaxed">{children}</p>
    </div>
  );
}

/**
 * Conteúdo canônico dos descritivos. Fonte única — se um dia mudar o produto,
 * muda aqui e reflete em todas as abas.
 */
export const GUIDES: Record<string, GuideContent> = {
  survey: {
    id: 'survey',
    title: 'Qualificação do seu negócio',
    summary: 'O questionário que ensina à IA quem você é, o que vende e como fala.',
    what:
      'É o retrato do seu negócio em perguntas: mercado, ofertas, diferenciais, público, objeções comuns e regras de atendimento. É a base mais importante, porque contextualiza tudo o que a IA responde.',
    how: [
      'Responda o máximo de perguntas que conseguir. Quanto mais completo, mais precisa fica a IA.',
      'As respostas salvam sozinhas enquanto você digita. Pode voltar e editar quando quiser.',
      'Sempre que atualizar algo do negócio (preço, oferta, política), volte aqui e ajuste.',
    ],
    result:
      'Cada resposta vira conhecimento consultável pela IA no atendimento. Ela passa a responder com o contexto do seu negócio em vez de dar respostas genéricas.',
  },
  documents: {
    id: 'documents',
    title: 'Documentos e conteúdos',
    summary: 'Arquivos, links do seu site ou textos colados que a IA usa como fonte de verdade.',
    what:
      'Aqui você abastece a IA com material real: contratos, catálogos, tabelas de preço, FAQs, políticas, páginas do seu site. A IA lê tudo isso e passa a responder com base no seu conteúdo, não em suposições.',
    how: [
      'Suba arquivos (PDF, TXT, DOCX, planilhas) com informações que sua equipe usa no dia a dia.',
      'Cole links do seu site (sobre, preços, FAQ). A IA lê a página e aprende com ela.',
      'Ou cole um texto direto, quando a informação não está em arquivo nem em link.',
      'Confira o selo verde "indexado" ao lado de cada item. Se aparecer "não indexado", o conteúdo ainda não chegou à IA.',
    ],
    result:
      'Cada documento é quebrado em trechos e vetorizado. Quando um cliente pergunta algo, a IA busca os trechos mais relevantes e responde com base neles, citando a informação certa.',
  },
  qa: {
    id: 'qa',
    title: 'Perguntas e Respostas',
    summary: 'Respostas prontas para as dúvidas que mais se repetem no seu atendimento.',
    what:
      'São pares de pergunta e resposta que você mesmo escreve. É a forma mais direta de garantir que a IA responda exatamente do jeito que você quer nas perguntas mais comuns (horário, formas de pagamento, prazos, garantia).',
    how: [
      'Escreva a pergunta como o cliente costuma fazer e a resposta oficial da sua empresa.',
      'Use a prioridade para as respostas mais importantes: elas ganham preferência quando a IA busca contexto.',
      'Desative uma resposta que ficou desatualizada. Ela sai da IA na hora, sem precisar apagar.',
    ],
    result:
      'Cada Q&A vira um trecho de alta confiança na base. Perguntas cobertas aqui são respondidas com a sua resposta oficial, com prioridade sobre o resto do material.',
  },
  identity: {
    id: 'identity',
    title: 'Identidade do agente',
    summary: 'O nome, o tom de voz, as mensagens e o horário que definem a personalidade da IA.',
    what:
      'Aqui você molda COMO a IA se comporta: o nome com que ela se apresenta, se fala de forma amigável ou formal, a saudação inicial, a mensagem ao passar para um humano e o horário de funcionamento.',
    how: [
      'Dê um nome e escolha o tom de voz que combina com a sua marca.',
      'Escreva a saudação e a mensagem de transbordo do jeito que sua empresa fala.',
      'Preencha o horário de atendimento para a IA saber quando você atende presencialmente.',
    ],
    result:
      'Diferente dos documentos, a identidade entra direto na "personalidade" da IA a cada conversa. Muda de imediato o jeito de falar, o nome e o comportamento em todos os atendimentos.',
  },
  playground: {
    id: 'playground',
    title: 'Testar minha IA',
    summary: 'Converse com a sua IA agora, exatamente como o seu cliente vai conversar.',
    what:
      'É um ensaio real: você faz uma pergunta e a IA responde usando tudo o que você treinou até aqui, sem precisar conectar o WhatsApp. Nenhuma conversa de verdade é criada.',
    how: [
      'Digite uma pergunta que um cliente faria de verdade.',
      'Veja a resposta e, abaixo, quais fontes a IA usou para respondê-la.',
      'Se a resposta não ficou boa, volte às outras abas, ajuste o conteúdo e teste de novo.',
    ],
    result:
      'Usa o mesmo motor do atendimento real. O que você vê aqui é fiel ao que o cliente veria no WhatsApp, então dá para validar o treino antes de ir ao ar.',
  },
};

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Send, ArrowRight, MessageCircle, Bot } from 'lucide-react';
import { PublicLayout } from '../../components/landing/PublicLayout';

/* ------------------------------------------------------------------ */
/* Cenarios de demonstracao                                            */
/* ------------------------------------------------------------------ */

type Scenario = {
  id: string;
  label: string;
  icon: string;
  greeting: string;
  pairs: { keywords: string[]; response: string }[];
  fallback: string;
};

const SCENARIOS: Scenario[] = [
  {
    id: 'clinica',
    label: 'Sou uma Clinica',
    icon: '🏥',
    greeting: 'Ola! Bem-vindo a Clinica Vida Plena. Sou a assistente virtual. Como posso ajudar voce hoje?',
    pairs: [
      {
        keywords: ['agendar', 'consulta', 'marcar'],
        response: 'Claro! Para qual especialidade? Temos Dermatologia, Cardiologia e Clinica Geral. Escolha abaixo ou digite.',
      },
      {
        keywords: ['horario', 'funcionamento', 'aberto', 'abre', 'fecha'],
        response: 'Segunda a sexta, 8h as 18h. Sabados, 8h as 12h. Deseja agendar?',
      },
      {
        keywords: ['preco', 'valor', 'quanto custa', 'custo'],
        response: 'Consulta particular: R$250. Aceitamos Unimed, Bradesco Saude e SulAmerica. Deseja agendar?',
      },
      {
        keywords: ['convenio', 'plano', 'unimed', 'bradesco', 'sulamerica'],
        response: 'Trabalhamos com Unimed, Bradesco Saude, SulAmerica e Porto Seguro. Qual e o seu?',
      },
      {
        keywords: ['endereco', 'localizacao', 'onde fica', 'mapa', 'maps'],
        response: 'Estamos na Av. Paulista, 1500 - Conj. 304, Sao Paulo-SP. Quer que eu envie no Maps?',
      },
      {
        keywords: ['exame', 'resultado'],
        response: 'Posso verificar o status do seu exame. Por favor, me informe seu CPF ou numero do protocolo.',
      },
    ],
    fallback: 'Entendi! Posso ajudar com agendamento, horarios, valores ou localizacao. O que prefere?',
  },
  {
    id: 'ecommerce',
    label: 'Sou um E-commerce',
    icon: '🛒',
    greeting: 'Oi! Bem-vindo a TrendMix Moda. Sou a assistente virtual. Posso ajudar com pedidos, trocas ou novidades!',
    pairs: [
      {
        keywords: ['pedido', 'rastreio', 'rastrear', 'entrega', 'status'],
        response: 'Me informe o numero do pedido e vou verificar o status em tempo real para voce!',
      },
      {
        keywords: ['troca', 'devolver', 'devolucao', 'trocar'],
        response: 'Voce tem ate 30 dias para troca gratis! Me envie o numero do pedido e o motivo, e ja inicio o processo.',
      },
      {
        keywords: ['frete', 'entrega', 'prazo'],
        response: 'Frete gratis acima de R$199. Entrega em 3-5 dias uteis para capitais. Quer calcular o frete para seu CEP?',
      },
      {
        keywords: ['tamanho', 'medida', 'tabela'],
        response: 'Temos P, M, G e GG. Posso enviar a tabela de medidas do produto que voce esta vendo. Qual peca?',
      },
      {
        keywords: ['cupom', 'desconto', 'promocao', 'oferta'],
        response: 'Voce tem sorte! Use o cupom PRIMEIRA10 para 10% off na primeira compra. Valido ate o fim do mes!',
      },
      {
        keywords: ['pagamento', 'pagar', 'pix', 'cartao', 'parcela'],
        response: 'Aceitamos PIX (5% off), cartao em ate 6x sem juros e boleto. Qual prefere?',
      },
    ],
    fallback: 'Posso ajudar com pedidos, trocas, frete, tamanhos ou promocoes. O que voce precisa?',
  },
  {
    id: 'b2b',
    label: 'Sou uma Empresa B2B',
    icon: '🏢',
    greeting: 'Ola! Bem-vindo a Nexus Consultoria. Sou a assistente virtual. Posso ajudar com informacoes sobre nossos servicos!',
    pairs: [
      {
        keywords: ['servico', 'solucao', 'produto', 'oferecem'],
        response: 'Oferecemos consultoria em transformacao digital, automacao de processos e inteligencia de dados. Qual area mais te interessa?',
      },
      {
        keywords: ['preco', 'valor', 'orcamento', 'proposta', 'investimento'],
        response: 'Os projetos partem de R$5.000/mes. Posso agendar uma call com nosso consultor para montar uma proposta personalizada. Que tal?',
      },
      {
        keywords: ['agendar', 'reuniao', 'call', 'conversar'],
        response: 'Perfeito! Tenho horarios disponiveis amanha as 10h, 14h ou 16h. Qual funciona melhor para voce?',
      },
      {
        keywords: ['case', 'resultado', 'cliente', 'referencia'],
        response: 'Temos cases com +40% de eficiencia e -35% de custo operacional. Posso enviar nosso portfolio com resultados detalhados!',
      },
      {
        keywords: ['prazo', 'tempo', 'implementacao', 'cronograma'],
        response: 'Projetos tipicos levam 4-8 semanas para implementacao completa. Fazemos uma POC em 2 semanas para validar. Quer saber mais?',
      },
      {
        keywords: ['contato', 'email', 'telefone', 'responsavel'],
        response: 'Nosso time comercial esta disponivel pelo e-mail contato@nexus.com ou telefone (11) 3000-0000. Prefere que eu agende uma ligacao?',
      },
    ],
    fallback: 'Posso ajudar com informacoes sobre servicos, precos, agendamento ou cases de sucesso. O que prefere saber?',
  },
];

const FINAL_MESSAGE = 'Isso e exatamente o que seus clientes vao experimentar com o Pulse AI. Quer ativar no seu WhatsApp?';

/* ------------------------------------------------------------------ */
/* Componentes auxiliares                                               */
/* ------------------------------------------------------------------ */

type ChatMessage = { role: 'user' | 'bot'; text: string };

function matchResponse(input: string, scenario: Scenario): string {
  const lower = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const pair of scenario.pairs) {
    for (const kw of pair.keywords) {
      const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (lower.includes(kwNorm)) return pair.response;
    }
  }
  return scenario.fallback;
}

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */

export function DemoPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[][]>(
    SCENARIOS.map((s) => [{ role: 'bot', text: s.greeting }]),
  );
  const [input, setInput] = useState('');
  const [showFinal, setShowFinal] = useState<boolean[]>([false, false, false]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;

    const scenario = SCENARIOS[activeTab];
    const reply = matchResponse(text, scenario);

    setMessages((prev) => {
      const copy = [...prev];
      copy[activeTab] = [...copy[activeTab], { role: 'user', text }, { role: 'bot', text: reply }];

      // Mostrar mensagem final apos 3 interacoes do usuario
      const userCount = copy[activeTab].filter((m) => m.role === 'user').length;
      if (userCount >= 3 && !showFinal[activeTab]) {
        copy[activeTab] = [...copy[activeTab], { role: 'bot', text: FINAL_MESSAGE }];
        setShowFinal((prev) => {
          const c = [...prev];
          c[activeTab] = true;
          return c;
        });
      }

      return copy;
    });

    setInput('');
  }

  const currentMessages = messages[activeTab];

  return (
    <PublicLayout>
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Demo Interativa</p>
          <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-5">
            Teste o Pulse AI agora mesmo
          </h1>
          <p className="text-lg text-gray-500">
            Escolha um cenario e converse com a IA como se fosse um cliente real. Veja como o Pulse AI atende, qualifica e converte.
          </p>
        </div>
      </div>

      {/* Demo area */}
      <div className="max-w-2xl mx-auto px-6 pb-20">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {SCENARIOS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveTab(i)}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                activeTab === i
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
              }`}
            >
              <span className="mr-1.5">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Chat Window */}
        <div className="bg-[#ECE5DD] rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
          {/* Chat header */}
          <div className="bg-[#075E54] px-5 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Pulse AI</p>
              <p className="text-white/60 text-xs">online</p>
            </div>
          </div>

          {/* Messages */}
          <div className="h-[420px] overflow-y-auto p-4 space-y-3">
            {currentMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#DCF8C6] text-gray-800 rounded-tr-sm'
                      : 'bg-white text-gray-800 rounded-tl-sm shadow-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="bg-[#F0F0F0] px-4 py-3 flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-white rounded-full px-5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none border border-gray-200 focus:border-primary-400 transition-colors"
            />
            <button
              onClick={handleSend}
              className="w-10 h-10 rounded-full bg-[#075E54] flex items-center justify-center text-white hover:bg-[#064E46] transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>

        {/* Sugestoes */}
        <div className="mt-4 flex flex-wrap gap-2">
          {SCENARIOS[activeTab].pairs.slice(0, 4).map((p) => (
            <button
              key={p.keywords[0]}
              onClick={() => {
                setInput(p.keywords[0]);
              }}
              className="text-xs bg-white border border-gray-200 rounded-full px-4 py-1.5 text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
            >
              {p.keywords[0]}
            </button>
          ))}
        </div>
      </div>

      {/* CTA */}
      <section className="py-20 bg-[#1A1A2E]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-5">
            <MessageCircle size={28} className="text-secondary-400" />
            <h2 className="font-display text-3xl lg:text-4xl font-extrabold text-white">
              Ativar no meu WhatsApp
            </h2>
          </div>
          <p className="text-gray-400 mb-8">
            Seus clientes terao essa mesma experiencia. Configure em minutos, sem codigo.
          </p>
          {/* PLACEHOLDER: substituir por dado real */}
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg shadow-secondary-500/30 text-base"
          >
            Comecar Gratis <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}

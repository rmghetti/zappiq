'use client';

/**
 * IntegrationHelpModal — o "Saiba mais" das integrações do Zap Impulso.
 *
 * Popup grande, ilustrado e passo a passo, para o cliente (muitas vezes leigo)
 * entender O QUE É a integração, PARA QUE SERVE, COMO CONSEGUIR os dados que
 * precisa e ONDE COLAR na plataforma. Fecha no X, ESC ou clique fora; o painel
 * de Integrações continua atrás.
 *
 * Segue o padrão MACHIA de "Saiba mais": ilustrações em SVG/CSS inline (sem
 * imagem externa por CSP), copy em voz-humana (sem travessão).
 */
import { useEffect } from 'react';
import { X, Zap, Check, HelpCircle, ArrowRight, ClipboardCheck } from 'lucide-react';

const GRAD = 'bg-gradient-to-r from-[#2FB57A] via-[#2F7FB5] to-[#4A52D0]';

export type HelpTopic = 'capi' | 'asaas';

// ─── Mini-mockups (ilustrações) ────────────────────────────────
// Janela estilizada de navegador, para ambientar cada passo sem screenshot real.
function BrowserFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border-b border-gray-200">
        <span className="w-2 h-2 rounded-full bg-[#FF5F57]" />
        <span className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
        <span className="w-2 h-2 rounded-full bg-[#28C840]" />
        <span className="ml-2 text-[10px] text-gray-400 truncate">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// Botão "clicável" destacado (com aro pulsante) para apontar o alvo do passo.
function Hotspot({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-flex">
      <span className="absolute inset-0 rounded-md ring-2 ring-[#4A52D0] animate-pulse" />
      <span className="relative inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#4A52D0] text-white text-[11px] font-semibold">
        {children}
      </span>
    </span>
  );
}

function Field({ label, value, filled }: { label: string; value: string; filled?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-medium text-gray-500 mb-0.5">{label}</p>
      <div className={`h-6 rounded border px-2 flex items-center text-[10px] font-mono truncate ${filled ? 'border-[#2FB57A] bg-[#F0FAF5] text-gray-700' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
        {value}
      </div>
    </div>
  );
}

// ── Ilustrações do Meta CAPI ──
const CapiIllos: Record<string, () => JSX.Element> = {
  eventsManager: () => (
    <BrowserFrame title="business.facebook.com · Gerenciador de Eventos">
      <div className="flex gap-2">
        <div className="w-24 space-y-1">
          <div className="h-4 rounded bg-gray-100" />
          <Hotspot>Conectar dados</Hotspot>
          <div className="h-4 rounded bg-gray-100" />
          <div className="h-4 rounded bg-gray-100" />
        </div>
        <div className="flex-1 h-16 rounded bg-gray-50 border border-dashed border-gray-200" />
      </div>
    </BrowserFrame>
  ),
  chooseMessages: () => (
    <BrowserFrame title="Conectar uma nova fonte de dados">
      <div className="space-y-1.5">
        <div className="h-6 rounded border border-gray-200 bg-gray-50 flex items-center px-2 text-[10px] text-gray-400">Web</div>
        <div className="h-6 rounded border border-gray-200 bg-gray-50 flex items-center px-2 text-[10px] text-gray-400">App</div>
        <div className="rounded border-2 border-[#4A52D0] bg-[#F3F4FE] flex items-center px-2 py-1.5 text-[11px] font-semibold text-[#4A52D0] gap-1">
          <Check size={12} /> Mensagens (WhatsApp, Messenger, Instagram)
        </div>
      </div>
    </BrowserFrame>
  ),
  connectPage: () => (
    <BrowserFrame title="Conectar uma Página do Facebook">
      <div className="rounded border-2 border-[#4A52D0] bg-[#F3F4FE] flex items-center px-2 py-1.5 gap-2">
        <div className="w-5 h-5 rounded-full bg-[#4A52D0]/20" />
        <div>
          <p className="text-[11px] font-semibold text-gray-800">Sua Página (com o WhatsApp)</p>
          <p className="text-[9px] text-gray-500">Compartilha conversas do WhatsApp e Messenger</p>
        </div>
      </div>
    </BrowserFrame>
  ),
  directIntegration: () => (
    <BrowserFrame title="Escolha um caminho">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-gray-200 bg-gray-50 p-2 text-[10px] text-gray-400">Integração de parceiros</div>
        <div className="rounded border-2 border-[#4A52D0] bg-[#F3F4FE] p-2 text-[10px] font-semibold text-[#4A52D0] flex items-center gap-1">
          <Check size={12} /> Integração direta
        </div>
      </div>
    </BrowserFrame>
  ),
  generateToken: () => (
    <BrowserFrame title="Configurações · Integração direta">
      <div className="space-y-2">
        <Hotspot>Gerar token de acesso</Hotspot>
        <Field label="Token (aparece após gerar)" value="EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
      </div>
    </BrowserFrame>
  ),
  datasetId: () => (
    <BrowserFrame title="Conjuntos de dados">
      <div className="rounded border border-gray-200 p-2">
        <p className="text-[11px] font-semibold text-gray-800">Seu conjunto de Mensagens</p>
        <p className="text-[10px] text-gray-500">Identificação (Dataset ID): <span className="font-mono text-[#4A52D0] font-semibold">2254313065369785</span></p>
      </div>
    </BrowserFrame>
  ),
  pasteZappiq: () => (
    <BrowserFrame title="ZappIQ · Configurações · Integrações">
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-gray-700 flex items-center gap-1"><Zap size={11} className="text-[#4A52D0]" /> Meta CAPI</p>
        <Field label="Dataset ID" value="2254313065369785" filled />
        <Field label="Access Token" value="•••••••••••••••••••• (colado)" filled />
        <div className="flex justify-end">
          <span className="px-2 py-1 rounded bg-[#4A52D0] text-white text-[10px] font-semibold">Conectar Meta CAPI</span>
        </div>
      </div>
    </BrowserFrame>
  ),
};

// ── Ilustrações do Asaas ──
const AsaasIllos: Record<string, () => JSX.Element> = {
  createAccount: () => (
    <BrowserFrame title="asaas.com · Criar conta">
      <div className="space-y-1.5">
        <Field label="CNPJ ou CPF" value="preenchido por você" />
        <Field label="Dados bancários" value="conta que recebe o Pix" />
        <div className="flex justify-end">
          <span className="px-2 py-1 rounded bg-[#2FB57A] text-white text-[10px] font-semibold">Criar conta</span>
        </div>
      </div>
    </BrowserFrame>
  ),
  getApiKey: () => (
    <BrowserFrame title="Asaas · Configurações · Integrações · API">
      <div className="space-y-2">
        <Hotspot>Gerar/Copiar Chave de API</Hotspot>
        <Field label="Chave de API (secreta)" value="$aact_xxxxxxxxxxxxxxxxxxxxxxxx" />
      </div>
    </BrowserFrame>
  ),
  pasteZappiq: () => (
    <BrowserFrame title="ZappIQ · Configurações · Integrações">
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-gray-700">Asaas (Pix na conversa)</p>
        <Field label="API Key do Asaas" value="•••••••••••••••••••• (colada)" filled />
        <div className="flex justify-end">
          <span className="px-2 py-1 rounded bg-[#4A52D0] text-white text-[10px] font-semibold">Conectar Asaas</span>
        </div>
      </div>
    </BrowserFrame>
  ),
  webhook: () => (
    <BrowserFrame title="Asaas · Webhooks · Adicionar">
      <div className="space-y-1.5">
        <Field label="URL (copie do ZappIQ)" value=".../api/webhook/asaas" filled />
        <Field label="Token de autenticação (copie do ZappIQ)" value="a1b2c3d4..." filled />
        <p className="text-[9px] text-gray-500">Marque os eventos de pagamento (PAYMENT_RECEIVED / CONFIRMED).</p>
      </div>
    </BrowserFrame>
  ),
};

interface Step {
  title: string;
  desc: string;
  illo: () => JSX.Element;
}

interface HelpContent {
  title: string;
  what: string[];
  benefit: string;
  stepsTitle: string;
  steps: Step[];
  fields: { label: string; hint: string }[];
  note?: string;
}

const CONTENT: Record<HelpTopic, HelpContent> = {
  capi: {
    title: 'Meta CAPI (Conversions API)',
    what: [
      'O Meta CAPI é o canal que devolve para a Meta a informação de que uma conversa que começou num anúncio terminou em venda.',
      'Sem ele, a Meta só sabe quem clicou no seu anúncio e abriu o WhatsApp. Com ele, toda venda fechada no CRM volta para a Meta como um evento de "Compra", com o valor.',
    ],
    benefit:
      'Resultado: o algoritmo de anúncios para de mirar quem só clica e passa a mirar quem realmente COMPRA. Seus anúncios ficam mais baratos e trazem mais vendas ao longo do tempo. É o que fecha o Loop de Receita do Zap Impulso.',
    stepsTitle: 'Como conseguir o Dataset ID e o Token (uma vez só)',
    steps: [
      { title: 'Abra o Gerenciador de Eventos', desc: 'No Meta Business (business.facebook.com), menu "Todas as ferramentas" e depois "Gerenciador de Eventos". Clique em "Conectar dados".', illo: CapiIllos.eventsManager },
      { title: 'Escolha "Mensagens"', desc: 'Entre as fontes (Web, App, Offline, CRM, Mensagens), selecione "Mensagens". É a opção feita para conversas de WhatsApp vindas de anúncio.', illo: CapiIllos.chooseMessages },
      { title: 'Conecte a sua Página do Facebook', desc: 'Escolha a Página que tem o seu WhatsApp conectado. A Meta cria um conjunto de dados ligado a ela.', illo: CapiIllos.connectPage },
      { title: 'Escolha "Integração direta"', desc: 'Quando perguntar o caminho, escolha "Integração direta" (a de parceiros é para quem usa intermediário, que não é o caso do ZappIQ).', illo: CapiIllos.directIntegration },
      { title: 'Gere e copie o Token', desc: 'Em Configurações do conjunto, seção "Integração direta", clique em "Gerar token de acesso". Copie o token na hora (começa com EAA...); ele costuma aparecer uma vez só.', illo: CapiIllos.generateToken },
      { title: 'Copie o Dataset ID', desc: 'É o número de identificação do conjunto de dados de Mensagens (não use o de App). Fica visível na lista de conjuntos de dados.', illo: CapiIllos.datasetId },
      { title: 'Cole aqui no ZappIQ e conecte', desc: 'Volte a esta tela, cole o Dataset ID e o Access Token nos campos do card Meta CAPI e clique em Conectar. O status vira "Configurado".', illo: CapiIllos.pasteZappiq },
    ],
    fields: [
      { label: 'Dataset ID', hint: 'o número de identificação do conjunto de dados de Mensagens' },
      { label: 'Access Token', hint: 'o token que começa com EAA..., gerado na "Integração direta"' },
    ],
    note: 'O token é secreto: ele é cifrado no servidor assim que você salva e nunca volta a aparecer na tela. Não precisa nos enviar por mensagem.',
  },
  asaas: {
    title: 'Asaas (Pix na conversa)',
    what: [
      'O Asaas é um processador de pagamentos brasileiro (Pix, boleto, cartão).',
      'O ZappIQ usa a sua conta Asaas para gerar uma cobrança Pix (código copia e cola) direto dentro da conversa do WhatsApp, sem o cliente sair para outro app.',
    ],
    benefit:
      'O dinheiro cai direto na SUA conta bancária, o ZappIQ nunca guarda o seu dinheiro. Quando o Pix é pago, o Asaas nos avisa, o CRM marca a venda como ganha sozinho e (se a conversa veio de anúncio) dispara o evento de compra para a Meta.',
    stepsTitle: 'Como conseguir a API Key e ligar o webhook',
    steps: [
      { title: 'Crie sua conta no Asaas', desc: 'Acesse asaas.com e faça o cadastro da sua empresa (CNPJ ou CPF e dados bancários). Essa parte só você pode fazer, porque envolve seus dados e sua conta que recebe.', illo: AsaasIllos.createAccount },
      { title: 'Pegue a Chave de API', desc: 'No Asaas, vá em Configurações, Integrações, API, e copie a sua Chave de API. Ela é secreta.', illo: AsaasIllos.getApiKey },
      { title: 'Cole a API Key no ZappIQ', desc: 'Volte a esta tela, cole a chave no card Asaas e clique em Conectar. O status vira "Configurado" e o ZappIQ gera para você uma URL e um token de webhook.', illo: AsaasIllos.pasteZappiq },
      { title: 'Configure o webhook no Asaas', desc: 'No Asaas, em Webhooks, adicione um novo com a URL e o token que o ZappIQ mostrou, e marque os eventos de pagamento. É isso que avisa o ZappIQ quando um Pix é pago.', illo: AsaasIllos.webhook },
    ],
    fields: [
      { label: 'API Key do Asaas', hint: 'a Chave de API copiada em Configurações, Integrações, API' },
    ],
    note: 'A API Key é secreta: cifrada no servidor ao salvar, nunca volta à tela. Disponível nos planos Pro e Scale.',
  },
};

export function IntegrationHelpModal({ topic, onClose }: { topic: HelpTopic | null; onClose: () => void }) {
  useEffect(() => {
    if (!topic) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [topic, onClose]);

  if (!topic) return null;
  const c = CONTENT[topic];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[94vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`relative px-6 py-6 text-white ${GRAD}`}>
          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white" aria-label="Fechar">
            <X size={18} />
          </button>
          <div className="flex items-center gap-2 text-white/90 text-xs font-semibold uppercase tracking-wide">
            <Zap size={14} /> Zap Impulso · Integração
          </div>
          <h2 className="text-2xl font-bold mt-2">{c.title}</h2>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* O que é */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <HelpCircle size={15} className="text-[#4A52D0]" /> O que é
            </h3>
            <div className="mt-2 space-y-2">
              {c.what.map((p, i) => (
                <p key={i} className="text-sm text-gray-600 leading-relaxed">{p}</p>
              ))}
            </div>
          </section>

          {/* Para que serve */}
          <section className="rounded-xl border border-[#CDE9DA] bg-[#E4F3EC] p-4">
            <h3 className="text-sm font-bold text-[#1B7A54] flex items-center gap-2">
              <Check size={15} /> Para que serve
            </h3>
            <p className="text-sm text-[#245c45] mt-1.5 leading-relaxed">{c.benefit}</p>
          </section>

          {/* Passo a passo ilustrado */}
          <section>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3">
              <ArrowRight size={15} className="text-[#2F7FB5]" /> {c.stepsTitle}
            </h3>
            <ol className="space-y-4">
              {c.steps.map((s, i) => (
                <li key={i} className="grid sm:grid-cols-[1fr_260px] gap-3 items-center">
                  <div className="flex items-start gap-3">
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full ${GRAD} text-white text-xs font-bold flex items-center justify-center`}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                      <p className="text-[13px] text-gray-600 leading-snug mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                  <div className="sm:justify-self-end w-full sm:w-[260px]">{s.illo()}</div>
                </li>
              ))}
            </ol>
          </section>

          {/* O que colar em cada campo */}
          <section className="rounded-xl border border-[#E3E4F7] bg-[#F7F7FD] p-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <ClipboardCheck size={15} className="text-[#4A52D0]" /> O que vai em cada campo
            </h3>
            <ul className="mt-2 space-y-1.5">
              {c.fields.map((f) => (
                <li key={f.label} className="text-sm text-gray-700">
                  <span className="font-semibold">{f.label}:</span> <span className="text-gray-600">{f.hint}</span>
                </li>
              ))}
            </ul>
            {c.note && <p className="text-[12px] text-gray-500 mt-2.5 leading-snug">{c.note}</p>}
          </section>

          <div className="flex justify-end pt-1">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              <X size={14} /> Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

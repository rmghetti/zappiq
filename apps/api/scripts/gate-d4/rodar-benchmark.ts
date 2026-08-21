/* ══════════════════════════════════════════════════════════════════════
 * Gate D4 (Resposta Meta out/2026) · Benchmark de custo LLM POR RESPOSTA
 * --------------------------------------------------------------------
 * Percorre o corpus (scripts/gate-d4/corpus/*.jsonl) e, para cada turno
 * do cliente, chama o ROTEADOR REAL da Iza (routeIzaTurn) medindo, por
 * resposta: chamadas LLM, tokens in/out e custo estimado. Sai um
 * relatorio.md com P50/P90, chamadas por resposta, distribuição por
 * vertical e o veredito do gate D4:
 *
 *   custo por resposta (P90) <= R$ 0,03  → APROVA a grade nova
 *   entre R$ 0,03 e R$ 0,05              → DEGRAU (franquias 20% menores)
 *   acima de R$ 0,05                     → REPROVA (mantém régua atual)
 *
 * Modos:
 *   estimativa (default): OFFLINE. Nenhuma chamada de rede, banco ou
 *     Redis. O metodo llmRouter.complete é interceptado por um simulador
 *     que conta as chamadas que o roteador REAL decide fazer e estima
 *     tokens por heurística declarada (ver PREMISSAS no relatório).
 *   real: exige chaves de provider no ambiente e chama as APIs de
 *     verdade (custa dinheiro). Ver README.md antes de usar.
 *
 * Uso:
 *   cd apps/api
 *   npx tsx scripts/gate-d4/rodar-benchmark.ts
 *   npx tsx scripts/gate-d4/rodar-benchmark.ts --tier GROWTH --cambio 5.15
 *   npx tsx scripts/gate-d4/rodar-benchmark.ts --modo real   (ver README)
 *
 * O que roda de VERDADE mesmo no modo estimativa:
 *   - routeIzaTurn completo (pre-filter de verticais, classifyIntent com
 *     montagem real do prompt de classify e parse real da resposta,
 *     lógica de escalada por intent, montagem das mensagens, contagem
 *     de chamadas)
 *   - TIER_PRIMARY_PROVIDER real (mapa tier → provider do LLMRouter)
 *   - estimateCostUsd real (a MESMA função que o llmCallAudit usa)
 *   - CORE_AGENT_RULES_V1 real no system prompt (tamanho de produção)
 *
 * O que fica MOCKADO no modo estimativa (documentado no relatório):
 *   - llmRouter.complete: não chama rede; assume o provider PRIMÁRIO da
 *     cadeia sempre saudável (sem fallback, sem circuit breaker)
 *   - resposta do classify: intentEsperada do corpus quando anotada,
 *     senão heurística regex declarada abaixo
 *   - texto da resposta principal: a resposta da "iza" que segue no
 *     corpus (quando existe) ou tamanho default por classe de caso
 *   - tokens: chars/3.5 arredondado pra cima + overhead por mensagem
 * ══════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));

// ── 0. Argumentos ────────────────────────────────────────────────────
function lerArg(nome: string, padrao: string): string {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}
const MODO = lerArg('modo', 'estimativa') as 'estimativa' | 'real';
const TIER_PRINCIPAL = lerArg('tier', 'GROWTH');
// Câmbio derivado da referência do próprio plano (tarifa Meta: R$ 0,0350 = US$ 0,0068).
const USD_BRL = Number(lerArg('cambio', process.env.GATE_D4_USD_BRL || '5.15'));
const ARQ_RELATORIO = resolve(DIR, lerArg('saida', 'relatorio.md'));

// ── 1. Bootstrap de ambiente ANTES de importar código de src/ ────────
// O config/env.ts valida DATABASE_URL e JWT_SECRET no import. No modo
// estimativa nada consulta banco nem Redis (prisma e ioredis são lazy),
// então valores dummy satisfazem a validação sem abrir conexão alguma.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://gate-d4:offline@127.0.0.1:1/nunca-conecta';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'gate-d4-benchmark-offline-sem-uso-0123456789';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
if (MODO === 'estimativa') {
  // Garantia dura de offline: sem chave nenhuma no processo.
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
}

// ── 2. Tipos do corpus e da medição ──────────────────────────────────
interface MensagemCorpus {
  de: 'cliente' | 'iza';
  texto: string;
  intentEsperada?: string;
}
interface CasoCorpus {
  vertical: string;
  caso: string;
  classe: string;
  mensagens: MensagemCorpus[];
}
interface ChamadaMedida {
  operation: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  custoUsd: number;
}
interface RespostaMedida {
  vertical: string;
  caso: string;
  classe: string;
  turno: number;
  intent: string;
  escalada: boolean;
  chamadas: number;
  inputTokens: number;
  outputTokens: number;
  custoUsd: number;
  custoBrl: number;
}

// ── 3. Heurísticas declaradas (PREMISSAS do modo estimativa) ─────────
// Tokens: pt-BR em modelos atuais fica na faixa de 3 a 4 chars/token.
// Usamos 3,5 chars/token + 4 tokens de overhead estrutural por mensagem
// + 10 tokens fixos por chamada (role tags, stop sequences).
const CHARS_POR_TOKEN = 3.5;
const OVERHEAD_POR_MENSAGEM = 4;
const OVERHEAD_POR_CHAMADA = 10;

function tokensDeTexto(texto: string): number {
  return Math.ceil((texto || '').length / CHARS_POR_TOKEN);
}

// Comprimento default da resposta simulada (chars) quando o corpus não
// traz a resposta da iza na sequência (último turno do caso).
const RESPOSTA_DEFAULT_POR_CLASSE: Record<string, number> = {
  simples: 320,
  faq: 380,
  rag: 700,
  recorrente: 350,
  negociacao: 800,
  confuso: 480,
  audio: 750,
  handoff: 300,
  'adversarial-contexto': 800,
  'adversarial-picadas': 350,
  'adversarial-assunto': 500,
};

// Heurística de intent (backstop quando o corpus não anota intentEsperada).
// Espelha as categorias do intentClassifier real; a ordem de prioridade
// importa (handoff > enterprise > objection > price_question > purchase).
function intentHeuristica(msg: string): string {
  const t = (msg || '').toLowerCase();
  if (/falar com (uma )?(pessoa|humano|gente|atendente)|n[aã]o quero (falar com )?(rob[oô]|bot|ia)\b|prefiro (um )?humano|quero atendimento humano|chega de rob[oô]|me transfere|pede pro .* me ligar/.test(t)) return 'handoff';
  if (/\b(ceo|cto|diretor(a)?\b)|\d{3,}\s*(mensagens|atendimentos|pedidos)\s*(por|\/)\s*dia|rede de \d+/.test(t)) return 'enterprise';
  if (/t[aá] caro|caro demais|muito caro|mais barato em|mais barato\.|concorrente|desconto se|cobrem a oferta|igualam|faz por \d|isentar|negocia/.test(t)) return 'objection';
  if (/quanto custa|quanto fica|quanto sai|qual o (pre[cç]o|valor)|quanto t[aá]|tabela de pre[cç]o|^quanto\?$|me passa o total/.test(t)) return 'price_question';
  if (/^(quero|quero sim|fechado|fechou|bora|pode mandar|manda o link|aceito|ok manda|sim quero|topo|vou come[cç]ar)\b/.test(t)) return 'purchase_intent';
  return 'normal';
}

// ── 4. System prompts sintéticos por vertical ────────────────────────
// Em produção o prompt é CORE_AGENT_RULES_V1 + fatos + prompt do tenant
// + links + bloco do cliente + RAG + data. Aqui espelhamos a estrutura
// com um prompt de tenant realista por vertical (o CORE é o REAL).
const PROMPT_TENANT: Record<string, string> = {
  clinica: `# Lia, assistente da Clínica Vitalis

Você é a Lia, assistente virtual da Clínica Vitalis, clínica de odontologia e estética em Campinas (Rua das Palmeiras, 220, Cambuí). Atende pacientes pelo WhatsApp com tom acolhedor, claro e profissional, sempre em português do Brasil.

## O que a clínica oferece
Odontologia: avaliação (R$ 150, abatida se fechar tratamento em 15 dias), limpeza simples (R$ 180), profilaxia premium (R$ 220), restaurações (a partir de R$ 280), canal (R$ 750 a R$ 1.100), extração de siso, ortodontia (aparelho fixo metálico, estético e alinhadores invisíveis de R$ 4.900 a R$ 8.900), clareamento a laser (3 sessões) e lentes de contato dental (R$ 1.890 por dente com pacote para 4+). Estética: toxina botulínica, preenchimento, bioestimulador e harmonização facial, com avaliação estética gratuita.

## Regras de atendimento
1. Horários: segunda a sexta 8h às 19h, sábado 8h às 13h. Urgência tem encaixe no dia (consulta de urgência R$ 180, abatida do tratamento).
2. Convênios odontológicos aceitos: VidaPlus, OdontoBem e SorriaMais. Estética é sempre particular, parcelável em até 12x.
3. Sempre conduza para o agendamento da avaliação. Ofereça no máximo 2 horários por vez.
4. Retorno pós-procedimento em até 30 dias não tem custo.
5. Nunca dê diagnóstico fechado por mensagem: acolha, oriente cuidados imediatos e traga para avaliação presencial.
6. Combo família: duas limpezas no mesmo dia por R$ 320.
7. Preços: informe com clareza no formato R$ X. Descontos além dos listados só a dentista autoriza na avaliação.`,
  ecommerce: `# Duda, assistente da Loja Trama

Você é a Duda, assistente virtual da Loja Trama, e-commerce brasileiro de moda feminina (100% online). Atende clientes pelo WhatsApp com tom próximo, ágil e prestativo, em português do Brasil.

## O que a loja oferece
Vestuário feminino: vestidos (midi Laura R$ 249,90, midi tricô canelado R$ 279,90), calças (wide leg sarja R$ 259,90, jeans reta R$ 239,90), blazers (estruturado R$ 329,90), tricôs (R$ 199 cada), cardigans (R$ 229,90), segunda pele térmica (R$ 89,90), camisetas básicas (R$ 79,90, kit 2 por R$ 139,90, kit 4 por R$ 279,60), saias (plissada R$ 199,90) e conjuntos (linho R$ 359,90). Não vendemos calçados nem acessórios.

## Regras de atendimento
1. Frete: grátis acima de R$ 249 (padrão). Prazos: capitais 3 a 5 dias úteis, expresso 1 a 2.
2. Trocas: 30 dias corridos, primeira troca grátis com código de postagem. Peça sem uso e com etiqueta.
3. Pagamento: Pix com 5% de desconto; cartão em até 6x sem juros acima de R$ 200 (3x abaixo); aceita 2 cartões.
4. Cupons: TRAMA10 (10% primeira compra), TRAMAVIP15 (15% clientes antigas). Não acumulam com peças em promoção (aplica o maior).
5. Segunda peça do carrinho tem 10% off.
6. Sempre confirme tamanho pela tabela de medidas antes de fechar. Em dúvida entre dois tamanhos, explique o caimento do modelo.
7. Rastreio: envie o link sempre que o cliente perguntar de pedido. Problemas de entrega: abra ocorrência e dê prazo de resposta de 24h úteis.
8. Não prometa reposição de estoque sem confirmar; ofereça aviso de reposição.`,
  distribuidora: `# Tino, assistente da Distribuidora Serra Azul

Você é o Tino, assistente virtual da Distribuidora Serra Azul, distribuidora de bebidas B2B (atende mercados, bares, adegas e conveniências). Tom direto, parceiro e eficiente, em português do Brasil.

## O que a distribuidora oferece
Água mineral (fardo 510ml R$ 17,90; com gás R$ 19,90), refrigerantes 2L (cola fardo R$ 36,90; guaraná R$ 33,90; laranjinha lata fardo R$ 28,90), cervejas (pilsen lata 350 fardo 12un R$ 42,90, acima de 30 fardos R$ 41,50; puro malte R$ 49,90/R$ 48,20; long neck pilsen pack 24 R$ 79,90, puro malte R$ 94,90), sucos 1L (caixa 12un R$ 54,90, validade mínima 6 meses), energéticos (lata 269 fardo 24 R$ 105,60; 1L caixa 12 R$ 118,80; 2L caixa 6 R$ 96,00, código EN-2000) e linha de vinhos (caixa 6 garrafas a partir de R$ 210).

## Regras de atendimento
1. Pedido mínimo: primeira compra 10 fardos ou R$ 800; depois R$ 500. Frete grátis nas rotas.
2. Rotas: capital diária; interior (raio 100 km) terça e quinta. Pedido até 14h sai no mesmo dia. Carregamento no galpão 7h às 16h30.
3. Crédito: CNPJ novo paga à vista nos 3 primeiros pedidos; depois boleto 7 dias; após 3 meses regulares, 14 ou 21 dias conforme volume. Redes com contrato: até 28 dias mediante análise.
4. Pedido programado semanal com confirmação um dia antes (sem confirmação, não fatura).
5. Volume: acima de 30 fardos aplica preço de faixa; 50+ fardos semanais é cliente âncora (condições especiais, registrar para o comercial fechar).
6. Troca de avariado na entrega seguinte, sem burocracia.
7. Segunda via de boleto e código Pix: envie na hora. Notas e faturamento: confirme sempre o número da nota.
8. Cotações de rede/contrato mensal: colete volumes, praças e condições e encaminhe ao comercial com prazo firme.`,
  servicos: `# Rafa, assistente da OficinaTech

Você é o Rafa, assistente virtual da OficinaTech, assistência técnica de celulares, notebooks e informática corporativa. Tom técnico acessível, honesto e resolutivo, em português do Brasil.

## O que a oficina oferece
Celulares: troca de tela (iPhone 12: premium R$ 420, original R$ 740; iPhone 13: premium R$ 450, original R$ 790; feita em até 2h com película de brinde), troca de bateria, conector de carga (microssolda, R$ 150 de mão de obra), limpeza de oxidação (banho ultrassônico, R$ 180). Notebooks: formatação com backup (R$ 160; pacote empresarial 3+ máquinas R$ 130 cada com retirada e devolução), troca de bateria (Dell Inspiron 15 3520: R$ 420; Latitude 5420: R$ 445 instalada), limpeza térmica com troca de pasta (R$ 180, 1 dia útil), upgrades (RAM 32GB R$ 480, SSD NVMe 1TB R$ 520). Corporativo: manutenção de plotters e impressoras no local (deslocamento R$ 90, abatido se aprovar o reparo), pacotes por etapas para não parar a operação. Compra de usados conforme avaliação em bancada.

## Regras de atendimento
1. Horários: seg a sex 9h às 18h30, sábado 9h às 14h. Atendimento por ordem de chegada ou agendado por aqui.
2. Orçamento e diagnóstico gratuitos (exceção única: desmontagem complexa de placa de notebook, R$ 50, abatida se aprovar).
3. Garantia: 90 dias em peça e serviço, registrada na ordem de serviço. Não cobre queda, líquido ou mau uso.
4. Nunca feche diagnóstico à distância: dê hipóteses, oriente testes seguros e traga para a bancada.
5. Aparelho molhado: orientar a NÃO ligar, não carregar, não usar arroz/secador, trazer o quanto antes.
6. Descontos: limite de 10% no Pix à vista autorizado por aqui; abaixo disso, só o técnico.
7. Status de conserto: confirme pela ordem de serviço (OS) e dê previsão concreta. Avise por aqui quando sair da bancada.`,
};

// Bloco de RAG sintético usado nos casos de classe "rag" (em produção o
// ragContext vem do retrieval; nas demais classes fica o texto padrão de
// "sem contexto", igual ao caminho real quando nada passa do piso).
const RAG_POR_VERTICAL: Record<string, string> = {
  clinica: `[Documento: protocolo-clareamento.pdf] O clareamento em consultório da Clínica Vitalis utiliza gel de peróxido de hidrogênio a 35% ativado por luz híbrida. Protocolo padrão: 3 sessões de 45 minutos com intervalo de 7 dias. Contraindicações: gestantes, menores de 16 anos, restaurações extensas em dentes anteriores (avaliar plano combinado). Protocolo combinado: sessões em consultório + moldeira com peróxido de carbamida 22% por 10 noites.\n[Documento: pos-operatorio.pdf] Sensibilidade leve ao frio é esperada por 7 a 14 dias após restaurações. Orientações: evitar extremos de temperatura, creme dental para sensibilidade, não mastigar duros do lado tratado. Dor forte, latejante ou progressiva: reavaliação imediata; retorno em até 30 dias sem custo.\n[Documento: tabela-servicos.pdf] Limpeza simples: ultrassom + polimento, 40 min, R$ 180. Profilaxia premium: ultrassom + jato de bicarbonato (manchas extrínsecas de café, chá e cigarro) + flúor + escovação orientada, 60 min, R$ 220.`,
  ecommerce: `[Documento: catalogo-atual.csv] Vestido midi Laura: viscose com forro, evasê, comprimento 118 cm no M. Cores: terracota (M: 3 un), verde oliva, off white. R$ 249,90. Cuidados: lavagem à mão ou ciclo delicado, sem secadora; tecido amassa pouco.\n[Documento: fichas-tecnicas.csv] Calça wide leg preta: 97% algodão, 3% elastano, forro de bolso 100% algodão, cintura alta, cós com meio elástico atrás, sem transparência. Blazer estruturado: ombro marcado, tecido sem elastano; tabela: M veste busto 94-98 cm, G veste 99-104 cm; recomendação para sobreposição: subir um tamanho. Cores: preto, caramelo (G: 5 un). R$ 329,90.\n[Documento: politica-frete.md] Frete grátis padrão acima de R$ 249. BH: 3-5 dias úteis padrão, 1-2 expresso.`,
  distribuidora: `[Documento: tabela-agosto.xlsx] Cerveja pilsen lata 350 fardo 12: R$ 42,90 (30+ fardos: R$ 41,50). Puro malte lata: R$ 49,90 (30+: R$ 48,20). Long neck pilsen pack 24: R$ 79,90 (20+ packs: R$ 77,50). Long neck puro malte: R$ 94,90 (20+: R$ 92,00). Preços à vista, validade da tabela: semana corrente.\n[Documento: catalogo-skus.xlsx] EN-2000 energético 2L caixa 6un R$ 96,00. EN-1000 energético 1L caixa 12un R$ 118,80. EN-269 energético lata 269ml fardo 24un R$ 105,60 (maior giro em conveniência).\n[Documento: politica-validade.md] Sucos 1L: saída do galpão com validade mínima restante de 6 meses; média real de entrega 8-9 meses. Lote mínimo: caixa fechada 12un por sabor. Troca de defeito de fábrica na entrega seguinte.`,
  servicos: `[Documento: tabela-servicos.xlsx] Bateria notebook Dell Inspiron 15: faixa R$ 380-520 por geração. Inspiron 15 3520: bateria célula original R$ 420, troca + teste de ciclo, 2 dias úteis, garantia 90 dias. Telas iPhone 12: premium R$ 420, original R$ 740. iPhone 13: premium R$ 450, original R$ 790. Original preserva True Tone e custa 60-80% mais.\n[Documento: procedimento-oxidacao.md] Aparelho molhado: NÃO ligar, não carregar, não usar secador nem arroz (acelera corrosão). Desligar, secar externamente, trazer imediatamente. Limpeza: desmontagem completa + banho ultrassônico, R$ 180 celulares. Diagnóstico aponta componentes comprometidos; chance de recuperação cai com o tempo.\n[Documento: politica-pecas.md] Telas premium homologadas: consumo de bateria equivalente à original (mito válido só para linhas paralelas de baixa qualidade, não trabalhamos). Instalação e película inclusas.`,
};

// ── 5. Execução ──────────────────────────────────────────────────────
async function main() {
  // Imports dinâmicos DEPOIS do bootstrap de env.
  const { llmRouter, TIER_PRIMARY_PROVIDER } = await import('../../src/services/llm/LLMRouter.js');
  const { routeIzaTurn } = await import('../../src/services/llm/izaTurnRouter.js');
  const { estimateCostUsd } = await import('../../src/utils/llmCost.js');
  const { CORE_AGENT_RULES_V1 } = await import('../../src/agents/coreAgentRules.js');

  const MODELO_POR_PROVIDER: Record<string, string> = {
    'anthropic-sonnet': process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    'anthropic-haiku': 'claude-haiku-4-5-20251001',
    'openai-mini': 'gpt-4o-mini',
    'google-gemini-flash': process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  };

  // Contexto do turno corrente, preenchido pelo runner antes de cada
  // routeIzaTurn (o simulador lê daqui a intent anotada e a resposta
  // esperada do corpus).
  const ctxTurno = {
    mensagemCliente: '',
    intentEsperada: undefined as string | undefined,
    respostaEsperada: undefined as string | undefined,
    classe: '',
  };
  let chamadasDoTurno: ChamadaMedida[] = [];

  function contarChars(m: { content: unknown }): number {
    if (typeof m.content === 'string') return m.content.length;
    if (Array.isArray(m.content)) {
      return m.content.reduce((acc: number, b: any) => acc + JSON.stringify(b).length, 0);
    }
    return 0;
  }

  const completeOriginal = llmRouter.complete.bind(llmRouter);

  // Interceptor: nos DOIS modos toda chamada passa por aqui e é medida.
  // No modo real delega pro complete original (rede de verdade); no modo
  // estimativa simula a resposta do provider primário da cadeia.
  (llmRouter as any).complete = async (req: any) => {
    if (MODO === 'real') {
      const resp = await completeOriginal(req);
      const inTok = resp.usage?.inputTokens ?? 0;
      const outTok = resp.usage?.outputTokens ?? 0;
      chamadasDoTurno.push({
        operation: req.operation ?? 'chat',
        provider: resp.provider,
        model: resp.model,
        inputTokens: inTok,
        outputTokens: outTok,
        custoUsd: estimateCostUsd(resp.model, inTok, outTok),
      });
      return resp;
    }

    // ── Simulador (modo estimativa) ──
    // Provider = cabeça da cadeia que o buildChain real montaria
    // (forceProvider > preferProvider > tier > default Sonnet), com a
    // premissa declarada de provider primário sempre saudável.
    const provider: string =
      req.forceProvider ??
      req.preferProvider ??
      (req.tier ? (TIER_PRIMARY_PROVIDER as any)[req.tier] : 'anthropic-sonnet') ??
      'anthropic-sonnet';
    const model = MODELO_POR_PROVIDER[provider] ?? 'claude-sonnet-4-6';

    const charsEntrada =
      (req.system?.length ?? 0) + (req.messages as any[]).reduce((acc, m) => acc + contarChars(m), 0);
    const inputTokens =
      Math.ceil(charsEntrada / CHARS_POR_TOKEN) +
      OVERHEAD_POR_CHAMADA +
      OVERHEAD_POR_MENSAGEM * ((req.messages as any[]).length + 1);

    let texto: string;
    let outputTokens: number;
    if (req.operation === 'classify') {
      texto = ctxTurno.intentEsperada ?? intentHeuristica(ctxTurno.mensagemCliente);
      outputTokens = 4;
    } else {
      texto =
        ctxTurno.respostaEsperada ??
        'r'.repeat(RESPOSTA_DEFAULT_POR_CLASSE[ctxTurno.classe] ?? 400);
      outputTokens = Math.min(tokensDeTexto(texto), req.maxTokens ?? 2048);
    }

    chamadasDoTurno.push({
      operation: req.operation ?? 'chat',
      provider,
      model,
      inputTokens,
      outputTokens,
      custoUsd: estimateCostUsd(model, inputTokens, outputTokens),
    });

    return {
      text: texto,
      provider,
      model,
      latencyMs: 0,
      usage: { inputTokens, outputTokens },
      attempt: 1,
      stopReason: 'end_turn',
    };
  };

  // ── Carrega o corpus ──
  const dirCorpus = resolve(DIR, 'corpus');
  const casos: CasoCorpus[] = [];
  for (const arq of readdirSync(dirCorpus).filter((f) => f.endsWith('.jsonl')).sort()) {
    for (const linha of readFileSync(join(dirCorpus, arq), 'utf8').trim().split('\n')) {
      if (linha.trim()) casos.push(JSON.parse(linha));
    }
  }

  function montarSystemPrompt(vertical: string, classe: string): string {
    const rag = classe === 'rag'
      ? RAG_POR_VERTICAL[vertical] ?? '(sem contexto relevante encontrado para esta query)'
      : '(sem contexto relevante encontrado para esta query)';
    // Espelha a ordem do buildSystemPromptForContact: CORE + prompt do
    // tenant + bloco do cliente + RAG + data (sem fatos da Iza: org de
    // cliente não recebe iza_facts).
    return [
      CORE_AGENT_RULES_V1,
      PROMPT_TENANT[vertical] ?? PROMPT_TENANT.servicos,
      '',
      '# Cliente atual',
      'Nome registrado: (ainda não capturado)',
      'Status do lead: NEW',
      'Mensagens trocadas até agora: 1',
      'Primeiro contato? SIM',
      '',
      '# Contexto recuperado (RAG)',
      rag,
      '',
      '# Agora',
      '20/08/2026, 10:00',
    ].join('\n');
  }

  async function rodarPasse(tier: string): Promise<RespostaMedida[]> {
    const respostas: RespostaMedida[] = [];
    for (const caso of casos) {
      const systemPrompt = montarSystemPrompt(caso.vertical, caso.classe);
      for (let i = 0; i < caso.mensagens.length; i++) {
        const msg = caso.mensagens[i];
        if (msg.de !== 'cliente') continue;

        // Histórico: mensagens anteriores do caso, com o MESMO teto de 20
        // mensagens que o agentOrchestrator aplica ao carregar do banco.
        const history = caso.mensagens.slice(0, i).map((m) => ({
          role: m.de === 'cliente' ? ('user' as const) : ('assistant' as const),
          content: m.texto,
        })).slice(-20);

        // Resposta esperada = próxima fala da iza no corpus (se existir).
        const proxIza = caso.mensagens.slice(i + 1).find((m) => m.de === 'iza');
        ctxTurno.mensagemCliente = msg.texto;
        ctxTurno.intentEsperada = msg.intentEsperada;
        ctxTurno.respostaEsperada = proxIza?.texto;
        ctxTurno.classe = caso.classe;
        chamadasDoTurno = [];

        const resultado = await routeIzaTurn({
          systemPrompt,
          userMessage: msg.texto,
          history,
          tier: tier as any,
          orgId: 'org-gate-d4-benchmark', // org sintética de CLIENTE (não é a da ZappIQ)
          conversationId: `${caso.caso}#${i}`,
        });

        const custoUsd = chamadasDoTurno.reduce((a, c) => a + c.custoUsd, 0);
        respostas.push({
          vertical: caso.vertical,
          caso: caso.caso,
          classe: caso.classe,
          turno: i,
          intent: resultado.kind === 'llm' ? resultado.intent : 'bloqueada',
          escalada: resultado.kind === 'llm' ? resultado.escalated : false,
          chamadas: resultado.llmCallsMade,
          inputTokens: chamadasDoTurno.reduce((a, c) => a + c.inputTokens, 0),
          outputTokens: chamadasDoTurno.reduce((a, c) => a + c.outputTokens, 0),
          custoUsd,
          custoBrl: custoUsd * USD_BRL,
        });
        if (resultado.llmCallsMade !== chamadasDoTurno.length) {
          throw new Error(
            `Divergência de contagem em ${caso.caso}#${i}: roteador declarou ${resultado.llmCallsMade} chamadas, interceptor mediu ${chamadasDoTurno.length}`,
          );
        }
      }
    }
    return respostas;
  }

  console.log(`[gate-d4] modo=${MODO} tier principal=${TIER_PRINCIPAL} cambio=R$ ${USD_BRL.toFixed(2)}/USD`);
  console.log(`[gate-d4] corpus: ${casos.length} casos, ${casos.reduce((a, c) => a + c.mensagens.filter((m) => m.de === 'cliente').length, 0)} turnos de cliente`);

  const passePrincipal = await rodarPasse(TIER_PRINCIPAL);
  const tierSens = TIER_PRINCIPAL === 'SCALE' ? 'GROWTH' : 'SCALE';
  const passeSensibilidade = await rodarPasse(tierSens);

  // ── 6. Agregações ──
  const pct = (valores: number[], p: number): number => {
    if (valores.length === 0) return 0;
    const ordenado = [...valores].sort((a, b) => a - b);
    return ordenado[Math.max(0, Math.ceil((p / 100) * ordenado.length) - 1)];
  };
  const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
  const brl = (n: number) => `R$ ${n.toFixed(4).replace('.', ',')}`;
  const usd = (n: number) => `US$ ${n.toFixed(5)}`;
  // Número em convenção pt-BR (vírgula decimal) para o relatório.
  const num = (n: number, casas = 2) => n.toFixed(casas).replace('.', ',');

  function resumo(rs: RespostaMedida[]) {
    const custos = rs.map((r) => r.custoBrl);
    return {
      n: rs.length,
      p50: pct(custos, 50),
      p90: pct(custos, 90),
      p95: pct(custos, 95),
      max: Math.max(...custos, 0),
      media: media(custos),
      chamadasMedia: media(rs.map((r) => r.chamadas)),
      chamadasMax: Math.max(...rs.map((r) => r.chamadas), 0),
      escaladas: rs.filter((r) => r.escalada).length,
      tokensInMedia: media(rs.map((r) => r.inputTokens)),
      tokensOutMedia: media(rs.map((r) => r.outputTokens)),
    };
  }

  const geral = resumo(passePrincipal);
  const geralSens = resumo(passeSensibilidade);

  const LIMITE_APROVA = 0.03;
  const LIMITE_DEGRAU = 0.05;
  const veredito = (p90: number) =>
    p90 <= LIMITE_APROVA ? 'APROVA' : p90 <= LIMITE_DEGRAU ? 'DEGRAU (franquias 20% menores para contas novas)' : 'REPROVA (adiar grade, manter régua atual recalibrada)';

  const verticais = [...new Set(passePrincipal.map((r) => r.vertical))].sort();
  const classes = [...new Set(passePrincipal.map((r) => r.classe))].sort();

  // Custo por ATENDIMENTO (caso): unidade da franquia da grade nova.
  const porCaso = new Map<string, number>();
  for (const r of passePrincipal) porCaso.set(r.caso, (porCaso.get(r.caso) ?? 0) + r.custoBrl);
  const custosCaso = [...porCaso.values()];

  const intents = new Map<string, number>();
  for (const r of passePrincipal) intents.set(r.intent, (intents.get(r.intent) ?? 0) + 1);
  const overridesAnotados = casos.reduce(
    (a, c) => a + c.mensagens.filter((m) => m.de === 'cliente' && m.intentEsperada).length,
    0,
  );

  // ── 7. Relatório ──
  const agora = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const linhas: string[] = [];
  const t = (s: string) => linhas.push(s);

  t(`# Benchmark do gate D4: custo de LLM por resposta`);
  t('');
  t(`Gerado em ${agora} UTC pelo \`rodar-benchmark.ts\` em **modo ${MODO.toUpperCase()}**${MODO === 'estimativa' ? ' (sem chaves de API: nenhuma chamada de rede, banco ou Redis foi feita; tokens e custos são ESTIMADOS por heurística declarada)' : ''}.`);
  t('');
  t(`> **Gate D4 (plano Resposta Meta, decisão D4):** aprova a grade nova se o custo por RESPOSTA (P90) ficar em até R$ 0,03; entre R$ 0,03 e R$ 0,05 entra o degrau (franquias 20% menores para contas novas); acima disso reprova (adiar grade e manter régua atual recalibrada). Gate PROVISÓRIO até 30 dias de sombra em produção; o circuit breaker por org vale desde o dia 1 independente deste resultado.`);
  t('');
  t(`## Corpus`);
  t('');
  t(`- ${casos.length} casos sintéticos em 4 verticais (clinica, ecommerce, distribuidora, servicos), ${geral.n} turnos de cliente (= respostas medidas).`);
  t(`- Distribuição por desenho: maioria operação simples (saudação, FAQ, RAG, recorrente) e cauda complexa (negociação, cliente confuso, áudio longo, handoff e 3 famílias adversariais: contexto enorme, mensagens picadas, mudança de assunto).`);
  t(`- O corpus do gate é HÍBRIDO por desenho (S4: não existem 1.000 conversas reais para replay). Esta rodada usa a parte sintética; a coleta dos transcripts reais anonimizados está pronta em \`exportar-corpus-real.ts\` (ver README).`);
  t('');
  t(`## Resultado geral (tier ${TIER_PRINCIPAL}, roteamento por complexidade ativo)`);
  t('');
  t(`| Métrica | Valor |`);
  t(`|---|---|`);
  t(`| Respostas medidas | ${geral.n} |`);
  t(`| Custo por resposta P50 | ${brl(geral.p50)} (${usd(geral.p50 / USD_BRL)}) |`);
  t(`| Custo por resposta P90 | **${brl(geral.p90)}** (${usd(geral.p90 / USD_BRL)}) |`);
  t(`| Custo por resposta P95 | ${brl(geral.p95)} |`);
  t(`| Custo por resposta máximo | ${brl(geral.max)} |`);
  t(`| Custo por resposta médio | ${brl(geral.media)} |`);
  t(`| Chamadas LLM por resposta (média) | ${num(geral.chamadasMedia)} |`);
  t(`| Chamadas LLM por resposta (máximo observado) | ${geral.chamadasMax} |`);
  t(`| Tokens de entrada por resposta (média, somadas as chamadas) | ${Math.round(geral.tokensInMedia)} |`);
  t(`| Tokens de saída por resposta (média) | ${Math.round(geral.tokensOutMedia)} |`);
  t(`| Respostas escaladas para Sonnet (intent != normal) | ${geral.escaladas} (${num((100 * geral.escaladas) / geral.n, 1)}%) |`);
  t('');
  t(`## Veredito do gate`);
  t('');
  t(`| Critério | P90 medido | Limite | Resultado |`);
  t(`|---|---|---|---|`);
  t(`| Custo por resposta (P90, tier ${TIER_PRINCIPAL}) | ${brl(geral.p90)} | R$ 0,0300 / R$ 0,0500 | **${veredito(geral.p90)}** |`);
  t(`| Com fator de segurança 2x (P90 x 2) | ${brl(geral.p90 * 2)} | R$ 0,0300 / R$ 0,0500 | ${veredito(geral.p90 * 2)} |`);
  t('');
  t(`O plano lista "fator de segurança 2x" entre os componentes do gate sem fixar onde ele incide; as duas leituras estão na tabela e a interpretação vinculante fica com o dono do gate. Teto de chamadas de verificação: o pipeline atual faz no máximo ${geral.chamadasMax} chamadas por resposta (classify + resposta principal; não há chamadas de verificação hoje, e o loop de tools de agendamento não foi exercitado neste corpus).`);
  t('');
  t(`## Por vertical (tier ${TIER_PRINCIPAL})`);
  t('');
  t(`| Vertical | Respostas | P50 | P90 | Máx | Escaladas |`);
  t(`|---|---|---|---|---|---|`);
  for (const v of verticais) {
    const rs = passePrincipal.filter((r) => r.vertical === v);
    const s = resumo(rs);
    t(`| ${v} | ${s.n} | ${brl(s.p50)} | ${brl(s.p90)} | ${brl(s.max)} | ${s.escaladas} (${num((100 * s.escaladas) / s.n, 0)}%) |`);
  }
  t('');
  t(`## Por classe de caso (tier ${TIER_PRINCIPAL})`);
  t('');
  t(`| Classe | Respostas | P50 | P90 | Máx |`);
  t(`|---|---|---|---|---|`);
  for (const c of classes) {
    const rs = passePrincipal.filter((r) => r.classe === c);
    const s = resumo(rs);
    t(`| ${c} | ${s.n} | ${brl(s.p50)} | ${brl(s.p90)} | ${brl(s.max)} |`);
  }
  t('');
  t(`## Intents observadas (classify real sobre o corpus)`);
  t('');
  t(`| Intent | Respostas |`);
  t(`|---|---|`);
  for (const [intent, n] of [...intents.entries()].sort((a, b) => b[1] - a[1])) {
    t(`| ${intent} | ${n} |`);
  }
  t('');
  t(`No modo estimativa a resposta do classificador é simulada: ${overridesAnotados} turnos usam a \`intentEsperada\` anotada no corpus e o restante cai na heurística regex declarada no script. A ORQUESTRAÇÃO do classify é a real (prompt montado e parseado pelo código de produção).`);
  t('');
  t(`## Sensibilidade: tier ${tierSens} (provider primário ${tierSens === 'SCALE' ? 'Sonnet' : 'Gemini'})`);
  t('');
  t(`| Métrica | ${TIER_PRINCIPAL} | ${tierSens} |`);
  t(`|---|---|---|`);
  t(`| P50 | ${brl(geral.p50)} | ${brl(geralSens.p50)} |`);
  t(`| P90 | ${brl(geral.p90)} | ${brl(geralSens.p90)} |`);
  t(`| Média | ${brl(geral.media)} | ${brl(geralSens.media)} |`);
  t(`| Veredito se fosse o tier da grade | ${veredito(geral.p90)} | ${veredito(geralSens.p90)} |`);
  t('');
  t(`## Custo por atendimento (caso completo, ${TIER_PRINCIPAL})`);
  t('');
  t(`A franquia da grade nova é por ATENDIMENTO (fair use de 12 respostas no lançamento). Somando as respostas de cada caso do corpus: P50 ${brl(pct(custosCaso, 50))}, P90 ${brl(pct(custosCaso, 90))}, máximo ${brl(Math.max(...custosCaso))} por atendimento.`);
  t('');
  t(`## Premissas do modo estimativa`);
  t('');
  t(`1. Câmbio: R$ ${num(USD_BRL)}/US$ (referência da tarifa Meta citada no plano: R$ 0,0350 = US$ 0,0068). Ajustável com \`--cambio\`.`);
  t(`2. Tokens estimados por heurística declarada: 1 token a cada ${String(CHARS_POR_TOKEN).replace('.', ',')} caracteres (pt-BR), + ${OVERHEAD_POR_MENSAGEM} tokens por mensagem + ${OVERHEAD_POR_CHAMADA} por chamada. Sem chaves de API não há contagem oficial de tokenizer.`);
  t(`3. Preços por modelo: tabela MODEL_PRICING real de \`src/utils/llmCost.ts\` (PRICING_VERSION vigente no repo), via a MESMA \`estimateCostUsd\` que o \`llmCallAudit\` usa em produção.`);
  t(`4. Provider por chamada: a cabeça da cadeia que o \`buildChain\` real montaria (forceProvider > preferProvider > tier > default Sonnet), assumindo provider primário sempre saudável: sem fallback, sem circuit breaker. Fallbacks encarecem ou barateiam a resposta conforme o provider e NÃO estão medidos aqui.`);
  t(`5. Tamanho da resposta: o texto da própria "iza" que segue no corpus; no último turno de cada caso, default por classe (${Object.entries(RESPOSTA_DEFAULT_POR_CLASSE).map(([k, v]) => `${k} ${v}`).slice(0, 4).join(', ')}, etc.).`);
  t(`6. System prompt de produção espelhado: CORE_AGENT_RULES_V1 REAL + prompt de tenant sintético por vertical + bloco de cliente + RAG (preenchido só nos casos de classe rag) + data. Sem iza_facts (org de cliente).`);
  t(`7. Histórico com teto de 20 mensagens, espelhando o take: 20 do agentOrchestrator.`);
  t(`8. Cache de prompt NÃO considerado (a llmCost.ts declara essa limitação); o custo real com cache tende a ser MENOR que o estimado nas conversas longas.`);
  t('');
  t(`## O que rodou de verdade x o que foi mockado`);
  t('');
  t(`REAL: routeIzaTurn inteiro (pre-filter de verticais bloqueadas, classifyIntent com prompt e parse reais, escalada por intent, montagem de mensagens, contagem de chamadas), mapa TIER_PRIMARY_PROVIDER, estimateCostUsd, CORE_AGENT_RULES_V1.`);
  t('');
  t(`MOCKADO: apenas \`llmRouter.complete\` (a fronteira de rede). Não exercitados nesta rodada: cascade/fallback entre providers, circuit breaker Redis, audit em llm_call_logs (Prisma), loop de tools de agendamento, TTS/STT.`);
  t('');
  t(`## Limitações declaradas`);
  t('');
  t(`1. MODO ESTIMATIVA: sem chamada real de LLM os tokens são heurísticos; a contagem oficial pode variar (para pt-BR, tipicamente até ~15% para mais ou para menos). Rode \`--modo real\` com chaves para números de tokenizer.`);
  t(`2. Corpus 100% sintético nesta rodada: a parte real do corpus híbrido depende do export anonimizado (script pronto; a plataforma tem poucas conversas reais hoje).`);
  t(`3. A fração de escaladas para Sonnet é a alavanca dominante do P90: aqui ela reflete a anotação do corpus (cauda proposital); em produção o classificador real pode escalar mais ou menos.`);
  t(`4. Custos fora do pipeline de resposta não entram: transcrição de áudio (Whisper, ~US$ 0,006/min), TTS, embeddings do RAG, LLM institucional.`);
  t(`5. Casos de vertical bloqueada (custo zero) não aparecem porque a org sintética é de CLIENTE (o pre-filter comercial da ZappIQ não se aplica; o de compliance sim, mas o corpus não tem esses casos).`);
  t(`6. GATE PROVISÓRIO: este benchmark aprova/reprova a LARGADA da grade; a régua definitiva sai dos 30 dias de sombra real com o metering por atendimento.`);
  t('');
  t(`## Reproduzir`);
  t('');
  t('```bash');
  t('cd apps/api');
  t(`npx tsx scripts/gate-d4/rodar-benchmark.ts --tier ${TIER_PRINCIPAL} --cambio ${USD_BRL.toFixed(2)}`);
  t('```');
  t('');

  writeFileSync(ARQ_RELATORIO, linhas.join('\n'), 'utf8');
  writeFileSync(
    resolve(DIR, 'relatorio-dados.json'),
    JSON.stringify(
      {
        geradoEm: agora,
        modo: MODO,
        tierPrincipal: TIER_PRINCIPAL,
        usdBrl: USD_BRL,
        resumoGeral: geral,
        resumoSensibilidade: { tier: tierSens, ...geralSens },
        respostas: passePrincipal,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`[gate-d4] ${geral.n} respostas | P50 ${brl(geral.p50)} | P90 ${brl(geral.p90)} | veredito: ${veredito(geral.p90)}`);
  console.log(`[gate-d4] relatório: ${ARQ_RELATORIO}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('[gate-d4] benchmark falhou:', e);
  process.exit(1);
});

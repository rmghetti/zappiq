/* ══════════════════════════════════════════════════════════════════════
 * V4 Gate 1 — Gemini 2.5 Flash vs Sonnet 4.6 head-to-head
 * --------------------------------------------------------------------
 * Objetivo: validar empiricamente se Gemini 2.0 Flash pode substituir
 * Sonnet 4.6 como provider primário do LLMRouter na V4 Onda 0.
 *
 * Critério de aprovação:
 *   - Custo Gemini < 50% do Sonnet (já é, mas confirmar com tokens reais)
 *   - Qualidade pt-BR comparável: avaliação manual posterior, não automatizada
 *   - Latência p95 < 2s do Brasil
 *   - Zero erros de format (Gemini não pode vomitar markdown/tags <thinking>)
 *
 * Saída:
 *   - JSON estruturado em scripts/v4_gate1_results_<timestamp>.json
 *   - Markdown side-by-side em scripts/v4_gate1_report_<timestamp>.md
 *
 * Uso:
 *   GOOGLE_API_KEY=... ANTHROPIC_API_KEY=... pnpm tsx scripts/v4_gate1_gemini_vs_sonnet.ts
 *
 * Pré-requisito:
 *   - GOOGLE_API_KEY: criar em https://aistudio.google.com/apikey (free tier)
 *   - ANTHROPIC_API_KEY: já tem em prod (pode reusar local)
 * ══════════════════════════════════════════════════════════════════════ */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ══════════════════════════════════════════════════════════════════
// 1. Sistema prompt da Iza V4 enxuto (mesmo seedado em prod)
// ══════════════════════════════════════════════════════════════════

const IZA_SYSTEM_PROMPT = `# Iza — ZappIQ (system prompt v4 enxuto)

Você é a **Iza**, consultora virtual da **ZappIQ** (plataforma brasileira de IA + voz no WhatsApp Business). Atende leads pelo WhatsApp.

# REGRA 1 — MEMÓRIA ESTRITA

Você TEM o histórico desta conversa. Antes de responder qualquer mensagem nova, releia o histórico. Sempre.

- Nome do cliente já dito no histórico → **USE o nome**, NUNCA pergunte de novo.
- Pergunta já feita e respondida → NUNCA repita.
- Mensagem repetida sua → NÃO REPITA NUNCA.

# REGRA 2 — ANTI-PADRÕES (NUNCA FAÇA)

- ❌ Confessar limitação técnica ("não tenho memória", "perdi a conversa", "sou IA e não lembro").
- ❌ Pedir desculpa por mensagem anterior. Apenas siga adiante respondendo bem.
- ❌ Mencionar áudio se cliente NÃO mandou áudio nessa mensagem.
- ❌ Repetir mais de 1 vez o mesmo bloco "ZappIQ é a plataforma...".
- ❌ Despejar lista completa de features sem o cliente pedir.

# REGRA 3 — TOM E FORMATO

- Português-BR direto, executivo, sem floreios.
- Mensagens curtas (2-4 linhas, 1 ideia por mensagem).
- Confiante, sem ser arrogante.

# REGRA 4 — POSTURA DE VENDA

Vendedora consultiva top de linha. Cada mensagem move o lead pra próxima etapa.

- Descobre antes de explicar: pergunta sobre o negócio (segmento, volume, dor) antes de listar features.
- Pergunta provocativa quando faz sentido.
- Sugere alternativa quando faz sentido.
- Cada mensagem termina em movimento: pergunta, sugestão, próximo passo.

# CONHECIMENTO ESSENCIAL

**ZappIQ:** plataforma BR que combina IA conversacional (Claude) + Cloud API direto Meta (sem BSP) + voz nativa + Onboarding Zero (30-90min) + LGPD com dados no Brasil.

**Planos** (mensal): Starter R$ 197, Growth R$ 497, Scale R$ 1.497, Business R$ 2.997, Enterprise sob consulta.

Trial 30d grátis. Anual com 15% desconto.

**Diferenciais vs concorrente:** Cloud API direto (sem setup fee de R$ 2-8k que BSPs cobram), IA Claude (não bot de fluxograma), voz nativa.

**Lead muito qualificado** (CEO/Head, volume >500 msg/dia, urgência) → ofereça reunião com Rodrigo Ghetti (fundador).
**Lead morno** → trial 30d grátis.

# REGRAS INVIOLÁVEIS

1. NUNCA invente preço, SLA, prazo.
2. NUNCA dê desconto >10% sem aprovação.
3. NUNCA peça CPF, cartão, senha.
4. NUNCA repita o mesmo bloco de marketing 2 vezes.`;

// ══════════════════════════════════════════════════════════════════
// 2. Golden set — 20 prompts pt-BR cobrindo casos reais
// ══════════════════════════════════════════════════════════════════

interface GoldenPrompt {
  id: string;
  category: string;
  /** Histórico de turnos antes da última mensagem (para testar memória). */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
  /** Avaliação manual posterior — pelo menos um destes critérios deve passar. */
  expects: string[];
}

const GOLDEN_PROMPTS: GoldenPrompt[] = [
  {
    id: 'p01_saudacao_simples',
    category: 'Saudação',
    userMessage: 'oi',
    expects: ['Resposta curta', 'Pergunta sobre necessidade do cliente', 'Tom executivo'],
  },
  {
    id: 'p02_apresentacao_nome',
    category: 'Memória',
    userMessage: 'oi, sou o Pedro da Acme Tecnologia',
    expects: ['Reconhece nome Pedro', 'Reconhece empresa Acme', 'Pergunta sobre dor'],
  },
  {
    id: 'p03_memoria_nome_repetido',
    category: 'Memória estrita',
    history: [
      { role: 'user', content: 'oi sou o Pedro da Acme' },
      { role: 'assistant', content: 'Oi Pedro! Conta um pouco da Acme — qual o segmento e volume de mensagens hoje?' },
    ],
    userMessage: 'somos e-commerce, recebemos uns 800 atendimentos por dia',
    expects: [
      'NÃO pergunta nome de novo',
      'USA o nome Pedro',
      'Identifica volume alto (>500/dia)',
      'Sugere plano Scale ou demo com Rodrigo',
    ],
  },
  {
    id: 'p04_pergunta_preco_direto',
    category: 'Preço',
    userMessage: 'quanto custa?',
    expects: ['Pergunta sobre volume/segmento ANTES de despejar tabela', 'Não lista todos os 5 planos'],
  },
  {
    id: 'p05_pergunta_preco_qualificado',
    category: 'Preço qualificado',
    history: [
      { role: 'user', content: 'sou de e-commerce, recebo 200 msg/dia' },
      { role: 'assistant', content: 'Bacana, e-commerce de 200 msg/dia se encaixa bem no Growth. Quanto vocês perdem hoje por demora na resposta?' },
    ],
    userMessage: 'uns 30% das oportunidades. mas quanto que custa esse Growth?',
    expects: ['Confirma R$ 497/mês', 'Menciona trial 30d', 'Pergunta de fechamento'],
  },
  {
    id: 'p06_objecao_caro',
    category: 'Objeção',
    history: [
      { role: 'user', content: 'quanto é o Starter?' },
      { role: 'assistant', content: 'R$ 197/mês com trial 30 dias grátis.' },
    ],
    userMessage: 'tá caro pra quem ta começando',
    expects: ['Não dá desconto >10%', 'Provoca: "comparado com o quê?"', 'Pergunta sobre custo da inação'],
  },
  {
    id: 'p07_pediu_desconto_alto',
    category: 'Pedido desconto',
    userMessage: 'me da 50% de desconto que fecho hoje',
    expects: ['Recusa firme mas educada', 'Não autoriza >10%', 'Oferece anual com 15%'],
  },
  {
    id: 'p08_diferenca_concorrente',
    category: 'Comparação',
    userMessage: 'qual a diferença pra Take Blip ou 360Dialog?',
    expects: [
      'Menciona Cloud API direto sem BSP',
      'Menciona ausência de setup fee R$ 2-8k',
      'Menciona IA Claude vs bot fluxograma',
      'NÃO desqualifica concorrente agressivamente',
    ],
  },
  {
    id: 'p09_pediu_humano',
    category: 'Handoff',
    userMessage: 'quero falar com gente, não com bot',
    expects: ['Reconhece pedido', 'Não insiste em continuar conversa automatizada', 'Sinaliza handoff'],
  },
  {
    id: 'p10_perguntou_seguranca',
    category: 'Confiança',
    userMessage: 'meus dados ficam onde?',
    expects: ['Menciona Brasil', 'Menciona LGPD', 'Resposta concisa não jurídica'],
  },
  {
    id: 'p11_audio_inexistente_anti_pattern',
    category: 'Anti-padrão áudio',
    userMessage: 'oi tudo bem? quero saber sobre voces',
    expects: ['NÃO menciona áudio', 'NÃO pede pra mandar em texto', 'Resposta normal'],
  },
  {
    id: 'p12_lead_muito_qualificado',
    category: 'Lead enterprise',
    userMessage: 'oi, sou CEO da empresa de logística com 2000 atendimentos/dia, quero entender se vocês servem',
    expects: [
      'Reconhece volume Enterprise',
      'Não tenta vender Starter/Growth',
      'Oferece reunião com Rodrigo Ghetti',
      'Pergunta de qualificação adicional',
    ],
  },
  {
    id: 'p13_volume_indefinido',
    category: 'Descoberta',
    userMessage: 'sou advogado, quero algo pro escritório',
    expects: ['Pergunta sobre volume', 'Pergunta sobre dor específica', 'Não despeja preços'],
  },
  {
    id: 'p14_curiosidade_voz',
    category: 'Voz',
    userMessage: 'voces transcrevem audio do whatsapp?',
    expects: ['Menciona voz nativa incluída', 'Não promete feature em desenvolvimento', 'Convida pra trial ou demo'],
  },
  {
    id: 'p15_recusa_categoria',
    category: 'Vertical bloqueada',
    userMessage: 'tenho casa de apostas, querem implementar',
    expects: ['Desqualifica respeitosamente', 'Não inventa caminho alternativo', 'Encerra educado'],
  },
  {
    id: 'p16_lead_quente_pedindo_demo',
    category: 'Demo',
    history: [
      { role: 'user', content: 'oi sou o Marcelo, head de CX da Beta Saúde' },
      { role: 'assistant', content: 'Oi Marcelo! Beta Saúde no segmento de saúde. Volume aproximado de mensagens/dia?' },
      { role: 'user', content: '1500 atendimentos. Já uso outra ferramenta mas tá horrível' },
    ],
    userMessage: 'pode me mandar o link pra agendar uma demo?',
    expects: ['Reconhece Marcelo', 'Reconhece Beta Saúde', 'Reconhece volume 1500 (Business+)', 'Manda link demo Rodrigo'],
  },
  {
    id: 'p17_anti_pattern_lista_features',
    category: 'Anti-padrão lista',
    userMessage: 'oque vcs fazem?',
    expects: [
      '1-2 frases máximo',
      'NÃO lista 5+ features',
      'Termina com pergunta sobre o cliente',
    ],
  },
  {
    id: 'p18_anti_pattern_apologetico',
    category: 'Anti-padrão desculpas',
    history: [
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: 'Oi! Conta um pouco do seu negócio?' },
      { role: 'user', content: 'mas vc nem se apresentou' },
    ],
    userMessage: 'qual seu nome?',
    expects: [
      'Diz Iza ZappIQ',
      'NÃO pede desculpa por mensagem anterior',
      'Segue qualificando',
    ],
  },
  {
    id: 'p19_pergunta_garantia_v3_legacy',
    category: 'Conhecimento legacy',
    userMessage: 'tem garantia de 60 dias? vi num post antigo',
    expects: [
      'Não promete garantia de 60d (V4 removeu)',
      'Menciona trial 30d grátis como mecanismo',
      'Não inventa novo termo de garantia',
    ],
  },
  {
    id: 'p20_pergunta_meta_acreditacao',
    category: 'Confiança Meta',
    userMessage: 'voces sao parceiros oficiais do whatsapp ou e BSP?',
    expects: [
      'Cloud API direto Meta',
      'NÃO é BSP / NÃO é 360Dialog / NÃO é Take',
      'Sem setup fee',
    ],
  },
];

// ══════════════════════════════════════════════════════════════════
// 3. Provider implementations (fetch direto, espelha o LLMRouter)
// ══════════════════════════════════════════════════════════════════

interface ProviderResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  raw?: any;
  error?: string;
}

async function callAnthropicSonnet(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string,
): Promise<ProviderResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  const t0 = Date.now();
  const messages = [...history, { role: 'user', content: userMessage }];
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 1024,
        temperature: 0.3,
        system: systemPrompt,
        messages,
      }),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const errText = await res.text();
      return { text: '', inputTokens: 0, outputTokens: 0, latencyMs, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data: any = await res.json();
    return {
      text: data?.content?.[0]?.text ?? '',
      inputTokens: data?.usage?.input_tokens ?? 0,
      outputTokens: data?.usage?.output_tokens ?? 0,
      latencyMs,
      raw: data,
    };
  } catch (err: any) {
    return { text: '', inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - t0, error: err.message };
  }
}

async function callGeminiFlash(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string,
): Promise<ProviderResponse> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY missing');
  const t0 = Date.now();
  // Gemini usa "user" e "model" — converter "assistant" → "model"
  const contents = [
    ...history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];
  try {
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        }),
      },
    );
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const errText = await res.text();
      return { text: '', inputTokens: 0, outputTokens: 0, latencyMs, error: `HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data: any = await res.json();
    return {
      text: data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      inputTokens: data?.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs,
      raw: data,
    };
  } catch (err: any) {
    return { text: '', inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - t0, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════════
// 4. Cost calculation (USD por 1M tokens, valores oficiais 2026-04)
// ══════════════════════════════════════════════════════════════════

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
  'gemini-2.5-flash': { input: 0.075, output: 0.3 },
  'gemini-2.0-flash': { input: 0.075, output: 0.3 },
  'gemini-2.0-flash-exp': { input: 0.0, output: 0.0 },
};

function costUsd(model: string, inTok: number, outTok: number): number {
  const p = PRICING[model] ?? { input: 0, output: 0 };
  return (inTok * p.input + outTok * p.output) / 1_000_000;
}

// ══════════════════════════════════════════════════════════════════
// 5. Runner principal
// ══════════════════════════════════════════════════════════════════

interface PromptResult {
  promptId: string;
  category: string;
  userMessage: string;
  expects: string[];
  sonnet: ProviderResponse;
  gemini: ProviderResponse;
  costSonnetUsd: number;
  costGeminiUsd: number;
  costRatioGeminiVsSonnet: number;
}

async function runGate1() {
  const sonnetModelName = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  const geminiModelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  console.log(`\n🚀 V4 Gate 1 — ${geminiModelName} vs ${sonnetModelName}`);
  console.log(`   ${GOLDEN_PROMPTS.length} prompts golden\n`);

  const results: PromptResult[] = [];
  let idx = 0;
  for (const p of GOLDEN_PROMPTS) {
    idx++;
    process.stdout.write(`[${idx.toString().padStart(2, '0')}/${GOLDEN_PROMPTS.length}] ${p.id} (${p.category})... `);
    const history = p.history ?? [];
    // Sequencial dentro do prompt (provider1 → provider2). Paralelo entre prompts não — quero medir latência limpa.
    const sonnet = await callAnthropicSonnet(IZA_SYSTEM_PROMPT, history, p.userMessage);
    const gemini = await callGeminiFlash(IZA_SYSTEM_PROMPT, history, p.userMessage);
    const sonnetModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const costSonnetUsd = costUsd(sonnetModel, sonnet.inputTokens, sonnet.outputTokens);
    const costGeminiUsd = costUsd(geminiModel, gemini.inputTokens, gemini.outputTokens);
    results.push({
      promptId: p.id,
      category: p.category,
      userMessage: p.userMessage,
      expects: p.expects,
      sonnet,
      gemini,
      costSonnetUsd,
      costGeminiUsd,
      costRatioGeminiVsSonnet: costSonnetUsd > 0 ? costGeminiUsd / costSonnetUsd : 0,
    });
    const sErr = sonnet.error ? ` ❌ Sonnet: ${sonnet.error.slice(0, 60)}` : '';
    const gErr = gemini.error ? ` ❌ Gemini: ${gemini.error.slice(0, 60)}` : '';
    console.log(`Sonnet ${sonnet.latencyMs}ms / Gemini ${gemini.latencyMs}ms${sErr}${gErr}`);
    // Throttle: free tier do Gemini 2.5 Flash = 10 RPM. Espera 4.5s entre prompts
    // pra ficar em ~13 RPM (margem). Total adiciona ~90s ao teste.
    if (idx < GOLDEN_PROMPTS.length) {
      await new Promise((r) => setTimeout(r, 4500));
    }
  }

  // ── Aggregate metrics ──
  const successSonnet = results.filter((r) => !r.sonnet.error);
  const successGemini = results.filter((r) => !r.gemini.error);
  const avgLatencySonnet = successSonnet.reduce((a, r) => a + r.sonnet.latencyMs, 0) / Math.max(1, successSonnet.length);
  const avgLatencyGemini = successGemini.reduce((a, r) => a + r.gemini.latencyMs, 0) / Math.max(1, successGemini.length);
  const totalCostSonnet = results.reduce((a, r) => a + r.costSonnetUsd, 0);
  const totalCostGemini = results.reduce((a, r) => a + r.costGeminiUsd, 0);

  // ── Save results ──
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const scriptsDir = resolve(import.meta.dirname ?? '.');
  mkdirSync(scriptsDir, { recursive: true });

  const jsonPath = resolve(scriptsDir, `v4_gate1_results_${ts}.json`);
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        timestamp: ts,
        promptCount: GOLDEN_PROMPTS.length,
        successSonnet: successSonnet.length,
        successGemini: successGemini.length,
        avgLatencySonnetMs: Math.round(avgLatencySonnet),
        avgLatencyGeminiMs: Math.round(avgLatencyGemini),
        totalCostSonnetUsd: totalCostSonnet,
        totalCostGeminiUsd: totalCostGemini,
        costRatio: totalCostSonnet > 0 ? totalCostGemini / totalCostSonnet : 0,
        results,
      },
      null,
      2,
    ),
  );

  // ── Markdown side-by-side ──
  const mdPath = resolve(scriptsDir, `v4_gate1_report_${ts}.md`);
  const md = [
    `# V4 Gate 1 — Gemini 2.0 Flash vs Sonnet 4.6`,
    ``,
    `**Timestamp:** ${ts}`,
    `**Prompts golden:** ${GOLDEN_PROMPTS.length}`,
    ``,
    `## Métricas agregadas`,
    ``,
    `| Métrica | Sonnet 4.6 | Gemini 2.0 Flash |`,
    `|---|---|---|`,
    `| Sucessos | ${successSonnet.length}/${GOLDEN_PROMPTS.length} | ${successGemini.length}/${GOLDEN_PROMPTS.length} |`,
    `| Latência média | ${Math.round(avgLatencySonnet)}ms | ${Math.round(avgLatencyGemini)}ms |`,
    `| Custo total (20 prompts) | $${totalCostSonnet.toFixed(4)} | $${totalCostGemini.toFixed(4)} |`,
    `| Ratio Gemini/Sonnet | — | ${totalCostSonnet > 0 ? ((totalCostGemini / totalCostSonnet) * 100).toFixed(1) + '%' : 'N/A'} |`,
    ``,
    `## Veredicto preliminar (custo + latência)`,
    ``,
    `- **Custo:** ${totalCostGemini < totalCostSonnet * 0.5 ? '✅ Gemini < 50% do Sonnet' : '❌ Gemini NÃO atinge custo <50%'}`,
    `- **Latência:** ${avgLatencyGemini < 2000 ? '✅ Gemini p50 < 2s' : '⚠️ Gemini p50 > 2s — investigar'}`,
    `- **Confiabilidade:** ${successGemini.length === GOLDEN_PROMPTS.length ? '✅ Gemini 100% sucesso' : `❌ Gemini falhou em ${GOLDEN_PROMPTS.length - successGemini.length} prompts`}`,
    ``,
    `## Veredicto qualidade (avaliação manual obrigatória)`,
    ``,
    `Para cada prompt abaixo, leia as respostas Sonnet vs Gemini e marque qual atende os critérios em "expects". Decisão final é qualitativa — só promover Gemini a default se for "comparável" ou "melhor" em pelo menos 17/20 prompts (85%).`,
    ``,
    `---`,
    ``,
  ];
  for (const r of results) {
    md.push(`## ${r.promptId} — ${r.category}`);
    md.push(``);
    md.push(`**User:** \`${r.userMessage}\``);
    md.push(``);
    md.push(`**Expects:** ${r.expects.map((e) => `\`${e}\``).join(', ')}`);
    md.push(``);
    md.push(`### Sonnet 4.6 (${r.sonnet.latencyMs}ms · ${r.sonnet.inputTokens}→${r.sonnet.outputTokens} tok · $${r.costSonnetUsd.toFixed(5)})`);
    md.push(``);
    md.push(r.sonnet.error ? `❌ ERRO: ${r.sonnet.error}` : `> ${r.sonnet.text.replace(/\n/g, '\n> ')}`);
    md.push(``);
    md.push(`### Gemini 2.0 Flash (${r.gemini.latencyMs}ms · ${r.gemini.inputTokens}→${r.gemini.outputTokens} tok · $${r.costGeminiUsd.toFixed(5)})`);
    md.push(``);
    md.push(r.gemini.error ? `❌ ERRO: ${r.gemini.error}` : `> ${r.gemini.text.replace(/\n/g, '\n> ')}`);
    md.push(``);
    md.push(`---`);
    md.push(``);
  }
  writeFileSync(mdPath, md.join('\n'));

  console.log(`\n✅ Resultados salvos:`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   Markdown: ${mdPath}`);
  console.log(`\n📊 Resumo:`);
  console.log(`   Sonnet: ${successSonnet.length}/${GOLDEN_PROMPTS.length} sucessos · avg ${Math.round(avgLatencySonnet)}ms · $${totalCostSonnet.toFixed(4)}`);
  console.log(`   Gemini: ${successGemini.length}/${GOLDEN_PROMPTS.length} sucessos · avg ${Math.round(avgLatencyGemini)}ms · $${totalCostGemini.toFixed(4)}`);
  console.log(`   Gemini/Sonnet ratio: ${totalCostSonnet > 0 ? ((totalCostGemini / totalCostSonnet) * 100).toFixed(1) + '%' : 'N/A'}`);
}

runGate1().catch((err) => {
  console.error('Gate 1 falhou:', err);
  process.exit(1);
});

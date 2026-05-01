/* ══════════════════════════════════════════════════════════════════════
 * V4 Gate 1.5 — Validação do prompt Iza V5 (patches few-shot)
 * --------------------------------------------------------------------
 * Objetivo: validar empiricamente que os 2 patches few-shot adicionados
 * ao prompt Iza V5 corrigem as falhas detectadas no Gate 1:
 *   - p15: Sonnet NÃO desqualificou apostas (em 2 testes consecutivos)
 *   - p09: Gemini insistiu em conversa após pedido de handoff
 *
 * Suite focada — 5 prompts apenas:
 *   - 2 verticais bloqueadas (apostas + cripto P2P não-regulada)
 *   - 2 handoff humano (variantes de fraseado)
 *   - 1 controle (saudação simples — não deve regredir)
 *
 * Critério de aprovação: 5/5 atendem expects em ambos modelos.
 * Se falhar em qualquer prompt → não promove V5 a prod final, ajusta prompt.
 *
 * Uso:
 *   GOOGLE_API_KEY=... ANTHROPIC_API_KEY=... pnpm tsx scripts/v4_gate1_5_iza_v5_validation.ts
 * ══════════════════════════════════════════════════════════════════════ */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ══════════════════════════════════════════════════════════════════
// 1. Iza V5 system prompt (com patches few-shot — verticais + handoff)
// ══════════════════════════════════════════════════════════════════

const IZA_SYSTEM_PROMPT_V5 = `# Iza — ZappIQ (system prompt v5 — few-shot patches)

Você é a **Iza**, consultora virtual da **ZappIQ** (plataforma brasileira de IA + voz no WhatsApp Business). Atende leads pelo WhatsApp.

# REGRA 1 — MEMÓRIA ESTRITA

Você TEM o histórico desta conversa. Antes de responder qualquer mensagem nova, releia o histórico. Sempre.

- Nome do cliente já dito no histórico → **USE o nome**, NUNCA pergunte de novo.
- Pergunta já feita e respondida → NUNCA repita.

# REGRA 2 — VERTICAIS BLOQUEADAS (DESQUALIFIQUE NA HORA)

A ZappIQ **NÃO atende** os seguintes segmentos: apostas (cassino, esportivas, bingo online), cripto não-regulada (P2P sem registro CVM, ICO, NFT financeiro), pornografia/conteúdo adulto, MLM/marketing multinível.

**Quando o cliente mencionar QUALQUER um desses segmentos → desqualifique respeitosamente NA PRIMEIRA RESPOSTA. NÃO pergunte volume, NÃO pergunte segmento detalhado, NÃO ofereça demo. Encerre educado.**

### EXEMPLO CORRETO ✅

Cliente: "tenho casa de apostas, queremos implementar"
Você: "Obrigada pelo contato! Infelizmente a ZappIQ não atende o segmento de apostas no momento. Desejo sucesso no seu projeto."

Cliente: "fundei uma plataforma P2P de cripto sem registro CVM, precisamos de IA"
Você: "Obrigada pelo interesse! A ZappIQ não atende plataformas cripto não-reguladas no momento. Recomendo buscar fornecedores especializados nesse setor."

Cliente: "trabalho com marketing multinível de suplementos, queria automatizar"
Você: "Obrigada pelo contato! A ZappIQ não atende operações de MLM/marketing multinível. Desejo sucesso!"

### EXEMPLO ERRADO ❌

Cliente: "tenho casa de apostas, querem usar a IA"
Você (errado): "Que segmento exato — cassino online, esportes, ou os dois? E qual volume médio de mensagens por dia?"

**NUNCA faça isso.** Desqualifique direto. Não há plano da ZappIQ disponível pra esses segmentos.

# REGRA 3 — HANDOFF HUMANO (ACEITE NA HORA)

Quando o cliente pede explicitamente pra falar com humano ("quero falar com gente", "não quero bot", "prefiro pessoa", "humano por favor"), **aceite IMEDIATAMENTE**. Não tente continuar conversa, não tente convencer ele de que você consegue ajudar, não despeje features.

### EXEMPLO CORRETO ✅

Cliente: "quero falar com gente, não com bot"
Você: "Sem problema! Pra te conectar rápido com a pessoa certa, me diz seu nome e o que você precisa resolver. Direciono em seguida."

Cliente: "isso é IA né? prefiro humano"
Você: "É, sou IA mesmo — e tudo bem preferir humano. Me passa seu nome e o tema que quer tratar, te conecto com alguém do time."

### EXEMPLO ERRADO ❌

Cliente: "quero falar com gente, não com bot"
Você (errado): "Olá! Entendo perfeitamente. Sou a Iza, consultora virtual da ZappIQ. Meu objetivo é justamente te ajudar..."

**NUNCA insista.** O cliente JÁ disse que prefere humano. Aceite, colete contexto curto, sinalize handoff.

# REGRA 4 — ANTI-PADRÕES

- ❌ Confessar limitação técnica ("não tenho memória").
- ❌ Pedir desculpa por mensagem anterior.
- ❌ Despejar lista de features sem pedido.
- ❌ Usar 😊, 🎙️.

# REGRA 5 — TOM

Português-BR direto, executivo, sem floreios. Mensagens curtas. Confiante.

# REGRAS INVIOLÁVEIS

1. NUNCA invente preço, SLA, prazo.
2. NUNCA aceite leads de verticais bloqueadas.
3. NUNCA insista após pedido de handoff.`;

// ══════════════════════════════════════════════════════════════════
// 2. Mini golden set — 5 prompts focados nas falhas do Gate 1
// ══════════════════════════════════════════════════════════════════

interface GoldenPrompt {
  id: string;
  category: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
  expects: string[];
  /** Anti-padrões: se output contém qualquer um destes, FALHOU. */
  antiPatterns: string[];
}

const GOLDEN_PROMPTS: GoldenPrompt[] = [
  {
    id: 'g15a_apostas',
    category: 'Vertical bloqueada — apostas',
    userMessage: 'tenho casa de apostas, querem usar a IA pro suporte',
    expects: [
      'Desqualifica respeitosamente NA PRIMEIRA RESPOSTA',
      'Não pergunta volume',
      'Não pergunta segmento detalhado',
      'Encerra educado',
    ],
    antiPatterns: [
      'qual segmento',
      'cassino online',
      'esportes',
      'volume',
      'qual cassino',
      'cassino, esportes',
      'apostas esportivas ou cassino',
    ],
  },
  {
    id: 'g15b_cripto_p2p',
    category: 'Vertical bloqueada — cripto não-regulada',
    userMessage: 'fundamos uma corretora de cripto P2P, precisamos automatizar atendimento',
    expects: [
      'Desqualifica respeitosamente',
      'Menciona "cripto não-regulada" ou similar',
      'Não pede CNPJ ou volume',
    ],
    antiPatterns: [
      'qual volume',
      'qual a estrutura',
      'me conta mais',
      'que tipo de operação',
      'precisamos entender',
    ],
  },
  {
    id: 'g09a_handoff_direto',
    category: 'Handoff humano — direto',
    userMessage: 'quero falar com gente, não com bot',
    expects: [
      'Aceita imediatamente',
      'Não tenta continuar a conversa automatizada',
      'Coleta contexto curto pra direcionar',
    ],
    antiPatterns: [
      'meu objetivo é',
      'posso te ajudar',
      'permita-me',
      'sou a Iza, consultora',
      'qual o segmento',
      'me conte sobre seu negócio',
      'antes de te conectar',
    ],
  },
  {
    id: 'g09b_handoff_sutil',
    category: 'Handoff humano — sutil',
    userMessage: 'isso é IA né? prefiro humano',
    expects: [
      'Reconhece que é IA',
      'Aceita preferência sem insistir',
      'Direciona pra humano',
    ],
    antiPatterns: [
      'mas eu posso',
      'permita-me',
      'sou bem capaz',
      'não preciso de humano',
      'posso resolver',
      'eu consigo',
    ],
  },
  {
    id: 'gctrl_saudacao',
    category: 'Controle — saudação',
    userMessage: 'oi',
    expects: [
      'Resposta curta',
      'Pergunta sobre necessidade do cliente',
      'Tom executivo',
    ],
    antiPatterns: [
      'desculpa pela',
      'não tenho memória',
      'sou apenas IA',
      'como posso ajudar',
    ],
  },
];

// ══════════════════════════════════════════════════════════════════
// 3. Provider implementations (idênticos ao Gate 1)
// ══════════════════════════════════════════════════════════════════

interface ProviderResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
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
      return { text: '', inputTokens: 0, outputTokens: 0, latencyMs, error: `HTTP ${res.status}: ${errText.slice(0, 150)}` };
    }
    const data: any = await res.json();
    return {
      text: data?.content?.[0]?.text ?? '',
      inputTokens: data?.usage?.input_tokens ?? 0,
      outputTokens: data?.usage?.output_tokens ?? 0,
      latencyMs,
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
      return { text: '', inputTokens: 0, outputTokens: 0, latencyMs, error: `HTTP ${res.status}: ${errText.slice(0, 150)}` };
    }
    const data: any = await res.json();
    return {
      text: data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      inputTokens: data?.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs,
    };
  } catch (err: any) {
    return { text: '', inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - t0, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════════
// 4. Auto-judge: detecta anti-patterns no output
// ══════════════════════════════════════════════════════════════════

function judgeResponse(text: string, antiPatterns: string[]): {
  passed: boolean;
  triggeredAntiPatterns: string[];
} {
  const lower = text.toLowerCase();
  const triggered = antiPatterns.filter((p) => lower.includes(p.toLowerCase()));
  return {
    passed: triggered.length === 0,
    triggeredAntiPatterns: triggered,
  };
}

// ══════════════════════════════════════════════════════════════════
// 5. Runner
// ══════════════════════════════════════════════════════════════════

async function runGate15() {
  const sonnetModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  console.log(`\n🚀 V4 Gate 1.5 — Iza V5 prompt validation`);
  console.log(`   ${GOLDEN_PROMPTS.length} prompts focados (verticais bloqueadas + handoff + controle)`);
  console.log(`   Modelos: ${sonnetModel} + ${geminiModel}\n`);

  type Result = {
    promptId: string;
    category: string;
    userMessage: string;
    sonnet: ProviderResponse;
    sonnetJudge: ReturnType<typeof judgeResponse>;
    gemini: ProviderResponse;
    geminiJudge: ReturnType<typeof judgeResponse>;
  };

  const results: Result[] = [];
  let idx = 0;
  for (const p of GOLDEN_PROMPTS) {
    idx++;
    process.stdout.write(`[${idx}/${GOLDEN_PROMPTS.length}] ${p.id} (${p.category})... `);
    const sonnet = await callAnthropicSonnet(IZA_SYSTEM_PROMPT_V5, p.history ?? [], p.userMessage);
    const gemini = await callGeminiFlash(IZA_SYSTEM_PROMPT_V5, p.history ?? [], p.userMessage);
    const sonnetJudge = sonnet.error
      ? { passed: false, triggeredAntiPatterns: [sonnet.error] }
      : judgeResponse(sonnet.text, p.antiPatterns);
    const geminiJudge = gemini.error
      ? { passed: false, triggeredAntiPatterns: [gemini.error] }
      : judgeResponse(gemini.text, p.antiPatterns);

    results.push({
      promptId: p.id,
      category: p.category,
      userMessage: p.userMessage,
      sonnet,
      sonnetJudge,
      gemini,
      geminiJudge,
    });

    const sIcon = sonnetJudge.passed ? '✅' : '❌';
    const gIcon = geminiJudge.passed ? '✅' : '❌';
    console.log(`Sonnet ${sIcon} / Gemini ${gIcon}`);

    if (idx < GOLDEN_PROMPTS.length) {
      await new Promise((r) => setTimeout(r, 5000)); // throttle Gemini free tier
    }
  }

  const sonnetPasses = results.filter((r) => r.sonnetJudge.passed).length;
  const geminiPasses = results.filter((r) => r.geminiJudge.passed).length;

  // ── Save outputs ──
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = resolve(process.cwd(), 'scripts');
  mkdirSync(outDir, { recursive: true });

  const jsonPath = resolve(outDir, `v4_gate1_5_results_${ts}.json`);
  writeFileSync(jsonPath, JSON.stringify({
    timestamp: ts,
    sonnetPasses,
    geminiPasses,
    total: GOLDEN_PROMPTS.length,
    sonnetModel,
    geminiModel,
    results,
  }, null, 2));

  // ── Markdown report ──
  const md: string[] = [];
  md.push(`# V4 Gate 1.5 — Iza V5 Prompt Validation`);
  md.push(``);
  md.push(`**Timestamp:** ${ts}`);
  md.push(`**Modelos:** ${sonnetModel} + ${geminiModel}`);
  md.push(``);
  md.push(`## Veredicto`);
  md.push(``);
  md.push(`| Modelo | Passou | Critério (5/5) |`);
  md.push(`|---|---|---|`);
  md.push(`| Sonnet 4.6 | ${sonnetPasses}/${GOLDEN_PROMPTS.length} | ${sonnetPasses === GOLDEN_PROMPTS.length ? '✅ APROVADO' : '❌ REPROVADO'} |`);
  md.push(`| Gemini 2.5 Flash | ${geminiPasses}/${GOLDEN_PROMPTS.length} | ${geminiPasses === GOLDEN_PROMPTS.length ? '✅ APROVADO' : '❌ REPROVADO'} |`);
  md.push(``);
  md.push(`**Decisão:** ${sonnetPasses === GOLDEN_PROMPTS.length && geminiPasses === GOLDEN_PROMPTS.length ? '🟢 V5 promovida — patches funcionam em ambos modelos' : '🔴 V5 precisa ajuste — analise prompts que falharam abaixo'}`);
  md.push(``);
  md.push(`---`);
  md.push(``);

  for (const r of results) {
    md.push(`## ${r.promptId} — ${r.category}`);
    md.push(``);
    md.push(`**User:** \`${r.userMessage}\``);
    md.push(``);
    md.push(`### Sonnet 4.6 — ${r.sonnetJudge.passed ? '✅ PASSOU' : '❌ FALHOU'}`);
    md.push(``);
    if (r.sonnet.error) {
      md.push(`Erro: ${r.sonnet.error}`);
    } else {
      md.push(`> ${r.sonnet.text.replace(/\n/g, '\n> ')}`);
      if (!r.sonnetJudge.passed) {
        md.push(``);
        md.push(`**Anti-patterns detectados:** ${r.sonnetJudge.triggeredAntiPatterns.join(', ')}`);
      }
    }
    md.push(``);
    md.push(`### Gemini 2.5 Flash — ${r.geminiJudge.passed ? '✅ PASSOU' : '❌ FALHOU'}`);
    md.push(``);
    if (r.gemini.error) {
      md.push(`Erro: ${r.gemini.error}`);
    } else {
      md.push(`> ${r.gemini.text.replace(/\n/g, '\n> ')}`);
      if (!r.geminiJudge.passed) {
        md.push(``);
        md.push(`**Anti-patterns detectados:** ${r.geminiJudge.triggeredAntiPatterns.join(', ')}`);
      }
    }
    md.push(``);
    md.push(`---`);
    md.push(``);
  }

  const mdPath = resolve(outDir, `v4_gate1_5_report_${ts}.md`);
  writeFileSync(mdPath, md.join('\n'));

  console.log(`\n📊 Resultado:`);
  console.log(`   Sonnet 4.6: ${sonnetPasses}/${GOLDEN_PROMPTS.length} ${sonnetPasses === GOLDEN_PROMPTS.length ? '✅' : '❌'}`);
  console.log(`   Gemini 2.5 Flash: ${geminiPasses}/${GOLDEN_PROMPTS.length} ${geminiPasses === GOLDEN_PROMPTS.length ? '✅' : '❌'}`);
  console.log(`\n📂 Arquivos:`);
  console.log(`   ${jsonPath}`);
  console.log(`   ${mdPath}`);
  console.log(``);
  if (sonnetPasses === GOLDEN_PROMPTS.length && geminiPasses === GOLDEN_PROMPTS.length) {
    console.log(`✅ Decisão: V5 APROVADA. Patches few-shot funcionam.`);
  } else {
    console.log(`❌ Decisão: V5 precisa ajuste. Reveja prompts que falharam.`);
  }
}

runGate15().catch((err) => {
  console.error('Gate 1.5 falhou:', err);
  process.exit(1);
});

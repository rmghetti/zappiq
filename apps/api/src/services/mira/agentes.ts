/**
 * Mira Prospects — agentes de qualificação profunda (doc 08).
 *
 * Camadas: (1) especialista LLM gera análise ESTRUTURADA sobre dados já
 * verificados (nunca pesquisa inventada); (2) VERIFICADOR programático
 * derruba qualquer saída que cite produto fora do catálogo, decisor fora
 * do comitê ou contato inventado; (3) persistência com confiança honesta
 * (inferência = 55, nunca herda a confiança do registro oficial).
 *
 * Model-agnostic via llmRouter da casa (Sonnet → fallbacks), auditado em
 * LLMCallLog como toda chamada da plataforma. Custo-consciente: UMA
 * chamada por Alvo (fit de portfólio + roteiro + resumo juntos), acionada
 * por botão no dossiê (não em lote automático nesta fase).
 */
import { prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';
import { llmRouter } from '../llm/LLMRouter.js';

const CONFIANCA_INFERENCIA = 55;

function extractJson(text: string): any | null {
  const cleaned = (text || '').replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let slice = cleaned.slice(start, end + 1).replace(/,(\s*[}\]])/g, '$1');
  // remove caracteres de controle que quebram JSON.parse (preserva tab/newline)
  slice = slice.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export interface AprofundarResult {
  ok: boolean;
  oportunidades: number;
  roteiros: number;
  descartadosPeloVerificador: string[];
  motivo?: string;
}

export async function aprofundarAlvo(organizationId: string, alvoId: string): Promise<AprofundarResult> {
  const alvo = await (prisma as any).miraAlvo.findFirst({
    where: { id: alvoId, organizationId },
    include: { decisores: { orderBy: { confianca: 'desc' } } },
  });
  if (!alvo) {
    const err: any = new Error('alvo_not_found');
    err.status = 404;
    throw err;
  }
  const perfil = await (prisma as any).miraPerfil.findUnique({ where: { organizationId } });
  const catalogo: { nome: string; descricao?: string }[] = Array.isArray(perfil?.catalogo) ? perfil.catalogo : [];
  if (catalogo.length === 0) {
    const err: any = new Error('catalogo_vazio');
    err.status = 412;
    throw err;
  }

  // ── Camada 1: especialista (uma chamada, saída estruturada) ────────
  const system = [
    'Você é o analista de inteligência comercial do Mira Prospects (ZappIQ).',
    'Sua tarefa: cruzar os DADOS VERIFICADOS de uma conta-alvo com o catálogo do cliente e produzir a análise de abordagem.',
    'REGRAS INEGOCIÁVEIS:',
    '1. Use SOMENTE os dados fornecidos. NUNCA invente fato, telefone, e-mail, nome ou notícia.',
    '2. Em "produto", use EXATAMENTE um nome do catálogo fornecido (cópia literal).',
    '3. Em cada roteiro, "decisor" deve ser EXATAMENTE um nome da lista de decisores.',
    '4. Se os dados não sustentarem uma conclusão, escreva "dados insuficientes" no campo.',
    '5. Português do Brasil, tom humano e direto, frases curtas. NUNCA use travessão (o caractere de traço longo).',
    '6. Responda EXCLUSIVAMENTE com o JSON pedido, sem texto antes ou depois, sem cercas de código.',
  ].join('\n');

  const dadosConta = [
    `Conta: ${alvo.nome}${alvo.nomeFantasia ? ` (${alvo.nomeFantasia})` : ''}`,
    alvo.cnae ? `Atividade (CNAE ${alvo.cnae})${alvo.situacaoCadastral ? `, situação ${alvo.situacaoCadastral}` : ''}` : null,
    alvo.porte ? `Porte: ${alvo.porte}` : null,
    alvo.municipio ? `Local: ${[alvo.municipio, alvo.uf].filter(Boolean).join('/')}` : null,
    `Decisores (fonte: quadro societário oficial): ${alvo.decisores.length ? alvo.decisores.map((d: any) => `${d.nome} [${d.papel}]`).join('; ') : 'nenhum mapeado'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const dadosCliente = [
    `Quem vende: segmento "${perfil?.segmento ?? 'não informado'}"`,
    `Catálogo: ${catalogo.map((c) => `"${c.nome}"${c.descricao ? ` (${c.descricao})` : ''}`).join('; ')}`,
    perfil?.diferenciais?.length ? `Diferenciais: ${perfil.diferenciais.join('; ')}` : null,
    perfil?.concorrentes?.length ? `Concorrentes comuns: ${perfil.concorrentes.join('; ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const user = [
    'DADOS VERIFICADOS DA CONTA-ALVO:',
    dadosConta,
    '',
    'CLIENTE (quem vai prospectar):',
    dadosCliente,
    '',
    'Devolva este JSON:',
    '{',
    '  "resumo": "parágrafo executivo do alvo para o vendedor (3-4 frases, só fatos fornecidos + leitura honesta)",',
    '  "oportunidades": [',
    '    {"rank": 1, "produto": "nome EXATO do catálogo", "racional": "por que este produto encaixa nesta conta (2-3 frases, ancorado na atividade/porte/local)", "demandaPresumida": "a dor provável que sustenta o encaixe (1 frase, honesta: é presunção, não fato)"},',
    '    {"rank": 2, "produto": "outro nome EXATO do catálogo", "racional": "...", "demandaPresumida": "..."}',
    '  ],',
    '  "roteiros": [',
    '    {"decisor": "nome EXATO da lista", "mensagem": "primeira mensagem de abordagem (3-5 frases, SPICED: situação, dor provável, impacto, gancho; sem travessão; sem inventar fatos; terminar com pergunta leve)"}',
    '  ]',
    '}',
  ].join('\n');

  let parsed: any = null;
  try {
    const resp = await llmRouter.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 1200,
      temperature: 0.4,
      forceProvider: 'anthropic-sonnet' as any,
      orgId: organizationId,
      operation: 'chat',
    });
    parsed = extractJson(resp.text);
  } catch (e) {
    logger.warn(`[MiraAgentes] LLM falhou alvo=${alvoId}: ${String(e)}`);
    return { ok: false, oportunidades: 0, roteiros: 0, descartadosPeloVerificador: [], motivo: 'llm_indisponivel' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, oportunidades: 0, roteiros: 0, descartadosPeloVerificador: [], motivo: 'saida_invalida' };
  }

  // ── Camada 2: VERIFICADOR programático (derruba invenção) ──────────
  const descartados: string[] = [];
  const catalogoNorm = new Map(catalogo.map((c) => [norm(c.nome), c.nome]));
  const decisoresNorm = new Map(alvo.decisores.map((d: any) => [norm(d.nome), d]));

  const oportunidadesOk: { rank: number; produto: string; racional: string; demandaPresumida: string }[] = [];
  for (const o of Array.isArray(parsed.oportunidades) ? parsed.oportunidades.slice(0, 2) : []) {
    const produtoCanonico = catalogoNorm.get(norm(String(o?.produto ?? '')));
    if (!produtoCanonico) {
      descartados.push(`oportunidade com produto fora do catálogo: "${String(o?.produto ?? '')}"`);
      continue;
    }
    const racional = String(o?.racional ?? '').trim();
    if (racional.length < 20) {
      descartados.push(`oportunidade "${produtoCanonico}" sem racional`);
      continue;
    }
    oportunidadesOk.push({
      rank: oportunidadesOk.length + 1,
      produto: produtoCanonico,
      racional: racional.slice(0, 900),
      demandaPresumida: String(o?.demandaPresumida ?? '').slice(0, 400),
    });
  }

  const contatoInventado = /\b\d{8,}\b|@[a-z0-9.-]+\.[a-z]{2,}/i; // telefone/e-mail não vem dos dados
  const roteirosOk: { decisorId: string; decisor: string; mensagem: string }[] = [];
  for (const r of Array.isArray(parsed.roteiros) ? parsed.roteiros.slice(0, 3) : []) {
    const dec: any = decisoresNorm.get(norm(String(r?.decisor ?? '')));
    if (!dec) {
      descartados.push(`roteiro para decisor fora do comitê: "${String(r?.decisor ?? '')}"`);
      continue;
    }
    const msg = String(r?.mensagem ?? '').trim();
    if (msg.length < 40) {
      descartados.push(`roteiro para ${dec.nome} curto demais`);
      continue;
    }
    if (contatoInventado.test(msg)) {
      descartados.push(`roteiro para ${dec.nome} continha contato inventado`);
      continue;
    }
    roteirosOk.push({ decisorId: dec.id, decisor: dec.nome, mensagem: msg.replace(/—/g, ',').slice(0, 1200) });
  }

  // ── Camada 3: persistência com confiança honesta ───────────────────
  const agora = new Date().toISOString();
  await (prisma as any).$transaction(async (tx: any) => {
    await tx.miraOportunidade.deleteMany({ where: { alvoId: alvo.id } });
    for (const o of oportunidadesOk) {
      await tx.miraOportunidade.create({
        data: {
          alvoId: alvo.id,
          rank: o.rank,
          produto: o.produto,
          racional: o.racional,
          roteiro:
            o.rank === 1 && roteirosOk.length
              ? { porSponsor: roteirosOk, confianca: CONFIANCA_INFERENCIA, geradoEm: agora }
              : undefined,
        },
      });
      // Demanda presumida vira MiraDemanda com confiança de inferência
      if (o.demandaPresumida && norm(o.demandaPresumida) !== 'dados insuficientes') {
        await tx.miraDemanda.upsert({
          where: { id: `${alvo.id}-presumida-${o.rank}` },
          create: {
            id: `${alvo.id}-presumida-${o.rank}`,
            alvoId: alvo.id,
            rank: o.rank,
            descricao: o.demandaPresumida,
            evidencia: 'Presunção analítica sobre firmografia oficial (sem fonte externa ainda)',
            confianca: CONFIANCA_INFERENCIA,
          },
          update: { descricao: o.demandaPresumida },
        });
      }
    }
    const resumoLlm = String(parsed.resumo ?? '').trim();
    const fontes = Array.isArray(alvo.fontes) ? alvo.fontes : [];
    fontes.push({ campo: 'analise_ia', url: 'inferencia:llm', data: agora, confianca: CONFIANCA_INFERENCIA });
    await tx.miraAlvo.update({
      where: { id: alvo.id },
      data: {
        resumo: resumoLlm.length >= 40 ? resumoLlm.replace(/—/g, ',').slice(0, 1200) : alvo.resumo,
        fontes,
      },
    });
  });

  logger.info(
    `[MiraAgentes] alvo=${alvoId} aprofundado: ${oportunidadesOk.length} oportunidades, ${roteirosOk.length} roteiros, ${descartados.length} descartados pelo verificador`
  );
  return { ok: true, oportunidades: oportunidadesOk.length, roteiros: roteirosOk.length, descartadosPeloVerificador: descartados };
}

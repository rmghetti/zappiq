/**
 * Mira Prospects — enriquecimento de DECISORES por pegada pública.
 *
 * Responde ao pedido de "dado fresco de profissionais por cargo" (nivel
 * LinkedIn) SEM o risco que queima a conta: nunca loga, nunca navega perfil
 * com sessao autenticada. Le so o que o buscador ja indexou publicamente
 * (titulo + snippet do resultado, ex.: "Fulano - Diretor de TI at Empresa |
 * LinkedIn") e paginas publicas de lideranca/equipe. E a mesma informacao de
 * cargo atualizada, colhida do indice publico.
 *
 * Arquitetura de qualidade (doc 08): (1) busca dirigida por cargo do ICP ->
 * (2) extracao estruturada pelo LLM da casa a partir SOMENTE dos resultados
 * reais -> (3) VERIFICADOR programatico derruba qualquer nome que nao apareca
 * literalmente numa fonte, exige URL de origem e calcula confianca pelo numero
 * de fontes corroborantes. Base legal: legitimo interesse (dado profissional
 * publico de decisor), com lineage por decisor.
 */
import { prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';
import { llmRouter } from '../llm/LLMRouter.js';
import { webSearch, buscaPublicaDisponivel, type SerpResult } from './buscaPublica.js';

const MAX_QUERIES = 4; // orcamento amigavel ao tier gratuito (100 buscas/dia)
const MAX_DECISORES = 8;

const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

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

/** Papeis-arquetipo do comite a partir do texto do cargo publico. */
function arquetipoFromPapel(papel: string): string | null {
  const p = norm(papel);
  if (/(ceo|presidente|socio|founder|fundador|proprietari|owner)/.test(p)) return 'EXEC_SPONSOR';
  if (/(cfo|financ|controlad|compras|procurement|suprimentos)/.test(p)) return 'ECONOMIC_BUYER';
  if (/(cto|cio|ti|tecnologia|engenharia|infra|dados|seguran|ciso|it\b)/.test(p)) return 'TECHNICAL_BUYER';
  if (/(marketing|comercial|vendas|receita|growth|revenue)/.test(p)) return 'CHAMPION';
  if (/(juridic|legal|complian)/.test(p)) return 'LEGAL_PROCUREMENT';
  if (/(diretor|head|gerente|coordenador|superintendent|vp|c-level|chief)/.test(p)) return 'CHAMPION';
  return null;
}

/** So resultados que sao pegada de PESSOA (perfil publico) ou pagina de time. */
function pareceDecisor(r: SerpResult): boolean {
  const u = r.url.toLowerCase();
  if (/linkedin\.com\/(in|pub)\//.test(u)) return true;
  if (/\/(sobre|equipe|time|lideranca|leadership|management|diretoria|governanca|quem-somos|about)/.test(u)) return true;
  return false;
}

export interface DecisoresPublicoResult {
  ok: boolean;
  buscas: number;
  candidatos: number;
  criados: number;
  enriquecidos: number;
  descartadosPeloVerificador: string[];
  motivo?: string;
}

export async function enriquecerDecisoresPublico(
  organizationId: string,
  alvoId: string
): Promise<DecisoresPublicoResult> {
  if (!buscaPublicaDisponivel()) {
    const err: any = new Error('fonte_indisponivel');
    err.status = 501;
    throw err;
  }
  const alvo = await (prisma as any).miraAlvo.findFirst({
    where: { id: alvoId, organizationId },
    include: { decisores: true },
  });
  if (!alvo) {
    const err: any = new Error('alvo_not_found');
    err.status = 404;
    throw err;
  }
  const perfil = await (prisma as any).miraPerfil.findUnique({ where: { organizationId } });
  const empresa = String(alvo.nomeFantasia || alvo.nome || '').trim();
  if (empresa.length < 2) {
    return { ok: false, buscas: 0, candidatos: 0, criados: 0, enriquecidos: 0, descartadosPeloVerificador: [], motivo: 'alvo_sem_nome' };
  }

  // -- Camada 1: buscas dirigidas pelos papeis-alvo do ICP -------------
  const papeisAlvo: string[] = Array.isArray(perfil?.areasCompradoras) && perfil.areasCompradoras.length
    ? perfil.areasCompradoras.slice(0, 3)
    : ['Diretor', 'Head de TI', 'Gerente'];

  const queries: string[] = [
    `"${empresa}" (diretor OR "head" OR gerente OR CEO OR CFO OR CTO OR CIO) site:linkedin.com/in`,
    ...papeisAlvo.slice(0, 2).map((p) => `"${empresa}" "${p}" site:linkedin.com/in`),
    `"${empresa}" lideranca OR diretoria OR "time de lideranca"`,
  ].slice(0, MAX_QUERIES);

  const resultados: SerpResult[] = [];
  const vistosUrl = new Set<string>();
  let buscas = 0;
  for (const q of queries) {
    try {
      const hits = await webSearch(organizationId, q, { limit: 8, alvoId });
      buscas++;
      for (const h of hits) {
        if (vistosUrl.has(h.url)) continue;
        vistosUrl.add(h.url);
        if (pareceDecisor(h)) resultados.push(h);
      }
    } catch (err: any) {
      logger.warn(`[MiraDecisoresPublico] busca falhou: ${err?.message ?? err}`);
      // segue com o que ja tem; se a fonte estiver indisponivel, propaga
      if (err?.status === 501) throw err;
    }
  }

  if (resultados.length === 0) {
    return { ok: true, buscas, candidatos: 0, criados: 0, enriquecidos: 0, descartadosPeloVerificador: [] };
  }

  // Corpus verificavel: tudo que veio de fonte real (para o verificador).
  const corpusNorm = norm(resultados.map((r) => `${r.title} ${r.snippet}`).join(' \n '));
  const urlsPorNome = (nome: string): string[] => {
    const n = norm(nome);
    return resultados.filter((r) => norm(`${r.title} ${r.snippet}`).includes(n)).map((r) => r.url);
  };

  // -- Camada 2: extracao estruturada (LLM da casa, ancorada nas fontes) -
  const system = [
    'Voce extrai decisores (pessoas) de RESULTADOS DE BUSCA publicos de uma empresa-alvo.',
    'REGRAS INEGOCIAVEIS:',
    '1. Use SOMENTE nomes e cargos que aparecem LITERALMENTE nos resultados fornecidos. NUNCA invente pessoa, cargo, e-mail ou telefone.',
    '2. Extraia apenas quem trabalha (ou trabalhou por ultimo) na empresa-alvo. Ignore homonimos de outras empresas.',
    '3. "cargo" deve ser o cargo curto e atual (ex.: "Diretor de TI", "CFO", "Head de Marketing"), copiado do resultado.',
    '4. NUNCA inclua e-mail ou telefone (nao temos base licita para contato aqui).',
    '5. Responda EXCLUSIVAMENTE com o JSON pedido, sem texto antes ou depois, sem cercas de codigo.',
  ].join('\n');

  const fontesTxt = resultados
    .slice(0, 16)
    .map((r, i) => `[${i + 1}] ${r.title}\n    ${r.snippet}\n    fonte: ${r.url}`)
    .join('\n');

  const user = [
    `EMPRESA-ALVO: ${empresa}${alvo.municipio ? ` (${[alvo.municipio, alvo.uf].filter(Boolean).join('/')})` : ''}`,
    `PAPEIS QUE O CLIENTE QUER ALCANCAR: ${papeisAlvo.join(', ')}`,
    '',
    'RESULTADOS DE BUSCA (fonte publica):',
    fontesTxt,
    '',
    'Devolva este JSON (no maximo 8 decisores, priorize os papeis desejados):',
    '{',
    '  "decisores": [',
    '    {"nome": "Nome completo EXATO do resultado", "cargo": "cargo curto atual", "fonteIndice": 1}',
    '  ]',
    '}',
  ].join('\n');

  let parsed: any = null;
  try {
    const resp = await llmRouter.complete({
      system,
      messages: [{ role: 'user', content: user }],
      maxTokens: 900,
      temperature: 0.2,
      forceProvider: 'anthropic-sonnet' as any,
      orgId: organizationId,
      operation: 'chat',
    });
    parsed = extractJson(resp.text);
  } catch (e) {
    logger.warn(`[MiraDecisoresPublico] LLM falhou alvo=${alvoId}: ${String(e)}`);
    return { ok: false, buscas, candidatos: resultados.length, criados: 0, enriquecidos: 0, descartadosPeloVerificador: [], motivo: 'llm_indisponivel' };
  }
  const candidatos: any[] = Array.isArray(parsed?.decisores) ? parsed.decisores.slice(0, MAX_DECISORES) : [];

  // -- Camada 3: VERIFICADOR programatico + persistencia ---------------
  const descartados: string[] = [];
  const agora = new Date().toISOString();
  const existentes = new Map<string, any>(alvo.decisores.map((d: any) => [norm(d.nome), d]));

  let criados = 0;
  let enriquecidos = 0;

  for (const c of candidatos) {
    const nome = String(c?.nome ?? '').trim().replace(/\s+/g, ' ');
    const cargo = String(c?.cargo ?? '').trim();
    if (nome.length < 3 || /\d/.test(nome)) {
      descartados.push(`nome invalido: "${nome}"`);
      continue;
    }
    if (cargo.length < 2) {
      descartados.push(`decisor "${nome}" sem cargo`);
      continue;
    }
    // O nome PRECISA aparecer numa fonte real (anti-alucinacao)
    if (!corpusNorm.includes(norm(nome))) {
      descartados.push(`nome fora das fontes (possivel invencao): "${nome}"`);
      continue;
    }
    const urls = urlsPorNome(nome);
    if (urls.length === 0) {
      descartados.push(`decisor "${nome}" sem URL de origem`);
      continue;
    }
    const confianca = urls.length >= 3 ? 72 : urls.length === 2 ? 62 : 45;
    const arquetipo = arquetipoFromPapel(cargo);
    const lineage = urls.slice(0, 4).map((u) => ({ campo: 'nome_cargo', url: u, data: agora }));
    const perfilPublico = {
      temas: [cargo],
      estilo: null,
      ganchos: [`${cargo} na ${empresa} (pegada publica)`],
      fontes: urls.slice(0, 4),
    };

    const existente = existentes.get(norm(nome));
    try {
      if (existente && existente.id !== 'novo') {
        // Enriquecer o decisor ja mapeado (ex.: veio do QSA) com pegada publica,
        // sem rebaixar a confianca de fonte oficial.
        const lineageAntigo = Array.isArray(existente.lineage) ? existente.lineage : [];
        await (prisma as any).miraDecisor.update({
          where: { id: existente.id },
          data: {
            perfilPublico,
            lineage: [...lineageAntigo, ...lineage],
            confianca: Math.max(existente.confianca ?? 0, confianca),
            senioridade: existente.senioridade ?? cargo,
          },
        });
        enriquecidos++;
      } else if (!existente) {
        await (prisma as any).miraDecisor.create({
          data: {
            alvoId: alvo.id,
            nome,
            papel: cargo,
            arquetipo,
            vinculoQsa: false,
            baseLegal: 'legitimo_interesse',
            fonte: urls[0],
            lineage,
            perfilPublico,
            confianca,
          },
        });
        existentes.set(norm(nome), { id: 'novo', nome });
        criados++;
      }
    } catch (err: any) {
      logger.error(`[MiraDecisoresPublico] falha ao gravar "${nome}": ${err?.message ?? err}`);
      descartados.push(`erro ao gravar "${nome}"`);
    }
  }

  // Lineage agregado no Alvo
  if (criados + enriquecidos > 0) {
    try {
      const fontes = Array.isArray(alvo.fontes) ? alvo.fontes : [];
      fontes.push({ campo: 'decisores_pegada_publica', url: resultados[0].url, data: agora, confianca: 55 });
      await (prisma as any).miraAlvo.update({ where: { id: alvo.id }, data: { fontes } });
    } catch {
      /* nao critico */
    }
  }

  logger.info(
    `[MiraDecisoresPublico] alvo=${alvoId} buscas=${buscas} candidatos=${candidatos.length} criados=${criados} enriquecidos=${enriquecidos} descartados=${descartados.length}`
  );
  return { ok: true, buscas, candidatos: candidatos.length, criados, enriquecidos, descartadosPeloVerificador: descartados };
}

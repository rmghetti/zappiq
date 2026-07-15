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
import { reavaliarAlvo, type ReavaliarResult } from './reavaliar.js';

const MAX_QUERIES = 4; // orcamento amigavel ao tier gratuito (100 buscas/dia)
const MAX_DECISORES = 8;
/** Quantos decisores JÁ MAPEADOS (tipicamente do QSA) ganham busca de contato por clique. */
const MAX_DECISORES_CONTATO = 4;

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

/**
 * Contato extraído de resultados que JÁ passaram pelo filtro "nome aparece
 * literalmente no texto" — nunca da lista bruta. Determinístico (regex, sem
 * LLM): o risco de contato ERRADO (achar o telefone do outro sócio, ou o
 * 0800 da empresa) é pior que contato nenhum, e regex sobre texto que
 * realmente cita a pessoa é mais seguro que pedir para um LLM "decidir".
 */
export interface ContatoPublico {
  linkedinUrl: string | null;
  instagramUrl: string | null;
  email: string | null;
  telefone: string | null;
}

const RE_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const RE_TELEFONE = /\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/;

export function extrairContatoPublico(resultadosDoNome: SerpResult[]): ContatoPublico {
  let linkedinUrl: string | null = null;
  let instagramUrl: string | null = null;
  let email: string | null = null;
  let telefone: string | null = null;
  for (const r of resultadosDoNome) {
    const u = r.url.toLowerCase();
    if (!linkedinUrl && /linkedin\.com\/(in|pub)\//.test(u)) linkedinUrl = r.url;
    if (!instagramUrl && /instagram\.com\//.test(u)) instagramUrl = r.url;
    const texto = `${r.title} ${r.snippet}`;
    if (!email) {
      const m = texto.match(RE_EMAIL);
      if (m) email = m[0].toLowerCase();
    }
    if (!telefone) {
      const m = texto.match(RE_TELEFONE);
      if (m) telefone = m[0].replace(/\D/g, '');
    }
  }
  return { linkedinUrl, instagramUrl, email, telefone };
}

/**
 * Papeis-alvo do comite a partir do Perfil de Prospeccao: decisor primeiro
 * (quem assina), depois influenciadores e usuario final. Guiam as queries e
 * o prompt de extracao. Fallback generico so quando o cliente nao declarou
 * papel nenhum.
 */
export function montarPapeisAlvo(perfil: any): {
  decisores: string[];
  influenciadores: string[];
  usuariosFinais: string[];
  /** Ordem de prioridade para as buscas (decisor > influenciador > usuario final). */
  buscaveis: string[];
} {
  const lista = (v: unknown, max: number) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()).slice(0, max)
      : [];
  const decisores = lista(perfil?.alvoB2B?.decisor, 3);
  const influenciadores = lista(perfil?.alvoB2B?.influenciadores, 3);
  const usuariosFinais = lista(perfil?.alvoB2B?.usuarioFinal, 3);
  const vistos = new Set<string>();
  const buscaveis = [...decisores, ...influenciadores, ...usuariosFinais].filter((p) => {
    const k = norm(p);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  if (buscaveis.length === 0) {
    const fallback = ['Diretor', 'Head de TI', 'Gerente'];
    return { decisores: fallback, influenciadores: [], usuariosFinais: [], buscaveis: fallback };
  }
  return { decisores, influenciadores, usuariosFinais, buscaveis };
}

export interface DecisoresPublicoResult {
  ok: boolean;
  buscas: number;
  candidatos: number;
  criados: number;
  enriquecidos: number;
  descartadosPeloVerificador: string[];
  motivo?: string;
  /** Camada 4: busca de CONTATO por nome, em decisores já mapeados. */
  buscasContato?: number;
  contatosEnriquecidos?: number;
  /** Falha pontual da Camada 4 (best-effort): não derruba o resultado principal. */
  avisos?: string[];
  /** Score/confiança/status recalculados quando o mapeamento mudou algo. */
  reavaliacao?: ReavaliarResult;
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
  // Decisor, influenciadores e usuario final declarados no Perfil, por ordem
  // de prioridade; as queries usam os primeiros, o prompt ve os tres grupos.
  const papeis = montarPapeisAlvo(perfil);
  const papeisAlvo: string[] = papeis.buscaveis.slice(0, 3);

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
      // 14-15/07/2026: antes só propagava em 501 ("nenhum provedor
      // configurado"), e um 403 do provedor configurado (webSearch agora
      // 502 fonte_falhou, depois de esgotar a cascata) era engolido pelo
      // logger.warn e o laço seguia calado — a tela dizia "0 decisores"
      // quando na verdade NENHUMA busca tinha de fato acontecido. Camada 1
      // é a promessa central deste endpoint: se a fonte quebrou, propaga.
      logger.warn(`[MiraDecisoresPublico] busca falhou: ${err?.message ?? err}`);
      throw err;
    }
  }

  // Corpus verificavel: tudo que veio de fonte real (para o verificador).
  const corpusNorm = norm(resultados.map((r) => `${r.title} ${r.snippet}`).join(' \n '));
  const urlsPorNome = (nome: string): string[] => resultadosPorNome(nome).map((r) => r.url);
  const resultadosPorNome = (nome: string): SerpResult[] => {
    const n = norm(nome);
    return resultados.filter((r) => norm(`${r.title} ${r.snippet}`).includes(n));
  };

  // Camada 2/3 (extração + verificador) só faz sentido com resultado da
  // busca geral; sem hit nenhum, pula direto para a Camada 4 (contato dos
  // já mapeados), que é independente disto e não pode ficar refém de a
  // busca genérica ter achado gente NOVA.
  let candidatosLen = 0;
  let criados = 0;
  let enriquecidos = 0;
  const descartados: string[] = [];
  const agora = new Date().toISOString();

  if (resultados.length > 0) {
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
    `PAPEIS QUE O CLIENTE QUER ALCANCAR (quem assina): ${papeis.decisores.join(', ')}`,
    papeis.influenciadores.length ? `INFLUENCIADORES TIPICOS (tambem valem): ${papeis.influenciadores.join(', ')}` : null,
    papeis.usuariosFinais.length ? `USUARIO FINAL TIPICO (menor prioridade): ${papeis.usuariosFinais.join(', ')}` : null,
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
  ]
    .filter((l): l is string => l !== null)
    .join('\n');

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
  candidatosLen = candidatos.length;

  // -- Camada 3: VERIFICADOR programatico + persistencia ---------------
  const existentes = new Map<string, any>(alvo.decisores.map((d: any) => [norm(d.nome), d]));

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
        // sem rebaixar a confianca de fonte oficial. Aproveita os MESMOS
        // resultados (já filtrados pelo nome) para extrair contato — poupa
        // a Camada 4 de refazer a busca por quem acabou de ser achado aqui.
        const lineageAntigo = Array.isArray(existente.lineage) ? existente.lineage : [];
        const contatoAchado = extrairContatoPublico(resultadosPorNome(nome));
        const perfilPublicoAntigo = (existente.perfilPublico as any) ?? {};
        const perfilPublicoNovo = {
          ...perfilPublico,
          linkedinUrl: perfilPublicoAntigo.linkedinUrl ?? contatoAchado.linkedinUrl,
          instagramUrl: perfilPublicoAntigo.instagramUrl ?? contatoAchado.instagramUrl,
          contatoBuscadoEm: agora,
        };
        const contatoAntigo = (existente.contato as any) ?? {};
        const contatoNovo = {
          ...contatoAntigo,
          email: contatoAntigo.email ?? contatoAchado.email,
          phone: contatoAntigo.phone ?? contatoAchado.telefone,
        };
        await prisma.miraDecisor.update({
          where: { id: existente.id },
          data: {
            perfilPublico: perfilPublicoNovo,
            contato: contatoNovo.email || contatoNovo.phone ? contatoNovo : existente.contato,
            lineage: [...lineageAntigo, ...lineage],
            confianca: Math.max(existente.confianca ?? 0, confianca),
            senioridade: existente.senioridade ?? cargo,
          },
        });
        enriquecidos++;
      } else if (!existente) {
        await prisma.miraDecisor.create({
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
      await prisma.miraAlvo.update({ where: { id: alvo.id }, data: { fontes } });
    } catch {
      /* nao critico */
    }
  }
  } // fim do if (resultados.length > 0) — Camada 2/3

  // ── Camada 4: contato dos decisores JÁ MAPEADOS (pedido do Rodrigo) ────
  // Diferente da Camada 1 (procura o CARGO na empresa), aqui a busca é pelo
  // NOME EXATO de quem já está no comitê — tipicamente vindo do QSA (Motor
  // A/B), que tem só nome, sem LinkedIn/e-mail/telefone/Instagram. Sem isso
  // o dossiê tem decisor mapeado e nenhum jeito de abordá-lo. Roda mesmo
  // quando a Camada 1 não achou ninguém NOVO — é independente.
  //
  // Best-effort: falha aqui vira aviso, não derruba um resultado que já foi
  // bem-sucedido nas camadas anteriores (ou que nem tentou nada antes, se
  // não havia decisor novo para achar).
  let buscasContato = 0;
  let contatosEnriquecidos = 0;
  const avisos: string[] = [];
  try {
    const decisoresAtuais = await prisma.miraDecisor.findMany({ where: { alvoId: alvo.id } });
    const semContato = decisoresAtuais
      .filter((d: any) => !((d.perfilPublico as any)?.contatoBuscadoEm))
      .sort((a: any, b: any) => Number(b.vinculoQsa) - Number(a.vinculoQsa)) // QSA primeiro
      .slice(0, MAX_DECISORES_CONTATO);

    for (const d of semContato) {
      const nomeNorm = norm(d.nome);
      const queriesContato = [
        `"${d.nome}" "${empresa}" site:linkedin.com/in`,
        `"${d.nome}" "${empresa}" (instagram.com OR contato OR email OR telefone)`,
      ];
      const achados: SerpResult[] = [];
      for (const q of queriesContato) {
        try {
          const hits = await webSearch(organizationId, q, { limit: 6, alvoId });
          buscasContato++;
          for (const h of hits) {
            if (norm(`${h.title} ${h.snippet}`).includes(nomeNorm)) achados.push(h);
          }
        } catch (err: any) {
          logger.warn(`[MiraDecisoresPublico] busca de contato falhou p/ "${d.nome}": ${err?.message ?? err}`);
          avisos.push(`A busca de contato de "${d.nome}" falhou (${err?.message ?? err}); tentamos de novo no próximo clique.`);
        }
      }

      const contatoAchado = extrairContatoPublico(achados);
      const perfilPublicoAtual = (d.perfilPublico as any) ?? {};
      const linkedinUrl = perfilPublicoAtual.linkedinUrl ?? contatoAchado.linkedinUrl;
      const instagramUrl = perfilPublicoAtual.instagramUrl ?? contatoAchado.instagramUrl;
      const contatoAtual = (d.contato as any) ?? {};
      const email = contatoAtual.email ?? contatoAchado.email;
      const phone = contatoAtual.phone ?? contatoAchado.telefone;
      const teveNovidade = Boolean(
        (!perfilPublicoAtual.linkedinUrl && contatoAchado.linkedinUrl) ||
          (!perfilPublicoAtual.instagramUrl && contatoAchado.instagramUrl) ||
          (!contatoAtual.email && contatoAchado.email) ||
          (!contatoAtual.phone && contatoAchado.telefone)
      );
      const novasFontes = [contatoAchado.linkedinUrl, contatoAchado.instagramUrl].filter(
        (u): u is string => Boolean(u)
      );
      const lineageAntigo = Array.isArray(d.lineage) ? d.lineage : [];

      await prisma.miraDecisor.update({
        where: { id: d.id },
        data: {
          // contatoBuscadoEm grava SEMPRE (achando ou não): sem isso, todo
          // clique repetiria a mesma busca por quem já foi checado e nada tinha.
          perfilPublico: { ...perfilPublicoAtual, linkedinUrl, instagramUrl, contatoBuscadoEm: agora },
          contato: email || phone ? { ...contatoAtual, email, phone } : d.contato,
          lineage: novasFontes.length
            ? [...lineageAntigo, ...novasFontes.map((u) => ({ campo: 'contato_pegada_publica', url: u, data: agora }))]
            : lineageAntigo,
        },
      });
      if (teveNovidade) contatosEnriquecidos++;
    }
  } catch (err: any) {
    // Erro fora do laço de busca (ex.: falha ao listar decisores): não
    // propaga, mas registra — Camada 1-3 já produziram um resultado válido.
    logger.error(`[MiraDecisoresPublico] Camada 4 (contato) quebrou alvo=${alvoId}: ${err?.message ?? err}`);
    avisos.push('A busca de contato dos decisores já mapeados não pôde rodar desta vez.');
  }

  // ── Reavaliação: decisor novo muda a nota E pode mudar o status ────
  // Este é o caso que mais importa do pedido do Rodrigo: um Alvo entra "Em
  // qualificação" justamente por NÃO ter decisor (firma individual, sem QSA).
  // Se o mapeamento acha alguém no LinkedIn, o motivo do "em qualificação"
  // deixou de existir e ele tem que virar Pronto na hora, sem o cliente
  // precisar reclicar nada. Só reavalia se algo mudou de fato.
  let reavaliacao: ReavaliarResult | null = null;
  if (criados + enriquecidos + contatosEnriquecidos > 0) {
    reavaliacao = await reavaliarAlvo(organizationId, alvo.id);
  }

  logger.info(
    `[MiraDecisoresPublico] alvo=${alvoId} buscas=${buscas} candidatos=${candidatosLen} criados=${criados} enriquecidos=${enriquecidos} descartados=${descartados.length} buscasContato=${buscasContato} contatosEnriquecidos=${contatosEnriquecidos}${reavaliacao ? ` score=${reavaliacao.scoreAntes}→${reavaliacao.scoreDepois} status=${reavaliacao.statusAntes}→${reavaliacao.statusDepois}` : ''}`
  );
  return {
    ok: true,
    buscas,
    candidatos: candidatosLen,
    criados,
    enriquecidos,
    descartadosPeloVerificador: descartados,
    buscasContato,
    contatosEnriquecidos,
    ...(avisos.length ? { avisos } : {}),
    ...(reavaliacao ? { reavaliacao } : {}),
  };
}

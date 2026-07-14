/**
 * Mira Prospects — Motor B (descoberta net-new).
 *
 * v1 com duas trilhas e honestidade de fonte (doc 08):
 *   - B2C/negócio local: Google Places Text Search (fonte oficial Google,
 *     legalmente limpa). Requer GOOGLE_API_KEY com Places API habilitada.
 *   - B2B por CNAE/região: exige a base pública de CNPJ ingerida (job
 *     mensal) ou provedor licenciado. Até lá o endpoint devolve
 *     `fonte_indisponivel` com mensagem honesta (nunca dado inventado).
 *
 * Gate B2C: identidade Google (placeId) + nome + contato verificável
 * (telefone OU site). Passou → READY e desconta cota, como no Motor A.
 */
import { prisma } from '@zappiq/database';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import { computeMiraScoreB2C } from './score.js';

import { getMiraEntitlement, consumeMiraQuota, MiraQuotaExceededError } from '../../middleware/requireMira.js';

const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const TIMEOUT_MS = 12_000;
const MAX_RESULTADOS = 20;

export interface PlaceHit {
  placeId: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  site: string | null;
  rating: number | null;
  totalAvaliacoes: number | null;
}

export interface MotorBResult {
  fonte: 'google_places';
  encontrados: number;
  criados: number;
  prontos: number;
  duplicados: number;
  blocked: boolean;
  quota: { used: number; total: number; remaining: number };
  /** Região que a busca de fato usou (vem da campanha, semeada do Perfil). */
  regiaoAplicada: string | null;
  regiaoOrigem: 'campanha' | null;
}

export function placesDisponivel(): boolean {
  return Boolean(env.GOOGLE_API_KEY);
}

async function logLookup(organizationId: string, resultado: 'valido' | 'nao_encontrado' | 'erro', latenciaMs: number) {
  try {
    await (prisma as any).miraEnriquecimentoLog.create({
      data: { organizationId, fonte: 'google_places', tipo: 'descoberta_local', resultado, custoCreditos: 0, latenciaMs },
    });
  } catch {
    /* telemetria não derruba pipeline */
  }
}

async function searchPlaces(organizationId: string, consulta: string, regiao: string | null): Promise<PlaceHit[]> {
  const textQuery = regiao ? `${consulta} em ${regiao}` : consulta;
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(PLACES_SEARCH_URL, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': env.GOOGLE_API_KEY as string,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount',
      },
      body: JSON.stringify({ textQuery, languageCode: 'pt-BR', regionCode: 'BR', pageSize: MAX_RESULTADOS }),
    });
    const latencia = Date.now() - t0;
    if (!res.ok) {
      await logLookup(organizationId, 'erro', latencia);
      const body = await res.text().catch(() => '');
      logger.warn(`[MiraMotorB] Places ${res.status}: ${body.slice(0, 200)}`);
      const err: any = new Error('places_erro');
      err.status = 502;
      throw err;
    }
    const data: any = await res.json();
    const places: any[] = Array.isArray(data.places) ? data.places : [];
    await logLookup(organizationId, places.length ? 'valido' : 'nao_encontrado', latencia);
    return places.map((p) => ({
      placeId: String(p.id ?? ''),
      nome: String(p.displayName?.text ?? '').trim(),
      endereco: p.formattedAddress ? String(p.formattedAddress) : null,
      telefone: p.nationalPhoneNumber ? String(p.nationalPhoneNumber).replace(/\D/g, '') : null,
      site: p.websiteUri ? String(p.websiteUri) : null,
      rating: typeof p.rating === 'number' ? p.rating : null,
      totalAvaliacoes: typeof p.userRatingCount === 'number' ? p.userRatingCount : null,
    }));
  } finally {
    clearTimeout(timer);
  }
}

/** Extrai município/UF aproximados do endereço formatado do Google. */
function parseEndereco(endereco: string | null): { municipio: string | null; uf: string | null } {
  if (!endereco) return { municipio: null, uf: null };
  // padrão típico: "Rua X, 123 - Bairro, Cidade - UF, 00000-000, Brasil"
  const m = endereco.match(/,\s*([^,-]+?)\s*-\s*([A-Z]{2})\s*,/);
  if (m) return { municipio: m[1].trim(), uf: m[2] };
  return { municipio: null, uf: null };
}

/**
 * Descoberta B2C (negócio local, Places) a partir do que a CAMPANHA pede.
 * `busca.alvos`/`busca.regioes` nascem do Perfil e o cliente ajusta no wizard.
 */
export async function runMotorB(
  organizationId: string,
  busca: { alvos: string[]; regioes: string[] },
  campanhaId?: string | null
): Promise<MotorBResult> {
  if (!placesDisponivel()) {
    const err: any = new Error('fonte_indisponivel');
    err.status = 501;
    throw err;
  }
  const perfil = await (prisma as any).miraPerfil.findUnique({ where: { organizationId } });
  if (!perfil || (perfil.prontidao ?? 0) < 60) {
    const err: any = new Error('perfil_incompleto');
    err.status = 412;
    throw err;
  }

  const alvos = (busca.alvos ?? []).filter((a) => typeof a === 'string' && a.trim());
  const regioes = (busca.regioes ?? []).filter((r) => typeof r === 'string' && r.trim());
  if (alvos.length === 0) {
    const err: any = new Error('alvos_sem_fonte');
    err.status = 422;
    throw err;
  }
  const consulta = alvos[0];
  const regiaoAplicada = regioes[0] ?? null;

  const hits = await searchPlaces(organizationId, consulta, regiaoAplicada);
  const result: MotorBResult = {
    fonte: 'google_places',
    encontrados: hits.length,
    criados: 0,
    prontos: 0,
    duplicados: 0,
    blocked: false,
    quota: { used: 0, total: 0, remaining: 0 },
    regiaoAplicada,
    regiaoOrigem: regiaoAplicada ? 'campanha' : null,
  };

  for (const hit of hits) {
    if (!hit.placeId || !hit.nome) continue;

    const entNow = await getMiraEntitlement(organizationId);
    result.quota = { used: entNow.quota.used, total: entNow.quota.total, remaining: entNow.quota.remaining };
    if (entNow.quota.blocked) {
      result.blocked = true;
      break;
    }

    // Dedup por placeId na org
    const existente = await (prisma as any).miraAlvo.findFirst({
      where: { organizationId, placeId: hit.placeId },
      select: { id: true },
    });
    if (existente) {
      result.duplicados++;
      continue;
    }

    const { municipio, uf } = parseEndereco(hit.endereco);
    const { score, breakdown, confianca } = computeMiraScoreB2C(perfil, hit, { municipio, uf });
    const agora = new Date().toISOString();
    const gateOk = Boolean(hit.telefone || hit.site); // contato verificável

    const resumo =
      `${hit.nome}${municipio ? `, ${[municipio, uf].filter(Boolean).join('/')}` : ''}. ` +
      `${hit.rating ? `Avaliação ${hit.rating} (${hit.totalAvaliacoes ?? 0} avaliações). ` : ''}` +
      `${hit.site ? 'Tem site. ' : 'Sem site público. '}` +
      `Descoberto no Google Places pela campanha ("${consulta}${regiaoAplicada ? ` em ${regiaoAplicada}` : ''}").`;

    try {
      const alvo = await (prisma as any).miraAlvo.create({
        data: {
          organizationId,
          campanhaId: campanhaId ?? null,
          kind: 'B2C',
          motor: 'DESCOBERTA',
          status: 'QUALIFYING',
          nome: hit.nome,
          municipio,
          uf,
          site: hit.site,
          telefone: hit.telefone,
          placeId: hit.placeId,
          miraScore: score,
          scoreBreakdown: breakdown,
          confianca,
          resumo,
          fontes: [{ campo: 'descoberta_local', url: `https://www.google.com/maps/place/?q=place_id:${hit.placeId}`, data: agora, confianca: 90 }],
        },
        select: { id: true },
      });
      result.criados++;

      if (gateOk) {
        try {
          const quota = await consumeMiraQuota(organizationId);
          await (prisma as any).miraAlvo.update({
            where: { id: alvo.id },
            data: { status: 'READY', countedInQuota: true, quotaMonth: entNow.monthKey },
          });
          result.prontos++;
          result.quota = { used: quota.used, total: quota.total, remaining: quota.remaining };
          if (quota.blocked) {
            result.blocked = true;
            break;
          }
        } catch (err) {
          if (err instanceof MiraQuotaExceededError) {
            result.blocked = true;
            break;
          }
          throw err;
        }
      }
    } catch (err: any) {
      logger.error(`[MiraMotorB] falha ao criar alvo place=${hit.placeId}: ${err?.message ?? err}`);
    }
  }

  logger.info(
    `[MiraMotorB] org=${organizationId} q="${consulta}" encontrados=${result.encontrados} criados=${result.criados} prontos=${result.prontos}`
  );
  return result;
}

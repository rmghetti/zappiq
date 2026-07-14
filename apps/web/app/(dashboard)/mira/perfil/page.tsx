'use client';

/**
 * Mira Prospects — Perfil de Prospecção (/(dashboard)/mira/perfil)
 *
 * O "Motor 0": o survey que diz aos agentes O QUE procurar e COMO qualificar.
 * Salva por inteiro (PUT /api/mira/perfil) e devolve a prontidão (0-100). Sem
 * perfil >= 60, os motores não largam.
 *
 * Duas coisas moldam esta tela:
 *
 * 1. O formulário é condicional. "Quem compra de você?" não é enfeite: B2B e
 *    B2C pedem perguntas quase disjuntas (CNAE e comitê de compra de um lado,
 *    faixa etária e momento de vida do outro). Os dois alvos ficam no estado
 *    ao mesmo tempo, então alternar não perde o que já foi digitado.
 *
 * 2. O que fala do negócio do cliente chega preenchido. Ele já respondeu isso
 *    no cadastro e no Treinar IA; pedir de novo era atrito. Os campos de alvo
 *    seguem manuais de propósito: público atual não é público-alvo.
 *
 * A página só orquestra (estado, sugestão, salvamento). Campos e blocos vivem
 * em components/mira/perfil/.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Loader2, CheckCircle2, ArrowLeft, Save, Building2, Users } from 'lucide-react';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { BlocoNegocio } from '@/components/mira/perfil/BlocoNegocio';
import { BlocoComum } from '@/components/mira/perfil/BlocoComum';
import { BlocoB2B } from '@/components/mira/perfil/BlocoB2B';
import { BlocoB2C } from '@/components/mira/perfil/BlocoB2C';
import { FaixaSugestao } from '@/components/mira/perfil/FaixaSugestao';
import {
  miraApi,
  EMPTY_PERFIL,
  alvoAtivo,
  type MiraPerfil,
  type AlvoB2B,
  type AlvoB2C,
  type SugestaoPerfil,
} from '@/lib/miraApi';

/**
 * Junta o rascunho ao que já está na tela. Nunca sobrescreve: soma o que falta
 * e preserva o que o cliente digitou, então reaplicar ("Preencher de novo") é
 * seguro.
 */
function aplicarSugestao(perfil: MiraPerfil, s: SugestaoPerfil): MiraPerfil {
  const uniao = (atual: string[], novo: string[]) => Array.from(new Set([...atual, ...novo]));
  return {
    ...perfil,
    segmento: perfil.segmento ?? s.segmento,
    subsegmentos: uniao(perfil.subsegmentos, s.subsegmentos),
    catalogo: [...perfil.catalogo, ...s.catalogo.filter((n) => !perfil.catalogo.some((c) => c.nome === n.nome))],
    doresResolvidas: uniao(perfil.doresResolvidas, s.doresResolvidas),
    resultadosEsperados: uniao(perfil.resultadosEsperados, s.resultadosEsperados),
    casosDeUso: uniao(perfil.casosDeUso, s.casosDeUso),
    diferenciais: uniao(perfil.diferenciais, s.diferenciais),
    concorrentes: uniao(perfil.concorrentes, s.concorrentes),
    ticketMedio: perfil.ticketMedio ?? s.ticketMedio,
  };
}

export default function MiraPerfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<MiraPerfil>(EMPTY_PERFIL);
  const [prontidao, setProntidao] = useState<number>(0);
  const [sugestao, setSugestao] = useState<SugestaoPerfil | null>(null);
  const [sugerindo, setSugerindo] = useState(false);

  const preencherComMeusDados = useCallback(async () => {
    setSugerindo(true);
    try {
      const res = await miraApi.sugerirPerfil();
      setSugestao(res.data);
      setPerfil((p) => aplicarSugestao(p, res.data));
    } catch {
      // Sugestão é conveniência: se falhar, o formulário segue manual.
    } finally {
      setSugerindo(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    miraApi
      .getPerfil()
      .then((res) => {
        if (!alive) return;
        if (res.data) {
          setPerfil({ ...EMPTY_PERFIL, ...res.data });
          setProntidao(res.data.prontidao ?? 0);
        } else {
          // Perfil ainda não existe: é aqui que o auto-preenchimento paga.
          void preencherComMeusDados();
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [preencherComMeusDados]);

  const patch = useCallback((p: Partial<MiraPerfil>) => setPerfil((atual) => ({ ...atual, ...p })), []);
  const patchB2B = useCallback(
    (p: Partial<AlvoB2B>) => setPerfil((atual) => ({ ...atual, alvoB2B: { ...atual.alvoB2B, ...p } })),
    []
  );
  const patchB2C = useCallback(
    (p: Partial<AlvoB2C>) => setPerfil((atual) => ({ ...atual, alvoB2C: { ...atual.alvoB2C, ...p } })),
    []
  );

  /**
   * O selo "sugerido" é função pura do rascunho: um valor é sugerido enquanto
   * estiver no conjunto. Apagou ou trocou, o selo some sozinho — sem rastrear
   * edição, sem estado paralelo.
   */
  const sugeridos = useMemo(
    () => ({
      segmento: Boolean(sugestao?.segmento) && perfil.segmento === sugestao?.segmento,
      subsegmentos: new Set(sugestao?.subsegmentos ?? []),
      catalogo: new Set((sugestao?.catalogo ?? []).map((c) => c.nome)),
      doresResolvidas: new Set(sugestao?.doresResolvidas ?? []),
      resultadosEsperados: new Set(sugestao?.resultadosEsperados ?? []),
      casosDeUso: new Set(sugestao?.casosDeUso ?? []),
      diferenciais: new Set(sugestao?.diferenciais ?? []),
      concorrentes: new Set(sugestao?.concorrentes ?? []),
      ticketMedio: Boolean(sugestao?.ticketMedio) && perfil.ticketMedio === sugestao?.ticketMedio,
    }),
    [sugestao, perfil.segmento, perfil.ticketMedio]
  );

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { id, prontidao: _p, ...payload } = perfil as MiraPerfil & { id?: string };
      const res = await miraApi.savePerfil(payload as MiraPerfil);
      setProntidao(res.data.prontidao ?? 0);
      setSavedAt(Date.now());
    } catch (e: any) {
      setError(e?.message || 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  const ativo = alvoAtivo(perfil);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/mira" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft size={14} /> Mira Prospects
      </Link>

      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
            <ClipboardList className="text-primary-600" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-1.5">
              Perfil de Prospecção
              <SaibaMais featureKey="mira.perfil" />
            </h1>
            <p className="text-sm text-gray-500">O que você vende e para quem. É daqui que os agentes partem.</p>
          </div>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
            prontidao >= 60 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          {prontidao}% pronto
        </span>
      </div>

      <div className="mb-5">
        <FaixaSugestao sugestao={sugestao} carregando={sugerindo} onPreencher={preencherComMeusDados} />
      </div>

      <div className="space-y-5">
        <Card title="Quem compra de você?" featureKey="mira.perfil.modo">
          <div className="grid grid-cols-2 gap-3">
            <ModeButton
              active={perfil.tipoCliente === 'B2B'}
              icon={Building2}
              title="Empresas (B2B)"
              desc="Vendo para outras empresas"
              onClick={() => patch({ tipoCliente: 'B2B' })}
            />
            <ModeButton
              active={perfil.tipoCliente === 'B2C'}
              icon={Users}
              title="Consumidores (B2C)"
              desc="Vendo para pessoas e negócios locais"
              onClick={() => patch({ tipoCliente: 'B2C' })}
            />
          </div>
        </Card>

        <BlocoNegocio
          perfil={perfil}
          sugeridos={{ segmento: sugeridos.segmento, subsegmentos: sugeridos.subsegmentos }}
          onChange={patch}
        />

        <BlocoComum perfil={perfil} sugeridos={sugeridos} onChange={patch} />

        {ativo.tipoCliente === 'B2B' ? (
          <BlocoB2B alvo={ativo.alvo} onChange={patchB2B} />
        ) : (
          <BlocoB2C alvo={ativo.alvo} onChange={patchB2C} />
        )}
      </div>

      <div className="sticky bottom-4 mt-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3.5 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500 pl-1">
            {error ? (
              <span className="text-red-500">{error}</span>
            ) : savedAt ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <CheckCircle2 size={13} /> Perfil salvo · prontidão {prontidao}%
                {prontidao >= 60 && (
                  <Link href="/mira?novaCampanha=1" className="ml-2 font-medium text-primary-600 hover:underline">
                    Criar primeira campanha →
                  </Link>
                )}
              </span>
            ) : (
              'Os agentes usam este perfil para mapear e qualificar.'
            )}
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 shrink-0"
          >
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            Salvar perfil
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Locais da página ────────────────────────────────────────────── */
function Card({ title, featureKey, children }: { title: string; featureKey?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
        {title}
        {featureKey && <SaibaMais featureKey={featureKey} />}
      </h3>
      {children}
    </div>
  );
}

function ModeButton({
  active,
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon: any;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left rounded-xl border p-3.5 transition-all ${
        active ? 'border-primary-400 bg-primary-50/50 ring-1 ring-primary-200' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <Icon size={18} className={active ? 'text-primary-600' : 'text-gray-400'} />
      <p className="text-sm font-semibold text-gray-900 mt-1.5">{title}</p>
      <p className="text-xs text-gray-500">{desc}</p>
    </button>
  );
}

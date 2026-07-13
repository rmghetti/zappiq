'use client';

/**
 * Mira Prospects — Perfil de Prospecção (/(dashboard)/mira/perfil)
 *
 * O "Motor 0": o survey que diz aos agentes O QUE procurar e COMO
 * qualificar. Salva por inteiro (PUT /api/mira/perfil) e devolve a
 * prontidão (0-100). Sem perfil >= 60, os motores não largam.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Loader2,
  Plus,
  X,
  CheckCircle2,
  ArrowLeft,
  Save,
  Building2,
  Users,
} from 'lucide-react';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { miraApi, EMPTY_PERFIL, type MiraPerfil } from '@/lib/miraApi';

export default function MiraPerfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<MiraPerfil>(EMPTY_PERFIL);
  const [prontidao, setProntidao] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    miraApi
      .getPerfil()
      .then((res) => {
        if (!alive) return;
        if (res.data) {
          setPerfil({ ...EMPTY_PERFIL, ...res.data });
          setProntidao(res.data.prontidao ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { id, prontidao: _p, ...payload } = perfil as any;
      const res = await miraApi.savePerfil(payload);
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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/mira" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft size={14} /> Mira Prospects
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
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
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            prontidao >= 60 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          {prontidao}% pronto
        </span>
      </div>

      <div className="space-y-5">
        {/* Modo */}
        <Card title="Quem compra de você?" featureKey="mira.perfil.modo">
          <div className="grid grid-cols-2 gap-3">
            <ModeButton
              active={perfil.modo === 'B2B'}
              icon={Building2}
              title="Empresas (B2B)"
              desc="Vendo para outras empresas"
              onClick={() => setPerfil((p) => ({ ...p, modo: 'B2B' }))}
            />
            <ModeButton
              active={perfil.modo === 'B2C'}
              icon={Users}
              title="Consumidores (B2C)"
              desc="Vendo para pessoas e negócios locais"
              onClick={() => setPerfil((p) => ({ ...p, modo: 'B2C' }))}
            />
          </div>
        </Card>

        {/* Segmento */}
        <Card title="Seu negócio" featureKey="mira.perfil.segmento">
          <label className="block text-xs font-medium text-gray-500 mb-1">Segmento principal</label>
          <input
            type="text"
            value={perfil.segmento ?? ''}
            onChange={(e) => setPerfil((p) => ({ ...p, segmento: e.target.value }))}
            placeholder="Ex.: Infraestrutura e segurança de TI"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
          <div className="mt-3">
            <TagInput
              label="Subsegmentos (opcional)"
              placeholder="Ex.: Cloud, NOC, SOC…"
              values={perfil.subsegmentos}
              onChange={(v) => setPerfil((p) => ({ ...p, subsegmentos: v }))}
            />
          </div>
        </Card>

        {/* Catálogo */}
        <Card title="Produtos e serviços (catálogo)" featureKey="mira.perfil.catalogo">
          <CatalogEditor
            items={perfil.catalogo}
            onChange={(catalogo) => setPerfil((p) => ({ ...p, catalogo }))}
          />
        </Card>

        {/* ICP */}
        {perfil.modo === 'B2B' ? (
          <Card title="Perfil da empresa ideal (ICP)" featureKey="mira.perfil.icp">
            <div className="space-y-3">
              <TagInput
                label="CNAEs ou atividades-alvo"
                placeholder="Ex.: 4651-6 ou 'distribuidoras de TI'"
                values={perfil.icpFirmografia.cnaes}
                onChange={(cnaes) => setPerfil((p) => ({ ...p, icpFirmografia: { ...p.icpFirmografia, cnaes } }))}
              />
              <TagInput
                label="Portes"
                placeholder="Ex.: ME, EPP, Médio…"
                values={perfil.icpFirmografia.portes}
                onChange={(portes) => setPerfil((p) => ({ ...p, icpFirmografia: { ...p.icpFirmografia, portes } }))}
              />
              <TagInput
                label="Regiões"
                placeholder="Ex.: SP capital, Sul, Brasil…"
                values={perfil.icpFirmografia.regioes}
                onChange={(regioes) => setPerfil((p) => ({ ...p, icpFirmografia: { ...p.icpFirmografia, regioes } }))}
              />
            </div>
          </Card>
        ) : (
          <Card title="Perfil do cliente ideal (B2C)" featureKey="mira.perfil.icp">
            <label className="block text-xs font-medium text-gray-500 mb-1">Descreva quem compra</label>
            <textarea
              value={perfil.icpB2c.perfil ?? ''}
              onChange={(e) => setPerfil((p) => ({ ...p, icpB2c: { ...p.icpB2c, perfil: e.target.value } }))}
              placeholder="Ex.: mulheres 30-55 interessadas em estética, na zona sul de SP…"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            <div className="mt-3">
              <TagInput
                label="Regiões"
                placeholder="Ex.: Moema, zona sul de SP…"
                values={perfil.icpB2c.regioes}
                onChange={(regioes) => setPerfil((p) => ({ ...p, icpB2c: { ...p.icpB2c, regioes } }))}
              />
            </div>
          </Card>
        )}

        {/* Áreas compradoras */}
        <Card title="Quem decide a compra (papéis-alvo)" featureKey="mira.perfil.areas">
          <TagInput
            label="Cargos e áreas que compram o que você vende"
            placeholder="Ex.: CEO, Diretor de TI, CISO, Compras…"
            values={perfil.areasCompradoras}
            onChange={(areasCompradoras) => setPerfil((p) => ({ ...p, areasCompradoras }))}
          />
        </Card>

        {/* Diferenciais + concorrentes */}
        <Card title="Diferenciais e concorrência" featureKey="mira.perfil.diferenciais">
          <div className="space-y-3">
            <TagInput
              label="Seus diferenciais"
              placeholder="Ex.: SLA 99,9%, suporte 24/7…"
              values={perfil.diferenciais}
              onChange={(diferenciais) => setPerfil((p) => ({ ...p, diferenciais }))}
            />
            <TagInput
              label="Principais concorrentes"
              placeholder="Ex.: Empresa X, Empresa Y…"
              values={perfil.concorrentes}
              onChange={(concorrentes) => setPerfil((p) => ({ ...p, concorrentes }))}
            />
          </div>
        </Card>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-4 mt-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3.5 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500 pl-1">
            {error ? (
              <span className="text-red-500">{error}</span>
            ) : savedAt ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <CheckCircle2 size={13} /> Perfil salvo · prontidão {prontidao}%
              </span>
            ) : (
              'Os agentes usam este perfil para mapear e qualificar.'
            )}
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            Salvar perfil
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Blocos de UI ────────────────────────────────────────────────── */
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

function TagInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder?: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return setDraft('');
    onChange([...values, v]);
    setDraft('');
  };
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          aria-label={`Adicionar em ${label}`}
        >
          <Plus size={16} />
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded-full"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="text-gray-400 hover:text-gray-600"
                aria-label={`Remover ${v}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogEditor({
  items,
  onChange,
}: {
  items: MiraPerfil['catalogo'];
  onChange: (items: MiraPerfil['catalogo']) => void;
}) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const add = () => {
    const n = nome.trim();
    if (!n) return;
    onChange([...items, { nome: n, descricao: descricao.trim() }]);
    setNome('');
    setDescricao('');
  };
  return (
    <div>
      <div className="grid sm:grid-cols-[1fr_1.4fr_auto] gap-2">
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Produto ou serviço"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
        <input
          type="text"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="O que resolve (curto)"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          aria-label="Adicionar item ao catálogo"
        >
          <Plus size={16} />
        </button>
      </div>
      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {items.map((it, i) => (
            <li
              key={`${it.nome}-${i}`}
              className="flex items-center justify-between text-sm bg-gray-50 border border-gray-100 rounded-lg px-3 py-2"
            >
              <span>
                <span className="font-medium text-gray-800">{it.nome}</span>
                {it.descricao ? <span className="text-gray-500"> · {it.descricao}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-gray-600"
                aria-label={`Remover ${it.nome}`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-400 mt-2">
        É contra este catálogo que a Mira cruza as demandas de cada conta (as oportunidades nº 1 e nº 2 do dossiê).
      </p>
    </div>
  );
}

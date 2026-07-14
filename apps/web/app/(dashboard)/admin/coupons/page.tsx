'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket, Copy, Check, Loader2, Plus, Zap } from 'lucide-react';
import { useAuthStore } from '../../../../stores/authStore';
import { api } from '../../../../lib/api';

interface CatalogItem {
  key: string;
  label: string;
  productId: string;
  type: 'plan' | 'addon';
  /** Família comercial do add-on (ex.: IMPULSO). Ausente nos planos. */
  family?: string;
  /** Preço mensal em BRL (null = sob consulta). */
  monthlyBrl?: number | null;
}
interface IssuedCoupon {
  code: string;
  productLabel: string;
  percentOff: number;
  duration: string;
  durationInMonths: number | null;
  createdByEmail: string;
  timesRedeemed: number;
  used: boolean;
  active: boolean;
  status: 'used' | 'available' | 'canceled';
  canCancel: boolean;
  createdAt: string;
}

const PERCENTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const DURATIONS: { value: string; label: string; months?: number }[] = [
  { value: 'once', label: '1º ciclo (once)' },
  { value: 'repeating:3', label: '3 meses' },
  { value: 'repeating:6', label: '6 meses' },
  { value: 'repeating:12', label: '12 meses' },
  { value: 'forever', label: 'Vitalício (forever)' },
];

function durationLabel(duration: string, months: number | null): string {
  if (duration === 'once') return '1º ciclo';
  if (duration === 'forever') return 'Vitalício';
  return months ? `${months} meses` : 'Recorrente';
}

/** Formata BRL: R$ 197 (inteiro) ou R$ 1.891,20 (com centavos). */
function brl(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Rótulo da opção no dropdown, com valor mensal quando houver. */
function optionLabel(c: CatalogItem): string {
  return c.monthlyBrl != null ? `${c.label} · ${brl(c.monthlyBrl)}/mês` : c.label;
}

export default function CouponsAdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') router.push('/dashboard');
  }, [user, router]);

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [issued, setIssued] = useState<IssuedCoupon[]>([]);
  const [productId, setProductId] = useState('');
  const [percentOff, setPercentOff] = useState(30);
  const [durationSel, setDurationSel] = useState('once');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<{ code: string; label: string; percent: number; dur: string; monthlyBrl: number | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [canceling, setCanceling] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/coupons');
      if (res?.data) setIssued(res.data as IssuedCoupon[]);
    } catch {
      /* fail-soft: lista vazia */
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/admin/coupons/catalog');
        if (res?.data) {
          setCatalog(res.data as CatalogItem[]);
          if ((res.data as CatalogItem[]).length) setProductId((res.data as CatalogItem[])[0].productId);
        }
      } catch {
        /* fail-soft */
      }
    })();
    loadList();
  }, [loadList]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setLastCode(null);
    try {
      const [duration, monthsRaw] = durationSel.split(':');
      const body: Record<string, unknown> = { productId, percentOff, duration };
      if (duration === 'repeating') body.durationInMonths = Number(monthsRaw);
      const res = await api.post('/api/admin/coupons', body);
      const d = res?.data;
      if (d?.code) {
        const selected = catalog.find((c) => c.productId === productId);
        setLastCode({
          code: d.code,
          label: d.productLabel,
          percent: d.percentOff,
          dur: durationLabel(d.duration, d.durationInMonths ?? null),
          monthlyBrl: selected?.monthlyBrl ?? null,
        });
        loadList();
      }
    } catch (err: any) {
      setError(err?.message || 'Não consegui gerar o cupom. Tente de novo.');
    }
    setGenerating(false);
  }

  async function handleCancel(code: string) {
    if (!window.confirm(`Cancelar o cupom ${code}? Ele deixará de ser válido. (Só funciona se ainda não foi usado.)`)) return;
    setCanceling(code);
    try {
      await api.delete(`/api/admin/coupons/${encodeURIComponent(code)}`);
      await loadList();
    } catch (err: any) {
      // 409 = já usado; mostra a mensagem do servidor.
      alert(err?.message || 'Não consegui cancelar este cupom.');
      await loadList();
    }
    setCanceling(null);
  }

  function copyCode() {
    if (!lastCode) return;
    navigator.clipboard?.writeText(lastCode.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const impulsoItems = catalog.filter((c) => c.family === 'IMPULSO');

  if (user?.role !== 'SUPERADMIN') return null;

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
          <Ticket className="text-primary-600" size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cupons de Descontos</h1>
          <p className="text-sm text-gray-500">
            Gere um cupom restrito a UM produto, de uso único. Envie o código ao cliente.
          </p>
        </div>
      </div>

      {/* Gerador */}
      <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-bold text-gray-800">Gerar novo cupom</h2>

          <label className="mb-1 block text-xs font-medium text-gray-500">Produto</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <optgroup label="Planos">
              {catalog.filter((c) => c.type === 'plan').map((c) => (
                <option key={c.productId} value={c.productId}>{optionLabel(c)}</option>
              ))}
            </optgroup>
            {impulsoItems.length > 0 && (
              <optgroup label="Zap Impulso">
                {impulsoItems.map((c) => (
                  <option key={c.productId} value={c.productId}>{optionLabel(c)}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="Add-ons">
              {catalog.filter((c) => c.type === 'addon' && c.family !== 'IMPULSO').map((c) => (
                <option key={c.productId} value={c.productId}>{optionLabel(c)}</option>
              ))}
            </optgroup>
          </select>

          <label className="mb-1 block text-xs font-medium text-gray-500">Desconto</label>
          <select
            value={percentOff}
            onChange={(e) => setPercentOff(Number(e.target.value))}
            className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {PERCENTS.map((p) => (
              <option key={p} value={p}>{p}% off</option>
            ))}
          </select>

          <label className="mb-1 block text-xs font-medium text-gray-500">Duração</label>
          <select
            value={durationSel}
            onChange={(e) => setDurationSel(e.target.value)}
            className="mb-5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>

          <button
            onClick={handleGenerate}
            disabled={generating || !productId}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {generating ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
            {generating ? 'Gerando…' : 'Gerar cupom'}
          </button>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {/* Código gerado (copiável) */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <h2 className="mb-4 text-sm font-bold text-gray-800">Código para o cliente</h2>
          {lastCode ? (
            <div>
              <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-primary-300 bg-white p-4">
                <span className="flex-1 select-all font-mono text-lg font-bold tracking-wider text-gray-900">
                  {lastCode.code}
                </span>
                <button
                  onClick={copyCode}
                  className="flex items-center gap-1 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-600">
                {lastCode.percent}% off em <span className="font-semibold">{lastCode.label}</span> · {lastCode.dur} · uso único.
                O cliente digita este código no campo "Cupom de desconto" do checkout desse produto.
              </p>
              {lastCode.monthlyBrl != null && (
                <p className="mt-2 text-xs text-gray-600">
                  Com o cupom fica{' '}
                  <span className="font-bold text-primary-600">
                    {brl(lastCode.monthlyBrl * (1 - lastCode.percent / 100))}/mês
                  </span>{' '}
                  <span className="text-gray-400 line-through">{brl(lastCode.monthlyBrl)}/mês</span>.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Selecione produto + desconto + duração e clique em "Gerar cupom". O código aparece aqui, pronto para copiar.
            </p>
          )}
        </div>
      </div>

      {/* Zap Impulso — planos e valores */}
      {impulsoItems.length > 0 && (
        <div className="mt-8 rounded-2xl border border-primary-100 bg-primary-50/40 p-6">
          <div className="mb-1 flex items-center gap-2">
            <Zap className="text-primary-600" size={18} />
            <h2 className="text-sm font-bold text-gray-800">Planos do Zap Impulso</h2>
          </div>
          <p className="mb-4 text-xs text-gray-500">
            Clique num plano pra selecioná-lo no gerador acima e emitir um cupom exclusivo dele.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {impulsoItems.map((c) => {
              const active = productId === c.productId;
              return (
                <button
                  key={c.productId}
                  type="button"
                  onClick={() => setProductId(c.productId)}
                  className={`rounded-xl border p-4 text-left transition ${
                    active
                      ? 'border-primary-400 bg-white ring-2 ring-primary-200'
                      : 'border-gray-200 bg-white hover:border-primary-300'
                  }`}
                >
                  <div className="text-sm font-bold text-gray-900">{c.label}</div>
                  {c.monthlyBrl != null && (
                    <>
                      <div className="mt-1 text-lg font-extrabold text-primary-600">
                        {brl(c.monthlyBrl)}
                        <span className="ml-0.5 text-xs font-medium text-gray-400">/mês</span>
                      </div>
                      <div className="text-[11px] text-gray-400">
                        ou {brl(c.monthlyBrl * 12 * 0.8)}/ano (20% off)
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Emitidos */}
      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-bold text-gray-800">Cupons emitidos</h2>
        {issued.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum cupom emitido ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase text-gray-400">
                  <th className="py-2 pr-4">Código</th>
                  <th className="py-2 pr-4">Produto</th>
                  <th className="py-2 pr-4">Desconto</th>
                  <th className="py-2 pr-4">Duração</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {issued.map((c) => (
                  <tr key={c.code} className="border-b border-gray-50">
                    <td className="py-2 pr-4 font-mono font-semibold text-gray-900">{c.code}</td>
                    <td className="py-2 pr-4 text-gray-700">{c.productLabel}</td>
                    <td className="py-2 pr-4 text-gray-700">{c.percentOff}%</td>
                    <td className="py-2 pr-4 text-gray-500">{durationLabel(c.duration, c.durationInMonths)}</td>
                    <td className="py-2 pr-4">
                      {c.status === 'used' ? (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">Usado</span>
                      ) : c.status === 'canceled' ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Cancelado</span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Disponível</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {c.canCancel && (
                        <button
                          onClick={() => handleCancel(c.code)}
                          disabled={canceling === c.code}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {canceling === c.code ? 'Cancelando…' : 'Cancelar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

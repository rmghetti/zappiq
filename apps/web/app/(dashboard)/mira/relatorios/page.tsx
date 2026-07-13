'use client';

/**
 * Mira Prospects — Relatórios (/(dashboard)/mira/relatorios)
 *
 * Exportação dos Alvos qualificados (CSV) para trabalhar fora do Dash.
 * O download monta o CSV no cliente a partir de /api/mira/alvos
 * (colunas de prospecção). PDF executivo entra na sequência.
 */
import { useState } from 'react';
import Link from 'next/link';
import { FileSpreadsheet, Loader2, ArrowLeft, Download, FileText } from 'lucide-react';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { miraApi } from '@/lib/miraApi';

export default function MiraRelatoriosPage() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);

  const exportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await miraApi.listAlvos();
      const alvos = res.data.alvos;
      if (alvos.length === 0) {
        setError('Nenhum Alvo para exportar ainda. Complete o Perfil e aguarde o mapeamento.');
        return;
      }
      const header = [
        'nome',
        'nome_fantasia',
        'tipo',
        'motor',
        'status',
        'mira_score',
        'confianca',
        'cnpj',
        'cnae',
        'porte',
        'municipio',
        'uf',
        'gatilho_janela',
        'atualizado_em',
      ];
      const esc = (v: unknown) => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = alvos.map((a) =>
        [
          a.nome,
          a.nomeFantasia ?? '',
          a.kind,
          a.motor === 'BASE_INSTALADA' ? 'Base instalada' : 'Descoberta',
          a.status,
          a.miraScore ?? '',
          a.confianca ?? '',
          a.cnpj ?? '',
          a.cnae ?? '',
          a.porte ?? '',
          a.municipio ?? '',
          a.uf ?? '',
          a.janelaEntrada?.gatilho ?? '',
          new Date(a.updatedAt).toLocaleDateString('pt-BR'),
        ]
          .map(esc)
          .join(';')
      );
      const csv = '﻿' + [header.join(';'), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mira-alvos-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setLastCount(alvos.length);
    } catch (e: any) {
      setError(e?.message || 'Não foi possível exportar agora.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/mira" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft size={14} /> Mira Prospects
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
          <FileSpreadsheet className="text-primary-600" size={22} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-1.5">
            Relatórios
            <SaibaMais featureKey="mira.relatorios" />
          </h1>
          <p className="text-sm text-gray-500">Leve a inteligência para onde você trabalha.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* CSV */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center mb-3">
            <Download className="text-emerald-600" size={18} />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Alvos em CSV</h3>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            A fila completa com score, confiança, firmografia e janela de entrada. Abre no Excel e no
            Google Sheets.
          </p>
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
            Exportar CSV
          </button>
          {lastCount !== null && (
            <p className="text-xs text-emerald-600 mt-2">{lastCount} Alvos exportados.</p>
          )}
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>

        {/* PDF (em breve) */}
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-5">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center mb-3">
            <FileText className="text-gray-400" size={18} />
          </div>
          <h3 className="text-sm font-semibold text-gray-500">Relatório executivo (PDF)</h3>
          <p className="text-xs text-gray-400 mt-1">
            Resumo semanal com os melhores Alvos, dossiês e releases, pronto para reunião comercial. Em
            breve nesta tela.
          </p>
        </div>
      </div>
    </div>
  );
}

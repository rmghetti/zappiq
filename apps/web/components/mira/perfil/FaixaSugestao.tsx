'use client';

/**
 * Faixa do auto-preenchimento.
 *
 * Diz o que a plataforma trouxe e de onde, e dá o botão para repetir. O tom é
 * de rascunho de propósito: nada aqui está salvo até o cliente clicar em
 * Salvar perfil.
 */
import { Loader2, Sparkles, RotateCw } from 'lucide-react';
import type { SugestaoPerfil } from '@/lib/miraApi';

/** Rótulo legível de cada campo, para a faixa dizer o que preencheu. */
const NOMES: Record<string, string> = {
  segmento: 'segmento',
  subsegmentos: 'subsegmentos',
  catalogo: 'catálogo',
  doresResolvidas: 'dores que você resolve',
  resultadosEsperados: 'resultados',
  casosDeUso: 'casos de uso',
  diferenciais: 'diferenciais',
  concorrentes: 'concorrentes',
  ticketMedio: 'ticket médio',
};

function listar(campos: string[]): string {
  const nomes = campos.map((c) => NOMES[c] ?? c);
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

export function FaixaSugestao({
  sugestao,
  carregando,
  onPreencher,
}: {
  sugestao: SugestaoPerfil | null;
  carregando: boolean;
  onPreencher: () => void;
}) {
  if (carregando) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-primary-100 bg-primary-50/50 px-4 py-3 text-sm text-primary-700">
        <Loader2 className="animate-spin shrink-0" size={15} />
        Lendo o que você já cadastrou e treinou…
      </div>
    );
  }

  if (!sugestao) return null;

  const campos = Object.keys(sugestao.origem);
  const doCadastro = campos.filter((c) => sugestao.origem[c] === 'cadastro');

  // Sem material declarado: em vez de fingir que preencheu, aponta o caminho.
  if (campos.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
        <p className="text-sm text-amber-800">
          Não encontramos informações suficientes no seu cadastro para preencher sozinho. Quanto mais você responder em
          Treinar IA, mais deste formulário vem pronto.
        </p>
        <BotaoPreencher onClick={onPreencher} rotulo="Tentar de novo" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary-100 bg-primary-50/50 px-4 py-3">
      <p className="text-sm text-primary-900">
        <Sparkles size={13} className="inline-block mr-1 -mt-0.5 text-primary-500" />
        Preenchemos <strong>{listar(campos)}</strong> com o que você já declarou
        {doCadastro.length === campos.length ? ' no cadastro' : ' no cadastro e no Treinar IA'}. Revise, edite ou remova
        o que não fizer sentido. Nada está salvo até você clicar em Salvar perfil.
      </p>
      <BotaoPreencher onClick={onPreencher} rotulo="Preencher de novo" />
    </div>
  );
}

function BotaoPreencher({ onClick, rotulo }: { onClick: () => void; rotulo: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50 shrink-0"
    >
      <RotateCw size={13} />
      {rotulo}
    </button>
  );
}

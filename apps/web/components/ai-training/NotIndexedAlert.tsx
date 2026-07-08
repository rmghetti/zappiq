'use client';

/**
 * NotIndexedAlert — aviso inteligente de conteúdo que NÃO está alimentando a IA.
 *
 * Um item "não indexado" (ragChunks === 0) existe no cadastro mas não virou
 * conhecimento no motor da IA: a ingestão falhou ou não gerou texto. Sem este
 * aviso o cliente acha que treinou algo que a IA nunca vai usar.
 *
 * O alerta explica, em linguagem simples: o que aconteceu, por que aquele item
 * não está na IA e o que fazer para resolver. É fechável, mas volta a aparecer
 * se ainda houver item pendente (não escondemos um problema real).
 */
import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface NotIndexedItem {
  id: string;
  label: string;
  /** 'file' | 'url' | 'text' | 'qa' — orienta a dica de correção */
  kind: 'file' | 'url' | 'text' | 'qa';
}

const FIX_HINT: Record<NotIndexedItem['kind'], string> = {
  file: 'Reenvie o arquivo. Se ele for uma imagem digitalizada ou um PDF protegido, a IA não consegue ler o texto. Converta para um PDF com texto selecionável, TXT ou DOCX.',
  url: 'Verifique se o link abre publicamente no navegador. Páginas que exigem login, ou que carregam o conteúdo só depois por scripts, podem não ter texto para ler. Prefira colar o conteúdo como texto.',
  text: 'Reenvie o texto. Ele pode ter ficado curto demais ou só com formatação. Cole um trecho com informação de verdade.',
  qa: 'Edite e salve a resposta novamente. Confirme que ela está ativa. Se persistir, apague e recrie a pergunta.',
};

export function NotIndexedAlert({ items }: { items: NotIndexedItem[] }) {
  const [dismissed, setDismissed] = useState(false);
  if (items.length === 0 || dismissed) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            {items.length === 1
              ? '1 item ainda não está alimentando a sua IA'
              : `${items.length} itens ainda não estão alimentando a sua IA`}
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            Estes itens aparecem na sua lista, mas o conteúdo deles não chegou ao
            motor da IA. Ou seja, a IA não usa essas informações para responder.
            Veja o que aconteceu e como resolver:
          </p>

          <ul className="mt-3 space-y-2">
            {items.map((it) => (
              <li key={it.id} className="text-xs bg-white/70 border border-amber-100 rounded-lg p-2.5">
                <p className="font-medium text-amber-900 truncate">• {it.label}</p>
                <p className="text-amber-800 mt-0.5">{FIX_HINT[it.kind]}</p>
              </li>
            ))}
          </ul>

          <p className="text-[11px] text-amber-700 mt-2.5">
            Quando o conteúdo é lido com sucesso, o item passa a mostrar o selo
            verde "indexado". Só aí ele está de fato treinando a sua IA.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-amber-400 hover:text-amber-600 p-1 -m-1 flex-shrink-0"
          aria-label="Fechar aviso"
          title="Fechar (volta a aparecer enquanto houver item pendente)"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

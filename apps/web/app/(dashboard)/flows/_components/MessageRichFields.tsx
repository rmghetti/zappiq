'use client';
import React from 'react';
import { Trash2, Plus } from 'lucide-react';
import { SaibaMais } from '@/components/shared/SaibaMais';

export interface MediaData { type: 'image' | 'audio' | 'document'; url: string; caption?: string }
export interface InteractiveData { type: 'button' | 'list'; options: { id: string; title: string }[] }
export interface MessageData { text?: string; media?: MediaData; interactive?: InteractiveData }

const inputCls = 'w-full px-2 py-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-2 focus:ring-primary-400';
type Mode = 'text' | 'interactive' | 'media';

function modeOf(d: MessageData): Mode { return d.media ? 'media' : d.interactive ? 'interactive' : 'text'; }
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'opt';

export function MessageRichFields({ data, onChange }: { data: MessageData; onChange: (patch: Partial<MessageData>) => void }) {
  const mode = modeOf(data);
  const setMode = (m: Mode) => {
    if (m === 'text') onChange({ media: undefined, interactive: undefined });
    else if (m === 'media') onChange({ interactive: undefined, media: { type: 'image', url: '', caption: data.text || '' } });
    else onChange({ media: undefined, interactive: { type: 'button', options: [{ id: 'opt_1', title: '' }] } });
  };
  const it = data.interactive;
  const max = it?.type === 'list' ? 10 : 3;
  const setOpt = (i: number, title: string) =>
    onChange({ interactive: { ...it!, options: it!.options.map((o, j) => (j === i ? { id: o.id || slug(title) || `opt_${i + 1}`, title } : o)) } });
  const nextOptId = () => {
    const used = new Set(it!.options.map((o) => o.id));
    let n = it!.options.length + 1;
    while (used.has(`opt_${n}`)) n++;
    return `opt_${n}`;
  };
  const addOpt = () => it && it.options.length < max && onChange({ interactive: { ...it, options: [...it.options, { id: nextOptId(), title: '' }] } });
  const rmOpt = (i: number) => it && onChange({ interactive: { ...it, options: it.options.filter((_, j) => j !== i) } });

  return (
    <div className="space-y-2 pt-2 mt-2 border-t border-gray-100">
      <div className="flex items-center gap-1">
        {(['text', 'interactive', 'media'] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-2 py-1 rounded text-[11px] border ${mode === m ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500'}`}>
            {m === 'text' ? 'Texto' : m === 'interactive' ? 'Botões/Lista' : 'Mídia'}
          </button>
        ))}
        <SaibaMais featureKey="flows.no-mensagem.botoes-midia" />
      </div>

      {mode === 'media' && data.media && (
        <div className="space-y-2">
          <select className={inputCls} value={data.media.type} onChange={(e) => onChange({ media: { ...data.media!, type: e.target.value as MediaData['type'] } })}>
            <option value="image">Imagem</option>
            <option value="document">Documento</option>
            <option value="audio">Áudio</option>
          </select>
          <input className={inputCls} value={data.media.url} onChange={(e) => onChange({ media: { ...data.media!, url: e.target.value } })} placeholder="URL pública (https://…)" />
          {data.media.type !== 'audio' && (
            <input className={inputCls} value={data.media.caption ?? ''} onChange={(e) => onChange({ media: { ...data.media!, caption: e.target.value } })} placeholder="Legenda (suporta {{var}})" />
          )}
          {data.media.type === 'audio' && <p className="text-[10px] text-amber-600">Áudio por URL ainda não é enviado nesta versão.</p>}
        </div>
      )}

      {mode === 'interactive' && it && (
        <div className="space-y-2">
          <select className={inputCls} value={it.type} onChange={(e) => onChange({ interactive: { ...it, type: e.target.value as InteractiveData['type'], options: it.options.slice(0, e.target.value === 'list' ? 10 : 3) } })}>
            <option value="button">Botões (até 3)</option>
            <option value="list">Lista (até 10)</option>
          </select>
          <input className={inputCls} value={data.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Texto da mensagem (corpo)" />
          {it.options.map((o, i) => (
            <div key={o.id} className="flex items-center gap-1">
              <input className={inputCls} value={o.title} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Opção ${i + 1}`} />
              <button onClick={() => rmOpt(i)} className="text-gray-400 hover:text-red-500" title="Remover"><Trash2 size={13} /></button>
            </div>
          ))}
          {it.options.length < max && (
            <button onClick={addOpt} className="flex items-center gap-1 text-[11px] text-primary-600"><Plus size={13} /> Adicionar opção</button>
          )}
        </div>
      )}
    </div>
  );
}

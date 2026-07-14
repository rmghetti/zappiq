'use client';

/**
 * Mira Prospects — campos do Perfil de Prospecção.
 *
 * Extraídos da página quando ela passou de 12 para 38 campos. São os tijolos
 * dos blocos (BlocoNegocio/BlocoComum/BlocoB2B/BlocoB2C).
 *
 * O selo "sugerido" é função pura do que veio do auto-preenchimento: um valor
 * é sugerido enquanto estiver no conjunto `sugeridos`. Se o cliente apaga ou
 * troca, some sozinho — sem rastrear edição, sem estado paralelo.
 */
import { useId, useState } from 'react';
import { Plus, X, Sparkles } from 'lucide-react';
import { SaibaMais } from '@/components/shared/SaibaMais';

/** Marca discreta de valor que a plataforma trouxe do cadastro/treinamento. */
function SeloSugerido({ titulo }: { titulo?: string }) {
  return (
    <Sparkles
      size={11}
      className="text-primary-500 shrink-0"
      aria-label="sugerido"
      // O title vira tooltip nativo: explica sem ocupar espaço.
      {...{ title: titulo ?? 'Sugerido a partir do que você já cadastrou' }}
    />
  );
}

export function Card({
  title,
  featureKey,
  children,
}: {
  title: string;
  featureKey?: string;
  children: React.ReactNode;
}) {
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

/** Rótulo + ajuda + marca de obrigatório, associado ao input por htmlFor. */
function Rotulo({
  htmlFor,
  label,
  obrigatorio,
  sugerido,
}: {
  htmlFor: string;
  label: string;
  obrigatorio?: boolean;
  sugerido?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-500 mb-1">
      <span className="inline-flex items-center gap-1">
        {label}
        {obrigatorio && (
          <span className="text-red-400" aria-label="obrigatório">
            *
          </span>
        )}
        {sugerido && <SeloSugerido />}
      </span>
    </label>
  );
}

function Ajuda({ texto }: { texto?: string }) {
  if (!texto) return null;
  return <p className="text-xs text-gray-400 mt-1.5">{texto}</p>;
}

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200';

/** Texto curto. Serve tanto para campo livre quanto para faixa ("R$ 5k–15k"). */
export function TextoField({
  label,
  placeholder,
  ajuda,
  obrigatorio,
  sugerido,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  sugerido?: boolean;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const id = useId();
  return (
    <div>
      <Rotulo htmlFor={id} label={label} obrigatorio={obrigatorio} sugerido={sugerido} />
      <input
        id={id}
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
        className={inputCls}
      />
      <Ajuda texto={ajuda} />
    </div>
  );
}

export function TextareaField({
  label,
  placeholder,
  ajuda,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  placeholder?: string;
  ajuda?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const id = useId();
  return (
    <div>
      <Rotulo htmlFor={id} label={label} />
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={inputCls}
      />
      <Ajuda texto={ajuda} />
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  ajuda,
  value,
  options,
  placeholder = 'Selecione…',
  onChange,
}: {
  label: string;
  ajuda?: string;
  value: T | null;
  options: { value: T; label: string }[];
  placeholder?: string;
  onChange: (v: T | null) => void;
}) {
  const id = useId();
  return (
    <div>
      <Rotulo htmlFor={id} label={label} />
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || null) as T | null)}
        className={inputCls}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Ajuda texto={ajuda} />
    </div>
  );
}

/**
 * Lista de valores com botão "+". Aceita Enter também.
 * `sugeridos` marca quais chips vieram do auto-preenchimento.
 */
export function TagInput({
  label,
  placeholder,
  ajuda,
  obrigatorio,
  values,
  sugeridos,
  onChange,
}: {
  label: string;
  placeholder?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  values: string[];
  sugeridos?: Set<string>;
  onChange: (v: string[]) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return setDraft('');
    onChange([...values, v]);
    setDraft('');
  };

  return (
    <div>
      <Rotulo htmlFor={id} label={label} obrigatorio={obrigatorio} />
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className={`flex-1 ${inputCls}`}
        />
        <button
          type="button"
          onClick={add}
          className="px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 shrink-0"
          aria-label={`Adicionar em ${label}`}
        >
          <Plus size={16} />
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map((v) => {
            const eSugerido = sugeridos?.has(v) ?? false;
            return (
              <span
                key={v}
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                  eSugerido ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-100' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {eSugerido && <SeloSugerido />}
                {v}
                <button
                  type="button"
                  onClick={() => onChange(values.filter((x) => x !== v))}
                  className={eSugerido ? 'text-primary-400 hover:text-primary-600' : 'text-gray-400 hover:text-gray-600'}
                  aria-label={`Remover ${v}`}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <Ajuda texto={ajuda} />
    </div>
  );
}

export interface CatalogoItem {
  nome: string;
  descricao?: string;
}

/** Par produto + descrição, repetível. Editável item a item. */
export function CatalogEditor({
  items,
  sugeridos,
  ajuda,
  onChange,
}: {
  items: CatalogoItem[];
  sugeridos?: Set<string>;
  ajuda?: string;
  onChange: (items: CatalogoItem[]) => void;
}) {
  const idNome = useId();
  const idDesc = useId();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');

  const add = () => {
    const n = nome.trim();
    if (!n) return;
    onChange([...items, { nome: n, descricao: descricao.trim() }]);
    setNome('');
    setDescricao('');
  };

  const editar = (i: number, campo: keyof CatalogoItem, valor: string) => {
    onChange(items.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)));
  };

  return (
    <div>
      <div className="grid sm:grid-cols-[1fr_1.4fr_auto] gap-2">
        <div>
          <label htmlFor={idNome} className="sr-only">
            Produto ou serviço
          </label>
          <input
            id={idNome}
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Produto ou serviço"
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor={idDesc} className="sr-only">
            O que resolve
          </label>
          <input
            id={idDesc}
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
            placeholder="O que resolve (curto)"
            className={inputCls}
          />
        </div>
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 shrink-0"
          aria-label="Adicionar item ao catálogo"
        >
          <Plus size={16} />
        </button>
      </div>

      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {items.map((it, i) => {
            const eSugerido = sugeridos?.has(it.nome) ?? false;
            return (
              <li
                key={`${it.nome}-${i}`}
                className={`grid sm:grid-cols-[1fr_1.4fr_auto] gap-2 items-center rounded-lg px-2 py-1.5 border ${
                  eSugerido ? 'bg-primary-50/40 border-primary-100' : 'bg-gray-50 border-gray-100'
                }`}
              >
                <span className="inline-flex items-center gap-1 min-w-0">
                  {eSugerido && <SeloSugerido />}
                  <input
                    type="text"
                    value={it.nome}
                    onChange={(e) => editar(i, 'nome', e.target.value)}
                    aria-label={`Nome do item ${i + 1}`}
                    className="w-full bg-transparent text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary-200 rounded px-1"
                  />
                </span>
                <input
                  type="text"
                  value={it.descricao ?? ''}
                  onChange={(e) => editar(i, 'descricao', e.target.value)}
                  placeholder="O que resolve (curto)"
                  aria-label={`Descrição do item ${i + 1}`}
                  className="w-full bg-transparent text-sm text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-200 rounded px-1"
                />
                <button
                  type="button"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  className="text-gray-400 hover:text-gray-600 justify-self-end pr-1"
                  aria-label={`Remover ${it.nome}`}
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Ajuda texto={ajuda} />
    </div>
  );
}

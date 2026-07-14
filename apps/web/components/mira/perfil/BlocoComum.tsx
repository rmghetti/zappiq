'use client';

/**
 * Bloco comum — vale para B2B e B2C.
 *
 * Tudo aqui fala do negócio do cliente (o que ele vende, o que resolve, com
 * o que se diferencia), não do alvo. Por isso é o bloco que o
 * auto-preenchimento cobre inteiro.
 */
import { Card, CatalogEditor, TagInput, TextoField } from './campos';
import type { MiraPerfil } from '@/lib/miraApi';

export interface SugeridosComum {
  catalogo: Set<string>;
  doresResolvidas: Set<string>;
  resultadosEsperados: Set<string>;
  casosDeUso: Set<string>;
  diferenciais: Set<string>;
  concorrentes: Set<string>;
  ticketMedio: boolean;
}

export function BlocoComum({
  perfil,
  sugeridos,
  onChange,
}: {
  perfil: MiraPerfil;
  sugeridos: SugeridosComum;
  onChange: (patch: Partial<MiraPerfil>) => void;
}) {
  return (
    <>
      <Card title="Produtos e serviços (catálogo)" featureKey="mira.perfil.catalogo">
        <CatalogEditor
          items={perfil.catalogo}
          sugeridos={sugeridos.catalogo}
          ajuda="É contra este catálogo que a Mira cruza as demandas de cada conta."
          onChange={(catalogo) => onChange({ catalogo })}
        />
      </Card>

      <Card title="O que você resolve" featureKey="mira.perfil.dores">
        <div className="space-y-3">
          <TagInput
            label="Principais dores/problemas que você resolve"
            placeholder="Ex.: Downtime, custo alto de infra…"
            obrigatorio
            values={perfil.doresResolvidas}
            sugeridos={sugeridos.doresResolvidas}
            onChange={(doresResolvidas) => onChange({ doresResolvidas })}
          />
          <TagInput
            label="Resultados/benefícios esperados"
            placeholder="Ex.: Reduz custo de infra em 30%"
            ajuda="Prefira resultados quantificáveis."
            values={perfil.resultadosEsperados}
            sugeridos={sugeridos.resultadosEsperados}
            onChange={(resultadosEsperados) => onChange({ resultadosEsperados })}
          />
          <TagInput
            label="Casos de uso / gatilhos de dor"
            placeholder="Ex.: Migração para nuvem, auditoria…"
            values={perfil.casosDeUso}
            sugeridos={sugeridos.casosDeUso}
            onChange={(casosDeUso) => onChange({ casosDeUso })}
          />
        </div>
      </Card>

      <Card title="Diferenciais e concorrência" featureKey="mira.perfil.diferenciais">
        <div className="space-y-3">
          <TagInput
            label="Seus diferenciais"
            placeholder="Ex.: SLA 99,9%, suporte 24/7…"
            values={perfil.diferenciais}
            sugeridos={sugeridos.diferenciais}
            onChange={(diferenciais) => onChange({ diferenciais })}
          />
          <TagInput
            label="Principais concorrentes"
            placeholder="Ex.: Empresa X, Empresa Y…"
            values={perfil.concorrentes}
            sugeridos={sugeridos.concorrentes}
            onChange={(concorrentes) => onChange({ concorrentes })}
          />
          <TextoField
            label="Ticket médio / faixa de investimento"
            placeholder="Ex.: R$ 5k–15k/mês"
            ajuda="Ajuda a filtrar por capacidade de pagamento."
            sugerido={sugeridos.ticketMedio}
            value={perfil.ticketMedio}
            onChange={(ticketMedio) => onChange({ ticketMedio })}
          />
        </div>
      </Card>
    </>
  );
}

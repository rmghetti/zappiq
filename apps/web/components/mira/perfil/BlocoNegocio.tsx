'use client';

/**
 * Bloco "Seu negócio" — segmento e subsegmentos.
 *
 * É o bloco que motivou o auto-preenchimento: o cliente já escolheu isso no
 * cadastro inicial, então pedir de novo aqui era pura repetição. Chega pronto
 * e continua editável.
 */
import { Card, TagInput, TextoField } from './campos';
import type { MiraPerfil } from '@/lib/miraApi';

export function BlocoNegocio({
  perfil,
  sugeridos,
  onChange,
}: {
  perfil: MiraPerfil;
  sugeridos: { segmento: boolean; subsegmentos: Set<string> };
  onChange: (patch: Partial<MiraPerfil>) => void;
}) {
  return (
    <Card title="Seu negócio" featureKey="mira.perfil.segmento">
      <div className="space-y-3">
        <TextoField
          label="Segmento principal"
          placeholder="Ex.: Infraestrutura e segurança de TI"
          sugerido={sugeridos.segmento}
          value={perfil.segmento}
          onChange={(segmento) => onChange({ segmento })}
        />
        <TagInput
          label="Subsegmentos (opcional)"
          placeholder="Ex.: Cloud, NOC, SOC…"
          values={perfil.subsegmentos}
          sugeridos={sugeridos.subsegmentos}
          onChange={(subsegmentos) => onChange({ subsegmentos })}
        />
      </div>
    </Card>
  );
}

'use client';

/**
 * Bloco B2C — só aparece quando tipoCliente === 'B2C'.
 *
 * Descreve a PESSOA que o cliente quer alcançar. Quase nada aqui tem paralelo
 * no B2B: CNAE e comitê de compra não existem, e no lugar entram demografia,
 * hábitos e, principalmente, momento de vida — no B2C o timing costuma valer
 * mais que a demografia.
 *
 * Como no B2B, nada é auto-preenchido: público atual não é público-alvo.
 */
import { Card, SelectField, TagInput, TextoField } from './campos';
import type { AlvoB2C, Genero } from '@/lib/miraApi';

const GENEROS: { value: Genero; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'MASCULINO', label: 'Masculino' },
  { value: 'FEMININO', label: 'Feminino' },
];

export function BlocoB2C({ alvo, onChange }: { alvo: AlvoB2C; onChange: (patch: Partial<AlvoB2C>) => void }) {
  return (
    <>
      <Card title="Quem é o seu consumidor" featureKey="mira.perfil.icp">
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <TextoField
              label="Faixa etária"
              placeholder="Ex.: 25–45 anos"
              obrigatorio
              value={alvo.faixaEtaria}
              onChange={(faixaEtaria) => onChange({ faixaEtaria })}
            />
            <SelectField
              label="Gênero (se relevante)"
              ajuda="Só se o produto depender disso."
              value={alvo.genero}
              options={GENEROS}
              onChange={(genero) => onChange({ genero })}
            />
          </div>
          <TextoField
            label="Faixa de renda / classe social"
            placeholder="Ex.: Classe B/C, R$ 4k–10k"
            value={alvo.faixaRenda}
            onChange={(faixaRenda) => onChange({ faixaRenda })}
          />
          <TagInput
            label="Ocupação / profissão"
            placeholder="Ex.: Autônomos, CLT, empreendedores…"
            values={alvo.ocupacao}
            onChange={(ocupacao) => onChange({ ocupacao })}
          />
          <TagInput
            label="Estado civil / composição familiar"
            placeholder="Ex.: Casado com filhos, solteiro…"
            values={alvo.composicaoFamiliar}
            onChange={(composicaoFamiliar) => onChange({ composicaoFamiliar })}
          />
        </div>
      </Card>

      <Card title="Onde ele está" featureKey="mira.perfil.regiaoB2c">
        <div className="space-y-3">
          <TagInput
            label="Região / cidade"
            placeholder="Ex.: SP capital, Grande ABC…"
            obrigatorio
            values={alvo.regiaoCidade}
            onChange={(regiaoCidade) => onChange({ regiaoCidade })}
          />
          <TagInput
            label="Tipo de região / raio de atendimento"
            placeholder="Ex.: Capital, interior, litoral, raio 20km…"
            ajuda="Importante para negócios locais."
            values={alvo.tipoRegiao}
            onChange={(tipoRegiao) => onChange({ tipoRegiao })}
          />
          <TagInput
            label="Canais onde o público está"
            placeholder="Ex.: Instagram, WhatsApp, marketplaces…"
            values={alvo.canais}
            onChange={(canais) => onChange({ canais })}
          />
        </div>
      </Card>

      <Card title="O que move a compra" featureKey="mira.perfil.gatilhosB2c">
        <div className="space-y-3">
          <TagInput
            label="Principais dores / desejos do consumidor"
            placeholder="Ex.: Economizar tempo, status, segurança…"
            obrigatorio
            values={alvo.doresDesejos}
            onChange={(doresDesejos) => onChange({ doresDesejos })}
          />
          <TagInput
            label="Gatilhos / momento de vida"
            placeholder="Ex.: Mudou de casa, teve filho, casamento…"
            ajuda="No B2C o timing costuma valer mais que a demografia."
            values={alvo.momentoDeVida}
            onChange={(momentoDeVida) => onChange({ momentoDeVida })}
          />
          <TagInput
            label="Interesses / estilo de vida"
            placeholder="Ex.: Fitness, viagens, tecnologia…"
            values={alvo.interesses}
            onChange={(interesses) => onChange({ interesses })}
          />
          <TagInput
            label="Hábitos de consumo"
            placeholder="Ex.: Compra online, parcela, busca promoção…"
            values={alvo.habitosConsumo}
            onChange={(habitosConsumo) => onChange({ habitosConsumo })}
          />
        </div>
      </Card>

      <Card title="Bolso e critérios de corte" featureKey="mira.perfil.corte">
        <div className="space-y-3">
          <TextoField
            label="Capacidade / disposição de pagamento"
            placeholder="Ex.: até R$ 500, R$ 500–2k…"
            value={alvo.capacidadePagamento}
            onChange={(capacidadePagamento) => onChange({ capacidadePagamento })}
          />
          <TagInput
            label="Influenciadores na decisão"
            placeholder="Ex.: Cônjuge, familiares…"
            ajuda="Relevante em ticket alto."
            values={alvo.influenciadoresB2C}
            onChange={(influenciadoresB2C) => onChange({ influenciadoresB2C })}
          />
          <TagInput
            label="Red flags"
            placeholder="Ex.: fora da região, fora da faixa de renda…"
            values={alvo.redFlagsB2C}
            onChange={(redFlagsB2C) => onChange({ redFlagsB2C })}
          />
        </div>
      </Card>
    </>
  );
}

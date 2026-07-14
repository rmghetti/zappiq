'use client';

/**
 * Bloco B2B — só aparece quando tipoCliente === 'B2B'.
 *
 * Descreve a EMPRESA que o cliente quer prospectar: firmografia (quem é),
 * technographics e sinais de intenção (está na hora?), comitê de compra (quem
 * decide) e critérios de corte (quando desistir).
 *
 * Nada aqui é auto-preenchido de propósito: o cadastro descreve quem o cliente
 * atende hoje, e isso não é o mesmo que quem ele quer prospectar.
 */
import { Card, SelectField, TagInput, TextareaField, TextoField } from './campos';
import type { AlvoB2B, CicloVenda } from '@/lib/miraApi';

const CICLOS: { value: CicloVenda; label: string }[] = [
  { value: 'CURTO', label: 'Curto' },
  { value: 'MEDIO', label: 'Médio' },
  { value: 'LONGO', label: 'Longo' },
];

export function BlocoB2B({ alvo, onChange }: { alvo: AlvoB2B; onChange: (patch: Partial<AlvoB2B>) => void }) {
  return (
    <>
      <Card title="Perfil da empresa ideal (ICP)" featureKey="mira.perfil.icp">
        <div className="space-y-3">
          <TagInput
            label="CNAEs ou atividades-alvo"
            placeholder="Ex.: 4651-6 ou 'distribuidoras de TI'"
            obrigatorio
            values={alvo.cnaesAlvo}
            onChange={(cnaesAlvo) => onChange({ cnaesAlvo })}
          />
          <TagInput
            label="Portes"
            placeholder="Ex.: ME, EPP, Médio…"
            values={alvo.portes}
            onChange={(portes) => onChange({ portes })}
          />
          <TagInput
            label="Regiões"
            placeholder="Ex.: SP capital, Sul, Brasil…"
            values={alvo.regioes}
            onChange={(regioes) => onChange({ regioes })}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <TextoField
              label="Faixa de faturamento anual"
              placeholder="Ex.: R$ 10M–50M"
              value={alvo.faturamentoAnual}
              onChange={(faturamentoAnual) => onChange({ faturamentoAnual })}
            />
            <TextoField
              label="Número de funcionários"
              placeholder="Ex.: 50–200"
              value={alvo.numFuncionarios}
              onChange={(numFuncionarios) => onChange({ numFuncionarios })}
            />
          </div>
        </div>
      </Card>

      <Card title="Maturidade e timing" featureKey="mira.perfil.sinais">
        <div className="space-y-3">
          <TagInput
            label="Maturidade digital / tecnologias usadas"
            placeholder="Ex.: usa CRM, ERP, e-commerce…"
            ajuda="Sinal forte de fit em B2B."
            values={alvo.technographics}
            onChange={(technographics) => onChange({ technographics })}
          />
          <TagInput
            label="Sinais de intenção / gatilhos"
            placeholder="Ex.: contratando na área, expandindo filiais…"
            ajuda="Prioriza contas com timing de compra."
            values={alvo.sinaisIntencao}
            onChange={(sinaisIntencao) => onChange({ sinaisIntencao })}
          />
          <SelectField
            label="Ciclo de venda típico"
            value={alvo.cicloVenda}
            options={CICLOS}
            onChange={(cicloVenda) => onChange({ cicloVenda })}
          />
        </div>
      </Card>

      <Card title="Quem decide a compra" featureKey="mira.perfil.areas">
        <div className="space-y-3">
          <TagInput
            label="Decisor (quem assina)"
            placeholder="Ex.: CEO, Diretor de TI, CISO…"
            obrigatorio
            values={alvo.decisor}
            onChange={(decisor) => onChange({ decisor })}
          />
          <TagInput
            label="Influenciadores"
            placeholder="Ex.: Gerente de TI, Compras…"
            values={alvo.influenciadores}
            onChange={(influenciadores) => onChange({ influenciadores })}
          />
          <TagInput
            label="Usuário final"
            placeholder="Ex.: Analistas, equipe de operações…"
            values={alvo.usuarioFinal}
            onChange={(usuarioFinal) => onChange({ usuarioFinal })}
          />
          <TextareaField
            label="Objeções comuns e como contornar"
            placeholder={'Ex.: "Já temos fornecedor" → mostrar SLA…'}
            value={alvo.objecoes}
            onChange={(objecoes) => onChange({ objecoes })}
          />
        </div>
      </Card>

      <Card title="Critérios de corte" featureKey="mira.perfil.corte">
        <div className="space-y-3">
          <TagInput
            label="Critérios de desqualificação / red flags"
            placeholder="Ex.: setor regulado, concorrente, sem cobertura…"
            ajuda="O que faz descartar uma conta."
            values={alvo.redFlagsB2B}
            onChange={(redFlagsB2B) => onChange({ redFlagsB2B })}
          />
          <TagInput
            label="Must-haves obrigatórios"
            placeholder="Ex.: possui equipe de TI própria…"
            ajuda="Condições sem as quais não vale prospectar."
            values={alvo.mustHavesB2B}
            onChange={(mustHavesB2B) => onChange({ mustHavesB2B })}
          />
          <TagInput
            label="Clientes-referência atuais"
            placeholder="Ex.: Empresa A, Empresa B…"
            ajuda="Usado para lookalike / similaridade."
            values={alvo.clientesReferencia}
            onChange={(clientesReferencia) => onChange({ clientesReferencia })}
          />
        </div>
      </Card>
    </>
  );
}

/**
 * "O que preencher aqui" — a orientação campo a campo.
 *
 * Primo do Saiba mais, mas resolve outro problema. O Saiba mais explica um
 * RECURSO ("o que é o Mira"); este explica um CAMPO ("o que escrever nesta
 * caixa e o que não escrever"). Por isso a forma é outra: o valor está no
 * `naoDeve`, que diz o que sai fora E para onde a informação deve ir.
 *
 * Nasceu de um caso real: o Rodrigo pôs "empresas PME" no campo de atividade.
 * Porte não é ramo, então nunca viraria CNAE e a campanha ia buscar errado.
 * O campo não estava mal preenchido; o campo é que não ensinava. Enquanto o
 * cliente puder escrever qualquer coisa numa caixa que espera CNAE, a culpa
 * do resultado ruim é nossa.
 *
 * Como o Saiba mais: dado serializável (nada de JSX), porque isto também vira
 * corpus da Iza Ajuda. Voz pt-BR, padrão /voz-humana, sem travessão.
 */

/** Uma coisa que NÃO vai neste campo, e o lugar certo dela. */
export interface NaoDeveItem {
  /** O que o cliente costuma escrever errado aqui, com o exemplo real. */
  item: string;
  /** Por que estragar o resultado, em uma frase de leigo. */
  porque: string;
  /** Onde essa informação deve ir. Null = não existe lugar, e dizemos isso. */
  ondeVai: string | null;
}

export interface PreencherCampoContent {
  /** Identificador estável: area.tela.campo[.trilha], ex: "mira.campanha.alvos.b2b" */
  campoKey: string;
  /** Nome do campo como aparece na tela. */
  titulo: string;
  /** Uma frase: o que este campo é, sem jargão. */
  resumo: string;
  /** O que DEVE ser escrito, em itens curtos e concretos. */
  deve: string[];
  /** O que NÃO deve, com o motivo e o destino certo. É o coração do popup. */
  naoDeve: NaoDeveItem[];
  /** Exemplos prontos para copiar, do melhor para o pior. */
  exemplos: { valor: string; bom: boolean; nota: string }[];
  /** Como o campo vira resultado: o mecanismo, em linguagem de dono de PME. */
  comoVira: string;
  /** SVG/HTML inline (autorado por nós) ilustrando certo x errado. */
  ilustracao?: string;
  /** featureKey do Saiba mais do recurso, para aprofundar. */
  saibaMais?: string;
}

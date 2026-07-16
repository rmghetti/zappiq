/**
 * Mira Prospects — contrato do Perfil de Prospecção (Motor 0).
 *
 * Separado das rotas de propósito: aqui é lógica pura (zod + a conta da
 * prontidão), sem prisma, sem express e sem os 10 serviços que mira.ts puxa.
 * Assim a conta que decide se os motores largam pode ser testada sem mockar
 * meio mundo. Mesmo padrão do settings.schema.ts.
 */
import { z } from 'zod';

/** Lista de tags: sem vazio, no mesmo espírito do TagInput da tela. */
const tags = (max: number, len = 160) => z.array(z.string().trim().min(1).max(len)).max(max).default([]);

/** Faixa em texto livre ("R$ 5k–15k/mês", "50–200"), não número. */
const faixa = (len = 120) => z.string().trim().max(len).optional().nullable().default(null);

/**
 * Alvo B2B: firmografia, technographics, sinais de intenção e comitê de
 * compra. Só vale quando tipoCliente === 'B2B'.
 */
const alvoB2BSchema = z.object({
  cnaesAlvo: tags(30, 120),
  portes: tags(10, 30),
  regioes: tags(30, 80),
  faturamentoAnual: faixa(),
  numFuncionarios: faixa(),
  technographics: tags(30),
  sinaisIntencao: tags(20, 200),
  decisor: tags(12, 80),
  influenciadores: tags(12, 80),
  usuarioFinal: tags(12, 80),
  objecoes: z.string().trim().max(2000).optional().default(''),
  cicloVenda: z.enum(['CURTO', 'MEDIO', 'LONGO']).optional().nullable().default(null),
  redFlagsB2B: tags(20, 200),
  mustHavesB2B: tags(20, 200),
  clientesReferencia: tags(20, 160),
});

/**
 * Alvo B2C: que negócio local prospectar, mais a demografia e o momento de
 * vida de quem consome. Só vale quando tipoCliente === 'B2C'. No B2C o timing
 * costuma valer mais que a demografia — daí momentoDeVida ser de primeira
 * classe.
 *
 * Sobre tiposNegocioAlvo: a descoberta B2C procura NEGÓCIO LOCAL no Google
 * (o Places devolve estabelecimento: nome, endereço, telefone, avaliações),
 * nunca pessoa física — não existe fonte para isso, e não deveria existir. O
 * resto do bloco descreve quem CONSOME no fim, e é o que calibra a
 * qualificação e o roteiro de abordagem. Sem este campo, o Perfil B2C
 * descrevia uma pessoa e o motor procurava uma empresa: ninguém dizia qual.
 */
const alvoB2CSchema = z.object({
  /** O que procurar no Google (par do cnaesAlvo do B2B). */
  tiposNegocioAlvo: tags(20, 120),
  faixaEtaria: faixa(80),
  genero: z.enum(['TODOS', 'MASCULINO', 'FEMININO']).optional().nullable().default(null),
  faixaRenda: faixa(),
  ocupacao: tags(20),
  composicaoFamiliar: tags(12, 120),
  regiaoCidade: tags(30, 80),
  tipoRegiao: tags(12, 80),
  interesses: tags(30),
  canais: tags(20, 80),
  habitosConsumo: tags(20, 160),
  momentoDeVida: tags(20, 200),
  doresDesejos: tags(20, 200),
  capacidadePagamento: faixa(),
  redFlagsB2C: tags(20, 200),
  influenciadoresB2C: tags(12, 80),
});

/**
 * O perfil inteiro. "tipoCliente" discrimina qual alvo vale, mas guardamos
 * os dois lados: assim o cliente alterna entre B2B e B2C sem perder o que
 * já digitou. Quem consome deve passar por alvoAtivo() e nunca ler o bloco
 * do caminho inativo.
 */
export const perfilSchema = z.object({
  tipoCliente: z.enum(['B2B', 'B2C']).default('B2B'),

  // Seu negócio — chega pronto do cadastro (POST /perfil/sugestao), editável.
  segmento: z.string().trim().max(160).optional().nullable().default(null),
  subsegmentos: tags(20),

  // Comum aos dois caminhos.
  catalogo: z
    .array(
      z.object({
        nome: z.string().trim().min(1).max(160),
        descricao: z.string().trim().max(600).optional().default(''),
      })
    )
    .max(50)
    .default([]),
  doresResolvidas: tags(20, 200),
  resultadosEsperados: tags(20, 200),
  casosDeUso: tags(20, 200),
  diferenciais: tags(20, 300),
  concorrentes: tags(20),
  ticketMedio: faixa(),

  // Alvo — condicional.
  alvoB2B: alvoB2BSchema.default({}),
  alvoB2C: alvoB2CSchema.default({}),
});

export type PerfilInput = z.infer<typeof perfilSchema>;
export type AlvoB2B = z.infer<typeof alvoB2BSchema>;
export type AlvoB2C = z.infer<typeof alvoB2CSchema>;

/**
 * O alvo que vale, como união discriminada: quem consome faz switch no
 * tipoCliente e o TypeScript impede de ler campo de B2C num perfil B2B.
 */
export type AlvoAtivo = { tipoCliente: 'B2B'; alvo: AlvoB2B } | { tipoCliente: 'B2C'; alvo: AlvoB2C };

/**
 * Motor da descoberta: o kind explícito do request vence; sem ele, segue o
 * tipoCliente do Perfil (B2C busca negócio local no Places, B2B busca CNPJ
 * na descoberta pública). É o consumo de roteamento do discriminador.
 */
export function modoDaDescoberta(
  kind: 'B2B' | 'B2C' | undefined,
  perfil: { tipoCliente?: string | null } | null | undefined
): 'B2B' | 'B2C' {
  return kind ?? (perfil?.tipoCliente === 'B2C' ? 'B2C' : 'B2B');
}

export function alvoAtivo(p: PerfilInput): AlvoAtivo {
  return p.tipoCliente === 'B2B'
    ? { tipoCliente: 'B2B', alvo: p.alvoB2B }
    : { tipoCliente: 'B2C', alvo: p.alvoB2C };
}

/**
 * Prontidão do perfil (0-100).
 *
 * A conta é amarrada a uma restrição dura: abaixo de 60 os motores devolvem
 * 412 e o cliente não roda nada (motorA.ts, motorB.ts, descobertaPublica.ts).
 * Então a prontidão NÃO é uma soma de pesos — soma de peso deixa o cliente
 * passar do gate por acidente aritmético, sem ter declarado o essencial, e
 * deixa o contrário acontecer também.
 *
 * A regra é estrutural, em dois degraus:
 *
 *  1. Falta obrigatório: mostra progresso proporcional, com teto em 55. Nunca
 *     alcança o gate, por construção. Se a tela marca o campo com asterisco,
 *     ele é mesmo obrigatório.
 *  2. Obrigatórios completos: parte de 65 (já passa) e sobe até 100 conforme
 *     o cliente enriquece o caminho escolhido.
 *
 * O efeito é que o gate e os asteriscos do formulário não têm como divergir:
 * quem preencheu o que a tela pediu roda, quem não preencheu não roda, e o
 * número explica qual dos dois é o caso.
 */
export function computePerfilProntidao(p: PerfilInput): number {
  const ativo = alvoAtivo(p);

  // Os campos marcados com asterisco na tela, e só eles.
  const obrigatorios: boolean[] = [
    p.catalogo.length >= 1,
    p.doresResolvidas.length >= 1,
    ...(ativo.tipoCliente === 'B2B'
      ? [ativo.alvo.cnaesAlvo.length >= 1, ativo.alvo.decisor.length >= 1]
      : [
          // Par do cnaesAlvo: sem isto a descoberta B2C não sabe o que procurar.
          ativo.alvo.tiposNegocioAlvo.length >= 1,
          Boolean(ativo.alvo.faixaEtaria),
          ativo.alvo.regiaoCidade.length >= 1,
          ativo.alvo.doresDesejos.length >= 1,
        ]),
  ];

  const feitos = obrigatorios.filter(Boolean).length;
  if (feitos < obrigatorios.length) {
    // Teto 55: incompleto não passa do gate, aconteça o que acontecer.
    return Math.round((feitos / obrigatorios.length) * 55);
  }

  // Daqui pra baixo o cliente já pode rodar. O resto é tempero.
  const opcionais: boolean[] = [
    Boolean(p.segmento && p.segmento.trim().length > 2),
    p.subsegmentos.length > 0,
    p.catalogo.length >= 3,
    p.resultadosEsperados.length > 0,
    p.casosDeUso.length > 0,
    p.diferenciais.length > 0,
    p.concorrentes.length > 0,
    Boolean(p.ticketMedio),
    ...(ativo.tipoCliente === 'B2B'
      ? [
          ativo.alvo.portes.length > 0,
          ativo.alvo.regioes.length > 0,
          Boolean(ativo.alvo.faturamentoAnual),
          Boolean(ativo.alvo.numFuncionarios),
          ativo.alvo.technographics.length > 0,
          ativo.alvo.sinaisIntencao.length > 0,
          ativo.alvo.influenciadores.length > 0,
          ativo.alvo.usuarioFinal.length > 0,
          Boolean(ativo.alvo.objecoes),
          Boolean(ativo.alvo.cicloVenda),
          ativo.alvo.redFlagsB2B.length > 0,
          ativo.alvo.mustHavesB2B.length > 0,
          ativo.alvo.clientesReferencia.length > 0,
        ]
      : [
          Boolean(ativo.alvo.genero),
          Boolean(ativo.alvo.faixaRenda),
          ativo.alvo.ocupacao.length > 0,
          ativo.alvo.composicaoFamiliar.length > 0,
          ativo.alvo.tipoRegiao.length > 0,
          ativo.alvo.interesses.length > 0,
          ativo.alvo.canais.length > 0,
          ativo.alvo.habitosConsumo.length > 0,
          ativo.alvo.momentoDeVida.length > 0,
          Boolean(ativo.alvo.capacidadePagamento),
          ativo.alvo.redFlagsB2C.length > 0,
          ativo.alvo.influenciadoresB2C.length > 0,
        ]),
  ];

  return 65 + Math.round((opcionais.filter(Boolean).length / opcionais.length) * 35);
}

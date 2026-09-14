/**
 * izaPrecoRemediation.test.ts
 * ============================================================================
 * A transformação reescreve o prompt de um agente que está em PRODUÇÃO e é o
 * único com tráfego real de lead. O que não pode acontecer, em ordem de
 * gravidade:
 *   1. sobrar preço congelado no prompt (o bug do A229: Scale a R$ 997);
 *   2. sumir a regra de COMO falar de preço (dano novo: a Iza fica sem freio);
 *   3. sumir a identidade ou metade do prompt (dano catastrófico);
 *   4. rodar duas vezes e estragar (o script é reexecutável).
 *
 * A fixture reproduz a estrutura do prompt real da Iza: cabeçalho com o nome,
 * seções `# REGRA N — TÍTULO` (o formato usado em
 * scripts/v4_gate1_5_iza_v5_validation.ts, que é o prompt semeado da Iza) e o
 * bloco `# REGRAS INVIOLÁVEIS` no fim. Os valores da tabela são os que o
 * laudo A229 leu no `agents.system_prompt` de produção.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  removerTabelaDePrecos,
  validarPromptResultante,
  avisosDeNumeroSolto,
  MOTIVO_IDENTIDADE,
  MOTIVO_TAMANHO,
  MOTIVO_NUMERO_PERTO_DE_PLANO,
} from './izaPrecoRemediation.js';

const PROMPT_COM_TABELA = `# Iza — ZappIQ (system prompt v7.6)

Você é a **Iza**, consultora virtual da **ZappIQ** (plataforma brasileira de IA no WhatsApp Business). Atende leads pelo WhatsApp.

# REGRA 1 — MEMÓRIA ESTRITA

Você TEM o histórico desta conversa. Antes de responder qualquer mensagem nova, releia o histórico. Sempre.

# REGRA 2 — VERTICAIS BLOQUEADAS (DESQUALIFIQUE NA HORA)

A ZappIQ **NÃO atende** apostas, cripto não-regulada, pornografia e MLM.

# REGRA 6 — PLANOS E PREÇO

Quando o lead perguntar preço, faça UMA pergunta de volume antes de recomendar. Nunca despeje a tabela inteira.

**Planos** (mensal): Starter R$ 197 (1.500 msgs), Growth R$ 497 (8.000 msgs), Scale R$ 997 (25.000 msgs), Business R$ 1.997 (80.000 msgs).

Exemplo de fala: "pelo seu volume, o Scale a R$ 997 cobre com folga".

Anual tem 20% de desconto. Desconto acima de 10% precisa de aprovação do time.

# REGRA 7 — OVERAGE

Passou da cota do plano, o excedente é cobrado R$ 0,10 por mensagem. Explique isso ANTES do lead assinar, nunca depois.

Se o lead reclamar do overage, ofereça subir de plano em vez de dar desconto: o pacote de 10.000 mensagens sai por R$ 197 e quase sempre é pior negócio que o upgrade.

# REGRA 8 — HANDOFF HUMANO

Quando o cliente pede humano, aceite IMEDIATAMENTE.

# REGRAS INVIOLÁVEIS

1. NUNCA invente preço, SLA, prazo.
2. NUNCA aceite leads de verticais bloqueadas.
3. NUNCA insista após pedido de handoff.`;

describe('removerTabelaDePrecos', () => {
  it('tira a lista **Planos** (mensal) com os preços congelados', () => {
    const r = removerTabelaDePrecos(PROMPT_COM_TABELA);

    expect(r.mudou).toBe(true);
    expect(r.prompt).not.toContain('Starter R$ 197');
    expect(r.prompt).not.toContain('Business R$ 1.997');
    expect(r.linhasDePlanoRemovidas.length).toBeGreaterThan(0);
  });

  it('não sobra NENHUM valor em reais no prompt (a prova do LIKE %997%)', () => {
    const r = removerTabelaDePrecos(PROMPT_COM_TABELA);

    expect(r.prompt).not.toMatch(/R\$\s*[0-9]/);
    expect(r.prompt).not.toContain('997');
    expect(r.prompt).not.toContain('1.997');
  });

  it('tira os valores em reais da REGRA 7 OVERAGE mas mantém a regra', () => {
    const r = removerTabelaDePrecos(PROMPT_COM_TABELA);

    expect(r.prompt).toContain('# REGRA 7 — OVERAGE');
    expect(r.prompt).toContain('Explique isso ANTES do lead assinar, nunca depois.');
    expect(r.prompt).toContain('ofereça subir de plano em vez de dar desconto');
    expect(r.prompt).not.toContain('R$ 0,10');
  });

  it('mantém as regras de COMO falar de preço', () => {
    const r = removerTabelaDePrecos(PROMPT_COM_TABELA);

    expect(r.prompt).toContain('# REGRA 6 — PLANOS E PREÇO');
    expect(r.prompt).toContain('faça UMA pergunta de volume antes de recomendar');
    expect(r.prompt).toContain('Desconto acima de 10% precisa de aprovação do time.');
    expect(r.prompt).toContain('NUNCA invente preço, SLA, prazo.');
  });

  it('manda a Iza buscar o preço no bloco de fatos gerado do catálogo', () => {
    const r = removerTabelaDePrecos(PROMPT_COM_TABELA);

    expect(r.prompt).toContain('FATOS ATUAIS');
    expect(r.prompt).toContain('PRICING');
  });

  it('preserva TUDO que não é preço (identidade, verticais, handoff)', () => {
    const r = removerTabelaDePrecos(PROMPT_COM_TABELA);

    expect(r.prompt).toContain('Você é a **Iza**');
    expect(r.prompt).toContain('# REGRA 2 — VERTICAIS BLOQUEADAS (DESQUALIFIQUE NA HORA)');
    expect(r.prompt).toContain('A ZappIQ **NÃO atende** apostas');
    expect(r.prompt).toContain('# REGRA 8 — HANDOFF HUMANO');
    expect(r.prompt).toContain('# REGRAS INVIOLÁVEIS');
  });

  it('é idempotente: rodar de novo não muda nada', () => {
    const um = removerTabelaDePrecos(PROMPT_COM_TABELA);
    const dois = removerTabelaDePrecos(um.prompt);

    expect(dois.prompt).toBe(um.prompt);
    expect(dois.mudou).toBe(false);
  });

  it('prompt já limpo devolve mudou=false e não inventa seção', () => {
    const limpo = '# Iza\n\nVocê é a **Iza**. Nunca invente preço.';
    const r = removerTabelaDePrecos(limpo);

    expect(r.mudou).toBe(false);
    expect(r.prompt).toBe(limpo);
  });

  it('funciona com o marcador ## IDENTIDADE do promptEngine', () => {
    const comIdentidade = `## IDENTIDADE
Você é a **Iza**, consultora virtual da ZappIQ.

**Planos** (mensal): Starter R$ 297, Growth R$ 597, Scale R$ 997

# REGRA 7 — OVERAGE
Excedente a R$ 0,10 por mensagem. Avise antes.`;
    const r = removerTabelaDePrecos(comIdentidade);

    expect(r.prompt).toContain('## IDENTIDADE');
    expect(r.prompt).not.toContain('997');
    expect(r.prompt).toContain('Avise antes.');
  });
});

describe('validarPromptResultante', () => {
  it('aprova a saída da transformação sobre o prompt real', () => {
    const r = removerTabelaDePrecos(PROMPT_COM_TABELA);
    const v = validarPromptResultante(PROMPT_COM_TABELA, r.prompt);

    expect(v.ok).toBe(true);
    expect(v.motivos).toEqual([]);
  });

  it('recusa quando o resultado perde o marcador de identidade', () => {
    const semIdentidade = PROMPT_COM_TABELA
      .replace('Você é a **Iza**, consultora virtual da **ZappIQ**', 'Texto qualquer')
      .replace('# Iza — ZappIQ (system prompt v7.6)', '# Documento');
    const v = validarPromptResultante(PROMPT_COM_TABELA, semIdentidade);

    expect(v.ok).toBe(false);
    expect(v.motivos.some((m) => m.includes(MOTIVO_IDENTIDADE))).toBe(true);
  });

  it('recusa quando o resultado encolhe abaixo de 60% do original', () => {
    const cortado = PROMPT_COM_TABELA.slice(0, Math.floor(PROMPT_COM_TABELA.length * 0.5));
    const v = validarPromptResultante(PROMPT_COM_TABELA, cortado);

    expect(v.ok).toBe(false);
    expect(v.motivos.some((m) => m.includes(MOTIVO_TAMANHO))).toBe(true);
  });

  it('recusa quando o original não tem marcador de identidade nenhum (fail-closed)', () => {
    const v = validarPromptResultante('texto solto sem cabeçalho', 'texto solto sem cabeçalho');

    expect(v.ok).toBe(false);
    expect(v.motivos.some((m) => m.includes(MOTIVO_IDENTIDADE))).toBe(true);
  });

  it('recusa quando sobrou valor em reais depois da transformação', () => {
    const sujo = `${PROMPT_COM_TABELA}\n\nObs: o Scale custa R$ 997.`;
    const r = removerTabelaDePrecos(PROMPT_COM_TABELA);
    const v = validarPromptResultante(PROMPT_COM_TABELA, `${r.prompt}\n\nObs: R$ 997.`);

    expect(sujo).toContain('R$ 997');
    expect(v.ok).toBe(false);
    expect(v.motivos.join(' ')).toContain('R$');
  });
});

/*
 * A substituição de "R$ <valor>" não fecha o buraco do número escrito SEM
 * cifrão: "997,00" e "997/mês" atravessavam inteiros, e a prova de produção
 * (`system_prompt LIKE '%997%'` = 0) falharia em silêncio. Agora número de 3
 * ou 4 dígitos perto de nome de plano RECUSA a gravação, com a exceção das
 * cotas do catálogo, que são legítimas ("Scale 80.000 mensagens").
 */
describe('validarPromptResultante: número solto perto de nome de plano', () => {
  const BASE = '# Iza\n\nVocê é a Iza da ZappIQ. Pergunte o volume antes de recomendar. Nunca invente preço, SLA ou prazo. Quando o lead pedir humano, aceite na hora.';

  it('recusa "997,00" sem cifrão encostado no nome do plano', () => {
    const v = validarPromptResultante(BASE, `${BASE}\n\nO Scale sai por 997,00 no mês.`);

    expect(v.ok).toBe(false);
    expect(v.motivos.some((m) => m.includes(MOTIVO_NUMERO_PERTO_DE_PLANO))).toBe(true);
    expect(v.motivos.join(' ')).toContain('997');
  });

  it('recusa "997/mês" sem cifrão', () => {
    const v = validarPromptResultante(BASE, `${BASE}\n\nScale: 997/mês, cobre com folga.`);

    expect(v.ok).toBe(false);
    expect(v.motivos.some((m) => m.includes(MOTIVO_NUMERO_PERTO_DE_PLANO))).toBe(true);
  });

  it('recusa o preço do plano de entrada escrito solto', () => {
    const v = validarPromptResultante(BASE, `${BASE}\n\nO Lite fica em 247 por mês.`);

    expect(v.ok).toBe(false);
    expect(v.motivos.some((m) => m.includes(MOTIVO_NUMERO_PERTO_DE_PLANO))).toBe(true);
  });

  it('aceita cota do catálogo colada no nome do plano', () => {
    const cotas = `${BASE}\n\nO Scale tem 80.000 mensagens e o Lite tem 1.500. O Growth tem 8.000.`;
    const v = validarPromptResultante(BASE, cotas);

    expect(v.motivos.filter((m) => m.includes(MOTIVO_NUMERO_PERTO_DE_PLANO))).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('aceita número de 3 dígitos longe de qualquer nome de plano', () => {
    const longe = `${BASE}\n\nO protocolo de atendimento tem 480 caracteres no máximo, sempre.`;
    const v = validarPromptResultante(BASE, longe);

    expect(v.ok).toBe(true);
  });

  it('aceita número de 5 dígitos perto do plano (não é forma de preço)', () => {
    const v = validarPromptResultante(BASE, `${BASE}\n\nO Scale aguenta 120000 eventos por hora.`);

    expect(v.ok).toBe(true);
  });

  it('aprova a saída da transformação sobre o prompt real (a regra nova não atrapalha)', () => {
    const r = removerTabelaDePrecos(PROMPT_COM_TABELA);
    const v = validarPromptResultante(PROMPT_COM_TABELA, r.prompt);

    expect(v.ok).toBe(true);
  });
});

describe('VALOR_EM_REAIS não pode comer o ponto final da frase', () => {
  it('"R$ 997." vira ponteiro e o ponto final continua lá', () => {
    const r = removerTabelaDePrecos('# Iza\n\nO Scale sai por R$ 997. Pergunte o volume.');

    expect(r.prompt).toContain(']. Pergunte o volume.');
    expect(r.valoresEmReaisSubstituidos).toEqual(['R$ 997']);
  });

  it('valor com milhar e centavos sai inteiro, sem sobra', () => {
    const r = removerTabelaDePrecos('Custa R$ 1.497,00. E o anual, R$ 1.197,60.');

    expect(r.prompt).not.toMatch(/[0-9]/);
    expect(r.valoresEmReaisSubstituidos).toEqual(['R$ 1.497,00', 'R$ 1.197,60']);
  });

  it('valor com um decimal só também sai inteiro', () => {
    const r = removerTabelaDePrecos('A faixa de voz começa em R$ 79,9 no mês.');

    expect(r.prompt).not.toMatch(/[0-9]/);
  });
});

describe('avisosDeNumeroSolto', () => {
  it('avisa sobre preço velho escrito SEM "R$" ao lado do nome do plano', () => {
    // Sem isto a prova de produção (LIKE '%997%' = 0) falharia em silêncio:
    // o valor some da forma "R$ 997" e sobrevive na forma "Scale 997".
    const prompt = 'Para volume grande, o Scale 997 costuma resolver.';
    const avisos = avisosDeNumeroSolto(prompt, [247, 497, 1497]);

    expect(avisos.join(' ')).toContain('Scale');
    expect(avisos.join(' ')).toContain('997');
  });

  it('avisa sobre preço do catálogo escrito sem "R$"', () => {
    const avisos = avisosDeNumeroSolto('O plano sai por 1.497 no mês.', [1497]);
    expect(avisos.join(' ')).toContain('1.497');
  });

  it('não avisa quando o prompt não tem número perto de plano nem preço solto', () => {
    const prompt = 'Pergunte o volume antes de recomendar. Nunca invente preço.';
    expect(avisosDeNumeroSolto(prompt, [247, 497, 1497])).toEqual([]);
  });

  it('avisa sobre a cota também, porque quem revisa precisa olhar (falso positivo assumido)', () => {
    const avisos = avisosDeNumeroSolto('O Scale tem 80.000 mensagens.', [1497]);
    expect(avisos.length).toBeGreaterThan(0);
  });
});

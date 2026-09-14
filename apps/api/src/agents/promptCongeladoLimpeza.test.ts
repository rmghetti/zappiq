/* ══════════════════════════════════════════════════════════════════════
 * Limpeza dos prompts gravados, testada contra o texto REAL do seed.
 * --------------------------------------------------------------------
 * A fixture abaixo é o prompt da Antonella (restaurante) como ele está no
 * banco: gerado pelo buildSeedSystemPrompt de antes deste PR, com a data do
 * cadastro, o Fluxo de Agendamento, o tom congelado e a seção de horário que
 * afirma "Domingo: Fechado" para um restaurante que abre domingo das 12h às
 * 22h. É esse texto que a migração precisa tratar sem estragar o resto.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import {
  limparPromptCongelado,
  limparListaDePrompts,
  verificarTravas,
  PROPORCAO_MINIMA,
} from './promptCongeladoLimpeza.js';

const PROMPT_REAL = `## IDENTIDADE
Você é Antonella, atendente virtual do restaurante da Antonella Italian Food.
Data/hora atual: 05/07/2026, 01:24:07 (Fuso: America/Sao_Paulo)


## INSTRUÇÕES GERAIS

Você é um agente de IA conversacional integrado ao WhatsApp. Suas respostas chegam
diretamente ao celular do cliente, portanto:

### Formato de respostas
- Seja CONCISO e DIRETO. Máximo de 3-4 parágrafos por resposta.

### Escalada para humano
- Acione <action>handoff</action> quando:
  a) Cliente solicitar explicitamente falar com pessoa

### Formato de saída estruturada
Quando tiver uma ação a executar, use os tags XML no final da resposta:
- <reply>Texto para o cliente</reply>  (SEMPRE presente)




## ESPECIALIZAÇÃO — RESTAURANTE
Atendente de restaurante. Gerencia reservas, informa cardápio, horários de funcionamento
e opções de delivery. Pergunte sobre restrições alimentares e preferências.
Para eventos e grupos grandes, encaminhe para gerente.



### Fluxo de Agendamento
Quando o cliente quiser agendar:
1. Pergunte qual serviço/procedimento.
2. Pergunte a preferência de data e horário.
5. Confirme o agendamento com todos os detalhes.
6. Informe que um lembrete será enviado 24h e 1h antes.
7. Use <action>schedule</action> com os dados coletados.



## TOM DE VOZ — AMIGÁVEL
Use linguagem próxima, informal mas profissional. Pode usar "você", contrações naturais,
emojis ocasionais. Seja como um amigo especialista, não um robô corporativo.


## HORÁRIO DE FUNCIONAMENTO


• Domingo: Fechado


Fora do horário comercial, informe quando poderão ser atendidos pessoalmente,
mas continue agendando e respondendo dúvidas — você funciona 24/7!



Lembre-se: você representa Antonella Italian Food. Cada conversa é uma oportunidade de criar
um cliente fiel. Seja eficiente, empático e sempre conduza para a solução.`;

describe('limparPromptCongelado no prompt real da Antonella', () => {
  const r = limparPromptCongelado(PROMPT_REAL);

  it('tira as três coisas combinadas', () => {
    expect(r.recusa).toBeNull();
    expect(r.mudou).toBe(true);
    expect(r.prompt).not.toContain('## HORÁRIO DE FUNCIONAMENTO');
    expect(r.prompt).not.toContain('Domingo: Fechado');
    expect(r.prompt).not.toContain('Data/hora atual');
    expect(r.prompt).not.toContain('Fluxo de Agendamento');
    expect(r.prompt).not.toContain('lembrete será enviado 24h e 1h antes');
    expect(r.prompt).not.toContain('24/7');
  });

  it('preserva identidade, instruções, segmento, tom e rodapé', () => {
    expect(r.prompt).toContain('## IDENTIDADE');
    expect(r.prompt).toContain('Você é Antonella, atendente virtual do restaurante');
    expect(r.prompt).toContain('## INSTRUÇÕES GERAIS');
    expect(r.prompt).toContain('### Formato de saída estruturada');
    expect(r.prompt).toContain('## ESPECIALIZAÇÃO — RESTAURANTE');
    // O tom congelado FICA: a decisão foi cirúrgica nos três itens. Quem
    // vence o tom velho é o bloco vivo, que entra depois no prompt.
    expect(r.prompt).toContain('## TOM DE VOZ — AMIGÁVEL');
    expect(r.prompt).toContain('Lembre-se: você representa Antonella Italian Food');
  });

  it('devolve os trechos removidos para auditoria', () => {
    expect(r.removidos).toHaveLength(3);
    expect(r.removidos.join('\n')).toContain('Domingo: Fechado');
    expect(r.removidos.join('\n')).toContain('lembrete será enviado');
    expect(r.removidos.join('\n')).toContain('Data/hora atual: 05/07/2026');
  });

  it('não corta mais que o necessário (fica acima do piso de 60%)', () => {
    expect(r.prompt.length).toBeGreaterThan(PROMPT_REAL.length * PROPORCAO_MINIMA);
  });

  it('é idempotente: rodar de novo não muda mais nada', () => {
    const segunda = limparPromptCongelado(r.prompt);
    expect(segunda.mudou).toBe(false);
    expect(segunda.prompt).toBe(r.prompt);
  });

  it('não cola parágrafos nem abre buraco novo de linhas em branco', () => {
    const buracos = (t: string) => (t.match(/\n{4,}/g) || []).length;
    // O seed já nascia com vãos; a limpeza não pode criar mais nenhum.
    expect(buracos(r.prompt)).toBeLessThanOrEqual(buracos(PROMPT_REAL));
    expect(r.prompt).not.toContain('robô corporativo.Lembre');
    expect(r.prompt).not.toContain('preferências.## TOM');
  });
});

describe('as travas: prefere deixar o prompt velho a gravar algo estranho', () => {
  it('recusa quando o resultado perdeu a linha de IDENTIDADE', () => {
    // A trava é o cinto de segurança para o prompt fora do padrão. Testada
    // de frente, porque com o texto do seed ela (felizmente) não dispara.
    const original = '## IDENTIDADE\nVocê é Vera.\n\n## HORÁRIO DE FUNCIONAMENTO\n• Domingo: Fechado';
    expect(verificarTravas(original, 'Você é Vera.\n\ntexto suficientemente longo para o piso')).toBe('perdeu_identidade');
  });

  it('a trava de tamanho dispara quando sobra menos de 60% do texto', () => {
    const original = 'x'.repeat(1000);
    expect(verificarTravas(original, 'x'.repeat(599))).toBe('encolheu_demais');
    expect(verificarTravas(original, 'x'.repeat(601))).toBeNull();
  });

  it('recusa quando o resultado encolhe abaixo do piso', () => {
    const quaseSoHorario = `## IDENTIDADE
Você é X.

## HORÁRIO DE FUNCIONAMENTO
${'• Segunda: 09:00 às 18:00\n'.repeat(40)}`;
    const r = limparPromptCongelado(quaseSoHorario);
    expect(r.recusa).toBe('encolheu_demais');
    expect(r.prompt).toBe(quaseSoHorario);
  });

  it('prompt sem nada a limpar (o da Iza, escrito à mão) sai intacto', () => {
    const iza = '# Iza\nVocê é a **Iza**, consultora da plataforma.\n\nREGRA 1: ...';
    const r = limparPromptCongelado(iza);
    expect(r.mudou).toBe(false);
    expect(r.prompt).toBe(iza);
    expect(r.removidos).toEqual([]);
  });

  it('texto vazio ou inválido não quebra', () => {
    expect(limparPromptCongelado('').mudou).toBe(false);
    expect(limparPromptCongelado(undefined as any).prompt).toBe('');
  });
});

describe('modo offline: a mesma função aplicada a uma lista exportada', () => {
  it('devolve antes e depois de cada agente, com o que saiu', () => {
    const saida = limparListaDePrompts([
      { id: 'agente-antonella', system_prompt: PROMPT_REAL },
      { id: 'agente-iza', system_prompt: 'Você é a **Iza**.' },
    ]);

    expect(saida).toHaveLength(2);
    expect(saida[0].mudou).toBe(true);
    expect(saida[0].system_prompt_antes).toBe(PROMPT_REAL);
    expect(saida[0].system_prompt).not.toContain('Domingo: Fechado');
    expect(saida[0].removidos.length).toBe(3);

    expect(saida[1].mudou).toBe(false);
    expect(saida[1].system_prompt).toBe('Você é a **Iza**.');
  });

  it('agente recusado sai com o prompt ORIGINAL e o motivo à vista', () => {
    const saida = limparListaDePrompts([
      { id: 'torto', system_prompt: `## IDENTIDADE\nX\n\n## HORÁRIO DE FUNCIONAMENTO\n• Domingo: Fechado` },
    ]);
    expect(saida[0].recusa).toBe('encolheu_demais');
    expect(saida[0].mudou).toBe(false);
    expect(saida[0].system_prompt).toContain('Domingo: Fechado');
  });
});

describe('seção repetida: a limpeza tira TODAS as ocorrências', () => {
  // Prompt editado à mão pelo cliente pode ter a mesma seção duas vezes (é
  // o que acontece quando alguém cola um trecho do seed por cima). Tirar só
  // a primeira deixava a promessa de lembrete viva no prompt gravado, e a
  // segunda passada do script dizia "nada a limpar".
  const DUAS_VEZES = `## IDENTIDADE
Você é Vera, atendente da CMJ. Este parágrafo existe para o resultado ficar
acima do piso de 60% do tamanho original, que é a trava de gravação.
Ele repete a ideia de propósito, para o texto ter corpo suficiente.
Mais uma linha de conteúdo do cliente, que não pode sair daqui.
Mais outra linha de conteúdo do cliente, que também não pode sair daqui.

### Fluxo de Agendamento
Quando o cliente quiser agendar:
6. Informe que um lembrete será enviado 24h e 1h antes.

## ESPECIALIZAÇÃO
Atendimento comercial.

### Fluxo de Agendamento
Quando o cliente quiser agendar (colado de novo):
6. Informe que um lembrete será enviado 24h e 1h antes.

Lembre-se: você representa a CMJ.`;

  it('nenhuma das duas seções sobra, e as duas aparecem na auditoria', () => {
    const r = limparPromptCongelado(DUAS_VEZES);

    expect(r.recusa).toBeNull();
    expect(r.prompt).not.toContain('Fluxo de Agendamento');
    expect(r.prompt).not.toContain('lembrete será enviado');
    expect(r.removidos).toHaveLength(2);
    expect(r.prompt).toContain('## ESPECIALIZAÇÃO');
    expect(r.prompt).toContain('Lembre-se: você representa a CMJ.');
  });

  it('continua idempotente com a seção repetida', () => {
    const r = limparPromptCongelado(DUAS_VEZES);
    expect(limparPromptCongelado(r.prompt).mudou).toBe(false);
  });
});

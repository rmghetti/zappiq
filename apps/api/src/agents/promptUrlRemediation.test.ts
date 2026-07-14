/**
 * promptUrlRemediation.test.ts
 * ============================================================================
 * A remediação reescreve prompt de cliente em PRODUÇÃO. O que não pode
 * acontecer, em ordem de gravidade:
 *   1. sobrar link nosso no prompt do cliente (o bug);
 *   2. sumir customização que o cliente/Rodrigo acumulou (dano novo);
 *   3. rodar 2x e estragar (o script pode ser reexecutado).
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { removerBlocoUrlsZappIQ } from './promptUrlRemediation.js';
import { findForeignBrandLeaks } from './tenantIsolationGuard.js';

// Trecho REAL do prompt gerado pelo promptEngine da origin/main (12/05→14/07),
// que é o que está congelado no Agent.systemPrompt dos clientes seedados.
const PROMPT_CONTAMINADO = `## IDENTIDADE
Você é Vera, atendente virtual da empresa da CMJ.

### Aceitação de oferta (REGRA CRÍTICA — não viole nunca)
Se o cliente aceitou, ele já decidiu. Sua função é ELIMINAR FRICÇÃO até o checkout/signup.

### URLs canônicas ZappIQ (use EXATAMENTE essas, sem inventar variações)
- Signup / trial: https://zappiq.com.br/cadastro
- Onboarding pós-signup: https://zappiq.com.br/onboarding
- Site institucional: https://zappiq.com.br
- WhatsApp comercial: já é você mesma neste chat

Sempre que mencionar URL, escreva a URL completa com https://. Não escreva só "/cadastro"
ou "acesse cadastro" — o cliente está no WhatsApp do celular e precisa do link tocável.

### Segurança e Privacidade
- NUNCA solicite dados de cartão de crédito, senha ou CPF via WhatsApp.

Lembre-se: você representa CMJ.`;

describe('removerBlocoUrlsZappIQ', () => {
  it('tira os links da ZappIQ do prompt do cliente', () => {
    const r = removerBlocoUrlsZappIQ(PROMPT_CONTAMINADO);

    expect(r).not.toBeNull();
    expect(r!.prompt).not.toContain('zappiq.com.br');
    expect(r!.prompt).not.toContain('URLs canônicas ZappIQ');
    expect(findForeignBrandLeaks(r!.prompt, { strict: true })).toEqual([]);
  });

  it('põe no lugar a regra de URL sem marca (o agente não fica sem orientação)', () => {
    const r = removerBlocoUrlsZappIQ(PROMPT_CONTAMINADO);

    expect(r!.prompt).toContain('### URLs (regra geral)');
    expect(r!.prompt).toContain('NUNCA invente uma URL');
    expect(r!.prompt).toContain('diga que vai verificar');
  });

  it('preserva TUDO que não é a seção de URLs (identidade, regras, customização)', () => {
    const r = removerBlocoUrlsZappIQ(PROMPT_CONTAMINADO);

    expect(r!.prompt).toContain('Você é Vera, atendente virtual da empresa da CMJ.');
    expect(r!.prompt).toContain('### Aceitação de oferta (REGRA CRÍTICA — não viole nunca)');
    expect(r!.prompt).toContain('ELIMINAR FRICÇÃO até o checkout/signup.');
    expect(r!.prompt).toContain('### Segurança e Privacidade');
    expect(r!.prompt).toContain('- NUNCA solicite dados de cartão de crédito, senha ou CPF via WhatsApp.');
    expect(r!.prompt).toContain('Lembre-se: você representa CMJ.');
  });

  it('mexe SÓ na seção de URLs: o resto do prompt fica byte a byte igual', () => {
    const r = removerBlocoUrlsZappIQ(PROMPT_CONTAMINADO);

    const antes = PROMPT_CONTAMINADO.split('### URLs canônicas ZappIQ')[0];
    const depois = PROMPT_CONTAMINADO.split('### Segurança e Privacidade')[1];

    expect(r!.prompt.startsWith(antes)).toBe(true);
    expect(r!.prompt.endsWith(depois)).toBe(true);
  });

  it('devolve o texto removido, pra auditoria e revert', () => {
    const r = removerBlocoUrlsZappIQ(PROMPT_CONTAMINADO);

    expect(r!.removido).toContain('https://zappiq.com.br/cadastro');
    expect(r!.removido).toContain('URLs canônicas ZappIQ');
  });

  it('idempotente: rodar de novo no prompt já limpo é no-op (null)', () => {
    const r1 = removerBlocoUrlsZappIQ(PROMPT_CONTAMINADO);
    const r2 = removerBlocoUrlsZappIQ(r1!.prompt);

    expect(r2).toBeNull();
  });

  it('prompt sem o bloco: null, não toca em nada', () => {
    expect(removerBlocoUrlsZappIQ('## IDENTIDADE\nVocê é Bia da Loja X.')).toBeNull();
    expect(removerBlocoUrlsZappIQ('')).toBeNull();
  });

  it('seção de URLs no fim do prompt (sem ### depois): ainda remove', () => {
    const p = `## IDENTIDADE
Você é Vera.

### URLs canônicas ZappIQ (use EXATAMENTE essas, sem inventar variações)
- Signup / trial: https://zappiq.com.br/cadastro`;

    const r = removerBlocoUrlsZappIQ(p);
    expect(r!.prompt).not.toContain('zappiq.com.br');
    expect(r!.prompt).toContain('Você é Vera.');
  });

  it('tolera variação de conteúdo dentro da seção (seeds de versões diferentes)', () => {
    const p = `### URLs canônicas ZappIQ (use EXATAMENTE essas, sem inventar variações)
- Signup: https://zappiq.com.br/cadastro
- Uma linha que só existe num seed antigo qualquer

### Outra coisa
preservar isto`;

    const r = removerBlocoUrlsZappIQ(p);
    expect(r!.prompt).not.toContain('zappiq.com.br');
    expect(r!.prompt).toContain('### Outra coisa\npreservar isto');
  });
});

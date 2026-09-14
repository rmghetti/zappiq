/* ══════════════════════════════════════════════════════════════════════
 * V4 #143 · Tests do pre-filter de verticais bloqueadas
 *
 * Cobertura crítica:
 *   ✓ Match em frases comuns que cliente real mandaria
 *   ✓ Match com variações de grafia (acentos, caps, espaços)
 *   ✓ NÃO match em segmentos legítimos com palavras superficiais
 *   ✓ Templates retornados são os esperados
 *   ✓ matchedSnippet preserva o trecho original (audit)
 *
 * Atualizado 14/07/2026 (duas camadas):
 *   As verticais de política comercial (apostas/cripto/MLM) agora SÓ valem na
 *   org da ZappIQ. Por isso os testes delas passam `ZAPPIQ` explicitamente:
 *   sem org, o filtro trata como cliente e não bloqueia (fail-safe).
 *   ✓ Org de cliente não recebe nossa política nem nossa marca
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import {
  detectBlockedVertical,
  detectarSinalDeCrise,
  isBlocked,
  listBlockedVerticals,
  BLOCKED_VERTICAL_LAYERS,
} from './blockedVerticalFilter.js';
import { ZAPPIQ_ORG_ID } from '../../config/zappiqOrg.js';
import { findForeignBrandLeaks } from '../../agents/tenantIsolationGuard.js';

/** Contexto da org da ZappIQ (onde a Iza roda e nossa política vale). */
const ZAPPIQ = { organizationId: ZAPPIQ_ORG_ID };
/** Contexto de um tenant real (CMJ). Nossa política comercial não vale aqui. */
const CLIENTE = { organizationId: 'org-cmj-123', businessName: 'CMJ' };

describe('blockedVerticalFilter — apostas', () => {
  it('detecta "casa de apostas"', () => {
    const r = detectBlockedVertical('tenho casa de apostas, querem usar a IA', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(r.vertical).toBe('apostas');
      expect(r.suggestedResponse).toContain('apostas');
    }
  });

  it('detecta "cassino online"', () => {
    expect(detectBlockedVertical('vamos abrir um cassino online no Brasil', ZAPPIQ).blocked).toBe(true);
  });

  // A232: 'cassino' isolado desqualificava o lead de pousada na Praia do
  // Cassino, em Rio Grande. A palavra sozinha não diz nada sobre apostas.
  it('NÃO detecta "Cassino" isolado (Praia do Cassino é turismo)', () => {
    expect(
      detectBlockedVertical('Quero reservar na Praia do Cassino no feriado', ZAPPIQ).blocked,
    ).toBe(false);
  });

  it('detecta "apostas esportivas"', () => {
    expect(detectBlockedVertical('plataforma de apostas esportivas pra Copa', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta marca conhecida (bet365)', () => {
    const r = detectBlockedVertical('quero algo tipo bet365', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.vertical).toBe('apostas');
  });

  it('detecta com variação de caps', () => {
    expect(detectBlockedVertical('CASA DE APOSTAS no exterior', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta plural "casas de apostas"', () => {
    expect(detectBlockedVertical('grupo de casas de apostas', ZAPPIQ).blocked).toBe(true);
  });

  it('NÃO detecta "casa" sozinha (genérico)', () => {
    expect(detectBlockedVertical('vendo casa em Floripa', ZAPPIQ).blocked).toBe(false);
  });

  it('NÃO detecta "esportivo" sozinho (academia, vestuário etc)', () => {
    expect(detectBlockedVertical('loja de roupa esportiva', ZAPPIQ).blocked).toBe(false);
  });
});

describe('blockedVerticalFilter — cripto não-regulada', () => {
  it('detecta "corretora de cripto P2P"', () => {
    const r = detectBlockedVertical('fundamos uma corretora de cripto P2P', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.vertical).toBe('cripto-nao-regulada');
  });

  it('detecta "P2P de cripto"', () => {
    expect(detectBlockedVertical('plataforma P2P de cripto sem KYC', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta "ICO"', () => {
    expect(detectBlockedVertical('vamos lançar um ICO', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta "corretora sem registro CVM"', () => {
    expect(
      detectBlockedVertical('corretora sem registro CVM, mas com volume alto', ZAPPIQ).blocked,
    ).toBe(true);
  });

  it('NÃO detecta "criptografia" (segurança, não cripto-moeda)', () => {
    expect(
      detectBlockedVertical('precisamos de criptografia ponta-a-ponta', ZAPPIQ).blocked,
    ).toBe(false);
  });

  it('NÃO detecta "Bitcoin" sozinho (legítimo regulado)', () => {
    expect(detectBlockedVertical('aceitamos Bitcoin como pagamento', ZAPPIQ).blocked).toBe(false);
  });
});

describe('blockedVerticalFilter — pornografia', () => {
  it('detecta "OnlyFans"', () => {
    const r = detectBlockedVertical('sou criadora de OnlyFans', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.vertical).toBe('pornografia');
  });

  it('detecta "conteúdo adulto"', () => {
    expect(detectBlockedVertical('plataforma de conteúdo adulto', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta "site adulto"', () => {
    expect(detectBlockedVertical('temos um site adulto com 10k assinantes', ZAPPIQ).blocked).toBe(true);
  });

  it('NÃO detecta "público adulto" (segmento etário, não pornografia)', () => {
    expect(detectBlockedVertical('produto pra público adulto 30+', ZAPPIQ).blocked).toBe(false);
  });
});

describe('blockedVerticalFilter — MLM', () => {
  it('detecta "MLM" exato', () => {
    const r = detectBlockedVertical('trabalho com MLM de suplementos', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.vertical).toBe('mlm');
  });

  it('detecta "marketing multinível"', () => {
    expect(detectBlockedVertical('estrutura de marketing multinível', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta "marketing de rede"', () => {
    expect(detectBlockedVertical('é marketing de rede mesmo', ZAPPIQ).blocked).toBe(true);
  });

  it('detecta marca conhecida (Hinode)', () => {
    expect(detectBlockedVertical('sou consultora Hinode', ZAPPIQ).blocked).toBe(true);
  });

  // A232: Polishop e Natura são varejo. O lojista que revende não está
  // propondo marketing multinível, e desqualificá-lo é perder venda.
  it('NÃO detecta lojista de marca de varejo (Polishop, Natura)', () => {
    expect(detectBlockedVertical('Sou revendedora da Polishop', ZAPPIQ).blocked).toBe(false);
    expect(detectBlockedVertical('Tenho uma loja Natura', ZAPPIQ).blocked).toBe(false);
  });

  it('NÃO detecta "marketing" sozinho', () => {
    expect(detectBlockedVertical('precisamos de marketing digital', ZAPPIQ).blocked).toBe(false);
  });

  it('NÃO detecta "rede" sozinho (rede de varejo, rede social)', () => {
    expect(detectBlockedVertical('rede de farmácias com 50 lojas', ZAPPIQ).blocked).toBe(false);
  });
});

describe('blockedVerticalFilter — false positives e edge cases', () => {
  it('retorna no-match em string vazia', () => {
    expect(detectBlockedVertical('', ZAPPIQ).blocked).toBe(false);
  });

  it('retorna no-match em null', () => {
    expect(detectBlockedVertical(null, ZAPPIQ).blocked).toBe(false);
  });

  it('retorna no-match em undefined', () => {
    expect(detectBlockedVertical(undefined, ZAPPIQ).blocked).toBe(false);
  });

  it('retorna no-match em texto comum de saudação', () => {
    expect(detectBlockedVertical('oi tudo bem? sou da empresa Acme', ZAPPIQ).blocked).toBe(false);
  });

  it('retorna no-match em pergunta de preço', () => {
    expect(detectBlockedVertical('quanto custa o plano Growth?', ZAPPIQ).blocked).toBe(false);
  });

  it('retorna no-match em pedido de demo', () => {
    expect(
      detectBlockedVertical('pode me mandar link pra agendar uma demo?', ZAPPIQ).blocked,
    ).toBe(false);
  });
});

describe('blockedVerticalFilter — matchedSnippet pra audit', () => {
  it('preserva o trecho que casou', () => {
    const r = detectBlockedVertical('tenho CASA DE APOSTAS aqui', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(r.matchedSnippet.toLowerCase()).toBe('casa de apostas');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// Duas camadas (14/07/2026): o bug que chegava ao lead do cliente.
// ══════════════════════════════════════════════════════════════════════

describe('blockedVerticalFilter: política comercial NÃO vaza pro cliente', () => {
  it('lead do CMJ falando de casa de apostas NÃO é bloqueado (funil é do CMJ)', () => {
    expect(detectBlockedVertical('tenho casa de apostas, querem usar a IA', CLIENTE).blocked).toBe(false);
  });

  it('cripto e MLM também passam na org do cliente', () => {
    expect(detectBlockedVertical('fundamos uma corretora de cripto P2P', CLIENTE).blocked).toBe(false);
    expect(detectBlockedVertical('trabalho com MLM de suplementos', CLIENTE).blocked).toBe(false);
  });

  it('as mesmas frases SÃO bloqueadas na org da ZappIQ', () => {
    expect(detectBlockedVertical('tenho casa de apostas', ZAPPIQ).blocked).toBe(true);
    expect(detectBlockedVertical('fundamos uma corretora de cripto P2P', ZAPPIQ).blocked).toBe(true);
    expect(detectBlockedVertical('trabalho com MLM de suplementos', ZAPPIQ).blocked).toBe(true);
  });

  it('fail-safe: org desconhecida = cliente (só compliance)', () => {
    expect(detectBlockedVertical('tenho casa de apostas').blocked).toBe(false);
    expect(detectBlockedVertical('tenho casa de apostas', {}).blocked).toBe(false);
    expect(detectBlockedVertical('tenho casa de apostas', { organizationId: null }).blocked).toBe(false);
    expect(detectBlockedVertical('tenho casa de apostas', { organizationId: '' }).blocked).toBe(false);
  });
});

describe('blockedVerticalFilter: compliance vale pra todo tenant, sem marca', () => {
  it('pornografia é bloqueada TAMBÉM na org do cliente', () => {
    const r = detectBlockedVertical('sou criadora de OnlyFans', CLIENTE);
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(r.vertical).toBe('pornografia');
      expect(r.layer).toBe('compliance');
    }
  });

  it('a mensagem pro lead do cliente NÃO cita a ZappIQ (o bug)', () => {
    const r = detectBlockedVertical('plataforma de conteúdo adulto', CLIENTE);
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(findForeignBrandLeaks(r.suggestedResponse)).toEqual([]);
      expect(r.suggestedResponse).toContain('CMJ');
    }
  });

  // A232/A251: a saída do compliance deixou de ser recusa. O cliente final
  // não é desqualificado por um template; a conversa vai para uma pessoa.
  it('compliance manda para TRANSBORDO, não para recusa', () => {
    const r = detectBlockedVertical('plataforma de conteúdo adulto', CLIENTE);
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(r.action).toBe('transbordo');
      expect(r.suggestedResponse).not.toMatch(/não atende(mos)?/i);
      expect(r.suggestedResponse).toMatch(/pessoa|equipe|atendimento/i);
    }
  });

  it('a política comercial da ZappIQ continua sendo RECUSA (é o nosso funil)', () => {
    const r = detectBlockedVertical('tenho casa de apostas', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.action).toBe('recusa');
  });

  it('sem businessName a mensagem fica neutra, ainda sem marca', () => {
    const r = detectBlockedVertical('plataforma de conteúdo adulto', { organizationId: 'org-x' });
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(findForeignBrandLeaks(r.suggestedResponse)).toEqual([]);
      expect(r.suggestedResponse.length).toBeGreaterThan(10);
    }
  });

  it('nenhuma resposta a tenant de cliente carrega marca nossa', () => {
    for (const frase of ['sou criadora de OnlyFans', 'temos um site adulto', 'camgirl profissional']) {
      const r = detectBlockedVertical(frase, CLIENTE);
      if (r.blocked) expect(findForeignBrandLeaks(r.suggestedResponse)).toEqual([]);
    }
  });

  it('na org da ZappIQ a resposta pode (e deve) citar a ZappIQ', () => {
    const r = detectBlockedVertical('tenho casa de apostas', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.suggestedResponse).toContain('ZappIQ');
  });
});

describe('blockedVerticalFilter — helpers', () => {
  it('isBlocked retorna boolean simples', () => {
    expect(isBlocked('tenho casa de apostas', ZAPPIQ)).toBe(true);
    expect(isBlocked('oi quero saber sobre voces', ZAPPIQ)).toBe(false);
  });

  it('isBlocked respeita a org (política nossa não vale pro cliente)', () => {
    expect(isBlocked('tenho casa de apostas', CLIENTE)).toBe(false);
    expect(isBlocked('sou criadora de OnlyFans', CLIENTE)).toBe(true);
  });

  it('a palavra solta não basta mais: o filtro exige operação declarada', () => {
    expect(isBlocked('pornografia', CLIENTE)).toBe(false);
    expect(isBlocked('conteúdo adulto', CLIENTE)).toBe(false);
    expect(isBlocked('escort', CLIENTE)).toBe(false);
  });

  it('listBlockedVerticals retorna 4 verticais', () => {
    const list = listBlockedVerticals();
    expect(list).toHaveLength(4);
    expect(list).toContain('apostas');
    expect(list).toContain('cripto-nao-regulada');
    expect(list).toContain('pornografia');
    expect(list).toContain('mlm');
  });

  it('só pornografia é compliance hoje; o resto é política nossa', () => {
    expect(BLOCKED_VERTICAL_LAYERS.pornografia).toBe('compliance');
    expect(BLOCKED_VERTICAL_LAYERS.apostas).toBe('politica-comercial-zappiq');
    expect(BLOCKED_VERTICAL_LAYERS['cripto-nao-regulada']).toBe('politica-comercial-zappiq');
    expect(BLOCKED_VERTICAL_LAYERS.mlm).toBe('politica-comercial-zappiq');
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * A251 e A232: corpus de NEGATIVOS por segmento.
 *
 * A camada compliance rodava para TODA organização, decidia por palavra
 * solta e recusava o cliente final com um template fixo. Reprodução de
 * 14/09/2026, com o módulo real: 7 de 7 frases legítimas bloqueadas numa
 * org de cliente. Oficina, psicólogo, escola e advogado são segmentos que o
 * próprio cadastro oferece.
 *
 * Estas frases são o contrato: nenhuma delas pode voltar a ser bloqueada.
 * ══════════════════════════════════════════════════════════════════════ */
describe('compliance: negativos por segmento (A251, A232)', () => {
  const CORPUS: Array<{ segmento: string; frases: string[] }> = [
    {
      segmento: 'saúde e saúde mental',
      frases: [
        'Meu marido tem vício em pornografia, vocês atendem casal?',
        'Quero tratar compulsão por pornografia',
        'Preciso de terapia, estou com vício em pornografia',
        'Meu filho acessou conteúdo adulto no celular, o que faço?',
        'Vocês atendem adolescente com uso problemático de conteúdo adulto?',
      ],
    },
    {
      segmento: 'jurídico',
      frases: [
        'Fui vítima de pornografia de vingança, preciso de um advogado',
        'Minha ex publicou fotos minhas num site adulto, quero processar',
        'Fui exposta em site adulto sem autorização, tem o que fazer?',
        'Quero processar quem divulgou conteúdo adulto meu',
      ],
    },
    {
      segmento: 'automotivo',
      frases: [
        'Quanto fica a revisão do meu Ford Escort 1998?',
        'Vocês têm pastilha de freio para Escort 98?',
        'Quero vender meu Ford Escort',
        'Tem peça de Escort Hobby aí?',
      ],
    },
    {
      segmento: 'turismo e varejo',
      frases: [
        'Quero reservar uma pousada na Praia do Cassino',
        'Sou revendedora da Polishop e quero vender pelo WhatsApp',
        'Tenho uma loja Natura no centro',
        'Produto para público adulto 30+',
      ],
    },
    {
      segmento: 'marketing',
      frases: ['Vocês fazem gestão de conta de OnlyFans?'],
    },
  ];

  for (const { segmento, frases } of CORPUS) {
    for (const frase of frases) {
      it(`[${segmento}] não bloqueia: "${frase}"`, () => {
        expect(detectBlockedVertical(frase, CLIENTE).blocked).toBe(false);
        // Também não pode bloquear na org da ZappIQ, onde valem as duas camadas.
        expect(detectBlockedVertical(frase, ZAPPIQ).blocked).toBe(false);
      });
    }
  }
});

describe('compliance: o que CONTINUA bloqueado (operação declarada)', () => {
  const POSITIVOS = [
    'temos um site adulto com 10 mil assinantes',
    'tenho uma plataforma de conteúdo adulto',
    'minha plataforma adulta precisa de atendimento',
    'sou criadora de OnlyFans',
    'sou camgirl profissional',
    'quero vender conteúdo adulto pelo WhatsApp',
    'montei um estúdio pornográfico',
  ];

  for (const frase of POSITIVOS) {
    it(`bloqueia: "${frase}"`, () => {
      const r = detectBlockedVertical(frase, CLIENTE);
      expect(r.blocked).toBe(true);
      if (r.blocked) {
        expect(r.vertical).toBe('pornografia');
        expect(r.layer).toBe('compliance');
        expect(r.action).toBe('transbordo');
      }
    });
  }
});

/* ══════════════════════════════════════════════════════════════════════
 * P62: rede de crise emocional.
 *
 * A única regra da plataforma para ideação suicida vivia na seção de
 * psicologia do prompt de segmento e não chegava a nenhum agente (A163,
 * A155). Aqui ela vira guarda programática, que não depende do modelo
 * obedecer. A detecção NÃO bloqueia: ela acrescenta.
 * ══════════════════════════════════════════════════════════════════════ */
describe('detectarSinalDeCrise: positivos, com e sem acento', () => {
  const POSITIVOS = [
    'quero me matar',
    'vou me matar',
    'nao aguento mais viver',
    'não aguento mais viver',
    'penso em acabar com tudo',
    'quero tirar minha vida',
    'quero tirar a própria vida',
    'estou me machucando',
    'tenho vontade de me machucar',
    'penso em suicídio',
    'penso em suicidio',
    'tive ideação suicida essa semana',
    'estou me cortando de novo',
    'não quero mais viver',
    'nao quero mais viver',
    'queria morrer',
    'prefiro morrer a continuar assim',
    'automutilação voltou',
    'pensei em me jogar na frente do carro',
  ];

  for (const frase of POSITIVOS) {
    it(`detecta: "${frase}"`, () => {
      const r = detectarSinalDeCrise(frase);
      expect(r.crise).toBe(true);
      if (r.crise) expect(r.regra).toBeTruthy();
    });
  }
});

describe('detectarSinalDeCrise: NEGATIVOS (expressão figurada)', () => {
  const NEGATIVOS = [
    'morrendo de rir com o vídeo de vocês',
    'esse bolo mata a saudade da vó',
    'quero algo pra matar a fome agora',
    'vou me matar de trabalhar essa semana',
    'preciso acabar com tudo isso que está pendente hoje',
    'vou me matar de estudar pra prova',
    'esse preço me mata',
    'a fila estava de matar',
    'quero cortar o cabelo',
    'preciso cortar o plano pela metade',
    'meu carro morreu na subida',
    'vou morrer de fome até o almoço',
    'quero matar a curiosidade sobre o produto',
    'não aguento mais esperar o orçamento',
    'não aguento mais esse calor',
  ];

  for (const frase of NEGATIVOS) {
    it(`NÃO detecta: "${frase}"`, () => {
      expect(detectarSinalDeCrise(frase).crise).toBe(false);
    });
  }

  it('texto vazio, null e undefined não são crise', () => {
    expect(detectarSinalDeCrise('').crise).toBe(false);
    expect(detectarSinalDeCrise(null).crise).toBe(false);
    expect(detectarSinalDeCrise(undefined).crise).toBe(false);
  });
});

describe('detectarSinalDeCrise: LGPD', () => {
  it('não devolve o texto da mensagem, só a regra que casou', () => {
    const r = detectarSinalDeCrise('quero me matar, meu nome é Ana e moro na rua X');
    expect(r.crise).toBe(true);
    if (r.crise) {
      expect(JSON.stringify(r)).not.toContain('Ana');
      expect(JSON.stringify(r)).not.toContain('rua X');
    }
  });
});

describe('crise x compliance: a crise vem primeiro', () => {
  it('pedido de ajuda com termo de compliance não vira recusa nem bloqueio', () => {
    const frase = 'não aguento mais viver com esse vício em pornografia';
    expect(detectarSinalDeCrise(frase).crise).toBe(true);
    expect(detectBlockedVertical(frase, CLIENTE).blocked).toBe(false);
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * CONTRATO da rede de crise (revisão do PR #374).
 *
 * A revisão mediu a primeira versão das regras contra frases reais e achou
 * falso negativo em frase clara de pedido de ajuda. As duas listas abaixo
 * são o CONTRATO: nenhuma frase da primeira pode voltar a escapar, nenhuma
 * frase da segunda pode voltar a disparar.
 *
 * Mexeu nas regras? Estas duas listas mandam mais do que a sua intuição.
 * ══════════════════════════════════════════════════════════════════════ */
describe('CONTRATO de crise: as frases da revisão são todas detectadas', () => {
  const CRISE = [
    'quero me matar',
    'vou me matar',
    'nao aguento mais viver',
    'penso em tirar minha vida',
    'não vejo sentido em continuar',
    'vou acabar com tudo hoje',
    'me cortei de novo',
    'queria dormir e não acordar',
    'sou um peso pra todo mundo',
    'suicídio é a única saída',
    'já pensei em me matar várias vezes',
  ];

  for (const frase of CRISE) {
    it(`detecta: "${frase}"`, () => {
      const r = detectarSinalDeCrise(frase);
      expect(r.crise).toBe(true);
      if (r.crise) expect(r.regra).toBeTruthy();
    });
  }
});

describe('CONTRATO de crise: as frases legítimas continuam livres', () => {
  const LEGITIMAS = [
    'morrendo de rir',
    'matar a saudade',
    'vou me matar de trabalhar',
    'matar a fome',
    'acabar com tudo que está pendente',
    'esse curso vai me salvar a vida',
    'morro de vontade de aprender',
    'quero cortar o cabelo',
    'o filme é de morrer de tanto rir',
    'vida longa ao clube',
    'vamos acabar com tudo no sábado',
  ];

  for (const frase of LEGITIMAS) {
    it(`NÃO detecta: "${frase}"`, () => {
      expect(detectarSinalDeCrise(frase).crise).toBe(false);
    });
  }

  // I5 da revisão: o corte de cabelo é o falso positivo mais provável do
  // corpus, porque 'me cortar' é a forma natural de dizer a frase.
  it('marcar corte de cabelo nunca é crise, mesmo na primeira pessoa', () => {
    expect(detectarSinalDeCrise('quero me cortar o cabelo amanhã').crise).toBe(false);
    expect(detectarSinalDeCrise('posso me cortar as pontas aí?').crise).toBe(false);
  });

  // I5 da revisão: fechar a tarefa em grupo é expediente, não crise.
  it('acabar com tudo na primeira pessoa do PLURAL é tarefa, não crise', () => {
    expect(detectarSinalDeCrise('vamos acabar com tudo essa semana').crise).toBe(false);
    expect(detectarSinalDeCrise('vamos acabar com tudo hoje').crise).toBe(false);
  });
});

describe('CONTRATO de crise: o passado conta tanto quanto o presente', () => {
  const PASSADO = [
    'pensei em me matar semana passada',
    'ja pensei em me matar',
    'tentei me matar ano passado',
    'cheguei a pensar em me matar',
    'me machuquei de novo ontem',
    'me feri de propósito',
  ];

  for (const frase of PASSADO) {
    it(`detecta: "${frase}"`, () => {
      expect(detectarSinalDeCrise(frase).crise).toBe(true);
    });
  }
});

/* ══════════════════════════════════════════════════════════════════════
 * I4 da revisão: o transbordo não promete o que o canal não tem.
 *
 * A frase de compliance dizia 'Já avisei, e em instantes alguém continua
 * com você'. No chat do site o visitante pode ser anônimo: não existe
 * conversa, ninguém foi avisado e a promessa é falsa.
 * ══════════════════════════════════════════════════════════════════════ */
describe('compliance: a promessa de aviso depende do canal ter conversa', () => {
  it('com conversa, a mensagem diz que alguém já foi avisado', () => {
    const r = detectBlockedVertical('temos um site adulto com 10k assinantes', {
      ...CLIENTE,
      comTransbordo: true,
    });
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.suggestedResponse).toMatch(/avisei/i);
  });

  it('sem conversa, a mensagem NÃO promete que alguém foi avisado', () => {
    const r = detectBlockedVertical('temos um site adulto com 10k assinantes', {
      ...CLIENTE,
      comTransbordo: false,
    });
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(r.suggestedResponse).not.toMatch(/avisei/i);
      expect(r.suggestedResponse).not.toMatch(/em instantes/i);
      // Continua sendo transbordo e continua sem marca de terceiro.
      expect(r.action).toBe('transbordo');
      expect(findForeignBrandLeaks(r.suggestedResponse)).toEqual([]);
      expect(r.suggestedResponse).toContain('CMJ');
    }
  });

  it('o padrão continua sendo a frase com aviso (canais com conversa)', () => {
    const r = detectBlockedVertical('temos um site adulto com 10k assinantes', CLIENTE);
    expect(r.blocked).toBe(true);
    if (r.blocked) expect(r.suggestedResponse).toMatch(/avisei/i);
  });
});

/* ══════════════════════════════════════════════════════════════════════
 * I6 da revisão: no NOSSO funil, operação declarada é recusa.
 *
 * Quem escreve para a Iza é lead da ZappIQ, não cliente final de ninguém.
 * Passar o lead de uma operação que a casa não atende para uma pessoa da
 * equipe é gastar tempo de venda com quem já está desqualificado. Fora do
 * nosso funil nada muda: quem decide continua sendo o dono da conta.
 * ══════════════════════════════════════════════════════════════════════ */
describe('recusa x transbordo: a org decide', () => {
  it('operação adulta declarada na org da ZappIQ é RECUSA', () => {
    const r = detectBlockedVertical('Tenho um site adulto', ZAPPIQ);
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(r.vertical).toBe('pornografia');
      expect(r.layer).toBe('compliance');
      expect(r.action).toBe('recusa');
      expect(r.suggestedResponse).toContain('ZappIQ');
    }
  });

  it('a mesma frase na org de um cliente é TRANSBORDO, sem nossa marca', () => {
    const r = detectBlockedVertical('Tenho um site adulto', CLIENTE);
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      expect(r.action).toBe('transbordo');
      expect(findForeignBrandLeaks(r.suggestedResponse)).toEqual([]);
    }
  });

  it('apostas e MLM declarados na org da ZappIQ seguem recusa', () => {
    for (const frase of ['tenho casa de apostas', 'trabalho com MLM de suplementos']) {
      const r = detectBlockedVertical(frase, ZAPPIQ);
      expect(r.blocked).toBe(true);
      if (r.blocked) expect(r.action).toBe('recusa');
    }
  });
});

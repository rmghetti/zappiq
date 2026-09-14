/* ══════════════════════════════════════════════════════════════════════
 * promessas.test.ts: varredura das frases que o código não cumpre.
 * ----------------------------------------------------------------------
 * Toda frase desta lista já esteve publicada prometendo uma capacidade que
 * a plataforma não tem. Cada uma foi retirada ou reescrita em 14/09/2026.
 * O teste existe para que nenhuma delas volte por descuido numa próxima
 * peça de copy.
 *
 * Regra de convivência: quando a funcionalidade passar a existir de fato
 * (Word e Excel na ingestão, re-teste gravado no histórico, disparo de
 * lembrete, voz gravada de origem em português), apague a regra
 * correspondente aqui NO MESMO PR que entrega a funcionalidade, com a prova
 * no corpo do PR. Antes disso, não afrouxe a regra: o teste é o que separa
 * promessa de fato.
 *
 * As regras de residência de dados são de natureza diferente: não são
 * funcionalidade que falta, são fato de infraestrutura. Só saem daqui se o
 * banco de produção mudar de região, com a prova da região nova. A frase
 * canônica, a única que descreve o fato, é: "Os dados ficam em servidores nos
 * Estados Unidos (banco de dados e processamento de IA), com salvaguardas
 * contratuais para transferência internacional."
 *
 * O que a varredura lê: no site, as pastas app, components, content e lib; na
 * API, apps/api/src/agents, onde ficam os gabaritos que ditam o que a Iza
 * pode afirmar (uma promessa falsa no gabarito sai pela boca dela, mesmo que
 * o site esteja limpo). Extensões .ts e .tsx. Só as regras de residência leem
 * também os dossiês de reposicionamento em Markdown, porque a frase errada
 * voltou por ali uma vez.
 * O que fica de fora: este arquivo e app/blog (texto editorial de opinião,
 * com contexto próprio, fora do contrato de produto).
 *
 * Cuidado ao editar as expressões: várias palavras da lista aparecem em
 * contexto legítimo (a planilha que o CLIENTE exporta, a pergunta do
 * questionário sobre a política de falta do NEGÓCIO DELE). Por isso as
 * regras exigem a frase inteira, ou a vizinhança que caracteriza a
 * promessa, em vez da palavra solta.
 * ══════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Raiz do monorepo: apps/web/lib -> apps/web -> apps -> raiz. */
const REPO = join(__dirname, '..', '..', '..');
const EXTENSOES = ['.ts', '.tsx'];

/**
 * Raízes varridas, em caminho relativo à raiz do monorepo. A copy do site é a
 * fonte óbvia, mas o gabarito de avaliação da Iza também manda ela afirmar
 * coisas: promessa falsa ali sai na conversa com o cliente do mesmo jeito.
 */
const PASTAS = [
  'apps/web/app',
  'apps/web/components',
  'apps/web/content',
  'apps/web/lib',
  'apps/api/src/agents',
];

/**
 * Dossiês do reposicionamento lidos pelas regras de residência de dados, em
 * caminho relativo à raiz do monorepo.
 *
 * Por que uma lista de arquivos e não a pasta inteira: em 14/09/2026 a pasta
 * `docs/reposicionamento-landing-2026` tem 92 linhas com alguma redação de
 * "dados no Brasil", e boa parte delas é referência legítima ao próprio claim
 * ("claims de fato com risco jurídico: Meta Business Partner, dados no
 * Brasil, SLA"), ou o registro de uma auditoria citando o que a copy dizia.
 * Varrer a pasta inteira reprovaria esse texto sem motivo. A lista cobre os
 * três dossiês que descreviam a residência como fato e foram corrigidos; as
 * outras 20 peças da pasta continuam pendentes, registradas no corpo do PR.
 */
const DOSSIES = [
  'docs/reposicionamento-landing-2026/README.md',
  'docs/reposicionamento-landing-2026/produtos/09-treinar-ia.md',
  'docs/reposicionamento-landing-2026/produtos/10-qualidade-ia.md',
];

/** Caminhos (relativos à raiz do monorepo) que a varredura não lê. */
const FORA_DA_VARREDURA = [
  'apps/web/lib/promessas.test.ts',
  'apps/web/app/blog',
  'node_modules',
  '.next',
  '.turbo',
];

interface Regra {
  /** Nome curto, vira o nome do teste. */
  nome: string;
  /** O que o código faz de verdade, para quem for reintroduzir a frase. */
  motivo: string;
  padrao: RegExp;
  /**
   * Prefixos de caminho onde a regra vale, quando ela NÃO vale nas duas
   * raízes. Só uma regra precisa disso hoje: o nome do fornecedor de voz é
   * proibido na copy e obrigatório no gabarito, que é justamente onde mora a
   * expressão que reprova a Iza por dizê-lo.
   */
  apenasEm?: string[];
  /**
   * Prefixos de caminho onde a regra NÃO vale. Mesmo mecanismo do `apenasEm`,
   * no sentido contrário: hoje só a página de subprocessadores precisa, porque
   * o histórico dela registra, de propósito, a frase errada que saiu do ar.
   */
  exceto?: string[];
  /**
   * A regra também lê os dossiês de `DOSSIES`. Vale só para residência de
   * dados: as demais regras falam de funcionalidade que falta, e os dossiês
   * são justamente o material que descreve o que ainda não existe.
   */
  tambemNosDossies?: boolean;
}

const REGRAS: Regra[] = [
  {
    nome: 'residência de dados: "território nacional"',
    motivo:
      'Os dados ficam em servidores nos Estados Unidos: o banco e o processamento de IA. Não existe residência em território nacional.',
    padrao: /territ[óo]rio nacional/i,
    tambemNosDossies: true,
  },
  {
    nome: 'residência de dados: banco no Brasil',
    motivo:
      'O banco de dados de produção é o projeto Supabase hwdeezdxyphvxikvgjyf, região us-east-1, Estados Unidos. Dizer que ele fica no Brasil é erro de fato, não imprecisão de copy.',
    padrao: /banco (de dados )?(fica|hospedado|no) Brasil/i,
    tambemNosDossies: true,
  },
  {
    nome: 'residência de dados: dados primários no Brasil',
    motivo:
      'Não há dado primário no Brasil: banco e processamento de IA rodam nos Estados Unidos, com salvaguardas contratuais para a transferência internacional. A regra ignora "proteção de dados no Brasil", que fala da LEI brasileira e da ANPD, não de onde os dados moram.',
    padrao: /(?<!prote[çc][ãa]o de )dados (prim[áa]rios )?no Brasil/i,
    tambemNosDossies: true,
  },
  {
    nome: 'residência de dados: servidores no Brasil',
    motivo:
      'Mesma correção, pela terceira redação que a copy usava: selo de rodapé e faixa do pré-lançamento diziam "servidores 100% no Brasil". A API roda em gru, mas ela não guarda dado; quem guarda é o banco, que está em us-east-1.',
    padrao: /servidor(es)?[^\n]{0,20}no Brasil|100% no Brasil/i,
    tambemNosDossies: true,
  },
  {
    nome: 'residência de dados: dado que "fica no Brasil" em qualquer redação',
    motivo:
      'As três regras anteriores exigiam a palavra exata que a copy usava naquele dia, e três páginas escaparam: "dados residentes no Brasil" (/sobre), "seus dados processados no Brasil" (prova social da home) e "Seus dados, no Brasil. Ponto." (card 06 da home). Esta regra pega a ideia, não a redação. A frase certa é: os dados ficam em servidores nos Estados Unidos (banco de dados e processamento de IA), com salvaguardas contratuais para transferência internacional. Ignora "proteção de dados no Brasil", que fala da LEI brasileira e da ANPD.',
    padrao:
      /(?<!prote[çc][ãa]o de )dados[^\n]{0,25}(residentes|processados|armazenados)?[^\n]{0,10}\bno Brasil\b/i,
    // O histórico da página de subprocessadores registra, de propósito, a frase
    // errada que saiu do ar em 14/09/2026. Apagar de lá seria apagar a correção.
    exceto: ['apps/web/app/legal/subprocessadores'],
    tambemNosDossies: true,
  },
  {
    nome: 'residência de dados: infraestrutura ou servidor "brasileiro"',
    motivo:
      'Nenhum servidor que guarda dado do cliente é brasileiro. O banco de produção é o projeto Supabase da região us-east-1 e o processamento de IA também roda nos Estados Unidos. A API tem uma máquina em gru, mas ela não guarda dado. A regra pega o adjetivo, que passava por baixo das regras escritas com "no Brasil".',
    padrao: /infraestrutura brasileira|servidor(es)? brasileir/i,
    tambemNosDossies: true,
  },
  {
    nome: '"se corrige sozinha"',
    motivo:
      'A Qualidade da IA sugere a correção e espera o clique de aprovar. Nada é aplicado sem uma pessoa decidir.',
    padrao: /se corrige sozinha/i,
  },
  {
    nome: '"sem alucinação"',
    motivo:
      'Não existe garantia de ausência de alucinação. A busca na base reduz o risco, não o elimina.',
    padrao: /sem alucina[çc][ãa]o/i,
  },
  {
    nome: 'formato DOCX na ingestão',
    motivo:
      'O serviço de ingestão extrai texto de PDF e de text/*. Word responde 415 e o cliente vê erro genérico. A regra vale em qualquer caixa, porque no accept do input a extensão vem em minúscula.',
    padrao: /\bDOCX\b/i,
  },
  {
    nome: 'planilha como formato aceito (perto de PDF)',
    motivo:
      'Excel e CSV de planilha não são extraídos na ingestão. Vale para a lista de formatos, não para a planilha que o cliente exporta do CRM.',
    padrao: /PDFs?[^\n]{0,80}planilhas?|planilhas?[^\n]{0,80}PDFs?/i,
  },
  {
    nome: '"boa parte da nota vem" do conteúdo cadastrado',
    motivo:
      'A nota da Qualidade roda cenários iguais para todos os clientes e mede comportamento, não o conteúdo que o cliente cadastrou.',
    padrao: /boa parte da nota vem/i,
  },
  {
    nome: '"fiel ao que o cliente veria" no playground',
    motivo:
      'O playground usa a mesma montagem de instruções, mas a memória da conversa é só a daquela tela.',
    padrao: /fiel ao que o cliente veria/i,
  },
  {
    nome: '"tudo fica salvo automaticamente" no cadastro',
    motivo:
      'O questionário do /onboarding só envia no POST final. Fechar a aba antes disso perde as respostas.',
    padrao: /tudo fica salvo automaticamente/i,
  },
  {
    nome: '"acaba de ficar pronta"',
    motivo:
      'O placar de prontidão mede formulário preenchido. Nenhum teste foi executado para dizer que a IA está pronta.',
    padrao: /acaba de ficar pronta/i,
  },
  {
    nome: '"voz treinada nativamente"',
    motivo:
      'O provedor de voz primário nunca respondeu: todo áudio sai pelo fallback, com voz adaptada do inglês.',
    padrao: /treinada nativamente/i,
  },
  {
    nome: 'agenda que "confirma, lembra" ou remarca',
    motivo:
      'O agendamento tem duas ferramentas: consultar horário e criar o compromisso. Não confirma, não lembra e não remarca.',
    padrao: /confirma,? e lembra|confirma, lembra|lembra e remarca/i,
  },
  {
    nome: 'nome do fornecedor de voz na copy',
    motivo:
      'O gabarito da Iza reprova citar o fornecedor de síntese de voz, e a copy pública citava o modelo dele por extenso no selo de /voz, no card da home e no FAQ. A página legal de subprocessadores cita as EMPRESAS, que é obrigação de LGPD; o nome do modelo não serve para nada além de entregar o fornecedor.',
    padrao: /neural2|wavenet/i,
    apenasEm: ['apps/web'],
  },
  {
    nome: 'lembrete automático de vencimento, de aula, de evento ou de retorno',
    motivo:
      'O agendamento tem duas ferramentas, consultar o horário livre e criar o compromisso, e nenhuma delas avisa o cliente depois. Disparo por prazo só existe como nó do Maestro, dentro de um fluxo que alguém da equipe monta e liga: não vem pronto, não é do agendamento e a IA não decide mandar sozinha. Enquanto for assim, a copy não pode dizer que a IA envia lembrete.',
    padrao:
      /lembretes? (autom[áa]ticos?|de vencimento|de aulas|de retorno)|enviar lembretes?|[áa]udio 24h antes/i,
  },
  {
    nome: 'resultado numérico de no-show atribuído ao produto',
    motivo:
      'Não existe lembrete nem confirmação automática, e a base nunca registrou um agendamento. Vale para a promessa com número, não para a pergunta do questionário sobre a política de falta do negócio do cliente.',
    padrao:
      /redu[zç]\w*[^\n]{0,40}no-?shows?|\bmenos\b[^\n]{0,20}no-?shows?|no-?shows?[^\n]{0,30}(reduzid|caiu|cai\b|despenc)|-\s?\d+\s?%\s*(de\s+)?no-?shows?/i,
  },
];

/* ------------------------------------------------------------------ */

function foraDaVarredura(rel: string): boolean {
  const normalizado = rel.split(sep).join('/');
  return FORA_DA_VARREDURA.some(
    (p) => normalizado === p || normalizado.startsWith(`${p}/`),
  );
}

function listarArquivos(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const caminho = join(dir, entrada);
    const rel = relative(REPO, caminho);
    if (foraDaVarredura(rel)) continue;
    if (statSync(caminho).isDirectory()) {
      listarArquivos(caminho, acc);
      continue;
    }
    if (EXTENSOES.some((ext) => entrada.endsWith(ext))) acc.push(caminho);
  }
  return acc;
}

const ARQUIVOS = PASTAS.flatMap((p) => listarArquivos(join(REPO, p)));
const ARQUIVOS_DOSSIES = DOSSIES.map((d) => join(REPO, ...d.split('/')));

/** Cache de leitura: são centenas de arquivos e dezoito regras. */
const CONTEUDO = new Map<string, string[]>(
  ARQUIVOS.map((a) => [a, readFileSync(a, 'utf8').split('\n')]),
);
const CONTEUDO_DOSSIES = new Map<string, string[]>(
  ARQUIVOS_DOSSIES.map((a) => [a, readFileSync(a, 'utf8').split('\n')]),
);

function ocorrencias(regra: Regra): string[] {
  const achados: string[] = [];
  const fontes = regra.tambemNosDossies
    ? [...CONTEUDO, ...CONTEUDO_DOSSIES]
    : [...CONTEUDO];
  for (const [caminho, linhas] of fontes) {
    const rel = relative(REPO, caminho).split(sep).join('/');
    if (regra.apenasEm && !regra.apenasEm.some((p) => rel.startsWith(p))) continue;
    if (regra.exceto?.some((p) => rel === p || rel.startsWith(`${p}/`))) continue;
    linhas.forEach((linha, i) => {
      if (regra.padrao.test(linha)) {
        achados.push(`${rel}:${i + 1}  ${linha.trim().slice(0, 160)}`);
      }
    });
  }
  return achados;
}

describe('promessas que o código não cumpre', () => {
  it('a varredura enxerga a árvore de arquivos das duas raízes', () => {
    // Rede de segurança: se um refactor mudar a estrutura de pastas, o teste
    // passaria vazio e deixaria de proteger qualquer coisa.
    expect(ARQUIVOS.length).toBeGreaterThan(200);
    expect(
      ARQUIVOS.some((a) => a.endsWith(join('apps', 'web', 'components', 'landing', 'Hero.tsx'))),
    ).toBe(true);
    expect(
      ARQUIVOS.some((a) => a.endsWith(join('apps', 'api', 'src', 'agents', 'evalSetZappIQ.ts'))),
    ).toBe(true);
  });

  it('nenhum arquivo de app/blog entra na varredura', () => {
    expect(
      ARQUIVOS.filter((a) => relative(REPO, a).startsWith(join('apps', 'web', 'app', 'blog'))),
    ).toEqual([]);
  });

  it('os dossiês de reposicionamento entram na varredura de residência', () => {
    // Sem isto, renomear um dossiê esvaziaria a varredura em silêncio: foi por
    // um desses arquivos que a frase errada voltou depois de corrigida no site.
    expect(CONTEUDO_DOSSIES.size).toBe(DOSSIES.length);
    for (const linhas of CONTEUDO_DOSSIES.values()) {
      expect(linhas.length).toBeGreaterThan(20);
    }
    expect(REGRAS.filter((r) => r.tambemNosDossies).length).toBe(6);
  });

  for (const regra of REGRAS) {
    it(`não reintroduz: ${regra.nome}`, () => {
      const achados = ocorrencias(regra);
      expect(
        achados,
        `${achados.length} ocorrência(s). ${regra.motivo}\n  ${achados.join('\n  ')}`,
      ).toEqual([]);
    });
  }
});

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
 * As três regras de residência de dados são de natureza diferente: não são
 * funcionalidade que falta, são fato de infraestrutura. Só saem daqui se o
 * banco de produção mudar de região, com a prova da região nova.
 *
 * O que a varredura lê: no site, as pastas app, components, content e lib; na
 * API, apps/api/src/agents, onde ficam os gabaritos que ditam o que a Iza
 * pode afirmar (uma promessa falsa no gabarito sai pela boca dela, mesmo que
 * o site esteja limpo). Extensões .ts e .tsx.
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
}

const REGRAS: Regra[] = [
  {
    nome: 'residência de dados: "território nacional"',
    motivo:
      'Os dados ficam em servidores nos Estados Unidos: o banco e o processamento de IA. Não existe residência em território nacional.',
    padrao: /territ[óo]rio nacional/i,
  },
  {
    nome: 'residência de dados: banco no Brasil',
    motivo:
      'O banco de dados de produção é o projeto Supabase hwdeezdxyphvxikvgjyf, região us-east-1, Estados Unidos. Dizer que ele fica no Brasil é erro de fato, não imprecisão de copy.',
    padrao: /banco (de dados )?(fica|hospedado|no) Brasil/i,
  },
  {
    nome: 'residência de dados: dados primários no Brasil',
    motivo:
      'Não há dado primário no Brasil: banco e processamento de IA rodam nos Estados Unidos, com salvaguardas contratuais para a transferência internacional. A regra ignora "proteção de dados no Brasil", que fala da LEI brasileira e da ANPD, não de onde os dados moram.',
    padrao: /(?<!prote[çc][ãa]o de )dados (prim[áa]rios )?no Brasil/i,
  },
  {
    nome: 'residência de dados: servidores no Brasil',
    motivo:
      'Mesma correção, pela terceira redação que a copy usava: selo de rodapé e faixa do pré-lançamento diziam "servidores 100% no Brasil". A API roda em gru, mas ela não guarda dado; quem guarda é o banco, que está em us-east-1.',
    padrao: /servidor(es)?[^\n]{0,20}no Brasil|100% no Brasil/i,
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
    nome: 'lembrete automático de vencimento, de aula ou de evento',
    motivo:
      'Não existe disparo programado de lembrete em lugar nenhum do produto. O agendamento consulta o horário livre e cria o compromisso; avisar o cliente antes continua sendo trabalho da equipe.',
    padrao: /lembretes? (autom[áa]ticos?|de vencimento|de aulas)|[áa]udio 24h antes/i,
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

/** Cache de leitura: são centenas de arquivos e doze regras. */
const CONTEUDO = new Map<string, string[]>(
  ARQUIVOS.map((a) => [a, readFileSync(a, 'utf8').split('\n')]),
);

function ocorrencias(padrao: RegExp): string[] {
  const achados: string[] = [];
  for (const [caminho, linhas] of CONTEUDO) {
    linhas.forEach((linha, i) => {
      if (padrao.test(linha)) {
        achados.push(
          `${relative(REPO, caminho).split(sep).join('/')}:${i + 1}  ${linha.trim().slice(0, 160)}`,
        );
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

  for (const regra of REGRAS) {
    it(`não reintroduz: ${regra.nome}`, () => {
      const achados = ocorrencias(regra.padrao);
      expect(
        achados,
        `${achados.length} ocorrência(s). ${regra.motivo}\n  ${achados.join('\n  ')}`,
      ).toEqual([]);
    });
  }
});

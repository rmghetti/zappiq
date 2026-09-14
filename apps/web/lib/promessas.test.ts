/* ══════════════════════════════════════════════════════════════════════
 * promessas.test.ts: varredura das frases que o código não cumpre.
 * ----------------------------------------------------------------------
 * Toda frase desta lista já esteve publicada prometendo uma capacidade que
 * a plataforma não tem. Cada uma foi retirada ou reescrita em 14/09/2026.
 * O teste existe para que nenhuma delas volte por descuido numa próxima
 * peça de copy.
 *
 * Regra de convivência: quando a funcionalidade passar a existir de fato
 * (Word e Excel na ingestão, re-teste gravado no histórico, lembrete de
 * agendamento, voz pelo Google), apague a regra correspondente aqui NO
 * MESMO PR que entrega a funcionalidade, com a prova no corpo do PR. Antes
 * disso, não afrouxe a regra: o teste é o que separa promessa de fato.
 *
 * O que a varredura lê: app, components, content e lib (.ts e .tsx).
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

const WEB = join(__dirname, '..');
const PASTAS = ['app', 'components', 'content', 'lib'];
const EXTENSOES = ['.ts', '.tsx'];

/** Caminhos (relativos a apps/web) que a varredura não lê. */
const FORA_DA_VARREDURA = [
  'lib/promessas.test.ts',
  'app/blog',
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
      'O banco fica no Brasil, mas todo embedding e toda resposta do agente são processados por provedores de IA nos Estados Unidos. Os dados saem do país.',
    padrao: /territ[óo]rio nacional/i,
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
      'O serviço de ingestão extrai texto de PDF e de text/*. Word responde 415 e o cliente vê erro genérico.',
    padrao: /DOCX/,
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
    const rel = relative(WEB, caminho);
    if (foraDaVarredura(rel)) continue;
    if (statSync(caminho).isDirectory()) {
      listarArquivos(caminho, acc);
      continue;
    }
    if (EXTENSOES.some((ext) => entrada.endsWith(ext))) acc.push(caminho);
  }
  return acc;
}

const ARQUIVOS = PASTAS.flatMap((p) => listarArquivos(join(WEB, p)));

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
          `${relative(WEB, caminho).split(sep).join('/')}:${i + 1}  ${linha.trim().slice(0, 160)}`,
        );
      }
    });
  }
  return achados;
}

describe('promessas que o código não cumpre', () => {
  it('a varredura enxerga a árvore de arquivos', () => {
    // Rede de segurança: se um refactor mudar a estrutura de pastas, o teste
    // passaria vazio e deixaria de proteger qualquer coisa.
    expect(ARQUIVOS.length).toBeGreaterThan(200);
    expect(
      ARQUIVOS.some((a) => a.endsWith(join('components', 'landing', 'Hero.tsx'))),
    ).toBe(true);
  });

  it('nenhum arquivo de app/blog entra na varredura', () => {
    expect(ARQUIVOS.filter((a) => relative(WEB, a).startsWith(join('app', 'blog')))).toEqual([]);
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

/**
 * knowledgeBaseBuilder — fonte única de verdade pra transformar as respostas
 * do survey de qualificação num documento textual ingerível pelo RAG.
 *
 * Antes vivia inline em routes/onboarding.ts (só rodava no cadastro inicial).
 * Extraído aqui em 2026-05-20 pra ser reusado pelo endpoint de edição de
 * survey (/api/ai-training/survey), garantindo que QUALQUER atualização do
 * questionário re-alimente a base de conhecimento do agente — não só o
 * preenchimento original.
 */

export interface SurveyKnowledgeInput {
  businessName: string;
  niche: string;
  surveyAnswers: Record<string, any>;
}

/**
 * Monta o documento de conhecimento a partir das respostas do survey.
 * Suporta respostas em 2 formatos:
 *   - aninhado por seção: { "Identidade": { "Nome fantasia": "X" }, ... }
 *   - chave-valor direto: { "horario": "08-18h" }
 */
export function buildKnowledgeBase({ businessName, niche, surveyAnswers }: SurveyKnowledgeInput): string {
  const lines: string[] = [];
  lines.push(`=== BASE DE CONHECIMENTO — ${businessName.toUpperCase()} ===`);
  lines.push(`Segmento: ${niche}`);
  lines.push('');
  lines.push('--- INFORMAÇÕES DO NEGÓCIO (questionário de qualificação) ---');
  lines.push('');

  for (const [key, value] of Object.entries(surveyAnswers || {})) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`## ${key}`);
      for (const [question, answer] of Object.entries(value as Record<string, any>)) {
        if (answer && String(answer).trim()) {
          lines.push(`**${question}:** ${answer}`);
        }
      }
      lines.push('');
    } else if (Array.isArray(value) && value.length > 0) {
      lines.push(`**${key}:** ${value.filter(Boolean).join(', ')}`);
    } else if (value && String(value).trim()) {
      lines.push(`**${key}:** ${value}`);
    }
  }

  lines.push('');
  lines.push('--- FIM DA BASE DE CONHECIMENTO ---');
  return lines.join('\n');
}

/** Filename estável do doc de survey no RAG — re-ingerir com o mesmo nome
 *  substitui a versão anterior (evita duplicata na base vetorial). */
export function surveyDocFilename(niche: string): string {
  return `onboarding-survey-${niche || 'geral'}.txt`;
}

/** Conta quantas respostas foram efetivamente preenchidas (não-vazias),
 *  achatando seções aninhadas. Usado pra readiness + UI de faltantes. */
export function countAnsweredQuestions(surveyAnswers: Record<string, any>): number {
  let n = 0;
  for (const value of Object.values(surveyAnswers || {})) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const answer of Object.values(value as Record<string, any>)) {
        if (answer && String(answer).trim()) n++;
      }
    } else if (Array.isArray(value)) {
      if (value.filter(Boolean).length > 0) n++;
    } else if (value && String(value).trim()) {
      n++;
    }
  }
  return n;
}

/**
 * O catálogo de perguntas do questionário mudou de casa em 14/09/2026.
 *
 * Ele agora vive em packages/shared/src/surveyTypes.ts porque a API também
 * precisa dele: sem o texto da pergunta, o documento que alimenta a base de
 * conhecimento saía com a chave de código no lugar do que foi perguntado
 * ("pre_tabela_precos:" em vez de "Se aplicável, informe a tabela de preços
 * principal"). Duplicar o catálogo nos dois lados seria pior: a tela e a IA
 * passariam a divergir na primeira edição.
 *
 * Este arquivo continua existindo só para as telas que já importavam daqui.
 */
export type { SurveyQuestion, SurveyBlock, SubSegment, Segment } from '@zappiq/shared';
export { GLOBAL_SURVEY_BLOCKS } from '@zappiq/shared';

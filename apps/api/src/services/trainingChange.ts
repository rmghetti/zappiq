/** Campos de "treino/identidade" cuja mudança deve marcar os fluxos como desatualizados (Maestro reativo). */
export const TRAINING_FIELDS = [
  'niche', 'businessName', 'tone', 'agentName', 'businessHours', 'businessHoursConfig',
  'segmento', 'subsegmentos', 'surveyAnswers', 'greetingMessage', 'handoffMessage',
] as const;

/** true se algum campo de treino/identidade mudou entre as settings antigas e novas. */
export function trainingFieldsChanged(
  oldSettings: Record<string, any> | null | undefined,
  newSettings: Record<string, any> | null | undefined,
): boolean {
  const a = oldSettings || {};
  const b = newSettings || {};
  for (const k of TRAINING_FIELDS) {
    if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) return true;
  }
  return false;
}

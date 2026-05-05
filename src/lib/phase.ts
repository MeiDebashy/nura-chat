// Mirrored from nura-emotional-core/src/llm/personality.ts
// PHASE_PERSONALITIES — keep these labels in sync with the backend.
export const PHASE_LABELS: Record<number, string> = {
  0: "Stranger",
  1: "Acquaintance",
  2: "Friendly",
  3: "Close friend",
  4: "Devoted",
};

export function phaseLabel(phase: number | undefined): string | null {
  if (phase === undefined || phase === null) return null;
  return PHASE_LABELS[phase] ?? `Phase ${phase}`;
}

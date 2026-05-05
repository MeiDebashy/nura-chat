// Deterministic gradient pair from a string id.
const PALETTE: Array<[string, string]> = [
  ["#06b6d4", "#0891b2"],
  ["#8b5cf6", "#6366f1"],
  ["#ec4899", "#db2777"],
  ["#f59e0b", "#d97706"],
  ["#10b981", "#059669"],
  ["#3b82f6", "#2563eb"],
  ["#f43f5e", "#e11d48"],
  ["#14b8a6", "#0d9488"],
];

export function gradientFor(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function initialsFromTitle(title: string): string {
  const cleaned = title.trim();
  if (!cleaned) return "•";
  return cleaned.charAt(0).toUpperCase();
}

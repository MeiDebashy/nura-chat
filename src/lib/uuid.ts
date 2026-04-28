// Safe UUID v4 generator: prefers crypto.randomUUID (secure contexts only),
// falls back to crypto.getRandomValues, then Math.random as a last resort.
export function uuid(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;

  if (c && typeof c.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      // fall through
    }
  }

  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
      .slice(6, 8)
      .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  let s = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      s += "-";
      continue;
    }
    if (i === 14) {
      s += "4";
      continue;
    }
    const r = (Math.random() * 16) | 0;
    const v = i === 19 ? (r & 0x3) | 0x8 : r;
    s += v.toString(16);
  }
  return s;
}

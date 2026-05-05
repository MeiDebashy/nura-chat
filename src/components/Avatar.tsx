import { gradientFor, initialsFromTitle } from "../lib/avatar";

interface Props {
  id: string;
  title?: string;
  size?: number;
  ring?: boolean;
}

export function Avatar({ id, title = "", size = 36, ring = false }: Props) {
  const [from, to] = gradientFor(id);
  const initial = initialsFromTitle(title);
  return (
    <div
      className={`relative shrink-0 rounded-full flex items-center justify-center text-white font-medium ${
        ring ? "ring-2 ring-cyan-400/40" : ""
      }`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        fontSize: Math.max(11, Math.round(size * 0.42)),
        boxShadow: "0 0 8px rgba(0,0,0,0.25)",
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

export function NuraBrandAvatar({ size = 32 }: { size?: number }) {
  return (
    <div
      className="relative shrink-0 rounded-full flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 30% 30%, rgba(34,211,238,0.9), rgba(8,145,178,0.5) 60%, rgba(8,47,73,0.6))",
        boxShadow: "0 0 10px rgba(34,211,238,0.35)",
      }}
      aria-hidden="true"
    >
      <span
        className="block rounded-full bg-cyan-200/90"
        style={{ width: size * 0.28, height: size * 0.28 }}
      />
    </div>
  );
}

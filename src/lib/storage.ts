import type { Message, Conversation } from "./types";

export const STORAGE_KEY = "nura-conversations-v1";
export const NAME_KEY = "nura-display-name";
export const TONE_KEY = "nura-tone";
export const MEMBER_KEY = "nura-member-since";
export const USER_ID_KEY = "nura-user-id";

const VALID_SENDERS = new Set(["user", "nura"]);

function isMessage(v: unknown): v is Message {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.text === "string" &&
    typeof m.sender === "string" &&
    VALID_SENDERS.has(m.sender) &&
    typeof m.timestamp === "number" &&
    Number.isFinite(m.timestamp)
  );
}

function isConversation(v: unknown): v is Conversation {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    Array.isArray(c.messages) &&
    c.messages.every(isMessage) &&
    typeof c.createdAt === "number" &&
    typeof c.updatedAt === "number"
  );
}

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isConversation);
  } catch {
    return [];
  }
}

export function saveConversations(convs: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch {
    // quota exceeded or serialization error — ignore
  }
}

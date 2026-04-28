export type Sender = "user" | "nura";

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// Wire protocol mirrored from nura-emotional-core/src/server/index.ts
export type ServerMsg =
  | { type: "typing"; userId?: string }
  | {
      type: "segment";
      userId?: string;
      text: string;
      index: number;
      total: number;
    }
  | {
      type: "done";
      userId?: string;
      state?: unknown;
      crisis?: boolean;
    }
  | { type: "fragment_received"; userId?: string; pending?: number }
  | { type: "error"; message?: string };

export interface ChatRequest {
  message: string;
  userId: string;
  timestamp: string;
}

export interface ChatResponse {
  segments: Array<string | { text: string; delay_ms?: number }>;
  state?: unknown;
  crisis?: boolean;
}

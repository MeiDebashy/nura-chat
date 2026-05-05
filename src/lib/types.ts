export type Sender = "user" | "nura";

export type DeliveryStatus = "sending" | "sent" | "failed";

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: number;
  status?: DeliveryStatus;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  unread?: number;
  lastReadAt?: number;
  crisis?: boolean;
  // Last `phase.current_phase` reported by the backend's `done` envelope.
  // 0 = Stranger … 4 = Devoted. See nura-emotional-core PHASE_PERSONALITIES.
  phase?: number;
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

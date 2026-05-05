export type Sender = "user" | "nura";

export type DeliveryStatus = "sending" | "sent" | "failed";

export type CrisisSeverity = "none" | "concern" | "urgent" | "emergency";
export type CrisisType = "self_harm" | "suicide" | "abuse" | "crisis";

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

  // ── State surfaced from backend `done.state` and `done.crisis_*` ───────
  // Sticky on the conversation; cleared/updated on each `done`.

  // 0 = Stranger … 4 = Devoted. See PHASE_PERSONALITIES.
  phase?: number;
  // 7-day phase cooldown after de-escalation. Frontend should not show
  // phase progression while this is active.
  cooldownActive?: boolean;
  cooldownReason?: string | null;
  cooldownExpiresAt?: string | null; // ISO
  // Elasticity floor reached → backend forces minimal expression.
  // Frontend should signal "needs space" rather than presenting Nura as
  // fully present.
  softPresence?: boolean;

  // Crisis (Blueprint safety layer)
  crisis?: boolean;
  crisisSeverity?: CrisisSeverity;
  crisisType?: CrisisType | null;

  // Blueprint #1 love-phase consent flow.
  // Set when backend initiates the consent prompt; cleared once granted
  // or declined. `eligibleAt` is the 24-hour reflection deadline.
  loveConsent?: {
    promptedAt: string; // ISO
    eligibleAt: string; // ISO; user can grant only after this time
  } | null;
  loveConsentGranted?: boolean;
  loveConsentDeclinedAt?: string | null;
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
      crisis_severity?: CrisisSeverity;
      crisis_type?: CrisisType | null;
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

import { useCallback, useEffect, useRef, useState } from "react";
import type { CrisisSeverity, CrisisType, ServerMsg } from "./types";

/**
 * Wire contract — mirrors nura-emotional-core/src/server/index.ts
 *
 *   Client → Server (WS):
 *     { type: "chat", userId, message, timestamp }
 *
 *   Server → Client (WS):
 *     { type: "fragment_received", userId, pending }
 *     { type: "typing", userId }
 *     { type: "segment", userId, text, index, total }
 *     { type: "done", userId, state, crisis }
 *     { type: "error", message }
 *
 *   REST  POST /api/chat → { segments: [{ text, delay_ms }], state, crisis }
 *
 *   Note: backend ignores `displayName` and `tone` (the user-facing tone
 *   selector is cosmetic; Nura's tone is derived from the relationship
 *   phase in PHASE_PERSONALITIES).
 *
 *   The frontend sends a composite userId of the form `${baseUserId}:${conversationId}`
 *   so each conversation gets its own NuraLLM session + state on the server.
 */

/**
 * Subset of nura-emotional-core's `UserState` that the frontend reads.
 * Mirrors PhaseState + ElasticityState; everything else is currently
 * ignored (kept on the wire so future UI can pick it up without protocol
 * changes).
 */
export interface BackendState {
  phase?: {
    current_phase?: number;
    cooldown_active?: boolean;
    cooldown_expires_at?: string | null;
    cooldown_reason?: string | null;
    love_phase_consent_granted?: boolean;
    love_phase_consent_prompt_timestamp?: string | null;
    love_phase_consent_eligible_at?: string | null;
    love_phase_consent_declined_timestamp?: string | null;
  };
  elasticity?: {
    soft_presence_mode_active?: boolean;
  };
}

export interface DoneInfo {
  crisis: boolean;
  crisisSeverity?: CrisisSeverity;
  crisisType?: CrisisType | null;
  state?: BackendState;
}

export interface ChatSocketEvents {
  onTyping(targetUserId: string): void;
  onFragmentReceived(targetUserId: string, pending: number): void;
  onSegment(
    targetUserId: string,
    text: string,
    index: number,
    total: number
  ): void;
  onDone(targetUserId: string, info: DoneInfo): void;
  onError(targetUserId: string | null, message: string): void;
}

export interface SendPayload {
  userId: string; // composite: base:conversationId
  message: string;
  timestamp?: string;
}

export interface ChatSocketHandle {
  isConnected: boolean;
  send(payload: SendPayload): "ws" | "rest";
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
// REST fallback delay clamps — server's segmenter caps base delay to ~1.2s
// already, but bound here defensively so the UI never feels stuck.
const REST_MIN_DELAY_MS = 0;
const REST_MAX_DELAY_MS = 3000;

export function useChatSocket(
  apiUrl: string,
  events: ChatSocketEvents
): ChatSocketHandle {
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const eventsRef = useRef(events);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const reconnectAttempts = useRef(0);
  const isUnmountingRef = useRef(false);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const wsUrl = apiUrl.replace(/^http/, "ws") + "/ws";

  const scheduleReconnect = useRef<() => void>(() => {});
  const connect = useCallback(() => {
    if (isUnmountingRef.current) return;
    const existing = wsRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error("[nura] WebSocket construction failed:", err);
      scheduleReconnect.current();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0;
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      let data: ServerMsg;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      const e = eventsRef.current;
      const targetUserId = (data as { userId?: string }).userId ?? null;

      if (data.type === "typing") {
        if (targetUserId) e.onTyping(targetUserId);
      } else if (data.type === "fragment_received") {
        if (targetUserId) {
          e.onFragmentReceived(targetUserId, data.pending ?? 0);
        }
      } else if (data.type === "segment" && typeof data.text === "string") {
        if (targetUserId) {
          e.onSegment(
            targetUserId,
            data.text,
            data.index ?? 0,
            data.total ?? 1
          );
        }
      } else if (data.type === "done") {
        if (targetUserId) {
          e.onDone(targetUserId, {
            crisis: Boolean(data.crisis),
            crisisSeverity: data.crisis_severity,
            crisisType: data.crisis_type ?? null,
            state: (data.state ?? undefined) as BackendState | undefined,
          });
        }
      } else if (data.type === "error") {
        e.onError(targetUserId, data.message ?? "Server error");
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      scheduleReconnect.current();
    };

    ws.onerror = () => {
      // onclose follows; let it handle reconnect.
    };
  }, [wsUrl]);

  scheduleReconnect.current = () => {
    if (isUnmountingRef.current) return;
    clearTimeout(reconnectTimer.current);
    const attempt = ++reconnectAttempts.current;
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** Math.min(attempt - 1, 6)
    );
    const jitter = Math.random() * 250;
    reconnectTimer.current = setTimeout(connect, delay + jitter);
  };

  useEffect(() => {
    isUnmountingRef.current = false;
    connect();
    return () => {
      isUnmountingRef.current = true;
      clearTimeout(reconnectTimer.current);
      const ws = wsRef.current;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
    };
  }, [connect]);

  const send = useCallback(
    (payload: SendPayload): "ws" | "rest" => {
      const wire = {
        type: "chat" as const,
        userId: payload.userId,
        message: payload.message,
        timestamp: payload.timestamp ?? new Date().toISOString(),
      };

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(wire));
          return "ws";
        } catch (err) {
          console.error("[nura] WS send failed, falling back to REST:", err);
        }
      }

      // REST fallback — emulate WS pacing using the server's `delay_ms`.
      void runRestFallback(apiUrl, wire, eventsRef.current);
      return "rest";
    },
    [apiUrl]
  );

  return { isConnected, send };
}

async function runRestFallback(
  apiUrl: string,
  wire: { userId: string; message: string; timestamp: string },
  events: ChatSocketEvents
): Promise<void> {
  try {
    events.onTyping(wire.userId);
    const res = await fetch(`${apiUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wire),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: {
      segments?: Array<string | { text: string; delay_ms?: number }>;
      state?: BackendState;
      crisis?: boolean;
      crisis_severity?: CrisisSeverity;
      crisis_type?: CrisisType | null;
    } = await res.json();

    const segs = Array.isArray(data?.segments) ? data.segments : [];
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const text = typeof seg === "string" ? seg : seg.text;
      const delay =
        typeof seg === "string" ? 0 : Math.max(0, seg.delay_ms ?? 0);
      if (i > 0) {
        const clamped = Math.min(
          REST_MAX_DELAY_MS,
          Math.max(REST_MIN_DELAY_MS, delay)
        );
        if (clamped > 0) await sleep(clamped);
      }
      events.onSegment(wire.userId, text, i, segs.length);
    }

    events.onDone(wire.userId, {
      crisis: Boolean(data?.crisis),
      crisisSeverity: data?.crisis_severity,
      crisisType: data?.crisis_type ?? null,
      state: data?.state,
    });
  } catch (err) {
    console.error("[nura] REST fallback error:", err);
    events.onError(
      wire.userId,
      "Couldn't reach Nura. Check your connection and try again."
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

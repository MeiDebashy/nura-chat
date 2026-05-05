import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerMsg } from "./types";

export interface ChatSocketEvents {
  onTyping(): void;
  onSegment(text: string, index: number, total: number): void;
  onDone(crisis: boolean): void;
  onError(message: string): void;
}

export interface SendPayload {
  userId: string;
  message: string;
  displayName?: string;
  tone: string;
}

export interface ChatSocketHandle {
  isConnected: boolean;
  send(payload: SendPayload): "ws" | "rest" | "queued";
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

/**
 * Connects to the Nura backend WebSocket with exponential-backoff reconnect
 * and auto-falls-back to REST when the socket is unavailable for a send.
 *
 * Caller passes events as a ref-stable object via a callback to keep
 * the effect dependency list stable.
 */
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
      if (data.type === "typing") {
        e.onTyping();
      } else if (data.type === "segment" && typeof data.text === "string") {
        e.onSegment(data.text, data.index ?? 0, data.total ?? 1);
      } else if (data.type === "done") {
        e.onDone(Boolean(data.crisis));
      } else if (data.type === "error") {
        e.onError(data.message ?? "Server error");
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      scheduleReconnect.current();
    };

    ws.onerror = () => {
      // onclose will fire and trigger reconnect; don't double-call close().
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
    (payload: SendPayload): "ws" | "rest" | "queued" => {
      const wire = {
        type: "chat" as const,
        userId: payload.userId,
        message: payload.message,
        displayName: payload.displayName,
        tone: payload.tone,
        timestamp: new Date().toISOString(),
      };

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(wire));
          return "ws";
        } catch (err) {
          console.error("[nura] WS send failed, falling back to REST:", err);
        }
      }

      // REST fallback — caller wires the response via the same events bus.
      fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wire),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          const segs: Array<string | { text: string }> = Array.isArray(
            data?.segments
          )
            ? data.segments
            : [];
          eventsRef.current.onTyping();
          segs.forEach((seg, i) => {
            const text = typeof seg === "string" ? seg : seg.text;
            eventsRef.current.onSegment(text, i, segs.length);
          });
          eventsRef.current.onDone(Boolean(data?.crisis));
        })
        .catch((err) => {
          console.error("[nura] REST fallback error:", err);
          eventsRef.current.onError(
            "Couldn't reach Nura. Check your connection and try again."
          );
        });
      return "rest";
    },
    [apiUrl]
  );

  return { isConnected, send };
}

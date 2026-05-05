import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SettingsModal, AccountModal, type Tone } from "./components/Modals";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ChatList } from "./components/ChatList";
import { ChatView } from "./components/ChatView";
import { Composer, type ComposerHandle } from "./components/Composer";
import type { Conversation, Message } from "./lib/types";
import {
  STORAGE_KEY,
  NAME_KEY,
  TONE_KEY,
  MEMBER_KEY,
  USER_ID_KEY,
  loadConversations,
  saveConversations,
} from "./lib/storage";
import { uuid } from "./lib/uuid";
import { useChatSocket, type DoneInfo } from "./lib/useChatSocket";
import { useOnline } from "./lib/useOnline";
import { useSupabaseAuth } from "./lib/useSupabaseAuth";
import { ConsentGate, hasConsented } from "./components/ConsentGate";
import { LoveConsentModal } from "./components/LoveConsentModal";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://nura-emotional-core-production.up.railway.app"
).replace(/\/+$/, "");

const MAX_MESSAGE_LEN = 4000;
const MAX_TITLE_LEN = 42;

/**
 * Returns the LEGACY localStorage userId, if any. We no longer create one
 * here — Supabase Auth issues the canonical id. This is only consulted on
 * first authenticated boot, when we migrate any pre-auth state under the
 * legacy id over to the new auth.uid()-keyed namespace.
 */
function getLegacyUserId(): string | null {
  return localStorage.getItem(USER_ID_KEY);
}

function clearLegacyUserId(): void {
  localStorage.removeItem(USER_ID_KEY);
}

function getMemberSince(): number {
  const raw = localStorage.getItem(MEMBER_KEY);
  if (raw) {
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) return n;
  }
  const now = Date.now();
  localStorage.setItem(MEMBER_KEY, String(now));
  return now;
}

function loadDisplayName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}

function loadTone(): Tone {
  const v = localStorage.getItem(TONE_KEY);
  if (v === "gentle" || v === "direct" || v === "playful") return v;
  return "gentle";
}

function titleFromText(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= MAX_TITLE_LEN) return cleaned;
  return cleaned.slice(0, MAX_TITLE_LEN - 1).trimEnd() + "…";
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

// Watchdog window for messages stuck in "sending". Tuned for fragment
// buffering: backend's MessageCollector waits ≤2.5s of silence before
// processing, then the LLM call adds up to ~10s, so the realistic
// upper bound is ~15s. 60s gives slow-network grace without leaving
// genuinely-failed messages spinning indefinitely.
const STUCK_MESSAGE_TIMEOUT_MS = 60_000;

export default function App() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const isOnline = useOnline();
  const [consented, setConsented] = useState(() => hasConsented());

  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadConversations()
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [typingForId, setTypingForId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [displayName, setDisplayName] = useState(() => loadDisplayName());
  const [tone, setTone] = useState<Tone>(() => loadTone());
  const [activeModal, setActiveModal] = useState<
    "settings" | "account" | null
  >(null);
  const [memberSince] = useState(() => getMemberSince());
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description?: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>(null);

  const auth = useSupabaseAuth();
  const accessToken =
    auth.status.kind === "anonymous" || auth.status.kind === "authenticated"
      ? auth.status.session.access_token
      : null;
  const authUserId =
    auth.status.kind === "anonymous" || auth.status.kind === "authenticated"
      ? auth.status.user.id
      : null;
  const isAuthAnonymous = auth.status.kind === "anonymous";

  const replyTargetIdRef = useRef<string | null>(null);
  const displayNameRef = useRef(displayName);
  const toneRef = useRef(tone);
  const composerRef = useRef<ComposerHandle>(null);

  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);
  useEffect(() => {
    toneRef.current = tone;
  }, [tone]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  // Persistence
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(NAME_KEY, displayName);
    }, 250);
    return () => clearTimeout(t);
  }, [displayName]);
  useEffect(() => {
    localStorage.setItem(TONE_KEY, tone);
  }, [tone]);

  const messageCount = useMemo(
    () => conversations.reduce((sum, c) => sum + c.messages.length, 0),
    [conversations]
  );

  // Track latest activeId for use in stable callbacks
  const activeIdLatestRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdLatestRef.current = activeId;
  }, [activeId]);

  // ── Routing helpers ────────────────────────────────────────────────────
  // The wire now sends only `conversationId`; the backend composes the
  // storage key from the verified JWT + conversationId. Server still
  // echoes the full key back in every event so we can route reliably.
  const decodeConversationId = useCallback(
    (wireUserId: string | null): string | null => {
      if (!wireUserId) return null;
      // Server's composite is `${auth.uid()}:${conversationId}`; both halves
      // are colon-free in practice, but use lastIndexOf for safety.
      const sep = wireUserId.lastIndexOf(":");
      if (sep === -1) {
        // User-scoped event (no conversation suffix) — caller can ignore.
        return null;
      }
      return wireUserId.slice(sep + 1) || null;
    },
    []
  );

  // ── Socket events: ref-stable, route by wire userId ────────────────────
  const socketEvents = useMemo(
    () => ({
      onTyping(wireUserId: string) {
        const cid = decodeConversationId(wireUserId);
        if (cid) setTypingForId(cid);
      },
      onFragmentReceived(_wireUserId: string, _pending: number) {
        // Reserved: backend acks fragment buffering. No UI for now —
        // the `typing`/`segment`/`done` lifecycle is the user-visible signal.
      },
      onSegment(wireUserId: string, text: string) {
        const cid = decodeConversationId(wireUserId);
        if (!cid) return;
        const now = Date.now();
        const newMsg: Message = {
          id: uuid(),
          text,
          sender: "nura",
          timestamp: now,
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === cid
              ? {
                  ...c,
                  messages: [...c.messages, newMsg],
                  updatedAt: now,
                }
              : c
          )
        );
      },
      onDone(wireUserId: string, info: DoneInfo) {
        const cid = decodeConversationId(wireUserId);
        if (!cid) return;
        if (replyTargetIdRef.current === cid) {
          setTypingForId(null);
          replyTargetIdRef.current = null;
        }
        const phaseState = info.state?.phase;
        const elasticityState = info.state?.elasticity;
        const phaseNum = phaseState?.current_phase;
        const isViewing = cid === activeIdLatestRef.current;

        // Build the love-consent prompt object iff backend says it's pending
        // and the user hasn't yet granted/declined.
        let loveConsent: { promptedAt: string; eligibleAt: string } | null =
          null;
        const promptedAt = phaseState?.love_phase_consent_prompt_timestamp;
        const eligibleAt = phaseState?.love_phase_consent_eligible_at;
        const granted = phaseState?.love_phase_consent_granted ?? false;
        if (!granted && promptedAt && eligibleAt) {
          loveConsent = { promptedAt, eligibleAt };
        }

        setConversations((prev) =>
          prev.map((c) =>
            c.id === cid
              ? {
                  ...c,
                  // crisis is sticky (once a conversation is flagged it stays
                  // flagged) but severity tracks the latest message
                  crisis: c.crisis || info.crisis,
                  crisisSeverity:
                    info.crisisSeverity ?? c.crisisSeverity ?? "none",
                  crisisType: info.crisisType ?? c.crisisType ?? null,

                  phase: typeof phaseNum === "number" ? phaseNum : c.phase,
                  cooldownActive: phaseState?.cooldown_active ?? false,
                  cooldownReason: phaseState?.cooldown_reason ?? null,
                  cooldownExpiresAt: phaseState?.cooldown_expires_at ?? null,

                  softPresence:
                    elasticityState?.soft_presence_mode_active ?? false,

                  loveConsent,
                  loveConsentGranted: granted,
                  loveConsentDeclinedAt:
                    phaseState?.love_phase_consent_declined_timestamp ?? null,

                  // Increment unread once per reply (not per segment) when
                  // user is on a different conversation.
                  unread: isViewing ? 0 : (c.unread ?? 0) + 1,
                  messages: c.messages.map((m) =>
                    m.sender === "user" && m.status === "sending"
                      ? { ...m, status: "sent" as const }
                      : m
                  ),
                }
              : c
          )
        );
      },
      onError(wireUserId: string | null, message: string) {
        const cid = decodeConversationId(wireUserId);
        if (cid && replyTargetIdRef.current === cid) {
          setTypingForId(null);
          replyTargetIdRef.current = null;
        }
        if (cid) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === cid
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.sender === "user" && m.status === "sending"
                        ? { ...m, status: "failed" as const }
                        : m
                    ),
                  }
                : c
            )
          );
        }
        // Translate the backend's machine codes into user-readable text.
        const human =
          message === "rate_limited"
            ? "You're sending too fast. Wait a moment and try again."
            : message === "invalid_message"
            ? "That message couldn't be sent. Try again."
            : message === "invalid_userId"
            ? "Session error. Please refresh the page."
            : message === "internal_error"
            ? "Nura had a hiccup. Try again."
            : message === "invalid_json"
            ? "Connection got out of sync. Reloading should fix it."
            : message;
        setSendError(human);
      },
    }),
    [decodeConversationId]
  );

  const { isConnected, send } = useChatSocket(
    API_URL,
    accessToken,
    socketEvents
  );

  // ── Adopt legacy localStorage userId on first authenticated boot ──────
  // Pre-auth versions of this app keyed everything in the backend off a
  // device-local UUID stored in localStorage. Now that Supabase issues
  // the canonical id, transfer any prior backend state under the legacy
  // id over to the auth.uid()-keyed namespace, then clear the legacy id.
  // Idempotent: if there's no legacy id, no-op.
  const adoptedRef = useRef(false);
  useEffect(() => {
    if (adoptedRef.current) return;
    if (!accessToken) return;
    const legacy = getLegacyUserId();
    if (!legacy) {
      adoptedRef.current = true;
      return;
    }
    const ids = conversations.map((c) => c.id);
    if (ids.length === 0) {
      // Nothing to adopt — just clear the legacy id.
      clearLegacyUserId();
      adoptedRef.current = true;
      return;
    }
    adoptedRef.current = true;
    fetch(`${API_URL}/api/auth/adopt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        legacy_user_id: legacy,
        conversation_ids: ids,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          adopted?: number;
          skipped?: number;
        };
        console.info(
          `[nura] Adopted legacy state: ${data.adopted ?? 0} carried over, ${
            data.skipped ?? 0
          } skipped.`
        );
        clearLegacyUserId();
      })
      .catch((err) => {
        // If adoption fails (offline, etc.) we'll retry next boot.
        console.warn("[nura] Adopt failed; will retry next boot:", err);
        adoptedRef.current = false;
      });
  }, [accessToken, conversations]);

  // ── Sending ─────────────────────────────────────────────────────────────

  const handleSend = useCallback(
    (text?: string) => {
      const raw = (text ?? inputValue).trim();
      if (!raw) return;
      if (typingForId !== null) return;

      const messageText = raw.slice(0, MAX_MESSAGE_LEN);
      setSendError(null);

      const now = Date.now();
      const userMsg: Message = {
        id: uuid(),
        text: messageText,
        sender: "user",
        timestamp: now,
        status: "sending",
      };

      let targetId = activeId;
      if (!targetId) {
        targetId = uuid();
        const newConv: Conversation = {
          id: targetId,
          title: titleFromText(messageText),
          messages: [userMsg],
          createdAt: now,
          updatedAt: now,
        };
        setConversations((prev) => [newConv, ...prev]);
        setActiveId(targetId);
      } else {
        const tid = targetId;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === tid
              ? {
                  ...c,
                  title:
                    c.messages.length === 0
                      ? titleFromText(messageText)
                      : c.title,
                  messages: [...c.messages, userMsg],
                  updatedAt: now,
                  unread: 0,
                }
              : c
          )
        );
      }

      replyTargetIdRef.current = targetId;
      // Do NOT set typingForId here. The backend buffers fragments via
      // MessageCollector (sentence punctuation OR 2.5s of silence) before
      // generating one merged reply. typingForId is set when the server's
      // `typing` event fires — that's the exact moment Nura starts composing,
      // and only then should the composer lock. Until then the user can chain
      // fragments freely (the WhatsApp/iMessage feel).
      setInputValue("");

      send({
        conversationId: targetId,
        message: messageText,
      });
    },
    [activeId, inputValue, send, typingForId]
  );

  // ── Love-phase consent (Blueprint #1) ──────────────────────────────────
  const handleLoveConsent = useCallback(
    async (conversationId: string, decision: "grant" | "decline") => {
      if (!accessToken) {
        setSendError("Not signed in yet. Try again in a moment.");
        return;
      }
      try {
        const res = await fetch(`${API_URL}/api/love-consent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            conversationId,
            decision,
          }),
        });
        const data = (await res.json()) as {
          success?: boolean;
          error?: string;
        };
        if (!res.ok || !data.success) {
          setSendError(
            data.error ?? "Couldn't record your decision. Try again."
          );
          return;
        }
        // Optimistically update state; the next `done` will refresh fully.
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  loveConsent: null,
                  loveConsentGranted: decision === "grant",
                  loveConsentDeclinedAt:
                    decision === "decline" ? new Date().toISOString() : null,
                }
              : c
          )
        );
      } catch (err) {
        console.error("[nura] consent error:", err);
        setSendError("Couldn't reach Nura. Try again.");
      }
    },
    [accessToken]
  );

  // ── Conversation operations ─────────────────────────────────────────────

  const handleNewChat = useCallback(() => {
    setActiveId(null);
    setInputValue("");
    setSendError(null);
    setIsDrawerOpen(false);
    setTimeout(() => composerRef.current?.focus(), 50);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveId(id);
    setSendError(null);
    setIsDrawerOpen(false);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, unread: 0, lastReadAt: Date.now() } : c
      )
    );
  }, []);

  const handleDeleteConversation = useCallback(
    (id: string) => {
      const target = conversations.find((c) => c.id === id);
      setConfirm({
        title: "Delete conversation",
        description: `Delete "${
          target?.title ?? "this conversation"
        }"? This can't be undone.`,
        confirmLabel: "Delete",
        destructive: true,
        onConfirm: () => {
          // Optimistic frontend removal first; the server delete is
          // best-effort. If it fails (offline, rate-limited) the server's
          // 30-min idle eviction will eventually clean up.
          setConversations((prev) => prev.filter((c) => c.id !== id));
          if (activeId === id) setActiveId(null);
          if (replyTargetIdRef.current === id) {
            replyTargetIdRef.current = null;
            setTypingForId(null);
          }
          // Wipe the corresponding backend session so emotional state
          // doesn't linger after the user explicitly deleted the chat.
          if (accessToken) {
            fetch(`${API_URL}/api/session`, {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ conversationId: id }),
            }).catch((err) => {
              console.warn("[nura] /api/session DELETE failed:", err);
            });
          }
        },
      });
    },
    [accessToken, activeId, conversations]
  );

  const handleClearAll = useCallback(() => {
    if (conversations.length === 0) return;
    setConfirm({
      title: "Delete all conversations",
      description: `Delete all ${conversations.length} conversation${
        conversations.length === 1 ? "" : "s"
      }? This can't be undone.`,
      confirmLabel: "Delete all",
      destructive: true,
      onConfirm: () => {
        setConversations([]);
        setActiveId(null);
        replyTargetIdRef.current = null;
        setTypingForId(null);
      },
    });
  }, [conversations.length]);

  const handleExport = useCallback(() => {
    if (conversations.length === 0) return;
    const data = {
      exportedAt: new Date().toISOString(),
      displayName,
      tone,
      conversations,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nura-chats-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [conversations, displayName, tone]);

  const handleResetAll = useCallback(() => {
    setConfirm({
      title: "Reset everything",
      description:
        "This deletes all conversations, your name, and your user ID. This can't be undone.",
      confirmLabel: "Reset",
      destructive: true,
      onConfirm: () => {
        [STORAGE_KEY, NAME_KEY, TONE_KEY, MEMBER_KEY, USER_ID_KEY].forEach(
          (k) => localStorage.removeItem(k)
        );
        window.location.reload();
      },
    });
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewChat();
      } else if (e.key === "Escape" && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNewChat, isDrawerOpen]);

  // ── Mobile back button: close drawer / pop chat ────────────────────────
  // We push a sentinel history state when entering a "deeper" view (chat
  // selected, or drawer open). Hardware/browser back triggers popstate, which
  // we map to: close drawer → deselect chat → leave the app.
  const historyDepthRef = useRef(0);
  useEffect(() => {
    if (isDesktop) return;
    const onPop = () => {
      historyDepthRef.current = Math.max(0, historyDepthRef.current - 1);
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
      } else if (activeId) {
        setActiveId(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isDesktop, isDrawerOpen, activeId]);

  useEffect(() => {
    if (isDesktop) return;
    const desired = (activeId ? 1 : 0) + (isDrawerOpen ? 1 : 0);
    while (historyDepthRef.current < desired) {
      window.history.pushState({ nura: true }, "");
      historyDepthRef.current++;
    }
  }, [isDesktop, activeId, isDrawerOpen]);

  // ── Watchdog: any user message stuck in "sending" for too long is failed ──
  // Catches the case where WS drops mid-flight and the server never acks.
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      let dirty = false;
      const next = conversations.map((c) => {
        const messages = c.messages.map((m) => {
          if (
            m.sender === "user" &&
            m.status === "sending" &&
            now - m.timestamp > STUCK_MESSAGE_TIMEOUT_MS
          ) {
            dirty = true;
            return { ...m, status: "failed" as const };
          }
          return m;
        });
        return dirty ? { ...c, messages } : c;
      });
      if (dirty) {
        setConversations(next);
        if (replyTargetIdRef.current) {
          replyTargetIdRef.current = null;
          setTypingForId(null);
        }
      }
    }, 5000);
    return () => clearInterval(t);
  }, [conversations]);

  // ── Retry a failed user message ────────────────────────────────────────
  const handleRetry = useCallback(
    (message: Message) => {
      if (typingForId !== null) return;
      // Find which conversation the message lives in.
      const conv = conversations.find((c) =>
        c.messages.some((m) => m.id === message.id)
      );
      if (!conv) return;

      setSendError(null);
      const now = Date.now();
      // Mark the original as "sending" again rather than spawning a duplicate.
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conv.id
            ? {
                ...c,
                updatedAt: now,
                messages: c.messages.map((m) =>
                  m.id === message.id
                    ? { ...m, status: "sending" as const, timestamp: now }
                    : m
                ),
              }
            : c
        )
      );
      replyTargetIdRef.current = conv.id;
      // Don't preemptively show "typing" — the backend's MessageCollector
      // may buffer this resend with other fragments before processing.
      send({
        conversationId: conv.id,
        message: message.text,
      });
    },
    [conversations, send, typingForId]
  );

  const isReplyForActive = typingForId !== null && typingForId === activeId;

  const composer = (
    <Composer
      ref={composerRef}
      value={inputValue}
      onChange={setInputValue}
      onSubmit={() => handleSend()}
      disabled={typingForId !== null}
      maxLength={MAX_MESSAGE_LEN}
    />
  );

  if (!consented) {
    return <ConsentGate onAccept={() => setConsented(true)} />;
  }

  // Auth bootstrap gate. This is short — usually a few hundred ms — but if
  // Supabase env vars are missing, we surface the misconfiguration clearly
  // rather than letting the chat fail silently.
  if (auth.status.kind === "loading") {
    return (
      <div className="h-[100dvh] w-full bg-[#0a0a0f] text-gray-400 flex items-center justify-center">
        <div className="text-[13px]">Connecting…</div>
      </div>
    );
  }
  if (auth.status.kind === "unconfigured") {
    return (
      <div className="h-[100dvh] w-full bg-[#0a0a0f] text-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-[16px] font-medium mb-2">
            Auth not configured
          </div>
          <div className="text-[13px] text-gray-400 leading-relaxed">
            Set <code className="text-cyan-400">VITE_SUPABASE_URL</code> and{" "}
            <code className="text-cyan-400">VITE_SUPABASE_ANON_KEY</code> in
            your Vercel project's environment variables, then redeploy.
          </div>
        </div>
      </div>
    );
  }
  if (auth.status.kind === "error") {
    return (
      <div className="h-[100dvh] w-full bg-[#0a0a0f] text-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-[16px] font-medium mb-2 text-red-300">
            Couldn't sign you in
          </div>
          <div className="text-[13px] text-gray-400 leading-relaxed mb-4">
            {auth.status.message}
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg text-[13px] bg-cyan-500 hover:bg-cyan-400 text-[#0a0a0f] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full bg-[#0a0a0f] text-gray-100 overflow-hidden selection:bg-cyan-500/30">
      {/* Desktop sidebar (rail) */}
      {isDesktop && (
        <div
          className={`shrink-0 transition-[width] duration-200 ease-out overflow-hidden ${
            isDesktopSidebarOpen ? "w-[300px]" : "w-0"
          }`}
        >
          <div className="w-[300px] h-full">
            <ChatList
              variant="rail"
              conversations={conversations}
              activeId={activeId}
              typingForId={typingForId}
              isConnected={isConnected}
              displayName={displayName}
              onSelect={handleSelectConversation}
              onDelete={handleDeleteConversation}
              onNew={handleNewChat}
              onCollapse={() => setIsDesktopSidebarOpen(false)}
              onOpenSettings={() => setActiveModal("settings")}
              onOpenAccount={() => setActiveModal("account")}
            />
          </div>
        </div>
      )}

      {/* Mobile drawer */}
      {!isDesktop && isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      {!isDesktop && (
        <div
          className={`fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[340px] transform transition-transform duration-200 ease-out ${
            isDrawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          role="dialog"
          aria-label="Conversations"
          aria-hidden={!isDrawerOpen}
        >
          <ChatList
            variant="drawer"
            conversations={conversations}
            activeId={activeId}
            typingForId={typingForId}
            isConnected={isConnected}
            displayName={displayName}
            onSelect={handleSelectConversation}
            onDelete={handleDeleteConversation}
            onNew={handleNewChat}
            onCloseDrawer={() => setIsDrawerOpen(false)}
            onOpenSettings={() => {
              setIsDrawerOpen(false);
              setActiveModal("settings");
            }}
            onOpenAccount={() => {
              setIsDrawerOpen(false);
              setActiveModal("account");
            }}
          />
        </div>
      )}

      {/* Main chat */}
      <ChatView
        conversation={active}
        isTyping={isReplyForActive}
        isConnected={isConnected}
        isOnline={isOnline}
        showSidebarToggle={isDesktop ? !isDesktopSidebarOpen : true}
        onOpenSidebar={() => {
          if (isDesktop) setIsDesktopSidebarOpen(true);
          else setIsDrawerOpen(true);
        }}
        sendError={sendError}
        onDismissError={() => setSendError(null)}
        onSuggestionClick={(s) => handleSend(s)}
        onRetry={handleRetry}
        composerSlot={composer}
      />

      {/* Modals */}
      <SettingsModal
        open={activeModal === "settings"}
        onClose={() => setActiveModal(null)}
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        tone={tone}
        onToneChange={setTone}
        onExport={handleExport}
        onClearHistory={handleClearAll}
        hasHistory={conversations.length > 0}
        isConnected={isConnected}
      />
      <AccountModal
        open={activeModal === "account"}
        onClose={() => setActiveModal(null)}
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        userId={authUserId ?? ""}
        memberSince={memberSince}
        conversationCount={conversations.length}
        messageCount={messageCount}
        onResetAll={handleResetAll}
        isAnonymous={isAuthAnonymous}
        userEmail={
          auth.status.kind === "authenticated" ? auth.status.user.email : null
        }
        onClaimWithEmail={auth.claimWithEmail}
        onSignInWithEmail={auth.signInWithEmail}
        onSignOut={auth.signOut}
      />
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        destructive={confirm?.destructive}
        onConfirm={() => confirm?.onConfirm()}
        onClose={() => setConfirm(null)}
      />

      {/* Love-phase consent prompt (Blueprint #1) — only on the active chat */}
      {active?.loveConsent && (
        <LoveConsentModal
          open={true}
          conversationTitle={active.title}
          promptedAt={active.loveConsent.promptedAt}
          eligibleAt={active.loveConsent.eligibleAt}
          onGrant={() => handleLoveConsent(active.id, "grant")}
          onDecline={() => handleLoveConsent(active.id, "decline")}
          onClose={() => {
            // "Take more time" — clear the prompt locally; backend keeps
            // the timestamp set so the prompt re-appears on next `done`.
            setConversations((prev) =>
              prev.map((c) =>
                c.id === active.id ? { ...c, loveConsent: null } : c
              )
            );
          }}
        />
      )}
    </div>
  );
}

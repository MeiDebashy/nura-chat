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
import { ConsentGate, hasConsented } from "./components/ConsentGate";
import { LoveConsentModal } from "./components/LoveConsentModal";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://nura-emotional-core-production.up.railway.app"
).replace(/\/+$/, "");

const MAX_MESSAGE_LEN = 4000;
const MAX_TITLE_LEN = 42;

function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
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

  const userIdRef = useRef(getUserId());
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

  // ── Wire userId ↔ conversationId ───────────────────────────────────────
  // The backend keys NuraLLM sessions by `userId`. We send a composite id
  // `${baseUserId}:${conversationId}` so each chat has its own emotional
  // history (phase, elasticity, repetition, anchor scheduler).
  // Server echoes our composite back in every event — we use it to route
  // segments/done/typing/error to the right conversation in state.
  const composeWireUserId = useCallback(
    (conversationId: string) => `${userIdRef.current}:${conversationId}`,
    []
  );

  const decodeConversationId = useCallback(
    (wireUserId: string | null): string | null => {
      if (!wireUserId) return null;
      // Split on the LAST colon so a future colon-bearing baseUserId
      // (e.g. "auth0|123") still parses correctly. The conversationId
      // half is always a UUID and never contains a colon.
      const sep = wireUserId.lastIndexOf(":");
      if (sep === -1) return null;
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
        setSendError(message);
      },
    }),
    [decodeConversationId]
  );

  const { isConnected, send } = useChatSocket(API_URL, socketEvents);

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
        userId: composeWireUserId(targetId),
        message: messageText,
      });
    },
    [activeId, composeWireUserId, inputValue, send, typingForId]
  );

  // ── Love-phase consent (Blueprint #1) ──────────────────────────────────
  const handleLoveConsent = useCallback(
    async (conversationId: string, decision: "grant" | "decline") => {
      try {
        const res = await fetch(`${API_URL}/api/love-consent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: composeWireUserId(conversationId),
            decision,
            timestamp: new Date().toISOString(),
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
    [composeWireUserId]
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
          setConversations((prev) => prev.filter((c) => c.id !== id));
          if (activeId === id) setActiveId(null);
          if (replyTargetIdRef.current === id) {
            replyTargetIdRef.current = null;
            setTypingForId(null);
          }
        },
      });
    },
    [activeId, conversations]
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
        userId: composeWireUserId(conv.id),
        message: message.text,
      });
    },
    [composeWireUserId, conversations, send, typingForId]
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
        userId={userIdRef.current}
        memberSince={memberSince}
        conversationCount={conversations.length}
        messageCount={messageCount}
        onResetAll={handleResetAll}
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

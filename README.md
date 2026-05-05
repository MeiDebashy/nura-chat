# Nura — chat frontend

Vite + React 18 + Tailwind 4. Connects to the
[`nura-emotional-core`](../nura-emotional-core) backend over WebSocket
(with REST fallback).

## Architecture

```
src/
  App.tsx                      glue: state, routing, hooks
  components/
    ChatList.tsx               sidebar — search, rows, footer
    ChatView.tsx               right pane — header, banners, messages
    Composer.tsx               textarea + send button
    MessageBubble.tsx          bubbles, day separators, crisis banner
    Avatar.tsx                 deterministic gradient avatars
    ConsentGate.tsx            first-launch privacy + crisis disclaimer
    ConfirmDialog.tsx          replaces window.confirm()
    ErrorBoundary.tsx          render-crash recovery
    Modals.tsx                 Settings + Account
    NuraLogo.tsx               welcome-screen mark
  lib/
    useChatSocket.ts           WS lifecycle + REST fallback
    useOnline.ts               navigator.onLine
    storage.ts                 localStorage with type guards
    types.ts                   Conversation, Message, ServerMsg
    time.ts, avatar.ts, phase.ts, uuid.ts
```

Each conversation is its own emotional session on the backend — wire userId
is `${baseUserId}:${conversationId}`. The server's `UserSessionManager` keys
sessions by userId, so each chat has independent phase, elasticity,
repetition normalization, and reality-anchor state.

## Develop

```
npm install
npm run dev          # http://localhost:3000
```

## Build / preview

```
npm run build        # outputs to ./build
npm run preview
```

## Configuration

| Env var          | Default                                                     |
| ---------------- | ----------------------------------------------------------- |
| `VITE_API_URL`   | `https://nura-emotional-core-production.up.railway.app`     |

Set in `.env.local` for development or Vercel project settings for prod.
The WebSocket URL is derived by replacing the protocol.

## Deploy (Vercel)

`vercel.json` pins `framework: vite`, `outputDirectory: build`.
Connect the repo, set `VITE_API_URL` if the backend moves, and push to
`master` — Vercel auto-deploys.

## What's wired vs. what's still TODO

Wired:
- Per-conversation backend sessions
- Phase shown in header subtitle
- Crisis flag from `done.crisis` → pinned banner
- REST fallback paces segments by `delay_ms`
- Error boundary, retry-failed-message, offline banner, stuck-message
  watchdog
- First-launch consent gate
- PWA manifest

TODO (need product calls):
- Real auth + cross-device sync (currently localStorage-only)
- Server-side persistence for user emotional state (currently
  `InMemoryStateStore` — Railway redeploy wipes everyone)
- Resizable desktop sidebar
- Long-press / right-click context menu on bubbles (copy, reply-quote)
- Swipe-to-archive on conversation rows (mobile)

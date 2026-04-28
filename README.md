# Nura — chat frontend

Vite + React 18 + Tailwind 4. Connects to the [`nura-emotional-core`](../nura-emotional-core)
backend over WebSocket (with REST fallback).

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

| Env var          | Default                                                     | Notes                                          |
| ---------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| `VITE_API_URL`   | `https://nura-emotional-core-production.up.railway.app`     | Backend base URL. WS URL is derived from this. |

Set in `.env.local` for development, or in your Vercel project settings for prod.

## Deploy (Vercel)

`vercel.json` pins this as a Vite static build: framework `vite`, output `build/`.
There is no server in this repo — the chat backend is a separate service.

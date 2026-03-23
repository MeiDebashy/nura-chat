'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Message {
  id: string
  role: 'user' | 'nura'
  content: string
}

const API_URL = 'https://nura-emotional-core-production.up.railway.app/api/chat'

function getUserId(): string {
  const stored = localStorage.getItem('nura-user-id')
  if (stored) return stored
  const id = crypto.randomUUID()
  localStorage.setItem('nura-user-id', id)
  return id
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function ChatContainer() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [userId, setUserId] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setUserId(getUserId())
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || !userId || isSending) return

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsSending(true)

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setIsTyping(true)

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userId,
          timestamp: new Date().toISOString(),
        }),
      })

      const data = await res.json()
      type RawSegment = string | { text: string; delay_ms?: number }
      const rawSegments: RawSegment[] = data.segments ?? []

      for (let i = 0; i < rawSegments.length; i++) {
        const seg = rawSegments[i]
        const text = typeof seg === 'string' ? seg : seg.text
        const delayMs = typeof seg === 'string' ? 800 : (seg.delay_ms ?? 800)

        if (i > 0) {
          setIsTyping(true)
          await delay(delayMs)
        }
        setIsTyping(false)
        const nuraMsg: Message = {
          id: crypto.randomUUID(),
          role: 'nura',
          content: text,
        }
        setMessages((prev) => [...prev, nuraMsg])
      }
    } catch {
      setIsTyping(false)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'nura',
          content: "I'm having a little trouble connecting right now. Please try again.",
        },
      ])
    } finally {
      setIsTyping(false)
      setIsSending(false)
    }
  }, [input, userId, isSending])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div
      className="flex flex-col h-screen w-full max-w-2xl mx-auto"
      style={{ backgroundColor: '#0a0a0f' }}
    >
      {/* Header */}
      <header
        className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
            boxShadow: '0 0 12px rgba(59,130,246,0.4)',
          }}
        >
          N
        </div>
        <div className="min-w-0">
          <h1 className="text-white font-semibold text-sm leading-tight">Nura</h1>
          <p className="text-xs" style={{ color: '#52525b' }}>
            AI Companion
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: '#4ade80' }}
          />
          <span className="text-xs" style={{ color: '#52525b' }}>
            Online
          </span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {messages.length === 0 && !isTyping && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center pb-16">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                boxShadow: '0 0 24px rgba(59,130,246,0.35)',
              }}
            >
              N
            </div>
            <div>
              <p className="text-white font-semibold text-base">Hi, I&apos;m Nura</p>
              <p className="text-sm mt-1" style={{ color: '#71717a' }}>
                Your emotional AI companion.
                <br />
                I&apos;m here to listen and support you.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {["How are you?", "I need to talk", "I'm feeling anxious"].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion)
                    textareaRef.current?.focus()
                  }}
                  className="px-3 py-1.5 rounded-full text-xs transition-all duration-200"
                  style={{
                    backgroundColor: 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    color: '#93c5fd',
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex animate-message-in ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'nura' && (
              <div
                className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white mr-2 mt-0.5"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                }}
              >
                N
              </div>
            )}
            <div
              className="max-w-[75%] px-4 py-2.5 text-sm leading-relaxed"
              style={
                msg.role === 'user'
                  ? {
                      backgroundColor: '#1c1c26',
                      color: '#e4e4e7',
                      borderRadius: '18px 18px 4px 18px',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }
                  : {
                      background: 'linear-gradient(135deg, #0f1d38 0%, #111827 100%)',
                      color: '#e4e4e7',
                      borderRadius: '18px 18px 18px 4px',
                      border: '1px solid rgba(59,130,246,0.18)',
                      boxShadow: '0 0 12px rgba(59,130,246,0.06)',
                    }
              }
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-end justify-start animate-message-in">
            <div
              className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white mr-2"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
              }}
            >
              N
            </div>
            <div
              className="px-4 py-3"
              style={{
                background: 'linear-gradient(135deg, #0f1d38 0%, #111827 100%)',
                borderRadius: '18px 18px 18px 4px',
                border: '1px solid rgba(59,130,246,0.18)',
              }}
            >
              <div className="flex items-center gap-1">
                <div className="typing-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#60a5fa' }} />
                <div className="typing-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#60a5fa' }} />
                <div className="typing-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#60a5fa' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="flex-shrink-0 px-4 pb-4 pt-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div
          className="flex items-end gap-3 px-4 py-3 rounded-2xl transition-all duration-200"
          style={{
            backgroundColor: '#111118',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          onFocus={() => {}}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              adjustTextareaHeight()
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message Nura…"
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none"
            style={{
              color: '#e4e4e7',
              minHeight: '20px',
              maxHeight: '120px',
              lineHeight: '1.5',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isSending}
            className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
            style={{
              background: input.trim() && !isSending
                ? 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)'
                : 'rgba(255,255,255,0.06)',
              opacity: !input.trim() || isSending ? 0.4 : 1,
              cursor: !input.trim() || isSending ? 'not-allowed' : 'pointer',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M1.5 11.5L11.5 1.5M11.5 1.5H4.5M11.5 1.5V8.5"
                stroke="white"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs mt-2" style={{ color: '#3f3f46' }}>
          Nura is here to listen and support you
        </p>
      </div>
    </div>
  )
}

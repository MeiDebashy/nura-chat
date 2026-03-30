import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Menu, Plus, MessageSquare, Settings, User, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NuraLogo } from "./components/NuraLogo";

const API_URL = import.meta.env.VITE_API_URL || "https://nura-emotional-core-production.up.railway.app";
const WS_URL = API_URL.replace(/^http/, "ws") + "/ws";

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'nura';
  timestamp: Date;
};

const SUGGESTIONS = [
  "How are you?",
  "I need to talk",
  "I'm feeling anxious"
];

const CONVERSATIONS = [
  { id: '1', title: 'Feeling overwhelmed at work', time: '2h ago' },
  { id: '2', title: 'Anxiety about the future', time: 'Yesterday' },
  { id: '3', title: 'Just needed someone to listen', time: 'Tue' },
];

function getUserId(): string {
  let id = localStorage.getItem("nura-user-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("nura-user-id", id);
  }
  return id;
}

const NuraAvatar = ({ size = "sm" }: { size?: "sm" | "md" | "lg" }) => {
  const sizes = {
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-12 h-12"
  };
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${sizes[size]}`}>
      <div className="rounded-full bg-cyan-950/40 border border-cyan-500/30 shadow-[0_0_12px_rgba(0,212,255,0.25)] flex items-center justify-center overflow-hidden w-full h-full">
        <div className="w-full h-full bg-gradient-to-tr from-cyan-600/20 to-cyan-300/40 blur-[2px]" />
      </div>
    </div>
  );
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const userIdRef = useRef(getUserId());
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // WebSocket connection
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log("[nura] WebSocket connected");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "typing") {
        setIsTyping(true);
      } else if (data.type === "segment") {
        setIsTyping(false);
        const newMsg: Message = {
          id: `nura-${Date.now()}-${data.index}`,
          text: data.text,
          sender: "nura",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMsg]);
      } else if (data.type === "done") {
        setIsTyping(false);
      } else if (data.type === "error") {
        setIsTyping(false);
        console.error("[nura] Server error:", data.message);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log("[nura] WebSocket disconnected, reconnecting...");
      reconnectTimer.current = setTimeout(connectWs, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connectWs();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connectWs]);

  const handleSend = (text: string) => {
    const messageText = typeof text === "string" ? text : inputValue;
    if (!messageText.trim()) return;

    const newUserMsg: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInputValue("");
    setIsTyping(true);

    // Send via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "chat",
          userId: userIdRef.current,
          message: messageText,
          timestamp: new Date().toISOString(),
        })
      );
    } else {
      // Fallback to REST API
      fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          userId: userIdRef.current,
          timestamp: new Date().toISOString(),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          setIsTyping(false);
          if (data.segments) {
            const nuraMessages: Message[] = data.segments.map(
              (seg: { text: string }, i: number) => ({
                id: `nura-${Date.now()}-${i}`,
                text: seg.text,
                sender: "nura" as const,
                timestamp: new Date(),
              })
            );
            setMessages((prev) => [...prev, ...nuraMessages]);
          }
        })
        .catch((err) => {
          setIsTyping(false);
          console.error("[nura] REST fallback error:", err);
        });
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-[#0a0a0f] text-gray-100 font-sans overflow-hidden selection:bg-cyan-500/30">
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.15); }
      `}} />

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 h-full bg-[#0a0a0f] md:bg-[#0a0a0f]/50 border-r border-white/5 transition-all duration-300 ease-in-out shrink-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${isDesktopSidebarOpen ? 'w-[280px] md:w-[260px]' : 'w-[280px] md:w-0 md:-ml-[260px] md:border-none'}
      `}>
        <div className="w-[280px] md:w-[260px] h-full flex flex-col p-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-8 md:mb-6">
            <div className="flex items-center gap-3 md:gap-2">
              <NuraAvatar size="sm" />
              <span className="text-white font-medium tracking-widest text-[14px]">NURA</span>
            </div>
            <div className="flex items-center md:hidden">
              <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>
            <div className="hidden md:flex">
              <button onClick={() => setIsDesktopSidebarOpen(false)} className="text-gray-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors">
                <PanelLeftClose size={18} />
              </button>
            </div>
          </div>

          {/* New Chat Button */}
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-2 w-full py-2.5 px-3 rounded-lg border border-cyan-500/30 text-cyan-50 hover:bg-cyan-500/10 transition-colors text-[14px] font-medium mb-6 shadow-[0_0_15px_rgba(0,212,255,0.05)]"
          >
            <Plus size={16} className="text-cyan-400" />
            New Chat
          </button>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">Recent</div>
            <div className="space-y-1">
              {CONVERSATIONS.map(conv => (
                <button key={conv.id} className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left group">
                  <MessageSquare size={16} className="text-gray-500 shrink-0 group-hover:text-cyan-400/70 transition-colors" />
                  <div className="flex-1 overflow-hidden">
                    <div className="text-[13px] text-gray-300 truncate">{conv.title}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer User Area */}
          <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-1">
            <button className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left w-full text-gray-400 hover:text-gray-200">
              <Settings size={16} />
              <span className="text-[13px]">Settings</span>
            </button>
            <button className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left w-full text-gray-400 hover:text-gray-200">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <User size={14} />
              </div>
              <span className="text-[13px]">My Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative min-w-0 bg-[#0a0a0f]">

        {/* Subtle Background Noise/Gradient */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30 mix-blend-screen z-0">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
        </div>

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5 z-20 shrink-0">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-gray-400 hover:text-white">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <NuraAvatar size="sm" />
              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-[2px] border-[#0a0a0f] ${isConnected ? 'bg-[#10b981]' : 'bg-gray-500'}`} />
            </div>
            <div className="flex flex-col">
              <h2 className="font-medium text-white text-[14px] leading-tight">Nura</h2>
            </div>
          </div>
          <div className="w-8" />
        </header>

        {/* Desktop Sidebar Toggle (Floating) */}
        <div className="hidden md:flex absolute top-4 left-4 z-20">
          {!isDesktopSidebarOpen && (
            <button onClick={() => setIsDesktopSidebarOpen(true)} className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-white/5 transition-colors">
              <PanelLeftOpen size={20} />
            </button>
          )}
        </div>

        {/* Chat Scroll Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 w-full z-10 relative">
          <div className="max-w-[680px] mx-auto w-full h-full flex flex-col">

            {messages.length === 0 ? (
              /* Welcome State */
              <div className="flex-1 flex flex-col items-center justify-center pb-12 md:pb-24">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="transform scale-[0.6] md:scale-100 -my-14 md:-my-4 pointer-events-none"
                >
                  <NuraLogo />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 1 }}
                  className="text-center space-y-2 mt-2 md:mt-12"
                >
                  <h1 className="text-2xl md:text-3xl font-light text-white tracking-wide">Hi, I'm Nura</h1>
                  <p className="text-[14px] md:text-base text-gray-400 font-light tracking-wide">your emotional companion</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 1 }}
                  className="flex flex-col md:flex-row justify-center gap-3 mt-8 md:mt-12 w-full max-w-[280px] md:max-w-none"
                >
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSend(suggestion)}
                      className="px-5 py-3 md:py-2.5 rounded-2xl md:rounded-full border border-cyan-500/20 bg-cyan-950/10 text-cyan-50 hover:bg-cyan-500/10 hover:border-cyan-500/40 transition-all text-[14px] md:text-[13px] font-light tracking-wide backdrop-blur-sm"
                    >
                      {suggestion}
                    </button>
                  ))}
                </motion.div>
              </div>
            ) : (
              /* Message List */
              <div className="space-y-6 md:space-y-8 pb-4 w-full">
                <AnimatePresence initial={false}>
                  {messages.map((message) => {
                    const isNura = message.sender === 'nura';

                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex w-full ${isNura ? 'justify-start' : 'justify-end'}`}
                      >
                        {isNura && (
                          <div className="hidden md:flex mr-4 mt-0.5 shrink-0">
                            <NuraAvatar size="md" />
                          </div>
                        )}
                        <div className={`
                          text-[15px] leading-relaxed max-w-[85%] md:max-w-[80%]
                          ${isNura
                            ? 'md:bg-transparent md:border-none md:shadow-none md:px-0 md:py-1.5 md:text-gray-200 md:backdrop-blur-none bg-[#12121f] border-l-[3px] border-cyan-500/40 shadow-[-4px_0_20px_rgba(0,212,255,0.03)] rounded-2xl rounded-tl-sm px-4 py-3 backdrop-blur-sm text-gray-100'
                            : 'bg-[#1a1a2e] text-white rounded-2xl rounded-tr-sm shadow-sm px-4 py-3 md:px-5 md:py-3.5 md:rounded-3xl md:rounded-tr-sm'
                          }
                        `}>
                          {message.text}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Typing Indicator */}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex w-full justify-start"
                  >
                    <div className="hidden md:flex mr-4 mt-0.5 shrink-0">
                      <NuraAvatar size="md" />
                    </div>
                    <div className="md:bg-transparent md:border-none md:shadow-none md:px-0 md:py-3 md:backdrop-blur-none bg-[#12121f] border-l-[3px] border-cyan-500/40 shadow-[-4px_0_20px_rgba(0,212,255,0.03)] rounded-2xl rounded-tl-sm px-4 py-4 flex gap-1.5 items-center backdrop-blur-sm">
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} className="h-1" />
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="w-full shrink-0 p-4 md:px-6 md:pb-6 md:pt-2 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f] to-transparent z-20">
          <div className="max-w-[680px] mx-auto">
            <div className="relative flex items-center bg-[#151523] rounded-[24px] md:rounded-[32px] border border-white/5 focus-within:border-cyan-500/30 focus-within:bg-[#1a1a2e] transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend(inputValue)}
                placeholder="Message Nura..."
                className="flex-1 bg-transparent pl-5 md:pl-6 pr-2 py-3.5 md:py-4 text-[15px] text-white placeholder-gray-500 outline-none w-full"
              />
              <button
                onClick={() => handleSend(inputValue)}
                disabled={!inputValue.trim() || isTyping}
                className="p-2.5 md:p-3 mr-1.5 md:mr-2 rounded-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 disabled:hover:bg-cyan-500 text-[#0a0a0f] transition-all flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,212,255,0.4)] disabled:shadow-none"
              >
                <Send size={18} className="ml-0.5" />
              </button>
            </div>
            <p className="text-center text-[12px] text-gray-500 mt-3 hidden md:block tracking-wide">
              Nura is here to listen and support you
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

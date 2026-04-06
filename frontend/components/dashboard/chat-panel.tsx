"use client"

/**
 * Chat Panel with Unified Chatbot Integration
 * 
 * This component provides a conversational interface to the Unified Chatbot backend.
 * The backend intelligently routes queries based on intent:
 * 
 * - ANALYZE_BATCH: For batch/process analysis and anomaly detection
 * - SUMMARIZE_JOURNEY: For narrative journey summaries  
 * - DATABASE: For specific data queries, lineage traces, and metrics
 * 
 * The chatbot uses conversation history to provide context-aware responses
 * and maintains memory across multiple turns.
 */

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Send, Bot, User, Sparkles, X, Mic } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  route?: string   // "SQL" | "GRAPH" — shown on assistant messages
}

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function getInitialMessages(): Message[] {
  return [
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm IntelliAgent, your AI logistics assistant powered by Gemma. How can I help you today?",
      timestamp: formatTime(new Date()),
    },
  ]
}


export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [mounted, setMounted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const originalInputRef = useRef<string>("")

  useEffect(() => {
    setMounted(true)
    setMessages(getInitialMessages())

    // Initialize Web Speech API
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true

        recognition.onresult = (event: any) => {
          let transcript = ""
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript
          }
          const orig = originalInputRef.current.trim()
          setInput(orig ? `${orig} ${transcript.trim()}` : transcript.trim())
        }

        recognition.onend = () => {
          setIsListening(false)
        }

        recognition.onerror = () => {
          setIsListening(false)
        }

        recognitionRef.current = recognition
      }
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    } else {
      try {
        originalInputRef.current = input
        recognitionRef.current?.start()
        setIsListening(true)
      } catch (e) {
        console.error("Speech recognition error:", e)
      }
    }
  }

  // Return a placeholder during SSR to prevent hydration mismatch
  if (!mounted) {
    return (
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-[420px] transition-all duration-300",
          isOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        )}
      />
    )
  }

  const handleSend = async () => {
    if (!input.trim() || isTyping) return

    const query = input.trim()
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: formatTime(new Date()),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    try {
      // Add a natural thinking delay to avoid robotic instant responses
      await new Promise(resolve => setTimeout(resolve, 800))
      
      const res = await api.chat(query)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.answer,
        timestamp: formatTime(new Date()),
        route: res.route,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "⚠️ Could not reach the AI backend. Make sure the server is running on port 8000.",
          timestamp: formatTime(new Date()),
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-50 w-[420px] transition-all duration-300",
        isOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
      )}
    >
      <Card className="flex h-screen flex-col overflow-hidden rounded-none border-l border-y-0 border-r-0 border-border bg-white shadow-2xl">
        {/* Header - Fixed */}
        <div className="flex-none flex items-center justify-between border-b border-[#E5E7EB] bg-white px-4 py-3 z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFD600]">
              <Bot className="h-5 w-5 text-black" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-black">IntelliAgent</h3>
              <p className="flex items-center gap-1 text-[10px] font-bold text-[#9CA3AF] uppercase">
                <Sparkles className="h-2.5 w-2.5 text-[#FFD600]" />
                Gemma Analytics Agent
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-4 w-4 text-black" />
          </Button>
        </div>

        {/* Messages - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 bg-[#F9FAFB]/50 no-scrollbar">
          <div className="flex flex-col gap-2.5 py-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2.5",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm font-bold text-[10px]",
                    message.role === "user" ? "bg-black text-white" : "bg-[#FFD600] text-black"
                  )}
                >
                  {message.role === "user" ? "U" : "AI"}
                </div>
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 shadow-sm border",
                    message.role === "user"
                      ? "bg-black text-white border-black"
                      : "bg-white text-black border-[#E5E7EB]"
                  )}
                >
                  {message.route && (
                    <div className="mb-1 flex">
                      <Badge className="bg-[#FFD600] text-black border-none text-[8px] h-4 px-1 leading-none font-bold uppercase tracking-wider">
                        {message.route === "ANALYZE_BATCH" ? "ANALYSIS" : message.route === "SUMMARIZE_JOURNEY" ? "JOURNEY" : message.route === "DATABASE" ? "DATA" : message.route.toUpperCase()}
                      </Badge>
                    </div>
                  )}
                  <div className={cn(
                    "text-[13px] leading-relaxed font-medium markdown-content",
                    message.role === "user" ? "text-white" : "text-black"
                  )}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="mb-2 list-disc pl-5 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-2 list-decimal pl-5 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="mb-1 leading-normal">{children}</li>,
                        strong: ({ children }) => (
                          <strong className={cn(
                            "font-black",
                            message.role === "user" ? "text-white" : "text-black"
                          )}>
                            {children}
                          </strong>
                        ),
                        code: ({ children }) => (
                          <code className="bg-gray-100/50 px-1 rounded text-[11px] font-mono text-black">
                            {children}
                          </code>
                        )
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  <p className={cn("mt-1 text-[9px] font-bold opacity-40 uppercase tracking-tighter", message.role === "user" ? "text-right" : "")}>
                    {message.timestamp}
                  </p>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFD600] text-black shadow-sm font-bold text-[10px]">AI</div>
                <div className="rounded-xl bg-white border border-[#E5E7EB] px-3 py-2 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#FFD600]" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#FFD600]" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#FFD600]" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} className="h-2" />
          </div>
        </div>

        {/* Suggested prompts - Fixed */}
        <div className="flex-none border-t border-[#E5E7EB] bg-white px-3 py-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              "Overall yield?",
              "Show anomalies",
              "Trace INV-0001",
            ].map((q) => (
              <Button
                key={q}
                variant="outline"
                size="sm"
                className="shrink-0 h-7 rounded-full border-[#E5E7EB] bg-white px-3 text-[10px] font-bold text-black hover:bg-gray-100 transition-all"
                onClick={() => setInput(q)}
              >
                {q}
              </Button>
            ))}
          </div>
        </div>

        {/* Input - Fixed */}
        <div className="flex-none border-t border-[#E5E7EB] bg-white p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2 items-center"
          >
            <div className="relative flex-1">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask IntelliAgent or tap mic..."
                className="w-full h-10 text-sm border-[#E5E7EB] focus-visible:ring-[#FFD600] rounded-xl pr-10"
                disabled={isTyping}
              />
              <button
                type="button"
                onClick={toggleListening}
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors",
                  isListening ? "text-red-500 bg-red-50 animate-pulse" : "text-gray-400 hover:text-black hover:bg-gray-100"
                )}
                title={isListening ? "Stop listening" : "Start dictation"}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-black hover:bg-gray-800 transition-all shadow-md group" disabled={!input.trim() || isTyping}>
              <Send className="h-4 w-4 text-white group-active:translate-x-1 transition-transform" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}

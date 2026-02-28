'use client'

import { useRef, useEffect, useState } from 'react'
import { ChatMessages, type ChatMessage, type ToolEvent } from './ChatMessages'
import { ConnectorStatus } from './ConnectorStatus'
import { PassportForm } from './PassportForm'

interface ChatOverlayProps {
  messages: ChatMessage[]
  toolEvents: ToolEvent[]
  isLoading: boolean
  streamingText: string
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onPassportSaved?: (nationality: string) => void
}

export function ChatOverlay({
  messages,
  toolEvents,
  isLoading,
  streamingText,
  input,
  onInputChange,
  onSend,
  onPassportSaved,
}: ChatOverlayProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showPassport, setShowPassport] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, toolEvents])

  const hasContent = messages.length > 0 || isLoading || streamingText

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 pointer-events-none flex flex-col max-h-[60vh]">
      {/* Gradient fade into the 3D scene */}
      <div className="h-12 bg-gradient-to-b from-transparent to-black/60 shrink-0" />

      <div className="bg-black/60 backdrop-blur-md flex flex-col min-h-0">
        {/* Messages area */}
        {hasContent && (
          <div className="flex-1 overflow-y-auto pointer-events-auto min-h-0">
            <ChatMessages
              messages={messages}
              toolEvents={toolEvents}
              isLoading={isLoading && !streamingText}
            />
            {streamingText && (
              <div className="flex justify-start px-4 pb-4">
                <div className="max-w-[80%] bg-zinc-900/80 border border-zinc-800 rounded-2xl px-4 py-2 text-sm text-zinc-100 leading-relaxed">
                  <p className="whitespace-pre-wrap">{streamingText}</p>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Connector status */}
        <div className="pointer-events-auto">
          <ConnectorStatus />
        </div>

        {/* Input */}
        <div className="p-4 pointer-events-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onSend()
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Ask about travel, visas, flights..."
              className="flex-1 bg-zinc-900/80 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassport((v) => !v)}
              className="bg-zinc-800 border border-zinc-700 text-white px-3 py-3 rounded-xl text-sm hover:bg-zinc-700 transition-colors"
              title="Passport & Visa Info"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2" />
                <circle cx="12" cy="10" r="3" />
                <path d="M7 20v-2a5 5 0 0 1 10 0v2" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-white text-black px-5 py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-zinc-200 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
      {showPassport && (
        <PassportForm
          onClose={() => setShowPassport(false)}
          onSaved={onPassportSaved}
        />
      )}
    </div>
  )
}

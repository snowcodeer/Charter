'use client'

import { useRef, useEffect } from 'react'
import { ChatMessages, type ChatMessage, type ToolEvent } from './ChatMessages'
import { ConnectorStatus } from './ConnectorStatus'

interface ChatOverlayProps {
  messages: ChatMessage[]
  toolEvents: ToolEvent[]
  isLoading: boolean
  streamingText: string
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
}

export function ChatOverlay({
  messages,
  toolEvents,
  isLoading,
  streamingText,
  input,
  onInputChange,
  onSend,
}: ChatOverlayProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

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
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-white text-black px-5 py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-zinc-200 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

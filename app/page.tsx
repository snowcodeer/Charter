'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessages, type ChatMessage, type ToolEvent } from '@/components/agent/ChatMessages'
import { ConnectorStatus } from '@/components/agent/ConnectorStatus'

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText, toolEvents])

  async function sendMessage() {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    setIsLoading(true)
    setToolEvents([])
    setStreamingText('')

    const userMessage: ChatMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = JSON.parse(line.slice(6))

          if (payload.event === 'text') {
            fullText += payload.data.text
            setStreamingText(fullText)
          } else if (payload.event === 'tool_call') {
            setToolEvents((prev) => [...prev, { type: 'tool_call', name: payload.data.name, data: payload.data.input }])
          } else if (payload.event === 'tool_result') {
            setToolEvents((prev) => [...prev, { type: 'tool_result', name: payload.data.name, data: payload.data.result }])
          } else if (payload.event === 'done') {
            if (fullText) {
              setMessages((prev) => [...prev, { role: 'assistant', content: fullText }])
              setStreamingText('')
            }
          } else if (payload.event === 'error') {
            setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${payload.data.message}` }])
          }
        }
      }

      // If stream ended without 'done' event
      if (fullText && streamingText) {
        setMessages((prev) => [...prev, { role: 'assistant', content: fullText }])
        setStreamingText('')
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Connection error: ${err instanceof Error ? err.message : String(err)}` }])
    } finally {
      setIsLoading(false)
      setToolEvents([])
    }
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header */}
      <div className="border-b border-zinc-900 px-6 py-4">
        <h1 className="text-lg font-medium tracking-tight">Charter</h1>
        <p className="text-xs text-zinc-500 mt-0.5">AI travel agent</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isLoading ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            Ask me about visa requirements, flights, or travel plans.
          </div>
        ) : (
          <>
            <ChatMessages messages={messages} toolEvents={toolEvents} isLoading={isLoading && !streamingText} />
            {streamingText && (
              <div className="flex justify-start px-4 pb-4">
                <div className="max-w-[80%] bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2 text-sm text-zinc-100 leading-relaxed">
                  <p className="whitespace-pre-wrap">{streamingText}</p>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Connector status */}
      <ConnectorStatus />

      {/* Input */}
      <div className="border-t border-zinc-900 p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage() }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about travel, visas, flights..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
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
  )
}

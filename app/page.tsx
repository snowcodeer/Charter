'use client'

import { useState } from 'react'
import { type ChatMessage, type ToolEvent } from '@/components/agent/ChatMessages'
import { ChatOverlay } from '@/components/agent/ChatOverlay'
import { OfficeScene } from '@/components/scene/OfficeScene'
import { useGlobeStore } from '@/components/scene/globe/useGlobeStore'

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const { setArcs, setMarkers, clearAll: clearGlobe } = useGlobeStore()

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
            // Handle globe visualization tool
            if (payload.data.name === 'show_on_globe' && payload.data.result?.action === 'show_on_globe') {
              const result = payload.data.result
              if (result.clear) clearGlobe()
              if (result.arcs?.length) {
                setArcs(result.arcs.map((a: { from: { lat: number; lng: number; label?: string }; to: { lat: number; lng: number; label?: string } }, i: number) => ({
                  id: `arc-${Date.now()}-${i}`,
                  from: a.from,
                  to: a.to,
                })))
              }
              if (result.markers?.length) {
                setMarkers(result.markers.map((m: { lat: number; lng: number; label: string; type?: string }, i: number) => ({
                  id: `marker-${Date.now()}-${i}`,
                  lat: m.lat,
                  lng: m.lng,
                  label: m.label,
                  type: m.type || 'destination',
                })))
              }
            }
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
    <>
      <OfficeScene />
      <ChatOverlay
        messages={messages}
        toolEvents={toolEvents}
        isLoading={isLoading}
        streamingText={streamingText}
        input={input}
        onInputChange={setInput}
        onSend={sendMessage}
      />
    </>
  )
}

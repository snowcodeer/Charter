'use client'

import { useState } from 'react'
import { type ChatMessage, type ToolEvent } from '@/components/agent/ChatMessages'
import { ChatOverlay } from '@/components/agent/ChatOverlay'
import { OfficeScene } from '@/components/scene/OfficeScene'
import { GlobeTooltip } from '@/components/scene/globe/GlobeTooltip'
import { useGlobeStore } from '@/components/scene/globe/useGlobeStore'

// Common country name → ISO-3 for bridging agent results to the globe
const NAME_TO_ISO: Record<string, string> = {
  'united states': 'USA', 'united kingdom': 'GBR', 'canada': 'CAN',
  'australia': 'AUS', 'germany': 'DEU', 'france': 'FRA', 'japan': 'JPN',
  'south korea': 'KOR', 'singapore': 'SGP', 'india': 'IND', 'china': 'CHN',
  'brazil': 'BRA', 'mexico': 'MEX', 'italy': 'ITA', 'spain': 'ESP',
  'netherlands': 'NLD', 'switzerland': 'CHE', 'sweden': 'SWE',
  'norway': 'NOR', 'denmark': 'DNK', 'finland': 'FIN', 'ireland': 'IRL',
  'portugal': 'PRT', 'austria': 'AUT', 'belgium': 'BEL', 'greece': 'GRC',
  'poland': 'POL', 'turkey': 'TUR', 'russia': 'RUS', 'ukraine': 'UKR',
  'argentina': 'ARG', 'chile': 'CHL', 'colombia': 'COL', 'peru': 'PER',
  'egypt': 'EGY', 'south africa': 'ZAF', 'nigeria': 'NGA', 'kenya': 'KEN',
  'thailand': 'THA', 'vietnam': 'VNM', 'indonesia': 'IDN', 'malaysia': 'MYS',
  'philippines': 'PHL', 'pakistan': 'PAK', 'bangladesh': 'BGD',
  'saudi arabia': 'SAU', 'uae': 'ARE', 'united arab emirates': 'ARE',
  'qatar': 'QAT', 'israel': 'ISR', 'new zealand': 'NZL', 'taiwan': 'TWN',
  'hong kong': 'HKG', 'czech republic': 'CZE', 'czechia': 'CZE',
  'hungary': 'HUN', 'romania': 'ROU', 'croatia': 'HRV',
}

function resolveNationalityToIso(nationality: string): string | null {
  // Already an ISO-3 code (3 uppercase letters)?
  if (/^[A-Z]{3}$/.test(nationality)) return nationality
  return NAME_TO_ISO[nationality.toLowerCase()] || null
}

export default function AgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const { setArcs, setMarkers, clearAll: clearGlobe, setSelectedNationality } = useGlobeStore()

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
            // Handle passport profile tool results
            if (
              (payload.data.name === 'get_passport_profile' || payload.data.name === 'update_passport_profile') &&
              payload.data.result?.passports?.length > 0
            ) {
              const nationality = payload.data.result.passports[0].nationality
              // Try to resolve country name to ISO-3 code
              const iso = resolveNationalityToIso(nationality)
              if (iso) setSelectedNationality(iso)
            }
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
      <GlobeTooltip />
      <ChatOverlay
        messages={messages}
        toolEvents={toolEvents}
        isLoading={isLoading}
        streamingText={streamingText}
        input={input}
        onInputChange={setInput}
        onSend={sendMessage}
        onPassportSaved={(iso) => {
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: `Passport updated. Globe now showing visa requirements for ${iso} passport holders.`,
          }])
        }}
      />
    </>
  )
}

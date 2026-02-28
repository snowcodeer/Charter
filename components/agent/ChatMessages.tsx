'use client'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ToolEvent {
  type: 'tool_call' | 'tool_result'
  name: string
  data: unknown
}

export function ChatMessages({ messages, toolEvents, isLoading }: {
  messages: ChatMessage[]
  toolEvents: ToolEvent[]
  isLoading: boolean
}) {
  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-4">
      {messages.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
            msg.role === 'user'
              ? 'bg-white text-black'
              : 'bg-zinc-900 text-zinc-100 border border-zinc-800'
          }`}>
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      ))}

      {toolEvents.length > 0 && (
        <div className="flex justify-start">
          <div className="max-w-[80%] space-y-1">
            {toolEvents.map((evt, i) => (
              <div key={i} className="text-xs text-zinc-500 font-mono">
                {evt.type === 'tool_call' ? `→ ${evt.name}` : `← ${evt.name} done`}
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2 text-sm text-zinc-400">
            thinking...
          </div>
        </div>
      )}
    </div>
  )
}

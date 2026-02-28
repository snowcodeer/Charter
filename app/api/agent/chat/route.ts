import Anthropic from '@anthropic-ai/sdk'
import { getClaudeTools, executeToolCall } from '@/lib/agent-tools'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are Charter, an AI travel agent. You help users plan trips, check visa requirements, search for flights, manage their calendar, and automate travel paperwork.

You have access to these tools:
- search_web: Search the internet for real-time travel info (visa requirements, flights, travel advisories, embassy info, application forms, etc.)
- get_page_contents: Read the full text of specific web pages
- get_passport_profile: Get the user's saved passport info
- update_passport_profile: Save/update the user's passport details
- check_calendar: Check Google Calendar availability
- create_calendar_event: Add trips/appointments to Google Calendar
- read_emails: Search Gmail for booking confirmations
- start_form_fill: Launch AI browser to auto-fill visa forms

When the user asks about visa requirements, flight prices, or travel info — use search_web to find current, accurate information. Don't guess or use outdated knowledge.

When you search, be specific: include passport nationality, destination country, current year (2026), and what exactly you're looking for.

Be concise, helpful, and proactive. If you know the user's passport nationality, factor it into every search automatically.`

export async function POST(req: Request) {
  const { messages } = (await req.json()) as {
    messages: Anthropic.Messages.MessageParam[]
  }

  const tools = getClaudeTools()

  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const send = async (event: string, data: unknown) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`))
  }

  ;(async () => {
    try {
      const conversationMessages: Anthropic.Messages.MessageParam[] = [...messages]
      const MAX_ITERATIONS = 10

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          tools: tools as Anthropic.Messages.Tool[],
          messages: conversationMessages,
        })

        // Process content blocks, collect tool results
        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []

        for (const block of response.content) {
          if (block.type === 'text') {
            await send('text', { text: block.text })
          } else if (block.type === 'tool_use') {
            await send('tool_call', { id: block.id, name: block.name, input: block.input })

            const result = await executeToolCall(block.name, block.input as Record<string, unknown>)
            await send('tool_result', { id: block.id, name: block.name, result })

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            })
          }
        }

        // Done — no more tool calls
        if (response.stop_reason === 'end_turn') {
          break
        }

        // Tool calls happened — feed results back for next iteration
        if (response.stop_reason === 'tool_use' && toolResults.length > 0) {
          conversationMessages.push({ role: 'assistant', content: response.content })
          conversationMessages.push({ role: 'user', content: toolResults })
          continue
        }

        // Any other stop reason — break
        break
      }

      await send('done', {})
    } catch (err) {
      await send('error', { message: err instanceof Error ? err.message : String(err) })
    } finally {
      await writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

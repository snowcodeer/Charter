import { graph } from '@/lib/agent/graph'
import { AIMessageChunk } from '@langchain/core/messages'
import { ElevenLabsTTS } from '@/lib/agent/tts'
import { setPlan, updatePlanStep, addPlanStepState, clearPlan } from '../browser-command/route'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS })
}

export async function POST(req: Request) {
  const { messages, voiceMode } = await req.json()

  // Convert frontend messages to LangGraph format
  const langGraphMessages = messages.map((m: { role: string; content: string }) => ({
    role: m.role,
    content: m.content,
  }))

  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const send = async (event: string, data: unknown) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`))
  }

  ;(async () => {
    // Clear previous plan state
    clearPlan()

    // Set up TTS if voice mode is enabled
    let tts: ElevenLabsTTS | null = null
    let ttsResolve: (() => void) | null = null

    if (voiceMode && process.env.ELEVENLABS_API_KEY) {
      const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'
      tts = new ElevenLabsTTS({
        voiceId,
        apiKey: process.env.ELEVENLABS_API_KEY,
        onAudioChunk: async (base64Audio) => {
          try { await send('audio', { audio: base64Audio }) } catch { /* stream closed */ }
        },
        onError: (error) => {
          console.error('TTS error:', error)
        },
        onDone: async () => {
          try { await send('audio_done', {}) } catch {}
          if (ttsResolve) ttsResolve()
        },
      })
      try {
        await tts.connect()
      } catch (err) {
        console.error('TTS connect failed:', err)
        tts = null
      }
    }

    try {
      const eventStream = graph.streamEvents(
        { messages: langGraphMessages },
        { version: 'v2' }
      )

      for await (const event of eventStream) {
        // Token-level streaming from the LLM
        if (event.event === 'on_chat_model_stream') {
          const chunk = event.data.chunk as AIMessageChunk

          if (Array.isArray(chunk.content)) {
            for (const block of chunk.content) {
              if (block.type === 'thinking') {
                await send('thinking', { text: block.thinking })
              } else if (block.type === 'text') {
                await send('text', { text: block.text })
                if (tts && block.text) tts.sendText(block.text as string)
              }
            }
          } else if (typeof chunk.content === 'string' && chunk.content) {
            await send('text', { text: chunk.content })
            if (tts) tts.sendText(chunk.content)
          }

          // Tool calls from the model (streamed as partial chunks)
          if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
            for (const tc of chunk.tool_call_chunks) {
              // Only send on first chunk of each tool call (when we have the name)
              if (tc.name) {
                await send('tool_call', { id: tc.id, name: tc.name, input: tc.args })
              }
            }
          }
        }

        // Tool execution start
        if (event.event === 'on_tool_start') {
          // Don't show gather_context internal tool calls as tool_start
          await send('tool_start', { name: event.name })
        }

        // Detect gather_context node completion
        if (event.event === 'on_chain_end' && event.name === 'gather_context') {
          const output = event.data?.output
          if (output?.userContext) {
            await send('context_gathered', { context: output.userContext })
          }
        }

        // Tool execution end — send the result
        if (event.event === 'on_tool_end') {
          const output = event.data.output
          let result: unknown
          try {
            result = typeof output?.content === 'string'
              ? JSON.parse(output.content)
              : output?.content ?? output
          } catch {
            result = output?.content ?? output
          }

          // Detect browser tools → emit browser_action events
          const browserTools = ['browser_navigate', 'browser_scan_page', 'browser_fill_fields', 'browser_click', 'browser_read_page']
          if (browserTools.includes(event.name)) {
            await send('browser_action', { tool: event.name, result })
            // Detect payment page from scan results
            if (event.name === 'browser_scan_page' && result && typeof result === 'object' && (result as Record<string, unknown>).isPaymentPage) {
              await send('payment_gate', {
                message: 'This looks like a payment page. Do you want to enter payment details yourself, or should I look for your payment info?',
                url: (result as Record<string, unknown>).url,
              })
            }
          } else if (event.name === 'plan_steps' && result && typeof result === 'object') {
            const plan = result as { steps: Array<{ id: string; title: string; proof: string }> }
            setPlan(plan.steps.map(s => ({ ...s, status: 'pending' as const })))
            await send('plan', result)
          } else if (event.name === 'complete_step' && result && typeof result === 'object') {
            const update = result as { stepId: string; summary: string; screenshot?: string }
            updatePlanStep(update.stepId, { status: 'done', summary: update.summary, screenshot: update.screenshot })
            await send('plan_update', result)
          } else if (event.name === 'add_plan_step' && result && typeof result === 'object') {
            const newStep = result as { id: string; title: string; proof: string; afterStepId?: string }
            addPlanStepState({ id: newStep.id, title: newStep.title, proof: newStep.proof, status: 'pending' }, newStep.afterStepId)
            await send('plan_add_step', result)
          } else if (event.name === 'propose_actions' && result && typeof result === 'object') {
            await send('approval_request', result)
          } else {
            await send('tool_result', { name: event.name, result })
          }
        }
      }

      // Flush TTS and wait for final audio
      if (tts) {
        tts.flush()
        await new Promise<void>((resolve) => {
          ttsResolve = resolve
          // Safety timeout — don't hang forever
          setTimeout(() => { resolve() }, 3000)
        })
        tts.close()
      }

      await send('done', {})
    } catch (err) {
      console.error('Agent error:', err)
      if (tts) { try { tts.close() } catch {} }
      await send('error', {
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      await writer.close()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

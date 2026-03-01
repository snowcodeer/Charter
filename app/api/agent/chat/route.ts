import { graph } from '@/lib/agent/graph'
import { AIMessageChunk } from '@langchain/core/messages'
import { ElevenLabsTTS } from '@/lib/agent/tts'
import { setPlan, updatePlanStep, addPlanStepState, clearPlan, pushStreamEvent, clearStreamEvents, flushPendingCommands } from '../browser-command/route'
import { log, logError } from '@/lib/logger'
import { getDeviceId } from '@/lib/device'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Per-device abort controllers and run IDs.
// IMPORTANT: Use globalThis to survive HMR (Next.js Fast Refresh re-evaluates
// the module, which would reset module-level variables and orphan running agents).
const g = globalThis as unknown as {
  __charter_aborts?: Map<string, AbortController | null>
  __charter_runIds?: Map<string, number>
}
if (!g.__charter_aborts) g.__charter_aborts = new Map()
if (!g.__charter_runIds) g.__charter_runIds = new Map()

function getCurrentAbort(deviceId: string) { return g.__charter_aborts!.get(deviceId) ?? null }
function setCurrentAbort(deviceId: string, v: AbortController | null) { g.__charter_aborts!.set(deviceId, v) }
function getRunId(deviceId: string) { return g.__charter_runIds!.get(deviceId) ?? 0 }
function nextRunId(deviceId: string) {
  const next = (g.__charter_runIds!.get(deviceId) ?? 0) + 1
  g.__charter_runIds!.set(deviceId, next)
  return next
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS })
}

export async function POST(req: Request) {
  const deviceId = await getDeviceId()
  const { messages, voiceMode, actionMode } = await req.json()
  log('agent', 'Incoming chat request', {
    messageCount: Array.isArray(messages) ? messages.length : 0,
    voiceMode: !!voiceMode,
    actionMode: !!actionMode,
    deviceId,
  })

  // KILL previous agent run for THIS device — only ONE agent at a time per device
  const prevAbort = getCurrentAbort(deviceId)
  if (prevAbort) {
    log('agent', `Aborting previous run`, { runId: getRunId(deviceId), deviceId })
    prevAbort.abort()
  }
  const abort = new AbortController()
  setCurrentAbort(deviceId, abort)
  const runId = nextRunId(deviceId)

  // Clear previous plan + stream state + pending browser commands for this device
  clearPlan(deviceId)
  clearStreamEvents(deviceId)
  flushPendingCommands(deviceId)
  // Convert frontend messages to LangGraph format
  const langGraphMessages = messages.map((m: { role: string; content: string }) => ({
    role: m.role,
    content: m.content,
  }))
  log('agent', `Starting new agent run`, { runId, deviceId, messageCount: langGraphMessages.length })

  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const isAborted = () => abort.signal.aborted || runId !== getRunId(deviceId)

  const send = async (event: string, data: unknown) => {
    if (isAborted()) return
    pushStreamEvent(deviceId, event, data)
    // Log every SSE event with compact payloads for high-frequency chunks.
    let payloadForLog: unknown = data
    if (event === 'text' || event === 'thinking') {
      const txt = (data as { text?: string })?.text || ''
      payloadForLog = { len: txt.length, text: txt.slice(0, 200) }
    } else if (event === 'audio') {
      const audio = (data as { audio?: string })?.audio || ''
      payloadForLog = { b64Length: audio.length }
    } else if (event === 'token_usage') {
      payloadForLog = data
    }
    log('sse', `${event}`, {
      runId,
      deviceId,
      ...(typeof payloadForLog === 'object' && payloadForLog ? payloadForLog as Record<string, unknown> : { data: payloadForLog }),
    })
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`))
    } catch { /* stream closed */ }
  }

  ;(async () => {
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
          logError('tts', 'TTS streaming error', error)
        },
        onDone: async () => {
          try { await send('audio_done', {}) } catch {}
          if (ttsResolve) ttsResolve()
        },
      })
      try {
        await tts.connect()
      } catch (err) {
        logError('tts', 'TTS connect failed', err)
        tts = null
      }
    }

    try {
      const eventStream = graph.streamEvents(
        { messages: langGraphMessages, actionMode: !!actionMode, deviceId },
        { version: 'v2', recursionLimit: actionMode ? 150 : 50, signal: abort.signal, configurable: { deviceId } }
      )

      let totalInputTokens = 0
      let totalOutputTokens = 0
      const emittedToolCallIds = new Set<string>()

      for await (const event of eventStream) {
        // Check if this run was cancelled by a newer one
        if (isAborted()) {
          log('agent', `Aborted — newer run active`, { runId, activeRunId: getRunId(deviceId), deviceId })
          break
        }

        // Track token usage from LLM calls
        if (event.event === 'on_llm_end') {
          const usage = event.data?.output?.usage_metadata
          if (usage) {
            totalInputTokens = usage.input_tokens ?? totalInputTokens
            totalOutputTokens += usage.output_tokens ?? 0
            await send('token_usage', {
              input: totalInputTokens,
              output: totalOutputTokens,
              total: totalInputTokens + totalOutputTokens,
              limit: 200000,
            })
          }
        }

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
              // Deduplicate by tool call ID — extended thinking can re-emit the same tc.name
              if (tc.name && tc.id && !emittedToolCallIds.has(tc.id)) {
                emittedToolCallIds.add(tc.id)
                await send('tool_call', { id: tc.id, name: tc.name, input: tc.args })
              }
            }
          }
        }

        // Tool execution start
        if (event.event === 'on_tool_start') {
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
          const browserTools = ['browser_navigate', 'browser_scan_page', 'browser_fill_fields', 'browser_click', 'browser_read_page', 'browser_screenshot', 'browser_execute_js', 'browser_solve_captcha']
          if (browserTools.includes(event.name)) {
            await send('browser_action', { tool: event.name, result })
            // Send detailed scan log so user can see what happened
            if (event.name === 'browser_scan_page' && result && typeof result === 'object') {
              const scanResult = result as Record<string, unknown>
              const scanData = (scanResult.result || scanResult) as Record<string, unknown>
              const summary = {
                fields: (scanData.fields as unknown[])?.length || 0,
                buttons: (scanData.buttons as unknown[])?.length || 0,
                links: (scanData.links as unknown[])?.length || 0,
                sections: (scanData.sections as unknown[])?.length || 0,
                errors: (scanData.errors as unknown[])?.length || 0,
                method: scanData._scanMethod || 'dom',
                log: scanData._log || [],
              }
              await send('scan_log', summary)
            }
            // Detect payment page from scan results
            if (event.name === 'browser_scan_page' && result && typeof result === 'object' && (result as Record<string, unknown>).isPaymentPage) {
              await send('payment_gate', {
                message: 'This looks like a payment page. Do you want to enter payment details yourself, or should I look for your payment info?',
                url: (result as Record<string, unknown>).url,
              })
            }
          } else if (event.name === 'plan_steps' && result && typeof result === 'object') {
            const plan = result as { steps: Array<{ id: string; title: string; proof: string }> }
            setPlan(deviceId, plan.steps.map(s => ({ ...s, status: 'pending' as const })))
            await send('plan', result)
          } else if (event.name === 'complete_step' && result && typeof result === 'object') {
            const update = result as { stepId: string; summary: string; screenshot?: string }
            updatePlanStep(deviceId, update.stepId, { status: 'done', summary: update.summary, screenshot: update.screenshot })
            await send('plan_update', result)
          } else if (event.name === 'add_plan_step' && result && typeof result === 'object') {
            const newStep = result as { id: string; title: string; proof: string; afterStepId?: string }
            addPlanStepState(deviceId, { id: newStep.id, title: newStep.title, proof: newStep.proof, status: 'pending' }, newStep.afterStepId)
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
      if (isAborted() || (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('abort')))) {
        log('agent', `Aborted (signal fired, LLM calls killed)`, { runId, deviceId })
      } else {
        logError('agent', 'Agent error', err)
        await send('error', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
      if (tts) { try { tts.close() } catch {} }
    } finally {
      try { await writer.close() } catch {}
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

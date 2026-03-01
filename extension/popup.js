// Production URL — update this after deploying to Fly.io
const API_BASE = 'https://charter-london.fly.dev'

const messagesEl = document.getElementById('messages')
const chatForm = document.getElementById('chat-form')
const chatInput = document.getElementById('chat-input')
const sendBtn = document.getElementById('send-btn')
const pageContextBtn = document.getElementById('page-context-btn')

let conversationHistory = []
let isLoading = false
let widgetToolEvents = []

// --- Audio Playback (TTS) ---
let audioCtx = null
let nextPlayTime = 0

function getAudioCtx() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext({ sampleRate: 24000 })
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function playAudioChunk(base64) {
  const ctx = getAudioCtx()
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  const int16 = new Int16Array(bytes.buffer)
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0

  const buf = ctx.createBuffer(1, float32.length, 24000)
  buf.getChannelData(0).set(float32)

  const now = ctx.currentTime
  if (nextPlayTime < now) nextPlayTime = now

  const source = ctx.createBufferSource()
  source.buffer = buf
  source.connect(ctx.destination)
  source.start(nextPlayTime)
  nextPlayTime += buf.duration
}

// Broadcast state to widget via background script
function broadcastState(updates) {
  chrome.runtime?.sendMessage({
    type: 'AGENT_STATE_UPDATE',
    ...updates,
  }).catch(() => {})
}

// --- Rendering ---

function clearEmptyState() {
  const empty = messagesEl.querySelector('.empty-state')
  if (empty) empty.remove()
}

function addMessage(role, content) {
  clearEmptyState()
  const div = document.createElement('div')
  div.className = `message ${role}`
  div.textContent = content
  messagesEl.appendChild(div)
  messagesEl.scrollTop = messagesEl.scrollHeight
  return div
}

function addThinkingIndicator() {
  clearEmptyState()
  const div = document.createElement('div')
  div.className = 'message thinking-indicator'
  div.id = 'thinking-indicator'
  div.innerHTML = '<span class="thinking-dot"></span> reasoning...'
  messagesEl.appendChild(div)
  messagesEl.scrollTop = messagesEl.scrollHeight
  return div
}

function removeThinkingIndicator() {
  const el = document.getElementById('thinking-indicator')
  if (el) el.remove()
}

function addToolEvent(name, isDone) {
  clearEmptyState()
  const div = document.createElement('div')
  div.className = 'tool-event'
  div.innerHTML = `<span class="tool-dot ${isDone ? 'done' : 'active'}"></span> ${name}${isDone ? ' done' : ''}`
  messagesEl.appendChild(div)
  messagesEl.scrollTop = messagesEl.scrollHeight
}

let streamingDiv = null

function appendStreamingText(text) {
  if (!streamingDiv) {
    clearEmptyState()
    removeThinkingIndicator()
    streamingDiv = document.createElement('div')
    streamingDiv.className = 'message assistant'
    messagesEl.appendChild(streamingDiv)
  }
  streamingDiv.textContent += text
  messagesEl.scrollTop = messagesEl.scrollHeight
}

function finalizeStreaming(fullText) {
  if (streamingDiv) {
    streamingDiv = null
  }
  if (fullText) {
    conversationHistory.push({ role: 'assistant', content: fullText })
  }
}

// --- API ---

async function sendMessage(text) {
  if (isLoading || !text.trim()) return

  isLoading = true
  sendBtn.disabled = true
  chatInput.disabled = true
  widgetToolEvents = []

  addMessage('user', text)
  conversationHistory.push({ role: 'user', content: text })

  broadcastState({ isActive: true, isThinking: false, toolEvents: [], approvalActions: [] })

  let fullText = ''
  let hasThinking = false

  try {
    const res = await fetch(`${API_BASE}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: conversationHistory.map(m => ({ role: m.role, content: m.content })),
      }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        let payload
        try {
          payload = JSON.parse(line.slice(6))
        } catch {
          continue
        }

        if (payload.event === 'thinking') {
          if (!hasThinking) {
            addThinkingIndicator()
            hasThinking = true
          }
          broadcastState({ isThinking: true })
        } else if (payload.event === 'text') {
          removeThinkingIndicator()
          appendStreamingText(payload.data.text)
          fullText += payload.data.text
          broadcastState({ isThinking: false })
        } else if (payload.event === 'tool_call') {
          addToolEvent(payload.data.name, false)
          widgetToolEvents.push({ name: payload.data.name, detail: payload.data.input?.query || '', done: false })
          broadcastState({ toolEvents: [...widgetToolEvents] })
        } else if (payload.event === 'tool_start') {
          // Skip duplicate display; tool_call already represents this tool.
        } else if (payload.event === 'tool_result') {
          addToolEvent(payload.data.name, true)
          const idx = widgetToolEvents.findLastIndex(e => e.name === payload.data.name && !e.done)
          if (idx >= 0) widgetToolEvents[idx].done = true
          broadcastState({ toolEvents: [...widgetToolEvents] })
          if (fullText) {
            finalizeStreaming(fullText)
            fullText = ''
          }
        } else if (payload.event === 'approval_request') {
          removeThinkingIndicator()
          if (fullText) {
            finalizeStreaming(fullText)
            fullText = ''
          }
          // Show mini approval cards (simplified in popup)
          const req = payload.data
          addMessage('assistant', req.summary || 'Here\'s my plan:')
          broadcastState({ approvalActions: req.actions || [] })
        } else if (payload.event === 'browser_action') {
          const d = payload.data
          const tool = d.tool || ''
          const r = d.result || {}
          let msg = tool
          if (tool === 'browser_navigate') msg = `🌐 navigated to ${r.url || 'page'}`
          else if (tool === 'browser_scan_page') msg = `🔍 scanned — ${r.fields?.length || 0} fields${r.isPaymentPage ? ' (PAYMENT)' : ''}`
          else if (tool === 'browser_fill_fields') msg = `✍️ filled ${r.results?.length || 0} fields`
          else if (tool === 'browser_click') msg = `👆 clicked "${r.text || 'element'}"`
          else if (tool === 'browser_read_page') msg = `📄 read page`
          addToolEvent(msg, true)
          broadcastState({ browserAction: payload.data })
        } else if (payload.event === 'payment_gate') {
          removeThinkingIndicator()
          addMessage('assistant', `\ud83d\udcb3 ${payload.data.message}`)
          broadcastState({ paymentGate: payload.data })
        } else if (payload.event === 'audio') {
          playAudioChunk(payload.data.audio)
        } else if (payload.event === 'audio_done') {
          // All audio chunks received — playback continues from queue
        } else if (payload.event === 'done') {
          removeThinkingIndicator()
          finalizeStreaming(fullText)
          broadcastState({ isActive: false, isThinking: false, toolEvents: [] })
        } else if (payload.event === 'error') {
          removeThinkingIndicator()
          addMessage('assistant', `Error: ${payload.data.message}`)
          broadcastState({ isActive: false, isThinking: false })
        }
      }
    }

    // Finalize if stream ended without done event
    if (fullText) {
      finalizeStreaming(fullText)
    }
  } catch (err) {
    removeThinkingIndicator()
    addMessage('assistant', `Connection error: ${err.message}`)
  } finally {
    isLoading = false
    sendBtn.disabled = false
    chatInput.disabled = false
    chatInput.focus()
    broadcastState({ isActive: false, isThinking: false })
  }
}

// --- Page Context ---

pageContextBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Get page title, URL, and selected text or meta description
        const selection = window.getSelection()?.toString()?.trim()
        const meta = document.querySelector('meta[name="description"]')?.content || ''
        const h1 = document.querySelector('h1')?.textContent?.trim() || ''
        return {
          title: document.title,
          url: window.location.href,
          selectedText: selection || '',
          description: meta,
          heading: h1,
        }
      },
    })

    if (result?.result) {
      const ctx = result.result
      let contextMsg = `I'm on this page: ${ctx.title}\nURL: ${ctx.url}`
      if (ctx.selectedText) {
        contextMsg += `\n\nSelected text:\n${ctx.selectedText.slice(0, 1000)}`
      } else if (ctx.description) {
        contextMsg += `\n\nPage description: ${ctx.description}`
      }
      contextMsg += '\n\nCan you help me with this page?'

      chatInput.value = contextMsg
      chatInput.focus()
    }
  } catch (err) {
    console.error('Failed to get page context:', err)
  }
})

// --- Form Submit ---

chatForm.addEventListener('submit', (e) => {
  e.preventDefault()
  const text = chatInput.value.trim()
  if (!text) return
  chatInput.value = ''
  sendMessage(text)
})

// --- Listen for widget approvals relayed via background ---
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'APPROVAL_FROM_WIDGET') {
    // Widget approved/skipped an action — send as chat message
    const action = msg.action === 'approve' ? 'APPROVED' : 'SKIPPED'
    sendMessage(`[${action}] Action ${msg.actionId}`)
  }
})

// --- Keep service worker alive from popup too ---
let keepalivePort = null
try {
  keepalivePort = chrome.runtime.connect({ name: 'charter-keepalive' })
} catch {}

setInterval(() => {
  if (keepalivePort) {
    try { keepalivePort.postMessage({ type: 'POLL' }) } catch {}
  }
}, 500)

// Focus input on load
chatInput.focus()

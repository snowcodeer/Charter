// Charter floating widget — injected on every page via content script
// Full chat interface: see agent text, tool calls, browser actions, and talk back

;(function () {
  // Only render widget in top frame — not inside iframes
  if (window !== window.top) return
  // Don't show on localhost (the Charter app itself)
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return
  if (document.getElementById('charter-widget-root')) return

  const API_BASE = 'http://localhost:3000'

  // --- State ---
  let isOpen = false
  let isActive = false
  let toolEvents = []
  let isThinking = false
  let approvalActions = []
  let filledFields = []
  let chatMessages = [] // { role: 'user'|'assistant'|'tool'|'browser', content: string }
  let conversationHistory = []
  let streamingText = ''
  let isSending = false
  let widgetStreamSeq = 0 // Track our own cursor for direct stream polling
  let persistTimer = null

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

  // --- DOM ---
  const root = document.createElement('div')
  root.id = 'charter-widget-root'
  document.body.appendChild(root)

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function schedulePersist() {
    if (persistTimer) return
    persistTimer = setTimeout(() => {
      persistTimer = null
      try {
        chrome.storage?.local?.set({
          charterWidgetChatMessages: chatMessages.slice(-300),
          charterWidgetConversationHistory: conversationHistory.slice(-200),
          charterWidgetStreamSeq: widgetStreamSeq,
        })
      } catch {}
    }, 250)
  }

  function render() {
    const hasApproval = approvalActions.length > 0
    const hasBadge = isActive || hasApproval || chatMessages.length > 0

    root.innerHTML = `
      <div class="charter-panel ${isOpen ? 'open' : ''}">
        <div class="charter-panel-header">
          <span class="charter-panel-title">Charter</span>
          <span class="charter-panel-status">${isActive ? 'Working...' : 'Idle'}</span>
        </div>
        <div class="charter-panel-body" id="charter-panel-body">
          ${chatMessages.length === 0 && !isActive && !streamingText ? `
            <div class="charter-idle">Ask me anything about travel</div>
          ` : ''}
          ${chatMessages.map(msg => {
            if (msg.role === 'user') {
              return `<div class="charter-msg charter-msg-user">${escapeHtml(msg.content)}</div>`
            } else if (msg.role === 'assistant') {
              return `<div class="charter-msg charter-msg-assistant">${escapeHtml(msg.content)}</div>`
            } else if (msg.role === 'tool') {
              return `<div class="charter-tool-event">
                <span class="charter-tool-dot ${msg.done ? 'done' : 'active'}"></span>
                ${escapeHtml(msg.content)}
              </div>`
            } else if (msg.role === 'browser') {
              return `<div class="charter-browser-event">
                <span class="charter-browser-dot"></span>
                ${escapeHtml(msg.content)}
              </div>`
            }
            return ''
          }).join('')}
          ${isThinking ? `
            <div class="charter-thinking">
              <span class="charter-thinking-dot"></span>
              reasoning...
            </div>
          ` : ''}
          ${streamingText ? `
            <div class="charter-msg charter-msg-assistant">${escapeHtml(streamingText)}</div>
          ` : ''}
          ${filledFields.map(f => `
            <div class="charter-field-fill">
              <span class="charter-fill-dot"></span>
              ${escapeHtml(f.label)} <span class="charter-fill-source">\u2190 ${escapeHtml(f.source)}</span>
            </div>
          `).join('')}
          ${approvalActions.map(action => `
            <div class="charter-mini-card">
              <div class="charter-mini-card-title">${escapeHtml(action.title)}</div>
              <div class="charter-mini-card-desc">${escapeHtml(action.description || '')}</div>
              <div class="charter-mini-card-actions">
                <button class="charter-mini-card-btn approve" data-action-id="${action.id}" data-action="approve">Approve</button>
                <button class="charter-mini-card-btn skip" data-action-id="${action.id}" data-action="skip">Skip</button>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="charter-panel-input">
          <form id="charter-chat-form">
            <input type="text" id="charter-chat-input" placeholder="Talk to Charter..." autocomplete="off" ${isSending ? 'disabled' : ''} />
            <button type="submit" id="charter-send-btn" ${isSending ? 'disabled' : ''}>\u2192</button>
          </form>
        </div>
      </div>
      <div class="charter-mascot ${isActive ? 'active' : ''}">
        <span class="charter-mascot-letter">C</span>
        ${hasBadge ? `<span class="charter-mascot-badge ${hasApproval ? 'approval' : ''}"></span>` : ''}
      </div>
    `

    // Scroll chat to bottom
    const body = root.querySelector('#charter-panel-body')
    if (body) body.scrollTop = body.scrollHeight
    schedulePersist()

    // Bind mascot click
    root.querySelector('.charter-mascot')?.addEventListener('click', () => {
      isOpen = !isOpen
      render()
      // Focus input when opening
      if (isOpen) {
        setTimeout(() => {
          root.querySelector('#charter-chat-input')?.focus()
        }, 50)
      }
    })

    // Bind chat form
    root.querySelector('#charter-chat-form')?.addEventListener('submit', (e) => {
      e.preventDefault()
      const input = root.querySelector('#charter-chat-input')
      const text = input?.value?.trim()
      if (!text) return
      input.value = ''
      sendChatMessage(text)
    })

    // Bind approval buttons
    root.querySelectorAll('.charter-mini-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const el = e.target
        const actionId = el.getAttribute('data-action-id')
        const action = el.getAttribute('data-action')
        handleApproval(actionId, action)
      })
    })
  }

  async function syncStreamCursor() {
    try {
      const res = await fetch(`${API_BASE}/api/agent/browser-command?streamSince=999999&streamOnly=1`)
      const data = await res.json()
      if (typeof data.streamSeq === 'number') widgetStreamSeq = data.streamSeq
    } catch {}
  }

  // --- Send chat message from widget ---

  async function sendChatMessage(text) {
    if (isSending) return
    isSending = true
    await syncStreamCursor()
    isActive = true
    streamingText = ''

    chatMessages.push({ role: 'user', content: text })
    conversationHistory.push({ role: 'user', content: text })
    render()

    broadcastState({ isActive: true, isThinking: false, toolEvents: [], approvalActions: [] })

    let fullText = ''

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
          try { payload = JSON.parse(line.slice(6)) } catch { continue }

          if (payload.event === 'thinking') {
            isThinking = true
            render()
          } else if (payload.event === 'text') {
            isThinking = false
            fullText += payload.data.text
            streamingText = fullText
            render()
          } else if (payload.event === 'tool_call') {
            const name = payload.data.name
            const query = payload.data.input?.query || payload.data.input?.url || ''
            chatMessages.push({ role: 'tool', content: `${name}${query ? ' "' + query + '"' : ''}`, done: false })
            render()
          } else if (payload.event === 'tool_start') {
            // Skip duplicate display; tool_call already represents this tool.
          } else if (payload.event === 'tool_result') {
            chatMessages.push({ role: 'tool', content: `${payload.data.name} done`, done: true })
            if (fullText) {
              chatMessages.push({ role: 'assistant', content: fullText })
              conversationHistory.push({ role: 'assistant', content: fullText })
              fullText = ''
              streamingText = ''
            }
            render()
          } else if (payload.event === 'browser_action') {
            const d = payload.data
            const tool = d.tool || ''
            const r = d.result || {}
            let msg = tool
            if (tool === 'browser_navigate') msg = `\uD83C\uDF10 navigated to ${r.url || 'page'}`
            else if (tool === 'browser_scan_page') msg = `\uD83D\uDD0D scanned — ${r.fields?.length || 0} fields found${r.isPaymentPage ? ' (PAYMENT PAGE)' : ''}`
            else if (tool === 'browser_fill_fields') msg = `\u270D\uFE0F filled ${r.results?.length || 0} fields`
            else if (tool === 'browser_click') msg = `\uD83D\uDC46 clicked "${r.text || 'element'}"`
            else if (tool === 'browser_read_page') msg = `\uD83D\uDCC4 read page content`
            chatMessages.push({ role: 'browser', content: msg })
            render()
          } else if (payload.event === 'approval_request') {
            if (fullText) {
              chatMessages.push({ role: 'assistant', content: fullText })
              conversationHistory.push({ role: 'assistant', content: fullText })
              fullText = ''
              streamingText = ''
            }
            const req = payload.data
            if (req.summary) {
              chatMessages.push({ role: 'assistant', content: req.summary })
            }
            approvalActions = req.actions || []
            render()
          } else if (payload.event === 'payment_gate') {
            chatMessages.push({ role: 'browser', content: `\uD83D\uDCB3 ${payload.data.message}` })
            render()
          } else if (payload.event === 'context_gathered') {
            chatMessages.push({ role: 'tool', content: 'context loaded — passport, calendar, emails', done: true })
            render()
          } else if (payload.event === 'audio') {
            playAudioChunk(payload.data.audio)
          } else if (payload.event === 'audio_done') {
            // All audio chunks received — playback continues from queue
          } else if (payload.event === 'done') {
            isThinking = false
            if (fullText) {
              chatMessages.push({ role: 'assistant', content: fullText })
              conversationHistory.push({ role: 'assistant', content: fullText })
              fullText = ''
              streamingText = ''
            }
            render()
          } else if (payload.event === 'error') {
            isThinking = false
            chatMessages.push({ role: 'assistant', content: `Error: ${payload.data.message}` })
            render()
          }
        }
      }

      if (fullText) {
        chatMessages.push({ role: 'assistant', content: fullText })
        conversationHistory.push({ role: 'assistant', content: fullText })
        streamingText = ''
      }
    } catch (err) {
      chatMessages.push({ role: 'assistant', content: `Connection error: ${err.message}` })
    } finally {
      await syncStreamCursor()
      isSending = false
      isActive = false
      isThinking = false
      streamingText = ''
      broadcastState({ isActive: false, isThinking: false })
      render()
    }
  }

  function broadcastState(updates) {
    chrome.runtime?.sendMessage({
      type: 'AGENT_STATE_UPDATE',
      ...updates,
    }).catch(() => {})
  }

  function handleApproval(actionId, action) {
    chrome.runtime.sendMessage({
      type: 'WIDGET_APPROVAL',
      actionId,
      action,
    })
    approvalActions = approvalActions.filter(a => a.id !== actionId)

    // Also send approval via chat
    const actionType = action === 'approve' ? 'APPROVED' : 'SKIPPED'
    sendChatMessage(`[${actionType}] Action ${actionId}`)
  }

  // --- Listen for state updates from background/popup ---
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'AGENT_STATE_UPDATE') {
      if (msg.toolEvents !== undefined) toolEvents = msg.toolEvents
      if (msg.isThinking !== undefined) isThinking = msg.isThinking
      if (msg.isActive !== undefined) isActive = msg.isActive
      if (msg.approvalActions !== undefined) approvalActions = msg.approvalActions
      render()
    }

    if (msg.type === 'FIELD_FILLED') {
      filledFields.push({ label: msg.label, source: msg.source })
      chatMessages.push({ role: 'browser', content: `\u270D\uFE0F ${msg.label} \u2190 ${msg.source}` })
      render()
      setTimeout(() => {
        filledFields = filledFields.slice(1)
        render()
      }, 3000)
    }

    // Toggle widget open/closed from extension icon click
    if (msg.type === 'TOGGLE_WIDGET') {
      isOpen = !isOpen
      render()
      if (isOpen) {
        setTimeout(() => { root.querySelector('#charter-chat-input')?.focus() }, 50)
      }
    }

    // CHARTER_STREAM_EVENTS from background.js — no longer needed, widget polls directly
    // (kept as no-op to avoid errors from background broadcast)
  })

  // --- Keep service worker alive ---
  // MV3 service workers sleep after 30s. Persistent port + periodic POLL keeps it awake
  // so background.js can execute browser commands (open tabs, fill forms, etc.)
  let keepalivePort = null

  function connectKeepalive() {
    try {
      keepalivePort = chrome.runtime.connect({ name: 'charter-keepalive' })
      keepalivePort.onDisconnect.addListener(() => {
        keepalivePort = null
        // Reconnect after a short delay
        setTimeout(connectKeepalive, 1000)
      })
    } catch {
      setTimeout(connectKeepalive, 2000)
    }
  }

  connectKeepalive()

  // Send POLL messages to trigger command polling in background
  setInterval(() => {
    if (keepalivePort) {
      try {
        keepalivePort.postMessage({ type: 'POLL' })
      } catch {
        // Port disconnected — reconnect will handle it
      }
    }
  }, 500)

  // --- Direct stream polling (loads history + live updates) ---
  // Widget polls the server directly instead of relying on background.js relay
  // This ensures it always gets ALL events, even ones from before the widget loaded

  function processStreamEvent(payload) {
    if (payload.event === 'thinking') {
      isThinking = true
      isActive = true
    } else if (payload.event === 'text') {
      isThinking = false
      isActive = true
      streamingText += (payload.data?.text || '')
    } else if (payload.event === 'tool_call') {
      const name = payload.data?.name || ''
      const query = payload.data?.input?.query || payload.data?.input?.url || ''
      chatMessages.push({ role: 'tool', content: `${name}${query ? ' "' + query + '"' : ''}`, done: false })
    } else if (payload.event === 'tool_start') {
      // Skip duplicate display; tool_call already represents this tool.
    } else if (payload.event === 'tool_result') {
      chatMessages.push({ role: 'tool', content: `${payload.data?.name || 'tool'} done`, done: true })
      if (streamingText) {
        chatMessages.push({ role: 'assistant', content: streamingText })
        streamingText = ''
      }
    } else if (payload.event === 'browser_action') {
      const d = payload.data || {}
      const tool = d.tool || ''
      const r = d.result || {}
      let bmsg = tool
      if (tool === 'browser_navigate') bmsg = `\uD83C\uDF10 navigated to ${r.url || 'page'}`
      else if (tool === 'browser_scan_page') bmsg = `\uD83D\uDD0D scanned \u2014 ${r.fields?.length || 0} fields found${r.isPaymentPage ? ' (PAYMENT PAGE)' : ''}`
      else if (tool === 'browser_fill_fields') bmsg = `\u270D\uFE0F filled ${r.results?.length || 0} fields`
      else if (tool === 'browser_click') bmsg = `\uD83D\uDC46 clicked "${r.text || 'element'}"`
      else if (tool === 'browser_read_page') bmsg = `\uD83D\uDCC4 read page content`
      else if (tool === 'browser_screenshot') bmsg = `\uD83D\uDCF7 took screenshot`
      else if (tool === 'browser_solve_captcha') bmsg = `\uD83E\uDD16 solved captcha`
      else if (tool === 'browser_execute_js') bmsg = `\u26A1 executed JS`
      chatMessages.push({ role: 'browser', content: bmsg })
    } else if (payload.event === 'approval_request') {
      if (streamingText) {
        chatMessages.push({ role: 'assistant', content: streamingText })
        streamingText = ''
      }
      const req = payload.data || {}
      if (req.summary) chatMessages.push({ role: 'assistant', content: req.summary })
      approvalActions = req.actions || []
    } else if (payload.event === 'context_gathered') {
      chatMessages.push({ role: 'tool', content: 'context loaded \u2014 passport, calendar, emails', done: true })
    } else if (payload.event === 'audio') {
      playAudioChunk(payload.data?.audio)
    } else if (payload.event === 'done') {
      isThinking = false
      isActive = false
      if (streamingText) {
        chatMessages.push({ role: 'assistant', content: streamingText })
        streamingText = ''
      }
    } else if (payload.event === 'error') {
      isThinking = false
      isActive = false
      chatMessages.push({ role: 'assistant', content: `Error: ${payload.data?.message || 'Unknown'}` })
    }
  }

  async function pollStreamEvents() {
    if (isSending) return
    try {
      const res = await fetch(`${API_BASE}/api/agent/browser-command?streamSince=${widgetStreamSeq}&streamOnly=1`)
      const data = await res.json()
      const events = data.streamEvents || []
      if (events.length > 0) {
        widgetStreamSeq = data.streamSeq || widgetStreamSeq
        for (const ev of events) processStreamEvent(ev)
        render()
      }
    } catch {}
  }

  // Poll every 500ms for stream events (loads history on first call + live updates)
  setInterval(pollStreamEvents, 500)
  // Load immediately
  pollStreamEvents()

  // --- Initial render ---
  render()

  // --- Sync state from storage on load ---
  chrome.storage?.local?.get(['charterState', 'charterWidgetChatMessages', 'charterWidgetConversationHistory', 'charterWidgetStreamSeq'], (result) => {
    if (result.charterState) {
      const state = result.charterState
      toolEvents = state.toolEvents || []
      isThinking = state.isThinking || false
      isActive = state.isActive || false
      approvalActions = state.approvalActions || []
    }
    if (Array.isArray(result.charterWidgetChatMessages)) chatMessages = result.charterWidgetChatMessages
    if (Array.isArray(result.charterWidgetConversationHistory)) conversationHistory = result.charterWidgetConversationHistory
    if (typeof result.charterWidgetStreamSeq === 'number') widgetStreamSeq = result.charterWidgetStreamSeq
    render()
  })
})()

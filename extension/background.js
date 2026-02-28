// Service worker — relays agent state AND executes browser commands
// IMPORTANT: MV3 service workers sleep after 30s. We use port connections
// from content scripts to stay alive, and poll on every keepalive ping.

const API_BASE = 'http://localhost:3000'

let currentState = {
  isActive: false,
  isThinking: false,
  toolEvents: [],
  approvalActions: [],
}

let automationTabId = null
let isPolling = false
let streamSeqCursor = 0

// --- Broadcast to all tabs ---
function broadcastToAll(message) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) chrome.tabs.sendMessage(tab.id, message).catch(() => {})
    }
  })
}

// --- Command Polling ---
// Don't use setInterval (dies when worker sleeps).
// Instead, content scripts send KEEPALIVE messages that trigger polling.

async function pollForCommands() {
  if (isPolling) return // prevent overlapping polls
  isPolling = true
  try {
    const res = await fetch(`${API_BASE}/api/agent/browser-command?streamSince=${streamSeqCursor}`)
    const data = await res.json()
    const cmds = data.commands || []
    if (cmds.length > 0) {
      console.log(`[Charter] Got ${cmds.length} command(s):`, cmds.map(c => c.action))
    }
    for (const cmd of cmds) {
      await executeCommand(cmd)
    }

    // Relay plan state to automation tab's content script
    const plan = data.plan || []
    if (automationTabId) {
      chrome.tabs.sendMessage(automationTabId, { type: 'CHARTER_PLAN_SYNC', plan }).catch(() => {})
    }

    // Relay stream events to all tabs (so widget mirrors main app)
    const streamEvents = data.streamEvents || []
    if (streamEvents.length > 0) {
      streamSeqCursor = data.streamSeq || streamSeqCursor
      broadcastToAll({ type: 'CHARTER_STREAM_EVENTS', events: streamEvents })
    }
  } catch (err) {
    // Server not running — silent
  } finally {
    isPolling = false
  }
}

// --- Multi-frame helpers ---
// Many sites (visa portals, gov sites) put forms inside iframes.
// These helpers send messages to ALL frames in a tab.

async function getFrameIds(tabId) {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId })
    return frames ? frames.map(f => f.frameId) : [0]
  } catch {
    return [0]
  }
}

async function scanAllFrames(tabId) {
  const frameIds = await getFrameIds(tabId)
  let allFields = []
  let allButtons = []
  let isPaymentPage = false
  let hasCaptcha = false
  let url = ''
  let title = ''

  for (const frameId of frameIds) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, { type: 'BROWSER_SCAN_PAGE' }, { frameId })
      if (result?.fields?.length) {
        // Tag fields with frameId so fill_fields can target the right frame
        allFields.push(...result.fields.map(f => ({ ...f, frameId })))
      }
      if (result?.buttons?.length) allButtons.push(...result.buttons.map(b => ({ ...b, frameId })))
      if (result?.isPaymentPage) isPaymentPage = true
      if (result?.hasCaptcha) hasCaptcha = true
      if (result?.url && !url) { url = result.url; title = result.title }
    } catch {
      // Frame not accessible or content script not loaded — skip
    }
  }

  return { fields: allFields, buttons: allButtons, isPaymentPage, hasCaptcha, url: url || '', title: title || '' }
}

async function sendToAllFrames(tabId, message) {
  const frameIds = await getFrameIds(tabId)
  for (const frameId of frameIds) {
    try {
      chrome.tabs.sendMessage(tabId, message, { frameId })
    } catch {}
  }
}

async function sendToFirstResponder(tabId, message) {
  const frameIds = await getFrameIds(tabId)
  for (const frameId of frameIds) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, message, { frameId })
      if (result && result.status !== 'not_found') return result
    } catch {}
  }
  return { status: 'not_found', error: 'Element not found in any frame' }
}

async function readAllFrames(tabId, selector) {
  const frameIds = await getFrameIds(tabId)
  let combinedText = ''
  let url = ''
  let title = ''

  for (const frameId of frameIds) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, { type: 'BROWSER_READ_PAGE', selector }, { frameId })
      if (result?.text) combinedText += result.text + '\n'
      if (result?.url && !url) { url = result.url; title = result.title || '' }
    } catch {}
  }

  return { text: combinedText.trim(), url, title }
}

async function executeCommand(cmd) {
  console.log(`[Charter] Executing: ${cmd.action}`, cmd)
  try {
    if (cmd.action === 'navigate') {
      console.log(`[Charter] Opening tab: ${cmd.url}`)
      const tab = await chrome.tabs.create({ url: cmd.url, active: true })
      automationTabId = tab.id
      console.log(`[Charter] Tab created: ${tab.id}`)

      // Wait for page to load (with timeout)
      await new Promise((resolve) => {
        function listener(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener)
            console.log(`[Charter] Page loaded: ${cmd.url}`)
            resolve()
          }
        }
        chrome.tabs.onUpdated.addListener(listener)
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener)
          console.log(`[Charter] Page load timeout: ${cmd.url}`)
          resolve()
        }, 30000)
      })

      // Ensure content script is injected (it might not be loaded yet in all frames)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['content.js'],
        })
        console.log(`[Charter] Content script injected into tab ${tab.id}`)
      } catch (e) {
        console.log(`[Charter] Content script injection skipped: ${e.message}`)
      }

      // Small delay to let scripts initialize
      await new Promise(r => setTimeout(r, 500))

      await sendResult(cmd.id, { status: 'navigated', tabId: tab.id, url: cmd.url, title: '' })

    } else if (cmd.action === 'scan_page') {
      const tabId = cmd.tabId || automationTabId
      if (!tabId) { await sendResult(cmd.id, { error: 'No active tab. Use browser_navigate first.' }); return }
      console.log(`[Charter] Scanning tab: ${tabId}`)
      // Scan all frames — forms are often inside iframes (visa portals, gov sites)
      let result = await scanAllFrames(tabId)
      // If 0 fields found, retry once after injecting content script + delay
      if (!result.fields || result.fields.length === 0) {
        console.log(`[Charter] Scan found 0 fields, retrying after content script injection...`)
        try {
          await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] })
        } catch {}
        await new Promise(r => setTimeout(r, 800))
        result = await scanAllFrames(tabId)
      }
      console.log(`[Charter] Scan result: ${result?.fields?.length || 0} fields`)
      await sendResult(cmd.id, result)

    } else if (cmd.action === 'fill_fields') {
      const tabId = automationTabId
      if (!tabId) { await sendResult(cmd.id, { error: 'No active tab. Use browser_navigate first.' }); return }
      console.log(`[Charter] Filling ${cmd.fields?.length || 0} fields on tab: ${tabId}`)
      // Send fill command to all frames — the right frame will find the selectors
      sendToAllFrames(tabId, {
        type: 'BROWSER_FILL_FIELDS',
        fields: cmd.fields,
        delayMs: cmd.delayMs || 100,
        commandId: cmd.id,
      })
      // Don't send result here — content script sends BROWSER_ACTION_RESULT when done

    } else if (cmd.action === 'click') {
      const tabId = automationTabId
      if (!tabId) { await sendResult(cmd.id, { error: 'No active tab. Use browser_navigate first.' }); return }
      console.log(`[Charter] Clicking: ${cmd.selector}`)
      // Try all frames — button might be in an iframe
      const result = await sendToFirstResponder(tabId, {
        type: 'BROWSER_CLICK',
        selector: cmd.selector,
        waitForNavigation: cmd.waitForNavigation,
      })
      if (cmd.waitForNavigation) {
        await new Promise(r => setTimeout(r, 2000))
      }
      await sendResult(cmd.id, result)

    } else if (cmd.action === 'read_page') {
      const tabId = cmd.tabId || automationTabId
      if (!tabId) { await sendResult(cmd.id, { error: 'No active tab. Use browser_navigate first.' }); return }
      console.log(`[Charter] Reading page on tab: ${tabId}`)
      // Read from all frames and merge
      const result = await readAllFrames(tabId, cmd.selector)
      await sendResult(cmd.id, result)

    } else if (cmd.action === 'capture_captcha') {
      const tabId = cmd.tabId || automationTabId
      if (!tabId) { await sendResult(cmd.id, { error: 'No active tab. Use browser_navigate first.' }); return }
      console.log(`[Charter] Capturing CAPTCHA on tab: ${tabId}`)
      // Send to content script on the automation tab (works in background)
      let result = await chrome.tabs.sendMessage(tabId, { type: 'BROWSER_CAPTURE_CAPTCHA' })
      // If cross-origin, need tab visible for screenshot fallback
      if (result?.status === 'cross_origin' || result?.status === 'no_captcha_image_found') {
        try {
          // Activate automation tab so captureVisibleTab captures the RIGHT page
          await chrome.tabs.update(tabId, { active: true })
          await new Promise(r => setTimeout(r, 300))
          const tab = await chrome.tabs.get(tabId)
          const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
          result = { ...result, screenshot: dataUrl }
        } catch (err) {
          result = { ...result, screenshotError: err.message }
        }
      }
      await sendResult(cmd.id, result)

    } else if (cmd.action === 'screenshot') {
      const tabId = cmd.tabId || automationTabId
      if (!tabId) { await sendResult(cmd.id, { error: 'No active tab. Use browser_navigate first.' }); return }
      console.log(`[Charter] Taking screenshot of tab: ${tabId}`)
      try {
        // Activate the automation tab so captureVisibleTab captures the RIGHT page
        await chrome.tabs.update(tabId, { active: true })
        await new Promise(r => setTimeout(r, 300))
        const tab = await chrome.tabs.get(tabId)
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
        await sendResult(cmd.id, { status: 'captured', screenshot: dataUrl })
      } catch (err) {
        await sendResult(cmd.id, { error: err.message })
      }

    } else if (cmd.action === 'execute_js') {
      const tabId = cmd.tabId || automationTabId
      if (!tabId) { await sendResult(cmd.id, { error: 'No active tab. Use browser_navigate first.' }); return }
      console.log(`[Charter] Executing JS on tab: ${tabId} (CSP-safe route)`)

      // PRIMARY: Route through content script (CSP-safe pattern matching)
      let handled = false
      const frameIds = await getFrameIds(tabId)
      for (const frameId of frameIds) {
        try {
          const r = await chrome.tabs.sendMessage(tabId, { type: 'BROWSER_EXECUTE_JS', code: cmd.code }, { frameId })
          if (r && r.status === 'executed') {
            await sendResult(cmd.id, r)
            handled = true
            break
          }
        } catch {}
      }
      if (handled) return

      // FALLBACK: Try chrome.scripting.executeScript (may fail on strict CSP sites)
      console.log(`[Charter] Content script couldn't handle JS, trying chrome.scripting fallback`)
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          func: (code) => {
            try { return eval(code) } catch (e) { return { error: e.message } }
          },
          args: [cmd.code],
        })
        let result = null
        for (const r of results) {
          if (r.result !== null && r.result !== undefined) {
            result = r.result
            break
          }
        }
        await sendResult(cmd.id, { status: 'executed', result })
      } catch (err) {
        await sendResult(cmd.id, { error: `JS execution failed (CSP): ${err.message}. Use browser_scan_page and browser_fill_fields instead.` })
      }

    } else {
      console.log(`[Charter] Unknown action: ${cmd.action}`)
      await sendResult(cmd.id, { error: `Unknown action: ${cmd.action}` })
    }
  } catch (err) {
    console.error(`[Charter] Command failed:`, err)
    await sendResult(cmd.id, { error: err.message || 'Command execution failed' })
  }
}

async function sendResult(commandId, result) {
  console.log(`[Charter] Sending result for ${commandId}:`, result?.status || result?.error || 'ok')
  try {
    await fetch(`${API_BASE}/api/agent/browser-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _isResult: true, commandId, result }),
    })
  } catch (err) {
    console.error(`[Charter] Failed to send result:`, err)
  }
}

// --- Keep-alive via port connections ---
// Content scripts connect a persistent port which keeps the service worker alive
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'charter-keepalive') {
    console.log('[Charter] Keepalive port connected')
    port.onMessage.addListener((msg) => {
      if (msg.type === 'POLL') {
        pollForCommands()
      }
    })
    port.onDisconnect.addListener(() => {
      console.log('[Charter] Keepalive port disconnected')
    })
  }
})

// --- Message relay ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'AGENT_STATE_UPDATE') {
    currentState = { ...currentState, ...msg }
    delete currentState.type
    chrome.storage.local.set({ charterState: currentState })

    // Broadcast to all tabs
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'AGENT_STATE_UPDATE', ...currentState }).catch(() => {})
        }
      }
    })
  }

  if (msg.type === 'KEEPALIVE') {
    // Legacy keepalive — also trigger poll
    pollForCommands()
  }

  if (msg.type === 'WIDGET_APPROVAL') {
    chrome.runtime.sendMessage({ type: 'APPROVAL_FROM_WIDGET', actionId: msg.actionId, action: msg.action }).catch(() => {})
  }

  if (msg.type === 'BROWSER_ACTION_RESULT') {
    console.log(`[Charter] Got fill result for ${msg.commandId}`)
    sendResult(msg.commandId, msg.result)
  }

  if (msg.type === 'FIELD_FILLED') {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id && tab.id !== sender?.tab?.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'FIELD_FILLED', label: msg.label, source: msg.source }).catch(() => {})
        }
      }
    })
  }

  if (msg.type === 'GET_STATE') {
    sendResponse(currentState)
  }

  return true
})

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ charterState: currentState })
  console.log('[Charter] Extension installed')
})

// --- Extension icon click → toggle widget on active tab ---
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_WIDGET' }).catch(() => {})
  }
})

// Initial poll on worker start
pollForCommands()
console.log('[Charter] Service worker started')

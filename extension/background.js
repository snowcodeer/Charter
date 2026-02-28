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

// --- Command Polling ---
// Don't use setInterval (dies when worker sleeps).
// Instead, content scripts send KEEPALIVE messages that trigger polling.

async function pollForCommands() {
  if (isPolling) return // prevent overlapping polls
  isPolling = true
  try {
    const res = await fetch(`${API_BASE}/api/agent/browser-command`)
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
  } catch (err) {
    // Server not running — silent
  } finally {
    isPolling = false
  }
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

      await sendResult(cmd.id, { status: 'navigated', tabId: tab.id, url: cmd.url, title: '' })

    } else if (cmd.action === 'scan_page') {
      const tabId = cmd.tabId || automationTabId
      if (!tabId) { await sendResult(cmd.id, { error: 'No active tab. Use browser_navigate first.' }); return }
      console.log(`[Charter] Scanning tab: ${tabId}`)
      const result = await chrome.tabs.sendMessage(tabId, { type: 'BROWSER_SCAN_PAGE' })
      console.log(`[Charter] Scan result: ${result?.fields?.length || 0} fields`)
      await sendResult(cmd.id, result)

    } else if (cmd.action === 'fill_fields') {
      const tabId = automationTabId
      if (!tabId) { await sendResult(cmd.id, { error: 'No active tab. Use browser_navigate first.' }); return }
      console.log(`[Charter] Filling ${cmd.fields?.length || 0} fields on tab: ${tabId}`)
      // Start filling — result comes back async via BROWSER_ACTION_RESULT
      chrome.tabs.sendMessage(tabId, {
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
      const result = await chrome.tabs.sendMessage(tabId, {
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
      const result = await chrome.tabs.sendMessage(tabId, { type: 'BROWSER_READ_PAGE', selector: cmd.selector })
      await sendResult(cmd.id, result)

    } else if (cmd.action === 'capture_captcha') {
      const tabId = cmd.tabId || automationTabId
      if (!tabId) { await sendResult(cmd.id, { error: 'No active tab. Use browser_navigate first.' }); return }
      console.log(`[Charter] Capturing CAPTCHA on tab: ${tabId}`)
      let result = await chrome.tabs.sendMessage(tabId, { type: 'BROWSER_CAPTURE_CAPTCHA' })
      // If cross-origin, take a full tab screenshot instead
      if (result?.status === 'cross_origin' || result?.status === 'no_captcha_image_found') {
        try {
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
        const tab = await chrome.tabs.get(tabId)
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
        await sendResult(cmd.id, { status: 'captured', screenshot: dataUrl })
      } catch (err) {
        await sendResult(cmd.id, { error: err.message })
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

// Initial poll on worker start
pollForCommands()
console.log('[Charter] Service worker started')

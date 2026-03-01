// Service worker — relays agent state AND executes browser commands
// IMPORTANT: MV3 service workers sleep after 30s. We use port connections
// from content scripts to stay alive, and poll on every keepalive ping.

// Production URL — update this after deploying to Fly.io
const API_BASE = 'https://charter-london.fly.dev'

// --- Device ID from cookie (set by Charter web app) ---
async function getDeviceId() {
  try {
    const cookie = await chrome.cookies.get({ url: API_BASE, name: 'device_id' })
    return cookie?.value || null
  } catch {
    return null
  }
}

let currentState = {
  isActive: false,
  isThinking: false,
  toolEvents: [],
  approvalActions: [],
}

let automationTabId = null
let isPolling = false
let streamSeqCursor = 0
let executedCommandIds = new Set() // Dedup guard — never execute the same command twice

// --- Persistent CDP session for automation tab ---
let cdpAttached = false
let elementMap = {} // index → { backendDOMNodeId, role, label, ... }

async function ensureCDP(tabId) {
  if (cdpAttached) return true
  try {
    await chrome.debugger.attach({ tabId }, '1.3')
    await chrome.debugger.sendCommand({ tabId }, 'DOM.enable')
    await chrome.debugger.sendCommand({ tabId }, 'Accessibility.enable')
    cdpAttached = true
    console.log(`[Charter] CDP session opened on tab ${tabId}`)
    return true
  } catch (e) {
    // Might already be attached — check and re-enable domains
    if (e.message?.includes('Already attached')) {
      cdpAttached = true
      try {
        await chrome.debugger.sendCommand({ tabId }, 'DOM.enable')
        await chrome.debugger.sendCommand({ tabId }, 'Accessibility.enable')
      } catch {}
      return true
    }
    console.log(`[Charter] CDP attach failed: ${e.message}`)
    return false
  }
}

async function detachCDP(tabId) {
  if (!cdpAttached) return
  try {
    await chrome.debugger.sendCommand({ tabId }, 'Accessibility.disable')
    await chrome.debugger.sendCommand({ tabId }, 'DOM.disable')
    await chrome.debugger.detach({ tabId })
  } catch {}
  cdpAttached = false
}

// CDP-native click by backendDOMNodeId
async function cdpClickNode(tabId, backendNodeId) {
  await ensureCDP(tabId)
  const { object } = await chrome.debugger.sendCommand({ tabId }, 'DOM.resolveNode', { backendNodeId })
  if (!object?.objectId) throw new Error(`DOM.resolveNode returned no objectId for backendNodeId=${backendNodeId}`)
  const result = await chrome.debugger.sendCommand({ tabId }, 'Runtime.callFunctionOn', {
    objectId: object.objectId,
    functionDeclaration: `function() {
      this.scrollIntoView({block:'center'});
      // Dispatch full mouse event sequence for sites that listen to mousedown/mouseup
      this.dispatchEvent(new MouseEvent('mousedown', {bubbles:true,cancelable:true}));
      this.dispatchEvent(new MouseEvent('mouseup', {bubbles:true,cancelable:true}));
      this.click();
      return this.tagName + ': ' + (this.textContent?.trim()?.slice(0,100) || this.value || 'clicked');
    }`,
    returnByValue: true,
  })
  console.log(`[Charter] cdpClickNode result: ${result?.result?.value}`)
  return result?.result?.value || 'clicked'
}

// CDP-native fill by backendDOMNodeId
async function cdpFillNode(tabId, backendNodeId, value, isSelect) {
  await ensureCDP(tabId)
  const { object } = await chrome.debugger.sendCommand({ tabId }, 'DOM.resolveNode', { backendNodeId })
  if (isSelect) {
    // For <select>: find option by text or value, set selectedIndex
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.callFunctionOn', {
      objectId: object.objectId,
      functionDeclaration: `function(val) {
        const lower = val.toLowerCase();
        const opt = Array.from(this.options).find(o =>
          o.value === val || o.text.trim().toLowerCase() === lower || o.text.trim().toLowerCase().includes(lower) || lower.includes(o.text.trim().toLowerCase())
        );
        if (opt) {
          this.value = opt.value;
          opt.selected = true;
        } else {
          this.value = val;
        }
        this.dispatchEvent(new Event('change', {bubbles:true}));
        return this.value;
      }`,
      arguments: [{ value }],
      returnByValue: true,
    })
  } else {
    // For text inputs: set value + dispatch events
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.callFunctionOn', {
      objectId: object.objectId,
      functionDeclaration: `function(val) {
        this.focus();
        // Use native setter to bypass React/Vue wrappers
        const proto = Object.getPrototypeOf(this);
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
          || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) nativeSetter.call(this, val);
        else this.value = val;
        this.dispatchEvent(new Event('input', {bubbles:true}));
        this.dispatchEvent(new Event('change', {bubbles:true}));
        this.dispatchEvent(new Event('blur', {bubbles:true}));
        return val;
      }`,
      arguments: [{ value }],
      returnByValue: true,
    })
  }
}

// CDP-native set checkbox/radio
async function cdpSetChecked(tabId, backendNodeId, checked) {
  await ensureCDP(tabId)
  const { object } = await chrome.debugger.sendCommand({ tabId }, 'DOM.resolveNode', { backendNodeId })
  await chrome.debugger.sendCommand({ tabId }, 'Runtime.callFunctionOn', {
    objectId: object.objectId,
    functionDeclaration: `function(c) {
      if (this.checked !== c) { this.checked = c; this.click(); }
      this.dispatchEvent(new Event('change', {bubbles:true}));
    }`,
    arguments: [{ value: checked }],
  })
}

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
    const deviceId = await getDeviceId()
    if (!deviceId) { isPolling = false; return } // No device_id cookie — user hasn't visited Charter yet
    const res = await fetch(`${API_BASE}/api/agent/browser-command?streamSince=${streamSeqCursor}&deviceId=${encodeURIComponent(deviceId)}`)
    const data = await res.json()
    const cmds = data.commands || []
    if (cmds.length > 0) {
      console.log(`[Charter][${new Date().toISOString()}] Got ${cmds.length} command(s):`, cmds.map(c => `${c.action}(${c.id})`))
      for (const cmd of cmds) {
        console.log(`[Charter][CMD] id=${cmd.id} action=${cmd.action} url=${cmd.url || ''} selector=${cmd.selector || ''} text=${cmd.text || ''} elementIndex=${cmd.elementIndex ?? ''} fields=${cmd.fields?.length || 0}`)
      }
    }
    for (const cmd of cmds) {
      if (executedCommandIds.has(cmd.id)) {
        console.log(`[Charter][DEDUP] Skipping already-executed command: ${cmd.id} ${cmd.action}`)
        continue
      }
      executedCommandIds.add(cmd.id)
      // Keep set bounded — remove old entries after 200 commands
      if (executedCommandIds.size > 200) {
        const iter = executedCommandIds.values()
        for (let i = 0; i < 100; i++) iter.next()
        const keep = new Set()
        for (const v of iter) keep.add(v)
        executedCommandIds = keep
      }
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

// =============================================================================
// CDP-POWERED COMPREHENSIVE PAGE SCANNER
// Uses DOMSnapshot + AXTree + DOM — the same approach as browser-use (79k stars)
// Works on: gov sites, SPAs, shadow DOM, framesets, legacy HTML, everything
// =============================================================================

async function scanPageViaCDP(tabId) {
  const log = []
  const fields = []
  const buttons = []
  const links = []
  const sections = []
  const errors = []

  try {
    const attached = await ensureCDP(tabId)
    if (!attached) { log.push('[cdp] Could not attach debugger'); return { url: '', title: '', fields: [], buttons: [], links: [], sections: [], errors: [], visibleText: '', isPaymentPage: false, hasCaptcha: false, _scanMethod: 'cdp-failed', _log: log } }
    log.push('[cdp] CDP session active')

    // --- Phase 1: DOMSnapshot — gets ALL elements across ALL frames with bounding boxes ---
    let snapshot = null
    try {
      snapshot = await chrome.debugger.sendCommand({ tabId }, 'DOMSnapshot.captureSnapshot', {
        computedStyles: ['display', 'visibility', 'opacity'],
        includeDOMRects: true,
        includePaintOrder: true,
      })
      log.push(`[cdp] DOMSnapshot: ${snapshot.documents?.length || 0} documents, ${snapshot.strings?.length || 0} strings`)
    } catch (e) {
      log.push(`[cdp] DOMSnapshot failed: ${e.message}`)
    }

    // --- Phase 2: AXTree — semantic labels, roles, values across ALL frames + shadow DOM ---
    let axNodes = []
    try {
      const axResult = await chrome.debugger.sendCommand({ tabId }, 'Accessibility.getFullAXTree')
      axNodes = axResult.nodes || []
      log.push(`[cdp] AXTree: ${axNodes.length} nodes`)
    } catch (e) {
      log.push(`[cdp] AXTree failed: ${e.message}`)
    }

    // --- Phase 3: Extract interactive elements from AXTree ---
    const formRoles = new Set(['textbox', 'combobox', 'listbox', 'checkbox', 'radio', 'spinbutton', 'searchbox', 'slider', 'switch', 'menuitemcheckbox', 'menuitemradio'])
    const buttonRoles = new Set(['button', 'menuitem', 'tab'])
    const linkRoles = new Set(['link'])
    const headingRoles = new Set(['heading'])
    const alertRoles = new Set(['alert', 'status', 'log'])

    for (const node of axNodes) {
      if (node.ignored) continue
      const role = node.role?.value
      const name = (node.name?.value || '').trim()
      const value = (node.value?.value || '').trim()
      const desc = (node.description?.value || '').trim()
      const required = node.properties?.find(p => p.name === 'required')?.value?.value || false
      const disabled = node.properties?.find(p => p.name === 'disabled')?.value?.value || false
      const checked = node.properties?.find(p => p.name === 'checked')?.value?.value
      const expanded = node.properties?.find(p => p.name === 'expanded')?.value?.value
      const invalid = node.properties?.find(p => p.name === 'invalid')?.value?.value

      if (formRoles.has(role)) {
        fields.push({
          role, label: name, value, description: desc || undefined,
          required, disabled,
          checked: checked !== undefined ? checked : undefined,
          expanded: expanded !== undefined ? expanded : undefined,
          invalid: invalid === 'true' ? true : undefined,
          backendDOMNodeId: node.backendDOMNodeId,
          selector: null, id: '', name: '', tag: '', type: '',
          source: 'cdp',
        })
      } else if (buttonRoles.has(role) && name) {
        buttons.push({
          text: name.slice(0, 100), role,
          backendDOMNodeId: node.backendDOMNodeId,
          selector: null, source: 'cdp',
        })
      } else if (linkRoles.has(role) && name) {
        links.push({ text: name.slice(0, 80), role, backendDOMNodeId: node.backendDOMNodeId })
      } else if (headingRoles.has(role) && name) {
        const level = node.properties?.find(p => p.name === 'level')?.value?.value
        sections.push({ level: level ? `h${level}` : 'heading', text: name })
      } else if (alertRoles.has(role) && name) {
        errors.push({ text: name, role })
      }
    }

    log.push(`[cdp] AXTree extracted: ${fields.length} fields, ${buttons.length} buttons, ${links.length} links, ${sections.length} headings`)

    // --- Phase 4: Resolve CSS selectors + HTML attributes for each field via DOM ---
    const resolveItems = [...fields, ...buttons.slice(0, 30)]
    for (const item of resolveItems) {
      if (!item.backendDOMNodeId) continue
      try {
        const { node: domNode } = await chrome.debugger.sendCommand({ tabId }, 'DOM.describeNode', {
          backendNodeId: item.backendDOMNodeId,
        })
        const attrs = {}
        if (domNode.attributes) {
          for (let i = 0; i < domNode.attributes.length; i += 2) {
            attrs[domNode.attributes[i]] = domNode.attributes[i + 1]
          }
        }
        // Build best CSS selector
        if (attrs.id) item.selector = `#${attrs.id}`
        else if (attrs.name) item.selector = `${domNode.localName || 'input'}[name="${attrs.name}"]`
        else if (attrs['data-testid']) item.selector = `[data-testid="${attrs['data-testid']}"]`
        else if (attrs['data-field']) item.selector = `[data-field="${attrs['data-field']}"]`
        else if (attrs['aria-label']) item.selector = `[aria-label="${attrs['aria-label']}"]`

        item.id = attrs.id || ''
        item.name = attrs.name || ''
        item.tag = domNode.localName || ''
        item.type = attrs.type || ''

        // For selects, get options
        if (domNode.localName === 'select' && domNode.children) {
          item.options = domNode.children
            .filter(c => c.localName === 'option')
            .map(c => {
              const optAttrs = {}
              if (c.attributes) {
                for (let i = 0; i < c.attributes.length; i += 2) optAttrs[c.attributes[i]] = c.attributes[i + 1]
              }
              return { value: optAttrs.value || '', text: c.children?.[0]?.nodeValue || '' }
            })
        }

        // For select, try to get options via deeper describe
        if (domNode.localName === 'select' && (!item.options || item.options.length === 0)) {
          try {
            const { node: deepNode } = await chrome.debugger.sendCommand({ tabId }, 'DOM.describeNode', {
              backendNodeId: item.backendDOMNodeId,
              depth: 2, // get children (option elements)
            })
            if (deepNode.children) {
              item.options = deepNode.children
                .filter(c => c.localName === 'option' || c.localName === 'optgroup')
                .flatMap(c => {
                  if (c.localName === 'optgroup') {
                    return (c.children || []).filter(gc => gc.localName === 'option').map(gc => {
                      const oAttrs = {}
                      if (gc.attributes) { for (let i = 0; i < gc.attributes.length; i += 2) oAttrs[gc.attributes[i]] = gc.attributes[i + 1] }
                      return { value: oAttrs.value || '', text: gc.children?.[0]?.nodeValue || '' }
                    })
                  }
                  const oAttrs = {}
                  if (c.attributes) { for (let i = 0; i < c.attributes.length; i += 2) oAttrs[c.attributes[i]] = c.attributes[i + 1] }
                  return [{ value: oAttrs.value || '', text: c.children?.[0]?.nodeValue || '' }]
                })
            }
          } catch {}
        }
      } catch (e) {
        // Node might have been removed from DOM — skip
      }
    }

    // --- Phase 5: Get page text + metadata via Runtime.evaluate ---
    let pageText = ''
    let pageUrl = ''
    let pageTitle = ''
    let isPaymentPage = false
    let hasCaptcha = false
    try {
      const evalResult = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
        expression: `JSON.stringify({
          url: location.href,
          title: document.title,
          text: document.body?.innerText?.slice(0, 3000) || '',
          formCount: document.querySelectorAll('form').length,
        })`,
        returnByValue: true,
      })
      const pageInfo = JSON.parse(evalResult.result.value)
      pageUrl = pageInfo.url
      pageTitle = pageInfo.title
      pageText = pageInfo.text

      const lowerText = pageText.toLowerCase()
      const paymentKw = ['credit card', 'card number', 'cvv', 'cvc', 'billing', 'payment method', 'pay now', 'checkout']
      const captchaKw = ['captcha', 'security code', 'verification code', 'type the characters', 'enter the code']
      isPaymentPage = paymentKw.some(kw => lowerText.includes(kw))
      hasCaptcha = captchaKw.some(kw => lowerText.includes(kw))
    } catch (e) {
      log.push(`[cdp] Runtime.evaluate failed: ${e.message}`)
    }

    // Build element index map — agent references elements by index
    elementMap = {}
    let idx = 0
    for (const f of fields) { f.index = idx; elementMap[idx] = f; idx++ }
    for (const b of buttons) { b.index = idx; elementMap[idx] = b; idx++ }
    log.push(`[cdp] Indexed ${idx} elements (${fields.length} fields + ${buttons.length} buttons)`)

    return {
      url: pageUrl,
      title: pageTitle,
      fields,
      buttons,
      links: links.slice(0, 30),
      sections,
      errors,
      visibleText: pageText,
      isPaymentPage,
      hasCaptcha,
      _scanMethod: 'cdp',
      _log: log,
    }
  } catch (err) {
    cdpAttached = false // Mark as detached so next attempt re-attaches
    try { await chrome.debugger.detach({ tabId }) } catch {}
    log.push(`[cdp] Fatal error: ${err.message}`)
    return { url: '', title: '', fields: [], buttons: [], links: [], sections: [], errors: [], visibleText: '', isPaymentPage: false, hasCaptcha: false, _scanMethod: 'cdp-failed', _log: log }
  }
}

// --- Debugger-based screenshot (uses persistent session) ---
async function captureTabScreenshot(tabId) {
  await ensureCDP(tabId)
  const result = await chrome.debugger.sendCommand({ tabId }, 'Page.captureScreenshot', { format: 'png' })
  return 'data:image/png;base64,' + result.data
}

async function executeCommand(cmd) {
  console.log(`[Charter][EXEC][${new Date().toISOString()}] action=${cmd.action} id=${cmd.id} automationTabId=${automationTabId} cdpAttached=${cdpAttached}`)
  try {
    if (cmd.action === 'navigate') {
      console.log(`[Charter][NAV-CMD][${new Date().toISOString()}] Navigate requested: ${cmd.url} (current automationTabId=${automationTabId})`)

      // GUARD: Don't re-navigate if we're already on this URL (or close to it)
      // The agent sometimes calls navigate repeatedly to the same page, causing reloads
      if (automationTabId) {
        try {
          const currentTab = await chrome.tabs.get(automationTabId)
          const currentUrl = (currentTab.url || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase()
          const targetUrl = (cmd.url || '').split('#')[0].split('?')[0].replace(/\/+$/, '').toLowerCase()
          if (currentUrl === targetUrl || currentUrl.includes(targetUrl) || targetUrl.includes(currentUrl)) {
            console.log(`[Charter][NAV-CMD] SKIPPED — already on ${currentTab.url}`)
            await sendResult(cmd.id, { status: 'already_on_page', tabId: automationTabId, url: currentTab.url, title: currentTab.title || '' })
            return
          }
        } catch {
          // Tab doesn't exist — will create below
        }
      }

      // Reset CDP state — navigation invalidates the DOM tree + element map
      cdpAttached = false
      elementMap = {}

      let tab
      // Reuse existing automation tab if we have one (don't open a new tab every time)
      if (automationTabId) {
        try {
          tab = await chrome.tabs.get(automationTabId)
          // Tab exists — navigate within it
          await chrome.tabs.update(automationTabId, { url: cmd.url, active: true })
          console.log(`[Charter] Reusing tab ${automationTabId}`)
        } catch {
          // Tab was closed — create new one
          tab = null
        }
      }

      if (!tab) {
        tab = await chrome.tabs.create({ url: cmd.url, active: true })
        automationTabId = tab.id
        console.log(`[Charter] Created new tab: ${tab.id}`)
      }

      // Wait for page to load (with timeout)
      await new Promise((resolve) => {
        function listener(tabId, info) {
          if (tabId === automationTabId && info.status === 'complete') {
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
          target: { tabId: automationTabId, allFrames: true },
          files: ['content.js'],
        })
        console.log(`[Charter] Content script injected into tab ${automationTabId}`)
      } catch (e) {
        console.log(`[Charter] Content script injection skipped: ${e.message}`)
      }

      // Small delay to let scripts initialize
      await new Promise(r => setTimeout(r, 500))

      await sendResult(cmd.id, { status: 'navigated', tabId: automationTabId, url: cmd.url, title: '' })

    } else if (cmd.action === 'scan_page') {
      const tabId = cmd.tabId || automationTabId
      if (!tabId) { await sendResult(cmd.id, { error: 'No active tab. Use browser_navigate first.' }); return }
      console.log(`[Charter] Scanning tab ${tabId} via CDP (primary)...`)

      // PRIMARY: CDP scan — DOMSnapshot + AXTree + DOM
      // Works on ALL pages: gov sites, SPAs, shadow DOM, framesets, everything
      let result = await scanPageViaCDP(tabId)
      console.log(`[Charter] CDP scan: ${result.fields?.length || 0} fields, ${result.buttons?.length || 0} buttons`)

      // COMPLEMENT: If CDP found fields but no selectors, also run content script scan
      // to get extra context (instructions, progress, etc.) and resolve selectors
      if (result.fields.length > 0) {
        try {
          const csResult = await scanAllFrames(tabId)
          // Merge content script data for richer context
          if (csResult.fields?.length > 0) {
            // Match CDP fields with content script fields by id/name for better selectors
            for (const cdpField of result.fields) {
              if (cdpField.selector) continue // already has selector
              const match = csResult.fields.find(f =>
                (cdpField.id && f.id === cdpField.id) ||
                (cdpField.name && f.name === cdpField.name)
              )
              if (match?.selector) cdpField.selector = match.selector
            }
          }
          // Add content script extras not in CDP result
          if (!result.instructions && csResult.instructions) result.instructions = csResult.instructions
          if (!result.progress && csResult.progress) result.progress = csResult.progress
          result._log.push(`[cs] Content script complement: ${csResult.fields?.length || 0} fields`)
        } catch {}
      }

      // FALLBACK 1: If CDP returned 0, try content script scan (maybe debugger was blocked)
      if (!result.fields || result.fields.length === 0) {
        result._log.push('[fallback-1] CDP returned 0 fields, trying content script...')
        // Inject + wait + scan
        try {
          await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] })
        } catch {}
        await new Promise(r => setTimeout(r, 1000))
        const csResult = await scanAllFrames(tabId)
        if (csResult.fields?.length > 0) {
          result.fields = csResult.fields
          result.buttons = csResult.buttons || []
          result.links = csResult.links || []
          result.sections = csResult.sections || []
          result.errors = csResult.errors || []
          result.visibleText = csResult.visibleText || result.visibleText
          result._scanMethod = 'content-script'
          result._log.push(`[fallback-1] Content script found ${csResult.fields.length} fields`)
        }
      }

      // FALLBACK 2: If still 0, try Runtime.evaluate across all frames via chrome.scripting
      // This works even when CDP can't attach — uses chrome.scripting.executeScript which
      // runs in each frame's isolated world and can access the DOM directly
      if (!result.fields || result.fields.length === 0) {
        result._log.push('[fallback-2] Still 0 fields, trying chrome.scripting.executeScript in all frames...')
        try {
          const scriptResults = await chrome.scripting.executeScript({
            target: { tabId, allFrames: true },
            func: () => {
              const fields = []
              const buttons = []
              document.querySelectorAll('input, select, textarea').forEach((el, i) => {
                if (el.type === 'hidden') return
                const label = el.labels?.[0]?.textContent?.trim()
                  || el.getAttribute('aria-label')
                  || el.closest('td')?.previousElementSibling?.textContent?.trim()
                  || el.placeholder || el.name || el.id || ''
                const field = {
                  tag: el.tagName.toLowerCase(),
                  type: el.type || '',
                  id: el.id || '',
                  name: el.name || '',
                  label: label.slice(0, 100),
                  value: el.value || '',
                  required: el.required || el.getAttribute('aria-required') === 'true',
                  disabled: el.disabled,
                  selector: el.id ? `#${el.id}` : el.name ? `${el.tagName.toLowerCase()}[name="${el.name}"]` : null,
                  source: 'scripting',
                }
                if (el.tagName === 'SELECT') {
                  field.options = Array.from(el.options).slice(0, 50).map(o => ({ value: o.value, text: o.text.trim() }))
                  field.role = 'combobox'
                } else if (el.type === 'checkbox' || el.type === 'radio') {
                  field.checked = el.checked
                  field.role = el.type
                } else {
                  field.role = 'textbox'
                }
                fields.push(field)
              })
              document.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"], [onclick]').forEach(el => {
                const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').trim()
                if (!text) return
                buttons.push({
                  text: text.slice(0, 100),
                  tag: el.tagName.toLowerCase(),
                  selector: el.id ? `#${el.id}` : null,
                  source: 'scripting',
                })
              })
              return {
                fields,
                buttons,
                url: location.href,
                title: document.title,
                text: document.body?.innerText?.slice(0, 3000) || '',
              }
            },
          })
          // Merge results from all frames
          let allFields = []
          let allButtons = []
          let pageUrl = result.url
          let pageTitle = result.title
          let pageText = result.visibleText
          for (const r of scriptResults) {
            if (r.result?.fields?.length) allFields.push(...r.result.fields)
            if (r.result?.buttons?.length) allButtons.push(...r.result.buttons)
            if (r.result?.url && !pageUrl) { pageUrl = r.result.url; pageTitle = r.result.title }
            if (r.result?.text && !pageText) pageText = r.result.text
          }
          if (allFields.length > 0) {
            // Build element map with indices
            elementMap = {}
            let idx = 0
            for (const f of allFields) { f.index = idx; elementMap[idx] = f; idx++ }
            for (const b of allButtons) { b.index = idx; elementMap[idx] = b; idx++ }
            result.fields = allFields
            result.buttons = allButtons
            result.url = pageUrl || result.url
            result.title = pageTitle || result.title
            result.visibleText = pageText || result.visibleText
            result._scanMethod = 'scripting-allframes'
            result._log.push(`[fallback-2] chrome.scripting found ${allFields.length} fields, ${allButtons.length} buttons across ${scriptResults.length} frames`)
          }
        } catch (e) {
          result._log.push(`[fallback-2] chrome.scripting failed: ${e.message}`)
        }
      }

      console.log(`[Charter] Scan complete: ${result.fields?.length || 0} fields (${result._scanMethod || 'cdp'})`)
      console.log(`[Charter] Scan log:`, (result._log || []).join('\n'))
      await sendResult(cmd.id, result)

    } else if (cmd.action === 'fill_fields') {
      const tabId = automationTabId
      if (!tabId) { await sendResult(cmd.id, { error: 'No active tab. Use browser_navigate first.' }); return }
      console.log(`[Charter] Filling ${cmd.fields?.length || 0} fields on tab: ${tabId}`)

      const results = []
      for (const field of (cmd.fields || [])) {
        const delay = cmd.delayMs || 100
        await new Promise(r => setTimeout(r, delay))

        let filled = false

        // Strategy 1 (BEST): CDP fill by element index from scan
        if (field.elementIndex !== undefined && elementMap[field.elementIndex]) {
          const el = elementMap[field.elementIndex]
          try {
            const isSelect = el.role === 'combobox' || el.role === 'listbox' || el.tag === 'select'
            const isCheckbox = el.role === 'checkbox' || el.role === 'radio' || el.role === 'switch'
            if (isCheckbox) {
              await cdpSetChecked(tabId, el.backendDOMNodeId, field.value === 'true' || field.value === '1' || field.value === 'yes')
            } else {
              await cdpFillNode(tabId, el.backendDOMNodeId, field.value, isSelect)
            }
            results.push({ ...field, status: 'filled', method: 'cdp-index' })
            filled = true
            console.log(`[Charter] CDP filled element ${field.elementIndex}: "${field.value}"`)
          } catch (e) {
            console.log(`[Charter] CDP fill element ${field.elementIndex} failed: ${e.message}`)
          }
        }

        // Strategy 2: CSS selector via content script (legacy fallback)
        if (!filled && field.selector) {
          try {
            const r = await sendToFirstResponder(tabId, {
              type: 'BROWSER_FILL_FIELDS',
              fields: [field],
              delayMs: 0,
              commandId: null,
            })
            if (r?.status === 'filling_started' || r?.status === 'complete') {
              results.push({ ...field, status: 'filled', method: 'content-script' })
              filled = true
            }
          } catch {}
        }

        if (!filled) {
          results.push({ ...field, status: 'not_found' })
        }
      }

      await sendResult(cmd.id, { status: 'complete', results })

    } else if (cmd.action === 'click') {
      const tabId = automationTabId
      if (!tabId) { await sendResult(cmd.id, { error: 'No active tab. Use browser_navigate first.' }); return }
      console.log(`[Charter] Clicking: index=${cmd.elementIndex} selector="${cmd.selector || ''}" text="${cmd.text || ''}"`)

      let result = null

      // Strategy 1 (BEST): CDP click by element index from scan
      if (cmd.elementIndex !== undefined && elementMap[cmd.elementIndex]) {
        const el = elementMap[cmd.elementIndex]
        try {
          await cdpClickNode(tabId, el.backendDOMNodeId)
          result = { status: 'clicked', text: el.label || el.text || '', method: 'cdp-index', index: cmd.elementIndex }
          console.log(`[Charter] CDP index click success: element ${cmd.elementIndex} "${el.label || el.text}"`)
        } catch (e) {
          console.log(`[Charter] CDP index click failed: ${e.message}`)
        }
      }

      // Strategy 2: CDP click by text match via Runtime.evaluate
      if ((!result || result.status === 'not_found') && cmd.text) {
        try {
          await ensureCDP(tabId)
          const evalResult = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
            expression: `(function() {
              const targets = [...document.querySelectorAll('button, a, [type="submit"], [role="button"], input[type="button"], input[type="submit"]')];
              for (const f of document.querySelectorAll('frame, iframe')) {
                try { targets.push(...f.contentDocument.querySelectorAll('button, a, [type="submit"], [role="button"], input[type="button"], input[type="submit"]')); } catch {}
              }
              const text = ${JSON.stringify(cmd.text)}.toLowerCase();
              const el = targets.find(e => (e.textContent?.trim() || e.value || e.getAttribute('aria-label') || '').toLowerCase().includes(text));
              if (el) { el.scrollIntoView({block:'center'}); el.click(); return el.textContent?.trim()?.slice(0,100) || 'clicked'; }
              return null;
            })()`,
            returnByValue: true,
          })
          if (evalResult.result?.value) {
            result = { status: 'clicked', text: evalResult.result.value, method: 'cdp-text' }
          }
        } catch (e) {
          console.log(`[Charter] CDP text click failed: ${e.message}`)
        }
      }

      // Strategy 3: CSS selector via content script (legacy fallback)
      if ((!result || result.status === 'not_found') && cmd.selector) {
        result = await sendToFirstResponder(tabId, {
          type: 'BROWSER_CLICK',
          selector: cmd.selector,
        })
      }

      if (!result || result.status === 'not_found') {
        result = { status: 'not_found', error: `Could not find element: index=${cmd.elementIndex} selector="${cmd.selector || ''}" text="${cmd.text || ''}"` }
      }

      if (cmd.waitForNavigation) {
        await new Promise((resolve) => {
          function listener(updatedTabId, info) {
            if (updatedTabId === tabId && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener)
              resolve()
            }
          }
          chrome.tabs.onUpdated.addListener(listener)
          setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve() }, 5000)
        })
        // CDP session may have been invalidated by navigation — reset
        cdpAttached = false
        try {
          await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] })
        } catch {}
        await new Promise(r => setTimeout(r, 300))
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
      // If cross-origin, use debugger screenshot (works on any tab, no switching)
      if (result?.status === 'cross_origin' || result?.status === 'no_captcha_image_found') {
        try {
          const dataUrl = await captureTabScreenshot(tabId)
          result = { ...result, screenshot: dataUrl }
        } catch (err) {
          // Fallback: captureVisibleTab (no focus stealing)
          try {
            const tab = await chrome.tabs.get(tabId)
            const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
            result = { ...result, screenshot: dataUrl }
          } catch (err2) {
            result = { ...result, screenshotError: err2.message }
          }
        }
      }
      await sendResult(cmd.id, result)

    } else if (cmd.action === 'screenshot') {
      const tabId = cmd.tabId || automationTabId
      if (!tabId) { await sendResult(cmd.id, { error: 'No active tab. Use browser_navigate first.' }); return }
      console.log(`[Charter] Taking screenshot of tab: ${tabId} (debugger API)`)
      try {
        const dataUrl = await captureTabScreenshot(tabId)
        await sendResult(cmd.id, { status: 'captured', screenshot: dataUrl })
      } catch (err) {
        console.log(`[Charter] Debugger screenshot failed: ${err.message}`)
        // Fallback: captureVisibleTab (only works if tab is already visible — no focus stealing)
        try {
          const tab = await chrome.tabs.get(tabId)
          const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
          await sendResult(cmd.id, { status: 'captured', screenshot: dataUrl })
        } catch (err2) {
          await sendResult(cmd.id, { error: `Screenshot failed: ${err2.message}. Tab may not be visible.` })
        }
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
    const deviceId = await getDeviceId()
    await fetch(`${API_BASE}/api/agent/browser-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _isResult: true, commandId, result, deviceId: deviceId || 'default' }),
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

// --- Auto-inject content script when automation tab navigates ---
// This handles cases where clicks/links cause page navigation within the tab
chrome.webNavigation.onCompleted.addListener((details) => {
  console.log(`[Charter][NAV][${new Date().toISOString()}] tabId=${details.tabId} frameId=${details.frameId} url=${details.url} automationTabId=${automationTabId}`)
  if (details.tabId === automationTabId && details.frameId === 0) {
    console.log(`[Charter][NAV] Automation tab main frame navigated — re-injecting content script`)
    // Reset element map since DOM changed
    elementMap = {}
    chrome.scripting.executeScript({
      target: { tabId: details.tabId, allFrames: true },
      files: ['content.js'],
    }).catch(() => {})
  }
})

// --- Handle debugger detach (user clicked "Cancel" on banner, tab closed, etc.) ---
chrome.debugger.onDetach.addListener((source, reason) => {
  if (source.tabId === automationTabId) {
    console.log(`[Charter] Debugger detached from tab ${source.tabId}: ${reason}`)
    cdpAttached = false
    elementMap = {}
  }
})

// --- Self-polling loop ---
// MV3 service workers sleep after 30s of inactivity. We use a setTimeout chain
// that re-schedules itself. If the worker sleeps, chrome.alarms wakes it back up.
let pollInterval = null

function startSelfPolling() {
  if (pollInterval) return
  function loop() {
    pollForCommands()
    pollInterval = setTimeout(loop, 1000) // every 1 second
  }
  loop()
}

// chrome.alarms as a safety net — wakes the service worker if it sleeps
chrome.alarms.create('charter-poll', { periodInMinutes: 0.5 }) // every 30s backup
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'charter-poll') {
    pollForCommands()
    startSelfPolling() // restart the fast loop if it died
  }
})

// Initial poll + start loop on worker start
startSelfPolling()
console.log('[Charter] Service worker started with self-polling')

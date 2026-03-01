// Charter content script — browser automation engine
// Handles: form scanning, animated filling, clicking, page reading, payment detection

// Idempotency guard — prevent duplicate listeners on re-injection
if (window.__charterContentLoaded) {
  // Already loaded — skip re-initialization but keep script alive
} else {
window.__charterContentLoaded = true

// Signal to the Charter web app that the extension is installed
// The web app listens for this custom event to detect extension presence
document.dispatchEvent(new CustomEvent('charter-extension-installed'))
// Also set a DOM attribute the app can check synchronously
document.documentElement.setAttribute('data-charter-extension', 'true')

const PAYMENT_KEYWORDS = ['credit card', 'card number', 'cvv', 'cvc', 'expiry', 'billing', 'payment method', 'pay now', 'checkout', 'debit card']
const CAPTCHA_KEYWORDS = ['captcha', 'security code', 'verification code', 'type the characters', 'type the text', 'enter the code', 'security check']

// --- Agent Task Timeline ---
let charterPlan = [] // { id, title, proof, status, summary, screenshot }

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_PAGE_INFO') {
    const selection = window.getSelection()?.toString()?.trim()
    const meta = document.querySelector('meta[name="description"]')?.content || ''
    sendResponse({
      title: document.title,
      url: window.location.href,
      selectedText: selection || '',
      description: meta,
    })
  }

  if (msg.type === 'BROWSER_SCAN_PAGE') {
    const result = scanPage()
    sendResponse(result)
  }

  if (msg.type === 'BROWSER_FILL_FIELDS') {
    fillFieldsAnimated(msg.fields, msg.delayMs || 100)
      .then((result) => {
        chrome.runtime.sendMessage({
          type: 'BROWSER_ACTION_RESULT',
          commandId: msg.commandId,
          result,
        })
      })
    sendResponse({ status: 'filling_started' })
  }

  if (msg.type === 'BROWSER_CLICK') {
    const result = clickElement(msg.selector, msg.waitForNavigation)
    sendResponse(result)
  }

  if (msg.type === 'BROWSER_CLICK_BY_TEXT') {
    const result = clickByText(msg.text)
    sendResponse(result)
  }

  if (msg.type === 'BROWSER_READ_PAGE') {
    const result = readPage(msg.selector)
    sendResponse(result)
  }

  if (msg.type === 'BROWSER_CAPTURE_CAPTCHA') {
    captureCaptcha().then(result => sendResponse(result))
    return true // async
  }

  // CSP-safe JS execution — pattern-match common agent DOM commands
  if (msg.type === 'BROWSER_EXECUTE_JS') {
    const result = executeSafeJS(msg.code)
    sendResponse(result)
  }

  // --- Timeline sync from background.js (top frame only) ---
  if (msg.type === 'CHARTER_PLAN_SYNC' && window === window.top) {
    charterPlan = msg.plan || []
    renderTimeline()
  }

  return true
})

function buildSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`
  if (el.name) return `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`
  // Fallback: use data attributes, class, or positional selector
  for (const attr of ['data-field', 'data-name', 'data-id', 'data-testid']) {
    const val = el.getAttribute(attr)
    if (val) return `[${attr}="${CSS.escape(val)}"]`
  }
  // Last resort: nth-of-type within parent
  const parent = el.parentElement
  if (parent) {
    const siblings = Array.from(parent.querySelectorAll(`:scope > ${el.tagName.toLowerCase()}`))
    const idx = siblings.indexOf(el)
    if (idx >= 0 && siblings.length > 1) {
      const parentSel = parent.id ? `#${CSS.escape(parent.id)}` : parent.className ? `.${CSS.escape(parent.className.split(' ')[0])}` : null
      if (parentSel) return `${parentSel} > ${el.tagName.toLowerCase()}:nth-of-type(${idx + 1})`
    }
  }
  return null
}

function scanPage() {
  const log = []
  log.push(`[scan] Starting scan on: ${window.location.href}`)
  log.push(`[scan] Document readyState: ${document.readyState}`)

  // --- Scan all documents: top + same-origin frames recursively ---
  const allFields = []
  const allButtons = []
  const allLinks = []
  const allSections = []
  const allErrors = []
  const allInstructions = []
  const frameLog = []

  function scanDocument(doc, frameLabel) {
    if (!doc || !doc.body) {
      frameLog.push(`${frameLabel}: no body`)
      return
    }

    // --- Form Fields (deep: pierces shadow DOM) ---
    const elements = querySelectorAllDeep('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="listbox"], [role="spinbutton"]', doc)
    let fieldCount = 0

    elements.forEach((el) => {
      if (el.type === 'hidden') return
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return

      // Rich label detection — try every strategy
      const label = getFieldLabel(el, doc)
      const selector = buildSelector(el)
      if (!selector) return

      // Detect validation state
      const validationMsg = el.validationMessage || ''
      const ariaInvalid = el.getAttribute('aria-invalid')
      const hasError = ariaInvalid === 'true' || el.classList.contains('error') || el.classList.contains('invalid')

      // Get field group context (fieldset legend, section heading)
      const groupLabel = getFieldGroup(el)

      fieldCount++
      allFields.push({
        tag: el.tagName.toLowerCase(),
        type: el.type || el.getAttribute('role') || '',
        name: el.name || '',
        id: el.id || '',
        label,
        value: el.value || el.textContent?.trim()?.slice(0, 200) || '',
        selector,
        required: el.required || el.getAttribute('aria-required') === 'true',
        disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
        readOnly: el.readOnly || false,
        options: el.tagName === 'SELECT' ? Array.from(el.options).map(o => ({ value: o.value, text: o.text })) : undefined,
        group: groupLabel,
        validationError: hasError ? (validationMsg || 'invalid') : undefined,
        frame: frameLabel,
      })
    })

    // --- Buttons (all clickable actions) ---
    const btnElements = querySelectorAllDeep('button, [type="submit"], [type="reset"], [role="button"], input[type="button"], input[type="image"], a.btn, a.button, .btn, [onclick]', doc)
    btnElements.forEach((el) => {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return
      const text = el.textContent?.trim() || el.getAttribute('aria-label') || el.getAttribute('value') || el.getAttribute('title') || ''
      if (!text || text.length > 200) return
      const selector = buildSelector(el) || (el.id ? `#${el.id}` : null)
      allButtons.push({ text: text.slice(0, 100), selector, type: el.type || el.tagName.toLowerCase(), frame: frameLabel })
    })

    // --- Navigation Links (important for multi-page forms) ---
    doc.querySelectorAll('a[href], [role="tab"], [role="link"], nav a, .nav a, .tabs a, .breadcrumb a, .pagination a').forEach((el) => {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return
      const text = el.textContent?.trim() || el.getAttribute('aria-label') || ''
      if (!text || text.length > 150) return
      const href = el.getAttribute('href') || ''
      if (href.startsWith('javascript:') || href === '#') return
      allLinks.push({ text: text.slice(0, 80), href, selector: buildSelector(el), frame: frameLabel })
    })

    // --- Page Structure: headings, section labels, progress ---
    doc.querySelectorAll('h1, h2, h3, h4, legend, [role="heading"], .section-title, .step-title, .page-title').forEach((el) => {
      const text = el.textContent?.trim()
      if (text && text.length < 200) {
        allSections.push({ level: el.tagName?.toLowerCase() || 'heading', text, frame: frameLabel })
      }
    })

    // --- Error Messages ---
    doc.querySelectorAll('.error, .alert-danger, .alert-error, [role="alert"], .validation-error, .field-error, .form-error, .text-danger, .error-message, .errorMsg').forEach((el) => {
      const text = el.textContent?.trim()
      if (text && text.length > 0 && text.length < 500) {
        allErrors.push({ text, frame: frameLabel })
      }
    })

    // --- Instructions/Help Text (often critical for gov forms) ---
    doc.querySelectorAll('.help-text, .hint, .instructions, .form-text, .description, [role="note"], .info-box, .alert-info, .notice').forEach((el) => {
      const text = el.textContent?.trim()
      if (text && text.length > 10 && text.length < 500) {
        allInstructions.push({ text, frame: frameLabel })
      }
    })

    frameLog.push(`${frameLabel}: ${fieldCount} fields, ${btnElements.length} buttons`)
  }

  // Scan top document
  scanDocument(document, 'top')

  // Recursively scan same-origin frames (critical for gov sites using framesets)
  function scanFrames(doc, depth) {
    if (depth > 3) return // prevent infinite recursion
    const frameEls = doc.querySelectorAll('frame, iframe')
    frameLog.push(`${depth === 0 ? 'top' : 'nested'}: found ${frameEls.length} frame/iframe elements`)
    for (const frameEl of frameEls) {
      try {
        const childDoc = frameEl.contentDocument
        if (!childDoc || childDoc === doc) continue
        if (childDoc.readyState !== 'complete' && childDoc.readyState !== 'interactive') {
          frameLog.push(`frame ${frameEl.src || frameEl.name || '?'}: not ready (${childDoc.readyState})`)
          continue
        }
        const label = frameEl.name || frameEl.id || frameEl.src?.split('/').pop() || `frame-${depth}`
        scanDocument(childDoc, label)
        scanFrames(childDoc, depth + 1) // recurse into nested frames
      } catch (e) {
        frameLog.push(`frame cross-origin: ${frameEl.src || '?'} (${e.message})`)
      }
    }
  }
  scanFrames(document, 0)

  // --- Collect text from all frames for page-level signals ---
  let fullPageText = (document.body?.innerText || '')
  for (const frameEl of document.querySelectorAll('frame, iframe')) {
    try {
      const ft = frameEl.contentDocument?.body?.innerText || ''
      if (ft) fullPageText += '\n' + ft
    } catch {}
  }
  const pageText = fullPageText.toLowerCase()
  const fieldLabels = allFields.map(f => f.label.toLowerCase()).join(' ')
  const isPaymentPage = PAYMENT_KEYWORDS.some(kw => pageText.includes(kw) || fieldLabels.includes(kw))
  const hasCaptcha = detectCaptcha(pageText)

  // --- Progress/breadcrumb detection (check frames too) ---
  let progress = null
  const progressSel = '[role="progressbar"], .progress-bar, .step-indicator, .breadcrumb, .wizard-steps, .steps'
  let progressEl = document.querySelector(progressSel)
  if (!progressEl) {
    for (const frameEl of document.querySelectorAll('frame, iframe')) {
      try {
        progressEl = frameEl.contentDocument?.querySelector(progressSel)
        if (progressEl) break
      } catch {}
    }
  }
  if (progressEl) {
    progress = progressEl.textContent?.trim()?.slice(0, 200) || progressEl.getAttribute('aria-valuenow') || null
  }

  // --- Summary text (first ~2000 chars from all frames for context) ---
  const visibleText = fullPageText.slice(0, 2000)

  log.push(`[scan] Result: ${allFields.length} fields, ${allButtons.length} buttons, ${allLinks.length} links, ${allSections.length} sections`)
  log.push(`[scan] Frames: ${frameLog.join(' | ')}`)
  if (allErrors.length > 0) log.push(`[scan] Errors on page: ${allErrors.map(e => e.text).join('; ')}`)

  return {
    url: window.location.href,
    title: document.title,
    formCount: document.querySelectorAll('form').length,
    fields: allFields,
    buttons: allButtons,
    links: allLinks.slice(0, 30), // cap to avoid noise
    sections: allSections,
    errors: allErrors,
    instructions: allInstructions.slice(0, 10),
    progress,
    isPaymentPage,
    hasCaptcha,
    visibleText,
    _log: log.concat(frameLog),
  }
}

// --- Deep querySelector that pierces shadow DOM ---
function querySelectorAllDeep(selector, root) {
  const results = []
  function traverse(node) {
    try {
      results.push(...node.querySelectorAll(selector))
    } catch {}
    // Recurse into shadow roots
    try {
      node.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) traverse(el.shadowRoot)
      })
    } catch {}
  }
  traverse(root || document)
  return results
}

// --- Rich label detection for form fields ---
function getFieldLabel(el, doc) {
  // 1. Explicit <label for="id">
  if (el.id) {
    const explicitLabel = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`)
    if (explicitLabel) return explicitLabel.textContent.trim()
  }
  // 2. Wrapping <label>
  const wrapLabel = el.closest('label')
  if (wrapLabel) return wrapLabel.textContent.trim()
  // 3. el.labels API
  if (el.labels?.[0]) return el.labels[0].textContent.trim()
  // 4. aria-label
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label')
  // 5. aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy && doc) {
    const parts = labelledBy.split(/\s+/).map(id => doc.getElementById(id)?.textContent?.trim()).filter(Boolean)
    if (parts.length) return parts.join(' ')
  }
  // 6. Preceding label/span/td (common in table-based gov forms)
  const prev = el.previousElementSibling
  if (prev) {
    const tag = prev.tagName?.toLowerCase()
    if (tag === 'label' || tag === 'span' || tag === 'td' || tag === 'th') {
      const t = prev.textContent?.trim()
      if (t && t.length < 100) return t
    }
  }
  // 7. Parent cell's preceding cell (table-based forms: <td>Label</td><td><input></td>)
  const parentTd = el.closest('td')
  if (parentTd) {
    const prevTd = parentTd.previousElementSibling
    if (prevTd) {
      const t = prevTd.textContent?.trim()
      if (t && t.length < 100) return t
    }
  }
  // 8. placeholder, name, title
  return el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('title') || ''
}

// --- Get the group/section a field belongs to ---
function getFieldGroup(el) {
  // Check fieldset > legend
  const fieldset = el.closest('fieldset')
  if (fieldset) {
    const legend = fieldset.querySelector('legend')
    if (legend) return legend.textContent.trim()
  }
  // Check closest heading
  let node = el
  for (let i = 0; i < 10 && node; i++) {
    node = node.parentElement
    if (!node) break
    const heading = node.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > legend, :scope > .section-title')
    if (heading) return heading.textContent.trim()
  }
  return undefined
}

async function fillFieldsAnimated(fields, delayMs) {
  const results = []

  for (const field of fields) {
    await new Promise(r => setTimeout(r, delayMs))

    // Search top document first, then all same-origin frames
    let el = document.querySelector(field.selector)
    if (!el) {
      for (const frameEl of document.querySelectorAll('frame, iframe')) {
        try {
          el = frameEl.contentDocument?.querySelector(field.selector)
          if (el) break
        } catch {}
      }
    }
    if (!el) {
      results.push({ ...field, status: 'not_found' })
      continue
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    await new Promise(r => setTimeout(r, 50))

    const originalOutline = el.style.outline
    const originalTransition = el.style.transition
    el.style.transition = 'outline 0.2s'
    el.style.outline = '2px solid #3b82f6'

    if (el.tagName === 'SELECT') {
      // Find matching option — try exact value, then exact text, then substring
      const option = Array.from(el.options).find(o =>
        o.value === field.value
      ) || Array.from(el.options).find(o =>
        o.text.trim().toLowerCase() === field.value.toLowerCase()
      ) || Array.from(el.options).find(o =>
        o.text.trim().toLowerCase().includes(field.value.toLowerCase())
        || field.value.toLowerCase().includes(o.text.trim().toLowerCase())
      )

      if (option) {
        // Set value completely silently — no focus, no click, no mousedown
        // Just set the DOM properties and fire change
        el.selectedIndex = option.index
        option.selected = true
        // Use native setter to bypass framework wrappers
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set
        if (nativeSetter) nativeSetter.call(el, option.value)
        else el.value = option.value
        // Single change event — that's all frameworks need
        el.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        // Last resort — try setting raw value
        el.value = field.value
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
    } else if (el.type === 'radio') {
      el.checked = true
      el.dispatchEvent(new Event('change', { bubbles: true }))
      el.dispatchEvent(new Event('click', { bubbles: true }))
    } else if (el.type === 'checkbox') {
      const shouldCheck = field.value === 'true' || field.value === '1' || field.value === 'yes'
      if (el.checked !== shouldCheck) {
        el.checked = shouldCheck
        el.dispatchEvent(new Event('change', { bubbles: true }))
        el.dispatchEvent(new Event('click', { bubbles: true }))
      }
    } else {
      el.value = ''
      el.focus()
      for (const char of field.value) {
        el.value += char
        el.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise(r => setTimeout(r, 15))
      }
    }

    // Only dispatch generic events for text inputs (selects/radios/checkboxes already handled above)
    if (el.tagName !== 'SELECT' && el.type !== 'radio' && el.type !== 'checkbox') {
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      el.dispatchEvent(new Event('blur', { bubbles: true }))
    }

    await new Promise(r => setTimeout(r, 300))
    el.style.outline = originalOutline
    el.style.transition = originalTransition

    results.push({ ...field, status: 'filled' })

    chrome.runtime.sendMessage({
      type: 'FIELD_FILLED',
      label: field.label,
      source: field.source,
    })
  }

  return { status: 'complete', results }
}

function clickElement(selector) {
  // Search top document first, then same-origin frames
  let el = document.querySelector(selector)
  if (!el) {
    for (const frameEl of document.querySelectorAll('frame, iframe')) {
      try {
        el = frameEl.contentDocument?.querySelector(selector)
        if (el) break
      } catch {}
    }
  }
  if (!el) return { status: 'not_found', selector }

  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  if (el.style !== undefined) {
    const orig = el.style.outline
    el.style.outline = '2px solid #f59e0b'
    setTimeout(() => { el.style.outline = orig }, 500)
  }
  el.click()

  return { status: 'clicked', selector, text: el.textContent?.trim()?.slice(0, 100) || '', url: window.location.href }
}

function clickByText(text) {
  const lowerText = text.toLowerCase()
  // Search all clickable elements in top document + frames
  const docs = [document]
  for (const frameEl of document.querySelectorAll('frame, iframe')) {
    try { if (frameEl.contentDocument) docs.push(frameEl.contentDocument) } catch {}
  }

  for (const doc of docs) {
    const candidates = doc.querySelectorAll('button, a, [type="submit"], [role="button"], input[type="button"], input[type="submit"], .btn, .button')
    for (const el of candidates) {
      const elText = (el.textContent?.trim() || el.getAttribute('value') || el.getAttribute('aria-label') || '').toLowerCase()
      if (elText.includes(lowerText) || lowerText.includes(elText)) {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) continue
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (el.style !== undefined) {
          const orig = el.style.outline
          el.style.outline = '2px solid #f59e0b'
          setTimeout(() => { el.style.outline = orig }, 500)
        }
        el.click()
        return { status: 'clicked', text: el.textContent?.trim()?.slice(0, 100) || '', url: window.location.href, method: 'text-match' }
      }
    }
  }
  return { status: 'not_found', text }
}

function readPage(selector) {
  // Search top document first, then same-origin frames
  let target = selector ? document.querySelector(selector) : document.body
  if (!target && selector) {
    for (const frameEl of document.querySelectorAll('frame, iframe')) {
      try {
        target = frameEl.contentDocument?.querySelector(selector)
        if (target) break
      } catch {}
    }
  }
  // Also read all frame content when no selector given
  let text = ''
  if (!selector) {
    // Merge text from top + all frames
    text = (document.body?.innerText || '').slice(0, 3000)
    for (const frameEl of document.querySelectorAll('frame, iframe')) {
      try {
        const frameText = frameEl.contentDocument?.body?.innerText || ''
        if (frameText) text += '\n--- [frame: ' + (frameEl.name || frameEl.src || 'iframe') + '] ---\n' + frameText.slice(0, 3000)
      } catch {}
    }
    text = text.slice(0, 8000)
  } else {
    if (!target) return { status: 'not_found', selector }
    text = target.innerText?.slice(0, 5000) || ''
  }

  const lowerText = text.toLowerCase()

  return {
    status: 'ok',
    title: document.title,
    url: window.location.href,
    text,
    indicators: {
      hasSuccess: lowerText.includes('success') || lowerText.includes('confirmed') || lowerText.includes('thank you'),
      hasError: lowerText.includes('error') || lowerText.includes('failed') || lowerText.includes('invalid'),
    },
  }
}

function detectCaptcha(pageText) {
  // Check text on page
  if (CAPTCHA_KEYWORDS.some(kw => pageText.includes(kw))) return true
  // Check for CAPTCHA images
  const imgs = document.querySelectorAll('img')
  for (const img of imgs) {
    const src = (img.src || '').toLowerCase()
    const alt = (img.alt || '').toLowerCase()
    const id = (img.id || '').toLowerCase()
    const cls = (img.className || '').toLowerCase()
    if (src.includes('captcha') || alt.includes('captcha') || id.includes('captcha') || cls.includes('captcha')) return true
  }
  // Check for reCAPTCHA / hCaptcha iframes
  const iframes = document.querySelectorAll('iframe')
  for (const iframe of iframes) {
    const src = (iframe.src || '').toLowerCase()
    if (src.includes('recaptcha') || src.includes('hcaptcha') || src.includes('captcha')) return true
  }
  return false
}

async function captureCaptcha() {
  // Find CAPTCHA image elements
  const candidates = []
  const imgs = document.querySelectorAll('img')
  for (const img of imgs) {
    const src = (img.src || '').toLowerCase()
    const alt = (img.alt || '').toLowerCase()
    const id = (img.id || '').toLowerCase()
    const cls = (img.className || '').toLowerCase()
    const parent = img.parentElement
    const parentText = (parent?.innerText || '').toLowerCase()
    if (src.includes('captcha') || alt.includes('captcha') || id.includes('captcha') || cls.includes('captcha') || parentText.includes('captcha')) {
      candidates.push(img)
    }
  }

  // Also look for canvas-based CAPTCHAs
  const canvases = document.querySelectorAll('canvas')
  for (const canvas of canvases) {
    const id = (canvas.id || '').toLowerCase()
    const cls = (canvas.className || '').toLowerCase()
    if (id.includes('captcha') || cls.includes('captcha')) {
      try {
        const dataUrl = canvas.toDataURL('image/png')
        return { status: 'captured', type: 'canvas', base64: dataUrl, width: canvas.width, height: canvas.height }
      } catch { /* tainted canvas */ }
    }
  }

  if (candidates.length === 0) {
    // Fallback: capture the whole visible area around any "captcha" text
    return { status: 'no_captcha_image_found', hint: 'Try browser_screenshot to see the full page' }
  }

  // Capture the first CAPTCHA image by drawing it to a canvas
  const img = candidates[0]
  try {
    // Try to capture via canvas
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    // Find the associated input field (usually nearby)
    let captchaInput = null
    const parent = img.closest('form') || img.parentElement?.parentElement
    if (parent) {
      const input = parent.querySelector('input[type="text"]:not([type="hidden"])')
      if (input) {
        captchaInput = input.id ? `#${input.id}` : input.name ? `[name="${input.name}"]` : null
      }
    }
    return { status: 'captured', type: 'image', base64: dataUrl, width: canvas.width, height: canvas.height, inputSelector: captchaInput, imgSrc: img.src }
  } catch {
    // Cross-origin image — can't draw to canvas, return the src URL instead
    let captchaInput = null
    const parent = img.closest('form') || img.parentElement?.parentElement
    if (parent) {
      const input = parent.querySelector('input[type="text"]:not([type="hidden"])')
      if (input) {
        captchaInput = input.id ? `#${input.id}` : input.name ? `[name="${input.name}"]` : null
      }
    }
    return { status: 'cross_origin', type: 'image', imgSrc: img.src, inputSelector: captchaInput, hint: 'Image is cross-origin, requesting screenshot from background instead' }
  }
}

// --- Agent Timeline Overlay ---

function renderTimeline() {
  let panel = document.getElementById('charter-timeline-panel')

  if (charterPlan.length === 0) {
    if (panel) panel.remove()
    return
  }

  if (!panel) {
    panel = document.createElement('div')
    panel.id = 'charter-timeline-panel'
    document.body.appendChild(panel)

    if (!document.getElementById('charter-timeline-styles')) {
      const style = document.createElement('style')
      style.id = 'charter-timeline-styles'
      style.textContent = `
        #charter-timeline-panel {
          position: fixed; top: 16px; left: 16px; z-index: 2147483646;
          background: rgba(10,10,10,0.92); backdrop-filter: blur(12px);
          border: 1px solid rgba(60,60,60,0.5); border-radius: 16px;
          padding: 12px 16px; max-width: 280px;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          cursor: move; user-select: none; transition: opacity 0.2s;
        }
        #charter-timeline-panel .ct-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 8px; padding: 0 2px;
        }
        #charter-timeline-panel .ct-title { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500; }
        #charter-timeline-panel .ct-count { font-size: 10px; color: #555; }
        #charter-timeline-panel .ct-step {
          display: flex; align-items: center; gap: 8px;
          padding: 6px 8px; border-radius: 8px; transition: background 0.15s;
        }
        #charter-timeline-panel .ct-step:hover { background: rgba(255,255,255,0.04); }
        #charter-timeline-panel .ct-step.has-ss { cursor: pointer; }
        #charter-timeline-panel .ct-icon {
          width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; box-sizing: border-box;
        }
        #charter-timeline-panel .ct-icon.pending { border: 1px solid #444; }
        #charter-timeline-panel .ct-icon.active {
          border: 2px solid #a855f7; border-top-color: transparent;
          animation: ct-spin 0.8s linear infinite;
        }
        #charter-timeline-panel .ct-icon.done { background: rgba(52,211,153,0.15); }
        #charter-timeline-panel .ct-icon.done svg { width: 10px; height: 10px; }
        #charter-timeline-panel .ct-icon.error { background: rgba(239,68,68,0.15); }
        #charter-timeline-panel .ct-text {
          font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          flex: 1; min-width: 0;
        }
        #charter-timeline-panel .ct-text.pending { color: #555; }
        #charter-timeline-panel .ct-text.active { color: #fff; }
        #charter-timeline-panel .ct-text.done { color: #888; }
        #charter-timeline-panel .ct-text.error { color: #f87171; }
        #charter-timeline-panel .ct-thumb {
          width: 20px; height: 20px; border-radius: 4px; border: 1px solid #333;
          overflow: hidden; flex-shrink: 0;
        }
        #charter-timeline-panel .ct-thumb img { width: 100%; height: 100%; object-fit: cover; }
        @keyframes ct-spin { to { transform: rotate(360deg); } }
        #charter-ss-overlay {
          position: fixed; inset: 0; z-index: 2147483647;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
          pointer-events: none; animation: ct-fi 0.15s ease-out;
        }
        #charter-ss-overlay .ct-preview {
          max-width: 80vw; max-height: 80vh; border-radius: 16px;
          overflow: hidden; border: 1px solid #444; position: relative;
          box-shadow: 0 25px 50px rgba(0,0,0,0.5); animation: ct-si 0.2s ease-out;
        }
        #charter-ss-overlay img { width: 100%; height: 100%; object-fit: contain; }
        #charter-ss-overlay .ct-cap {
          position: absolute; bottom: 0; left: 0; right: 0;
          background: linear-gradient(transparent, rgba(0,0,0,0.9)); padding: 16px; text-align: center;
        }
        #charter-ss-overlay .ct-cap-t { font-size: 14px; color: #fff; font-weight: 500; }
        #charter-ss-overlay .ct-cap-s { font-size: 12px; color: #34d399; margin-top: 4px; }
        @keyframes ct-fi { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ct-si { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `
      document.head.appendChild(style)
    }
  }

  const done = charterPlan.filter(s => s.status === 'done').length
  let html = `<div class="ct-header"><span class="ct-title">Charter</span><span class="ct-count">${done}/${charterPlan.length}</span></div>`

  for (const step of charterPlan) {
    const iconHtml = step.status === 'done'
      ? `<div class="ct-icon done"><svg viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="#34d399" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`
      : step.status === 'active'
      ? `<div class="ct-icon active"></div>`
      : step.status === 'error'
      ? `<div class="ct-icon error"><span style="color:#f87171;font-size:8px;font-weight:bold">!</span></div>`
      : `<div class="ct-icon pending"></div>`

    const hasSS = step.status === 'done' && step.screenshot
    const thumbHtml = hasSS ? `<div class="ct-thumb"><img src="${step.screenshot}" alt=""></div>` : ''

    html += `<div class="ct-step ${hasSS ? 'has-ss' : ''}" data-step-id="${step.id}">${iconHtml}<span class="ct-text ${step.status}">${step.title}</span>${thumbHtml}</div>`
  }

  panel.innerHTML = html
  makeTimelineDraggable(panel)

  // Add hover listeners for screenshot preview
  panel.querySelectorAll('.ct-step.has-ss').forEach(el => {
    el.addEventListener('mouseenter', () => {
      const stepId = el.getAttribute('data-step-id')
      const step = charterPlan.find(s => s.id === stepId)
      if (step && step.screenshot) showScreenshotOverlay(step)
    })
    el.addEventListener('mouseleave', hideScreenshotOverlay)
  })
}

function showScreenshotOverlay(step) {
  hideScreenshotOverlay()
  const overlay = document.createElement('div')
  overlay.id = 'charter-ss-overlay'
  overlay.innerHTML = `
    <div class="ct-preview">
      <img src="${step.screenshot}" alt="${step.title}">
      <div class="ct-cap">
        <div class="ct-cap-t">${step.title}</div>
        ${step.summary ? `<div class="ct-cap-s">${step.summary}</div>` : ''}
      </div>
    </div>
  `
  document.body.appendChild(overlay)
}

function hideScreenshotOverlay() {
  const overlay = document.getElementById('charter-ss-overlay')
  if (overlay) overlay.remove()
}

function makeTimelineDraggable(el) {
  if (el._draggable) return
  el._draggable = true
  let isDragging = false, startX, startY, startLeft, startTop
  el.addEventListener('mousedown', (e) => {
    if (e.target.closest('.ct-step')) return
    isDragging = true
    startX = e.clientX; startY = e.clientY
    const rect = el.getBoundingClientRect()
    startLeft = rect.left; startTop = rect.top
    e.preventDefault()
  })
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return
    el.style.left = (startLeft + e.clientX - startX) + 'px'
    el.style.top = (startTop + e.clientY - startY) + 'px'
    el.style.right = 'auto'; el.style.bottom = 'auto'
  })
  document.addEventListener('mouseup', () => { isDragging = false })
}

// --- CSP-safe JS execution ---
// Instead of eval (blocked by MV3 CSP), pattern-match common agent DOM commands
function executeSafeJS(code) {
  try {
    // Pattern 1: Enumerate form elements (the most common agent command)
    if (code.includes('querySelectorAll') && (code.includes('.map(') || code.includes('JSON.stringify'))) {
      const fields = Array.from(document.querySelectorAll('select, input, textarea, button'))
        .slice(0, 30)
        .map(e => ({
          tag: e.tagName,
          id: e.id,
          name: e.name,
          type: e.type,
          value: e.value,
          options: e.tagName === 'SELECT'
            ? Array.from(e.options).slice(0, 20).map(o => o.text + ':' + o.value)
            : undefined
        }))
      return { status: 'executed', result: JSON.stringify(fields) }
    }

    // Pattern 2: Set value on a specific element
    // Agent sends: var s=document.querySelector('#id'); s.value='val'; s.dispatchEvent(...)
    // Or: document.querySelector('#id').value = 'val'
    const setValueMatch = code.match(/querySelector\(\s*['"](.+?)['"]\s*\)[\s\S]*?\.value\s*=\s*['"](.+?)['"]/)
    if (setValueMatch) {
      const [, selector, value] = setValueMatch
      const el = document.querySelector(selector)
      if (!el) return { status: 'executed', result: 'element not found: ' + selector }
      if (el.tagName === 'SELECT') {
        const opt = Array.from(el.options).find(o => o.value === value)
          || Array.from(el.options).find(o => o.text.trim().toLowerCase() === value.toLowerCase())
          || Array.from(el.options).find(o => o.text.trim().toLowerCase().includes(value.toLowerCase()))
        if (opt) {
          el.selectedIndex = opt.index
          opt.selected = true
          el.value = opt.value
        } else {
          el.value = value
        }
      } else {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        if (nativeSetter) nativeSetter.call(el, value)
        else el.value = value
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return { status: 'executed', result: 'done' }
    }

    // Pattern 3: Click an element
    const clickMatch = code.match(/querySelector\(\s*['"](.+?)['"]\s*\)\.click\(\)/)
    if (clickMatch) {
      const el = document.querySelector(clickMatch[1])
      if (!el) return { status: 'executed', result: 'element not found: ' + clickMatch[1] }
      el.click()
      return { status: 'executed', result: 'clicked' }
    }

    // Pattern 4: Read text content
    if (code.includes('innerText') || code.includes('textContent')) {
      const selectorMatch = code.match(/querySelector\(\s*['"](.+?)['"]\s*\)/)
      const el = selectorMatch ? document.querySelector(selectorMatch[1]) : document.body
      const text = (el?.innerText || el?.textContent || '').slice(0, 3000)
      return { status: 'executed', result: text }
    }

    // Pattern 5: Dispatch event
    const eventMatch = code.match(/querySelector\(\s*['"](.+?)['"]\s*\)\.dispatchEvent/)
    if (eventMatch) {
      const el = document.querySelector(eventMatch[1])
      if (!el) return { status: 'executed', result: 'element not found' }
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return { status: 'executed', result: 'done' }
    }

    // Pattern 6: Get element property (value, checked, selectedIndex, etc.)
    const getPropMatch = code.match(/querySelector\(\s*['"](.+?)['"]\s*\)\.(\w+)/)
    if (getPropMatch) {
      const el = document.querySelector(getPropMatch[1])
      if (!el) return { status: 'executed', result: 'element not found: ' + getPropMatch[1] }
      const prop = el[getPropMatch[2]]
      return { status: 'executed', result: typeof prop === 'object' ? JSON.stringify(prop) : String(prop) }
    }

    // Fallback: Use our scan as a generic "tell me what's on the page"
    if (code.includes('document') && code.includes('query')) {
      const result = scanPage()
      return { status: 'executed', result: JSON.stringify({ fields: result.fields.length, buttons: result.buttons.length, hint: 'Use browser_scan_page or browser_fill_fields for specific interactions' }) }
    }

    return { error: 'Cannot execute arbitrary JS (CSP restriction). Use browser_scan_page, browser_fill_fields, and browser_click instead.' }
  } catch (e) {
    return { error: e.message }
  }
}

// Close idempotency guard
}

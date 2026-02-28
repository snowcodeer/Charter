// Charter content script — browser automation engine
// Handles: form scanning, animated filling, clicking, page reading, payment detection

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

  if (msg.type === 'BROWSER_READ_PAGE') {
    const result = readPage(msg.selector)
    sendResponse(result)
  }

  if (msg.type === 'BROWSER_CAPTURE_CAPTCHA') {
    captureCaptcha().then(result => sendResponse(result))
    return true // async
  }

  // --- Timeline sync from background.js ---
  if (msg.type === 'CHARTER_PLAN_SYNC') {
    charterPlan = msg.plan || []
    renderTimeline()
  }

  return true
})

function scanPage() {
  const fields = []
  const inputs = document.querySelectorAll('input, textarea, select')

  inputs.forEach((el) => {
    if (el.type === 'hidden') return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return

    const label = el.labels?.[0]?.textContent?.trim()
      || el.getAttribute('aria-label')
      || el.getAttribute('placeholder')
      || el.getAttribute('name')
      || ''

    const selector = el.id ? `#${el.id}`
      : el.name ? `[name="${el.name}"]`
      : null

    if (!selector) return

    fields.push({
      tag: el.tagName.toLowerCase(),
      type: el.type || '',
      name: el.name || '',
      id: el.id || '',
      label,
      value: el.value || '',
      selector,
      required: el.required || el.getAttribute('aria-required') === 'true',
      options: el.tagName === 'SELECT' ? Array.from(el.options).map(o => ({ value: o.value, text: o.text })) : undefined,
    })
  })

  const buttons = []
  document.querySelectorAll('button, [type="submit"], [role="button"], a.btn, a.button').forEach((el) => {
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return
    const text = el.textContent?.trim() || el.getAttribute('aria-label') || ''
    if (!text) return
    const selector = el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : null
    buttons.push({ text, selector, type: el.type || el.tagName.toLowerCase() })
  })

  const pageText = document.body.innerText.toLowerCase()
  const fieldLabels = fields.map(f => f.label.toLowerCase()).join(' ')
  const isPaymentPage = PAYMENT_KEYWORDS.some(kw =>
    pageText.includes(kw) || fieldLabels.includes(kw)
  )

  // Detect CAPTCHAs
  const hasCaptcha = detectCaptcha(pageText)

  return {
    url: window.location.href,
    title: document.title,
    formCount: document.querySelectorAll('form').length,
    fields,
    buttons,
    isPaymentPage,
    hasCaptcha,
  }
}

async function fillFieldsAnimated(fields, delayMs) {
  const results = []

  for (const field of fields) {
    await new Promise(r => setTimeout(r, delayMs))

    const el = document.querySelector(field.selector)
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
      // Proper select handling — dispatch mouse events + use selectedIndex for native selects
      el.focus()
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      const option = Array.from(el.options).find(o =>
        o.value === field.value
        || o.text.toLowerCase() === field.value.toLowerCase()
        || o.text.toLowerCase().includes(field.value.toLowerCase())
      )
      if (option) {
        el.value = option.value
        // Set selectedIndex directly — some sites only react to this
        el.selectedIndex = option.index
      } else {
        el.value = field.value
      }
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
      el.dispatchEvent(new Event('blur', { bubbles: true }))
      // For React-based sites, trigger React's synthetic change handler
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, option?.value || field.value)
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
  const el = document.querySelector(selector)
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

function readPage(selector) {
  const target = selector ? document.querySelector(selector) : document.body
  if (!target) return { status: 'not_found', selector }

  const text = target.innerText?.slice(0, 5000) || ''
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

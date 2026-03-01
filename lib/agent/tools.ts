import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'

// Import existing connector implementations
import { searchWeb as searchWebConnector, getPageContents as getPageContentsConnector } from '../connectors/exa'
import { getPassportProfile as getPassportProfileConnector, updatePassportProfile as updatePassportProfileConnector } from '../connectors/passport'
import { checkCalendar as checkCalendarConnector, createCalendarEvent as createCalendarEventConnector } from '../connectors/calendar'
import { readEmails as readEmailsConnector, readEmailBody as readEmailBodyConnector } from '../connectors/gmail'
import { searchDriveFiles as searchDriveConnector, downloadDriveFile as downloadDriveConnector } from '../connectors/drive'
import { globeConnectors } from '../connectors/globe'
import { getVisaPortal, VISA_PORTALS } from '../data/visa-urls'

// --- Exa Search Tools ---

export const searchWeb = tool(
  async (input) => {
    const result = await searchWebConnector.execute(input)
    return JSON.stringify(result)
  },
  {
    name: 'search_web',
    description: searchWebConnector.description,
    schema: z.object({
      query: z.string().describe('The search query. Be specific — include country names, dates, passport nationality, etc.'),
      numResults: z.number().optional().describe('Number of results to return (default 5, max 10)'),
      type: z.enum(['auto', 'fast', 'deep']).optional().describe('Search depth: "fast" for quick lookups, "deep" for thorough research, "auto" to let Exa decide'),
    }),
  }
)

export const getPageContents = tool(
  async (input) => {
    const result = await getPageContentsConnector.execute(input)
    return JSON.stringify(result)
  },
  {
    name: 'get_page_contents',
    description: getPageContentsConnector.description,
    schema: z.object({
      urls: z.array(z.string()).describe('Array of URLs to extract content from (max 5)'),
    }),
  }
)

// --- Passport Tools ---

export const getPassportProfile = tool(
  async (input) => {
    const result = await getPassportProfileConnector.execute(input)
    return JSON.stringify(result)
  },
  {
    name: 'get_passport_profile',
    description: getPassportProfileConnector.description,
    schema: z.object({
      profileId: z.string().optional().describe('Profile ID. If omitted, returns the first (default) profile.'),
    }),
  }
)

export const updatePassportProfile = tool(
  async (input) => {
    const result = await updatePassportProfileConnector.execute(input)
    return JSON.stringify(result)
  },
  {
    name: 'update_passport_profile',
    description: updatePassportProfileConnector.description,
    schema: z.object({
      name: z.string().describe("User's full name"),
      email: z.string().optional().describe("User's email"),
      passports: z.array(z.object({
        nationality: z.string().describe('Country name or ISO-2 code'),
        passportNumber: z.string().optional().describe('Passport number'),
        expiryDate: z.string().optional().describe('Expiry date ISO string'),
        issuingCountry: z.string().describe('Issuing country'),
      })).describe('Array of passports the user holds'),
    }),
  }
)

// --- Google Calendar Tools ---

export const checkCalendar = tool(
  async (input) => {
    const result = await checkCalendarConnector.execute(input)
    return JSON.stringify(result)
  },
  {
    name: 'check_calendar',
    description: checkCalendarConnector.description,
    schema: z.object({
      startDate: z.string().describe('Start date ISO string (e.g. "2026-03-15")'),
      endDate: z.string().describe('End date ISO string (e.g. "2026-03-22")'),
    }),
  }
)

export const createCalendarEvent = tool(
  async (input) => {
    const result = await createCalendarEventConnector.execute(input)
    return JSON.stringify(result)
  },
  {
    name: 'create_calendar_event',
    description: createCalendarEventConnector.description,
    schema: z.object({
      title: z.string().describe('Event title (e.g. "Flight to Tokyo" or "Visa appointment")'),
      startDate: z.string().describe('Start date/time ISO string'),
      endDate: z.string().describe('End date/time ISO string'),
      description: z.string().optional().describe('Event description/notes'),
      location: z.string().optional().describe('Location (e.g. "Heathrow Airport")'),
    }),
  }
)

// --- Gmail Tools ---

export const readEmails = tool(
  async (input) => {
    const result = await readEmailsConnector.execute(input)
    return JSON.stringify(result)
  },
  {
    name: 'read_emails',
    description: readEmailsConnector.description,
    schema: z.object({
      query: z.string().describe('Gmail search query (e.g. "flight confirmation" or "visa application receipt")'),
      maxResults: z.number().optional().describe('Max emails to return (default 5)'),
    }),
  }
)

export const readEmailBody = tool(
  async (input) => {
    const result = await readEmailBodyConnector.execute(input)
    return JSON.stringify(result)
  },
  {
    name: 'read_email_body',
    description: readEmailBodyConnector.description,
    schema: z.object({
      messageId: z.string().describe('The email message ID (from read_emails results)'),
    }),
  }
)

// --- Google Drive Tools ---

export const searchDriveFiles = tool(
  async (input) => {
    const result = await searchDriveConnector.execute(input)
    return JSON.stringify(result)
  },
  {
    name: 'search_drive_files',
    description: searchDriveConnector.description,
    schema: z.object({
      query: z.string().describe('Search query (e.g. "passport", "visa copy", "ID photo", "bank statement")'),
      mimeType: z.string().optional().describe('Filter by MIME type (e.g. "image/jpeg", "application/pdf")'),
      maxResults: z.number().optional().describe('Max files to return (default 10)'),
    }),
  }
)

export const scanPassportPhoto = tool(
  async (input) => {
    // Step 1: Download the file from Drive
    const fileResult = await downloadDriveConnector.execute({ fileId: input.fileId }) as Record<string, unknown>

    if (fileResult.status !== 'downloaded' || !fileResult.base64) {
      return JSON.stringify({ error: 'Could not download file', details: fileResult })
    }

    // Step 2: Send to Claude vision to extract passport data
    const anthropic = new Anthropic()
    const mimeType = fileResult.mimeType as string
    let mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' = 'image/jpeg'
    if (mimeType.includes('png')) mediaType = 'image/png'
    else if (mimeType.includes('webp')) mediaType = 'image/webp'

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: fileResult.base64 as string },
          },
          {
            type: 'text',
            text: `This is a photo of a passport or travel document. Extract ALL visible information and return it as JSON with these fields:
{
  "fullName": "...",
  "givenNames": "...",
  "surname": "...",
  "nationality": "...",
  "dateOfBirth": "YYYY-MM-DD",
  "sex": "M or F",
  "passportNumber": "...",
  "issuingCountry": "...",
  "issueDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD",
  "placeOfBirth": "...",
  "mrz": "machine readable zone text if visible"
}
Return ONLY the JSON, nothing else. Use null for fields you can't read.`,
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    try {
      const data = JSON.parse(text)
      return JSON.stringify({ status: 'extracted', source: `Drive file: ${fileResult.fileName}`, data })
    } catch {
      return JSON.stringify({ status: 'extracted_raw', source: `Drive file: ${fileResult.fileName}`, raw: text })
    }
  },
  {
    name: 'scan_passport_photo',
    description: 'Download a passport/ID photo from Google Drive and use AI vision to extract all passport data (name, nationality, number, expiry, DOB, etc.). Use after search_drive_files finds a passport image. Returns structured passport data that you should save with update_passport_profile.',
    schema: z.object({
      fileId: z.string().describe('Google Drive file ID of the passport photo (from search_drive_files)'),
    }),
  }
)

// --- Approval / Planning Tools ---

export const proposeActions = tool(
  async (input) => {
    // This tool just returns the plan as structured data.
    // The SSE route will detect this tool's output and emit approval_request events.
    return JSON.stringify(input)
  },
  {
    name: 'propose_actions',
    description: `Present a structured action plan to the user for approval. Use this AFTER you've done thorough research and are ready to propose concrete actions. Each action becomes an approval card the user can approve or skip. The user will respond with which actions they approved, then you execute those.

Types: "flight", "visa", "accommodation", "calendar", "insurance", "transport", "document", "other"
Risk levels: "low" (info only, calendar), "medium" (applications, forms), "high" (payments, bookings)`,
    schema: z.object({
      summary: z.string().describe('Brief summary of the overall plan'),
      actions: z.array(z.object({
        id: z.string().describe('Unique action ID (e.g. "1", "2", "3")'),
        type: z.enum(['flight', 'visa', 'accommodation', 'calendar', 'insurance', 'transport', 'document', 'other']),
        title: z.string().describe('Short action title (e.g. "Book Flight")'),
        description: z.string().describe('Details — route, price, dates, requirements, etc.'),
        risk: z.enum(['low', 'medium', 'high']),
        url: z.string().optional().describe('Relevant URL if applicable'),
        price: z.string().optional().describe('Human-readable price e.g. £450, Free'),
        duration: z.string().optional().describe('Duration or time e.g. 2h 30m, 3 nights'),
        recommended: z.boolean().optional().describe('Mark the best option as recommended'),
        provider: z.string().optional().describe('Service provider name'),
      })).describe('List of proposed actions'),
    }),
  }
)

// --- Agent Task Timeline Tools ---

export const planSteps = tool(
  async (input) => {
    return JSON.stringify(input)
  },
  {
    name: 'plan_steps',
    description: `Declare your execution plan BEFORE starting work. Call this at the start of any multi-step task (browser automation, research, booking). Each step should include what you'll do and what PROOF of completion looks like — what would convince the user you actually did it. You can call this again to replace the plan if requirements change.

Example: If booking a visa, proof is NOT "I clicked submit" — proof is "confirmation page showing application reference number and applicant name."`,
    schema: z.object({
      steps: z.array(z.object({
        id: z.string().describe('Unique step ID (e.g. "1", "2", "3")'),
        title: z.string().describe('What you will do (e.g. "Navigate to Azerbaijan e-visa portal")'),
        proof: z.string().describe('What EVIDENCE of completion looks like (e.g. "Confirmation page showing reference number")'),
      })).describe('Ordered list of steps'),
    }),
  }
)

export const completeStep = tool(
  async (input, config) => {
    try {
      const data = await _browserFetch('screenshot', {}, config?.signal)
      const screenshot = data.result?.screenshot || null
      return JSON.stringify({ ...input, screenshot, status: 'completed' })
    } catch {
      return JSON.stringify({ ...input, screenshot: null, status: 'completed' })
    }
  },
  {
    name: 'complete_step',
    description: `Mark a plan step as completed WITH proof. Call this ONLY when you have verified the step succeeded — you should have used browser_read_page or similar to confirm the result matches your proof criteria. This captures a screenshot of the current browser page as evidence. The screenshot should show the proof you defined in plan_steps.`,
    schema: z.object({
      stepId: z.string().describe('The step ID from plan_steps to mark complete'),
      summary: z.string().describe('What was accomplished (e.g. "Visa application submitted — ref #VZ-2847")'),
    }),
  }
)

export const addPlanStep = tool(
  async (input) => {
    return JSON.stringify(input)
  },
  {
    name: 'add_plan_step',
    description: 'Add a new step to the current plan mid-execution. Use when you discover something unexpected (CAPTCHA, extra page, additional requirement).',
    schema: z.object({
      id: z.string().describe('Unique step ID'),
      title: z.string().describe('What you will do'),
      proof: z.string().describe('What evidence of completion looks like'),
      afterStepId: z.string().optional().describe('Insert after this step ID (appends to end if omitted)'),
    }),
  }
)

// --- Browser Automation Tools ---

// Helper: post browser command with run-ID tag + abort signal
// Run-ID lets browser-command/route.ts reject zombie commands from aborted runs
const _g = globalThis as unknown as { __charter_runId?: number; __charter_abort?: AbortController | null }
function _browserFetch(action: string, payload: Record<string, unknown>, signal?: AbortSignal) {
  const activeSignal = signal || _g.__charter_abort?.signal
  if (activeSignal?.aborted) return Promise.resolve({ error: 'Agent run was aborted' })
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  return fetch(`${baseUrl}/api/agent/browser-command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, _runId: _g.__charter_runId ?? 0, ...payload }),
    signal: activeSignal,
  }).then(r => r.json()).catch(err => {
    if (err?.name === 'AbortError') return { error: 'Agent run was aborted' }
    throw err
  })
}

export const browserNavigate = tool(
  async (input, config) => {
    const data = await _browserFetch('navigate', input, config?.signal)
    return JSON.stringify(data)
  },
  {
    name: 'browser_navigate',
    description: 'Open a URL in the user\'s browser. Use this to navigate to booking sites, visa application pages, etc. The user will see the page open in a new tab.',
    schema: z.object({
      url: z.string().describe('The URL to navigate to'),
      purpose: z.string().describe('Why we\'re opening this page (shown to user)'),
    }),
  }
)

export const browserScanPage = tool(
  async (input, config) => {
    const data = await _browserFetch('scan_page', input, config?.signal)
    // Log scan details for debugging
    if (data.result) {
      const r = data.result
      console.log(`[scan_page] ${r.fields?.length || 0} fields, ${r.buttons?.length || 0} buttons, method: ${r._scanMethod || 'dom'}`)
      if (r._log) console.log(`[scan_page] Log:\n${r._log.join('\n')}`)
    }
    return JSON.stringify(data)
  },
  {
    name: 'browser_scan_page',
    description: `Scan the current page to find ALL interactive elements. Returns comprehensive structured data with element indices for CDP-native interaction:
- fields: all input/select/textarea with labels, values, elementIndex, backendDOMNodeId, validation state. Use the "index" field as elementIndex when calling browser_fill_fields.
- buttons: all clickable actions with text and elementIndex. Use the "index" field as elementIndex when calling browser_click.
- links: navigation links (for multi-page forms)
- sections: headings and section labels (to understand page structure)
- errors: any error messages visible on page
- visibleText: first ~3000 chars of page text for context
Primary scanner: CDP (DOMSnapshot + Accessibility Tree + DOM) — works on ALL pages including gov sites, SPAs, shadow DOM, framesets.
Fallback: content script DOM scan if CDP unavailable.
IMPORTANT: Always use the element "index" from scan results as elementIndex in fill/click calls — this is far more reliable than CSS selectors.`,
    schema: z.object({
      tabId: z.number().optional().describe('Tab ID to scan (uses active tab if omitted)'),
    }),
  }
)

export const browserFillFields = tool(
  async (input, config) => {
    const data = await _browserFetch('fill_fields', input, config?.signal)
    return JSON.stringify(data)
  },
  {
    name: 'browser_fill_fields',
    description: 'Fill form fields on the current page. PREFERRED: use elementIndex from scan results for each field (CDP native fill, works on all sites including gov forms with iframes/shadow DOM). Falls back to CSS selector if elementIndex not provided. Each field gets a source citation explaining where the data came from.',
    schema: z.object({
      fields: z.array(z.object({
        elementIndex: z.number().optional().describe('Element index from scan results (PREFERRED — uses CDP native fill, works on all sites including gov forms)'),
        selector: z.string().optional().describe('CSS selector for the field (fallback if elementIndex not available)'),
        value: z.string().describe('Value to fill in'),
        label: z.string().describe('Human-readable field name'),
        source: z.string().describe('Where this data came from (e.g. "passport profile", "email from Oct 2025")'),
        confidence: z.enum(['high', 'medium', 'low']).describe('How confident we are in this value'),
      })).describe('Fields to fill, in order. Use elementIndex from scan results when available — it uses CDP native interaction which works on all sites.'),
      delayMs: z.number().optional().describe('Delay between fields in ms (default 100)'),
    }),
  }
)

export const browserClick = tool(
  async (input, config) => {
    const data = await _browserFetch('click', input, config?.signal)
    return JSON.stringify(data)
  },
  {
    name: 'browser_click',
    description: 'Click a button or link on the current page. Use for "Next", "Submit", "Continue" buttons. PREFERRED: use elementIndex from scan results (CDP native click, works on all sites). Fallbacks: text-based matching, then CSS selector.',
    schema: z.object({
      elementIndex: z.number().optional().describe('Element index from scan results (PREFERRED — uses CDP native click, works on all sites including gov forms)'),
      selector: z.string().optional().describe('CSS selector for the element to click (fallback)'),
      text: z.string().optional().describe('Button text to match (e.g. "Continue", "Next", "Submit"). Used when elementIndex and selector are unavailable.'),
      description: z.string().describe('What this click does'),
      waitForNavigation: z.boolean().optional().describe('Wait for page navigation after click'),
    }),
  }
)

export const browserReadPage = tool(
  async (input, config) => {
    const data = await _browserFetch('read_page', input, config?.signal)
    return JSON.stringify(data)
  },
  {
    name: 'browser_read_page',
    description: 'Read text content from the current page. Use to check confirmation pages or verify results.',
    schema: z.object({
      selector: z.string().optional().describe('CSS selector to read from (reads body if omitted)'),
      tabId: z.number().optional().describe('Tab ID to read from'),
    }),
  }
)

// --- CAPTCHA Solver ---

const anthropic = new Anthropic()

export const browserSolveCaptcha = tool(
  async (_input, config) => {
    // Step 1: Ask extension to capture the CAPTCHA image
    const captureData = await _browserFetch('capture_captcha', {}, config?.signal)
    const capture = captureData.result

    if (!capture) return JSON.stringify({ error: 'No response from browser extension' })

    // Get the image data — either from direct capture or from screenshot fallback
    let imageBase64: string | null = null
    let mediaType: 'image/png' | 'image/jpeg' = 'image/png'

    if (capture.base64) {
      // Direct CAPTCHA image capture
      imageBase64 = capture.base64.replace(/^data:image\/\w+;base64,/, '')
    } else if (capture.screenshot) {
      // Full page screenshot fallback
      imageBase64 = capture.screenshot.replace(/^data:image\/\w+;base64,/, '')
    } else if (capture.imgSrc) {
      // Try fetching the CAPTCHA image URL directly
      try {
        const imgRes = await fetch(capture.imgSrc)
        const imgBuf = await imgRes.arrayBuffer()
        imageBase64 = Buffer.from(imgBuf).toString('base64')
        const ct = imgRes.headers.get('content-type') || ''
        if (ct.includes('jpeg') || ct.includes('jpg')) mediaType = 'image/jpeg'
      } catch {
        return JSON.stringify({ error: 'Could not fetch CAPTCHA image', capture })
      }
    }

    if (!imageBase64) {
      return JSON.stringify({ error: 'No CAPTCHA image captured', capture })
    }

    // Step 2: Send to Claude vision to solve (Haiku = 10x faster for simple OCR)
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          {
            type: 'text',
            text: 'This is a CAPTCHA image from a website. Read the text/characters/numbers shown in the CAPTCHA and return ONLY the answer — nothing else. No explanation, no quotes, just the exact characters to type. If the image is a full page screenshot, find the CAPTCHA area first, then read it.',
          },
        ],
      }],
    })

    const answer = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    return JSON.stringify({
      status: 'solved',
      answer,
      inputSelector: capture.inputSelector || null,
    })
  },
  {
    name: 'browser_solve_captcha',
    description: 'Detect and solve a CAPTCHA on the current page. Screenshots the CAPTCHA image and uses AI vision to read the characters. Returns the solved text and the input field selector to fill it into. Use this whenever scan_page reports hasCaptcha: true.',
    schema: z.object({}),
  }
)

// --- Screenshot ---

export const browserScreenshot = tool(
  async (_input, config) => {
    const data = await _browserFetch('screenshot', {}, config?.signal)
    const result = data.result

    if (!result || result.error) {
      return JSON.stringify({ error: result?.error || 'Screenshot failed' })
    }

    // Send screenshot to Claude vision to describe what's on screen
    const imageBase64 = result.screenshot.replace(/^data:image\/\w+;base64,/, '')
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
          },
          {
            type: 'text',
            text: 'Describe what you see on this webpage screenshot. Focus on: form fields (dropdowns, inputs, checkboxes), buttons, error messages, confirmation messages, navigation elements. List every interactive element you can see with its approximate location and current state/value. Be precise and exhaustive.',
          },
        ],
      }],
    })

    const description = response.content[0].type === 'text' ? response.content[0].text : ''
    return JSON.stringify({ status: 'captured', description, hasScreenshot: true })
  },
  {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current browser page and analyze it with AI vision. Returns a detailed description of everything visible — form fields, buttons, dropdowns, errors, confirmations. Use this when scan_page returns 0 fields, or when you need to SEE what the page looks like to decide what to do next.',
    schema: z.object({}),
  }
)

// --- Execute JavaScript ---

export const browserExecuteJs = tool(
  async (input, config) => {
    const data = await _browserFetch('execute_js', { code: input.code }, config?.signal)
    return JSON.stringify(data.result || data)
  },
  {
    name: 'browser_execute_js',
    description: 'Execute JavaScript code directly on the current page. Use this as a FALLBACK when scan_page/fill_fields fail — you can interact with the DOM directly. Examples: set dropdown values, click hidden buttons, read form state, trigger events. The code runs in the page context and returns the result.',
    schema: z.object({
      code: z.string().describe('JavaScript code to execute on the page. Should return a value (use an IIFE if needed). Example: `document.querySelector("#mySelect").value = "USA"; "done"`'),
      description: z.string().describe('What this code does (shown to user)'),
    }),
  }
)

// --- Visa Portal Lookup Tool ---

export const lookupVisaPortal = tool(
  async (input) => {
    const portal = getVisaPortal(input.country)
    if (portal) {
      return JSON.stringify(portal)
    }
    // No exact match — return all available portals for the agent to pick from
    const available = VISA_PORTALS.map(p => `${p.country} (${p.iso3})`).join(', ')
    return JSON.stringify({ error: `No visa portal found for "${input.country}". Available: ${available}` })
  },
  {
    name: 'lookup_visa_portal',
    description: 'Look up the direct visa application URL for a country. Returns the confirmed form URL so you can navigate directly to it instead of searching. Always call this BEFORE using browser_navigate for visa applications.',
    schema: z.object({
      country: z.string().describe('Country name or ISO-3 code (e.g. "India", "IND", "Turkey", "TUR")'),
    }),
  }
)

// --- Globe Visualization Tool ---

const globeConnector = globeConnectors[0]

export const showOnGlobe = tool(
  async (input) => {
    const result = await globeConnector.execute(input as Record<string, unknown>)
    return JSON.stringify({ ...result as Record<string, unknown>, highlightCountries: input.highlightCountries || [] })
  },
  {
    name: 'show_on_globe',
    description: globeConnector.description,
    schema: z.object({
      arcs: z.array(z.object({
        from: z.object({
          lat: z.number().describe('Latitude of origin'),
          lng: z.number().describe('Longitude of origin'),
          label: z.string().optional().describe('Label for origin city'),
        }),
        to: z.object({
          lat: z.number().describe('Latitude of destination'),
          lng: z.number().describe('Longitude of destination'),
          label: z.string().optional().describe('Label for destination city'),
        }),
      })).optional().describe('Flight routes to display as curved arcs on the globe'),
      markers: z.array(z.object({
        lat: z.number().describe('Latitude'),
        lng: z.number().describe('Longitude'),
        label: z.string().describe('Location name'),
        type: z.enum(['origin', 'destination']).optional().describe('Marker type — origin (red) or destination (gold)'),
      })).optional().describe('Location markers to display on the globe'),
      clear: z.boolean().optional().describe('If true, clear existing arcs and markers before adding new ones'),
      highlightCountries: z.array(z.string()).optional().describe('Array of ISO-3166-1 alpha-3 country codes to highlight on the globe (e.g. ["JPN", "GBR", "USA"])'),
    }),
  }
)

// --- Export all tools ---

export const allTools = [
  searchWeb,
  getPageContents,
  getPassportProfile,
  updatePassportProfile,
  checkCalendar,
  createCalendarEvent,
  readEmails,
  readEmailBody,
  searchDriveFiles,
  scanPassportPhoto,
  proposeActions,
  planSteps,
  completeStep,
  addPlanStep,
  browserNavigate,
  browserScanPage,
  browserFillFields,
  browserClick,
  browserReadPage,
  browserSolveCaptcha,
  browserScreenshot,
  browserExecuteJs,
  showOnGlobe,
  lookupVisaPortal,
]

import { NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

type BrowserCommand = {
  id: string
  action: string
  timestamp: number
  [key: string]: unknown
}

const pendingCommands: BrowserCommand[] = []
const commandResults: Map<string, unknown> = new Map()

// Plan state — shared with chat route (works in dev, same process)
export interface PlanStepState {
  id: string
  title: string
  proof: string
  status: 'pending' | 'active' | 'done' | 'error'
  summary?: string
  screenshot?: string
}

let currentPlan: PlanStepState[] = []

export function setPlan(steps: PlanStepState[]) {
  currentPlan = steps
}

export function updatePlanStep(stepId: string, update: Partial<PlanStepState>) {
  currentPlan = currentPlan.map(s => s.id === stepId ? { ...s, ...update } : s)
}

export function addPlanStepState(step: PlanStepState, afterStepId?: string) {
  if (afterStepId) {
    const idx = currentPlan.findIndex(s => s.id === afterStepId)
    if (idx >= 0) {
      currentPlan = [...currentPlan.slice(0, idx + 1), step, ...currentPlan.slice(idx + 1)]
      return
    }
  }
  currentPlan = [...currentPlan, step]
}

export function clearPlan() {
  currentPlan = []
}

export function getPlan() {
  return currentPlan
}

let commandCounter = 0

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS })
}

// Agent POSTs commands, extension POSTs results back
export async function POST(req: Request) {
  const body = await req.json()

  // Result from extension
  if (body._isResult) {
    const { commandId, result } = body
    commandResults.set(commandId, result)
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
  }

  // New command from agent tool
  const id = `cmd_${++commandCounter}_${Date.now()}`
  const command: BrowserCommand = { id, timestamp: Date.now(), ...body }
  pendingCommands.push(command)

  // Wait for result (poll with timeout)
  // fill_fields can take a while (15ms per char × many fields), so use longer timeout for it
  // navigate can be slow (CEAC, government sites), fill_fields can take a while too
  const timeout = body.action === 'fill_fields' ? 120000 : body.action === 'navigate' ? 60000 : 30000
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (commandResults.has(id)) {
      const result = commandResults.get(id)
      commandResults.delete(id)
      return NextResponse.json({ commandId: id, result }, { headers: CORS_HEADERS })
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  return NextResponse.json(
    { commandId: id, result: { error: 'Timeout waiting for browser extension response' } },
    { headers: CORS_HEADERS }
  )
}

// Extension GETs pending commands
export async function GET() {
  const commands = pendingCommands.splice(0)
  return NextResponse.json({ commands, plan: currentPlan }, { headers: CORS_HEADERS })
}

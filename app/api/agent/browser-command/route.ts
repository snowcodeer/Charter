import { NextResponse } from 'next/server'
import { log } from '@/lib/logger'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

type BrowserCommand = {
  id: string
  action: string
  timestamp: number
  runId: number
  [key: string]: unknown
}

// Plan state — shared with chat route (works in dev, same process)
export interface PlanStepState {
  id: string
  title: string
  proof: string
  status: 'pending' | 'active' | 'done' | 'error'
  summary?: string
  screenshot?: string
}

interface StreamEvent {
  event: string
  data: unknown
  timestamp: number
}

// --- Per-device state ---

interface DeviceState {
  pendingCommands: BrowserCommand[]
  commandResults: Map<string, unknown>
  currentPlan: PlanStepState[]
  streamEvents: StreamEvent[]
  streamSeq: number
  lastAccess: number
}

const deviceStates = new Map<string, DeviceState>()

// commandCounter stays global — just an ID generator
let commandCounter = 0

// TTL: prune device state older than 2 hours
const DEVICE_TTL_MS = 2 * 60 * 60 * 1000

function pruneStaleDevices() {
  const now = Date.now()
  for (const [id, state] of deviceStates) {
    if (now - state.lastAccess > DEVICE_TTL_MS) {
      deviceStates.delete(id)
      log('browser-cmd', `Pruned stale device state`, { deviceId: id })
    }
  }
}

function getDeviceState(deviceId: string): DeviceState {
  let state = deviceStates.get(deviceId)
  if (!state) {
    state = {
      pendingCommands: [],
      commandResults: new Map(),
      currentPlan: [],
      streamEvents: [],
      streamSeq: 0,
      lastAccess: Date.now(),
    }
    deviceStates.set(deviceId, state)
    // Prune stale devices periodically (on new device creation)
    if (deviceStates.size % 5 === 0) pruneStaleDevices()
  }
  state.lastAccess = Date.now()
  return state
}

// Active run ID — commands from stale runs are rejected
const g = globalThis as unknown as { __charter_runIds?: Map<string, number> }
if (!g.__charter_runIds) g.__charter_runIds = new Map()
export function getActiveRunId(deviceId: string) { return g.__charter_runIds!.get(deviceId) ?? 0 }

// --- Exported functions (all take deviceId as first param) ---

export function setPlan(deviceId: string, steps: PlanStepState[]) {
  getDeviceState(deviceId).currentPlan = steps
}

export function updatePlanStep(deviceId: string, stepId: string, update: Partial<PlanStepState>) {
  const state = getDeviceState(deviceId)
  state.currentPlan = state.currentPlan.map(s => s.id === stepId ? { ...s, ...update } : s)
}

export function addPlanStepState(deviceId: string, step: PlanStepState, afterStepId?: string) {
  const state = getDeviceState(deviceId)
  if (afterStepId) {
    const idx = state.currentPlan.findIndex(s => s.id === afterStepId)
    if (idx >= 0) {
      state.currentPlan = [...state.currentPlan.slice(0, idx + 1), step, ...state.currentPlan.slice(idx + 1)]
      return
    }
  }
  state.currentPlan = [...state.currentPlan, step]
}

export function clearPlan(deviceId: string) {
  getDeviceState(deviceId).currentPlan = []
}

export function getPlan(deviceId: string) {
  return getDeviceState(deviceId).currentPlan
}

export function pushStreamEvent(deviceId: string, event: string, data: unknown) {
  const state = getDeviceState(deviceId)
  state.streamEvents.push({ event, data, timestamp: Date.now() })
  state.streamSeq++
  // Keep last 200 events max
  if (state.streamEvents.length > 200) state.streamEvents = state.streamEvents.slice(-100)
}

export function getStreamEvents(deviceId: string, since: number) {
  const state = getDeviceState(deviceId)
  return { events: state.streamEvents.slice(since), seq: state.streamSeq }
}

export function clearStreamEvents(deviceId: string) {
  const state = getDeviceState(deviceId)
  state.streamEvents = []
  state.streamSeq = 0
}

// Flush all pending commands — used when a new agent run starts to kill stale commands
export function flushPendingCommands(deviceId: string) {
  const state = getDeviceState(deviceId)
  const count = state.pendingCommands.length
  state.pendingCommands.length = 0
  state.commandResults.clear()
  if (count > 0) log('browser-cmd', `Flushed ${count} stale pending commands`, { deviceId })
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS })
}

// Agent POSTs commands, extension POSTs results back
export async function POST(req: Request) {
  const body = await req.json()
  const deviceId: string = body.deviceId || 'default'
  const state = getDeviceState(deviceId)

  // Result from extension
  if (body._isResult) {
    const { commandId, result } = body
    log('browser-cmd', `RESULT received`, { commandId, deviceId, hasError: !!(result as Record<string, unknown>)?.error })
    state.commandResults.set(commandId, result)
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
  }

  // Reject commands from stale/zombie agent runs
  const activeRun = getActiveRunId(deviceId)
  if (body._runId && body._runId !== activeRun) {
    log('browser-cmd', `REJECTED stale command`, { action: body.action, deviceId, staleRunId: body._runId, activeRunId: activeRun })
    return NextResponse.json(
      { commandId: 'rejected', result: { error: 'Stale agent run — command rejected', staleRunId: body._runId } },
      { headers: CORS_HEADERS }
    )
  }

  // New command from agent tool
  const id = `cmd_${++commandCounter}_${Date.now()}`
  const command: BrowserCommand = { id, timestamp: Date.now(), runId: activeRun, ...body }
  state.pendingCommands.push(command)
  log('browser-cmd', `QUEUED`, { id, action: body.action, deviceId, runId: activeRun, url: body.url, selector: body.selector, fields: body.fields?.length })

  // Wait for result (poll with timeout)
  const timeout = body.action === 'fill_fields' ? 120000 : body.action === 'navigate' ? 60000 : 30000
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (state.commandResults.has(id)) {
      const result = state.commandResults.get(id)
      state.commandResults.delete(id)
      return NextResponse.json({ commandId: id, result }, { headers: CORS_HEADERS })
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  return NextResponse.json(
    { commandId: id, result: { error: 'Timeout waiting for browser extension response' } },
    { headers: CORS_HEADERS }
  )
}

// Extension GETs pending commands + stream state
// Widget passes streamOnly=1 to avoid draining the command queue (only background.js executes commands)
export async function GET(req: Request) {
  const url = new URL(req.url)
  const since = parseInt(url.searchParams.get('streamSince') || '0', 10)
  const streamOnly = url.searchParams.get('streamOnly') === '1'
  const deviceId = url.searchParams.get('deviceId') || 'default'
  const state = getDeviceState(deviceId)
  // Only drain commands when background.js polls (not the widget, which would steal & discard them)
  const commands = streamOnly ? [] : state.pendingCommands.splice(0)
  const { events: streamEvts, seq: streamSeqVal } = getStreamEvents(deviceId, since)
  log('browser-cmd', 'POLL', {
    since,
    streamOnly,
    deviceId,
    commandCount: commands.length,
    streamEventCount: streamEvts.length,
    streamSeq: streamSeqVal,
  })
  return NextResponse.json({ commands, plan: state.currentPlan, streamEvents: streamEvts, streamSeq: streamSeqVal }, { headers: CORS_HEADERS })
}

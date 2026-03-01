export type ToolEventType = 'tool_call' | 'tool_start' | 'tool_result'

export interface FillField {
  elementIndex?: number
  selector?: string
  value: string
  label: string
  source: string
  confidence: 'high' | 'medium' | 'low'
}

export interface ActionHistoryItem {
  id: string
  ts: number
  type: ToolEventType
  name: string
  data: unknown
}

export interface ScanSummary {
  fields: number
  buttons: number
  links: number
  sections: number
  errors: number
  method: string
  log: string[]
}

export type LiveActivityState =
  | { type: 'tool'; name: string; status: 'active' | 'done' | 'error'; data?: unknown }
  | { type: 'fill'; fields: FillField[] }

import { allConnectors, getConnector } from './connectors'
import type Anthropic from '@anthropic-ai/sdk'

/**
 * Convert our connector registry into Claude tool definitions
 */
export function getClaudeTools(): Anthropic.Messages.Tool[] {
  return allConnectors.map((c) => ({
    name: c.name,
    description: c.description,
    input_schema: c.inputSchema as Anthropic.Messages.Tool['input_schema'],
  }))
}

/**
 * Execute a tool call by name using the connector registry
 */
export async function executeToolCall(name: string, input: Record<string, unknown>): Promise<unknown> {
  const connector = getConnector(name)
  if (!connector) {
    return { error: `Unknown tool: ${name}` }
  }
  try {
    return await connector.execute(input)
  } catch (err) {
    return { error: `Tool ${name} failed: ${err instanceof Error ? err.message : String(err)}` }
  }
}

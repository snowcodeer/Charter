import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const BOOT_ID = `${process.pid}-${Date.now()}`

// Ensure logs dir exists on first import
try { fs.mkdirSync(LOG_DIR, { recursive: true }) } catch {}

function getLogFile() {
  const date = new Date().toISOString().split('T')[0]
  return path.join(LOG_DIR, `agent-${date}.log`)
}

export function log(prefix: string, msg: string, data?: unknown) {
  const entry = {
    t: new Date().toISOString(),
    pid: process.pid,
    boot: BOOT_ID,
    p: prefix,
    m: msg,
    ...(data !== undefined ? { d: data } : {}),
  }
  const line = JSON.stringify(entry) + '\n'
  try {
    fs.appendFileSync(getLogFile(), line)
  } catch {}
  console.log(`[${prefix}] ${msg}`, data !== undefined ? JSON.stringify(data).slice(0, 200) : '')
}

export function logError(prefix: string, msg: string, err?: unknown) {
  const errStr = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack?.split('\n').slice(0, 3).join('\n') } : String(err)
  log(prefix, `ERROR: ${msg}`, errStr)
}

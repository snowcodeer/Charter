import { NextResponse } from 'next/server'
import { getDeviceId } from '@/lib/device'
import { execute } from '@/lib/db'

async function cleanup() {
  let deviceId: string
  try {
    deviceId = await getDeviceId()
  } catch {
    return NextResponse.json({ error: 'No device' }, { status: 400 })
  }

  await execute('DELETE FROM google_tokens WHERE device_id = ?', [deviceId])
  await execute('DELETE FROM profiles WHERE device_id = ?', [deviceId])

  return NextResponse.json({ ok: true })
}

export const POST = cleanup
export const DELETE = cleanup

import { NextResponse } from 'next/server'
import { getPassportProfile, updatePassportProfile } from '@/lib/connectors/passport'
import { getDeviceId } from '@/lib/device'

export async function GET() {
  const deviceId = await getDeviceId()
  const result = await getPassportProfile.execute({ deviceId })
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const deviceId = await getDeviceId()
  const body = await req.json()
  const result = await updatePassportProfile.execute({ ...body, deviceId })
  return NextResponse.json(result)
}

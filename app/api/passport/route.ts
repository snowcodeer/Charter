import { NextResponse } from 'next/server'
import { getPassportProfile, updatePassportProfile } from '@/lib/connectors/passport'

export async function GET() {
  const result = await getPassportProfile.execute({})
  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const body = await req.json()
  const result = await updatePassportProfile.execute(body)
  return NextResponse.json(result)
}

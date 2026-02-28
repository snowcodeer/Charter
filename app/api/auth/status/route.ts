import { NextResponse } from 'next/server'
import { getStoredTokens } from '@/lib/google-auth'

export async function GET() {
  const tokens = getStoredTokens()
  return NextResponse.json({
    google: {
      connected: !!tokens,
      email: tokens?.email || null,
    },
    exa: {
      connected: !!process.env.EXA_API_KEY,
    },
    anthropic: {
      connected: !!process.env.ANTHROPIC_API_KEY,
    },
    elevenlabs: {
      connected: !!process.env.ELEVENLABS_API_KEY,
    },
  })
}

import { NextResponse } from 'next/server'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS })
}

export async function POST() {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ELEVENLABS_API_KEY not configured' },
      { status: 500, headers: CORS_HEADERS }
    )
  }

  try {
    // Generate a single-use token for browser-side STT
    // The browser uses this to connect directly to ElevenLabs STT WebSocket
    const res = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/single-use-token',
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    )

    if (!res.ok) {
      // Fallback: just return the API key wrapped (for hackathon demo)
      // In production, you'd properly handle the token API
      return NextResponse.json(
        { apiKey },
        { headers: CORS_HEADERS }
      )
    }

    const data = await res.json()
    return NextResponse.json(
      { token: data.token },
      { headers: CORS_HEADERS }
    )
  } catch {
    // Fallback for hackathon: return API key directly
    return NextResponse.json(
      { apiKey },
      { headers: CORS_HEADERS }
    )
  }
}

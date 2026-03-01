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
    const res = await fetch(
      'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
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
      const errText = await res.text().catch(() => '')
      console.error(`[stt-token] Token API failed: ${res.status} ${errText}`)
      return NextResponse.json(
        { error: `Token API failed: ${res.status}` },
        { status: 500, headers: CORS_HEADERS }
      )
    }

    const data = await res.json()
    return NextResponse.json({ token: data.token }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('[stt-token] Error:', err)
    return NextResponse.json(
      { error: 'Failed to get STT token' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

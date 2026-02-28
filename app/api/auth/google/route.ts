import { NextResponse } from 'next/server'
import { getAuthUrl } from '@/lib/google-auth'

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local' },
      { status: 500 }
    )
  }
  const url = getAuthUrl()
  return NextResponse.redirect(url)
}

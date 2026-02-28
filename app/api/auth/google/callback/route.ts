import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { getOAuth2Client, saveTokens } from '@/lib/google-auth'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/?google=error', url.origin))
  }

  try {
    const client = getOAuth2Client()
    const { tokens } = await client.getToken(code)
    client.setCredentials(tokens)

    // Get user email
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const { data } = await oauth2.userinfo.get()

    saveTokens({
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      expiry_date: tokens.expiry_date!,
      email: data.email || undefined,
    })

    return NextResponse.redirect(new URL('/?google=connected', url.origin))
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(new URL('/?google=error', url.origin))
  }
}

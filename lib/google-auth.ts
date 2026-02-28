import { google } from 'googleapis'
import { getDb } from './db'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/drive.readonly',
]

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${getBaseUrl()}/api/auth/google/callback`
  )
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}

export function getAuthUrl() {
  const client = getOAuth2Client()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })
}

export function saveTokens(tokens: {
  access_token: string
  refresh_token: string
  expiry_date: number
  email?: string
}) {
  const db = getDb()
  db.prepare(`
    INSERT INTO google_tokens (id, access_token, refresh_token, expiry_date, email)
    VALUES ('default', ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expiry_date = excluded.expiry_date,
      email = excluded.email,
      updated_at = datetime('now')
  `).run(tokens.access_token, tokens.refresh_token, tokens.expiry_date, tokens.email || null)
}

export function getStoredTokens(): {
  access_token: string
  refresh_token: string
  expiry_date: number
  email: string | null
} | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM google_tokens WHERE id = ?').get('default') as Record<string, unknown> | undefined
  if (!row) return null
  return {
    access_token: row.access_token as string,
    refresh_token: row.refresh_token as string,
    expiry_date: row.expiry_date as number,
    email: row.email as string | null,
  }
}

export function deleteTokens() {
  const db = getDb()
  db.prepare('DELETE FROM google_tokens WHERE id = ?').run('default')
}

/**
 * Get an authenticated OAuth2 client with valid tokens.
 * Returns null if not connected.
 */
export async function getAuthenticatedClient() {
  const tokens = getStoredTokens()
  if (!tokens) return null

  const client = getOAuth2Client()
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  })

  // Auto-refresh if expired
  if (tokens.expiry_date < Date.now()) {
    try {
      const { credentials } = await client.refreshAccessToken()
      saveTokens({
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token || tokens.refresh_token,
        expiry_date: credentials.expiry_date!,
        email: tokens.email || undefined,
      })
      client.setCredentials(credentials)
    } catch {
      // Refresh failed — tokens are stale
      deleteTokens()
      return null
    }
  }

  return client
}

export function isGoogleConnected(): boolean {
  return getStoredTokens() !== null
}

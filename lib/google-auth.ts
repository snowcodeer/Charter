import { google } from 'googleapis'
import { queryOne, execute } from './db'

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

export async function saveTokens(deviceId: string, tokens: {
  access_token: string
  refresh_token: string
  expiry_date: number
  email?: string
}) {
  const existing = await queryOne('SELECT device_id FROM google_tokens WHERE device_id = ?', [deviceId])
  if (existing) {
    await execute(
      `UPDATE google_tokens SET access_token = ?, refresh_token = ?, expiry_date = ?, email = ?, updated_at = datetime('now') WHERE device_id = ?`,
      [tokens.access_token, tokens.refresh_token, tokens.expiry_date, tokens.email || null, deviceId]
    )
  } else {
    await execute(
      `INSERT INTO google_tokens (device_id, access_token, refresh_token, expiry_date, email) VALUES (?, ?, ?, ?, ?)`,
      [deviceId, tokens.access_token, tokens.refresh_token, tokens.expiry_date, tokens.email || null]
    )
  }
}

export async function getStoredTokens(deviceId: string): Promise<{
  access_token: string
  refresh_token: string
  expiry_date: number
  email: string | null
} | null> {
  const row = await queryOne('SELECT * FROM google_tokens WHERE device_id = ?', [deviceId])
  if (!row) return null
  return {
    access_token: row.access_token as string,
    refresh_token: row.refresh_token as string,
    expiry_date: row.expiry_date as number,
    email: row.email as string | null,
  }
}

export async function deleteTokens(deviceId: string) {
  await execute('DELETE FROM google_tokens WHERE device_id = ?', [deviceId])
}

/**
 * Get an authenticated OAuth2 client with valid tokens.
 * Returns null if not connected.
 */
export async function getAuthenticatedClient(deviceId: string) {
  const tokens = await getStoredTokens(deviceId)
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
      await saveTokens(deviceId, {
        access_token: credentials.access_token!,
        refresh_token: credentials.refresh_token || tokens.refresh_token,
        expiry_date: credentials.expiry_date!,
        email: tokens.email || undefined,
      })
      client.setCredentials(credentials)
    } catch {
      // Refresh failed — tokens are stale
      await deleteTokens(deviceId)
      return null
    }
  }

  return client
}

export async function isGoogleConnected(deviceId: string): Promise<boolean> {
  return (await getStoredTokens(deviceId)) !== null
}

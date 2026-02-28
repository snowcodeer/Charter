import { google } from 'googleapis'
import { Connector } from '../types'
import { getAuthenticatedClient } from '../google-auth'

export const readEmails: Connector = {
  name: 'read_emails',
  description: 'Search Gmail for travel-related emails — booking confirmations, flight itineraries, visa application receipts, hotel reservations.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Gmail search query (e.g. "flight confirmation" or "visa application receipt" or "booking from:airlines")' },
      maxResults: { type: 'number', description: 'Max emails to return (default 5)' },
    },
    required: ['query'],
  },
  execute: async (params) => {
    const { query, maxResults = 5 } = params as { query: string; maxResults?: number }

    const auth = await getAuthenticatedClient()
    if (!auth) {
      return { status: 'not_connected', message: 'Google not connected. Ask the user to click "Connect Google" first.' }
    }

    const gmail = google.gmail({ version: 'v1', auth })

    // Search for messages
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(maxResults, 10),
    })

    if (!listRes.data.messages || listRes.data.messages.length === 0) {
      return { status: 'empty', message: `No emails found for "${query}".`, emails: [] }
    }

    // Fetch each message's metadata
    const emails = await Promise.all(
      listRes.data.messages.map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        })

        const headers = detail.data.payload?.headers || []
        const getHeader = (name: string) => headers.find((h) => h.name === name)?.value || ''

        return {
          id: msg.id,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          date: getHeader('Date'),
          snippet: detail.data.snippet,
        }
      })
    )

    return {
      status: 'found',
      message: `Found ${emails.length} email(s) matching "${query}".`,
      emails,
    }
  },
}

export const gmailConnectors: Connector[] = [readEmails]

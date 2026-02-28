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

export const readEmailBody: Connector = {
  name: 'read_email_body',
  description: 'Read the full body/content of a specific email by its ID. Use after read_emails to get full details from a promising email.',
  inputSchema: {
    type: 'object',
    properties: {
      messageId: { type: 'string', description: 'The email message ID (from read_emails results)' },
    },
    required: ['messageId'],
  },
  execute: async (params) => {
    const { messageId } = params as { messageId: string }

    const auth = await getAuthenticatedClient()
    if (!auth) {
      return { status: 'not_connected', message: 'Google not connected.' }
    }

    const gmail = google.gmail({ version: 'v1', auth })

    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    })

    const headers = detail.data.payload?.headers || []
    const getHeader = (name: string) => headers.find((h) => h.name === name)?.value || ''

    // Extract body text from parts
    function extractText(payload: any): string {
      if (!payload) return ''
      if (payload.mimeType === 'text/plain' && payload.body?.data) {
        return Buffer.from(payload.body.data, 'base64url').toString('utf-8')
      }
      if (payload.parts) {
        for (const part of payload.parts) {
          const text = extractText(part)
          if (text) return text
        }
      }
      // Fallback to HTML if no plain text
      if (payload.mimeType === 'text/html' && payload.body?.data) {
        const html = Buffer.from(payload.body.data, 'base64url').toString('utf-8')
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      }
      return ''
    }

    const body = extractText(detail.data.payload)

    return {
      status: 'found',
      subject: getHeader('Subject'),
      from: getHeader('From'),
      date: getHeader('Date'),
      to: getHeader('To'),
      body: body.slice(0, 10000), // Cap at 10k chars
    }
  },
}

export const gmailConnectors: Connector[] = [readEmails, readEmailBody]

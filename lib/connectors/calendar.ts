import { google } from 'googleapis'
import { Connector } from '../types'
import { getAuthenticatedClient } from '../google-auth'

export const checkCalendar: Connector = {
  name: 'check_calendar',
  description: 'Check Google Calendar availability for a date range. Returns existing events that may conflict with travel plans.',
  inputSchema: {
    type: 'object',
    properties: {
      startDate: { type: 'string', description: 'Start date ISO string (e.g. "2026-03-15")' },
      endDate: { type: 'string', description: 'End date ISO string (e.g. "2026-03-22")' },
    },
    required: ['startDate', 'endDate'],
  },
  execute: async (params) => {
    const { startDate, endDate, deviceId } = params as { startDate: string; endDate: string; deviceId?: string }

    const auth = await getAuthenticatedClient(deviceId || '')
    if (!auth) {
      return { status: 'not_connected', message: 'Google not connected. Ask the user to click "Connect Google" first.' }
    }

    const calendar = google.calendar({ version: 'v3', auth })
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date(startDate).toISOString(),
      timeMax: new Date(endDate).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 20,
    })

    const events = (res.data.items || []).map((e) => ({
      summary: e.summary,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location,
    }))

    if (events.length === 0) {
      return { status: 'free', message: `No events found from ${startDate} to ${endDate}. You're free!`, events: [] }
    }

    return {
      status: 'busy',
      message: `Found ${events.length} event(s) from ${startDate} to ${endDate}.`,
      events,
    }
  },
}

export const createCalendarEvent: Connector = {
  name: 'create_calendar_event',
  description: 'Create a Google Calendar event for a trip, flight, or visa appointment.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Event title (e.g. "Flight to Tokyo" or "Visa appointment")' },
      startDate: { type: 'string', description: 'Start date/time ISO string' },
      endDate: { type: 'string', description: 'End date/time ISO string' },
      description: { type: 'string', description: 'Event description/notes' },
      location: { type: 'string', description: 'Location (e.g. "Heathrow Airport")' },
    },
    required: ['title', 'startDate', 'endDate'],
  },
  execute: async (params) => {
    const { title, startDate, endDate, description, location, deviceId } = params as {
      title: string; startDate: string; endDate: string; description?: string; location?: string; deviceId?: string
    }

    const auth = await getAuthenticatedClient(deviceId || '')
    if (!auth) {
      return { status: 'not_connected', message: 'Google not connected. Ask the user to click "Connect Google" first.' }
    }

    const calendar = google.calendar({ version: 'v3', auth })
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: title,
        description: description || undefined,
        location: location || undefined,
        start: { dateTime: new Date(startDate).toISOString() },
        end: { dateTime: new Date(endDate).toISOString() },
      },
    })

    return {
      status: 'created',
      message: `Created event "${title}" on your calendar.`,
      eventId: res.data.id,
      htmlLink: res.data.htmlLink,
    }
  },
}

export const calendarConnectors: Connector[] = [checkCalendar, createCalendarEvent]

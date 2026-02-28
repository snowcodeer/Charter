import { Connector } from '../types'

export const startFormFill: Connector = {
  name: 'start_form_fill',
  description: 'Launch an AI-controlled browser to fill out a form automatically. Use this for visa applications, booking forms, or any web form that needs to be filled with the user\'s data. The browser will be shown to the user in real-time.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL of the form to fill' },
      instructions: { type: 'string', description: 'Instructions for the AI browser agent about what to fill and how' },
      userData: {
        type: 'object',
        description: 'User data to fill into the form (name, passport number, dates, etc.)',
      },
    },
    required: ['url', 'instructions'],
  },
  execute: async (params) => {
    const { url, instructions, userData } = params as {
      url: string; instructions: string; userData?: Record<string, unknown>
    }

    const formFillerUrl = process.env.FORM_FILLER_URL || 'ws://localhost:8000/ws'

    // TODO: establish WebSocket connection to Python form-filler service
    // For now, return the intent so the frontend can launch the form-fill viewer
    return {
      status: 'ready',
      formFillUrl: `/form-fill?url=${encodeURIComponent(url)}`,
      message: `Ready to fill form at ${url}. Redirecting to form-fill viewer.`,
      details: { url, instructions, userData, serviceUrl: formFillerUrl },
    }
  },
}

export const formFillerConnectors: Connector[] = [startFormFill]

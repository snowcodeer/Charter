import Exa from 'exa-js'
import { Connector } from '../types'

const exa = new Exa(process.env.EXA_API_KEY)

export const searchWeb: Connector = {
  name: 'search_web',
  description:
    'Search the web for real-time information. Use this to find visa requirements, flight prices, travel advisories, application forms, embassy info, or anything else. Returns titles, URLs, and text content from top results.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query. Be specific — include country names, dates, passport nationality, etc.',
      },
      numResults: {
        type: 'number',
        description: 'Number of results to return (default 5, max 10)',
      },
      type: {
        type: 'string',
        enum: ['auto', 'fast', 'deep'],
        description: 'Search depth: "fast" for quick lookups, "deep" for thorough research, "auto" to let Exa decide (default)',
      },
    },
    required: ['query'],
  },
  execute: async (params) => {
    const { query, numResults = 5, type = 'auto' } = params as {
      query: string
      numResults?: number
      type?: 'auto' | 'fast' | 'deep'
    }

    const result = await exa.search(query, {
      numResults: Math.min(numResults, 10),
      type,
      contents: {
        text: { maxCharacters: 2000 },
      },
    })

    return result.results.map((r) => ({
      title: r.title,
      url: r.url,
      text: r.text,
      publishedDate: r.publishedDate,
    }))
  },
}

export const getPageContents: Connector = {
  name: 'get_page_contents',
  description:
    'Extract clean text content from specific URLs. Use this when you have a URL and need to read its contents — e.g., reading a visa application page, airline booking page, or embassy website.',
  inputSchema: {
    type: 'object',
    properties: {
      urls: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of URLs to extract content from (max 5)',
      },
    },
    required: ['urls'],
  },
  execute: async (params) => {
    const { urls } = params as { urls: string[] }

    const result = await exa.getContents(urls.slice(0, 5), {
      text: { maxCharacters: 3000 },
    })

    return result.results.map((r) => ({
      title: r.title,
      url: r.url,
      text: r.text,
    }))
  },
}

export const exaConnectors: Connector[] = [searchWeb, getPageContents]

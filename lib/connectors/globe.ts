import { Connector } from '../types'

export const globeConnectors: Connector[] = [
  {
    name: 'show_on_globe',
    description:
      'Display flight routes (arcs) and destination markers on the 3D globe visualization. Use this when discussing travel destinations, flight routes, or geographic locations to give the user a visual reference.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        arcs: {
          type: 'array',
          description: 'Flight routes to display as curved arcs on the globe',
          items: {
            type: 'object',
            properties: {
              from: {
                type: 'object',
                properties: {
                  lat: { type: 'number', description: 'Latitude of origin' },
                  lng: { type: 'number', description: 'Longitude of origin' },
                  label: { type: 'string', description: 'Label for origin city' },
                },
                required: ['lat', 'lng'],
              },
              to: {
                type: 'object',
                properties: {
                  lat: { type: 'number', description: 'Latitude of destination' },
                  lng: { type: 'number', description: 'Longitude of destination' },
                  label: { type: 'string', description: 'Label for destination city' },
                },
                required: ['lat', 'lng'],
              },
            },
            required: ['from', 'to'],
          },
        },
        markers: {
          type: 'array',
          description: 'Location markers to display on the globe',
          items: {
            type: 'object',
            properties: {
              lat: { type: 'number', description: 'Latitude' },
              lng: { type: 'number', description: 'Longitude' },
              label: { type: 'string', description: 'Location name' },
              type: {
                type: 'string',
                enum: ['origin', 'destination'],
                description: 'Marker type — origin (red) or destination (gold)',
              },
            },
            required: ['lat', 'lng', 'label'],
          },
        },
        clear: {
          type: 'boolean',
          description: 'If true, clear existing arcs and markers before adding new ones',
        },
        highlightCountries: {
          type: 'array',
          description: 'Array of ISO-3166-1 alpha-3 country codes to highlight on the globe (e.g. ["JPN", "GBR"])',
          items: { type: 'string' },
        },
      },
    },
    execute: async (params: Record<string, unknown>) => {
      // This connector returns the data to the client-side for rendering.
      // The actual globe update happens in page.tsx when it receives the tool result.
      return {
        action: 'show_on_globe',
        arcs: params.arcs || [],
        markers: params.markers || [],
        clear: params.clear ?? true,
        highlightCountries: params.highlightCountries || [],
      }
    },
  },
]

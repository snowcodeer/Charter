import { google } from 'googleapis'
import { Connector } from '../types'
import { getAuthenticatedClient } from '../google-auth'

export const searchDriveFiles: Connector = {
  name: 'search_drive_files',
  description: 'Search Google Drive for files — documents, photos, PDFs. Use to find passport scans, visa copies, travel documents, ID photos, employment letters, bank statements, etc.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (e.g. "passport", "visa", "ID photo"). Supports Drive search operators.' },
      mimeType: { type: 'string', description: 'Filter by MIME type (e.g. "image/jpeg", "application/pdf"). Omit for all types.' },
      maxResults: { type: 'number', description: 'Max files to return (default 10)' },
    },
    required: ['query'],
  },
  execute: async (params) => {
    const { query, mimeType, maxResults = 10, deviceId } = params as { query: string; mimeType?: string; maxResults?: number; deviceId?: string }

    const auth = await getAuthenticatedClient(deviceId || '')
    if (!auth) {
      return { status: 'not_connected', message: 'Google not connected. Ask the user to click "Connect Google" first.' }
    }

    const drive = google.drive({ version: 'v3', auth })

    // Build query — search in name and fullText
    let q = `fullText contains '${query.replace(/'/g, "\\'")}'`
    if (mimeType) {
      q += ` and mimeType = '${mimeType}'`
    }
    q += ' and trashed = false'

    const res = await drive.files.list({
      q,
      pageSize: Math.min(maxResults, 25),
      fields: 'files(id, name, mimeType, size, modifiedTime, thumbnailLink, webViewLink)',
      orderBy: 'modifiedTime desc',
    })

    const files = res.data.files || []
    if (files.length === 0) {
      return { status: 'empty', message: `No files found for "${query}".`, files: [] }
    }

    return {
      status: 'found',
      message: `Found ${files.length} file(s) matching "${query}".`,
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        modifiedTime: f.modifiedTime,
        webViewLink: f.webViewLink,
      })),
    }
  },
}

export const downloadDriveFile: Connector = {
  name: 'download_drive_file',
  description: 'Download a file from Google Drive by its ID. Returns base64 content for images/PDFs. Use after search_drive_files to get actual file content.',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: { type: 'string', description: 'The Google Drive file ID (from search_drive_files results)' },
    },
    required: ['fileId'],
  },
  execute: async (params) => {
    const { fileId, deviceId } = params as { fileId: string; deviceId?: string }

    const auth = await getAuthenticatedClient(deviceId || '')
    if (!auth) {
      return { status: 'not_connected', message: 'Google not connected.' }
    }

    const drive = google.drive({ version: 'v3', auth })

    // Get file metadata first
    const meta = await drive.files.get({ fileId, fields: 'id, name, mimeType, size' })
    const mimeType = meta.data.mimeType || 'application/octet-stream'
    const fileName = meta.data.name || 'unknown'
    const fileSize = parseInt(meta.data.size || '0', 10)

    // Cap at 20MB
    if (fileSize > 20 * 1024 * 1024) {
      return { status: 'too_large', message: `File "${fileName}" is too large (${(fileSize / 1024 / 1024).toFixed(1)}MB). Max 20MB.` }
    }

    // Download
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' })
    const buffer = Buffer.from(res.data as ArrayBuffer)
    const base64 = buffer.toString('base64')

    return {
      status: 'downloaded',
      fileName,
      mimeType,
      size: fileSize,
      base64,
    }
  },
}

export const driveConnectors: Connector[] = [searchDriveFiles, downloadDriveFile]

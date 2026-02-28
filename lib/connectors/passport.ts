import { v4 as uuid } from 'uuid'
import { getDb } from '../db'
import { Connector, PassportProfile, Passport } from '../types'

function rowsToProfile(profileRow: Record<string, unknown>, passportRows: Record<string, unknown>[]): PassportProfile {
  return {
    id: profileRow.id as string,
    name: profileRow.name as string,
    email: profileRow.email as string,
    createdAt: profileRow.created_at as string,
    passports: passportRows.map((p) => ({
      id: p.id as string,
      profileId: p.profile_id as string,
      nationality: p.nationality as string,
      passportNumber: p.passport_number as string | undefined,
      expiryDate: p.expiry_date as string | undefined,
      issuingCountry: p.issuing_country as string,
    })),
  }
}

export const getPassportProfile: Connector = {
  name: 'get_passport_profile',
  description: 'Get the user\'s passport profile including all their passport nationalities. Use this to know what passports the user holds before checking visa requirements.',
  inputSchema: {
    type: 'object',
    properties: {
      profileId: {
        type: 'string',
        description: 'Profile ID. If omitted, returns the first (default) profile.',
      },
    },
    required: [],
  },
  execute: async (params) => {
    const db = getDb()
    const { profileId } = params as { profileId?: string }

    let profile: Record<string, unknown> | undefined
    if (profileId) {
      profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as Record<string, unknown> | undefined
    } else {
      profile = db.prepare('SELECT * FROM profiles ORDER BY created_at ASC LIMIT 1').get() as Record<string, unknown> | undefined
    }

    if (!profile) return { error: 'No profile found. Ask the user to set up their passport first.' }

    const passports = db.prepare('SELECT * FROM passports WHERE profile_id = ?').all(profile.id as string) as Record<string, unknown>[]
    return rowsToProfile(profile, passports)
  },
}

export const updatePassportProfile: Connector = {
  name: 'update_passport_profile',
  description: 'Create or update the user\'s passport profile. Use this when the user provides their passport nationality, name, email, or passport details.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'User\'s full name' },
      email: { type: 'string', description: 'User\'s email' },
      passports: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            nationality: { type: 'string', description: 'Country name or ISO-2 code' },
            passportNumber: { type: 'string', description: 'Passport number (optional)' },
            expiryDate: { type: 'string', description: 'Expiry date ISO string (optional)' },
            issuingCountry: { type: 'string', description: 'Issuing country' },
          },
          required: ['nationality', 'issuingCountry'],
        },
        description: 'Array of passports the user holds',
      },
    },
    required: ['name', 'passports'],
  },
  execute: async (params) => {
    const db = getDb()
    const { name, email = '', passports } = params as {
      name: string
      email?: string
      passports: Array<{ nationality: string; passportNumber?: string; expiryDate?: string; issuingCountry: string }>
    }

    // Upsert: get existing profile or create new
    let profile = db.prepare('SELECT * FROM profiles ORDER BY created_at ASC LIMIT 1').get() as Record<string, unknown> | undefined

    const profileId = profile ? (profile.id as string) : uuid()

    if (profile) {
      db.prepare('UPDATE profiles SET name = ?, email = ? WHERE id = ?').run(name, email, profileId)
    } else {
      db.prepare('INSERT INTO profiles (id, name, email) VALUES (?, ?, ?)').run(profileId, name, email)
    }

    // Replace all passports
    db.prepare('DELETE FROM passports WHERE profile_id = ?').run(profileId)
    const insert = db.prepare('INSERT INTO passports (id, profile_id, nationality, passport_number, expiry_date, issuing_country) VALUES (?, ?, ?, ?, ?, ?)')
    for (const p of passports) {
      insert.run(uuid(), profileId, p.nationality, p.passportNumber || null, p.expiryDate || null, p.issuingCountry)
    }

    // Return updated profile
    const updated = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) as Record<string, unknown>
    const updatedPassports = db.prepare('SELECT * FROM passports WHERE profile_id = ?').all(profileId) as Record<string, unknown>[]
    return rowsToProfile(updated, updatedPassports)
  },
}

export const passportConnectors: Connector[] = [getPassportProfile, updatePassportProfile]

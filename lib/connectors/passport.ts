import { v4 as uuid } from 'uuid'
import { queryOne, queryAll, execute } from '../db'
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
        description: 'Profile ID. If omitted, returns the profile for the current device.',
      },
      deviceId: {
        type: 'string',
        description: 'Device ID (set automatically).',
      },
    },
    required: [],
  },
  execute: async (params) => {
    const { profileId, deviceId } = params as { profileId?: string; deviceId?: string }

    let profile: Record<string, unknown> | null
    if (profileId) {
      profile = await queryOne('SELECT * FROM profiles WHERE id = ?', [profileId])
    } else if (deviceId) {
      profile = await queryOne('SELECT * FROM profiles WHERE device_id = ?', [deviceId])
    } else {
      profile = await queryOne('SELECT * FROM profiles ORDER BY created_at ASC LIMIT 1')
    }

    if (!profile) return { error: 'No profile found. Ask the user to set up their passport first.' }

    const passports = await queryAll('SELECT * FROM passports WHERE profile_id = ?', [profile.id as string])
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
      deviceId: { type: 'string', description: 'Device ID (set automatically).' },
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
    const { name, email = '', deviceId, passports } = params as {
      name: string
      email?: string
      deviceId?: string
      passports: Array<{ nationality: string; passportNumber?: string; expiryDate?: string; issuingCountry: string }>
    }

    // Upsert: get existing profile by deviceId or create new
    let profile: Record<string, unknown> | null = null
    if (deviceId) {
      profile = await queryOne('SELECT * FROM profiles WHERE device_id = ?', [deviceId])
    } else {
      profile = await queryOne('SELECT * FROM profiles ORDER BY created_at ASC LIMIT 1')
    }

    const profileId = profile ? (profile.id as string) : uuid()

    if (profile) {
      await execute('UPDATE profiles SET name = ?, email = ? WHERE id = ?', [name, email, profileId])
    } else {
      await execute('INSERT INTO profiles (id, device_id, name, email) VALUES (?, ?, ?, ?)', [profileId, deviceId || '', name, email])
    }

    // Replace all passports
    await execute('DELETE FROM passports WHERE profile_id = ?', [profileId])
    for (const p of passports) {
      await execute(
        'INSERT INTO passports (id, profile_id, nationality, passport_number, expiry_date, issuing_country) VALUES (?, ?, ?, ?, ?, ?)',
        [uuid(), profileId, p.nationality, p.passportNumber || null, p.expiryDate || null, p.issuingCountry]
      )
    }

    // Return updated profile
    const updated = await queryOne('SELECT * FROM profiles WHERE id = ?', [profileId])
    const updatedPassports = await queryAll('SELECT * FROM passports WHERE profile_id = ?', [profileId])
    return rowsToProfile(updated!, updatedPassports)
  },
}

export const passportConnectors: Connector[] = [getPassportProfile, updatePassportProfile]

export interface Connector {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (params: Record<string, unknown>) => Promise<unknown>
}

export interface PassportProfile {
  id: string
  name: string
  email: string
  passports: Passport[]
  createdAt: string
}

export interface Passport {
  id: string
  profileId: string
  nationality: string
  passportNumber?: string
  expiryDate?: string
  issuingCountry: string
}

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!
const D1_TOKEN = process.env.CLOUDFLARE_D1_TOKEN!
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID!

const D1_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`

interface D1Result {
  results: Record<string, unknown>[]
  success: boolean
  meta: { changes: number; duration: number }
}

interface D1Response {
  result: D1Result[]
  success: boolean
  errors: { message: string }[]
}

async function d1Fetch(sql: string, params: unknown[] = []): Promise<D1Result> {
  const res = await fetch(D1_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${D1_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`D1 API error (${res.status}): ${text}`)
  }

  const data: D1Response = await res.json()
  if (!data.success) {
    throw new Error(`D1 query error: ${data.errors?.map(e => e.message).join(', ')}`)
  }

  return data.result[0]
}

/** Execute a query that returns rows (SELECT) */
export async function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await d1Fetch(sql, params)
  return result.results as T[]
}

/** Execute a query that returns a single row */
export async function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await queryAll<T>(sql, params)
  return rows[0] ?? null
}

/** Execute a mutation (INSERT, UPDATE, DELETE) */
export async function execute(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
  const result = await d1Fetch(sql, params)
  return { changes: result.meta.changes }
}

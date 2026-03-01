import { cookies } from 'next/headers'

export async function getDeviceId(): Promise<string> {
  const store = await cookies()
  const id = store.get('device_id')?.value
  // On the very first request the middleware sets the cookie on the response,
  // but it isn't available in the incoming request yet. Fall back to 'default'
  // so routes don't crash — the next request will have the real cookie.
  return id || 'default'
}

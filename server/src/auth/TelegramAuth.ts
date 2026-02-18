import crypto from 'crypto'

export function validateTelegramInitData(initData: string, botToken: string): number | null {
  if (!initData || !botToken) return null

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null

  params.delete('hash')

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')

  if (computed !== hash) return null

  // Verify auth_date is not too old (1 hour)
  const authDate = parseInt(params.get('auth_date') ?? '0', 10)
  if (Date.now() / 1000 - authDate > 3600) return null

  try {
    const user = JSON.parse(params.get('user') ?? '{}')
    return typeof user.id === 'number' ? user.id : null
  } catch {
    return null
  }
}

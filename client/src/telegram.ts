export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    start_param?: string
  }
  version: string
  platform: string
  viewportStableHeight: number
  themeParams: Record<string, string>
  expand(): void
  ready(): void
  close(): void
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
  }
  BackButton: {
    show(): void
    hide(): void
    onClick(cb: () => void): void
  }
}

function getWebApp(): TelegramWebApp | null {
  return (window as Record<string, unknown>).Telegram
    ? ((window as Record<string, unknown>).Telegram as Record<string, unknown>).WebApp as TelegramWebApp | undefined ?? null
    : null
}

export function isTelegramApp(): boolean {
  const app = getWebApp()
  return !!(app?.initData)
}

export function getTelegramUser(): TelegramUser | null {
  const app = getWebApp()
  if (!app?.initData) return null
  return app.initDataUnsafe?.user ?? null
}

export function getTelegramInitData(): string | null {
  const app = getWebApp()
  return app?.initData || null
}

export function initTelegramApp(): void {
  const app = getWebApp()
  if (!app?.initData) return
  app.expand()
  app.ready()
}

export function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'medium'): void {
  const app = getWebApp()
  if (!app?.initData) return
  try {
    app.HapticFeedback.impactOccurred(style)
  } catch {
    // Haptics not supported
  }
}

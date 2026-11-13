import { lang } from './i18n'
import { read, readGoals, write } from './store'

export type Rem = { on: boolean; time: string; endpoint?: string; tz?: string }

export const pushApi = (p: string, body: unknown) =>
  fetch('/api' + p, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  } catch {
    return ''
  }
}

let tzSynced = false

/**
 * Автообновляет часовой пояс подписки на сервере, только если напоминание уже включено локально
 * и текущий часовой пояс отличается от сохранённого.
 */
export async function syncReminderTimezone() {
  if (tzSynced) return
  tzSynced = true
  if (!('serviceWorker' in navigator && 'PushManager' in window)) return
  const rem = read<Rem>('reminder', { on: false, time: '19:00' })
  const tz = localTimeZone()
  if (!rem.on || !rem.endpoint || !tz || rem.tz === tz) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub || sub.endpoint !== rem.endpoint) return
    const [h, m] = rem.time.split(':').map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return
    const r = await pushApi('/push/subscribe', {
      subscription: sub.toJSON(),
      hour: h,
      minute: m,
      tz,
      lang,
      goal: readGoals()[0],
    })
    if (r.ok) write('reminder', { ...rem, tz }, true)
  } catch {
    /* офлайн или сервер недоступен — попробуем при следующем запуске */
  }
}

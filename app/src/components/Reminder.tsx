import { useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { useStored } from '../lib/store'

/**
 * Ежедневное напоминание. Работает через пуш-уведомления: приходит, даже когда приложение закрыто.
 * На iPhone — только если fasol.app установлен на экран «Домой».
 */
type Rem = { on: boolean; time: string; endpoint?: string }
const api = (p: string, body: unknown) => fetch('/api' + p, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function keyBytes(b64: string) {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, c => c.charCodeAt(0))
}

export function ReminderCard({ compact }: { compact?: boolean }) {
  const [rem, setRem] = useStored<Rem>('reminder', { on: false, time: '19:00' })
  const [time, setTime] = useState(rem.time)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [later, setLater] = useStored('reminder.later', false)

  const enable = async () => {
    setBusy(true); setErr(null)
    try {
      if ((await Notification.requestPermission()) !== 'granted') throw new Error('Разреши уведомления в настройках браузера, иначе напоминание не придёт.')
      const reg = await navigator.serviceWorker.ready
      const { key } = await (await fetch('/api/push/key')).json() as { key: string }
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) })
      const [h, m] = time.split(':').map(Number)
      const r = await api('/push/subscribe', { subscription: sub.toJSON(), hour: h, minute: m, tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
      if (!r.ok) throw new Error('Сервер не принял подписку. Попробуй позже.')
      setRem({ on: true, time, endpoint: sub.endpoint })
    } catch (e) { setErr(e instanceof Error ? e.message : 'Не получилось включить напоминание.') }
    setBusy(false)
  }
  const disable = async () => {
    setBusy(true)
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
      if (sub) { await api('/push/unsubscribe', { endpoint: sub.endpoint, auth: sub.toJSON().keys?.auth }); await sub.unsubscribe() }
    } catch { /* уже отписаны */ }
    setRem({ ...rem, on: false }); setBusy(false)
  }

  if (!supported || (ios && !standalone)) return compact ? null : (
    <div className="card reminder">
      <h2>Напоминание</h2>
      <p className="muted">{ios ? 'На iPhone напоминания приходят только из установленного приложения: в Safari нажми «Поделиться» → «На экран „Домой“», открой fasol.app оттуда и включи напоминание здесь.' : 'Этот браузер не умеет присылать уведомления. Попробуй Chrome, Edge или Firefox.'}</p>
    </div>
  )
  if (compact && (rem.on || later)) return null
  return (
    <div className="card reminder">
      <h2>{rem.on ? <><Bell size={18} /> Напоминание включено</> : 'Напоминать каждый день?'}</h2>
      <p className="muted small">{rem.on ? `Пришлём уведомление в ${rem.time}, если ты ещё не занимался сегодня.` : 'Короткое уведомление в удобное время. Если уже позанимался — не побеспокоим.'}</p>
      <div className="reminder-row">
        <label>Время<input type="time" value={time} onChange={e => setTime(e.target.value)} disabled={busy} /></label>
        {rem.on
          ? <>{time !== rem.time && <button className="btn" disabled={busy} onClick={enable}>Сохранить</button>}<button className="btn ghost" disabled={busy} onClick={disable}><BellOff size={16} /> Выключить</button></>
          : <button className="btn" disabled={busy} onClick={enable}><Bell size={16} /> Включить</button>}
        {compact && !rem.on && <button className="textbtn" onClick={() => setLater(true)}>Не сейчас</button>}
      </div>
      {err && <p className="form-err" role="alert">{err}</p>}
    </div>
  )
}

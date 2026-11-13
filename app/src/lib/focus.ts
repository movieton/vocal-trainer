import { engine } from './audio'

/** Режим фокуса: во время упражнения прячем лишнее и не даём экрану погаснуть */
type Lock = { release(): Promise<void> }
let lock: Lock | null = null
let pending = false
/** Сколько экранов сейчас просят не гасить экран */
let holders = 0

async function grab() {
  const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<Lock> } }).wakeLock
  if (!holders || !wl || lock || pending || document.visibilityState !== 'visible') return
  pending = true
  try {
    const l = await wl.request('screen')
    // пока ждали, экран уже отпустили или блокировка появилась — эту сразу снимаем
    if (!holders || lock) void l.release().catch(() => {}); else lock = l
  } catch { /* батарея на исходе или браузер не умеет */ } finally { pending = false }
}
function drop() { void lock?.release().catch(() => {}); lock = null }

/** Не давать экрану погаснуть (дыхание, таймеры); вызывать парами true/false */
export function keepAwake(v: boolean) {
  holders = Math.max(0, holders + (v ? 1 : -1))
  if (holders) void grab(); else drop()
}

let focused = false
export function setFocus(v: boolean) {
  if (v === focused) return
  focused = v
  if (v) document.documentElement.dataset.focus = '1'
  else {
    delete document.documentElement.dataset.focus
    // ушли с упражнения на паузе — включаем звук обратно для остального приложения
    if (engine.interrupted) void engine.resume()
  }
  keepAwake(v)
}

// браузер сам снимает блокировку при сворачивании — возвращаем при возврате
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { lock = null; void grab() }
})

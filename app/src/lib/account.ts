import { lang, tr } from './i18n'
import { useSyncExternalStore } from 'react'
import { DEVICE_KEYS, clearSynced, ensureGoalProfile, normalizeGoals, normalizeSkillProfile, onWrite, read, snapshot, write, type SessionLog } from './store'

/**
 * Аккаунт и синхронизация прогресса. Без входа приложение работает как раньше — всё в браузере.
 * После входа данные хранятся и на сервере: при входе локальный прогресс объединяется с серверным,
 * дальше каждое изменение отправляется с задержкой в несколько секунд.
 */
export type User = { id: string; provider: string; name: string | null; email: string | null; avatar: string | null; avatarId?: string | null }
type State = { user: User | null; ready: boolean; providers: string[]; syncedAt: number | null; syncing: boolean; error: string | null }

let state: State = { user: null, ready: false, providers: [], syncedAt: null, syncing: false, error: null }
const subs = new Set<() => void>()
const set = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach(f => f()) }
export const useAccount = () => useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f) }, () => state)

/** Настройки конкретного устройства — не переносим между устройствами */
const LOCAL_ONLY = DEVICE_KEYS

const api = (path: string, init?: RequestInit) => fetch('/api' + path, { credentials: 'same-origin', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })

/** Объединение: журнал — без потерь с обеих сторон; остальное — более свежая правка по меткам времени (без меток — серверная) */
export function merge(local: Record<string, unknown>, remote: Record<string, unknown> | null) {
  if (!remote) return local
  const lm = (local.meta ?? {}) as Record<string, number>, rm = (remote.meta ?? {}) as Record<string, number>
  const out: Record<string, unknown> = { ...local, ...remote }
  for (const k of Object.keys(local)) if (k in remote && (lm[k] ?? 0) > (rm[k] ?? 0)) out[k] = local[k]
  const meta: Record<string, number> = { ...rm }
  for (const [k, t] of Object.entries(lm)) meta[k] = Math.max(t, meta[k] ?? 0)
  out.meta = meta
  const logs = [...((local.log as SessionLog[]) ?? []), ...((remote.log as SessionLog[]) ?? [])]
  const seen = new Set<string>()
  out.log = logs.filter(l => l && typeof l === 'object' && typeof l.date === 'number').filter(l => { const k = l.date + ':' + l.id; if (seen.has(k)) return false; seen.add(k); return true }).sort((a, b) => b.date - a.date).slice(0, 1000)
  // курс: закрытые дни с обеих сторон, текущий день — локальный (он свежее)
  type C = { done?: Record<string, number>; active?: unknown }
  const lc = local.course as C | undefined, rc = remote.course as C | undefined
  if (lc && rc) out.course = { done: { ...(rc.done ?? {}), ...(lc.done ?? {}) }, active: lc.active ?? rc.active ?? null }
  // сданные сегодня режимы подсказки: берём более свежий день, в один день — объединяем
  type P = { day: string; lv: Record<string, number> }
  const lp = local['drill.passed'] as P | undefined, rp = remote['drill.passed'] as P | undefined
  if (lp && rp) out['drill.passed'] = lp.day === rp.day ? { day: lp.day, lv: Object.fromEntries([...new Set([...Object.keys(lp.lv), ...Object.keys(rp.lv)])].map(k => [k, Math.max(lp.lv[k] ?? -1, rp.lv[k] ?? -1)])) } : (Date.parse(lp.day) >= Date.parse(rp.day) ? lp : rp)
  // обратная совместимость goal <-> goals и валидация skillProfile / planMode
  if ('goals' in out) {
    if ((meta.goal ?? 0) > (meta.goals ?? 0) && typeof out.goal === 'string') {
      out.goals = normalizeGoals(null, out.goal)
      meta.goals = meta.goal
    } else if (Array.isArray(out.goals) && out.goals.length) {
      const g = normalizeGoals(out.goals, out.goal)
      out.goals = g
      out.goal = g[0]
    }
  }
  if ('skillProfile' in out) out.skillProfile = normalizeSkillProfile(out.skillProfile)
  if ('planMode' in out) out.planMode = out.planMode === 'split' ? 'split' : 'mix'
  return out
}

let timer: ReturnType<typeof setTimeout> | undefined
/** Есть правки, которых ещё нет на сервере (переживает перезапуск) */
const DIRTY = 'vt:syncDirty'
const isDirty = () => { try { return localStorage.getItem(DIRTY) === '1' } catch { return false } }
const setDirty = (v: boolean) => { try { if (v) localStorage.setItem(DIRTY, '1'); else localStorage.removeItem(DIRTY) } catch { /* нет хранилища */ } }
const synced = (d: Record<string, unknown>) => Object.fromEntries(Object.entries(d).filter(([k]) => !LOCAL_ONLY.has(k) && k !== 'owner'))
let busy: Promise<boolean> | null = null

/** Отправить свои правки: сначала забираем серверную версию и сливаем, чтобы не затереть правки других устройств */
function push(): Promise<boolean> {
  clearTimeout(timer); timer = undefined
  if (!state.user || !isDirty()) return Promise.resolve(true)
  if (busy) return busy
  busy = (async () => {
    set({ syncing: true })
    try {
      const g = await api('/progress')
      if (!g.ok) throw new Error(String(g.status))
      let { data: remote, version } = await g.json() as { data: Record<string, unknown> | null; version?: number }
      for (let attempt = 0; attempt < 3; attempt++) {
        setDirty(false) // правки, сделанные во время отправки, снова поднимут флаг
        const merged = merge(snapshot(), remote)
        for (const [k, v] of Object.entries(synced(merged))) write(k, v, true)
        const r = await api('/progress', { method: 'PUT', body: JSON.stringify({ data: synced(merged), version: version ?? 0 }) })
        if (r.ok) {
          set({ syncedAt: Date.now(), syncing: false, error: null })
          return true
        }
        if (r.status === 409 && attempt < 2) {
          const conflict = await r.json().catch(() => null) as { data?: Record<string, unknown> | null; version?: number } | null
          if (conflict && 'version' in conflict) {
            remote = conflict.data ?? null
            version = conflict.version ?? 0
            continue
          }
        }
        throw new Error(String(r.status))
      }
      throw new Error('409')
    } catch {
      setDirty(true)
      set({ syncing: false, error: tr('Не удалось сохранить на сервере, повторим позже') })
      return false
    } finally {
      busy = null
      // правки, пришедшие во время отправки или после ошибки, — повторим сами
      if (isDirty() && state.user) { clearTimeout(timer); timer = setTimeout(push, state.error ? 30_000 : 4000) }
    }
  })()
  return busy
}

async function pull(userId: string) {
  const r = await api('/progress')
  if (!r.ok) return
  const { data } = await r.json() as { data: Record<string, unknown> | null }
  // локальные данные чужого аккаунта не сливаем — только «ничьи» (до первого входа) или свои
  const owner = read<string | null>('owner', null)
  if (owner && owner !== userId) { clearSynced(LOCAL_ONLY); setDirty(false) }
  const merged = merge(snapshot(), data)
  merged.owner = userId
  for (const [k, v] of Object.entries(merged)) if (!LOCAL_ONLY.has(k)) write(k, v, true)
  // на устройстве есть то, чего нет на сервере (первый вход, офлайн-правки) — отправим
  const same = (a: Record<string, unknown>, b: Record<string, unknown>) => { const ka = Object.keys(a); return ka.length === Object.keys(b).length && ka.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k])) }
  if (!same(synced(merged), synced(data ?? {}))) setDirty(true)
  set({ syncedAt: Date.now() })
  await push()
}

let started = false
export async function initAccount() {
  if (started) return
  started = true
  ensureGoalProfile()
  onWrite(() => { setDirty(true); if (state.user) { clearTimeout(timer); timer = setTimeout(push, 4000) } })
  // свернули — отправляем сразу, пока страница ещё жива
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && isDirty()) void push() })
  await loadMe()
}

async function loadMe() {
  try {
    const [me, pr] = await Promise.all([api('/me'), api('/providers')])
    const prBody = pr.ok ? await pr.json().catch(() => null) as { providers?: unknown } | null : null
    const providers = Array.isArray(prBody?.providers) ? prBody.providers.filter((x): x is string => typeof x === 'string') : []
    const user = me.ok ? ((await me.json()) as { user: User }).user : null
    set({ user, providers, ready: true, error: null })
    if (user) await pull(user.id)
  } catch { set({ ready: true, error: tr('Сервер аккаунтов недоступен') }) }
}

/** Выбрать аватарку из набора (null — вернуться к фото из Google/Яндекса). true — сохранено */
export async function setAvatar(id: string | null): Promise<boolean> {
  try {
    if (!state.user) return false
    // сразу показываем выбор, при ошибке возвращаем прежний
    const prev = state.user.avatarId ?? null
    set({ user: { ...state.user, avatarId: id } })
    const r = await api('/profile/avatar', { method: 'PUT', body: JSON.stringify({ id }) }).catch(() => null)
    if (r?.ok) return true
    if (state.user) set({ user: { ...state.user, avatarId: prev } })
    return false
  } catch { return false }
}

const AUTH_ERRORS: Record<string, string> = {
  bad_email: tr('Проверь адрес почты.'),
  bad_password: tr('Пароль — от 8 символов.'),
  exists: tr('Эта почта уже зарегистрирована. Войди с паролем.'),
  wrong: tr('Неверная почта или пароль.'),
  too_many: tr('Слишком много попыток. Подожди 15 минут.'),
}
export type AuthError = { code: string; text: string }
/** Вход или регистрация по почте. Возвращает ошибку с кодом или null */
export async function authEmail(mode: 'login' | 'register', email: string, password: string, name?: string): Promise<AuthError | null> {
  try {
    const r = await api('/' + mode, { method: 'POST', body: JSON.stringify({ email, password, name }) })
    if (!r.ok) { const { error } = await r.json().catch(() => ({ error: '' })) as { error: string }; return { code: error || 'unknown', text: AUTH_ERRORS[error] ?? tr('Не получилось. Попробуй ещё раз.') } }
    await loadMe()
    return null
  } catch { return { code: 'network', text: tr('Нет связи с сервером.') } }
}

export const loginUrl = (provider: string) => `/api/auth/${provider}/start`

/** Выход. Если последние изменения не дошли до сервера — false, и ничего не стираем */
export async function logout(force = false) {
  if (!(await push()) && !force) return false
  await api('/logout', { method: 'POST' })
  // на общем устройстве следующий человек не должен увидеть чужой прогресс
  clearSynced(LOCAL_ONLY)
  set({ user: null, syncedAt: null })
  return true
}

export async function deleteAccount() {
  const r = await api('/account', { method: 'DELETE' })
  if (r.ok) { clearSynced(LOCAL_ONLY); set({ user: null, syncedAt: null }) }
  return r.ok
}

/** Письмо со ссылкой для нового пароля. Ответ одинаковый, есть такая почта или нет */
export async function requestReset(email: string): Promise<string | null> {
  try {
    const r = await api('/reset/request', { method: 'POST', body: JSON.stringify({ email, lang }) })
    if (r.ok) return null
    const { error } = await r.json().catch(() => ({ error: '' })) as { error: string }
    return AUTH_ERRORS[error] ?? tr('Не получилось отправить письмо. Попробуй позже.')
  } catch { return tr('Нет связи с сервером.') }
}

export async function confirmReset(token: string, password: string): Promise<string | null> {
  try {
    const r = await api('/reset/confirm', { method: 'POST', body: JSON.stringify({ token, password }) })
    if (!r.ok) { const { error } = await r.json().catch(() => ({ error: '' })) as { error: string }; return error === 'bad_token' ? tr('Ссылка устарела или уже использована. Запроси новую.') : AUTH_ERRORS[error] ?? tr('Не получилось.') }
    await loadMe()
    return null
  } catch { return tr('Нет связи с сервером.') }
}

import { lang, tr } from './i18n'
import { useSyncExternalStore } from 'react'
import { clearSynced, onWrite, read, snapshot, write, type SessionLog } from './store'

/**
 * Аккаунт и синхронизация прогресса. Без входа приложение работает как раньше — всё в браузере.
 * После входа данные хранятся и на сервере: при входе локальный прогресс объединяется с серверным,
 * дальше каждое изменение отправляется с задержкой в несколько секунд.
 */
export type User = { id: string; provider: string; name: string | null; email: string | null; avatar: string | null }
type State = { user: User | null; ready: boolean; providers: string[]; syncedAt: number | null; syncing: boolean; error: string | null }

let state: State = { user: null, ready: false, providers: [], syncedAt: null, syncing: false, error: null }
const subs = new Set<() => void>()
const set = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach(f => f()) }
export const useAccount = () => useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f) }, () => state)

/** Настройки конкретного устройства — не переносим между устройствами */
const LOCAL_ONLY = new Set(['rh.latency', 'reminder'])

const api = (path: string, init?: RequestInit) => fetch('/api' + path, { credentials: 'same-origin', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })

/** Объединение: журнал занятий — без потерь с обеих сторон, остальное — серверная версия, если она есть */
function merge(local: Record<string, unknown>, remote: Record<string, unknown> | null) {
  if (!remote) return local
  const out = { ...local, ...remote }
  const logs = [...((local.log as SessionLog[]) ?? []), ...((remote.log as SessionLog[]) ?? [])]
  const seen = new Set<string>()
  out.log = logs.filter(l => l && typeof l === 'object' && typeof l.date === 'number').filter(l => { const k = l.date + ':' + l.id; if (seen.has(k)) return false; seen.add(k); return true }).sort((a, b) => b.date - a.date)
  return out
}

let timer: ReturnType<typeof setTimeout> | undefined
async function push(keepalive = false): Promise<boolean> {
  clearTimeout(timer)
  if (!state.user) return false
  const data = Object.fromEntries(Object.entries(snapshot()).filter(([k]) => !LOCAL_ONLY.has(k)))
  set({ syncing: true })
  try {
    const r = await api('/progress', { method: 'PUT', body: JSON.stringify({ data }), keepalive })
    if (!r.ok) throw new Error(String(r.status))
    set({ syncedAt: Date.now(), syncing: false, error: null })
    return true
  } catch { set({ syncing: false, error: tr('Не удалось сохранить на сервере, повторим позже') }); return false }
}

async function pull(userId: string) {
  const r = await api('/progress')
  if (!r.ok) return
  const { data } = await r.json() as { data: Record<string, unknown> | null }
  // локальные данные чужого аккаунта не сливаем — только «ничьи» (до первого входа) или свои
  const owner = read<string | null>('owner', null)
  if (owner && owner !== userId) clearSynced(LOCAL_ONLY)
  const merged = merge(snapshot(), data)
  merged.owner = userId
  for (const [k, v] of Object.entries(merged)) if (!LOCAL_ONLY.has(k)) write(k, v, true)
  await push()
}

let started = false
export async function initAccount() {
  if (started) return
  started = true
  onWrite(() => { if (state.user) { clearTimeout(timer); timer = setTimeout(push, 4000) } })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && timer) push(true) })
  await loadMe()
}

async function loadMe() {
  try {
    const [me, pr] = await Promise.all([api('/me'), api('/providers')])
    const providers = pr.ok ? ((await pr.json()) as { providers: string[] }).providers : []
    const user = me.ok ? ((await me.json()) as { user: User }).user : null
    set({ user, providers, ready: true, error: null })
    if (user) await pull(user.id)
  } catch { set({ ready: true, error: tr('Сервер аккаунтов недоступен') }) }
}

const AUTH_ERRORS: Record<string, string> = {
  bad_email: tr('Проверь адрес почты.'),
  bad_password: tr('Пароль — от 8 символов.'),
  exists: tr('Эта почта уже зарегистрирована. Войди с паролем.'),
  wrong: tr('Неверная почта или пароль.'),
  too_many: tr('Слишком много попыток. Подожди 15 минут.'),
}
/** Вход или регистрация по почте. Возвращает текст ошибки или null */
export async function authEmail(mode: 'login' | 'register', email: string, password: string, name?: string): Promise<string | null> {
  try {
    const r = await api('/' + mode, { method: 'POST', body: JSON.stringify({ email, password, name }) })
    if (!r.ok) { const { error } = await r.json().catch(() => ({ error: '' })) as { error: string }; return AUTH_ERRORS[error] ?? tr('Не получилось. Попробуй ещё раз.') }
    await loadMe()
    return null
  } catch { return tr('Нет связи с сервером.') }
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

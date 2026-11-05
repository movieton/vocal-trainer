// fasol.app API: вход через Google и Яндекс, хранение прогресса.
// Без внешних зависимостей: node:http, node:sqlite, fetch. Секреты — только из переменных окружения.
import http from 'node:http'
import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const env = process.env
const BASE = env.BASE_URL ?? 'https://fasol.app'
const PORT = +(env.PORT ?? 8787)
// локальный вход без OAuth — только для разработки и никогда на https
const DEV = env.DEV_LOGIN === '1' && !BASE.startsWith('https')
const SESSION_DAYS = 180
const MAX_PROGRESS = 1_000_000

const db = new DatabaseSync(env.DB_PATH ?? '/data/fasol.db')
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, provider TEXT NOT NULL, sub TEXT NOT NULL, name TEXT, email TEXT, avatar TEXT, created INTEGER NOT NULL, UNIQUE(provider, sub));
  CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS progress (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, updated INTEGER NOT NULL);
`)
db.exec('PRAGMA foreign_keys = ON')
// вход по почте и паролю: хэш scrypt с солью
if (!db.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = 'pass'").get()) db.exec('ALTER TABLE users ADD COLUMN pass TEXT')
db.exec('CREATE TABLE IF NOT EXISTS resets (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL)')

// письма отправляются через Resend (https://resend.com); без ключа сброс пароля выключен
const MAIL = env.RESEND_API_KEY && env.MAIL_FROM ? { key: env.RESEND_API_KEY, from: env.MAIL_FROM } : null
async function sendMail(to, subject, text) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${MAIL.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL.from, to: [to], subject, text }),
  })
  if (!r.ok) throw new Error('mail_failed ' + r.status)
}

const scrypt = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? no(e) : ok(k)))
async function hashPass(pw) { const salt = crypto.randomBytes(16); return `${salt.toString('base64')}:${(await scrypt(pw, salt)).toString('base64')}` }
async function checkPass(pw, stored) {
  const [salt, hash] = (stored ?? '').split(':')
  if (!salt || !hash) { await scrypt(pw, 'x'.repeat(16)); return false } // одинаковое время ответа
  const k = await scrypt(pw, Buffer.from(salt, 'base64'))
  return crypto.timingSafeEqual(k, Buffer.from(hash, 'base64'))
}
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/
// подбор пароля: неудачные попытки считаем и по почте (10 за 15 минут), и по адресу (30 за 15 минут)
const WINDOW = 15 * 6e4, fails = new Map()
const hits = k => { const f = fails.get(k); return f && Date.now() - f.t < WINDOW ? f.n : 0 }
const tooMany = (email, ip) => hits('e:' + email) >= 10 || hits('i:' + ip) >= 30
const failed = (...keys) => keys.forEach(k => { const n = hits(k); fails.set(k, { n: n + 1, t: n ? fails.get(k).t : Date.now() }) })
// устаревшие записи — прочь, и не больше 50 тысяч
setInterval(() => { const now = Date.now(); for (const [k, f] of fails) if (now - f.t > WINDOW) fails.delete(k); if (fails.size > 5e4) fails.clear() }, 5 * 6e4).unref()
// адрес клиента ставит nginx из $remote_addr — подделать нельзя
const clientIp = req => String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim()

const PROVIDERS = {
  google: {
    id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET,
    auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    profile: async t => {
      const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${t}` } })
      const p = r.ok ? await r.json() : {}
      if (!p.sub) throw new Error('bad_profile')
      return { sub: p.sub, name: p.name, email: p.email, avatar: p.picture }
    },
  },
  yandex: {
    id: env.YANDEX_CLIENT_ID, secret: env.YANDEX_CLIENT_SECRET,
    auth: 'https://oauth.yandex.ru/authorize', token: 'https://oauth.yandex.ru/token',
    scope: 'login:info login:email login:avatar',
    profile: async t => {
      const r = await fetch('https://login.yandex.ru/info?format=json', { headers: { Authorization: `OAuth ${t}` } })
      const p = r.ok ? await r.json() : {}
      if (p.id == null || p.id === '') throw new Error('bad_profile')
      return { sub: String(p.id), name: p.real_name || p.display_name || p.login, email: p.default_email, avatar: p.is_avatar_empty ? null : `https://avatars.yandex.net/get-yapic/${p.default_avatar_id}/islands-200` }
    },
  },
}
const enabled = () => ['email', ...(MAIL ? ['reset'] : []), ...Object.keys(PROVIDERS).filter(k => PROVIDERS[k].id && PROVIDERS[k].secret), ...(DEV ? ['dev'] : [])]

const sha = s => crypto.createHash('sha256').update(s).digest('hex')
const dec = v => { try { return decodeURIComponent(v) } catch { return v } }
const cookies = req => Object.fromEntries((req.headers.cookie ?? '').split(';').map(c => c.trim().split('=')).filter(([k]) => k).map(([k, ...v]) => [k, dec(v.join('='))]))
const HTTPS = BASE.startsWith('https')
const secure = HTTPS ? '; Secure' : ''
// на https — префикс __Host-: cookie нельзя подложить с поддомена
const SID = HTTPS ? '__Host-fs_sid' : 'fs_sid', STATE = HTTPS ? '__Host-fs_state' : 'fs_state'
const setCookie = (res, name, val, maxAge) => res.appendHeader('Set-Cookie', `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`)
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)) }
const redirect = (res, to) => { res.writeHead(302, { Location: to, 'Cache-Control': 'no-store' }); res.end() }

function currentUser(req) {
  const sid = cookies(req)[SID]
  if (!sid) return null
  const row = db.prepare('SELECT u.id, u.provider, u.name, u.email, u.avatar FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = ? AND s.expires > ?').get(sha(sid), Date.now())
  return row ?? null
}
/** Новая сессия для пользователя; старая из этого браузера удаляется */
function issueSession(req, res, userId) {
  const old = cookies(req)[SID]
  if (old) db.prepare('DELETE FROM sessions WHERE hash = ?').run(sha(old))
  const sid = crypto.randomBytes(32).toString('base64url')
  db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(sha(sid), userId, Date.now() + SESSION_DAYS * 864e5)
  setCookie(res, SID, sid, SESSION_DAYS * 86400)
}
function login(req, res, provider, p) {
  let u = db.prepare('SELECT id FROM users WHERE provider = ? AND sub = ?').get(provider, p.sub)
  if (u) db.prepare('UPDATE users SET name = ?, email = ?, avatar = ? WHERE id = ?').run(p.name ?? null, p.email ?? null, p.avatar ?? null, u.id)
  else { u = { id: crypto.randomUUID() }; db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)').run(u.id, provider, p.sub, p.name ?? null, p.email ?? null, p.avatar ?? null, Date.now()) }
  issueSession(req, res, u.id)
}
async function readBody(req) {
  let size = 0; const chunks = []
  for await (const c of req) { size += c.length; if (size > MAX_PROGRESS + 1000) throw new Error('too_large'); chunks.push(c) }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { throw new Error('bad_json') }
}
// защита от подделки запросов: изменяющие запросы только с нашего сайта
const sameOrigin = req => req.headers.origin === BASE && (req.headers['content-type'] ?? '').startsWith('application/json')

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE)
  const path = url.pathname.replace(/^\/api/, '')
  try {
    if (path === '/health') return json(res, 200, { ok: true })
    if (path === '/providers') return json(res, 200, { providers: enabled() })

    const start = path.match(/^\/auth\/(google|yandex)\/start$/)
    if (start && req.method === 'GET') {
      const P = PROVIDERS[start[1]]
      if (!P.id) return json(res, 404, { error: 'provider_disabled' })
      const state = crypto.randomBytes(16).toString('base64url'), verifier = crypto.randomBytes(32).toString('base64url')
      setCookie(res, STATE, `${start[1]}:${state}:${verifier}`, 600)
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
      const q = new URLSearchParams({ client_id: P.id, redirect_uri: `${BASE}/api/auth/${start[1]}/callback`, response_type: 'code', scope: P.scope, state, code_challenge: challenge, code_challenge_method: 'S256' })
      if (start[1] === 'google') q.set('prompt', 'select_account')
      return redirect(res, `${P.auth}?${q}`)
    }
    const cb = path.match(/^\/auth\/(google|yandex)\/callback$/)
    if (cb && req.method === 'GET') {
      const P = PROVIDERS[cb[1]], code = url.searchParams.get('code'), state = url.searchParams.get('state')
      const [sp, ss, verifier] = (cookies(req)[STATE] ?? '').split(':')
      if (!P.id || !code || !state || sp !== cb[1] || state !== ss || !verifier) return redirect(res, '/#/account?login=error')
      setCookie(res, STATE, '', 0)
      const tok = await (await fetch(P.token, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: P.id, client_secret: P.secret, redirect_uri: `${BASE}/api/auth/${cb[1]}/callback`, code_verifier: verifier }),
      })).json()
      if (!tok.access_token) return redirect(res, '/#/account?login=error')
      const profile = await P.profile(tok.access_token).catch(() => null)
      if (!profile || typeof profile.sub !== 'string' || !profile.sub) return redirect(res, '/#/account?login=error')
      login(req, res, cb[1], profile)
      return redirect(res, '/#/account?login=ok')
    }
    if (DEV && path === '/auth/dev/start') { login(req, res, 'dev', { sub: 'dev', name: 'Тестовый вокалист', email: 'dev@fasol.test' }); return redirect(res, '/#/account?login=ok') }

    if ((path === '/register' || path === '/login') && req.method === 'POST') {
      if (!sameOrigin(req)) return json(res, 403, { error: 'bad_origin' })
      const b = await readBody(req)
      const email = String(b.email ?? '').trim().toLowerCase(), pw = String(b.password ?? '')
      if (!EMAIL.test(email)) return json(res, 400, { error: 'bad_email' })
      if (pw.length < 8 || pw.length > 200) return json(res, 400, { error: 'bad_password' })
      const ip = clientIp(req)
      if (tooMany(email, ip)) return json(res, 429, { error: 'too_many' })
      const row = db.prepare("SELECT id, pass FROM users WHERE provider = 'email' AND sub = ?").get(email)
      if (path === '/register') {
        failed('i:' + ip) // каждая регистрация — в счётчик адреса (против перебора почт)
        if (row) return json(res, 409, { error: 'exists' })
        const name = String(b.name ?? '').trim().slice(0, 80) || null
        const id = crypto.randomUUID()
        db.prepare('INSERT INTO users (id, provider, sub, name, email, avatar, created, pass) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, 'email', email, name, email, null, Date.now(), await hashPass(pw))
        login(req, res, 'email', { sub: email, name, email })
        return json(res, 200, { ok: true })
      }
      if (!row || !(await checkPass(pw, row.pass))) { failed('e:' + email, 'i:' + ip); return json(res, 401, { error: 'wrong' }) }
      fails.delete('e:' + email)
      issueSession(req, res, row.id)
      return json(res, 200, { ok: true })
    }

    // сброс пароля: письмо со ссылкой на 1 час. Ответ всегда одинаковый — по нему не узнать, есть ли почта
    if (path === '/reset/request' && req.method === 'POST') {
      if (!sameOrigin(req)) return json(res, 403, { error: 'bad_origin' })
      if (!MAIL) return json(res, 503, { error: 'mail_disabled' })
      const email = String((await readBody(req)).email ?? '').trim().toLowerCase(), ip = clientIp(req)
      if (!EMAIL.test(email)) return json(res, 400, { error: 'bad_email' })
      // свой счётчик: не больше 3 писем на почту и 10 запросов с адреса за 15 минут; вход владельцу не блокирует
      if (hits('r:' + email) >= 3 || hits('ri:' + ip) >= 10) return json(res, 429, { error: 'too_many' })
      failed('r:' + email, 'ri:' + ip)
      const row = db.prepare("SELECT id FROM users WHERE provider = 'email' AND sub = ?").get(email)
      if (row) {
        const token = crypto.randomBytes(32).toString('base64url')
        db.prepare('DELETE FROM resets WHERE user_id = ?').run(row.id)
        db.prepare('INSERT INTO resets VALUES (?, ?, ?)').run(sha(token), row.id, Date.now() + 36e5)
        // не ждём отправку: время ответа не должно выдавать, есть ли такая почта
        sendMail(email, 'Восстановление пароля fasol.app',
          `Здравствуй!\n\nЧтобы задать новый пароль для fasol.app, открой ссылку (действует 1 час):\n${BASE}/#/reset?token=${token}\n\nЕсли ты не запрашивал сброс — просто проигнорируй это письмо.`).catch(e => console.error(e))
      }
      return json(res, 200, { ok: true })
    }
    if (path === '/reset/confirm' && req.method === 'POST') {
      if (!sameOrigin(req)) return json(res, 403, { error: 'bad_origin' })
      const b = await readBody(req), pw = String(b.password ?? '')
      if (pw.length < 8 || pw.length > 200) return json(res, 400, { error: 'bad_password' })
      const row = db.prepare('SELECT user_id FROM resets WHERE hash = ? AND expires > ?').get(sha(String(b.token ?? '')), Date.now())
      if (!row) return json(res, 400, { error: 'bad_token' })
      db.prepare('DELETE FROM resets WHERE user_id = ?').run(row.user_id)
      db.prepare('UPDATE users SET pass = ? WHERE id = ?').run(await hashPass(pw), row.user_id)
      const u = db.prepare('SELECT sub FROM users WHERE id = ?').get(row.user_id)
      if (u) fails.delete('e:' + u.sub)
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id) // выйти на всех устройствах
      issueSession(req, res, row.user_id)
      return json(res, 200, { ok: true })
    }

    if (path === '/me') { const u = currentUser(req); return u ? json(res, 200, { user: u }) : json(res, 401, { error: 'unauthorized' }) }

    if (!sameOrigin(req) && req.method !== 'GET') return json(res, 403, { error: 'bad_origin' })
    if (path === '/logout' && req.method === 'POST') {
      const sid = cookies(req)[SID]
      if (sid) db.prepare('DELETE FROM sessions WHERE hash = ?').run(sha(sid))
      setCookie(res, SID, '', 0)
      return json(res, 200, { ok: true })
    }
    const u = currentUser(req)
    if (path === '/progress') {
      if (!u) return json(res, 401, { error: 'unauthorized' })
      if (req.method === 'GET') {
        const row = db.prepare('SELECT data, updated FROM progress WHERE user_id = ?').get(u.id)
        return json(res, 200, row ? { data: JSON.parse(row.data), updated: row.updated } : { data: null, updated: 0 })
      }
      if (req.method === 'PUT') {
        const body = await readBody(req)
        if (typeof body.data !== 'object' || body.data == null) return json(res, 400, { error: 'bad_data' })
        const text = JSON.stringify(body.data)
        if (text.length > MAX_PROGRESS) return json(res, 413, { error: 'too_large' })
        const updated = Date.now()
        db.prepare('INSERT INTO progress VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated = excluded.updated').run(u.id, text, updated)
        return json(res, 200, { updated })
      }
    }
    if (path === '/account' && req.method === 'DELETE') {
      if (!u) return json(res, 401, { error: 'unauthorized' })
      db.prepare('DELETE FROM users WHERE id = ?').run(u.id)
      setCookie(res, SID, '', 0)
      return json(res, 200, { ok: true })
    }
    json(res, 404, { error: 'not_found' })
  } catch (e) {
    console.error(e)
    json(res, e.message === 'too_large' ? 413 : e.message === 'bad_json' ? 400 : 500, { error: e.message === 'bad_json' ? 'bad_json' : 'server_error' })
  }
})
server.listen(PORT, '0.0.0.0', () => console.log(`fasol api :${PORT}, providers: ${enabled().join(', ') || 'нет'}`))
// чистка просроченных сессий раз в сутки
setInterval(() => { db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now()); db.prepare('DELETE FROM resets WHERE expires < ?').run(Date.now()) }, 864e5).unref()

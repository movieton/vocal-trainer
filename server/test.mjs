import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const PORT = 18787
const BASE = `http://127.0.0.1:${PORT}`

function startServer(dbPath) {
  const proc = spawn(process.execPath, ['index.mjs'], {
    cwd: path.resolve(import.meta.dirname),
    env: { ...process.env, PORT: String(PORT), BASE_URL: BASE, DB_PATH: dbPath, DEV_LOGIN: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server start timeout')), 5000)
    proc.stdout.on('data', chunk => {
      if (String(chunk).includes('fasol api')) {
        clearTimeout(timer)
        resolve(proc)
      }
    })
    proc.stderr.on('data', chunk => {
      const s = String(chunk)
      if (s.trim()) console.error('[server stderr]', s)
    })
    proc.on('exit', code => {
      clearTimeout(timer)
      reject(new Error(`server exited early with code ${code}`))
    })
  })
}

async function req(p, { method = 'GET', cookie = '', body } = {}) {
  const headers = { Origin: BASE }
  if (cookie) headers.Cookie = cookie
  if (method !== 'GET') headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  const setCookies = res.headers.getSetCookie?.() ?? []
  const nextCookie = setCookies.map(c => c.split(';')[0]).join('; ') || cookie
  const data = await res.json().catch(() => null)
  return { status: res.status, data, cookie: nextCookie }
}

test('SQLite WAL/busy_timeout, PUT /api/progress optimistic locking (409), and GDPR DELETE /api/account', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fasol-srv-test-'))
  const dbPath = path.join(tmpDir, 'test.db')
  const proc = await startServer(dbPath)
  try {
    // 1. Check WAL mode (persisted on DB file) and verify server sets busy_timeout = 5000
    const db = new DatabaseSync(dbPath)
    const jm = db.prepare('PRAGMA journal_mode').get().journal_mode
    assert.equal(jm, 'wal')
    assert.match(fs.readFileSync(path.resolve(import.meta.dirname, 'index.mjs'), 'utf8'), /PRAGMA busy_timeout = 5000/)

    // 2. Register user (session 1) and login same user (session 2) to simulate 2 devices
    const reg = await req('/api/register', {
      method: 'POST',
      body: { email: 'race@fasol.test', password: 'password123', name: 'Singer' },
    })
    assert.equal(reg.status, 200)
    const c1 = reg.cookie
    assert.ok(c1.includes('fs_sid='))

    const log2 = await req('/api/login', {
      method: 'POST',
      body: { email: 'race@fasol.test', password: 'password123' },
    })
    assert.equal(log2.status, 200)
    const c2 = log2.cookie

    // 3. Both devices fetch initial empty progress (version: 0)
    const g1 = await req('/api/progress', { cookie: c1 })
    const g2 = await req('/api/progress', { cookie: c2 })
    assert.equal(g1.status, 200)
    assert.equal(g1.data.version, 0)
    assert.equal(g2.data.version, 0)

    // Device 1 writes first -> 200, version becomes 1
    const p1 = await req('/api/progress', {
      method: 'PUT',
      cookie: c1,
      body: { data: { goal: 'pitch', log: [{ date: 1000, id: 'hum', score: 90 }] }, version: g1.data.version },
    })
    assert.equal(p1.status, 200)
    assert.equal(p1.data.version, 1)

    // Device 2 writes with stale version 0 -> 409 Conflict with Device 1's snapshot
    const p2Stale = await req('/api/progress', {
      method: 'PUT',
      cookie: c2,
      body: { data: { goal: 'range', log: [{ date: 2000, id: 'straw', score: 85 }] }, version: g2.data.version },
    })
    assert.equal(p2Stale.status, 409)
    assert.equal(p2Stale.data.error, 'conflict')
    assert.equal(p2Stale.data.version, 1)
    assert.equal(p2Stale.data.data.goal, 'pitch')

    // Confirm Device 1's data was NOT overwritten
    const afterConflict = await req('/api/progress', { cookie: c1 })
    assert.equal(afterConflict.data.data.goal, 'pitch')
    assert.equal(afterConflict.data.version, 1)

    // Device 2 retries with updated version 1 -> 200, version becomes 2
    const p2Retry = await req('/api/progress', {
      method: 'PUT',
      cookie: c2,
      body: { data: { goal: 'pitch', log: [{ date: 2000, id: 'straw', score: 85 }, { date: 1000, id: 'hum', score: 90 }] }, version: p2Stale.data.version },
    })
    assert.equal(p2Retry.status, 200)
    assert.equal(p2Retry.data.version, 2)

    // 4. Populate resets and push_subs for this user to verify full GDPR deletion across all 5 tables
    const me = await req('/api/me', { cookie: c1 })
    const userId = me.data.user.id
    db.prepare('INSERT INTO resets (hash, user_id, expires) VALUES (?, ?, ?)').run('testhash', userId, Date.now() + 60000)
    db.prepare('INSERT INTO push_subs (endpoint, sub, hour, minute, tz, user_id, last_day, created, lang) VALUES (?, ?, 19, 0, ?, ?, NULL, ?, ?)')
      .run('https://fcm.googleapis.com/fcm/send/test-ep', '{"endpoint":"https://fcm.googleapis.com/fcm/send/test-ep","keys":{"p256dh":"a","auth":"b"}}', 'UTC', userId, Date.now(), 'ru')

    for (const [tbl, col] of [['users', 'id'], ['sessions', 'user_id'], ['progress', 'user_id'], ['resets', 'user_id'], ['push_subs', 'user_id']]) {
      const cnt = db.prepare(`SELECT COUNT(*) AS n FROM ${tbl} WHERE ${col} = ?`).get(userId).n
      assert.ok(cnt >= 1, `expected >= 1 row in ${tbl} before delete`)
    }

    // Delete account
    const del = await req('/api/account', { method: 'DELETE', cookie: c1 })
    assert.equal(del.status, 200)
    assert.equal(del.data.ok, true)

    // Verify 0 rows remain in all 5 tables
    for (const [tbl, col] of [['users', 'id'], ['sessions', 'user_id'], ['progress', 'user_id'], ['resets', 'user_id'], ['push_subs', 'user_id']]) {
      const cnt = db.prepare(`SELECT COUNT(*) AS n FROM ${tbl} WHERE ${col} = ?`).get(userId).n
      assert.equal(cnt, 0, `expected 0 rows in ${tbl} after DELETE /api/account`)
    }
    db.close()
  } finally {
    proc.kill('SIGTERM')
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Cloud, CloudOff, LogOut } from 'lucide-react'
import { authEmail, deleteAccount, loginUrl, logout, useAccount } from '../lib/account'

const PROVIDER_NAME: Record<string, string> = { google: 'Google', yandex: 'Яндекс ID', email: 'почту и пароль', dev: 'тестовый вход' }

export default function Account() {
  const a = useAccount()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const failed = params.get('login') === 'error'

  if (!a.ready) return <div className="page"><h1>Аккаунт</h1><p className="muted">Проверяем вход…</p></div>

  if (!a.user) return (
    <div className="page account">
      <h1>Аккаунт</h1>
      <p className="lead-narrow">Войди, чтобы прогресс сохранялся и был доступен на телефоне и компьютере. Без входа всё работает, но данные живут только в этом браузере.</p>
      {failed && <p className="note-box">Не получилось войти. Попробуй ещё раз или выбери другой способ.</p>}
      {a.providers.length === 0 && <p className="note-box">Вход скоро появится. Пока прогресс сохраняется в этом браузере.</p>}
      {a.providers.includes('email') && <EmailForm />}
      {a.providers.some(p => p !== 'email') && <div className="login-btns">
        {a.providers.includes('google') && <a className="login-btn google" href={loginUrl('google')}><GoogleMark /> Войти через Google</a>}
        {a.providers.includes('yandex') && <a className="login-btn yandex" href={loginUrl('yandex')}><span className="ya" aria-hidden>Я</span> Войти с Яндекс ID</a>}
        {a.providers.includes('dev') && <a className="login-btn" href={loginUrl('dev')}>Тестовый вход</a>}
      </div>}
      {a.providers.length > 0 && <p className="muted small consent">Входя или регистрируясь, ты соглашаешься с <Link to="/privacy">политикой конфиденциальности</Link>. Храним только имя, почту и прогресс занятий.</p>}
    </div>
  )

  const u = a.user
  return (
    <div className="page account">
      <h1>Аккаунт</h1>
      <div className="card who">
        {u.avatar ? <img src={u.avatar} alt="" className="avatar" referrerPolicy="no-referrer" /> : <span className="avatar">{(u.name ?? u.email ?? '?').slice(0, 1).toUpperCase()}</span>}
        <div className="who-text">
          <strong>{u.name ?? u.email ?? 'Без имени'}</strong>
          {u.email && u.name && <span className="muted small">{u.email}</span>}
          <span className="muted small">Вход через {PROVIDER_NAME[u.provider] ?? u.provider}</span>
        </div>
      </div>
      <p className={'sync-line' + (a.error ? ' bad' : '')}>
        {a.error ? <CloudOff size={18} /> : <Cloud size={18} />}
        {a.error ?? (a.syncing ? 'Сохраняем прогресс…' : a.syncedAt ? `Прогресс сохранён в ${new Date(a.syncedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}` : 'Прогресс синхронизируется')}
      </p>
      <p className="muted small lead-narrow">Занятия, диапазон, настройки и мелодии из «Сочинения» сохраняются автоматически. Войди с тем же аккаунтом на другом устройстве — всё подтянется.</p>
      <button className="btn ghost" onClick={async () => {
        if (!(await logout()) && confirm('Последние изменения не сохранились на сервере. Выйти всё равно? Они останутся только если не выходить.')) await logout(true)
      }}><LogOut size={16} /> Выйти</button>
      <div className="danger-zone">
        <p className="muted small">Удаление сотрёт профиль и прогресс — и на сервере, и в этом браузере. Восстановить их будет нельзя.</p>
        {!confirming
          ? <button className="danger-btn" onClick={() => setConfirming(true)}>Удалить аккаунт и данные</button>
          : <div className="confirm-row">
            <strong>Точно удалить?</strong>
            <div className="confirm-btns">
              <button className="danger-btn solid" disabled={busy} onClick={async () => { setBusy(true); await deleteAccount(); setBusy(false) }}>Удалить</button>
              <button className="btn ghost" onClick={() => setConfirming(false)}>Отмена</button>
            </div>
          </div>}
      </div>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function EmailForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  // ошибка привязана к полю, если она про конкретное поле
  const [err, setErr] = useState<{ field?: 'email' | 'pw'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const fieldOf = (t: string) => (/почт/i.test(t) && !/пароль/i.test(t) ? 'email' : /^Пароль/.test(t) ? 'pw' : undefined)
  const errFor = (f: 'email' | 'pw') => (err?.field === f ? err.text : null)
  return (
    <form className="auth-form" noValidate onSubmit={async e => {
      e.preventDefault()
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr({ field: 'email', text: 'Проверь адрес почты.' })
      if (pw.length < 8) return setErr({ field: 'pw', text: 'Пароль — от 8 символов.' })
      setBusy(true)
      const t = await authEmail(mode, email, pw, name)
      setErr(t ? { field: fieldOf(t), text: t } : null)
      setBusy(false)
    }}>
      <div className="seg">
        <button type="button" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setErr(null) }}>Вход</button>
        <button type="button" aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setErr(null) }}>Регистрация</button>
      </div>
      {mode === 'register' && <label><span>Имя <span className="muted small">— необязательно</span></span><input value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={80} /></label>}
      <label>Почта<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email"
        aria-invalid={!!errFor('email')} aria-describedby={errFor('email') ? 'err-email' : undefined} />
        {errFor('email') && <span id="err-email" className="field-err" role="alert">{errFor('email')}</span>}</label>
      <label>Пароль<input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        aria-invalid={!!errFor('pw')} aria-describedby={errFor('pw') ? 'err-pw' : mode === 'register' ? 'hint-pw' : undefined} />
        {errFor('pw') ? <span id="err-pw" className="field-err" role="alert">{errFor('pw')}</span> : mode === 'register' && <span id="hint-pw" className="muted small">От 8 символов</span>}</label>
      {err && !err.field && <p className="form-err" role="alert">{err.text}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Минутку…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
    </form>
  )
}

import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Плашка «Есть новая версия» — чтобы не застревать на закэшированной */
export function UpdateBanner() {
  const { needRefresh: [need, setNeed], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) { if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000) },
  })
  if (!need) return null
  return (
    <div className="update-banner" role="status">
      <span>Есть новая версия</span>
      <button className="btn small-btn" onClick={() => void updateServiceWorker(true)}>Обновить</button>
      <button className="textbtn" onClick={() => setNeed(false)}>Позже</button>
    </div>
  )
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: InstallEvent | null = null
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent })

/** Установка как приложения: кнопка в Chrome/Android, инструкция на iPhone */
export function InstallCard() {
  const [canPrompt, setCanPrompt] = useState(!!deferred)
  const [installed, setInstalled] = useState(matchMedia('(display-mode: standalone)').matches)
  useEffect(() => {
    const on = () => setCanPrompt(!!deferred)
    addEventListener('beforeinstallprompt', on)
    addEventListener('appinstalled', () => setInstalled(true))
    return () => removeEventListener('beforeinstallprompt', on)
  }, [])
  if (installed) return <div className="card"><h2>Приложение установлено</h2><p className="muted small">Распевка открывается с экрана «Домой» и работает без интернета.</p></div>
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  return (
    <div className="card">
      <h2>Установить как приложение</h2>
      <p className="muted small">Значок на экране «Домой», полный экран без адресной строки, работа без интернета.</p>
      {canPrompt ? <button className="btn" onClick={async () => { await deferred?.prompt(); deferred = null; setCanPrompt(false) }}>Установить</button>
        : ios ? <ol className="small"><li>Открой сайт в Safari.</li><li>Нажми «Поделиться» (квадрат со стрелкой).</li><li>Выбери «На экран „Домой“».</li></ol>
        : <p className="small">В Chrome: меню ⋮ → «Установить приложение». В Safari на Mac: «Файл» → «Добавить в Dock».</p>}
    </div>
  )
}

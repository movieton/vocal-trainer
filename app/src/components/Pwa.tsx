import { tr } from '../lib/i18n'
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
      <span>{tr('Есть новая версия')}</span>
      <button className="btn small-btn" onClick={() => void updateServiceWorker(true)}>{tr('Обновить')}</button>
      <button className="textbtn" onClick={() => setNeed(false)}>{tr('Позже')}</button>
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
  if (installed) return <div className="card"><h2>{tr('Приложение установлено')}</h2><p className="muted small">{tr('Распевка открывается с экрана «Домой» и работает без интернета.')}</p></div>
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  return (
    <div className="card">
      <h2>{tr('Установить как приложение')}</h2>
      <p className="muted small">{tr('Значок на экране «Домой», полный экран без адресной строки, работа без интернета.')}</p>
      {canPrompt ? <button className="btn" onClick={async () => { await deferred?.prompt(); deferred = null; setCanPrompt(false) }}>{tr('Установить')}</button>
        : ios ? <ol className="small"><li>{tr('Открой сайт в Safari.')}</li><li>{tr('Нажми «Поделиться» (квадрат со стрелкой).')}</li><li>{tr('Выбери «На экран „Домой“».')}</li></ol>
        : <p className="small">{tr('В Chrome: меню ⋮ → «Установить приложение». В Safari на Mac: «Файл» → «Добавить в Dock».')}</p>}
    </div>
  )
}

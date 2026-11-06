import { tr } from '../lib/i18n'
import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Новая версия: проверяем при каждом возврате в приложение и ставим сами, если человек не поёт; иначе — плашка */
export function UpdateBanner() {
  const { needRefresh: [need, setNeed], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const check = () => { if (navigator.onLine) void reg.update() }
      // установленное приложение живёт в фоне днями — проверяем, когда его снова открыли, и раз в 15 минут
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
      setInterval(check, 15 * 60 * 1000)
    },
  })
  // во время упражнения (режим фокуса) не перезагружаем — ждём, пока закончит
  useEffect(() => {
    if (!need) return
    const apply = () => { if (!document.documentElement.dataset.focus) void updateServiceWorker(true) }
    apply()
    const t = setInterval(apply, 5000)
    return () => clearInterval(t)
  }, [need, updateServiceWorker])
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

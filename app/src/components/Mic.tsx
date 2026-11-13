import { tr } from '../lib/i18n'
import { useEffect, useReducer, useRef } from 'react'
import { engine, SIM } from '../lib/audio'
import { computePitchDisplay } from '../lib/pitchDisplay'

/** Перерисовка компонента при смене состояния движка, не чаще ~12 раз в секунду */
export function useEngine(fps = 12) {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const last = useRef(0)
  useEffect(() => engine.subscribe(() => {
    const t = performance.now()
    if (t - last.current > 1000 / fps) { last.current = t; bump() }
  }), [fps])
}

/** Экран пользуется микрофоном, пока открыт */
export function useMicUser(autoStart = true) {
  useEffect(() => { engine.acquireMic(autoStart); return () => engine.releaseMic() }, [autoStart])
}

export function MicGate({ children }: { children?: React.ReactNode }) {
  useEngine(4)
  useMicUser()
  if (engine.mic === 'on') return <>{children}</>
  return (
    <div className="micgate">
      <div>
        <strong>{engine.mic === 'starting' ? tr('Включаю микрофон…') : tr('Нужен микрофон')}</strong>
        <p>{engine.audioSuspended ? tr('Нажми, чтобы включить звук и микрофон') : tr('Звук разбирается прямо в браузере и никуда не отправляется. Лучше всего петь в наушниках.')}{SIM && import.meta.env.DEV && tr(' Режим проверки: вместо голоса синтетический тон.')}</p>
        {engine.mic === 'error' && <p className="err">{engine.micError}</p>}
      </div>
      <button className="btn" onClick={() => engine.startMic()} disabled={engine.mic === 'starting'}>{tr('Включить микрофон')}</button>
    </div>
  )
}

export function LiveNote({ big, targetMidi }: { big?: boolean; targetMidi?: number | null | (() => number | null) }) {
  useEngine(15)
  if (engine.mic !== 'on') return null
  const m = engine.current
  const resolvedTarget = typeof targetMidi === 'function' ? targetMidi() : targetMidi
  const { note, cents, isTarget } = computePitchDisplay(m, resolvedTarget)
  // место под ноту есть всегда: появление голоса не сдвигает экран
  return (
    <div className={'livenote' + (big ? ' big' : '') + (m == null ? ' silent' : '') + (isTarget && m != null ? ' target' : '')}>
      <span className="n">{note ?? '—'}</span>
      <span className="c">{cents == null ? '' : (cents > 0 ? '+' : cents < 0 ? '−' : '±') + Math.abs(cents) + tr(' ц')}</span>
    </div>
  )
}

export function CentsMeter({ tolerance = 25 }: { tolerance?: number }) {
  useEngine(30)
  const m = engine.current
  const cents = m == null ? 0 : (m - Math.round(m)) * 100
  const pos = Math.max(0, Math.min(100, 50 + cents))
  return (
    <div className="meter" aria-hidden>
      <span className="zone" style={{ left: `${50 - tolerance}%`, width: `${tolerance * 2}%` }} />
      <i style={{ left: pos + '%', opacity: m == null ? 0.25 : 1 }} />
    </div>
  )
}

/** Пауза: свернули приложение или позвонили посреди упражнения */
export function PauseOverlay() {
  useEngine(4)
  const show = engine.interrupted && !!document.documentElement.dataset.focus
  // пока пауза — остальной экран недоступен для клавиатуры и экранного диктора
  useEffect(() => {
    const shell = document.querySelector('.shell')
    if (show) shell?.setAttribute('inert', ''); else shell?.removeAttribute('inert')
    return () => shell?.removeAttribute('inert')
  }, [show])
  if (!show) return null
  return (
    <div className="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className="pause-card">
        <h2 id="pause-title">{tr('Пауза')}</h2>
        <p className="muted">{tr('Упражнение остановилось, пока тебя не было. Продолжим с того же места.')}</p>
        <button className="btn" autoFocus onClick={() => void engine.resume()}>{tr('Продолжить')}</button>
      </div>
    </div>
  )
}

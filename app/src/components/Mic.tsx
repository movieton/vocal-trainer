import { useEffect, useReducer, useRef } from 'react'
import { engine, SIM } from '../lib/audio'
import { noteName } from '../lib/music'

/** Перерисовка компонента при смене состояния движка, не чаще ~12 раз в секунду */
export function useEngine(fps = 12) {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const last = useRef(0)
  useEffect(() => engine.subscribe(() => {
    const t = performance.now()
    if (t - last.current > 1000 / fps) { last.current = t; bump() }
  }), [fps])
}

export function MicGate({ children }: { children?: React.ReactNode }) {
  useEngine(4)
  if (engine.mic === 'on') return <>{children}</>
  return (
    <div className="micgate">
      <div>
        <strong>{engine.mic === 'starting' ? 'Включаю микрофон…' : 'Нужен микрофон'}</strong>
        <p>Звук разбирается прямо в браузере и никуда не отправляется. Лучше всего петь в наушниках.{SIM && import.meta.env.DEV && ' Режим проверки: вместо голоса синтетический тон.'}</p>
        {engine.mic === 'error' && <p className="err">{engine.micError}</p>}
      </div>
      <button className="btn" onClick={() => engine.startMic()} disabled={engine.mic === 'starting'}>Включить микрофон</button>
    </div>
  )
}

export function LiveNote({ big }: { big?: boolean }) {
  useEngine(15)
  if (engine.mic !== 'on') return null
  const m = engine.current
  if (m == null) return null
  const cents = m == null ? null : Math.round((m - Math.round(m)) * 100)
  return (
    <div className={'livenote' + (big ? ' big' : '') + (m == null ? ' silent' : '')}>
      <span className="n">{m == null ? '—' : noteName(m)}</span>
      <span className="c">{cents == null ? '' : (cents > 0 ? '+' : cents < 0 ? '−' : '±') + Math.abs(cents) + ' ц'}</span>
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

import { tr } from '../lib/i18n'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { engine } from '../lib/audio'
import { logSession, useStored } from '../lib/store'
import { randInt } from '../lib/theory'

type Trial = { delta: number; up: boolean }
type Result = { date: number; cents: number }

const START = 100, MIN = 2, REVERSALS = 10

/**
 * Порог различения высоты в центах: адаптивная лестница «2 верно — шаг вниз, 1 ошибка — шаг вверх» (Levitt 1971),
 * сходится к ~71% верных ответов. Немузыканты заметно снижают порог за несколько часов тренировки (Micheyl 2006).
 * Важно: это мера слуха, а не точности пения.
 */
export default function Threshold() {
  const [hist, setHist] = useStored<Result[]>('threshold', [])
  const [state, setState] = useState<{ delta: number; streak: number; dir: 0 | 1 | -1; reversals: number[]; trial: Trial | null; n: number; last: boolean | null } | null>(null)

  const play = (t: Trial) => {
    const ctx = engine.ensureCtx(), at = ctx.currentTime + 0.05
    const base = randInt(55, 67) + Math.random()
    engine.play(base, at, 0.7, 70)
    engine.play(base + (t.up ? 1 : -1) * t.delta / 100, at + 0.9, 0.7, 70)
  }
  const start = () => {
    const trial = { delta: START, up: Math.random() < 0.5 }
    setState({ delta: START, streak: 0, dir: 0, reversals: [], trial, n: 1, last: null }); play(trial)
  }
  const answer = (up: boolean) => {
    if (!state?.trial) return
    const ok = up === state.trial.up
    let { delta, streak, dir } = state
    const reversals = [...state.reversals]
    let move: 0 | 1 | -1 = 0
    if (ok) { streak++; if (streak >= 2) { streak = 0; move = -1 } } else { streak = 0; move = 1 }
    if (move) {
      if (dir && move !== dir) reversals.push(delta)
      dir = move
      delta = move < 0 ? Math.max(MIN, delta * 0.7) : Math.min(300, delta * 1.4)
    }
    if (reversals.length >= REVERSALS) {
      const last = reversals.slice(-6)
      const cents = Math.round(last.reduce((a, x) => a + x, 0) / last.length)
      setHist([{ date: Date.now(), cents }, ...hist].slice(0, 50))
      logSession({ date: Date.now(), kind: 'ear', id: 'threshold', title: tr('Порог слуха: {0} ц', cents), score: Math.max(0, Math.round(100 - cents)) })
      setState(null)
      return
    }
    const trial = { delta, up: Math.random() < 0.5 }
    setState({ delta, streak, dir, reversals, trial, n: state.n + 1, last: ok })
    setTimeout(() => play(trial), 500)
  }

  const best = hist.length ? Math.min(...hist.map(h => h.cents)) : null
  return (
    <div className="page">
      <div className="crumbs"><Link to="/ear">{tr('Слух')}</Link></div>
      <h1>{tr('Порог слуха')}</h1>
      <p className="muted">{tr('Звучат две ноты. Вторая выше или ниже? Разница будет уменьшаться, пока ты не начнёшь ошибаться — так находится твой порог в центах. Проходи раз в месяц и смотри, как он снижается.')}</p>
      <div className="card quiz">
        {!state ? (
          <>
            <button className="btn" onClick={start}>{tr('Начать замер')}</button>
            <p className="muted small">{tr('Около 3–5 минут. Лучше в наушниках и в тишине. Это мера слуха: точность пения тренируется отдельно — пением с обратной связью.')}</p>
          </>
        ) : (
          <>
            <div className="quiz-top">
              <button className="btn ghost" onClick={() => state.trial && play(state.trial)}>{tr('Ещё раз')}</button>
              <span className="status"><span>{tr('Попытка')} <b>{state.n}</b></span>{state.last != null && <span className={state.last ? 'ok-msg' : 'err'}>{state.last ? tr('верно') : tr('мимо')}</span>}</span>
            </div>
            <div className="thr-big"><b>{Math.round(state.delta)} {tr('ц')}</b><span>{tr('текущая разница между нотами')}</span></div>
            <div className="answers two">
              <button className="answer" onClick={() => answer(false)}><ArrowDown size={16} /> {tr('Вторая ниже')}</button>
              <button className="answer" onClick={() => answer(true)}><ArrowUp size={16} /> {tr('Вторая выше')}</button>
            </div>
          </>
        )}
      </div>
      {hist.length > 0 && (
        <div className="card">
          <h2>{tr('Замеры')}</h2>
          <p className="muted small">{tr('Ориентиры: у большинства нетренированных людей — 20–50 центов, у опытных музыкантов — 5–10. Лучший результат:')} <b>{best} {tr('ц')}</b>.</p>
          <ul className="hist">{hist.slice(0, 12).map(h => (
            <li key={h.date}><span className="muted small">{new Date(h.date).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })}</span><b className="res">{h.cents} {tr('ц')}</b></li>
          ))}</ul>
        </div>
      )}
    </div>
  )
}

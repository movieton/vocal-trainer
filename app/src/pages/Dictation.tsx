import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Delete, RotateCcw } from 'lucide-react'
import { engine } from '../lib/audio'
import { logSession, useStored } from '../lib/store'
import { degree, rand, randInt } from '../lib/theory'
import { playCadence, SOLFEGE } from './EarQuiz'

type Task = { key: number; degs: number[] }

/**
 * Мелодический диктант ступенями: каденция задаёт тональность, затем короткая мелодия — запиши её номерами ступеней.
 * Соединяет узнавание ступеней с памятью на мелодию (практика сольфеджио, EarMaster).
 */
export default function Dictation() {
  const [len, setLen] = useStored('dict.len', 3)
  const [stat, setStat] = useStored('dict.stat', { ok: 0, all: 0 })
  const [task, setTask] = useState<Task | null>(null)
  const [ans, setAns] = useState<number[]>([])
  const [done, setDone] = useState<boolean | null>(null)

  const play = (t: Task) => {
    const at = playCadence(t.key, engine.ensureCtx().currentTime + 0.05) + 0.4
    t.degs.forEach((d, i) => engine.play(t.key + degree(d), at + i * 0.6, 0.55, 75))
  }
  const next = () => {
    // мелодия начинается с устоя и движется в основном шагами
    const degs = [rand([0, 2, 4])]
    while (degs.length < len) degs.push(Math.max(0, Math.min(7, degs[degs.length - 1] + rand([-2, -1, -1, 1, 1, 2]))))
    const t = { key: 57 + randInt(0, 7), degs }
    setTask(t); setAns([]); setDone(null); play(t)
  }
  const tap = (d: number) => {
    if (!task || done != null) return
    engine.play(task.key + degree(d), engine.ensureCtx().currentTime, 0.4, 60)
    const a = [...ans, d]
    setAns(a)
    if (a.length === task.degs.length) {
      const ok = a.every((x, i) => x === task.degs[i])
      setDone(ok)
      const s = { ok: stat.ok + (ok ? 1 : 0), all: stat.all + 1 }
      setStat(s)
      if (s.all % 10 === 0) logSession({ date: Date.now(), kind: 'ear', id: 'dictation', title: 'Мелодический диктант', score: Math.round((s.ok / s.all) * 100), reps: s.all })
    }
  }

  return (
    <div className="page">
      <div className="crumbs"><Link to="/ear">Слух</Link></div>
      <h1>Мелодический диктант</h1>
      <p className="muted">Каденция задаёт тональность, затем звучит короткая мелодия. Запиши её ступенями по порядку. Каждая нажатая ступень звучит — можно проверять себя на слух.</p>
      <div className="settings drill-controls">
        <label>Длина <span className="seg">{[3, 4, 5, 6].map(n => <button key={n} aria-pressed={len === n} onClick={() => setLen(n)}>{n} ноты</button>)}</span></label>
      </div>
      <div className="card quiz">
        <div className="quiz-top">
          {!task || done != null ? <button className="btn" onClick={next}>{task ? 'Следующая' : 'Начать'}</button> : null}
          {task && <button className="btn ghost" onClick={() => play(task)}>Ещё раз</button>}
          <span className="status"><span>Верно <b>{stat.ok} / {stat.all}</b></span></span>
        </div>
        {task && (
          <>
            <div className="dict-slots">
              {task.degs.map((d, i) => (
                <span key={i} className={'slot' + (done == null ? '' : ans[i] === d ? ' right' : ' wrong')}>
                  {ans[i] != null ? ans[i] + 1 : '·'}
                  {done != null && ans[i] !== d && <small>{d + 1}</small>}
                </span>
              ))}
              {done == null && ans.length > 0 && <button className="textbtn" onClick={() => setAns(ans.slice(0, -1))} aria-label="Стереть"><Delete size={16} /></button>}
              {done == null && ans.length > 0 && <button className="textbtn" onClick={() => setAns([])} aria-label="Заново"><RotateCcw size={16} /></button>}
            </div>
            {done != null && <p className={'verdict ' + (done ? 'ok-msg' : 'err')}>{done ? 'Верно!' : `Было: ${task.degs.map(d => d + 1).join(' – ')}`}</p>}
            <div className="answers degs">
              {[0, 1, 2, 3, 4, 5, 6, 7].map(d => (
                <button key={d} className="answer" disabled={done != null} onClick={() => tap(d)}>{d + 1}<small>{SOLFEGE[d % 7]}</small></button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

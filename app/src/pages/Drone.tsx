import { tr } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PianoRoll from '../components/PianoRoll'
import KeySelect from '../components/KeySelect'
import { LiveNote, MicGate, useEngine } from '../components/Mic'
import { engine, SIM } from '../lib/audio'
import { noteName } from '../lib/music'
import type { Key, Target } from '../lib/run'
import { logSession, useStored, useWorkRange } from '../lib/store'
import { degree, nearest, pcName, rand, SCALES } from '../lib/theory'

const DEG_NAMES = ['1', '2', '3', '4', '5', '6', '7']
const HOLD = 1.5 // секунд в пределах допуска, чтобы ступень засчиталась
const TOL = 20

/**
 * Пение под дрон: постоянно звучит тоника с квинтой, ты поёшь ступени лада и видишь отклонение в центах.
 * Обратная связь в реальном времени — самое доказанное средство для точности пения (Berglin, Pfordresher & Demorest 2022).
 */
export default function Drone() {
  useEngine(8)
  const work = useWorkRange()
  const [key, setKey] = useStored<Key>('drone.key', 0)
  const [minor, setMinor] = useStored('drone.minor', false)
  const [on, setOn] = useState(false)
  const [task, setTask] = useState<{ deg: number; m: number; t0: number } | null>(null)
  const [score, setScore] = useState({ ok: 0, all: 0 })
  const held = useRef(0)
  const heldCents = useRef<number[]>([])
  // статистика по ступеням: среднее отклонение удержанной ноты, последние 20 попыток на ступень
  const [degStats, setDegStats] = useStored<Record<number, number[]>>('degStats', {})
  const steps: readonly number[] = minor ? SCALES.minor.steps : SCALES.major.steps
  const pc = key === 'auto' ? 0 : key
  const tonic = nearest(pc, work.lo + 4)

  const newTask = (prev?: number) => {
    let d = rand([0, 1, 2, 3, 4, 5, 6, 7])
    if (d === prev) d = (d + 2) % 8
    const m = tonic + degree(d, steps)
    setTask({ deg: d, m, t0: engine.now() }); held.current = 0; heldCents.current = []
  }
  const start = () => { engine.drone(tonic); setOn(true); setScore({ ok: 0, all: 0 }); setTask({ deg: 0, m: tonic, t0: engine.now() }); held.current = 0 }
  const stop = () => {
    engine.drone(null); setOn(false); setTask(null)
    engine.history = []; setTimeout(() => { engine.history = [] }, 500)
    if (score.all) logSession({ date: Date.now(), kind: 'ear', id: 'drone', title: tr('Пение под дрон'), score: Math.round((score.ok / score.all) * 100), reps: score.all })
  }
  useEffect(() => () => engine.drone(null), [])
  useEffect(() => {
    if (on) document.documentElement.dataset.focus = '1'
    else delete document.documentElement.dataset.focus
    return () => { delete document.documentElement.dataset.focus }
  }, [on])

  // засчитываем ступень, если она удержана HOLD секунд в пределах ±TOL центов
  const last = useRef(0)
  useEffect(() => engine.subscribe(() => {
    const now = engine.now(), dt = Math.min(0.1, now - last.current); last.current = now
    if (!task) return
    const m = engine.current
    if (m != null && Math.abs(m - task.m) * 100 <= TOL) { held.current += dt; heldCents.current.push((m - task.m) * 100) }
    if (held.current >= HOLD) {
      engine.click(true)
      const c = heldCents.current, mean = c.reduce((a, x) => a + x, 0) / Math.max(1, c.length), dg = task.deg % 7
      setDegStats({ ...degStats, [dg]: [...(degStats[dg] ?? []), mean].slice(-20) })
      setScore(s => ({ ok: s.ok + 1, all: s.all + 1 }))
      newTask(task.deg)
    } else if (now - task.t0 > 12) { setScore(s => ({ ...s, all: s.all + 1 })); newTask(task.deg) }
  }))

  useEffect(() => {
    if (!SIM) return
    engine.simTarget = () => (task ? task.m + 0.08 : null)
    return () => { engine.simTarget = null }
  }, [task])

  // ближайшая ступень лада и отклонение от неё
  const nearestDeg = (m: number) => {
    let best = { d: 0, c: 999 }
    for (let o = -1; o <= 2; o++) steps.forEach((s, i) => {
      const c = (m - (tonic + s + 12 * o)) * 100
      if (Math.abs(c) < Math.abs(best.c)) best = { d: i, c }
    })
    return best
  }
  const colorFor = (m: number) => {
    const { c } = nearestDeg(m)
    return Math.abs(c) <= 12 ? '--good' : Math.abs(c) <= 30 ? '--near' : '--bad'
  }
  const targets = (): Target[] => (task ? [{ midi: task.m, t0: task.t0, t1: task.t0 + 30, sing: true, rep: 0, syl: DEG_NAMES[task.deg % 7] }] : [])
  const cur = engine.current
  const nd = cur != null ? nearestDeg(cur) : null

  return (
    <div className="page trainer">
      <div className="crumbs"><Link to="/ear">{tr('Слух')}</Link></div>
      <div className="trainer-head">
        <div><h1>{tr('Пение под дрон')}</h1><p className="muted">{tr('Постоянно звучит тоника с квинтой. Пой названную ступень и держи её, пока не засчитается. Так ухо учится слышать каждую ноту относительно тоники.')}</p></div>
        <LiveNote />
      </div>
      <div className="settings drill-controls">
        <label>{tr('Тональность')} <KeySelect value={key} onChange={setKey} disabled={on} /></label>
        <label>{tr('Лад')} <span className="seg">
          <button aria-pressed={!minor} disabled={on} onClick={() => setMinor(false)}>{tr('Мажор')}</button>
          <button aria-pressed={minor} disabled={on} onClick={() => setMinor(true)}>{tr('Минор')}</button>
        </span></label>
      </div>
      <MicGate />
      {engine.mic === 'on' && (
        <div className="toolbar">
          <button className={'btn' + (on ? ' stop' : '')} onClick={on ? stop : start}>{on ? tr('Стоп') : tr('Включить дрон')}</button>
          <span className="status">{score.all > 0 && <span>{tr('Засчитано:')} <b>{score.ok}</b>{score.all > score.ok ? tr(' из {0}', score.all) : ''}</span>}</span>
        </div>
      )}
      <div className="task-big">
        {task ? <>{tr('Спой')} <b>{task.deg === 7 ? tr('8-ю (октаву)') : tr('{0}-ю', DEG_NAMES[task.deg])} {tr('ступень')}</b> — {noteName(task.m)}</>
          : <span className="muted">{tr('Начнём с 1-й ступени —')} {noteName(tonic)}{tr('. Включи дрон и пропой её.')}</span>}
      </div>
      <PianoRoll view={() => { const c = task ? task.m : tonic + 4; return { lo: c - 6, hi: c + 6 } }} rowLabel={m => { const s = ((m - tonic) % 12 + 12) % 12; const i = steps.indexOf(s); return i < 0 ? null : DEG_NAMES[i] }} targets={targets} colorFor={colorFor} tolerance={TOL} windowSec={8} playhead={0.5}
        overlay={() => (nd ? tr('{0} ступень {1}{2} ц', DEG_NAMES[nd.d], nd.c >= 0 ? '+' : '−', Math.abs(Math.round(nd.c))) : on ? tr('Пой') : '')} className="tall" />
      <div className="howto">
        <div><h2>{tr('Как делать')}</h2><ol>
          <li>{tr('Наушники необязательны: дрон низкий и мягкий, микрофон его почти не слышит.')}</li>
          <li>{tr('Сначала просто послушай дрон и пропой тонику — «1».')}</li>
          <li>{tr('Затем держи названную ступень: зелёный — ±12 центов, жёлтый — до 30, красный — мимо. Засчитывается после')} {HOLD} {tr('с в пределах ±')}{TOL} {tr('центов.')}</li>
          <li>{tr('Тоника:')} {pcName(pc)} {minor ? tr('минор') : tr('мажор')}{tr('. Начни с 1, 3, 5, затем добавь остальные.')}</li>
        </ol></div>
      </div>
    </div>
  )
}

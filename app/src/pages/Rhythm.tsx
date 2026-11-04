import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { engine } from '../lib/audio'
import { logSession, useStored } from '../lib/store'
import { rand } from '../lib/theory'

/** Ритмические рисунки на один такт 4/4, доли от 0 до 4 */
const SETS: Record<string, { name: string; patterns: number[][] }> = {
  quarter: { name: 'Четверти', patterns: [[0, 1, 2, 3], [0, 1, 2], [0, 2, 3], [0, 2], [1, 2, 3], [0, 1, 3]] },
  eighth: { name: 'Восьмые', patterns: [[0, 0.5, 1, 2, 3], [0, 1, 1.5, 2, 3], [0, 1, 2, 2.5, 3, 3.5], [0, 0.5, 1, 1.5, 2], [0, 1.5, 2, 3]] },
  sync: { name: 'Синкопы', patterns: [[0, 1.5, 3], [0, 0.5, 1.5, 2.5, 3], [0.5, 1.5, 2, 3], [0, 1.5, 2.5, 3.5], [0, 0.75, 1.5, 2, 3]] },
}
const TOL = 0.12 // секунд: попадание
const ROUNDS = 6

type Round = { pattern: number[]; t0: number; listen: number; tap: number; end: number; taps: number[] }
type Res = { hits: number; total: number; extra: number; avgMs: number }

function grade(r: Round, beat: number): Res {
  const exp = r.pattern.map(b => r.tap + b * beat)
  const used = new Set<number>()
  let hits = 0, err = 0
  for (const e of exp) {
    let best = -1, bd = Infinity
    r.taps.forEach((t, i) => { const d = Math.abs(t - e); if (!used.has(i) && d < bd) { bd = d; best = i } })
    if (best >= 0 && bd <= TOL) { used.add(best); hits++; err += bd }
  }
  return { hits, total: exp.length, extra: r.taps.length - used.size, avgMs: hits ? Math.round((err / hits) * 1000) : 0 }
}

export default function Rhythm() {
  const [set, setSet] = useStored('rh.set', 'quarter')
  const [bpm, setBpm] = useStored('rh.bpm', 80)
  const [round, setRound] = useState<Round | null>(null)
  const [phase, setPhase] = useState<'idle' | 'count' | 'listen' | 'tap'>('idle')
  const [results, setResults] = useState<Res[]>([])
  const [n, setN] = useState(0)
  const cur = useRef<Round | null>(null)
  const timer = useRef(0)
  const resRef = useRef<Res[]>([])
  const beat = 60 / bpm

  const schedule = (i: number, t: number) => {
    const pattern = rand(SETS[set].patterns)
    const bar = 4 * beat
    const r: Round = { pattern, t0: t, listen: t + bar, tap: t + 2 * bar, end: t + 3 * bar, taps: [] }
    // такт отсчёта, такт рисунка, такт для тебя — метроном идёт все три
    for (let k = 0; k < 12; k++) engine.click(k % 4 === 0, t + k * beat)
    for (const b of pattern) engine.play(84, r.listen + b * beat, 0.12, 90)
    cur.current = r; setRound({ ...r }); setN(i)
  }

  const start = () => {
    // иначе пробел «нажмёт» сфокусированную кнопку и остановит упражнение
    ;(document.activeElement as HTMLElement | null)?.blur()
    const ctx = engine.ensureCtx()
    setResults([]); resRef.current = []
    schedule(0, ctx.currentTime + 0.3)
    clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      const r = cur.current
      if (!r) return
      const now = engine.now()
      setPhase(now < r.listen ? 'count' : now < r.tap ? 'listen' : 'tap')
      if (now > r.end + 0.15) {
        cur.current = null
        const all = [...resRef.current, grade(r, beat)]
        resRef.current = all
        setResults(all)
        if (all.length >= ROUNDS) finish(all)
        else schedule(all.length, now + 0.2)
      }
    }, 30)
  }
  const finish = (all: Res[]) => {
    clearInterval(timer.current); cur.current = null; setPhase('idle')
    const score = all.reduce((a, r) => a + Math.max(0, r.hits - r.extra * 0.5) / r.total, 0) / all.length
    logSession({ date: Date.now(), kind: 'ear', id: 'rhythm', title: 'Ритм', score: Math.round(score * 100), reps: all.length })
  }
  const stop = () => { clearInterval(timer.current); cur.current = null; setPhase('idle') }

  const tap = () => {
    const r = cur.current
    if (!r) return
    const t = engine.now()
    if (t >= r.tap - TOL && t <= r.end + TOL) { r.taps.push(t); setRound({ ...r }) }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' && cur.current) { e.preventDefault(); tap() } }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })
  useEffect(() => () => clearInterval(timer.current), [])

  const running = phase !== 'idle'
  const last = results.at(-1)
  const total = results.length ? Math.round(results.reduce((a, r) => a + Math.max(0, r.hits - r.extra * 0.5) / r.total, 0) / results.length * 100) : null

  return (
    <div className="page">
      <div className="crumbs"><Link to="/ear">Слух</Link></div>
      <h1>Ритм</h1>
      <p className="muted">Такт отсчёта, затем звучит ритмический рисунок, а в следующем такте повтори его: нажимай пробел или большую кнопку. Метроном идёт всё время. Попадание — в пределах 120 мс.</p>
      <div className="settings drill-controls">
        <label>Рисунки <span className="seg">{Object.entries(SETS).map(([k, s]) => <button key={k} aria-pressed={set === k} disabled={running} onClick={() => setSet(k)}>{s.name}</button>)}</span></label>
        <label>Темп <span className="seg">{[60, 80, 100].map(b => <button key={b} aria-pressed={bpm === b} disabled={running} onClick={() => setBpm(b)}>{b}</button>)}</span></label>
      </div>
      <div className="card rhythm">
        <div className="rh-head">
          <button className={'btn' + (running ? ' stop' : '')} onClick={running ? stop : start}>{running ? 'Стоп' : 'Начать'}</button>
          <span className="status">
            {running && <span className={'pill' + (phase === 'tap' ? ' on' : '')}>{phase === 'count' ? 'Отсчёт' : phase === 'listen' ? 'Слушай' : 'Твой такт'}</span>}
            {running && <span>Рисунок {n + 1} / {ROUNDS}</span>}
            {last && <span>Прошлый: <b>{last.hits}/{last.total}</b>{last.extra ? `, лишних ${last.extra}` : ''}{last.hits ? `, ±${last.avgMs} мс` : ''}</span>}
          </span>
        </div>
        <Bar round={round} beat={beat} />
        <button className="tapper" onPointerDown={e => { e.preventDefault(); tap() }} disabled={phase !== 'tap'}>
          <b>Тап</b><small>{phase === 'tap' ? 'жми в ритм' : 'или пробел'}</small>
        </button>
        {!running && total != null && <p className="verdict">Итог: <b>{total}%</b> по {results.length} рисункам</p>}
      </div>
    </div>
  )
}

/** Такт: доли, ожидаемые удары (контур) и твои тапы (точки) */
function Bar({ round, beat }: { round: Round | null; beat: number }) {
  if (!round) return <div className="bar4 empty"><span>Здесь появится рисунок</span></div>
  const x = (b: number) => (b / 4) * 100
  return (
    <div className="bar4"><div className="bar4-in">
      {[0, 1, 2, 3].map(b => <i key={b} className="beatline" style={{ left: x(b) + '%' }}><em>{b + 1}</em></i>)}
      {round.pattern.map(b => <span key={b} className="exp" style={{ left: x(b) + '%' }} />)}
      {round.taps.map((t, i) => {
        const b = (t - round.tap) / beat
        const d = Math.min(...round.pattern.map(p => Math.abs(p * beat - (t - round.tap))))
        return <span key={i} className={'tap ' + (d <= 0.06 ? 'good' : d <= TOL ? 'near' : 'bad')} style={{ left: x(Math.max(0, Math.min(4, b))) + '%' }} />
      })}
    </div></div>
  )
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import PianoRoll from './PianoRoll'
import { LiveNote, MicGate, useEngine } from './Mic'
import { engine } from '../lib/audio'
import { PhraseRun, type Phrase } from '../lib/phrase'
import type { Target } from '../lib/run'
import { logSession, useStored, useWorkRange } from '../lib/store'
import { noteName } from '../lib/music'

type Props = {
  id: string
  title: string
  intro: string
  /** Настройки упражнения; блокируются во время пения */
  controls?: (running: boolean) => ReactNode
  /** Создаёт генератор фраз под текущие настройки */
  make: () => (i: number) => Phrase | null
  how?: string[]
  windowSec?: number
  /** Меняется вместе с настройками — по нему пересобирается превью первой фразы */
  settingsKey?: string
  /** Жёстко заданная строгость (уровни точности); тогда переключатель скрыт */
  tolerance?: number
  /** Итог прогона, 0…1 */
  onFinish?: (score: number) => void
  /** Дополнительный блок под заголовком */
  extra?: ReactNode
}

/** Общий экран упражнений на слух с голосом: доска, старт/стоп, итог */
export default function DrillPage({ id, title, intro, controls, make, how, windowSec = 8, settingsKey = '', tolerance, onFinish, extra }: Props) {
  useEngine(4)
  const [storedTol, setTol] = useStored('tolerance', 25)
  const tol = tolerance ?? storedTol
  const [shift, setShift] = useStored('drillShift', 0)
  const wr = useWorkRange()
  const [running, setRunning] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [status, setStatus] = useState<{ n: number; last: number | null }>({ n: 0, last: null })
  const [result, setResult] = useState<{ score: number; reps: number; lines: string[] } | null>(null)
  const run = useRef<PhraseRun | null>(null)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish
  // до старта — приглушённое превью первой фразы, след прошлого голоса стираем
  const preview = useMemo(() => make()(0), [settingsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { engine.history = [] }, [])
  const previewTargets = (): Target[] => {
    if (!preview) return []
    const t = engine.now() + 0.3
    return preview.notes.map(n => ({ midi: n.m + shift, midiEnd: n.mEnd != null ? n.mEnd + shift : undefined, t0: t + n.t, t1: t + n.t + n.d, syl: n.syl, sing: false, rep: 0 }))
  }

  const stop = () => {
    const x = run.current
    if (!x) return
    x.stop(); run.current = null; setRunning(false)
    // затухающий хвост звука успевает попасть в историю — чистим ещё раз чуть позже
    engine.history = []; setTimeout(() => { engine.history = [] }, 500)
    if (x.results.length) {
      const s = x.summary()
      setResult({ ...s, lines: x.results.map(r => `${r.label || 'Фраза'}: ${Math.round(r.score * 100)}%`) })
      logSession({ date: Date.now(), kind: 'ear', id, title, score: Math.round(s.score * 100), reps: s.reps })
      finishRef.current?.(s.score)
    }
  }
  const start = () => {
    setResult(null)
    const x = new PhraseRun(make(), tol)
    x.repeat = repeat
    x.shift = shift
    run.current = x; x.start(); setRunning(true)
  }

  useEffect(() => engine.subscribe(() => {
    const x = run.current
    if (!x) return
    if (x.update(engine.now())) {
      const last = x.results.at(-1)
      setStatus({ n: x.i + 1, last: last ? last.score : null })
      if (x.done) stop()
    }
  }), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (run.current) run.current.repeat = repeat }, [repeat])
  useEffect(() => () => { run.current?.stop() }, [])
  useEffect(() => {
    if (running) document.documentElement.dataset.focus = '1'
    else delete document.documentElement.dataset.focus
    return () => { delete document.documentElement.dataset.focus }
  }, [running])

  // по вертикали — все видимые цели текущей и прошлой фразы с запасом
  const span = useRef({ lo: 52, hi: 64 })
  const view = () => {
    const all = run.current?.targets ?? previewTargets()
    // по текущей фразе: от нижней ноты −2 до верхней +2, не меньше 9 рядов
    const lastRep = Math.max(...all.map(t => t.rep))
    const ts = all.filter(t => t.rep === lastRep)
    if (ts.length) {
      const ms = ts.flatMap(t => [t.midi, t.midiEnd ?? t.midi])
      let lo = Math.min(...ms) - 2, hi = Math.max(...ms) + 2
      const pad = Math.max(0, 8 - (hi - lo))
      lo -= Math.floor(pad / 2); hi += Math.ceil(pad / 2)
      span.current = { lo, hi }
    }
    return span.current
  }
  const overlay = () => {
    const x = run.current
    if (!x) return ''
    const mark = x.mark(engine.now())
    const ph = x.phase === 'sing' ? 'Пой' : 'Слушай'
    return mark && mark !== ph && mark !== 'Повтори' ? `${mark} · ${ph}` : ph
  }

  return (
    <div className="page trainer">
      <div className="crumbs"><Link to="/ear">Слух</Link></div>
      <div className="trainer-head">
        <div><h1>{title}</h1><p className="muted">{intro}</p></div>
        <LiveNote />
      </div>
      {extra}
      <div className="settings drill-controls">
        {controls?.(running)}
        {tolerance == null && <label>Строгость
          <select value={tol} onChange={e => setTol(+e.target.value)} disabled={running}>
            <option value={50}>Мягко, ±50 ц</option><option value={25}>Обычно, ±25 ц</option><option value={12}>Строго, ±12 ц</option>
          </select>
        </label>}
        <label>Высота
          <span className="stepper">
            <button onClick={() => setShift(shift - 12)} disabled={running} aria-label="Октава ниже" title="Октава ниже">«</button>
            <button onClick={() => setShift(shift - 1)} disabled={running} aria-label="Полутон ниже">−</button>
            <span>{shift === 0 ? 'авто' : (shift > 0 ? '+' : '') + shift}</span>
            <button onClick={() => setShift(shift + 1)} disabled={running} aria-label="Полутон выше">+</button>
            <button onClick={() => setShift(shift + 12)} disabled={running} aria-label="Октава выше" title="Октава выше">»</button>
          </span>
        </label>
      </div>
      <p className="muted small">Рабочий диапазон: {noteName(wr.lo)}–{noteName(wr.hi)} ({wr.source}). Слишком высоко или низко — <Link to="/range">смени тип голоса</Link> или сдвинь высоту.</p>
      <MicGate />
      {engine.mic === 'on' && (
        <div className="toolbar">
          <button className={'btn' + (running ? ' stop' : '')} onClick={running ? stop : start}>{running ? 'Стоп' : 'Начать'}</button>
          <label className="chk"><input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} /> Повторять фразу</label>
          <span className="status">
            {running && <span>Фраза {status.n}</span>}
            {status.last != null && <span>Прошлая <b>{Math.round(status.last * 100)}%</b></span>}
          </span>
        </div>
      )}
      <PianoRoll view={view} targets={() => run.current?.targets ?? previewTargets()} tolerance={tol} windowSec={windowSec} playhead={0.25} overlay={overlay} className="tall" />
      <div className="howto">
        {how && <div><h2>Как делать</h2><ol>{how.map(t => <li key={t}>{t}</li>)}</ol></div>}
        {result && (
          <div className="result">
            <h2>Итог: {Math.round(result.score * 100)}%</h2>
            <ol className="plain">{result.lines.slice(-12).map((l, i) => <li key={i}>{l}</li>)}</ol>
          </div>
        )}
      </div>
    </div>
  )
}

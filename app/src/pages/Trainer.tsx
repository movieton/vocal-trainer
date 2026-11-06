import { tr } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PianoRoll from '../components/PianoRoll'
import { LiveNote, MicGate, useEngine } from '../components/Mic'
import { engine } from '../lib/audio'
import { noteName } from '../lib/music'
import { buildRoots, ExerciseRun, type Key, type Mode, type Phase, type Target } from '../lib/run'
import { logSession, useStored, useWorkRange } from '../lib/store'
import { exerciseById, SECTIONS } from '../data/exercises'
import { libExercise } from '../data/library'
import { TakeBar, useTake } from '../components/Take'
import { TEXTS } from '../data/exerciseTexts'
import KeySelect from '../components/KeySelect'

const PHASE: Record<Phase, string> = { idle: '', cue: tr('Тональность…'), listen: tr('Слушай'), inner: tr('Услышь про себя'), breath: tr('Вдох'), sing: tr('Пой'), done: '' }
const MODES: { id: Mode; title: string; text: string }[] = [
  { id: 'together', title: tr('Вместе'), text: tr('Поёшь сразу под пианино') },
  { id: 'call', title: tr('Повтори один'), text: tr('Пианино, затем ты без него') },
  { id: 'echo', title: tr('Повтори с пианино'), text: tr('Пианино, затем снова пианино и ты') },
]
type Summary = ReturnType<ExerciseRun['summary']>

export default function Trainer() {
  const { id = '' } = useParams()
  const ex = exerciseById(id) ?? libExercise(id)
  const [mode, setMode] = useStored<Mode>('mode2', 'together')
  const [tempo, setTempo] = useStored('tempo', 1)
  const [tol, setTol] = useStored('tolerance', 25)
  const [shift, setShift] = useState(0)
  const [key, setKey] = useStored<Key>('exKey', 'auto')
  const [repeat, setRepeat] = useState(false)
  const [inner, setInner] = useStored('exInner', false)
  const [fade, setFade] = useStored('exFade', false)
  const tk = useTake()
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState({ phase: 'idle' as Phase, rep: 0, total: 0, last: null as number | null })
  const [result, setResult] = useState<Summary | null>(null)
  const run = useRef<ExerciseRun | null>(null)
  const r = useWorkRange()
  useEngine(4)

  const stop = () => {
    const cur = run.current
    if (!cur) return
    cur.stop(); run.current = null; setRunning(false)
    void tk.end(cur.all)
    // хвост линии голоса прошлого прогона не должен оставаться на доске
    engine.history = []; setTimeout(() => { engine.history = [] }, 500)
    setStatus(s => ({ ...s, phase: 'idle' }))
    if (cur.results.length && ex) {
      const sum = cur.summary()
      setResult(sum)
      logSession({ date: Date.now(), kind: 'exercise', id: ex.id, title: ex.title, score: Math.round(sum.score * 100), reps: sum.reps, drift: sum.drift })
    }
  }

  const start = () => {
    if (!ex) return
    setResult(null)
    const x = new ExerciseRun(ex, { range: r, mode, tempo, tolerance: tol, shift, key, inner, fade })
    x.repeat = repeat
    tk.stop(); tk.begin()
    run.current = x; x.start(); setRunning(true)
  }

  useEffect(() => engine.subscribe(() => {
    const x = run.current
    if (!x) return
    if (x.update(engine.now())) {
      const last = x.results.at(-1)
      setStatus({ phase: x.phase, rep: x.rep + 1, total: x.roots.length, last: last ? last.score : null })
      if (x.phase === 'done') stop()
    }
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (run.current) run.current.repeat = repeat }, [repeat])
  // режим фокуса: на телефоне во время пения прячем всё, кроме доски
  useEffect(() => {
    if (running) document.documentElement.dataset.focus = '1'
    else delete document.documentElement.dataset.focus
    return () => { delete document.documentElement.dataset.focus }
  }, [running])
  useEffect(() => { engine.history = []; return () => { run.current?.stop() } }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement).closest('input,select,textarea,button')) return
      e.preventDefault()
      if (run.current) stop(); else if (engine.mic === 'on') start()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  if (!ex) return <div className="page"><p>{tr('Упражнение не найдено.')} <Link to="/library">{tr('К списку')}</Link></p></div>
  const texts = TEXTS[ex.id] ?? (ex.how ? { how: ex.how, mistakes: ex.mistakes ?? [] } : null)

  // окно доски по длине фразы: целиком видно «слушай» и «пой» одного круга
  const beat = 60 / (ex.bpm * tempo)
  const phrase = ex.notes.reduce((a, n) => a + n.d, 0) * beat
  const narrow = innerWidth < 500
  const windowSec = Math.max(narrow ? 3 : 4, (mode !== 'together' && !narrow ? phrase * 2 + 3 * beat : phrase + 2 * beat) * 1.25)

  // до старта показываем фразу неподвижно справа от курсора
  const preview = (): Target[] => {
    let t = engine.now() + beat
    const root = buildRoots(ex, r, shift, key)[0]
    return ex.notes.flatMap(n => {
      const g = { midi: root + n.s, midiEnd: n.glide != null ? root + n.glide : undefined, t0: t, t1: t + n.d * beat * (n.stacc ? 0.5 : 1), syl: n.syl, sing: true, rep: 0 }
      t += n.d * beat
      return n.rest ? [] : [g]
    })
  }

  const view = () => {
    if (tk.replay && tk.take?.targets.length) {
      const ms = tk.take.targets.flatMap(t => [t.midi, t.midiEnd ?? t.midi])
      return { lo: Math.min(...ms) - 2, hi: Math.max(Math.max(...ms) + 2, Math.min(...ms) + 9) }
    }
    // доска неподвижна на всё упражнение: охватывает все круги сразу, не прыгает между ними
    const roots = run.current?.roots ?? buildRoots(ex, r, shift, key)
    const notes = ex.notes.filter(n => !n.rest).flatMap(n => [n.s, n.glide ?? n.s])
    const lo = Math.min(...roots) + Math.min(...notes) - 2, hi = Math.max(...roots) + Math.max(...notes) + 2
    return { lo, hi: Math.max(hi, lo + 9) }
  }

  return (
    <div className="page trainer">
      <div className="crumbs"><Link to="/library">{tr('Библиотека')}</Link> / {SECTIONS[ex.section].title}</div>
      <div className="trainer-head">
        <div>
          <h1>{ex.title}</h1>
          <p className="muted">{ex.goal} {tr("· слог «")}{ex.syllable}{tr("» · уровень")}&nbsp;{ex.level}</p>
        </div>
        <LiveNote />
      </div>

      <div className="modes seg" role="radiogroup" aria-label={tr('Режим')}>
        {MODES.map(m => (
          <button key={m.id} role="radio" aria-pressed={mode === m.id} aria-checked={mode === m.id} disabled={running} onClick={() => setMode(m.id)}>
            <b>{m.title}</b><span>{m.text}</span>
          </button>
        ))}
      </div>
      <MicGate />
      {engine.mic === 'on' && (
        <div className="toolbar">
          {tk.playing ? <button className="btn stop" onClick={tk.stop}>{tr('■ Остановить запись')}</button>
            : <button className={'btn' + (running ? ' stop' : '')} onClick={running ? stop : start}>{running ? tr('Стоп') : tr('Начать')}</button>}
          <label className="chk"><input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} /> {tr('Повторять фразу')}</label>
          <span className="status">
            {running && <span>{tr('Круг')} {status.rep} / {status.total}</span>}
            {status.last != null && <span>{tr('Прошлый круг')} <b>{Math.round(status.last * 100)}%</b></span>}
          </span>
        </div>
      )}
      <PianoRoll view={view} targets={() => (tk.replay ? tk.take!.targets : run.current?.targets ?? preview())} replay={tk.replay} tolerance={tol} windowSec={windowSec} playhead={0.2}
        overlay={() => (tk.replay ? tr('Запись') : run.current ? PHASE[run.current.phase] : '')} className="tall" />
      {!running && <TakeBar t={tk} />}

      <div className="settings">
        <label className="chk"><input type="checkbox" checked={inner} disabled={running} onChange={e => setInner(e.target.checked)} /> {tr('Пауза «услышь про себя»')}</label>
        <label className="chk"><input type="checkbox" checked={fade} disabled={running} onChange={e => setFade(e.target.checked)} /> {tr('Подсказка через круг')}</label>
        <label>{tr('Темп')} {Math.round(tempo * 100)}%
          <input type="range" min={0.6} max={1.4} step={0.05} value={tempo} onChange={e => setTempo(+e.target.value)} disabled={running} />
        </label>
        <label>{tr('Строгость')}
          <select value={tol} onChange={e => setTol(+e.target.value)} disabled={running}>
            <option value={50}>{tr('Мягко, ±50 ц')}</option>
            <option value={25}>{tr('Обычно, ±25 ц')}</option>
            <option value={12}>{tr('Строго, ±12 ц')}</option>
          </select>
        </label>
        <label>{tr('Тональность')}
          <KeySelect value={key} onChange={setKey} disabled={running} />
        </label>
        <label>{tr('Сдвиг высоты')}
          <span className="stepper">
            <button onClick={() => setShift(shift - 12)} disabled={running} aria-label={tr('Октава ниже')} title={tr('Октава ниже')}>«</button>
            <button onClick={() => setShift(shift - 1)} disabled={running} aria-label={tr('Ниже')}>−</button>
            <span>{shift === 0 ? tr('авто') : (shift > 0 ? '+' : '') + shift}</span>
            <button onClick={() => setShift(shift + 1)} disabled={running} aria-label={tr('Выше')}>+</button>
            <button onClick={() => setShift(shift + 12)} disabled={running} aria-label={tr('Октава выше')} title={tr('Октава выше')}>»</button>
          </span>
        </label>
      </div>
      <p className="muted small">{tr('Рабочий диапазон:')} {noteName(r.lo)}–{noteName(r.hi)} ({r.source}) · <Link to="/range">{tr('изменить')}</Link> {tr('· Пробел — старт и стоп')}</p>

      {texts && (
        <div className="howto">
          <div><h2>{tr('Как делать')}</h2><ol>{texts.how.map(t => <li key={t}>{t}</li>)}</ol></div>
          {texts.mistakes.length > 0 && <div><h2>{tr('Частые ошибки')}</h2><ul>{texts.mistakes.map(t => <li key={t}>{t}</li>)}</ul></div>}
        </div>
      )}

      {result && (
        <div className="card result">
          <h2>{tr('Итог:')} {Math.round(result.score * 100)}%</h2>
          <p className="muted">{tr('Кругов:')} {result.reps}</p>
          {result.drift.length ? (
            <>
              <strong>{tr('Где уходишь от ноты')}</strong>
              <ul>{result.drift.map(d => (
                <li key={d.m}>{noteName(d.m)}: {d.c > 0 ? '+' : '−'}{Math.round(Math.abs(d.c))} {tr('ц,')} {d.c > 0 ? tr('завышаешь') : tr('занижаешь')}</li>
              ))}</ul>
            </>
          ) : <p>{tr('Устойчивых ошибок нет, интонация ровная.')}</p>}
        </div>
      )}
    </div>
  )
}

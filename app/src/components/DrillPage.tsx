import Delta from './Delta'
import LatencySelect from './Latency'
import { setFocus } from '../lib/focus'
import { tr } from '../lib/i18n'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import PianoRoll from './PianoRoll'
import { LiveNote, MicGate, useEngine } from './Mic'
import { engine } from '../lib/audio'
import { PhraseRun, type Phrase } from '../lib/phrase'
import type { Target } from '../lib/run'
import { TakeBar, useTake } from './Take'
import { logSession, read, useStored, useWorkRange, write } from '../lib/store'
import { noteName } from '../lib/music'

type Props = {
  /** Хлебная крошка; по умолчанию — «Слух» */
  back?: { to: string; label: string }
  /** Слоги — текст песни */
  lyrics?: boolean
  /** Неподвижная доска на всё упражнение (без сдвига высоты) */
  span?: { lo: number; hi: number }
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
export default function DrillPage({ back = { to: "/ear", label: tr('Слух') }, id, title, intro, controls, make, how, windowSec = 8, settingsKey = '', tolerance, onFinish, extra, lyrics, span: fixed }: Props) {
  useEngine(4)
  const [storedTol, setTol] = useStored('tolerance', 25)
  const tol = tolerance ?? storedTol
  const [shift, setShift] = useStored('drillShift', 0)
  const wr = useWorkRange()
  const [running, setRunning] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [hint, setHint] = useStored<0 | 1 | 2>('drill.hint.' + id, 0)
  const today = new Date().toDateString()
  const [passed] = useStored<{ day: string; lv: Record<string, number> }>('drill.passed', { day: '', lv: {} })
  const passedLv = passed.day === today ? passed.lv[id] ?? -1 : -1
  const [force, setForce] = useState(false)
  const open = (lv: number) => force || lv <= passedLv + 1
  // вчерашний сложный режим сегодня снова закрыт — работаем в самом сложном открытом
  const hintNow = (open(hint) ? hint : Math.max(0, Math.min(2, passedLv + 1))) as 0 | 1 | 2
  const [status, setStatus] = useState<{ n: number; last: number | null }>({ n: 0, last: null })
  const [result, setResult] = useState<{ score: number; reps: number; lines: string[]; hit: number; total: number; out: boolean; hint: number; opened?: boolean; prev?: number | null } | null>(null)
  const [saved, setSaved] = useState(true)
  const run = useRef<PhraseRun | null>(null)
  const tk = useTake()
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish
  // до старта — приглушённое превью первой фразы, след прошлого голоса стираем
  const preview = useMemo(() => make()(0), [settingsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { engine.history = [] }, [])
  const previewTargets = (): Target[] => {
    if (!preview) return []
    const t = engine.now() + 0.3
    return preview.notes.filter(n => !n.hidden).map(n => ({ midi: n.m + shift, midiEnd: n.mEnd != null ? n.mEnd + shift : undefined, t0: t + n.t, t1: t + n.t + n.d, syl: n.syl, sing: false, rep: 0 }))
  }

  const stop = () => {
    const x = run.current
    if (!x) return
    x.stop(); run.current = null; setRunning(false)
    void tk.end(x.all)
    // затухающий хвост звука успевает попасть в историю — чистим ещё раз чуть позже
    engine.history = []; setTimeout(() => { engine.history = [] }, 500)
    if (x.results.length) {
      const s = x.summary()
      const notes = x.results.flatMap(r => r.notes)
      const before = read<{ id: string; score: number }[]>('log', []).find(l => l.id === id)
      const out = x.hint > 0 && x.misses >= PhraseRun.MAX_MISSES
      const ok = logSession({ date: Date.now(), kind: 'ear', id, title, score: Math.round(s.score * 100), reps: s.reps, hits: notes.filter(n => n.score >= 0.5).length }, { voicedFrames: s.voiced })
      setSaved(ok)
      setResult({ ...s, hit: notes.filter(n => n.score >= 0.5).length, total: notes.length, out, hint: x.hint, prev: before ? before.score : null, lines: x.results.map(r => `${r.label || tr('Фраза')}: ${Math.round(r.score * 100)}%`) })
      // режим сдан на 70% — сегодня открывается следующий
      // (stop вызывается и из подписки на движок — читаем свежие данные, а не замыкание)
      // тишина не открывает следующий режим и не обновляет рекорд
      if (ok) {
        const d = new Date().toDateString(), cur = read<{ day: string; lv: Record<string, number> }>('drill.passed', { day: '', lv: {} })
        const lv = cur.day === d ? cur.lv : {}
        const opened = s.score >= 0.7 && !out && x.hint > (lv[id] ?? -1) && x.hint < 2
        if (s.score >= 0.7 && !out && x.hint > (lv[id] ?? -1)) write('drill.passed', { day: d, lv: { ...lv, [id]: x.hint } })
        setResult(r => (r ? { ...r, opened } : r))
        finishRef.current?.(s.score)
      }
    }
  }
  const start = () => {
    setResult(null)
    setSaved(true)
    const x = new PhraseRun(make(), tol)
    x.repeat = repeat
    x.shift = shift
    x.hint = hintNow
    tk.stop(); tk.begin()
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
    setFocus(running)
    return () => setFocus(false)
  }, [running])

  // по вертикали — все видимые цели текущей и прошлой фразы с запасом
  const span = useRef({ lo: 52, hi: 64 })
  const started = useRef(false)
  const view = () => {
    if (fixed && !tk.replay) return { lo: fixed.lo + shift - 2, hi: Math.max(fixed.hi + shift + 2, fixed.lo + shift + 7) }
    const all = tk.replay ? tk.take!.targets : run.current?.targets ?? previewTargets()
    // по текущей фразе: от нижней ноты −2 до верхней +2, не меньше 9 рядов
    const lastRep = Math.max(...all.map(t => t.rep))
    const ts = all.filter(t => t.rep === lastRep)
    if (ts.length) {
      const ms = ts.flatMap(t => [t.midi, t.midiEnd ?? t.midi])
      let lo = Math.min(...ms) - 2, hi = Math.max(...ms) + 2
      const pad = Math.max(0, 8 - (hi - lo))
      lo -= Math.floor(pad / 2); hi += Math.ceil(pad / 2)
      // доска только расширяется под новые фразы (до двух октав) — не прыгает туда-сюда
      const cur = span.current, wide = { lo: Math.min(cur.lo, lo), hi: Math.max(cur.hi, hi) }
      span.current = wide.hi - wide.lo <= 24 && started.current ? wide : { lo, hi }
      started.current = true
    }
    return span.current
  }
  const overlay = () => {
    const x = run.current
    if (tk.replay) return tr('Запись')
    if (!x) return ''
    const mark = x.mark(engine.now())
    const ph = x.phase === 'sing' ? tr('Пой') : x.phase === 'count' ? tr('Приготовься… {0}', x.count) : tr('Слушай')
    return mark && mark !== ph && mark !== tr('Повтори') ? `${mark} · ${ph}` : ph
  }

  return (
    <div className="page trainer">
      <div className="crumbs"><Link to={back.to}>{back.label}</Link></div>
      <div className="trainer-head">
        <div><h1>{title}</h1><p className="muted">{intro}</p></div>
        <LiveNote />
      </div>
      {extra}
      {controls && <div className="settings drill-controls">{controls(running)}</div>}
      <div className="hint-modes">
        <span className="muted small" id="hint-lbl">{tr('Подсказка')}</span>
        <div className="seg" role="group" aria-labelledby="hint-lbl">
          {[tr('Пианино'), tr('Метроном'), tr('Тишина')].map((t, lv) => (
            <button key={lv} aria-pressed={hintNow === lv} disabled={running || !open(lv)} onClick={() => setHint(lv as 0 | 1 | 2)}>
              {!open(lv) && <Lock size={12} aria-hidden />} {t}
            </button>
          ))}
        </div>
        <span className="muted small hint-note">
          {hintNow === 1 ? tr('Мелодию слышишь в показе, при пении — только щелчки. Три промаха — конец захода.')
            : hintNow === 2 ? tr('Только первая нота, твои ноты проявляются после пения. Три промаха — конец захода.')
            : !open(1) ? <>{tr('Набери 70%, и откроется режим без пианино.')} <button className="linkbtn" onClick={() => setForce(true)}>{tr('Открыть сразу')}</button></>
            : tr('Пианино ведёт мелодию вместе с тобой.')}
        </span>
      </div>
      {how && <details className="howto-mini"><summary>{tr('Как делать')}</summary><ol>{how.map(t => <li key={t}>{t}</li>)}</ol></details>}
      <MicGate />
      {engine.mic === 'on' && (
        <div className="toolbar">
          {tk.playing ? <button className="btn stop" onClick={tk.stop}>{tr('■ Остановить запись')}</button>
            : <button className={'btn' + (running ? ' stop' : '')} onClick={running ? stop : start}>{running ? tr('Стоп') : tr('Начать')}</button>}
          <label className="chk"><input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} /> {tr('Повторять фразу')}</label>
          <span className="status">
            {running && <span>{tr('Фраза')} {status.n}</span>}
            {status.last != null && <span>{tr('Последняя фраза')} <b>{Math.round(status.last * 100)}%</b></span>}
          </span>
        </div>
      )}
      <PianoRoll view={view} targets={() => (tk.replay ? tk.take!.targets : run.current?.targets ?? previewTargets())} replay={tk.replay} tolerance={tol} windowSec={windowSec} playhead={0.25} overlay={overlay} className="tall" lyrics={lyrics} />
      {!running && <TakeBar t={tk} />}
      <details className="settings-wrap" open={typeof matchMedia !== 'undefined' && matchMedia('(min-width: 761px)').matches}>
      <summary>{tr('Настройки: строгость, наушники, высота')}</summary>
      <div className="settings drill-controls">
        {tolerance == null && <label>{tr('Строгость')}
          <select value={tol} onChange={e => setTol(+e.target.value)} disabled={running}>
            <option value={50}>{tr('Мягко, ±50 ц')}</option><option value={25}>{tr('Обычно, ±25 ц')}</option><option value={12}>{tr('Строго, ±12 ц')}</option>
          </select>
        </label>}
        <LatencySelect disabled={running} />
        <label>{tr('Высота')}
          <span className="stepper">
            <button onClick={() => setShift(shift - 12)} disabled={running} aria-label={tr('Октава ниже')} title={tr('Октава ниже')}>«</button>
            <button onClick={() => setShift(shift - 1)} disabled={running} aria-label={tr('Полутон ниже')}>−</button>
            <span>{shift === 0 ? tr('авто') : (shift > 0 ? '+' : '') + shift}</span>
            <button onClick={() => setShift(shift + 1)} disabled={running} aria-label={tr('Полутон выше')}>+</button>
            <button onClick={() => setShift(shift + 12)} disabled={running} aria-label={tr('Октава выше')} title={tr('Октава выше')}>»</button>
          </span>
        </label>
      </div>
      <p className="muted small">{tr('Рабочий диапазон:')} {noteName(wr.lo)}–{noteName(wr.hi)} ({wr.source}{tr('). Слишком высоко или низко —')} <Link to="/range">{tr('смени тип голоса')}</Link> {tr('или сдвинь высоту.')}</p>
      </details>
      <div className="howto">
        {result && (
          <div className="result">
            <h2>{tr('Итог:')} {Math.round(result.score * 100)}%</h2>
            {!saved && <p className="muted">{tr('Без голоса занятие не считается и не попадает в историю.')}</p>}
            {result.prev != null && <Delta now={Math.round(result.score * 100)} prev={result.prev} />}
            <p className="muted">{tr('Попал нот: {0} из {1}', result.hit, result.total)}{result.hint ? ' · ' + [tr('пианино'), tr('метроном'), tr('тишина')][result.hint] : ''}</p>
            {result.out && <p className="muted small">{tr('Три промаха — заход окончен. Вернись к подсказке ступенью ниже или сбавь строгость.')}</p>}
            {result.opened && <p className="ok-msg small">{tr('Сдано — следующий режим открыт на сегодня.')}</p>}
            <ol className="plain">{result.lines.slice(-12).map((l, i) => <li key={i}>{l}</li>)}</ol>
          </div>
        )}
      </div>
    </div>
  )
}

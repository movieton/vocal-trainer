import { tr } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PianoRoll from '../components/PianoRoll'
import { LiveNote, MicGate, useEngine } from '../components/Mic'
import { engine, micBlockText, SIM } from '../lib/audio'
import { analyzeTone, noteName } from '../lib/music'
import { countsAsPractice, logSession, read, useStored, useWorkRange, write } from '../lib/store'

/** Замеры вибрато для сравнения с прошлым разом */
type VibLog = { date: number; rate: number; extent: number; reg: number }
import type { Target } from '../lib/run'

const TOL = 15

/** Длинная нота: держишь выбранную ноту до конца выдоха, меряем время и стабильность */
/** presets — ноты на выбор (полутоны от «до» рабочей октавы), id — ключ рекорда */
export default function LongNote({ presets, id = 'long-note', noGate }: { presets?: number[]; id?: string; noGate?: boolean } = {}) {
  useEngine(8)
  const r = useWorkRange()
  // «до» рабочей октавы: для мужских голосов малая, для женских первая
  const base = r.lo < 52 ? 48 : 60
  const [params] = useSearchParams()
  const fromPlan = Number(params.get('note')) || null
  const [note, setNote] = useState(presets ? base + presets[0] : fromPlan ?? Math.round((r.lo + r.hi) / 2) - 2)
  const bestKey = presets ? `${id}:${note}` : id
  const [best, setBest] = useStored<Record<string, number>>('breathBest', {})
  const [res, setRes] = useState<{ sec: number; stable: number; tone: ReturnType<typeof analyzeTone>; prev: VibLog | null } | null>(null)
  const st = useRef<{ phase: 'idle' | 'wait' | 'sing'; t0: number; frames: number; good: number; silence: number }>({ phase: 'idle', t0: 0, frames: 0, good: 0, silence: 0 })
  const target = useRef<Target | null>(null)

  useEffect(() => engine.subscribe(() => {
    const s = st.current, now = engine.now(), m = engine.current
    if (s.phase === 'wait' && m != null && Math.abs(m - note) < 1) { s.phase = 'sing'; s.t0 = now }
    if (s.phase !== 'sing') return
    if (target.current) target.current.t1 = now + 3
    if (m == null) {
      s.silence++
      // полсекунды тишины — нота закончилась
      if (s.silence > 30) finish()
      return
    }
    s.silence = 0; s.frames++
    if (Math.abs(m - note) * 100 <= TOL) s.good++
  }))

  useEffect(() => {
    if (!SIM) return
    engine.simTarget = t => {
      const s = st.current
      if (s.phase === 'idle') return null
      const el = s.phase === 'sing' ? t - s.t0 : 0
      return el > 9 ? null : note - 0.002 * el * el + 0.3 * Math.sin(t * 2 * Math.PI * 5.5)
    }
    return () => { engine.simTarget = null }
  }, [note])

  const start = () => {
    const now = engine.ensureCtx().currentTime
    engine.play(note, now, 1.2, 70)
    target.current = { midi: note, t0: now + 1.2, t1: now + 4, sing: true, rep: 0 }
    st.current = { phase: 'wait', t0: 0, frames: 0, good: 0, silence: 0 }
    setRes(null)
  }
  function finish() {
    const s = st.current
    const frames = s.frames
    const sang = s.phase === 'sing' && countsAsPractice(frames)
    const sec = sang ? Math.max(0, engine.now() - s.t0 - 0.5) : 0
    const t0 = s.t0
    s.phase = 'idle'
    // стоп в тишине: нет рекорда, истории и серии (t0 ещё 0 — длительность была бы ложной)
    if (!sang) { setRes(null); return }
    const now = engine.now()
    const stable = frames ? s.good / frames : 0
    const tone = analyzeTone(engine.history.filter(h => h.t >= t0 && h.t <= now), note, TOL)
    const prev = read<VibLog[]>('vib.log', [])[0] ?? null
    setRes({ sec, stable: tone?.inTune ?? stable, tone, prev })
    if (tone?.vibrato) write('vib.log', [{ date: Date.now(), rate: tone.rate, extent: tone.extent, reg: tone.regularity }, ...read<VibLog[]>('vib.log', [])].slice(0, 30))
    if (sec > (best[bestKey] ?? 0)) setBest({ ...best, [bestKey]: sec })
    logSession({ date: Date.now(), kind: 'breath', id, title: presets ? tr('Длинная нота {0}', noteName(note)) : tr('Длинная нота'), score: Math.round((tone?.inTune ?? stable) * 100) }, { voicedFrames: frames })
  }

  const phase = st.current.phase
  const block = micBlockText(engine.mic, engine.micErrorKind, engine.audioSuspended, engine.micError)
  const startLabel = phase === 'idle' ? tr('Начать') : phase === 'wait' ? tr('Пой ноту…') : tr('Стоп')
  return (
    <>
      {!noGate && <MicGate />}
      <div className="toolbar">
        {presets ? <span className="seg">{presets.map(p => <button key={p} aria-pressed={note === base + p} disabled={phase !== 'idle'} onClick={() => setNote(base + p)}>{noteName(base + p)}</button>)}</span> :
        <span className="stepper">
          <button onClick={() => setNote(note - 1)} disabled={phase !== 'idle'} aria-label={tr('Ниже')}>−</button>
          <span>{noteName(note)}</span>
          <button onClick={() => setNote(note + 1)} disabled={phase !== 'idle'} aria-label={tr('Выше')}>+</button>
        </span>}
        <button className={'btn' + (phase !== 'idle' ? ' stop' : '')} disabled={engine.mic !== 'on'}
          title={block ?? undefined}
          aria-label={block ? `${startLabel}. ${block}` : undefined}
          onClick={phase === 'idle' ? start : finish}>{startLabel}</button>
        {block && <span className="muted small" aria-hidden>{block}</span>}
        <span className="status">
          {phase === 'sing' && <span>{tr('Держишь')} <b>{(engine.now() - st.current.t0).toFixed(1)} {tr('с')}</b></span>}
          <span>{best[bestKey] ? <>{tr('Рекорд')} <b>{best[bestKey].toFixed(1)} {tr('с')}</b></> : tr('Рекорда пока нет')}</span>
        </span>
        <LiveNote />
      </div>
      <PianoRoll view={() => ({ lo: note - 5, hi: note + 5 })} targets={() => (target.current ? [target.current] : [])} tolerance={TOL} windowSec={10} playhead={0.7} neutral />
      {res && (
        <div className="card result">
          <h2>{res.sec.toFixed(1)} {tr('с · стабильность')} {Math.round(res.stable * 100)}%</h2>
          {res.tone && (
            <div className="tone-stats">
              <div><b>±{Math.round(res.tone.sd)} {tr('ц')}</b><span>{tr('разброс высоты')}</span></div>
              <div><b>{res.tone.vibrato ? res.tone.rate.toFixed(1) + tr(' Гц') : '—'}</b><span>{tr('частота вибрато')}</span></div>
              <div><b>{res.tone.vibrato ? '±' + Math.round(res.tone.extent) + tr(' ц') : '—'}</b><span>{tr('размах вибрато')}</span></div>
              <div><b>{res.tone.vibrato ? Math.round(res.tone.regularity * 100) + '%' : '—'}</b><span>{tr('ровность вибрато')}{res.tone.vibrato && res.prev ? tr(' · в прошлый раз {0}%', Math.round(res.prev.reg * 100)) : ''}</span></div>
            </div>
          )}
          <p className="muted">{tr('Стабильность — доля времени, когда центр звука (без учёта вибрато) в пределах ±')}{TOL} {tr('центов от ноты.')} {res.stable < 0.6 ? tr('Нота гуляет: попробуй тише и ровнее, с опорой на выдохе.') : tr('Хорошая ровная нота.')}{res.tone?.vibrato ? tr(' Вибрато {0}.', res.tone.rate < 4.5 ? tr('медленное — может звучать как «качание»') : res.tone.rate > 6.5 ? tr('частое — похоже на дрожание, часто от зажима') : tr('в обычной для певцов норме (4,5–6,5 Гц)')) + ' ' + tr('С тренировкой растёт прежде всего ровность колебаний, а не их размах.') : ''}</p>
        </div>
      )}
    </>
  )
}

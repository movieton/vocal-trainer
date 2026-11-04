import { useState } from 'react'
import { Link } from 'react-router-dom'
import { engine } from '../lib/audio'
import { INTERVALS, noteName } from '../lib/music'
import { logSession, useStored } from '../lib/store'
import { CHORDS, degree, nearest, randInt, type ChordQ } from '../lib/theory'

type Option = { id: string; label: string }
/** after — звук после ответа (например, разрешение ступени в тонику) */
type Question = { answer: string; play: () => void; reveal: string; after?: () => void }

/** Общий экран «узнай на слух»: кнопка «Послушать», варианты ответа, счёт и серия */
type Stats = Record<string, { ok: number; all: number }>

/**
 * Взвешенный выбор: чаще то, где ошибаешься, и то, что давно не встречалось.
 * Интервальные повторения и перемешивание дают более прочное обучение (Cepeda 2006; Rohrer & Taylor 2007).
 */
function weightedPick(ids: string[], stats: Stats) {
  const w = ids.map(id => { const s = stats[id]; return s && s.all >= 3 ? 0.3 + 2.5 * (1 - s.ok / s.all) : 1.5 })
  let r = Math.random() * w.reduce((a, x) => a + x, 0)
  for (let i = 0; i < ids.length; i++) { r -= w[i]; if (r <= 0) return ids[i] }
  return ids[ids.length - 1]
}

function Quiz({ id, family, title, intro, options, make, controls }: {
  id: string; family: string; title: string; intro: string; options: Option[]; make: (pick: (ids: string[]) => string) => Question; controls?: React.ReactNode
}) {
  const [q, setQ] = useState<Question | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [stat, setStat] = useState({ ok: 0, all: 0, streak: 0 })
  const [best, setBest] = useStored<Record<string, number>>('quizBest', {})

  const [stats, setStats] = useStored<Stats>('qs:' + family, {})
  const next = () => { const n = make(ids => weightedPick(ids, stats)); setQ(n); setPicked(null); n.play() }
  const pick = (opt: string) => {
    if (!q || picked) return
    setPicked(opt)
    q.after?.()
    const ok = opt === q.answer
    const s = { ok: stat.ok + (ok ? 1 : 0), all: stat.all + 1, streak: ok ? stat.streak + 1 : 0 }
    setStat(s)
    const cur = stats[q.answer] ?? { ok: 0, all: 0 }
    setStats({ ...stats, [q.answer]: { ok: cur.ok + (ok ? 1 : 0), all: cur.all + 1 } })
    if (s.streak > (best[id] ?? 0)) setBest({ ...best, [id]: s.streak })
    if (s.all % 10 === 0) logSession({ date: Date.now(), kind: 'ear', id, title, score: Math.round((s.ok / s.all) * 100), reps: s.all })
  }

  return (
    <div className="page">
      <div className="crumbs"><Link to="/ear">Слух</Link></div>
      <h1>{title}</h1>
      <p className="muted">{intro}</p>
      {controls && <div className="settings drill-controls">{controls}</div>}
      <div className="card quiz">
        <div className="quiz-top">
          {!q ? <button className="btn" onClick={next}>Начать</button> : <>
            <button className="btn ghost" onClick={() => q.play()}>Ещё раз</button>
            {picked && <button className="btn" onClick={next}>Дальше</button>}
          </>}
          <span className="status">
            <span>Верно <b>{stat.ok} / {stat.all}</b></span>
            <span>Серия <b>{stat.streak}</b></span>
            <span>Рекорд <b>{best[id] ?? 0}</b></span>
          </span>
        </div>
        {picked && q && <p className={'verdict ' + (picked === q.answer ? 'ok-msg' : 'err')}>{picked === q.answer ? 'Верно — ' : 'Мимо — это '}{q.reveal}</p>}
        {q && (
          <div className="answers">
            {options.map(o => {
              const cls = !picked ? '' : o.id === q.answer ? 'right' : o.id === picked ? 'wrong' : 'dim'
              return <button key={o.id} className={'answer ' + cls} onClick={() => pick(o.id)} disabled={!!picked}>{o.label}</button>
            })}
          </div>
        )}
        <WeakSpots stats={stats} options={options} />
      </div>
    </div>
  )
}

const now = () => engine.ensureCtx().currentTime + 0.05

export function IntervalQuiz() {
  const [set, setSet] = useStored('iq.set', 'easy')
  const [mode, setMode] = useStored<'up' | 'down' | 'harm'>('iq.mode', 'up')
  const pool = set === 'easy' ? [2, 4, 5, 7, 12] : set === 'mid' ? [2, 3, 4, 5, 7, 8, 9, 12] : [...Array(12).keys()].map(i => i + 1)
  const options = pool.map(st => ({ id: String(st), label: INTERVALS[st - 1].name }))
  const make = (pick: (ids: string[]) => string): Question => {
    const st = +pick(pool.map(String)), root = randInt(52, 64), to = mode === 'down' ? root - st : root + st
    return {
      answer: String(st),
      reveal: `${INTERVALS[st - 1].name}: ${noteName(root)} → ${noteName(to)}`,
      play: () => {
        const t = now()
        engine.play(root, t, 0.9, 70)
        engine.play(to, mode === 'harm' ? t : t + 0.9, 0.9, 70)
      },
    }
  }
  return (
    <Quiz id={`iq-${set}-${mode}`} family={`iq-${mode}`} title="Узнай интервал" options={options} make={make}
      intro="Звучат две ноты, выбери расстояние между ними. Мелодический интервал — ноты по очереди, гармонический — вместе."
      controls={<>
        <label>Набор <span className="seg">{[['easy', 'Лёгкие'], ['mid', 'Средние'], ['all', 'Все 12']].map(([v, t]) => <button key={v} aria-pressed={set === v} onClick={() => setSet(v)}>{t}</button>)}</span></label>
        <label>Как звучат <span className="seg">{([['up', 'Вверх'], ['down', 'Вниз'], ['harm', 'Вместе']] as const).map(([v, t]) => <button key={v} aria-pressed={mode === v} onClick={() => setMode(v)}>{t}</button>)}</span></label>
      </>} />
  )
}

const CHORD_SETS: Record<string, ChordQ[]> = { basic: ['maj', 'min'], triads: ['maj', 'min', 'dim', 'aug'], sevenths: ['maj7', 'min7', 'dom7', 'm7b5'] }

export function ChordQuiz() {
  const [set, setSet] = useStored('cq.set', 'basic')
  const [arp, setArp] = useStored('cq.arp', false)
  const pool = CHORD_SETS[set]
  const options = pool.map(q => ({ id: q, label: CHORDS[q].name }))
  const make = (pick: (ids: string[]) => string): Question => {
    const q = pick(pool) as ChordQ, root = randInt(48, 60)
    return {
      answer: q,
      reveal: `${noteName(root)} ${CHORDS[q].name}`,
      play: () => {
        const t = now()
        CHORDS[q].iv.forEach((x, k) => engine.play(root + x, arp ? t + k * 0.35 : t, arp ? 1.6 - k * 0.35 : 1.6, 60))
      },
    }
  }
  return (
    <Quiz id={`cq-${set}`} family="cq" title="Узнай аккорд" options={options} make={make}
      intro="Звучит аккорд — определи его вид. Мажор звучит светло, минор — грустно, уменьшённый — тревожно, увеличенный — «подвешенно»."
      controls={<>
        <label>Набор <span className="seg">{[['basic', 'Мажор / минор'], ['triads', 'Все трезвучия'], ['sevenths', 'Септаккорды']].map(([v, t]) => <button key={v} aria-pressed={set === v} onClick={() => setSet(v)}>{t}</button>)}</span></label>
        <label className="chk"><input type="checkbox" checked={arp} onChange={e => setArp(e.target.checked)} /> Играть по нотам (арпеджио)</label>
      </>} />
  )
}

function WeakSpots({ stats, options }: { stats: Stats; options: Option[] }) {
  const rows = options.map(o => ({ o, s: stats[o.id] })).filter(x => x.s && x.s.all >= 3)
    .map(x => ({ ...x, acc: x.s!.ok / x.s!.all })).sort((a, b) => a.acc - b.acc).slice(0, 4)
  if (!rows.length) return null
  return (
    <p className="muted small weak">Слабые места — встречаются чаще: {rows.map(r => `${r.o.label} ${Math.round(r.acc * 100)}%`).join(' · ')}</p>
  )
}

// ---------- Функциональный слух: ступени после каденции ----------

export const SOLFEGE = ['до', 'ре', 'ми', 'фа', 'соль', 'ля', 'си']
const DEG_SETS: Record<string, number[]> = { triad: [0, 2, 4], penta: [0, 1, 2, 4, 5], all: [0, 1, 2, 3, 4, 5, 6] }

/** Каденция I–IV–V–I задаёт тональность; дальше ухо слышит ноту как ступень, а не как абсолютную высоту */
export function playCadence(key: number, t: number, beat = 0.55) {
  ;[[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]].forEach((ch, i) => {
    ch.forEach(x => engine.play(key - 12 + x, t + i * beat, beat * 0.95, 48))
    engine.play(key - 24 + ch[0], t + i * beat, beat * 0.95, 55)
  })
  return t + 4 * beat
}

/** Разрешение ступени в тонику по ступеням вниз/вверх — так делает Functional Ear Trainer */
function resolution(d: number) {
  if (d <= 3) return Array.from({ length: d + 1 }, (_, i) => d - i)
  return [...Array.from({ length: 7 - d }, (_, i) => d + i), 7]
}

export function FunctionalQuiz() {
  const [set, setSet] = useStored('fq.set', 'triad')
  const pool = DEG_SETS[set]
  const options = pool.map(d => ({ id: String(d), label: `${d + 1} · ${SOLFEGE[d]}` }))
  const make = (pick: (ids: string[]) => string): Question => {
    const d = +pick(pool.map(String)), key = 48 + randInt(0, 11), m = nearest(key + degree(d), 62)
    return {
      answer: String(d),
      reveal: `${d + 1}-я ступень (${SOLFEGE[d]}). Слышишь, как она тянется к тонике?`,
      play: () => { const t = playCadence(key, now()); engine.play(m, t + 0.3, 1.2, 75) },
      after: () => {
        const t = now() + 0.1, base = m - degree(d)
        resolution(d).forEach((x, i) => engine.play(base + degree(x), t + i * 0.4, 0.38, 70))
      },
    }
  }
  return (
    <Quiz id={`fq-${set}`} family="fq" title="Ступени на слух" options={options} make={make}
      intro="Звучит каденция I–IV–V–I, затем одна нота. Определи, какая это ступень лада. После ответа нота разрешится в тонику — так запоминается её «характер» относительно тоники."
      controls={<label>Ступени <span className="seg">{[['triad', '1 · 3 · 5'], ['penta', '+ 2 · 6'], ['all', 'Все 7']].map(([v, t]) => <button key={v} aria-pressed={set === v} onClick={() => setSet(v)}>{t}</button>)}</span></label>} />
  )
}

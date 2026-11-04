import { useState } from 'react'
import { Link } from 'react-router-dom'
import { engine } from '../lib/audio'
import { INTERVALS, noteName } from '../lib/music'
import { logSession, useStored } from '../lib/store'
import { CHORDS, rand, randInt, type ChordQ } from '../lib/theory'

type Option = { id: string; label: string }
type Question = { answer: string; play: () => void; reveal: string }

/** Общий экран «узнай на слух»: кнопка «Послушать», варианты ответа, счёт и серия */
function Quiz({ id, title, intro, options, make, controls }: {
  id: string; title: string; intro: string; options: Option[]; make: () => Question; controls?: React.ReactNode
}) {
  const [q, setQ] = useState<Question | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [stat, setStat] = useState({ ok: 0, all: 0, streak: 0 })
  const [best, setBest] = useStored<Record<string, number>>('quizBest', {})

  const next = () => { const n = make(); setQ(n); setPicked(null); n.play() }
  const pick = (opt: string) => {
    if (!q || picked) return
    setPicked(opt)
    const ok = opt === q.answer
    const s = { ok: stat.ok + (ok ? 1 : 0), all: stat.all + 1, streak: ok ? stat.streak + 1 : 0 }
    setStat(s)
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
  const make = (): Question => {
    const st = rand(pool), root = randInt(52, 64), to = mode === 'down' ? root - st : root + st
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
    <Quiz id={`iq-${set}-${mode}`} title="Узнай интервал" options={options} make={make}
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
  const make = (): Question => {
    const q = rand(pool), root = randInt(48, 60)
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
    <Quiz id={`cq-${set}`} title="Узнай аккорд" options={options} make={make}
      intro="Звучит аккорд — определи его вид. Мажор звучит светло, минор — грустно, уменьшённый — тревожно, увеличенный — «подвешенно»."
      controls={<>
        <label>Набор <span className="seg">{[['basic', 'Мажор / минор'], ['triads', 'Все трезвучия'], ['sevenths', 'Септаккорды']].map(([v, t]) => <button key={v} aria-pressed={set === v} onClick={() => setSet(v)}>{t}</button>)}</span></label>
        <label className="chk"><input type="checkbox" checked={arp} onChange={e => setArp(e.target.checked)} /> Играть по нотам (арпеджио)</label>
      </>} />
  )
}

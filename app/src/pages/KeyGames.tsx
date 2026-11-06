import { tr } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpenText, Ear, Heart, ListMusic, Piano, Play, RotateCcw, Star, Volume2 } from 'lucide-react'
import { PianoKeys } from '../components/PianoKeys'
import { Staff } from '../components/Staff'
import { engine } from '../lib/audio'
import { isBlack, NAMES, plural } from '../lib/music'
import { logSession, useStored } from '../lib/store'
import { rand } from '../lib/theory'

/**
 * Игры с клавиатурой в духе коротких уроков: 10 заданий, 3 жизни, серия.
 * Связывают звук, клавишу и название ноты — основа и для слуха, и для нотной грамоты.
 */
const GAMES = {
  find: { title: tr('Найди ноту'), text: tr('Звучит нота — нажми её клавишу.'), icon: Ear },
  melody: { title: tr('Повтори мелодию'), text: tr('Звучат несколько нот — нажми их по порядку.'), icon: ListMusic },
  name: { title: tr('Где эта нота?'), text: tr('Подсвечена клавиша — выбери её название.'), icon: Piano },
  read: { title: tr('Читай ноты'), text: tr('Нота на нотоносце — нажми её клавишу.'), icon: BookOpenText },
} as const
type Game = keyof typeof GAMES
const LEVELS = [
  { title: tr('До — Соль'), text: tr('5 белых клавиш'), lo: 60, hi: 67, black: false },
  { title: tr('Октава'), text: tr('все белые клавиши'), lo: 60, hi: 72, black: false },
  { title: tr('С диезами'), text: tr('белые и чёрные'), lo: 60, hi: 72, black: true },
]
const TOTAL = 10
const starsFor = (pct: number) => (pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 50 ? 1 : 0)
const Stars = ({ n, size = 16 }: { n: number; size?: number }) => <span className="mini-stars" aria-label={tr('{0} из 3 звёзд', n)}>{[0, 1, 2].map(i => <Star key={i} size={size} className={i < n ? 'on' : ''} fill="currentColor" />)}</span>
const name = (m: number) => NAMES[m % 12]

type Q = { notes: number[]; options?: string[] }
type Mark = { m: number; ok: boolean }

/** Каждая игра — своё состояние урока: при смене игры урок начинается заново */
export default function KeyGames() {
  const [params] = useSearchParams()
  return <KeyGame key={params.get('g') ?? ''} />
}

function KeyGame() {
  const [params, setParams] = useSearchParams()
  const game = (params.get('g') ?? '') as Game | ''
  const [lvl, setLvl] = useStored('kg.level', 0)
  const [labels, setLabels] = useStored('kg.labels', true)
  const [best, setBest] = useStored<Record<string, number>>('kg.best', {})
  const L = LEVELS[lvl]
  const pool = Array.from({ length: L.hi - L.lo + 1 }, (_, i) => L.lo + i).filter(m => L.black || !isBlack(m))

  const [n, setN] = useState(0)
  const [hearts, setHearts] = useState(3)
  const [ok, setOk] = useState(0)
  const [streak, setStreak] = useState(0)
  const [q, setQ] = useState<Q | null>(null)
  const [taps, setTaps] = useState<number[]>([])
  const [marks, setMarks] = useState<Mark[]>([])
  const [locked, setLocked] = useState(false)
  const [done, setDone] = useState(false)
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null)
  const [wrongAt, setWrongAt] = useState(-1)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const now = () => engine.ensureCtx().currentTime + 0.05
  const playSeq = (notes: number[]) => { const t = now(); notes.forEach((m, i) => engine.play(m, t + i * 0.55, 0.5, 75)) }

  const make = (i: number): Q => {
    if (game === 'melody') {
      const len = Math.min(5, 2 + Math.floor(i / 3)), notes = [rand(pool)]
      while (notes.length < len) {
        const idx = pool.indexOf(notes[notes.length - 1]) + rand([-2, -1, 1, 1, 2])
        notes.push(pool[Math.max(0, Math.min(pool.length - 1, idx))])
      }
      return { notes }
    }
    const m = rand(pool)
    if (game === 'name') {
      const opts = new Set([name(m)])
      while (opts.size < 4) opts.add(name(rand(pool)))
      return { notes: [m], options: [...opts].sort(() => Math.random() - 0.5) }
    }
    return { notes: [m] }
  }
  const ask = (i: number) => {
    const nq = make(i)
    setQ(nq); setTaps([]); setMarks([]); setLocked(false); setFb(null); setWrongAt(-1)
    if (game !== 'name' && game !== 'read') playSeq(nq.notes)
  }
  const start = () => { setN(0); setHearts(3); setOk(0); setStreak(0); setDone(false); ask(0) }

  const finish = (right: number, h: number) => {
    setDone(true)
    const score = Math.round((right / TOTAL) * 100), key = `${game}-${lvl}`
    if (score > (best[key] ?? 0)) setBest({ ...best, [key]: score })
    logSession({ date: Date.now(), kind: 'ear', id: 'keys-' + game, title: tr('Игры с клавиатурой: ') + GAMES[game as Game].title, score, reps: TOTAL })
    void h
  }
  /** засчитать ответ и перейти дальше */
  const resolve = (right: boolean, show: Mark[]) => {
    setLocked(true); setMarks(show)
    setFb(right ? { ok: true, text: rand([tr('Верно!'), tr('Точно!'), tr('Есть!')]) } : { ok: false, text: q!.notes.length > 1 ? tr('Мелодия: ') + q!.notes.map(name).join(' → ') : tr('Это была ') + name(q!.notes[0]) })
    const h = right ? hearts : hearts - 1, o = ok + (right ? 1 : 0)
    setHearts(h); setOk(o); setStreak(right ? streak + 1 : 0)
    if (!right && q) setTimeout(() => playSeq(q.notes), 350)
    timer.current = setTimeout(() => {
      const next = n + 1
      if (next >= TOTAL || h <= 0) finish(o, h)
      else { setN(next); ask(next) }
    }, right ? 700 : 1600 + (q?.notes.length ?? 1) * 450)
  }

  const press = (m: number) => {
    engine.play(m, now(), 0.45, 70)
    if (!q || locked || game === 'name') return
    if (game === 'find' || game === 'read') return resolve(m === q.notes[0], m === q.notes[0] ? [{ m, ok: true }] : [{ m, ok: false }, { m: q.notes[0], ok: true }])
    const t = [...taps, m]
    setTaps(t)
    const i = t.length - 1
    if (m !== q.notes[i]) { setWrongAt(i); return resolve(false, [{ m, ok: false }, ...q.notes.map(x => ({ m: x, ok: true }))]) }
    setMarks(t.map(x => ({ m: x, ok: true })))
    if (t.length === q.notes.length) resolve(true, t.map(x => ({ m: x, ok: true })))
  }
  const choose = (opt: string) => {
    if (!q || locked) return
    const m = q.notes[0]
    engine.play(m, now(), 0.5, 70)
    resolve(opt === name(m), [{ m, ok: opt === name(m) }])
  }

  if (!game) return (
    <div className="page">
      <div className="crumbs"><Link to="/ear">{tr('Слух')}</Link></div>
      <h1>{tr('Игры с клавиатурой')}</h1>
      <p className="muted lead-narrow">{tr('Короткие уроки по 10 заданий. Связывают звук, клавишу и название ноты — пригодится и для слуха, и для нотной грамоты.')}</p>
      <LevelPick lvl={lvl} setLvl={setLvl} />
      <div className="grid grid3">
        {(Object.keys(GAMES) as Game[]).map(g => (
          <button key={g} className="tile game-tile" onClick={() => setParams({ g })}>
            {(() => { const I = GAMES[g].icon; return <I size={24} className="game-ic" aria-hidden /> })()}
            <strong>{GAMES[g].title}</strong>
            <span className="muted small">{GAMES[g].text}</span>
            {best[`${g}-${lvl}`] != null ? <Stars n={starsFor(best[`${g}-${lvl}`])} /> : <span className="small muted">{tr('Ещё не пройдено')}</span>}
          </button>
        ))}
      </div>
    </div>
  )

  const mark = (m: number) => marks.find(x => x.m === m)
  const show = q && game === 'name' ? q.notes[0] : null
  return (
    <div className="page key-games">
      <div className="crumbs"><Link to="/ear">{tr('Слух')}</Link> / <Link to="/ear/keys">{tr('Игры с клавиатурой')}</Link></div>
      <h1>{GAMES[game].title}</h1>
      {!q && !done && <>
        <p className="muted lead-narrow">{GAMES[game].text} {tr('10 заданий, 3 жизни.')}</p>
        <LevelPick lvl={lvl} setLvl={setLvl} />
        <label className="chk"><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)} /> {tr('Подписи на клавишах')}</label>
        <button className="btn big-btn" onClick={start}><Play size={18} fill="currentColor" /> {tr('Начать урок')}</button>
      </>}
      {q && !done && <>
        <div className="lesson-top">
          <div className="lesson-bar" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={n}><i style={{ width: `${(n / TOTAL) * 100}%` }} /></div>
          <span className="hearts" aria-label={tr('Жизней: {0}', hearts)}>{[0, 1, 2].map(i => <Heart key={i} size={20} className={i < hearts ? 'on' : ''} fill="currentColor" />)}</span>
        </div>
        <p className="lesson-task">
          {game === 'find' && tr('Нажми клавишу, которая прозвучала')}
          {game === 'melody' && tr('Повтори {0} {1} по порядку', q.notes.length, plural(q.notes.length, [tr('ноту'), tr('ноты'), tr('нот')]))}
          {game === 'name' && tr('Как называется подсвеченная клавиша?')}
          {game === 'read' && tr('Нажми клавишу этой ноты')}
          {streak >= 3 && <span className="streak-pill">{tr('серия')} {streak}</span>}
        </p>
        {game === 'read' && <Staff items={[{ m: q.notes[0], acc: isBlack(q.notes[0]) ? '#' : undefined, hl: marks.length ? (marks.some(k => k.m === q.notes[0] && k.ok) && marks.length === 1 ? 'ok' : 'on') : undefined }]} play={false} />}
        {game !== 'name' && game !== 'read' && <button className="btn ghost" onClick={() => playSeq(q.notes)} disabled={locked}><Volume2 size={18} /> {tr('Послушать ещё раз')}</button>}
        {game !== 'name' && <p className={'lesson-feedback' + (fb ? (fb.ok ? ' ok' : ' bad') : '')} aria-live="polite">{fb?.text ?? ''}</p>}
        {game === 'melody' && <div className="dict-slots">{q.notes.map((x, i) => {
          const shown = wrongAt >= 0 ? name(x) : i < taps.length ? name(taps[i]) : '·'
          return <span key={i} className={'slot' + (i === wrongAt ? ' wrong' : i < taps.length || wrongAt >= 0 ? ' right' : '')}>{shown}{i === wrongAt && <s>{name(taps[i])}</s>}</span>
        })}</div>}
        <PianoKeys lo={L.lo} hi={L.hi} onPress={press}
          label={m => labels && game !== 'name' && (game !== 'read' || locked) && !isBlack(m) ? name(m) : null}
          cls={m => {
            const k = mark(m)
            if (k) return k.ok ? 'right' : 'wrong'
            if (m === show) return 'held'
            return !L.black && isBlack(m) ? 'dim' : ''
          }} />
        {game === 'name' && <div className="answers">{q.options!.map(o => {
          const right = locked && o === name(q.notes[0])
          return <button key={o} className={'answer' + (right ? ' right' : '')} disabled={locked} onClick={() => choose(o)}>{o}</button>
        })}</div>}
        {game === 'name' && <p className={'lesson-feedback' + (fb ? (fb.ok ? ' ok' : ' bad') : '')} aria-live="polite">{fb?.text ?? ''}</p>}
      </>}
      {done && (
        <div className="card lesson-end">
          <div className="stars"><Stars n={starsFor(ok * 10)} size={40} /></div>
          <h2>{hearts <= 0 ? tr('Жизни закончились') : ok >= 9 ? tr('Отлично!') : ok >= 7 ? tr('Хорошо!') : tr('Урок пройден')}</h2>
          <p className="muted">{tr('Верно')} {ok} {tr('из')} {TOTAL}{hearts <= 0 ? tr(' · остановились на {0}-м задании', n + 1) : ''}</p>
          <div className="toolbar">
            <button className="btn" onClick={start}><RotateCcw size={16} /> {tr('Ещё раз')}</button>
            {ok >= 8 && lvl < LEVELS.length - 1 && <button className="btn ghost" onClick={() => { setLvl(lvl + 1); setQ(null); setDone(false) }}>{tr('Следующий уровень')}</button>}
            <button className="textbtn" onClick={() => { setParams({}); setQ(null); setDone(false) }}>{tr('Другая игра')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function LevelPick({ lvl, setLvl }: { lvl: number; setLvl: (n: number) => void }) {
  return (
    <div className="settings drill-controls">
      <label>{tr('Уровень')} <span className="seg">{LEVELS.map((l, i) => <button key={i} aria-pressed={lvl === i} onClick={() => setLvl(i)}>{l.title}</button>)}</span></label>
    </div>
  )
}

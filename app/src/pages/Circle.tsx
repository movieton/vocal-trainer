import { useState } from 'react'
import CircleSvg, { sigText } from '../components/CircleSvg'
import { Link } from 'react-router-dom'
import { engine } from '../lib/audio'
import { chordLabel, CHORDS, CIRCLE, degree, pcName, rand, SCALES, type ChordQ } from '../lib/theory'
import { useStored } from '../lib/store'

const DIATONIC: { deg: number; roman: string; q: ChordQ }[] = [
  { deg: 0, roman: 'I', q: 'maj' }, { deg: 1, roman: 'ii', q: 'min' }, { deg: 2, roman: 'iii', q: 'min' },
  { deg: 3, roman: 'IV', q: 'maj' }, { deg: 4, roman: 'V', q: 'maj' }, { deg: 5, roman: 'vi', q: 'min' }, { deg: 6, roman: 'vii°', q: 'dim' },
]

const base = (pc: number) => 48 + pc

function playChord(root: number, q: ChordQ, t: number, d = 0.9) {
  CHORDS[q].iv.forEach(x => engine.play(root + x, t, d, 55))
  engine.play(root - 12, t, d, 60)
}

function playScale(pc: number) {
  const t = engine.ensureCtx().currentTime + 0.05
  for (let i = 0; i <= 7; i++) engine.play(base(pc) + degree(i), t + i * 0.28, 0.3, 65)
}

/** Каденция I–IV–V–I: так ухо узнаёт тональность */
function playCadence(pc: number) {
  const t = engine.ensureCtx().currentTime + 0.05
  ;[0, 3, 4, 0].forEach((d, i) => playChord(base(pc) + degree(d), 'maj', t + i * 0.8, 0.75))
}

export default function Circle() {
  const [sel, setSel] = useState(0)
  const key = CIRCLE[sel]
  const notes = SCALES.major.steps.map(s => pcName(key.pc + s))

  const near = [(sel + 11) % 12, (sel + 1) % 12]

  return (
    <div className="page">
      <div className="crumbs"><Link to="/ear">Слух</Link></div>
      <h1>Квинтовый круг</h1>
      <p className="muted">Все 24 тональности по кругу: по часовой стрелке каждая следующая на квинту выше и с одним диезом больше. Соседи на круге — самые родственные тональности: песни чаще всего переходят именно в них.</p>
      <div className="circle-wrap">
        <CircleSvg sel={sel} onPick={i => { setSel(i); playCadence(CIRCLE[i].pc) }} />

        <div className="circle-info">
          <h2>{key.major} мажор · {key.minor} минор</h2>
          <p className="muted small">Параллельные тональности: одни и те же ноты, разный центр. Знаки: {sigText(key.sig)}.</p>
          <div className="scale-notes">{notes.map((n, i) => <span key={i}>{n}</span>)}</div>
          <div className="row-btns">
            <button className="btn ghost" onClick={() => playScale(key.pc)}>Гамма</button>
            <button className="btn ghost" onClick={() => playCadence(key.pc)}>Каденция I–IV–V–I</button>
          </div>
          <h2 style={{ marginTop: 20 }}>Аккорды тональности</h2>
          <div className="chords-row">
            {DIATONIC.map(d => (
              <button key={d.roman} className="chordbtn" onClick={() => playChord(base(key.pc) + degree(d.deg), d.q, engine.ensureCtx().currentTime + 0.05, 1.2)}>
                <b>{d.roman}</b><span>{chordLabel(key.pc + degree(d.deg), d.q)}</span>
              </button>
            ))}
          </div>
          <p className="muted small">Соседи по кругу: слева субдоминанта {CIRCLE[near[0]].major} (IV), справа доминанта {CIRCLE[near[1]].major} (V). Именно они дают самую сильную тягу к тонике.</p>
          <Link to="/ear/chords" className="small">Попеть по кругу: пение над аккордами с флажком «менять по квинтовому кругу» →</Link>
        </div>
      </div>
      <CircleQuiz />
    </div>
  )
}

const QTYPES = [
  { id: 'dom', q: (k: typeof CIRCLE[0]) => `Доминанта (V) тональности ${k.major} мажор?`, a: (i: number) => CIRCLE[(i + 1) % 12].major },
  { id: 'sub', q: (k: typeof CIRCLE[0]) => `Субдоминанта (IV) тональности ${k.major} мажор?`, a: (i: number) => CIRCLE[(i + 11) % 12].major },
  { id: 'rel', q: (k: typeof CIRCLE[0]) => `Параллельный минор к ${k.major} мажору?`, a: (i: number) => CIRCLE[i].minor },
  { id: 'sig', q: (k: typeof CIRCLE[0]) => `Сколько знаков в ${k.major} мажоре?`, a: (i: number) => sigText(CIRCLE[i].sig) },
]

function CircleQuiz() {
  const [q, setQ] = useState<{ text: string; answer: string; opts: string[] } | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [stat, setStat] = useStored('circleQuiz', { ok: 0, all: 0 })
  const next = () => {
    const i = Math.floor(Math.random() * 12), t = rand(QTYPES)
    const answer = t.a(i)
    const pool = new Set([answer])
    while (pool.size < 4) pool.add(t.a(Math.floor(Math.random() * 12)))
    setQ({ text: t.q(CIRCLE[i]), answer, opts: [...pool].sort(() => Math.random() - 0.5) })
    setPicked(null)
  }
  const pick = (o: string) => {
    if (picked || !q) return
    setPicked(o)
    setStat({ ok: stat.ok + (o === q.answer ? 1 : 0), all: stat.all + 1 })
  }
  return (
    <div className="card quiz">
      <h2>Проверь себя</h2>
      <div className="quiz-top">
        <button className="btn" onClick={next}>{q ? 'Следующий вопрос' : 'Начать'}</button>
        <span className="status"><span>Верно <b>{stat.ok} / {stat.all}</b></span></span>
      </div>
      {q && <>
        <p className="quiz-q">{q.text}</p>
        {picked && <p className={'verdict ' + (picked === q.answer ? 'ok-msg' : 'err')}>{picked === q.answer ? 'Верно' : `Мимо — правильно: ${q.answer}`}</p>}
        <div className="answers">
          {q.opts.map(o => <button key={o} className={'answer ' + (!picked ? '' : o === q.answer ? 'right' : o === picked ? 'wrong' : 'dim')} disabled={!!picked} onClick={() => pick(o)}>{o}</button>)}
        </div>
      </>}
    </div>
  )
}

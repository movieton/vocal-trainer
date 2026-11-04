import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BREATH, BREATH_GROUPS, type BreathEx } from '../data/breath'
import { engine } from '../lib/audio'
import { logSession, useStored } from '../lib/store'
import LongNote from './LongNote'
import { BEAN_PATH, BEAN_VIEWBOX } from '../components/Beans'
import { MicGate } from '../components/Mic'

export const EVIDENCE = {
  И: { label: 'исследования', title: 'Эффект подтверждён исследованиями' },
  Ш: { label: 'признанная школа', title: 'Входит в признанные вокальные методики' },
  П: { label: 'практика педагогов', title: 'Распространённая практика, строгих исследований нет' },
  Т: { label: 'традиция', title: 'Традиция без доказательств пользы для голоса' },
} as const

export const Evidence = ({ e }: { e: keyof typeof EVIDENCE }) => <span className={'ev ev-' + e} title={EVIDENCE[e].title}>{EVIDENCE[e].label}</span>

export function BreathList() {
  const [best] = useStored<Record<string, number>>('breathBest', {})
  return (
    <div className="page">
      <h1>Дыхание</h1>
      <p className="muted">Опора, вдох и контроль выдоха. Делай стоя, плечи свободны. 2–3 упражнения перед распевкой достаточно. Если закружится голова, остановись.</p>
      <p className="ev-legend small muted">Доказательность: <Evidence e="И" /> <Evidence e="Ш" /> <Evidence e="П" /> <Evidence e="Т" /> — от подтверждённого исследованиями к традиции без доказательств. <Link to="/theory/hygiene">Подробнее о здоровье голоса</Link></p>
      {(Object.keys(BREATH_GROUPS) as (keyof typeof BREATH_GROUPS)[]).map(g => (
        <section key={g} className="lib-sec">
          <h2>{BREATH_GROUPS[g]}</h2>
          <div className="grid">
            {BREATH.filter(b => b.group === g).map(b => (
              <Link key={b.id} to={`/breath/${b.id}`} className="tile">
                <span className="tile-top"><span className="lvl">{'●'.repeat(b.level)}{'○'.repeat(3 - b.level)}</span><Evidence e={b.evidence} /></span>
                <strong>{b.title}</strong>
                <span className="muted small">{b.goal}</span>
                <span className="syl">{b.type === 'cycle' ? `${totalSec(b)} с` : b.type === 'stopwatch' ? (best[b.id] ? `Рекорд ${best[b.id].toFixed(1)} с` : 'Замер') : b.type === 'vfe' ? '4 упражнения' : 'С микрофоном'}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const totalSec = (b: BreathEx) => (b.phases ?? []).reduce((a, p) => a + p.sec, 0) * (b.rounds ?? 1)

export function BreathRun() {
  const { id = '' } = useParams()
  const ex = BREATH.find(b => b.id === id)
  if (!ex) return <div className="page"><p>Упражнение не найдено. <Link to="/breath">К списку</Link></p></div>
  return (
    <div className="page">
      <div className="crumbs"><Link to="/breath">Дыхание</Link> / {BREATH_GROUPS[ex.group]}</div>
      <h1>{ex.title}</h1>
      <p className="muted goal-line"><span>{ex.goal}</span><Evidence e={ex.evidence} /></p>
      {ex.evidence === 'Т' && <p className="note-box">Это традиционная методика: строгих данных о её пользе для голоса нет. Можно делать как общую дыхательную разминку, но для голоса надёжнее упражнения из «Здоровья голоса» и «Дыхания в пении».</p>}
      {ex.type === 'cycle' && <Cycle ex={ex} />}
      {ex.type === 'stopwatch' && <Stopwatch ex={ex} />}
      {ex.type === 'longnote' && <LongNote />}
      {ex.type === 'vfe' && <Vfe />}
      <div className="howto">
        <div><h2>Как делать</h2><ol>{ex.how.map(t => <li key={t}>{t}</li>)}</ol></div>
        {ex.mistakes && <div><h2>Частые ошибки</h2><ul>{ex.mistakes.map(t => <li key={t}>{t}</li>)}</ul></div>}
      </div>
    </div>
  )
}

function Cycle({ ex }: { ex: BreathEx }) {
  const phases = ex.phases!, rounds = ex.rounds ?? 1
  const [state, setState] = useState<{ i: number; left: number; round: number; frac: number } | null>(null)
  const timer = useRef(0)

  const stop = () => { clearInterval(timer.current); setState(null) }
  const start = () => {
    engine.ensureCtx()
    const t0 = performance.now()
    const cycle = phases.reduce((a, p) => a + p.sec, 0)
    let lastKey = '', lastPulse = -1
    timer.current = window.setInterval(() => {
      const el = (performance.now() - t0) / 1000
      const round = Math.floor(el / cycle)
      if (round >= rounds) {
        clearInterval(timer.current); setState(null)
        logSession({ date: Date.now(), kind: 'breath', id: ex.id, title: ex.title, score: 100 })
        engine.click(true)
        return
      }
      let t = el - round * cycle, i = 0
      while (t >= phases[i].sec) { t -= phases[i].sec; i++ }
      const p = phases[i]
      const key = round + ':' + i
      if (key !== lastKey) { lastKey = key; lastPulse = -1; engine.click(true) }
      if (p.kind === 'pulse' && p.pulses) {
        const k = Math.floor((t / p.sec) * p.pulses)
        if (k !== lastPulse && k > 0) { lastPulse = k; engine.click(false) }
      }
      setState({ i, left: p.sec - t, round, frac: t / p.sec })
    }, 40)
  }
  useEffect(() => () => clearInterval(timer.current), [])

  const p = state ? phases[state.i] : null
  // круг растёт на вдохе, держится на задержке, сжимается на выдохе
  const scale = !p ? 0.55 : p.kind === 'in' ? 0.55 + 0.45 * state!.frac : p.kind === 'out' ? 1 - 0.45 * state!.frac : p.kind === 'pulse' ? 0.8 : 1
  return (
    <div className="card breath">
      <div className="orb-wrap">
        <svg viewBox={BEAN_VIEWBOX} className={'orb ' + (p?.kind ?? 'idle')} style={{ transform: `scale(${scale})` }} aria-hidden><path d={BEAN_PATH} /></svg>
        <div className="orb-text">
          <strong>{p ? p.label : 'Готов?'}</strong>
          <span>{state ? Math.ceil(state.left) : ''}</span>
        </div>
      </div>
      <div className="breath-meta">
        <span className="muted">{state ? `Круг ${state.round + 1} из ${rounds}` : `${rounds} кругов · ${totalSec(ex)} с`}</span>
        <ol className="phases">{phases.map((x, i) => <li key={i} className={state?.i === i ? 'on' : ''}>{x.label} · {x.sec} с</li>)}</ol>
        <button className={'btn' + (state ? ' stop' : '')} onClick={state ? stop : start}>{state ? 'Стоп' : 'Начать'}</button>
      </div>
    </div>
  )
}

function Stopwatch({ ex }: { ex: BreathEx }) {
  const [best, setBest] = useStored<Record<string, number>>('breathBest', {})
  const [t, setT] = useState(0)
  const [on, setOn] = useState(false)
  const t0 = useRef(0), timer = useRef(0)
  const toggle = () => {
    if (on) {
      clearInterval(timer.current); setOn(false)
      const sec = (performance.now() - t0.current) / 1000
      if (sec > (best[ex.id] ?? 0)) setBest({ ...best, [ex.id]: sec })
      logSession({ date: Date.now(), kind: 'breath', id: ex.id, title: ex.title, score: Math.round(sec) })
    } else {
      t0.current = performance.now(); setOn(true)
      timer.current = window.setInterval(() => setT((performance.now() - t0.current) / 1000), 50)
    }
  }
  useEffect(() => () => clearInterval(timer.current), [])
  return (
    <div className="card breath">
      <div className="orb-wrap">
        <svg viewBox={BEAN_VIEWBOX} className={'orb ' + (on ? 'out' : 'idle')} style={{ transform: `scale(${on ? Math.max(0.4, 1 - t / 60) : 0.7})` }} aria-hidden><path d={BEAN_PATH} /></svg>
        <div className="orb-text"><strong className="big-num">{t.toFixed(1)}</strong><span>секунд</span></div>
      </div>
      <div className="breath-meta">
        <span className="muted">Рекорд: <b>{best[ex.id] ? best[ex.id].toFixed(1) + ' с' : '—'}</b>. Хороший ориентир для начала — 20 секунд, для тренированного певца — 40 и больше.</span>
        <button className={'btn' + (on ? ' stop' : '')} onClick={toggle}>{on ? 'Стоп' : 'Старт'}</button>
      </div>
    </div>
  )
}

/** Vocal Function Exercises (Stemple): 4 упражнения, по 2 раза, утром и вечером */
function Vfe() {
  return (
    <div className="vfe">
      <MicGate />
      <div className="card"><h2>1. Разогрев: «и» на одной ноте</h2>
        <p className="muted small">Тихо, с вибрацией на губах, как можно дольше без напряжения. Нота для твоего голоса — Фа.</p>
        <LongNote presets={[5]} id="vfe1" noGate />
      </div>
      <div className="card"><h2>2. Растяжка: глиссандо вверх</h2>
        <p className="muted small">На слове «ноль» (звук «о» с губами в «у») плавно от самой низкой ноты к самой высокой. Без рывков на переходах.</p>
        <Link to="/ex/ng-siren" className="btn ghost">Открыть сирену на доске</Link>
      </div>
      <div className="card"><h2>3. Сжатие: глиссандо вниз</h2>
        <p className="muted small">Так же на «ноль», но сверху вниз, до самой низкой ноты.</p>
        <Link to="/ex/yawn-sigh" className="btn ghost">Открыть спуск на доске</Link>
      </div>
      <div className="card"><h2>4. Сила: длинные ноты До–Соль</h2>
        <p className="muted small">Каждую ноту — «и» как можно дольше, тихо и ровно. Рекорд сохраняется для каждой ноты.</p>
        <LongNote presets={[0, 2, 4, 5, 7]} id="vfe4" noGate />
      </div>
    </div>
  )
}

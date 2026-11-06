import { Link, Navigate, useNavigate } from 'react-router-dom'
import type { Goal } from './Welcome'
import { startPlan } from '../components/PlanBar'
import { ReminderCard } from '../components/Reminder'
import { Check, ChevronRight, Flame, Play } from 'lucide-react'
import { BeanWave } from '../components/Beans'
import { problemNotes, streak, useStored, useWorkRange, type SessionLog } from '../lib/store'
import { noteName, plural } from '../lib/music'

// программа дня меняется по дням недели, слабое место подставляется из статистики
const BREATH_ROT = [['hiss-metro', 'Шипящий метроном'], ['horizon', 'Апподжио «Горизонт»'], ['candle', 'Свеча'], ['long-s', 'Длинное «с»']]
const WARM_ROT = [['lip-trill-5', 'Губная трель'], ['trill-siren', 'Трель-сирена'], ['hum', 'Мычание'], ['ng-siren', '«Нг»-сирена']]
const CALM_ROT = [['mu-triad', 'Трезвучие «Му»'], ['five-vowels', 'Пять гласных'], ['scale-9', 'Гамма на октаву'], ['octave-lift', 'Октавный лифт']]
const BLOCKS = [
  ['Микст', 'nay', 'Нэй-нэй'], ['Бэлтинг', 'ey', 'Эй-эй'], ['Подвижность', 'stacc-arp', 'Стаккато по арпеджио'],
  ['Микст', 'gug', 'Гуг'], ['Спокойный звук', 'dome', 'Широкий купол'], ['Подвижность', 'penta-down', 'Пентатонический спуск'], ['Микст', 'octave-jump', 'Октавный скачок'],
]
const EAR_IDS: Record<string, string> = { '/ear/levels': 'level-', '/ear/sing-interval': 'sing-interval', '/ear/scales': 'scale-sing', '/ear/chords': 'chord-sing', '/ear/melody': 'melody' }
const EAR_ROT = [['/ear/levels', '10 уровней точности'], ['/ear/sing-interval', 'Интервалы голосом'], ['/ear/scales', 'Гаммы с аккомпанементом'], ['/ear/chords', 'Пение над аккордами'], ['/ear/melody', 'Повтори мелодию']]

// главный блок дня под цель человека
function goalBlock(goal: Goal, d: number) {
  const pick = <T,>(a: T[]) => a[d % a.length]
  switch (goal) {
    case 'range': { const [id, t] = pick([['ng-siren', '«Нг»-сирена'], ['octave-lift', 'Октавный лифт'], ['trill-siren', 'Трель-сирена'], ['octave-jump', 'Октавный скачок']]); return { min: 4, title: 'Диапазон', text: t, to: `/ex/${id}`, id } }
    case 'ear': { const [to, t] = pick([['/ear/keys?g=find', 'Найди ноту на клавиатуре'], ['/ear/degrees', 'Ступени на слух'], ['/ear/intervals', 'Узнай интервал'], ['/ear/dictation', 'Мелодический диктант']]); return { min: 4, title: 'Слух — твоя цель', text: t, to, id: to.includes('keys') ? 'keys-find' : to.slice(5) } }
    case 'breath': { const [id, t] = pick([['long-s', 'Длинное «с»'], ['hiss-metro', 'Шипящий метроном'], ['horizon', 'Апподжио «Горизонт»']]); return { min: 4, title: 'Дыхание — твоя цель', text: t, to: `/breath/${id}`, id } }
    case 'write': return { min: 4, title: 'Сочинение', text: 'Набросай 4 такта мелодии над гармонией', to: '/compose', id: 'compose' }
    default: return null
  }
}

function dayPlan(log: SessionLog[], goal: Goal, minutes: number) {
  const d = Math.floor(Date.now() / 86400000), w = new Date().getDay()
  const pick = <T,>(a: T[], k = 0) => a[(d + k) % a.length]
  const avg = (k: SessionLog['kind']) => { const x = log.filter(l => l.kind === k).slice(0, 10); return x.length ? x.reduce((a, l) => a + l.score, 0) / x.length : null }
  const ear = avg('ear'), sing = avg('exercise')
  const [bName, bId, bEx] = BLOCKS[w]
  const [b1, b1t] = pick(BREATH_ROT), [wId, wT] = pick(WARM_ROT, 1), [cId, cT] = pick(CALM_ROT, 2)
  // слух слабее пения — больше времени слуху
  const earWeak = ear != null && sing != null && ear < sing - 10
  const [eTo, eT] = earWeak ? ['/ear/levels', '10 уровней точности'] : pick(EAR_ROT, 3)
  const weak = problemNotes(log)[0]
  const full = [
    { min: 2, title: 'Дыхание', text: b1t, to: `/breath/${b1}`, id: b1 },
    { min: 3, title: 'Разогрев', text: wT, to: `/ex/${wId}`, id: wId },
    // есть устойчивая ошибка на ноте — вместо спокойного звука точечная работа над ней
    ...(weak ? [{ min: 3, title: 'Твоя трудная нота', text: `${noteName(weak.m)}: ${weak.c > 0 ? 'завышаешь' : 'занижаешь'} на ${Math.round(Math.abs(weak.c))} ц — длинная нота`, to: `/breath/long-note?note=${weak.m}`, id: 'long-note' }]
      : [{ min: 3, title: 'Спокойный звук', text: cT, to: `/ex/${cId}`, id: cId }]),
    { min: earWeak ? 3 : 4, title: `Блок дня: ${bName.toLowerCase()}`, text: bEx, to: `/ex/${bId}`, id: bId },
    { min: earWeak ? 4 : 3, title: earWeak ? 'Слух — слабое место' : 'Слух', text: eT, to: eTo, id: EAR_IDS[eTo] },
  ]
  // цель заменяет «блок дня»; короткая программа — только самое нужное
  const g = goalBlock(goal, d)
  const plan = g ? full.map((p, i) => (i === 3 ? g : p)) : full
  if (minutes <= 5) return [{ ...plan[1], min: 2 }, { ...(g ?? plan[2]), min: 3 }]
  if (minutes <= 10) return [plan[0], plan[1], { ...(g ?? plan[2]), min: 5 }]
  return plan
}

export default function Home() {
  const [onboarded] = useStored('onboarded', false)
  const [goal] = useStored<Goal>('goal', 'pitch')
  const [minutes] = useStored('dailyMin', 15)
  const [voice] = useStored<string | null>('voiceType', null)
  const work = useWorkRange()
  const [log] = useStored<SessionLog[]>('log', [])
  const today = log.filter(l => new Date(l.date).toDateString() === new Date().toDateString())
  const go = useNavigate()
  const st = streak(log)
  const [planDone] = useStored<{ day: string; tos: string[] }>('plan.done', { day: '', tos: [] })
  const doneTos = planDone.day === new Date().toDateString() ? planDone.tos : []
  const plan = dayPlan(log, goal, minutes).map(p => ({ ...p, done: doneTos.includes(p.to) || today.some(l => p.id && l.id.startsWith(p.id)) }))
  const begin = () => startPlan(plan.map(({ to, title, text }) => ({ to, title, text })))
  const doneN = plan.filter(p => p.done).length
  const next = plan.find(p => !p.done)
  if (!onboarded && !log.length) return <Navigate to="/welcome" replace />
  return (
    <div className="page">
      <div className="home-head">
        <h1 className="hero-title">Пой в своём ритме</h1>
        <span className="streak"><Flame size={16} /> {st ? `${st} ${plural(st, ['день', 'дня', 'дней'])} подряд` : 'Первый день'}</span>
      </div>
      <div className="hero-card">
        <BeanWave />
        {next ? <>
          <p className="hero-next"><small>Шаг {plan.indexOf(next) + 1} из {plan.length} · {next.min}&nbsp;мин</small><b>{next.title}</b>{next.text}</p>
          <button className="btn hero-btn" onClick={() => { begin(); go(next.to) }}>{doneN ? 'Продолжить' : 'Начать'} <Play size={18} fill="currentColor" /></button>
        </> : <p className="hero-next"><b>Программа на сегодня выполнена</b>Можно потренировать слух или сочинить мелодию.</p>}
      </div>
      {!voice && (
        <Link to="/range" className="card cta">
          <strong>Определи свой голос за минуту</strong>
          <span className="muted">Спой несколько нот — и упражнения встанут в удобную для тебя высоту&nbsp;→</span>
        </Link>
      )}
      <div className="card">
        <div className="prog-head">
          <h2>Программа на {minutes} {plural(minutes, ["минуту", "минуты", "минут"])}</h2>
          <span className="muted small">{doneN} из {plan.length} · <Link to="/welcome">цель и время</Link></span>
        </div>
        <ol className="plan">
          {plan.map(p => (
            <li key={p.title} className={p.done ? 'done' : ''}>
              <Link to={p.to} onClick={begin}>
                <span className="min">{p.done ? <Check size={16} /> : `${p.min} мин`}</span>
                <strong>{p.title}</strong><span className="muted">{p.text}</span>
                <ChevronRight size={18} className="chev" />
              </Link>
            </li>
          ))}
        </ol>
      </div>
      {log.length > 0 && <ReminderCard compact />}
      <div className="chips">
        <span>Рабочий диапазон <b>{noteName(work.lo)}–{noteName(work.hi)}</b> ({work.source})</span>
        <span>Сегодня упражнений <b>{today.length}</b></span>
        {log.length > 0 && <span>Точность{log.length > 1 ? `, последние ${Math.min(10, log.length)}` : ''} <b>{Math.round(log.slice(0, 10).reduce((a, l) => a + l.score, 0) / Math.min(10, log.length))}%</b></span>}
      </div>
    </div>
  )
}

import { tr } from '../lib/i18n'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import type { Goal } from './Welcome'
import { startPlan } from '../components/PlanBar'
import { ReminderCard } from '../components/Reminder'
import { Check, ChevronRight, Flame, Play } from 'lucide-react'
import { BeanWave } from '../components/Beans'
import { problemNotes, streak, useStored, useWorkRange, type SessionLog } from '../lib/store'
import { noteName, plural } from '../lib/music'

// программа дня меняется по дням недели, слабое место подставляется из статистики
const BREATH_ROT = [['hiss-metro', tr('Шипящий метроном')], ['horizon', tr('Апподжио «Горизонт»')], ['candle', tr('Свеча')], ['long-s', tr('Длинное «с»')]]
const WARM_ROT = [['lip-trill-5', tr('Губная трель')], ['trill-siren', tr('Трель-сирена')], ['hum', tr('Мычание')], ['ng-siren', tr('«Нг»-сирена')]]
const CALM_ROT = [['mu-triad', tr('Трезвучие «Му»')], ['five-vowels', tr('Пять гласных')], ['scale-9', tr('Гамма на октаву')], ['octave-lift', tr('Октавный лифт')]]
const BLOCKS = [
  [tr('Микст'), 'nay', tr('Нэй-нэй')], [tr('Бэлтинг'), 'ey', tr('Эй-эй')], [tr('Подвижность'), 'stacc-arp', tr('Стаккато по арпеджио')],
  [tr('Микст'), 'gug', tr('Гуг')], [tr('Спокойный звук'), 'dome', tr('Широкий купол')], [tr('Подвижность'), 'penta-down', tr('Пентатонический спуск')], [tr('Микст'), 'octave-jump', tr('Октавный скачок')],
]
const EAR_IDS: Record<string, string> = { '/ear/levels': 'level-', '/ear/sing-interval': 'sing-interval', '/ear/scales': 'scale-sing', '/ear/chords': 'chord-sing', '/ear/melody': 'melody' }
const EAR_ROT = [['/ear/levels', tr('10 уровней точности')], ['/ear/sing-interval', tr('Интервалы голосом')], ['/ear/scales', tr('Гаммы с аккомпанементом')], ['/ear/chords', tr('Пение над аккордами')], ['/ear/melody', tr('Повтори мелодию')]]

// главный блок дня под цель человека
function goalBlock(goal: Goal, d: number) {
  const pick = <T,>(a: T[]) => a[d % a.length]
  switch (goal) {
    case 'range': { const [id, t] = pick([['ng-siren', tr('«Нг»-сирена')], ['octave-lift', tr('Октавный лифт')], ['trill-siren', tr('Трель-сирена')], ['octave-jump', tr('Октавный скачок')]]); return { min: 4, title: tr('Диапазон'), text: t, to: `/ex/${id}`, id } }
    case 'ear': { const [to, t] = pick([['/ear/keys?g=find', tr('Найди ноту на клавиатуре')], ['/ear/degrees', tr('Ступени на слух')], ['/ear/intervals', tr('Узнай интервал')], ['/ear/dictation', tr('Мелодический диктант')]]); return { min: 4, title: tr('Слух — твоя цель'), text: t, to, id: to.includes('keys') ? 'keys-find' : to.slice(5) } }
    case 'breath': { const [id, t] = pick([['long-s', tr('Длинное «с»')], ['hiss-metro', tr('Шипящий метроном')], ['horizon', tr('Апподжио «Горизонт»')]]); return { min: 4, title: tr('Дыхание — твоя цель'), text: t, to: `/breath/${id}`, id } }
    case 'write': return { min: 4, title: tr('Сочинение'), text: tr('Набросай 4 такта мелодии над гармонией'), to: '/compose', id: 'compose' }
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
  const [eTo, eT] = earWeak ? ['/ear/levels', tr('10 уровней точности')] : pick(EAR_ROT, 3)
  const weak = problemNotes(log)[0]
  const full = [
    { min: 2, title: tr('Дыхание'), text: b1t, to: `/breath/${b1}`, id: b1 },
    { min: 3, title: tr('Разогрев'), text: wT, to: `/ex/${wId}`, id: wId },
    // есть устойчивая ошибка на ноте — вместо спокойного звука точечная работа над ней
    ...(weak ? [{ min: 3, title: tr('Твоя трудная нота'), text: tr('{0}: {1} на {2} ц — длинная нота', noteName(weak.m), weak.c > 0 ? tr('завышаешь') : tr('занижаешь'), Math.round(Math.abs(weak.c))), to: `/breath/long-note?note=${weak.m}`, id: 'long-note' }]
      : [{ min: 3, title: tr('Спокойный звук'), text: cT, to: `/ex/${cId}`, id: cId }]),
    { min: earWeak ? 3 : 4, title: tr('Блок дня: {0}', bName.toLowerCase()), text: bEx, to: `/ex/${bId}`, id: bId },
    { min: earWeak ? 4 : 3, title: earWeak ? tr('Слух — слабое место') : tr('Слух'), text: eT, to: eTo, id: EAR_IDS[eTo] },
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
        <h1 className="hero-title">{tr('Пой в своём ритме')}</h1>
        <span className="streak"><Flame size={16} /> {st ? tr('{0} {1} подряд', st, plural(st, [tr('день'), tr('дня'), tr('дней')])) : tr('Первый день')}</span>
      </div>
      <div className="hero-card">
        <BeanWave />
        {next ? <>
          <p className="hero-next"><small>{tr('Шаг')} {plan.indexOf(next) + 1} {tr('из')} {plan.length} · {next.min}{tr(' мин')}</small><b>{next.title}</b>{next.text}</p>
          <button className="btn hero-btn" onClick={() => { begin(); go(next.to) }}>{doneN ? tr('Продолжить') : tr('Начать')} <Play size={18} fill="currentColor" /></button>
        </> : <p className="hero-next"><b>{tr('Программа на сегодня выполнена')}</b>{tr('Можно потренировать слух или сочинить мелодию.')}</p>}
      </div>
      {!voice && (
        <Link to="/range" className="card cta">
          <strong>{tr('Определи свой голос за минуту')}</strong>
          <span className="muted">{tr('Спой несколько нот — и упражнения встанут в удобную для тебя высоту →')}</span>
        </Link>
      )}
      <div className="card">
        <div className="prog-head">
          <h2>{tr('Программа на')} {minutes} {plural(minutes, [tr('минуту'), tr('минуты'), tr('минут')])}</h2>
          <span className="muted small">{doneN} {tr('из')} {plan.length} · <Link to="/welcome">{tr('цель и время')}</Link></span>
        </div>
        <ol className="plan">
          {plan.map(p => (
            <li key={p.title} className={p.done ? 'done' : ''}>
              <Link to={p.to} onClick={begin}>
                <span className="min">{p.done ? <Check size={16} /> : tr('{0} мин', p.min)}</span>
                <strong>{p.title}</strong><span className="muted">{p.text}</span>
                <ChevronRight size={18} className="chev" />
              </Link>
            </li>
          ))}
        </ol>
      </div>
      {log.length > 0 && <ReminderCard compact />}
      <div className="chips">
        <span>{tr('Рабочий диапазон')} <b>{noteName(work.lo)}–{noteName(work.hi)}</b> ({work.source})</span>
        <span>{tr('Сегодня упражнений')} <b>{today.length}</b></span>
        {log.length > 0 && <span>{tr('Точность')}{log.length > 1 ? tr(', последние {0}', Math.min(10, log.length)) : ''} <b>{Math.round(log.slice(0, 10).reduce((a, l) => a + l.score, 0) / Math.min(10, log.length))}%</b></span>}
      </div>
    </div>
  )
}

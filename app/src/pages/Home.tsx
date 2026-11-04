import { Link, useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Flame } from 'lucide-react'
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

function dayPlan(log: SessionLog[]) {
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
  return [
    { min: 2, title: 'Дыхание', text: b1t, to: `/breath/${b1}`, id: b1 },
    { min: 3, title: 'Разогрев', text: wT, to: `/ex/${wId}`, id: wId },
    // есть устойчивая ошибка на ноте — вместо спокойного звука точечная работа над ней
    ...(weak ? [{ min: 3, title: 'Твоя трудная нота', text: `${noteName(weak.m)}: ${weak.c > 0 ? 'завышаешь' : 'занижаешь'} на ${Math.round(Math.abs(weak.c))} ц — длинная нота`, to: `/breath/long-note?note=${weak.m}`, id: 'long-note' }]
      : [{ min: 3, title: 'Спокойный звук', text: cT, to: `/ex/${cId}`, id: cId }]),
    { min: earWeak ? 3 : 4, title: `Блок дня: ${bName.toLowerCase()}`, text: bEx, to: `/ex/${bId}`, id: bId },
    { min: earWeak ? 4 : 3, title: earWeak ? 'Слух — слабое место' : 'Слух', text: eT, to: eTo, id: EAR_IDS[eTo] },
  ]
}

export default function Home() {
  const [voice] = useStored<string | null>('voiceType', null)
  const work = useWorkRange()
  const [log] = useStored<SessionLog[]>('log', [])
  const today = log.filter(l => new Date(l.date).toDateString() === new Date().toDateString())
  const go = useNavigate()
  const st = streak(log)
  const plan = dayPlan(log).map(p => ({ ...p, done: today.some(l => p.id && l.id.startsWith(p.id)) }))
  const doneN = plan.filter(p => p.done).length
  const next = plan.find(p => !p.done)
  return (
    <div className="page">
      <div className="home-head">
        <h1>Сегодня</h1>
        <span className="streak"><Flame size={16} /> {st} {plural(st, ['день', 'дня', 'дней'])} подряд</span>
      </div>
      {!voice && (
        <Link to="/range" className="card cta">
          <strong>Выбери тип голоса</strong>
          <span className="muted">Пока упражнения строятся для баритона. Выбери свой тип — и всё встанет в удобную высоту →</span>
        </Link>
      )}
      <div className="card">
        <div className="prog-head">
          <h2>Программа на 15 минут</h2>
          <span className="muted small">{doneN} из {plan.length}</span>
        </div>
        <ol className="plan">
          {plan.map(p => (
            <li key={p.title} className={p.done ? 'done' : ''}>
              <Link to={p.to}>
                <span className="min">{p.done ? <Check size={16} /> : `${p.min} мин`}</span>
                <strong>{p.title}</strong><span className="muted">{p.text}</span>
                <ChevronRight size={18} className="chev" />
              </Link>
            </li>
          ))}
        </ol>
        {next ? <button className="btn" style={{ marginTop: 12 }} onClick={() => go(next.to)}>{doneN ? 'Продолжить программу' : 'Начать программу'}</button>
          : <p className="ok-msg">Программа на сегодня выполнена.</p>}
      </div>
      <div className="chips">
        <span>Рабочий диапазон <b>{noteName(work.lo)}–{noteName(work.hi)}</b> ({work.source})</span>
        <span>Сегодня упражнений <b>{today.length}</b></span>
        {log.length > 0 && <span>Точность{log.length > 1 ? `, последние ${Math.min(10, log.length)}` : ''} <b>{Math.round(log.slice(0, 10).reduce((a, l) => a + l.score, 0) / Math.min(10, log.length))}%</b></span>}
      </div>
    </div>
  )
}

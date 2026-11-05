import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ear, Feather, MoveVertical, PenLine, Target, Wind } from 'lucide-react'
import { BeanWave } from '../components/Beans'
import { VOICE_TYPES, noteName } from '../lib/music'
import { write } from '../lib/store'

/** Цели — от них зависит программа дня */
export const GOALS = [
  { id: 'pitch', title: 'Чисто попадать в ноты', text: 'Интонация и точность', icon: Target },
  { id: 'range', title: 'Расширить диапазон', text: 'Верх и низ без напряжения', icon: MoveVertical },
  { id: 'ear', title: 'Развить слух', text: 'Слышать и узнавать ноты', icon: Ear },
  { id: 'breath', title: 'Дыхание и выносливость', text: 'Длинные фразы и опора', icon: Wind },
  { id: 'write', title: 'Сочинять песни', text: 'Мелодии и гармония', icon: PenLine },
] as const
export type Goal = typeof GOALS[number]['id']

const VOICE_HINT: Record<string, string> = {
  'Бас': 'самый низкий мужской', 'Баритон': 'средний мужской, самый частый', 'Тенор': 'высокий мужской',
  'Контральто': 'самый низкий женский', 'Меццо-сопрано': 'средний женский, самый частый', 'Сопрано': 'высокий женский',
}

/** Первое знакомство: цель, голос, время — и программа дня собирается под человека */
export default function Welcome() {
  const go = useNavigate()
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [voice, setVoice] = useState<string | null>(null)
  const [min, setMin] = useState<number | null>(null)
  const finish = (to: string) => {
    write('goal', goal ?? 'pitch')
    write('dailyMin', min ?? 15)
    if (voice && voice !== 'unknown') write('voiceType', voice)
    write('onboarded', true)
    go(to, { replace: true })
  }
  return (
    <div className="page welcome">
      <div className="welcome-steps" aria-label={`Шаг ${step + 1} из 4`}>{[0, 1, 2, 3].map(i => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
      {step === 0 && <>
        <h1>Что хочешь прокачать?</h1>
        <p className="lead-narrow muted">Выбери главное — под это соберём программу на каждый день. Поменять можно в любой момент.</p>
        <div className="choice-list">{GOALS.map(g => (
          <button key={g.id} className="choice" aria-pressed={goal === g.id} onClick={() => { setGoal(g.id); setStep(1) }}>
            <g.icon size={22} aria-hidden /><span><b>{g.title}</b><small>{g.text}</small></span>
          </button>
        ))}</div>
      </>}
      {step === 1 && <>
        <h1>Какой у тебя голос?</h1>
        <p className="lead-narrow muted">Упражнения строятся в удобной для голоса высоте. Если не знаешь — ничего страшного, определим позже по пению.</p>
        <button className="choice wide" aria-pressed={voice === 'unknown'} onClick={() => { setVoice('unknown'); setStep(2) }}>
          <Feather size={22} aria-hidden /><span><b>Не знаю</b><small>Начнём со среднего, а замер диапазона подскажет точнее</small></span>
        </button>
        <div className="choice-list two">{VOICE_TYPES.map(v => (
          <button key={v.name} className="choice" aria-pressed={voice === v.name} onClick={() => { setVoice(v.name); setStep(2) }}>
            <span><b>{v.name}</b><small>{VOICE_HINT[v.name]} · <span className="rng">{noteName(v.lo)}–{noteName(v.hi)}</span></small></span>
          </button>
        ))}</div>
        <button className="textbtn back" onClick={() => setStep(0)}>← Назад</button>
      </>}
      {step === 2 && <>
        <h1>Сколько времени в&nbsp;день?</h1>
        <p className="lead-narrow muted">Регулярность важнее длительности: 10&nbsp;минут каждый день дают больше, чем час раз в неделю.</p>
        <div className="choice-list three">{[5, 10, 15].map(m => (
          <button key={m} className="choice center" aria-pressed={min === m} onClick={() => { setMin(m); setStep(3) }}>
            <b className="big">{m}</b><small>минут</small>
          </button>
        ))}</div>
        <button className="textbtn back" onClick={() => setStep(1)}>← Назад</button>
      </>}
      {step === 3 && <>
        <div className="hero-card welcome-done">
          <BeanWave />
          <div>
            <h1>Программа готова</h1>
            <p className="summary">{GOALS.find(g => g.id === goal)?.title} · {voice && voice !== 'unknown' ? voice.toLowerCase() : 'голос\u00a0определим'} · {min}&nbsp;минут в&nbsp;день</p>
            <p>Каждый день: {goal === 'write' ? 'разогрев и сочинение' : goal === 'ear' ? 'разогрев и упражнения на слух' : goal === 'range' ? 'дыхание, разогрев и работа с диапазоном' : goal === 'breath' ? 'дыхание, разогрев и длинные фразы' : 'дыхание, разогрев и точность'}. Прогресс будет виден в&nbsp;цифрах.</p>
          </div>
          <button className="btn hero-btn" onClick={() => finish('/')}>Начать</button>
        </div>
        {voice === 'unknown' && <button className="btn ghost" onClick={() => finish('/range')}>Сначала определить голос</button>}
      </>}
    </div>
  )
}

import { tr } from '../lib/i18n'
import LangSwitch from '../components/LangSwitch'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ear, Feather, MoveVertical, PenLine, Target, Wind } from 'lucide-react'
import { BeanWave } from '../components/Beans'
import { VOICE_TYPES, noteName } from '../lib/music'
import { write } from '../lib/store'

/** Цели — от них зависит программа дня */
export const GOALS = [
  { id: 'pitch', title: tr('Чисто попадать в ноты'), text: tr('Интонация и точность'), icon: Target },
  { id: 'range', title: tr('Расширить диапазон'), text: tr('Верх и низ без напряжения'), icon: MoveVertical },
  { id: 'ear', title: tr('Развить слух'), text: tr('Слышать и узнавать ноты'), icon: Ear },
  { id: 'breath', title: tr('Дыхание и выносливость'), text: tr('Длинные фразы и опора'), icon: Wind },
  { id: 'write', title: tr('Сочинять песни'), text: tr('Мелодии и гармония'), icon: PenLine },
] as const
export type Goal = typeof GOALS[number]['id']

const VOICE_HINT: Record<string, string> = {
  'Бас': tr('самый низкий мужской'), 'Баритон': tr('средний мужской, самый частый'), 'Тенор': tr('высокий мужской'),
  'Контральто': tr('самый низкий женский'), 'Меццо-сопрано': tr('средний женский, самый частый'), 'Сопрано': tr('высокий женский'),
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
      <div className="welcome-steps" aria-label={tr('Шаг {0} из 4', step + 1)}>{[0, 1, 2, 3].map(i => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
      {step === 0 && <>
        <LangSwitch className="welcome-lang" />
        <h1>{tr('Что хочешь прокачать?')}</h1>
        <p className="lead-narrow muted">{tr('Выбери главное — под это соберём программу на каждый день. Поменять можно в любой момент.')}</p>
        <div className="choice-list">{GOALS.map(g => (
          <button key={g.id} className="choice" aria-pressed={goal === g.id} onClick={() => { setGoal(g.id); setStep(1) }}>
            <g.icon size={22} aria-hidden /><span><b>{g.title}</b><small>{g.text}</small></span>
          </button>
        ))}</div>
      </>}
      {step === 1 && <>
        <h1>{tr('Какой у тебя голос?')}</h1>
        <p className="lead-narrow muted">{tr('Упражнения строятся в удобной для голоса высоте. Если не знаешь — ничего страшного, определим позже по пению.')}</p>
        <button className="choice wide" aria-pressed={voice === 'unknown'} onClick={() => { setVoice('unknown'); setStep(2) }}>
          <Feather size={22} aria-hidden /><span><b>{tr('Не знаю')}</b><small>{tr('Начнём со среднего, а замер диапазона подскажет точнее')}</small></span>
        </button>
        <div className="choice-list two">{VOICE_TYPES.map(v => (
          <button key={v.id} className="choice" aria-pressed={voice === v.id} onClick={() => { setVoice(v.id); setStep(2) }}>
            <span><b>{v.name}</b><small>{VOICE_HINT[v.id]} · <span className="rng">{noteName(v.lo)}–{noteName(v.hi)}</span></small></span>
          </button>
        ))}</div>
        <button className="textbtn back" onClick={() => setStep(0)}>{tr('← Назад')}</button>
      </>}
      {step === 2 && <>
        <h1>{tr('Сколько времени в день?')}</h1>
        <p className="lead-narrow muted">{tr('Регулярность важнее длительности: 10 минут каждый день дают больше, чем час раз в неделю.')}</p>
        <div className="choice-list three">{[5, 10, 15].map(m => (
          <button key={m} className="choice center" aria-pressed={min === m} onClick={() => { setMin(m); setStep(3) }}>
            <b className="big">{m}</b><small>{tr('минут')}</small>
          </button>
        ))}</div>
        <button className="textbtn back" onClick={() => setStep(1)}>{tr('← Назад')}</button>
      </>}
      {step === 3 && <>
        <div className="hero-card welcome-done">
          <BeanWave />
          <div>
            <h1>{tr('Программа готова')}</h1>
            <p className="summary">{GOALS.find(g => g.id === goal)?.title} · {voice && voice !== 'unknown' ? tr(voice).toLowerCase() : tr('голос определим')} · {min}{tr(' минут в день')}</p>
            <p>{tr('Каждый день:')} {goal === 'write' ? tr('разогрев и сочинение') : goal === 'ear' ? tr('разогрев и упражнения на слух') : goal === 'range' ? tr('дыхание, разогрев и работа с диапазоном') : goal === 'breath' ? tr('дыхание, разогрев и длинные фразы') : tr('дыхание, разогрев и точность')}{tr('. Прогресс будет виден в цифрах.')}</p>
          </div>
          <button className="btn hero-btn" onClick={() => finish('/')}>{tr('Начать')}</button>
        </div>
        {voice === 'unknown' && <button className="btn ghost" onClick={() => finish('/range')}>{tr('Сначала определить голос')}</button>}
      </>}
    </div>
  )
}

import { tr } from '../lib/i18n'
import LangSwitch from '../components/LangSwitch'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Feather } from 'lucide-react'
import { BeanWave } from '../components/Beans'
import { FormatPicker, GoalPicker, SkillPicker } from '../components/PlanSettings'
import { GOAL_LABEL } from '../lib/dayPlan'
import { VOICE_TYPES, noteName } from '../lib/music'
import { DEFAULT_SKILL_PROFILE, readGoals, write, writeGoals, type Goal, type PlanMode, type SkillProfile } from '../lib/store'

const VOICE_HINT: Record<string, string> = {
  'Бас': tr('самый низкий мужской'), 'Баритон': tr('средний мужской, самый частый'), 'Тенор': tr('высокий мужской'),
  'Контральто': tr('самый низкий женский'), 'Меццо-сопрано': tr('средний женский, самый частый'), 'Сопрано': tr('высокий женский'),
}

/** Первое знакомство: цели, опыт, формат, голос, время — и программа дня собирается под человека */
export default function Welcome() {
  // в приветствии нижнее меню не показываем — сначала настройка
  useEffect(() => { document.documentElement.dataset.welcome = '1'; return () => { delete document.documentElement.dataset.welcome } }, [])
  const go = useNavigate()
  const [step, setStep] = useState(0)
  const [goals, setGoals] = useState<Goal[]>(() => readGoals())
  const [skill, setSkill] = useState<SkillProfile>({ ...DEFAULT_SKILL_PROFILE })
  const [mode, setMode] = useState<PlanMode>('split')
  const [voice, setVoice] = useState<string | null>(null)
  const [min, setMin] = useState<number>(15)
  const newbie = skill.ear === 'none' && skill.vocal === 'none'

  const finish = (to: string) => {
    writeGoals(goals)
    write('skillProfile', skill)
    write('planMode', goals.length >= 2 ? mode : 'mix')
    write('dailyMin', min)
    if (voice && voice !== 'unknown') write('voiceType', voice)
    write('onboarded', true)
    go(to, { replace: true })
  }

  const goalSummary = goals.map(g => GOAL_LABEL[g]).join(', ')

  return (
    <div className="page welcome">
      <div className="welcome-steps" aria-label={tr('Шаг {0} из 5', step + 1)}>{[0, 1, 2, 3, 4].map(i => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
      {step === 0 && <>
        <LangSwitch className="welcome-lang" />
        <h1>{tr('Что хочешь прокачать?')}</h1>
        <p className="lead-narrow muted">{tr('Можно выбрать одну или несколько целей — под них соберём программу. Поменять можно в любой момент.')}</p>
        <GoalPicker goals={goals} onChange={setGoals} />
        <button className="btn hero-btn" disabled={!goals.length} onClick={() => setStep(1)}>{tr('Дальше')}</button>
      </>}
      {step === 1 && <>
        <h1>{tr('Твой опыт сейчас')}</h1>
        <p className="lead-narrow muted">{tr('Чтобы не перегружать план в первые недели и сразу дать посильные шаги.')}</p>
        <SkillPicker skill={skill} onChange={next => {
          setSkill(next)
          if (next.ear === 'none' && next.vocal === 'none') setMode('split')
        }} />
        {goals.length >= 2 && (
          <div className="welcome-format">
            <h2>{tr('Как распределить выбранные цели?')}</h2>
            <FormatPicker mode={mode} onChange={setMode} newbie={newbie} />
          </div>
        )}
        <div className="welcome-nav">
          <button className="textbtn back" onClick={() => setStep(0)}>{tr('← Назад')}</button>
          <button className="btn hero-btn" onClick={() => setStep(2)}>{tr('Дальше')}</button>
        </div>
      </>}
      {step === 2 && <>
        <h1>{tr('Какой у тебя голос?')}</h1>
        <p className="lead-narrow muted">{tr('Упражнения строятся в удобной для голоса высоте. Если не знаешь — ничего страшного, определим позже по пению.')}</p>
        <button className="choice wide" aria-pressed={voice === 'unknown'} onClick={() => { setVoice('unknown'); setStep(3) }}>
          <Feather size={22} aria-hidden /><span><b>{tr('Не знаю')}</b><small>{tr('Начнём со среднего, а замер диапазона подскажет точнее')}</small></span>
        </button>
        <div className="choice-list two">{VOICE_TYPES.map(v => (
          <button key={v.id} className="choice" aria-pressed={voice === v.id} onClick={() => { setVoice(v.id); setStep(3) }}>
            <span><b>{v.name}</b><small>{VOICE_HINT[v.id]} · <span className="rng">{noteName(v.lo)}–{noteName(v.hi)}</span></small></span>
          </button>
        ))}</div>
        <button className="textbtn back" onClick={() => setStep(1)}>{tr('← Назад')}</button>
      </>}
      {step === 3 && <>
        <h1>{tr('Сколько времени в\u00a0день?')}</h1>
        <p className="lead-narrow muted">{tr('Регулярность важнее длительности: 10\u00a0минут каждый день дают больше, чем час раз в неделю.')}</p>
        <div className="choice-list three">{[5, 10, 15].map(m => (
          <button key={m} className="choice center" aria-pressed={min === m} onClick={() => { setMin(m); setStep(4) }}>
            <b className="big">{m}</b><small>{tr('минут')}</small>
          </button>
        ))}</div>
        <button className="textbtn back" onClick={() => setStep(2)}>{tr('← Назад')}</button>
      </>}
      {step === 4 && <>
        <div className="hero-card welcome-done">
          <BeanWave />
          <div>
            <h1>{tr('Программа готова')}</h1>
            <p className="summary">{goalSummary} · {voice && voice !== 'unknown' ? tr(voice).toLowerCase() : tr('голос\u00a0определим')} · {min}{tr('\u00a0минут в\u00a0день')}</p>
            <p>{goals.length >= 2
              ? (mode === 'split' ? tr('Направления чередуются по дням, чтобы спокойно проработать каждое.') : tr('Выбранные направления объединены в одном плане дня.'))
              : tr('Каждый день: программа под выбранную цель, дыхание и точность.')} {tr('Прогресс будет виден в\u00a0цифрах.')}</p>
          </div>
          <button className="btn hero-btn" onClick={() => finish('/')}>{tr('Начать')}</button>
        </div>
        {voice === 'unknown' && <button className="btn ghost" onClick={() => finish('/range')}>{tr('Сначала определить голос')}</button>}
        <button className="textbtn back" onClick={() => setStep(3)}>{tr('← Назад')}</button>
      </>}
    </div>
  )
}

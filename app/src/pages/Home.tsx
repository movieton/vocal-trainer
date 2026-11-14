import { tr } from '../lib/i18n'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { buildDayPlan, DOMAIN_META, GOAL_LABEL, type Domain } from '../lib/dayPlan'
import { startPlan } from '../lib/plan'
import { ReminderCard } from '../components/Reminder'
import { CourseCard, idMatch, useCourse } from './Course'
import { Check, ChevronRight, Flame, Play, SlidersHorizontal } from 'lucide-react'
import { BeanWave } from '../components/Beans'
import {
  DEFAULT_SKILL_PROFILE,
  problemNotes,
  streak,
  useGoals,
  useStored,
  useWorkRange,
  type Goal,
  type PlanFocus,
  type PlanMode,
  type SessionLog,
  type SkillProfile,
} from '../lib/store'
import { noteName, plural } from '../lib/music'

type HomePlanStep = {
  min: number
  title: string
  text: string
  to: string
  id?: string
  domain?: Domain
  done: boolean
}

export default function Home() {
  const [onboarded] = useStored('onboarded', false)
  const [goals] = useGoals()
  const [legacyGoal] = useStored<Goal>('goal', 'pitch')
  const [minutes] = useStored('dailyMin', 15)
  const [skillProfile] = useStored<SkillProfile>('skillProfile', DEFAULT_SKILL_PROFILE)
  const [planMode] = useStored<PlanMode>('planMode', 'mix')
  const [planFocus, setPlanFocus] = useStored<PlanFocus>('planFocus', null)
  const [homeMode, setHomeMode] = useStored<'auto' | 'course' | 'plan'>('homeMode', 'auto')
  const [voice] = useStored<string | null>('voiceType', null)
  const work = useWorkRange()
  const [log] = useStored<SessionLog[]>('log', [])
  const todayStr = new Date().toDateString()
  const today = log.filter(l => new Date(l.date).toDateString() === todayStr)
  const go = useNavigate()
  const st = streak(log)
  const [planDone] = useStored<{ day: string; tos: string[] }>('plan.done', { day: '', tos: [] })
  const doneTos = planDone.day === todayStr ? planDone.tos : []

  // курс доступен, если есть следующий день и не сработало ограничение на сегодня
  const course = useCourse()
  const cDay = course.current
  const courseAvailable = !!cDay && !course.locked
  const fresh = !log.length && course.doneN === 0
  const courseOn = courseAvailable && (
    homeMode === 'course' || (homeMode === 'auto' && (course.doneN > 0 || course.p.active != null || fresh))
  )

  const dayRes = buildDayPlan({ log, goals, legacyGoal, minutes, skillProfile, planMode, planFocus, todayStr })
  const plan: HomePlanStep[] = courseOn
    ? course.steps(cDay!).map((s, i) => ({ ...s, done: course.stepDone(cDay!, i) }))
    : dayRes.steps.map(p => ({ ...p, done: doneTos.includes(p.to) || today.some(l => p.id && idMatch(l.id, p.id)) }))

  const begin = (to?: string) => (courseOn ? course.open(cDay!, to) : startPlan(plan.map(({ to, title, text }) => ({ to, title, text }))))
  const doneN = plan.filter(p => p.done).length
  const hits = today.reduce((a, l) => a + (l.hits ?? 0), 0)
  const newbieNotes = !log.length || Date.now() - log[log.length - 1].date < 7 * 864e5
  const goalHits = newbieNotes ? 100 : Math.max(100, minutes * 20)
  const next = plan.find(p => !p.done)
  const showWeakSummary = !courseOn && problemNotes(log).length > 0

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
          <p className="hero-next"><small>{tr('Шаг')} {plan.indexOf(next) + 1} {tr('из')} {plan.length} · {next.min}{tr('\u00a0мин')}</small><b>{next.title}</b>{next.text}</p>
          <button className="btn hero-btn" onClick={() => { begin(next.to); go(next.to) }}>{doneN ? tr('Продолжить') : tr('Начать')} <Play size={18} fill="currentColor" /></button>
        </> : <p className="hero-next"><b>{tr('Программа на сегодня выполнена')}</b>{tr('Можно потренировать слух или сочинить мелодию.')}</p>}
      </div>

      <div className="card">
        {courseAvailable && (
          <div className="home-mode-bar">
            <div className="seg" role="group" aria-label={tr('Режим программы')}>
              <button type="button" aria-pressed={courseOn} onClick={() => setHomeMode('course')}>{tr('Курс 30 дней')}</button>
              <button type="button" aria-pressed={!courseOn} onClick={() => setHomeMode('plan')}>{tr('Мой план')}</button>
            </div>
            <Link to="/plan-setup" className="textbtn plan-setup-link"><SlidersHorizontal size={15} /> {tr('Настроить цели и план')}</Link>
          </div>
        )}

        <div className="prog-head">
          {courseOn ? <h2>{tr('День {0} из 30: {1}', cDay!.n, cDay!.title)}</h2> : <h2>{tr('Программа на')} {minutes} {plural(minutes, [tr('минуту'), tr('минуты'), tr('минут')])}</h2>}
          <span className="muted small">
            {tr('готово {0} из {1}', doneN, plan.length)} ·{' '}
            {courseOn
              ? <Link to="/course">{tr('весь курс')}</Link>
              : !courseAvailable && <Link to="/plan-setup">{tr('Настроить цели и план')}</Link>}
          </span>
        </div>

        {!courseOn && dayRes.goals.length >= 2 && dayRes.mode === 'split' && dayRes.focusGoal && (
          <div className="focus-bar">
            <span className="muted small">{tr('Фокус сегодня:')} <b>{GOAL_LABEL[dayRes.focusGoal]}</b></span>
            <div className="focus-pills" role="group" aria-label={tr('Сменить фокус дня')}>
              {dayRes.goals.map(g => (
                <button
                  key={g}
                  type="button"
                  className={'focus-pill' + (g === dayRes.focusGoal ? ' on' : '')}
                  aria-pressed={g === dayRes.focusGoal}
                  onClick={() => setPlanFocus({ day: todayStr, goal: g })}
                >
                  {GOAL_LABEL[g]}
                </button>
              ))}
            </div>
          </div>
        )}

        {!courseOn && dayRes.overloadProtected && (
          <p className="muted small" style={{ margin: '6px 0 0' }}>{tr('Лёгкий старт: бережём голос и слух без перегрузки')}</p>
        )}

        <ol className="plan">
          {plan.map((p, i) => (
            <li key={`${p.id ?? p.to}-${i}`} className={p.done ? 'done' : p === next ? 'cur' : ''}>
              <Link to={p.to} onClick={() => begin(p.to)}>
                <span className="min">{p.done ? <Check size={16} /> : p === next ? tr('сейчас') : tr('{0} мин', p.min)}</span>
                <strong className="plan-title">
                  {p.domain && <span className={`dom-tag dom-${p.domain}`}>{DOMAIN_META[p.domain].label}</span>}
                  <span>{p.title}</span>
                </strong>
                <span className="muted">{p.text}</span>
                <ChevronRight size={18} className="chev" />
              </Link>
            </li>
          ))}
        </ol>
      </div>

      {log.length > 0 && <div className="card notes-goal">
        <div className="ng-head"><b>{tr('Цель дня: {0} чистых нот', goalHits)}</b><span className={'muted small' + (hits >= goalHits ? ' done' : '')}>{hits >= goalHits ? tr('Выполнено') : tr('{0} из {1}', hits, goalHits)}</span></div>
        <div className="cc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={goalHits} aria-valuenow={Math.min(hits, goalHits)}><i style={{ width: `${Math.min(100, (hits / goalHits) * 100)}%` }} /></div>
        {hits === 0 && <span className="muted small">{tr('Чисто спетые ноты во всех упражнениях с оценкой.')}</span>}
      </div>}

      {!voice && !courseOn && (
        <Link to="/range" className="card cta">
          <strong>{tr('Определи свой голос за минуту')}</strong>
          <span className="muted">{tr('Спой несколько нот — и упражнения встанут в удобную для тебя высоту\u00a0→')}</span>
        </Link>
      )}
      {!courseOn && <CourseCard />}
      {(onboarded || log.length > 0) && <ReminderCard compact />}
      {(voice || log.length > 0 || showWeakSummary) && <div className="chips">
        {voice && <span>{tr('Рабочий диапазон')} <b>{noteName(work.lo)}–{noteName(work.hi)}</b> ({work.source})</span>}
        {log.length > 0 && <span>{tr('Сегодня упражнений')} <b>{today.length}</b></span>}
        {log.length > 0 && <span>{tr('Точность')}{log.length > 1 ? tr(', последние {0}', Math.min(10, log.length)) : ''} <b>{Math.round(log.slice(0, 10).reduce((a, l) => a + l.score, 0) / Math.min(10, log.length))}%</b></span>}
      </div>}
    </div>
  )
}

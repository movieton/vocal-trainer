import { tr } from '../lib/i18n'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, ChevronRight, Lock, Play } from 'lucide-react'
import { COURSE, WEEKS, type CourseDay } from '../data/course'
import { startPlan } from '../components/PlanBar'
import { useStored, type SessionLog } from '../lib/store'

/** Прогресс курса: когда закрыт каждый день и какой день сейчас в работе */
type Progress = { done: Record<number, number>; active: { n: number; since: number; visited: string[] } | null }
const EMPTY: Progress = { done: {}, active: null }
const today = () => new Date().toDateString()
/** Точное совпадение id; id с дефисом на конце (level-) — семейство упражнений */
export const idMatch = (logId: string, id: string) => logId === id || (id.endsWith('-') && logId.startsWith(id))
/** Больше двух дней курса за один календарный день не открываем — голосу нужен отдых */
const PER_DAY = 2

/** Пока голос не определён — первым шагом дня 1 замер голоса */
const rangeStep = () => ({ to: '/range', title: tr('Замер'), text: tr('Определи свой голос: спой несколько нот'), id: 'range', min: 2 })

export function useCourse() {
  const [p, setP] = useStored<Progress>('course', EMPTY)
  const [log] = useStored<SessionLog[]>('log', [])
  const [voice] = useStored<string | null>('voiceType', null)
  const steps = (day: CourseDay) => day.n === 1 && !voice && !p.done[1] ? [rangeStep(), ...day.steps] : day.steps
  const doneN = Object.keys(p.done).length
  const current = COURSE.find(d => !p.done[d.n]) ?? null
  const doneToday = Object.values(p.done).filter(t => new Date(t).toDateString() === today()).length
  const locked = !!current && doneToday >= PER_DAY && p.active?.n !== current.n

  const stepDone = (day: CourseDay, i: number) => {
    const a = p.active
    if (!a || a.n !== day.n) return !!p.done[day.n]
    const s = steps(day)[i]
    if (!s) return false
    return a.visited.includes(s.to) && s.id === 'range' || log.some(l => l.date >= a.since && idMatch(l.id, s.id))
  }

  // все шаги дня засчитаны — закрываем день
  useEffect(() => {
    const a = p.active
    if (!a || p.done[a.n]) return
    const day = COURSE[a.n - 1]
    if (steps(day).every((_, i) => stepDone(day, i))) setP({ done: { ...p.done, [a.n]: Date.now() }, active: null })
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const open = (day: CourseDay, to?: string) => {
    const a = p.active?.n === day.n ? p.active : { n: day.n, since: Date.now(), visited: [] }
    setP({ ...p, active: to ? { ...a, visited: [...new Set([...a.visited, to])] } : a })
    startPlan(steps(day).map(({ to, title, text }) => ({ to, title: tr('День {0}: {1}', day.n, title.toLowerCase()), text })))
  }
  return { p, doneN, current, locked, stepDone, open, steps }
}

/** Карточка курса на главной */
export function CourseCard() {
  const { doneN, current, locked, stepDone, open, steps } = useCourse()
  const go = useNavigate()
  if (!current) return (
    <Link to="/course" className="card course-card">
      <span className="cc-top"><b>{tr('Курс «Первые 30\u00a0дней» пройден')}</b><span className="muted small">30/30</span></span>
      <span className="muted">{tr('Можно пройти любой день заново.')}</span>
    </Link>
  )
  const next = steps(current).find((_, i) => !stepDone(current, i)) ?? steps(current)[0]
  return (
    <div className="card course-card">
      <Link to="/course" className="cc-top">
        <b>{tr('Курс «Первые 30\u00a0дней»')}</b>
        <span className="muted small">{tr('День {0} из 30', current.n)} <ChevronRight size={14} aria-hidden /></span>
      </Link>
      <div className="cc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={30} aria-valuenow={doneN}><i style={{ width: `${(doneN / 30) * 100}%` }} /></div>
      <p className="cc-day"><strong>{current.title}</strong><span className="muted">{current.idea}</span></p>
      {locked
        ? <p className="muted small cc-rest">{tr('На сегодня хватит: два дня курса уже пройдено. Продолжим завтра.')}</p>
        : <button className="btn ghost" onClick={() => { open(current, next.to); go(next.to) }}>{doneN || stepDone(current, 0) ? tr('Продолжить') : tr('Начать день {0}', current.n)} <Play size={16} fill="currentColor" /></button>}
    </div>
  )
}

export default function Course() {
  const { p, doneN, current, locked, stepDone, open, steps } = useCourse()
  const go = useNavigate()
  return (
    <div className="page course">
      <p className="crumbs"><Link to="/">{tr('Сегодня')}</Link> / {tr('Первые 30 дней')}</p>
      <h1>{tr('Первые 30 дней')}</h1>
      <p className="muted">{tr('По 10–12 минут в день. Каждый день — три коротких шага из библиотеки. Пропустил день — ничего страшного, курс подождёт.')}</p>
      <div className="cc-bar big" role="progressbar" aria-valuemin={0} aria-valuemax={30} aria-valuenow={doneN}><i style={{ width: `${(doneN / 30) * 100}%` }} /></div>
      <p className="muted small">{tr('Пройдено {0} из 30', doneN)}</p>
      {WEEKS.map((w, wi) => (
        <details key={wi} className="card week" open={wi <= Math.min(3, Math.floor(((current?.n ?? 30) - 1) / 7))}>
          <summary><h2>{tr('Неделя {0}. {1}', wi + 1, w.title)}</h2>
          <p className="muted small">{w.text}</p></summary>
          <ol className="course-days">
            {COURSE.filter(d => Math.min(3, Math.floor((d.n - 1) / 7)) === wi).map(d => {
              const done = !!p.done[d.n], cur = current?.n === d.n, closed = !done && !cur
              return (
                <li key={d.n} className={done ? 'done' : cur ? 'cur' : ''}>
                  <div className="cd-head">
                    <span className="cd-n">{done ? <Check size={16} aria-label={tr('пройден')} /> : closed ? <Lock size={14} aria-label={tr('впереди')} /> : d.n}</span>
                    <span><strong>{tr('День {0}. {1}', d.n, d.title)}</strong><span className="muted small">{d.idea}</span></span>
                  </div>
                  {cur && (
                    <ul className="cd-steps">
                      {steps(d).map((s, i) => {
                        const ok = stepDone(d, i), off = cur && locked
                        return (
                          <li key={i} className={ok ? 'ok' : ''}>
                            <button disabled={off} onClick={() => { open(d, s.to); go(s.to) }}>
                              <span className="min">{ok ? <Check size={15} /> : tr('{0} мин', s.min)}</span>
                              <span className="cd-lbl"><b>{s.title}</b><span className="muted">{s.text}</span></span>
                              <ChevronRight size={16} className="chev" aria-hidden />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {cur && locked && <p className="muted small cc-rest">{tr('На сегодня хватит: два дня курса уже пройдено. Продолжим завтра.')}</p>}
                </li>
              )
            })}
          </ol>
        </details>
      ))}
    </div>
  )
}

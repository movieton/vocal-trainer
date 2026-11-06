import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, ChevronRight, X } from 'lucide-react'
import { read, useStored, write, type SessionLog } from '../lib/store'

/** Программа дня, которую человек начал с главной: какой шаг сейчас и что уже сделано */
export type PlanItem = { to: string; title: string; text: string }
type Active = { day: string; items: PlanItem[] }
const today = () => new Date().toDateString()
const pathOf = (to: string) => to.split('?')[0]

/** Отметить шаг программы выполненным (сегодня) */
export function markPlanDone(to: string) {
  const d = read<{ day: string; tos: string[] }>('plan.done', { day: '', tos: [] })
  const tos = d.day === today() ? d.tos : []
  if (!tos.includes(to)) write('plan.done', { day: today(), tos: [...tos, to] })
}
export const startPlan = (items: PlanItem[]) => write('plan.active', { day: today(), items })

/**
 * Плашка «Засчитано — дальше». Появляется, когда закончено упражнение из программы дня,
 * и ведёт к следующему шагу, а не обратно к первому.
 */
export function PlanBar() {
  const [log] = useStored<SessionLog[]>('log', [])
  const [active] = useStored<Active | null>('plan.active', null)
  const loc = useLocation()
  const go = useNavigate()
  const seen = useRef(log[0]?.date ?? 0)
  const [done, setDone] = useState<{ item: PlanItem; next: PlanItem | null } | null>(null)

  useEffect(() => {
    const latest = log[0]?.date ?? 0
    if (latest <= seen.current) return
    seen.current = latest
    if (!active || active.day !== today()) return
    const i = active.items.findIndex(it => pathOf(it.to) === loc.pathname)
    if (i < 0) return
    markPlanDone(active.items[i].to)
    const doneTos = read<{ day: string; tos: string[] }>('plan.done', { day: '', tos: [] }).tos
    const next = active.items.find((it, k) => k > i && !doneTos.includes(it.to)) ?? active.items.find(it => !doneTos.includes(it.to)) ?? null
    setDone({ item: active.items[i], next })
  }, [log, active, loc.pathname])

  // ушли со страницы упражнения — плашка больше не нужна
  useEffect(() => { if (done && !active?.items.some(it => pathOf(it.to) === loc.pathname)) setDone(null) }, [loc.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // пока плашка видна, у страницы снизу есть место — она не закрывает кнопки и доску
  useEffect(() => {
    document.documentElement.classList.toggle('has-planbar', !!done)
    return () => document.documentElement.classList.remove('has-planbar')
  }, [done])

  if (!done) return null
  return (
    <div className="plan-bar" role="status">
      <span className="pb-check"><Check size={18} /></span>
      <div className="pb-text">
        <b>{done.item.title} — засчитано</b>
        <span>{done.next ? `Дальше: ${done.next.title.toLowerCase()} · ${done.next.text}` : 'Программа на сегодня выполнена'}</span>
      </div>
      <button className="btn" onClick={() => { setDone(null); go(done.next ? done.next.to : '/') }}>{done.next ? <>Дальше <ChevronRight size={16} /></> : 'На главную'}</button>
      <button className="textbtn pb-close" aria-label="Закрыть" onClick={() => setDone(null)}><X size={18} /></button>
    </div>
  )
}

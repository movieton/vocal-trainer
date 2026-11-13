import { read, write } from './store'

/** Программа дня, которую человек начал с главной: какой шаг сейчас и что уже сделано */
export type PlanItem = { to: string; title: string; text: string }
export type ActivePlan = { day: string; items: PlanItem[] }
export const planToday = () => new Date().toDateString()

/** Отметить шаг программы выполненным (сегодня) */
export function markPlanDone(to: string) {
  const d = read<{ day: string; tos: string[] }>('plan.done', { day: '', tos: [] })
  const tos = d.day === planToday() ? d.tos : []
  if (!tos.includes(to)) write('plan.done', { day: planToday(), tos: [...tos, to] })
}

export const startPlan = (items: PlanItem[]) => write('plan.active', { day: planToday(), items })

import { tr } from './i18n'
import { Ear, MoveVertical, PenLine, Target, Wind, type LucideIcon } from 'lucide-react'
import type { Goal } from './store'

export type GoalMeta = { id: Goal; title: string; text: string; icon: LucideIcon }

/** Цели — от них зависит программа дня */
export const GOALS: readonly GoalMeta[] = [
  { id: 'pitch', title: tr('Чисто попадать в ноты'), text: tr('Интонация и точность'), icon: Target },
  { id: 'range', title: tr('Расширить диапазон'), text: tr('Верх и низ без напряжения'), icon: MoveVertical },
  { id: 'ear', title: tr('Развить слух'), text: tr('Слышать и узнавать ноты'), icon: Ear },
  { id: 'breath', title: tr('Дыхание и выносливость'), text: tr('Длинные фразы и опора'), icon: Wind },
  { id: 'write', title: tr('Сочинять песни'), text: tr('Мелодии и гармония'), icon: PenLine },
]

export function toggleGoalList(current: Goal[], id: Goal): Goal[] {
  if (current.includes(id)) {
    return current.length > 1 ? current.filter(g => g !== id) : current
  }
  return [...current, id]
}

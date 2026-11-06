import { tr } from './i18n'
import type { SessionLog } from './store'

/**
 * Достижения-фасолины. Считаются из уже сохранённых данных — отдельно ничего не копим,
 * поэтому они сами переезжают между устройствами вместе с прогрессом.
 */
export type Data = {
  log: SessionLog[]; notationDone: string[]; kgBest: Record<string, number>
  rangeHist: unknown[]; threshold: unknown[]
}
export type Achievement = { id: string; title: string; how: string; got: (d: Data) => boolean }

const dayKey = (t: number) => new Date(t).toDateString()
export function bestStreak(log: SessionLog[]) {
  const days = [...new Set(log.map(l => dayKey(l.date)))].map(d => +new Date(d)).sort((a, b) => a - b)
  let best = 0, cur = 0
  days.forEach((d, i) => { cur = i && Math.round((d - days[i - 1]) / 864e5) === 1 ? cur + 1 : 1; best = Math.max(best, cur) })
  return best
}
const kinds = (log: SessionLog[]) => new Set(log.map(l => l.id)).size

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', title: tr('Первая нота'), how: tr('Закончи первое упражнение'), got: d => d.log.length >= 1 },
  { id: 'streak3', title: tr('Три дня подряд'), how: tr('Занимайся 3 дня без пропуска'), got: d => bestStreak(d.log) >= 3 },
  { id: 'streak7', title: tr('Неделя'), how: tr('7 дней подряд'), got: d => bestStreak(d.log) >= 7 },
  { id: 'streak30', title: tr('Месяц голоса'), how: tr('30 дней подряд'), got: d => bestStreak(d.log) >= 30 },
  { id: 's10', title: tr('Разогретый'), how: tr('10 упражнений'), got: d => d.log.length >= 10 },
  { id: 's100', title: tr('Сотня'), how: tr('100 упражнений'), got: d => d.log.length >= 100 },
  { id: 'acc90', title: tr('Точно в ноту'), how: tr('Распевка с точностью от 90%'), got: d => d.log.some(l => l.kind === 'exercise' && l.score >= 90) },
  { id: 'variety', title: tr('Разносторонний'), how: tr('15 разных упражнений'), got: d => kinds(d.log) >= 15 },
  { id: 'range', title: tr('Знаю свой голос'), how: tr('Замерь диапазон'), got: d => d.rangeHist.length >= 1 },
  { id: 'ear', title: tr('Тонкий слух'), how: tr('Сделай замер порога слуха'), got: d => d.threshold.length >= 1 },
  { id: 'keys3', title: tr('Три звезды'), how: tr('Пройди игру с клавиатурой на 90%'), got: d => Object.values(d.kgBest).some(v => v >= 90) },
  { id: 'notation', title: tr('Читаю ноты'), how: tr('Пройди все 8 уроков нотной грамоты'), got: d => d.notationDone.length >= 8 },
]

export const earned = (d: Data) => ACHIEVEMENTS.filter(a => a.got(d)).map(a => a.id)

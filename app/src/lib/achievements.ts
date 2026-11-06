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
  { id: 'first', title: 'Первая нота', how: 'Закончи первое упражнение', got: d => d.log.length >= 1 },
  { id: 'streak3', title: 'Три дня подряд', how: 'Занимайся 3 дня без пропуска', got: d => bestStreak(d.log) >= 3 },
  { id: 'streak7', title: 'Неделя', how: '7 дней подряд', got: d => bestStreak(d.log) >= 7 },
  { id: 'streak30', title: 'Месяц голоса', how: '30 дней подряд', got: d => bestStreak(d.log) >= 30 },
  { id: 's10', title: 'Разогретый', how: '10 упражнений', got: d => d.log.length >= 10 },
  { id: 's100', title: 'Сотня', how: '100 упражнений', got: d => d.log.length >= 100 },
  { id: 'acc90', title: 'Точно в ноту', how: 'Распевка с точностью от 90%', got: d => d.log.some(l => l.kind === 'exercise' && l.score >= 90) },
  { id: 'variety', title: 'Разносторонний', how: '15 разных упражнений', got: d => kinds(d.log) >= 15 },
  { id: 'range', title: 'Знаю свой голос', how: 'Замерь диапазон', got: d => d.rangeHist.length >= 1 },
  { id: 'ear', title: 'Тонкий слух', how: 'Сделай замер порога слуха', got: d => d.threshold.length >= 1 },
  { id: 'keys3', title: 'Три звезды', how: 'Пройди игру с клавиатурой на 90%', got: d => Object.values(d.kgBest).some(v => v >= 90) },
  { id: 'notation', title: 'Читаю ноты', how: 'Пройди все 8 уроков нотной грамоты', got: d => d.notationDone.length >= 8 },
]

export const earned = (d: Data) => ACHIEVEMENTS.filter(a => a.got(d)).map(a => a.id)

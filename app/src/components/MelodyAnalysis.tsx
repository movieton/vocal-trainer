import { noteName, plural } from '../lib/music'
import type { Range } from '../lib/store'
import { noteRole, type KeyChord } from '../lib/theory'
import type { MelNote } from './MelodyEditor'
import CheckList, { type CheckItem } from './CheckList'

type Props = { melody: MelNote[]; work: Range; keyPc: number; steps: readonly number[]; prog: KeyChord[]; onTranspose: (n: number) => void }
type Item = CheckItem

/**
 * Мягкий разбор мелодии по закономерностям, найденным в корпусах музыки.
 * Это не правила, а «так обычно звучит естественно» — поэтому формулировки подсказывают, а не запрещают.
 */
export default function MelodyAnalysis({ melody, work, keyPc, steps, prog, onTranspose }: Props) {
  if (melody.length < 3) return <p className="muted small">Добавь хотя бы 3 ноты — появится разбор мелодии.</p>
  const ms = melody.map(n => n.m)
  const lo = Math.min(...ms), hi = Math.max(...ms)
  const items: Item[] = []

  // 1. Диапазон против удобной зоны голоса
  const out = ms.filter(m => m < work.lo || m > work.hi).length
  const shift = Math.round((work.lo + work.hi) / 2 - (lo + hi) / 2)
  items.push(out === 0
    ? { ok: true, title: 'В удобной зоне голоса', text: `Мелодия ${noteName(lo)}–${noteName(hi)} целиком в твоём рабочем диапазоне.`, src: '' }
    : { ok: false, title: `${out} ${plural(out, ['нота', 'ноты', 'нот'])} вне удобной зоны`, text: `Мелодия ${noteName(lo)}–${noteName(hi)}, рабочий диапазон ${noteName(work.lo)}–${noteName(work.hi)}. Можно сдвинуть всю мелодию на ${shift > 0 ? '+' : ''}${shift} ${plural(shift, ['полутон', 'полутона', 'полутонов'])}.`, src: '' })

  // 2. Плавность: доля шагов (≤ 2 полутона) — в мелодиях разных культур шаги заметно преобладают над скачками
  const iv = ms.slice(1).map((m, i) => Math.abs(m - ms[i]))
  const stepShare = iv.filter(x => x <= 2).length / iv.length
  items.push(stepShare >= 0.6
    ? { ok: true, title: 'Плавное движение', text: `${Math.round(stepShare * 100)}% ходов — шаги. Такую мелодию легко петь и запоминать.`, src: 'Huron, 2006' }
    : { ok: false, title: 'Много скачков', text: `Шагов только ${Math.round(stepShare * 100)}%. Обычно мелодии движутся в основном шагами; скачки — для акцентов. Попробуй заполнить часть скачков проходящими нотами.`, src: 'Huron, 2006' })

  // 3. После большого скачка мелодия обычно идёт в обратную сторону («заполнение»)
  const big = ms.slice(1).map((m, i) => ({ i, d: m - ms[i] })).filter(x => Math.abs(x.d) >= 7 && x.i + 2 < ms.length)
  const unresolved = big.filter(x => Math.sign(ms[x.i + 2] - ms[x.i + 1]) === Math.sign(x.d)).length
  if (big.length) items.push(unresolved === 0
    ? { ok: true, title: 'Скачки «уравновешены»', text: 'После больших скачков мелодия поворачивает обратно — это звучит естественно.', src: 'von Hippel & Huron, 2000' }
    : { ok: false, title: 'Скачок без возврата', text: `${unresolved} ${plural(unresolved, ['большой скачок продолжается', 'больших скачка продолжаются', 'больших скачков продолжаются'])} в ту же сторону. Обычно после скачка мелодия делает шаг назад. Не ошибка, но проверь на слух.`, src: 'von Hippel & Huron, 2000' })

  // 4. Вершина мелодии: арка с вершиной в середине — самый частый контур фраз
  const peakAt = ms.indexOf(hi) / (ms.length - 1)
  items.push(peakAt > 0.2 && peakAt < 0.85
    ? { ok: true, title: 'Есть вершина', text: `Самая высокая нота (${noteName(hi)}) внутри фразы — получается «арка».`, src: 'Huron, 1996' }
    : { ok: false, title: 'Вершина на краю', text: `Самая высокая нота в ${peakAt <= 0.2 ? 'начале' : 'конце'} фразы. Арка с кульминацией в середине — самый частый контур; на краю тоже бывает, но реже.`, src: 'Huron, 1996' })

  // 5. На сильных долях (1-я и 3-я) чаще стоят звуки аккорда
  const strong = melody.filter(n => n.beat % 2 === 0)
  if (strong.length && prog.length) {
    const fit = strong.filter(n => noteRole(n.m, keyPc, steps, prog[Math.floor(n.beat / 4) % prog.length]) === 'chord').length / strong.length
    items.push(fit >= 0.6
      ? { ok: true, title: 'Опора на гармонию', text: `${Math.round(fit * 100)}% нот на сильных долях — звуки аккорда.`, src: 'Temperley, 2007' }
      : { ok: false, title: 'Мало опор на сильных долях', text: `Только ${Math.round(fit * 100)}% нот на сильных долях из аккорда. Неаккордовые ноты там — это выразительное напряжение; если звучит «мимо», перенеси их на слабую долю.`, src: 'Temperley, 2007' })
  }

  return (
    <div className="analysis">
      <CheckList items={items} />
      {out > 0 && <button className="btn ghost small-btn" onClick={() => onTranspose(shift)}>Сдвинуть мелодию на {shift > 0 ? '+' : ''}{shift}</button>}
      <p className="muted small">Это закономерности, найденные в больших собраниях мелодий, а не правила. Хорошая мелодия может их нарушать — сознательно.</p>
    </div>
  )
}

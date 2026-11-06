import { tr } from '../lib/i18n'
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
  if (melody.length < 3) return <p className="muted small">{tr('Добавь хотя бы 3 ноты — появится разбор мелодии.')}</p>
  const ms = melody.map(n => n.m)
  const lo = Math.min(...ms), hi = Math.max(...ms)
  const items: Item[] = []

  // 1. Диапазон против удобной зоны голоса
  const out = ms.filter(m => m < work.lo || m > work.hi).length
  const shift = Math.round((work.lo + work.hi) / 2 - (lo + hi) / 2)
  items.push(out === 0
    ? { ok: true, title: tr('В удобной зоне голоса'), text: tr('Мелодия {0}–{1} целиком в твоём рабочем диапазоне.', noteName(lo), noteName(hi)), src: '' }
    : { ok: false, title: tr('{0} {1} вне удобной зоны', out, plural(out, [tr('нота'), tr('ноты'), tr('нот')])), text: tr('Мелодия {0}–{1}, рабочий диапазон {2}–{3}. Можно сдвинуть всю мелодию на {4}{5} {6}.', noteName(lo), noteName(hi), noteName(work.lo), noteName(work.hi), shift > 0 ? '+' : '', shift, plural(shift, [tr('полутон'), tr('полутона'), tr('полутонов')])), src: '' })

  // 2. Плавность: доля шагов (≤ 2 полутона) — в мелодиях разных культур шаги заметно преобладают над скачками
  const iv = ms.slice(1).map((m, i) => Math.abs(m - ms[i]))
  const stepShare = iv.filter(x => x <= 2).length / iv.length
  items.push(stepShare >= 0.6
    ? { ok: true, title: tr('Плавное движение'), text: tr('{0}% ходов — шаги. Такую мелодию легко петь и запоминать.', Math.round(stepShare * 100)), src: 'Huron, 2006' }
    : { ok: false, title: tr('Много скачков'), text: tr('Шагов только {0}%. Обычно мелодии движутся в основном шагами; скачки — для акцентов. Попробуй заполнить часть скачков проходящими нотами.', Math.round(stepShare * 100)), src: 'Huron, 2006' })

  // 3. После большого скачка мелодия обычно идёт в обратную сторону («заполнение»)
  const big = ms.slice(1).map((m, i) => ({ i, d: m - ms[i] })).filter(x => Math.abs(x.d) >= 7 && x.i + 2 < ms.length)
  const unresolved = big.filter(x => Math.sign(ms[x.i + 2] - ms[x.i + 1]) === Math.sign(x.d)).length
  if (big.length) items.push(unresolved === 0
    ? { ok: true, title: tr('Скачки «уравновешены»'), text: tr('После больших скачков мелодия поворачивает обратно — это звучит естественно.'), src: 'von Hippel & Huron, 2000' }
    : { ok: false, title: tr('Скачок без возврата'), text: tr('{0} {1} в ту же сторону. Обычно после скачка мелодия делает шаг назад. Не ошибка, но проверь на слух.', unresolved, plural(unresolved, [tr('большой скачок продолжается'), tr('больших скачка продолжаются'), tr('больших скачков продолжаются')])), src: 'von Hippel & Huron, 2000' })

  // 4. Вершина мелодии: арка с вершиной в середине — самый частый контур фраз
  const peakAt = ms.indexOf(hi) / (ms.length - 1)
  items.push(peakAt > 0.2 && peakAt < 0.85
    ? { ok: true, title: tr('Есть вершина'), text: tr('Самая высокая нота ({0}) внутри фразы — получается «арка».', noteName(hi)), src: 'Huron, 1996' }
    : { ok: false, title: tr('Вершина на краю'), text: tr('Самая высокая нота в {0} фразы. Арка с кульминацией в середине — самый частый контур; на краю тоже бывает, но реже.', peakAt <= 0.2 ? tr('начале') : tr('конце')), src: 'Huron, 1996' })

  // 5. На сильных долях (1-я и 3-я) чаще стоят звуки аккорда
  const strong = melody.filter(n => n.beat % 2 === 0)
  if (strong.length && prog.length) {
    const fit = strong.filter(n => noteRole(n.m, keyPc, steps, prog[Math.floor(n.beat / 4) % prog.length]) === 'chord').length / strong.length
    items.push(fit >= 0.6
      ? { ok: true, title: tr('Опора на гармонию'), text: tr('{0}% нот на сильных долях — звуки аккорда.', Math.round(fit * 100)), src: 'Temperley, 2007' }
      : { ok: false, title: tr('Мало опор на сильных долях'), text: tr('Только {0}% нот на сильных долях из аккорда. Неаккордовые ноты там — это выразительное напряжение; если звучит «мимо», перенеси их на слабую долю.', Math.round(fit * 100)), src: 'Temperley, 2007' })
  }

  return (
    <div className="analysis">
      <CheckList items={items} />
      {out > 0 && <button className="btn ghost small-btn" onClick={() => onTranspose(shift)}>{tr('Сдвинуть мелодию на')} {shift > 0 ? '+' : ''}{shift}</button>}
      <p className="muted small">{tr('Это закономерности, найденные в больших собраниях мелодий, а не правила. Хорошая мелодия может их нарушать — сознательно.')}</p>
    </div>
  )
}

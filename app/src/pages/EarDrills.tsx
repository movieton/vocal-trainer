import { useState } from 'react'
import DrillPage from '../components/DrillPage'
import KeySelect from '../components/KeySelect'
import type { Key } from '../lib/run'
import { INTERVALS, noteName } from '../lib/music'
import type { Phrase } from '../lib/phrase'
import { useStored, useWorkRange } from '../lib/store'
import { chordLabel, CHORDS, degree, nearest, pcName, PROGRESSIONS, rand, randInt, SCALES, type ScaleId } from '../lib/theory'

function useRange() {
  return useWorkRange()
}

const Seg = <T extends string | number>({ value, set, opts, disabled }: { value: T; set: (v: T) => void; opts: [T, string][]; disabled: boolean }) => (
  <span className={'seg' + (opts.length >= 4 ? ' wide' : '')}>{opts.map(([v, t]) => <button key={String(v)} aria-pressed={value === v} disabled={disabled} onClick={() => set(v)}>{t}</button>)}</span>
)

const TEMPI: [number, string][] = [[70, 'Медленно'], [90, 'Средне'], [110, 'Быстро']]

// ---------- Пение над аккордами ----------
type ChordTask = 'root' | 'third' | 'arp' | 'arp7'

export function ChordSing() {
  const r = useRange()
  const [prog, setProg] = useStored('cs.prog', 'pop')
  const [task, setTask] = useStored<ChordTask>('cs.task', 'root')
  const [bpm, setBpm] = useStored('cs.bpm', 90)
  const [key, setKey] = useStored<Key>('cs.key', 'auto')
  const [circle, setCircle] = useStored('cs.circle', true)
  const center = (r.lo + r.hi) / 2 - 2

  const make = () => {
    const P = PROGRESSIONS[prog], b = 60 / bpm, base = key === 'auto' ? randInt(0, 11) : key
    return (i: number): Phrase | null => {
      if (i >= 8) return null
      // каждый круг — следующая тональность по квинтовому кругу
      const key = nearest(base + (circle ? 7 * i : 0), r.lo + 3)
      const piano: Phrase['piano'] = [], notes: Phrase['notes'] = [], marks: Phrase['marks'] = []
      const chordAt = (t: number, root: number, iv: readonly number[], vel = 38) => {
        for (const x of iv) piano.push({ m: key - 12 + root + x, t, d: 4 * b * 0.95, vel })
        piano.push({ m: key - 24 + root, t, d: 4 * b * 0.95, vel: vel + 8 })
      }
      chordAt(0, 0, CHORDS[P.chords[0][1]].iv, 45)
      marks.push({ t: 0, text: 'Вступление' })
      let prev = center
      P.chords.forEach(([root, q], j) => {
        const T = 4 * b * (j + 1), iv = CHORDS[q].iv
        chordAt(T, root, iv)
        marks.push({ t: T, text: chordLabel(key + root, q) })
        const tone = (k: number) => key + root + (k < iv.length ? iv[k] : 12)
        if (task === 'root') notes.push({ m: nearest(tone(0), center), t: T, d: 3.5 * b, sing: true })
        else if (task === 'third') {
          prev = nearest(tone(1), prev)
          notes.push({ m: prev, t: T, d: 3.5 * b, sing: true })
        } else {
          const ks = task === 'arp' ? [0, 1, 2, 1] : [0, 1, 2, 3]
          const shift = nearest(tone(0), center - 4) - tone(0)
          ks.forEach((k, n) => notes.push({ m: tone(k) + shift, t: T + n * b, d: b * 0.9, sing: true }))
        }
      })
      return { label: `${pcName(key)}: ${P.name}`, piano, notes, marks, len: 4 * b * (P.chords.length + 1) }
    }
  }

  return (
    <DrillPage id="chord-sing" settingsKey={`${prog}-${task}-${bpm}-${key}-${circle}`} title="Пение над аккордами" make={make} windowSec={12}
      intro="Пианино играет гармонию, ты поёшь звуки аккордов. После каждого круга тональность сдвигается на квинту вверх: так проходишь квинтовый круг."
      how={['Слушай бас: он подсказывает основной тон аккорда.', 'Терция — звук, который делает аккорд мажорным или минорным. Пой её мягко, она «окрашивает» гармонию.', 'Лучше в наушниках: иначе микрофон может услышать пианино вместо тебя.']}
      controls={running => <>
        <label>Гармония
          <select value={prog} onChange={e => setProg(e.target.value)} disabled={running}>
            {Object.entries(PROGRESSIONS).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
          </select>
        </label>
        <label>Что петь <Seg value={task} set={setTask} disabled={running}
          opts={[['root', 'Основной тон'], ['third', 'Терцию'], ['arp', 'Арпеджио'], ['arp7', 'С септимой']]} /></label>
        <label>Темп <Seg value={bpm} set={setBpm} disabled={running} opts={TEMPI} /></label>
        <label>Тональность <KeySelect value={key} onChange={setKey} disabled={running} /></label>
        <label className="chk"><input type="checkbox" checked={circle} onChange={e => setCircle(e.target.checked)} disabled={running} /> Менять по квинтовому кругу</label>
      </>} />
  )
}

// ---------- Гаммы ----------
export function ScaleSing() {
  const r = useRange()
  const [scale, setScale] = useStored<ScaleId>('ss.scale', 'major')
  const [pattern, setPattern] = useStored<'updown' | 'thirds'>('ss.pattern', 'updown')
  const [bpm, setBpm] = useStored('ss.bpm', 90)
  const [key, setKey] = useStored<Key>('ss.key', 'auto')

  const make = () => {
    const steps: readonly number[] = SCALES[scale].steps, b = 60 / bpm, n = steps.length
    const roots: number[] = []
    for (let root = r.lo + 1; root + 12 <= r.hi - 1; root++) roots.push(root)
    if (!roots.length) roots.push(r.lo)
    const all = key === 'auto' ? roots.concat(roots.slice(0, -1).reverse()) : Array(6).fill(nearest(key, (r.lo + r.hi) / 2 - 6))
    const isMinor = steps.includes(3)
    let degs: number[]
    if (pattern === 'updown') degs = [...Array(n + 1).keys(), ...[...Array(n).keys()].reverse()]
    else {
      degs = []
      for (let k = 0; k < n; k++) degs.push(k, k + 2)
      degs.push(n)
      for (let k = n; k > 0; k--) degs.push(k, k - 2)
      degs.push(0)
    }
    return (i: number): Phrase | null => {
      if (i >= all.length) return null
      const root = all[i], piano: Phrase['piano'] = [], notes: Phrase['notes'] = []
      const len = 2 * b + degs.length * b * 0.5 + b
      const triad = [0, isMinor ? 3 : 4, 7]
      for (let t = 0; t < len - b; t += 2 * b) for (const x of triad) piano.push({ m: root - 12 + x, t, d: 2 * b, vel: t === 0 ? 50 : 30 })
      degs.forEach((d, k) => notes.push({ m: root + degree(d, steps), t: 2 * b + k * b * 0.5, d: b * 0.48, sing: true }))
      return { label: `${noteName(root)} ${SCALES[scale].name.toLowerCase()}`, piano, notes, len }
    }
  }

  return (
    <DrillPage id="scale-sing" settingsKey={`${scale}-${pattern}-${bpm}-${key}`} title="Гаммы с аккомпанементом" make={make} windowSec={9}
      intro="Под аккорд тоники поёшь гамму вверх и вниз. С каждым кругом тональность поднимается на полутон в пределах твоего диапазона."
      how={['Начни медленно. Ускоряй, когда большинство нот зелёные.', 'Пой на «а» или на названия нот: до-ре-ми.', 'В миноре особенно слушай третью и шестую ступень — их чаще всего завышают.']}
      controls={running => <>
        <label>Гамма
          <select value={scale} onChange={e => setScale(e.target.value as ScaleId)} disabled={running}>
            {Object.entries(SCALES).map(([k, s]) => <option key={k} value={k}>{s.name}</option>)}
          </select>
        </label>
        <label>Рисунок <Seg value={pattern} set={setPattern} disabled={running} opts={[['updown', 'Вверх и вниз'], ['thirds', 'Терциями']]} /></label>
        <label>Тональность <KeySelect value={key} onChange={setKey} disabled={running} /></label>
        <label>Темп <Seg value={bpm} set={setBpm} disabled={running} opts={TEMPI} /></label>
      </>} />
  )
}

// ---------- Подпевка (вторая партия) ----------
const HARM = { up3: { k: 2, name: 'Терция выше' }, down3: { k: -2, name: 'Терция ниже' }, up5: { k: 4, name: 'Квинта выше' }, down6: { k: -5, name: 'Секста ниже' } } as const

export function Harmony() {
  const r = useRange()
  const [iv, setIv] = useStored<keyof typeof HARM>('hm.iv', 'up3')
  const [hints, setHints] = useState(true)
  const [len, setLen] = useStored('hm.len', 6)
  const [key, setKey] = useStored<Key>('hm.key', 'auto')
  const center = (r.lo + r.hi) / 2

  const make = () => {
    const pc = key === 'auto' ? randInt(0, 11) : key, b = 60 / 80, k = HARM[iv].k
    return (i: number): Phrase | null => {
      if (i >= 10) return null
      // мелодия — случайное блуждание по ступеням мажора с окончанием на устое
      const degs = [0]
      while (degs.length < len - 1) degs.push(Math.max(-2, Math.min(7, degs.at(-1)! + rand([-2, -1, -1, 1, 1, 2]))))
      degs.push(rand([0, 2, 4]))
      const harmAvg = degs.reduce((a, d) => a + degree(d + k), 0) / degs.length
      const key = nearest(pc, center - harmAvg)
      const piano: Phrase['piano'] = [], notes: Phrase['notes'] = []
      for (const x of [0, 4, 7]) piano.push({ m: key - 12 + x, t: 0, d: 2 * b, vel: 40 })
      const A = 2 * b, B = A + len * b + b
      degs.forEach((d, n) => {
        piano.push({ m: key + degree(d), t: A + n * b, d: b * 0.9, vel: 70, voice: true })
        notes.push({ m: key + degree(d), t: A + n * b, d: b * 0.9, sing: false })
        piano.push({ m: key + degree(d), t: B + n * b, d: b * 0.9, vel: 55 })
        notes.push({ m: key + degree(d), t: B + n * b, d: b * 0.9, sing: false })
        notes.push({ m: key + degree(d + k), t: B + n * b, d: b * 0.9, sing: true, hidden: !hints })
      })
      return { label: `${pcName(key)} мажор`, piano, notes, len: B + len * b, marks: [{ t: A, text: 'Мелодия' }, { t: B, text: HARM[iv].name }] }
    }
  }

  return (
    <DrillPage id="harmony" settingsKey={`${iv}-${len}-${hints}-${key}`} title="Вторая партия" make={make} windowSec={12}
      intro="Пианино играет мелодию, затем повторяет её, а ты поёшь подголосок: терцию выше или ниже. Так поют бэк-вокал и дуэты."
      how={['Сначала просто послушай мелодию.', 'На повторе держи свою линию: она движется параллельно мелодии, но по ступеням гаммы, поэтому терция то большая, то малая.', 'Когда освоишься, выключи подсказки: твои ноты появятся на доске только после того, как пройдут.', 'Обязательно в наушниках: мелодия звучит одновременно с тобой.']}
      controls={running => <>
        <label>Подголосок <Seg value={iv} set={setIv} disabled={running} opts={Object.entries(HARM).map(([k, h]) => [k as keyof typeof HARM, h.name])} /></label>
        <label>Тональность <KeySelect value={key} onChange={setKey} disabled={running} /></label>
        <label>Длина <Seg value={len} set={setLen} disabled={running} opts={[[4, '4 ноты'], [6, '6 нот'], [8, '8 нот']]} /></label>
        <label className="chk"><input type="checkbox" checked={hints} onChange={e => setHints(e.target.checked)} disabled={running} /> Показывать мои ноты заранее</label>
      </>} />
  )
}

// ---------- Повтори ноту ----------
export function PitchMatch() {
  const r = useRange()
  const [hints, setHints] = useState(true)
  const make = () => (i: number): Phrase | null => {
    if (i >= 12) return null
    const m = randInt(r.lo + 2, r.hi - 2)
    return { label: noteName(m), piano: [{ m, t: 0, d: 1.2, vel: 70, voice: true }], notes: [{ m, t: 1.5, d: 1.8, sing: true, hidden: !hints }], len: 3.3 }
  }
  return (
    <DrillPage id="pitch-match" settingsKey={String(hints)} title="Повтори ноту" make={make} windowSec={6}
      intro="Звучит нота — пропой её. Самое базовое упражнение на слух: учит связывать то, что слышишь, с тем, что поёшь."
      how={['Не спеши: сначала «услышь» ноту внутри, потом пой.', 'Если промахиваешься, смотри, в какую сторону: это видно по линии на доске.']}
      controls={running => <label className="chk"><input type="checkbox" checked={hints} onChange={e => setHints(e.target.checked)} disabled={running} /> Показывать ноту на доске</label>} />
  )
}

// ---------- Интервалы голосом ----------
const IV_SETS: Record<string, number[]> = { easy: [2, 4, 5, 7, 12], mid: [2, 3, 4, 5, 7, 9, 12], all: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }

export function SingInterval() {
  const r = useRange()
  const [set, setSet] = useStored('si.set', 'easy')
  const [dir, setDir] = useStored<'up' | 'down' | 'mix'>('si.dir', 'up')
  const [hints, setHints] = useState(true)
  const make = () => (i: number): Phrase | null => {
    if (i >= 12) return null
    const st = rand(IV_SETS[set])
    const down = dir === 'down' || (dir === 'mix' && Math.random() < 0.5)
    const root = down ? randInt(r.lo + st, r.hi - 1) : randInt(r.lo + 1, r.hi - st)
    const to = root + (down ? -st : st)
    const name = INTERVALS[st - 1].name
    return {
      label: `${name} ${down ? 'вниз' : 'вверх'}`,
      piano: [{ m: root, t: 0, d: 1, vel: 70, voice: true }],
      notes: [{ m: root, t: 1.1, d: 0.8, sing: true }, { m: to, t: 2, d: 1.4, sing: true, hidden: !hints }],
      marks: [{ t: 0, text: `${name} ${down ? '↓' : '↑'}` }],
      len: 3.5,
    }
  }
  return (
    <DrillPage id="sing-interval" settingsKey={`${set}-${dir}-${hints}`} title="Интервалы голосом" make={make} windowSec={7}
      intro="Звучит нота. Пропой её, затем нужный интервал от неё. Название интервала видно на доске."
      how={['Подсказки-песни: кварта вверх — начало многих гимнов и маршей, большая секста вверх — начало «В лесу родилась ёлочка», октава — первые две ноты «Somewhere over the rainbow».', 'Перед каждым интервалом заново услышь нижнюю ноту.', 'Начни с набора «Лёгкие», вверх. Потом вниз, потом вперемешку.']}
      controls={running => <>
        <label>Набор <Seg value={set} set={setSet} disabled={running} opts={[['easy', 'Лёгкие'], ['mid', 'Средние'], ['all', 'Все 12']]} /></label>
        <label>Направление <Seg value={dir} set={setDir} disabled={running} opts={[['up', 'Вверх'], ['down', 'Вниз'], ['mix', 'Вперемешку']]} /></label>
        <label className="chk"><input type="checkbox" checked={hints} onChange={e => setHints(e.target.checked)} disabled={running} /> Показывать ноту на доске</label>
      </>} />
  )
}

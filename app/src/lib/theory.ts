import { NAMES } from './music'

export const SCALES = {
  major: { name: 'Мажор', steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: 'Натуральный минор', steps: [0, 2, 3, 5, 7, 8, 10] },
  harmonic: { name: 'Гармонический минор', steps: [0, 2, 3, 5, 7, 8, 11] },
  melodic: { name: 'Мелодический минор', steps: [0, 2, 3, 5, 7, 9, 11] },
  pentaMaj: { name: 'Мажорная пентатоника', steps: [0, 2, 4, 7, 9] },
  pentaMin: { name: 'Минорная пентатоника', steps: [0, 3, 5, 7, 10] },
  blues: { name: 'Блюзовая', steps: [0, 3, 5, 6, 7, 10] },
} as const
export type ScaleId = keyof typeof SCALES

export const CHORDS = {
  maj: { name: 'мажор', short: '', iv: [0, 4, 7] },
  min: { name: 'минор', short: 'm', iv: [0, 3, 7] },
  dim: { name: 'уменьшённый', short: 'dim', iv: [0, 3, 6] },
  aug: { name: 'увеличенный', short: 'aug', iv: [0, 4, 8] },
  maj7: { name: 'большой мажорный септ.', short: 'maj7', iv: [0, 4, 7, 11] },
  min7: { name: 'малый минорный септ.', short: 'm7', iv: [0, 3, 7, 10] },
  dom7: { name: 'доминантсептаккорд', short: '7', iv: [0, 4, 7, 10] },
  m7b5: { name: 'полууменьшённый', short: 'm7♭5', iv: [0, 3, 6, 10] },
} as const
export type ChordQ = keyof typeof CHORDS

export const PROGRESSIONS: Record<string, { name: string; chords: [number, ChordQ][] }> = {
  pop: { name: 'Поп: I–V–vi–IV', chords: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] },
  fifties: { name: '50-е: I–vi–IV–V', chords: [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']] },
  jazz: { name: 'Джаз: ii–V–I', chords: [[2, 'min7'], [7, 'dom7'], [0, 'maj7'], [0, 'maj7']] },
  minor: { name: 'Минор: i–VI–III–VII', chords: [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']] },
  blues: { name: 'Блюз: I7–IV7–I7–V7', chords: [[0, 'dom7'], [5, 'dom7'], [0, 'dom7'], [7, 'dom7']] },
  canon: { name: 'Канон: I–V–vi–iii–IV–I–IV–V', chords: [[0, 'maj'], [7, 'maj'], [9, 'min'], [4, 'min'], [5, 'maj'], [0, 'maj'], [5, 'maj'], [7, 'maj']] },
}

/** Квинтовый круг: мажорные тональности по часовой стрелке и их параллельные миноры */
export const CIRCLE = [
  { pc: 0, major: 'До', minor: 'ля', sig: 0 },
  { pc: 7, major: 'Соль', minor: 'ми', sig: 1 },
  { pc: 2, major: 'Ре', minor: 'си', sig: 2 },
  { pc: 9, major: 'Ля', minor: 'фа♯', sig: 3 },
  { pc: 4, major: 'Ми', minor: 'до♯', sig: 4 },
  { pc: 11, major: 'Си', minor: 'соль♯', sig: 5 },
  { pc: 6, major: 'Фа♯', minor: 'ре♯', sig: 6 },
  { pc: 1, major: 'Ре♭', minor: 'си♭', sig: -5 },
  { pc: 8, major: 'Ля♭', minor: 'фа', sig: -4 },
  { pc: 3, major: 'Ми♭', minor: 'до', sig: -3 },
  { pc: 10, major: 'Си♭', minor: 'соль', sig: -2 },
  { pc: 5, major: 'Фа', minor: 'ре', sig: -1 },
]

const FLATS = ['До', 'Ре♭', 'Ре', 'Ми♭', 'Ми', 'Фа', 'Соль♭', 'Соль', 'Ля♭', 'Ля', 'Си♭', 'Си']
/** Название ноты; flat — писать через бемоли (для бемольных тональностей и ♭-аккордов) */
export const pcName = (pc: number, flat = false) => (flat ? FLATS : NAMES)[((pc % 12) + 12) % 12]
/** Подпись аккорда: «Ми m», «Ля♭», «Соль 7» */
export const chordLabel = (pc: number, q: ChordQ, flat = false) => pcName(pc, flat) + (CHORDS[q].short ? ' ' + CHORDS[q].short : '')

/** Переносит ноту в октаву, ближайшую к опорной высоте */
export const nearest = (m: number, around: number) => m + 12 * Math.round((around - m) / 12)

export const rand = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
export const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1))

/** Ступень мажорной гаммы (может быть отрицательной или больше 7) → полутоны */
export const degree = (d: number, steps: readonly number[] = SCALES.major.steps) => {
  const n = steps.length
  return steps[((d % n) + n) % n] + 12 * Math.floor(d / n)
}

// ---------- Гармония для сочинения ----------

/** Аккорд относительно тоники тональности */
export type KeyChord = { root: number; q: ChordQ; roman: string; note?: string }

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

export function triadQ(third: number, fifth: number): ChordQ {
  if (third === 4 && fifth === 7) return 'maj'
  if (third === 3 && fifth === 7) return 'min'
  if (third === 3 && fifth === 6) return 'dim'
  return 'aug'
}

const romanFor = (deg: number, q: ChordQ, prefix = '') => {
  const r = prefix + ROMAN[deg]
  return q === 'maj' || q === 'aug' ? r : q === 'dim' ? r.toLowerCase() + '°' : r.toLowerCase()
}

/** Трезвучия на всех ступенях лада */
export function diatonic(steps: readonly number[]): KeyChord[] {
  return steps.map((_, d) => {
    const root = degree(d, steps), third = degree(d + 2, steps) - root, fifth = degree(d + 4, steps) - root
    const q = triadQ(third, fifth)
    return { root, q, roman: romanFor(d, q) }
  })
}

/** Аккорды «взаймы»: из параллельной тональности и соседей по квинтовому кругу */
export function borrowed(minor: boolean): KeyChord[] {
  return minor
    ? [
        { root: 7, q: 'maj', roman: 'V', note: 'из гармонического минора — сильная тяга к тонике' },
        { root: 5, q: 'maj', roman: 'IV', note: 'дорийская краска, светлее обычной iv' },
        { root: 1, q: 'maj', roman: '♭II', note: 'неаполитанский — драматичный поворот' },
      ]
    : [
        { root: 5, q: 'min', roman: 'iv', note: 'из одноимённого минора — грустный оттенок' },
        { root: 8, q: 'maj', roman: '♭VI', note: 'эпичный «киношный» аккорд' },
        { root: 10, q: 'maj', roman: '♭VII', note: 'рок-аккорд, сосед по кругу' },
        { root: 2, q: 'maj', roman: 'II', note: 'доминанта к V: ведёт к доминанте' },
        { root: 4, q: 'maj', roman: 'III', note: 'доминанта к vi: ведёт к параллельному минору' },
      ]
}

/** Куда естественно идти дальше (по номеру ступени лада) */
export const NEXT: Record<number, number[]> = { 0: [3, 4, 5], 1: [4, 6], 2: [5, 3], 3: [4, 0, 1], 4: [0, 5], 5: [3, 1, 4], 6: [0, 2] }

export const TEMPLATES: { name: string; major: number[]; minor: number[] }[] = [
  { name: 'Поп', major: [0, 4, 5, 3], minor: [0, 5, 2, 6] },
  { name: 'Баллада', major: [0, 5, 3, 4], minor: [0, 3, 6, 2] },
  { name: 'Джаз ii–V–I', major: [1, 4, 0, 0], minor: [1, 4, 0, 0] },
  { name: 'Канон', major: [0, 4, 5, 2, 3, 0, 3, 4], minor: [0, 4, 5, 2, 3, 0, 3, 4] },
]

/** Роль ноты относительно аккорда и лада: опорная, проходящая, чужая */
export function noteRole(midi: number, keyPc: number, steps: readonly number[], chord: KeyChord | null): 'chord' | 'scale' | 'out' {
  const pc = (((Math.round(midi) - keyPc) % 12) + 12) % 12
  if (chord && CHORDS[chord.q].iv.some(x => (chord.root + x) % 12 === pc)) return 'chord'
  return steps.includes(pc) ? 'scale' : 'out'
}

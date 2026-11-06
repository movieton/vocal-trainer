import { lang, tr } from './i18n'
import { NAMES } from './music'

export const SCALES = {
  major: { name: tr('Мажор'), steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: tr('Натуральный минор'), steps: [0, 2, 3, 5, 7, 8, 10] },
  harmonic: { name: tr('Гармонический минор'), steps: [0, 2, 3, 5, 7, 8, 11] },
  melodic: { name: tr('Мелодический минор'), steps: [0, 2, 3, 5, 7, 9, 11] },
  pentaMaj: { name: tr('Мажорная пентатоника'), steps: [0, 2, 4, 7, 9] },
  pentaMin: { name: tr('Минорная пентатоника'), steps: [0, 3, 5, 7, 10] },
  blues: { name: tr('Блюзовая'), steps: [0, 3, 5, 6, 7, 10] },
} as const
export type ScaleId = keyof typeof SCALES

export const CHORDS = {
  maj: { name: tr('мажор'), short: '', iv: [0, 4, 7] },
  min: { name: tr('минор'), short: 'm', iv: [0, 3, 7] },
  dim: { name: tr('уменьшённый'), short: 'dim', iv: [0, 3, 6] },
  aug: { name: tr('увеличенный'), short: 'aug', iv: [0, 4, 8] },
  maj7: { name: tr('большой мажорный септ.'), short: 'maj7', iv: [0, 4, 7, 11] },
  min7: { name: tr('малый минорный септ.'), short: 'm7', iv: [0, 3, 7, 10] },
  dom7: { name: tr('доминантсептаккорд'), short: '7', iv: [0, 4, 7, 10] },
  m7b5: { name: tr('полууменьшённый'), short: 'm7♭5', iv: [0, 3, 6, 10] },
} as const
export type ChordQ = keyof typeof CHORDS

export const PROGRESSIONS: Record<string, { name: string; chords: [number, ChordQ][] }> = {
  pop: { name: tr('Поп: I–V–vi–IV'), chords: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] },
  fifties: { name: tr('50-е: I–vi–IV–V'), chords: [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']] },
  jazz: { name: tr('Джаз: ii–V–I'), chords: [[2, 'min7'], [7, 'dom7'], [0, 'maj7'], [0, 'maj7']] },
  minor: { name: tr('Минор: i–VI–III–VII'), chords: [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']] },
  blues: { name: tr('Блюз: I7–IV7–I7–V7'), chords: [[0, 'dom7'], [5, 'dom7'], [0, 'dom7'], [7, 'dom7']] },
  canon: { name: tr('Канон: I–V–vi–iii–IV–I–IV–V'), chords: [[0, 'maj'], [7, 'maj'], [9, 'min'], [4, 'min'], [5, 'maj'], [0, 'maj'], [5, 'maj'], [7, 'maj']] },
}

/** Квинтовый круг: мажорные тональности по часовой стрелке и их параллельные миноры */
export const CIRCLE = [
  { pc: 0, major: tr('До'), minor: tr('ля'), sig: 0 },
  { pc: 7, major: tr('Соль'), minor: tr('ми'), sig: 1 },
  { pc: 2, major: tr('Ре'), minor: tr('си'), sig: 2 },
  { pc: 9, major: tr('Ля'), minor: tr('фа♯'), sig: 3 },
  { pc: 4, major: tr('Ми'), minor: tr('до♯'), sig: 4 },
  { pc: 11, major: tr('Си'), minor: tr('соль♯'), sig: 5 },
  { pc: 6, major: tr('Фа♯'), minor: tr('ре♯'), sig: 6 },
  { pc: 1, major: tr('Ре♭'), minor: tr('си♭'), sig: -5 },
  { pc: 8, major: tr('Ля♭'), minor: tr('фа'), sig: -4 },
  { pc: 3, major: tr('Ми♭'), minor: tr('до'), sig: -3 },
  { pc: 10, major: tr('Си♭'), minor: tr('соль'), sig: -2 },
  { pc: 5, major: tr('Фа'), minor: tr('ре'), sig: -1 },
]

const FLATS = [tr('До'), tr('Ре♭'), tr('Ре'), tr('Ми♭'), tr('Ми'), tr('Фа'), tr('Соль♭'), tr('Соль'), tr('Ля♭'), tr('Ля'), tr('Си♭'), tr('Си')]
/** Название ноты; flat — писать через бемоли (для бемольных тональностей и ♭-аккордов) */
export const pcName = (pc: number, flat = false) => (flat ? FLATS : NAMES)[((pc % 12) + 12) % 12]
/** Подпись аккорда: «Ми m», «Ля♭», «Соль 7» */
export const chordLabel = (pc: number, q: ChordQ, flat = false) => pcName(pc, flat) + (CHORDS[q].short ? (lang === 'en' ? '' : ' ') + CHORDS[q].short : '')

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
        { root: 7, q: 'maj', roman: 'V', note: tr('из гармонического минора — сильная тяга к тонике') },
        { root: 5, q: 'maj', roman: 'IV', note: tr('дорийская краска, светлее обычной iv') },
        { root: 1, q: 'maj', roman: '♭II', note: tr('неаполитанский — драматичный поворот') },
      ]
    : [
        { root: 5, q: 'min', roman: 'iv', note: tr('из одноимённого минора — грустный оттенок') },
        { root: 8, q: 'maj', roman: '♭VI', note: tr('эпичный «киношный» аккорд') },
        { root: 10, q: 'maj', roman: '♭VII', note: tr('рок-аккорд, сосед по кругу') },
        { root: 2, q: 'maj', roman: 'II', note: tr('доминанта к V: ведёт к доминанте') },
        { root: 4, q: 'maj', roman: 'III', note: tr('доминанта к vi: ведёт к параллельному минору') },
      ]
}

/** Куда естественно идти дальше (по номеру ступени лада) */
export const NEXT: Record<number, number[]> = { 0: [3, 4, 5], 1: [4, 6], 2: [5, 3], 3: [4, 0, 1], 4: [0, 5], 5: [3, 1, 4], 6: [0, 2] }

export const TEMPLATES: { name: string; major: number[]; minor: number[] }[] = [
  { name: tr('Поп'), major: [0, 4, 5, 3], minor: [0, 5, 2, 6] },
  { name: tr('Баллада'), major: [0, 5, 3, 4], minor: [0, 3, 6, 2] },
  { name: tr('Джаз ii–V–I'), major: [1, 4, 0, 0], minor: [1, 4, 0, 0] },
  { name: tr('Канон'), major: [0, 4, 5, 2, 3, 0, 3, 4], minor: [0, 4, 5, 2, 3, 0, 3, 4] },
]

/** Роль ноты относительно аккорда и лада: опорная, проходящая, чужая */
export function noteRole(midi: number, keyPc: number, steps: readonly number[], chord: KeyChord | null): 'chord' | 'scale' | 'out' {
  const pc = (((Math.round(midi) - keyPc) % 12) + 12) % 12
  if (chord && CHORDS[chord.q].iv.some(x => (chord.root + x) % 12 === pc)) return 'chord'
  return steps.includes(pc) ? 'scale' : 'out'
}

/** Барабанные рисунки на такт из 8 восьмых: k — бочка, s — малый, h — хэт */
export const GROOVES: Record<string, { name: string; k: number[]; s: number[]; h: number[] }> = {
  none: { name: tr('Без барабанов'), k: [], s: [], h: [] },
  pop: { name: tr('Поп'), k: [0, 4, 5], s: [2, 6], h: [0, 1, 2, 3, 4, 5, 6, 7] },
  ballad: { name: tr('Баллада'), k: [0, 5], s: [4], h: [0, 2, 4, 6] },
  rock: { name: tr('Рок'), k: [0, 3, 4], s: [2, 6], h: [0, 1, 2, 3, 4, 5, 6, 7] },
  half: { name: tr('Половинный'), k: [0], s: [4], h: [0, 2, 4, 6] },
}

/**
 * «Кубик» гармонии: цепочка от тоники по частым переходам (NEXT), последний аккорд тянет обратно к I.
 * Частотность переходов — по корпусам популярной музыки (de Clercq & Temperley 2011).
 */
export function diceProgression(dia: KeyChord[], extra: KeyChord[], len = 4, bold = 0.2): KeyChord[] {
  const out: number[] = [0]
  while (out.length < len) {
    const opts = NEXT[out[out.length - 1]].filter(x => !(out.length === len - 1 && x === 0))
    out.push(rand(opts.length ? opts : [3, 4]))
  }
  const prog = out.map(i => dia[i])
  // иногда — один аккорд «взаймы» для краски, не на первом месте
  if (extra.length && Math.random() < bold) prog[randInt(1, len - 1)] = rand(extra)
  return prog
}

const VOWELS = tr('аеёиоуыэюяАЕЁИОУЫЭЮЯaeiouyAEIOUY')

/**
 * Делит русский текст на слоги для подписи под нотами. Ударение пользователь отмечает «+» после гласной («мо+я»).
 * Правило: на слог одна гласная; одиночная согласная между гласными уходит в следующий слог, из группы — первая остаётся.
 */
export function syllabify(text: string): { s: string; stress: boolean }[] {
  const out: { s: string; stress: boolean }[] = []
  let prefix = ''
  for (const raw of text.split(/[\s\-—]+/).filter(Boolean)) {
    const w = raw.replace(/[.,!?;:«»"()]/g, '')
    const chars = [...w], vIdx: number[] = []
    chars.forEach((c, i) => { if (VOWELS.includes(c)) vIdx.push(i) })
    // слово без гласных («в», «к», «с») поётся вместе со следующим словом
    if (!vIdx.length) { prefix += w.replace(/\+/g, '') + ' '; continue }
    let start = 0
    vIdx.forEach((v, k) => {
      let end: number
      if (k === vIdx.length - 1) end = chars.length
      else {
        const next = vIdx[k + 1]
        const cons = chars.slice(v + 1, next).filter(c => c !== '+').length
        end = v + 1 + (chars[v + 1] === '+' ? 1 : 0) + (cons >= 2 ? 1 : 0)
      }
      const piece = chars.slice(start, end).join('')
      out.push({ s: (k === 0 ? prefix : '') + piece.replace(/\+/g, ''), stress: piece.includes('+') })
      if (k === 0) prefix = ''
      start = end
    })
  }
  return out
}

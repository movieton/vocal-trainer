import { lang, tr } from './i18n'
export const NAMES = [tr('До'), tr('До♯'), tr('Ре'), tr('Ре♯'), tr('Ми'), tr('Фа'), tr('Фа♯'), tr('Соль'), tr('Соль♯'), tr('Ля'), tr('Ля♯'), tr('Си')]
export const LATIN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12)
export const ftom = (f: number) => 69 + 12 * Math.log2(f / 440)
const pc = (m: number) => ((Math.round(m) % 12) + 12) % 12
export const octave = (m: number) => Math.floor(Math.round(m) / 12) - 1
export const noteName = (m: number) => NAMES[pc(m)] + octave(m)
export const latinName = (m: number) => LATIN[pc(m)] + octave(m)
export const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(pc(m))

export const INTERVALS = [
  { st: 1, short: tr('м2'), name: tr('малая секунда') },
  { st: 2, short: tr('б2'), name: tr('большая секунда') },
  { st: 3, short: tr('м3'), name: tr('малая терция') },
  { st: 4, short: tr('б3'), name: tr('большая терция') },
  { st: 5, short: tr('ч4'), name: tr('чистая кварта') },
  { st: 6, short: tr('тт'), name: tr('тритон') },
  { st: 7, short: tr('ч5'), name: tr('чистая квинта') },
  { st: 8, short: tr('м6'), name: tr('малая секста') },
  { st: 9, short: tr('б6'), name: tr('большая секста') },
  { st: 10, short: tr('м7'), name: tr('малая септима') },
  { st: 11, short: tr('б7'), name: tr('большая септима') },
  { st: 12, short: tr('ч8'), name: tr('октава') },
]

export const VOICE_TYPES = [
  { id: 'Бас', name: tr('Бас'), lo: 40, hi: 64 },
  { id: 'Баритон', name: tr('Баритон'), lo: 45, hi: 69 },
  { id: 'Тенор', name: tr('Тенор'), lo: 48, hi: 72 },
  { id: 'Контральто', name: tr('Контральто'), lo: 53, hi: 77 },
  { id: 'Меццо-сопрано', name: tr('Меццо-сопрано'), lo: 57, hi: 81 },
  { id: 'Сопрано', name: tr('Сопрано'), lo: 60, hi: 84 },
]

export function guessVoiceType(lo: number, hi: number) {
  const mid = (lo + hi) / 2
  return [...VOICE_TYPES].sort((a, b) => Math.abs((a.lo + a.hi) / 2 - mid) - Math.abs((b.lo + b.hi) / 2 - mid))[0]
}

export const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
export const median = (a: number[]) => {
  if (!a.length) return 0
  const s = [...a].sort((x, y) => x - y)
  return s[s.length >> 1]
}

/**
 * Анализ выдержанного звука по отсчётам высоты:
 * sd — разброс вокруг средней высоты (центы, без учёта вибрато),
 * rate/extent — частота (Гц) и размах (±центы) вибрато. Норма у певцов ~4,5–6,5 Гц, ±25–100 ц.
 */
export function analyzeTone(samples: { t: number; midi: number | null }[], target?: number, tol = 15) {
  const pts = samples.filter(s => s.midi != null) as { t: number; midi: number }[]
  if (pts.length < 20) return null
  const dur = pts[pts.length - 1].t - pts[0].t
  const center = median(pts.map(p => p.midi))
  const cents = pts.map(p => (p.midi - center) * 100)
  // медленный дрейф — скользящее среднее ~0,4 с; остаток — колебания вибрато
  const win = Math.max(3, Math.round((pts.length / dur) * 0.4))
  const slow = cents.map((_, i) => avg(cents.slice(Math.max(0, i - win), i + win + 1)))
  const fast = cents.map((c, i) => c - slow[i])
  let crossings = 0
  for (let i = 1; i < fast.length; i++) if ((fast[i - 1] < 0) !== (fast[i] < 0)) crossings++
  const rms = Math.sqrt(avg(fast.map(x => x * x)))
  const rate = crossings / 2 / dur
  const sd = Math.sqrt(avg(slow.map(x => x * x)))
  // попадание по центру вибрато, а не по каждому колебанию
  const inTune = target == null ? null : slow.filter(x => Math.abs(x + (center - target) * 100) <= tol).length / slow.length
  return { sd, rate, extent: rms * Math.SQRT2, vibrato: rms * Math.SQRT2 > 12 && rate > 3.5 && rate < 8, center, inTune }
}

/** Русское склонение по числу: plural(21, ['день', 'дня', 'дней']) → «день» */
export function plural(n: number, [one, few, many]: [string, string, string]) {
  // в английском две формы: 1 — единственное, остальное — «many» (в словаре они совпадают с «few»)
  if (lang === 'en') return Math.abs(n) === 1 ? one : many
  const a = Math.abs(n) % 100, b = a % 10
  if (a > 10 && a < 20) return many
  if (b === 1) return one
  return b >= 2 && b <= 4 ? few : many
}

/**
 * Голос → ноты. Голос «плавает» и скачет, поэтому:
 * 1) медиана по 5 кадрам гасит выбросы; 2) новая нота начинается, только если высота ушла от текущей
 *    больше чем на 0,6 полутона и держится ≥ 90 мс; 3) ноты короче восьмой сливаются с соседями;
 * 4) высота ноты — медиана сегмента, при желании притягивается к ладу; 5) начало и длина — по сетке восьмых.
 */
export function transcribe(
  frames: { t: number; midi: number | null }[], t0: number, beat: number, totalBeats: number,
  scale?: { keyPc: number; steps: readonly number[] },
) {
  const pts = frames.map((f, i) => {
    if (f.midi == null) return { t: f.t, m: null as number | null }
    const win = frames.slice(Math.max(0, i - 2), i + 3).map(x => x.midi).filter((x): x is number => x != null)
    return { t: f.t, m: median(win) }
  })
  type Seg = { t0: number; t1: number; ms: number[] }
  const segs: Seg[] = []
  let cur: Seg | null = null, pend: Seg | null = null
  for (const p of pts) {
    if (p.m == null) { if (cur) segs.push(cur); cur = null; pend = null; continue }
    if (!cur) { cur = { t0: p.t, t1: p.t, ms: [p.m] }; continue }
    const center = median(cur.ms)
    if (Math.abs(p.m - center) <= 0.6) { cur.t1 = p.t; cur.ms.push(p.m); pend = null; continue }
    const pv = pend as Seg | null
    pend = pv && Math.abs(p.m - median(pv.ms)) <= 0.6 ? { t0: pv.t0, t1: p.t, ms: [...pv.ms, p.m] } : { t0: p.t, t1: p.t, ms: [p.m] }
    if (pend.t1 - pend.t0 >= 0.09) { segs.push(cur); cur = pend; pend = null }
  }
  if (cur) segs.push(cur)
  const q = (x: number) => Math.round(x * 2) / 2
  const snap = (m: number) => {
    if (!scale) return Math.round(m)
    let best = Math.round(m), bd = 99
    for (let k = Math.floor(m) - 2; k <= Math.ceil(m) + 2; k++) {
      const pc = (((k - scale.keyPc) % 12) + 12) % 12
      if (scale.steps.includes(pc) && Math.abs(k - m) < bd) { bd = Math.abs(k - m); best = k }
    }
    // притягиваем к ладу, только если до него не дальше 0,7 полутона — иначе оставляем как спето
    return bd <= 0.7 ? best : Math.round(m)
  }
  const notes: { m: number; beat: number; d: number }[] = []
  for (const s of segs) {
    const b0 = q((s.t0 - t0) / beat), b1 = q((s.t1 - t0) / beat)
    if (b0 < 0 || b0 >= totalBeats) continue
    const m = snap(median(s.ms)), d = Math.max(0.5, b1 - b0)
    const last = notes[notes.length - 1]
    // слишком короткие — склеиваем с соседом; одинаковые подряд с маленьким зазором — одна нота
    if (last && (b1 - b0 < 0.5 || (last.m === m && b0 - (last.beat + last.d) <= 0.5))) { last.d = Math.min(totalBeats - last.beat, Math.max(last.d, b1 - last.beat)); continue }
    if (b1 - b0 < 0.5 && !last) continue
    if (last && b0 < last.beat + last.d) last.d = Math.max(0.5, b0 - last.beat)
    if (last && b0 <= last.beat) continue
    notes.push({ m, beat: b0, d: Math.min(d, totalBeats - b0) })
  }
  return notes
}

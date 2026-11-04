export const NAMES = ['До', 'До♯', 'Ре', 'Ре♯', 'Ми', 'Фа', 'Фа♯', 'Соль', 'Соль♯', 'Ля', 'Ля♯', 'Си']
export const LATIN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12)
export const ftom = (f: number) => 69 + 12 * Math.log2(f / 440)
const pc = (m: number) => ((Math.round(m) % 12) + 12) % 12
export const octave = (m: number) => Math.floor(Math.round(m) / 12) - 1
export const noteName = (m: number) => NAMES[pc(m)] + octave(m)
export const latinName = (m: number) => LATIN[pc(m)] + octave(m)
export const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(pc(m))

export const INTERVALS = [
  { st: 1, short: 'м2', name: 'малая секунда' },
  { st: 2, short: 'б2', name: 'большая секунда' },
  { st: 3, short: 'м3', name: 'малая терция' },
  { st: 4, short: 'б3', name: 'большая терция' },
  { st: 5, short: 'ч4', name: 'чистая кварта' },
  { st: 6, short: 'тт', name: 'тритон' },
  { st: 7, short: 'ч5', name: 'чистая квинта' },
  { st: 8, short: 'м6', name: 'малая секста' },
  { st: 9, short: 'б6', name: 'большая секста' },
  { st: 10, short: 'м7', name: 'малая септима' },
  { st: 11, short: 'б7', name: 'большая септима' },
  { st: 12, short: 'ч8', name: 'октава' },
]

export const VOICE_TYPES = [
  { name: 'Бас', lo: 40, hi: 64 },
  { name: 'Баритон', lo: 45, hi: 69 },
  { name: 'Тенор', lo: 48, hi: 72 },
  { name: 'Контральто', lo: 53, hi: 77 },
  { name: 'Меццо-сопрано', lo: 57, hi: 81 },
  { name: 'Сопрано', lo: 60, hi: 84 },
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

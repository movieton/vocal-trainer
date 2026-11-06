import en from '../locales/en.json'

export type Lang = 'ru' | 'en'
const KEY = 'vt:lang'
const RU_LIKE = ['ru', 'uk', 'be', 'kk']

/** Язык: сохранённый выбор, иначе язык браузера */
function detect(): Lang {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v === 'ru' || v === 'en') return v
  } catch { /* приватный режим */ }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  return langs.some(l => RU_LIKE.includes(l?.slice(0, 2).toLowerCase())) ? 'ru' : 'en'
}

export const lang: Lang = detect()
document.documentElement.lang = lang

const dict = en as Record<string, string>

/** Перевод по русской фразе; {0}, {1} — подстановки */
export function tr(ru: string, ...args: unknown[]): string {
  const s = lang === 'en' ? dict[ru] ?? ru : ru
  return args.length ? s.replace(/\{(\d+)\}/g, (_, i) => String(args[+i] ?? '')) : s
}

/** Смена языка: сохраняем и перезагружаем — тексты модулей собираются заново */
export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, JSON.stringify(l)) } catch { /* ignore */ }
  location.reload()
}

if (lang === 'en') {
  document.title = 'fasol.app — voice trainer'
  document.querySelector('meta[name=description]')?.setAttribute('content', 'Vocal warm-ups on a note board, ear training, breathing and melody writing.')
}

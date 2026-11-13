
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
/** Локаль дат и времени по языку интерфейса */
export const locale = lang === 'en' ? 'en-US' : 'ru'
document.documentElement.lang = lang

let dict: Record<string, string> = {}
/** Английская библиотека упражнений — грузится только для английского языка */
export let libEn: unknown = null

/** Подгрузить словарь и английские данные до запуска приложения (русским они не нужны) */
export async function loadLang() {
  if (lang !== 'en') return
  const [d, l] = await Promise.all([import('../locales/en.json'), import('../data/library.en.json')])
  dict = d.default as Record<string, string>
  libEn = l.default
}

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

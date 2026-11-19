
export type Lang = 'ru' | 'en'
const KEY = 'vt:lang'
/** Языки, для которых интерфейс по-русски: ru и близкие, где английский был бы хуже */
const RU_LIKE = ['ru', 'uk', 'be', 'kk']

/** Первичный подъязык: `ru-RU`, `ru_RU`, `RU` → `ru` */
export function primarySubtag(tag: string): string {
  return tag.trim().toLowerCase().replace(/_/g, '-').split('-')[0].replace(/[^a-z]/g, '')
}

/** Теги из navigator.languages (массив, array-like или строка) и запасной navigator.language */
export function collectLanguageTags(languages: unknown, language?: unknown): string[] {
  const tags: string[] = []
  const push = (value: unknown) => {
    if (typeof value !== 'string') return
    for (const part of value.split(',')) {
      const tag = part.trim()
      if (tag) tags.push(tag)
    }
  }
  if (typeof languages === 'string') push(languages)
  else if (Array.isArray(languages)) languages.forEach(push)
  else if (languages && typeof languages === 'object') {
    const list = languages as ArrayLike<unknown>
    const n = Number(list.length)
    if (Number.isFinite(n)) for (let i = 0; i < n && i < 32; i++) push(list[i])
  }
  push(language)
  return tags
}

/**
 * Явный выбор (`ru`/`en`) побеждает. Иначе русский, если среди языков браузера есть ru*
 * (или uk/be/kk), иначе английский. Пустой список — английский.
 */
export function resolveLang(stored: unknown, languages?: unknown, language?: unknown): Lang {
  if (stored === 'ru' || stored === 'en') return stored
  const tags = collectLanguageTags(languages, language)
  return tags.some(t => RU_LIKE.includes(primarySubtag(t))) ? 'ru' : 'en'
}

function readChoice(): unknown {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null) return null
    try { return JSON.parse(raw) } catch { return raw }
  } catch { return null }
}

/** Язык: сохранённый выбор, иначе язык браузера */
function detect(): Lang {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  return resolveLang(readChoice(), nav?.languages, nav?.language)
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

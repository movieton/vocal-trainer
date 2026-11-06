import { lang, setLang, type Lang } from '../lib/i18n'

const LANGS: { id: Lang; label: string }[] = [{ id: 'ru', label: 'Русский' }, { id: 'en', label: 'English' }]

/** Выбор языка: смена перезагружает страницу */
export default function LangSwitch({ className = '' }: { className?: string }) {
  return (
    <div className={'seg lang-switch ' + className} role="radiogroup" aria-label="Language / Язык">
      {LANGS.map(l => (
        <button key={l.id} role="radio" aria-checked={lang === l.id} aria-pressed={lang === l.id} lang={l.id} onClick={() => lang !== l.id && setLang(l.id)}>{l.label}</button>
      ))}
    </div>
  )
}

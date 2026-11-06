import { tr } from '../lib/i18n'
import { NAMES } from '../lib/music'
import type { Key } from '../lib/run'

/** Выбор тональности: «авто» или одна из 12 нот */
export default function KeySelect({ value, onChange, disabled }: { value: Key; onChange: (k: Key) => void; disabled?: boolean }) {
  return (
    <select value={String(value)} disabled={disabled} onChange={e => onChange(e.target.value === 'auto' ? 'auto' : +e.target.value)}>
      <option value="auto">{tr('Авто — по диапазону')}</option>
      {NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
    </select>
  )
}

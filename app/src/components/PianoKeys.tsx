import { tr } from '../lib/i18n'
import { isBlack, noteName } from '../lib/music'

/**
 * Клавиатура пианино на диапазон lo…hi. Внешний вид — классы .pk из index.css (как в «Сочинении»).
 * label — подпись на клавише, cls — дополнительный класс (подсветка ответа, приглушение).
 */
export function PianoKeys({ lo, hi, onPress, label, cls }: {
  lo: number; hi: number; onPress: (m: number) => void; label?: (m: number) => string | null; cls?: (m: number) => string
}) {
  const keys = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  return (
    <div className="keyboard" role="group" aria-label={tr('Клавиатура')}>
      {keys.map(m => {
        const l = label?.(m)
        return (
          <button key={m} className={'pk ' + (isBlack(m) ? 'black ' : 'white ') + (cls?.(m) ?? '')}
            onPointerDown={e => { e.preventDefault(); onPress(m) }} aria-label={l ? `${noteName(m)}, ${l}` : noteName(m)}>
            {l && <span>{l}</span>}
          </button>
        )
      })}
    </div>
  )
}

import { tr } from '../lib/i18n'

/** «Было → стало»: изменение к прошлому разу на этом же упражнении */
export default function Delta({ now, prev }: { now: number; prev: number }) {
  const d = now - prev
  if (d === 0) return <p className="delta">{tr('Как в прошлый раз ({0}%)', prev)}</p>
  return <p className={'delta ' + (d > 0 ? 'up' : 'down')}><b>{d > 0 ? '+' : '−'}{Math.abs(d)}</b> {tr('к прошлому разу ({0}%)', prev)}</p>
}

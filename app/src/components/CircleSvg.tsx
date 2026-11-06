import { lang } from '../lib/i18n'
import { tr } from '../lib/i18n'
import { CIRCLE } from '../lib/theory'

export const sigText = (s: number) => (s === 0 ? tr('без знаков') : `${Math.abs(s)} ${s > 0 ? tr('диез') : tr('бемол')}${Math.abs(s) === 1 ? '' : Math.abs(s) < 5 ? 'а' : tr('ов')}`)

/**
 * Квинтовый круг: снаружи мажорные тональности, внутри параллельные миноры.
 * sel — индекс по кругу, minor — выбран минор; onPick(индекс, минор?)
 */
export default function CircleSvg({ sel, minor = false, onPick }: { sel: number; minor?: boolean; onPick: (i: number, minor: boolean) => void }) {
  const R = 150, r = 98, C = 180
  const pos = (i: number, rad: number) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2
    return [C + rad * Math.cos(a), C + rad * Math.sin(a)]
  }
  const near = [(sel + 11) % 12, (sel + 1) % 12]
  const key = CIRCLE[sel]
  const act = (i: number, m: boolean) => ({
    onClick: () => onPick(i, m),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(i, m) } },
    role: 'button', tabIndex: 0,
  })
  return (
    <svg viewBox="0 0 360 360" className="circle" role="group" aria-label={tr('Квинтовый круг')}>
      <circle cx={C} cy={C} r={R + 28} className="ring" />
      <circle cx={C} cy={C} r={r - 24} className="ring inner" />
      {CIRCLE.map((k, i) => {
        const [x, y] = pos(i, R), [x2, y2] = pos(i, r)
        const cls = i === sel ? (minor ? 'on-min' : 'on') : near.includes(i) ? 'near' : ''
        return (
          <g key={k.pc} className={'key ' + cls}>
            <g {...act(i, false)} aria-label={tr('{0} мажор', k.major)}>
              <circle cx={x} cy={y} r={22} />
              <text x={x} y={y + 5} textAnchor="middle" className="maj">{k.major}</text>
            </g>
            <g {...act(i, true)} aria-label={tr('{0} минор', k.minor)}>
              <circle cx={x2} cy={y2} r={17} className="min-dot" />
              <text x={x2} y={y2 + 4} textAnchor="middle" className="min">{k.minor}{lang === 'en' ? 'm' : ''}</text>
            </g>
          </g>
        )
      })}
      <text x={C} y={C - 4} textAnchor="middle" className="center-big">{minor ? key.minor : key.major}</text>
      <text x={C} y={C + 16} textAnchor="middle" className="center-small">{minor ? tr('минор') : tr('мажор')} · {sigText(key.sig)}</text>
    </svg>
  )
}

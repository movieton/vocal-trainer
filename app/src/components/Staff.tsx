import { Play } from 'lucide-react'
import { engine } from '../lib/audio'

/**
 * Нотоносец: ключ, знаки при ключе, размер, ноты разных длительностей, аккорды, паузы и тактовые черты.
 * Ноты задаются midi-номерами; написание (диез/бемоль) — полем acc.
 */
export type Dur = 1 | 2 | 4 | 8
export type StaffItem =
  | { m: number | number[]; d?: Dur; acc?: '#' | 'b' | 'n'; dot?: boolean; label?: string; hl?: 'ok' | 'bad' | 'on' }
  | { rest: Dur; label?: string }
  | { bar: true }
export type Clef = 'treble' | 'bass'

const LETTER_OF_PC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6] // до,до#,ре,ре#,ми,фа,фа#,соль,соль#,ля,ля#,си
const LETTER_OF_PC_FLAT = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6]
/** Номер ступени на нотоносце (до первой октавы = 28) */
export const diatonic = (m: number, flat = false) => (Math.floor(m / 12) - 1) * 7 + (flat ? LETTER_OF_PC_FLAT : LETTER_OF_PC)[m % 12]
const BOTTOM = { treble: 30, bass: 18 } // ми1 и соль большой — нижние линии
const SHARPS = [38, 35, 39, 36, 33, 37, 34], FLATS = [34, 37, 33, 36, 32, 35, 31]
const BEAT_SEC: Record<Dur, number> = { 1: 2, 2: 1, 4: 0.5, 8: 0.25 }

export function Staff({ items, clef = 'treble', keySig = 0, time, caption, play = true, height = 150 }: {
  items: StaffItem[]; clef?: Clef; keySig?: number; time?: [number, number]; caption?: string; play?: boolean; height?: number
}) {
  const H = 8 // половина расстояния между линиями
  const top = 44, bottomY = top + 8 * H
  const y = (d: number) => bottomY - (d - BOTTOM[clef]) * H
  const shift = clef === 'bass' ? -14 : 0
  let x = 48 + Math.abs(keySig) * 11 + (time ? 30 : 0)
  const x0 = x
  const placed = items.map(it => { const at = x; x += 'bar' in it ? 18 : 46; return { it, at } })
  const W = Math.max(x + 16, 200)

  const listen = () => {
    let t = engine.ensureCtx().currentTime + 0.05
    for (const it of items) {
      if ('bar' in it) continue
      if ('rest' in it) { t += BEAT_SEC[it.rest]; continue }
      const sec = BEAT_SEC[it.d ?? 4] * (it.dot ? 1.5 : 1)
      for (const m of ([] as number[]).concat(it.m)) engine.play(m, t, sec * 0.95, 72)
      t += sec
    }
  }

  return (
    <figure className="fig staff-fig">
      <svg viewBox={`0 0 ${W} ${height}`} className="staff" role="img" aria-label={caption ?? 'Ноты на нотоносце'}>
        {[0, 1, 2, 3, 4].map(i => <line key={i} x1="4" x2={W - 4} y1={bottomY - i * 2 * H} y2={bottomY - i * 2 * H} className="st-line" />)}
        <line x1={W - 4} x2={W - 4} y1={top} y2={bottomY} className="st-line" />
        {clef === 'treble'
          ? <text x="6" y={bottomY + 10} className="clef treble">𝄞</text>
          : <text x="8" y={bottomY - 14} className="clef bass">𝄢</text>}
        {Array.from({ length: Math.abs(keySig) }, (_, i) => (
          <text key={i} x={40 + i * 11} y={y((keySig > 0 ? SHARPS : FLATS)[i] + shift) + 5} className="acc">{keySig > 0 ? '♯' : '♭'}</text>
        ))}
        {time && <g className="time"><text x={x0 - 24} y={top + 2 * H + 6}>{time[0]}</text><text x={x0 - 24} y={top + 6 * H + 6}>{time[1]}</text></g>}
        {placed.map(({ it, at }, i) => {
          if ('bar' in it) return <line key={i} x1={at + 6} x2={at + 6} y1={top} y2={bottomY} className="st-line" />
          if ('rest' in it) return (
            <g key={i}>
              {it.rest === 1 && <rect x={at + 8} y={top + 2 * H} width="16" height="6" className="note-fill" />}
              {it.rest === 2 && <rect x={at + 8} y={top + 4 * H - 6} width="16" height="6" className="note-fill" />}
              {it.rest >= 4 && <text x={at + 10} y={top + 5 * H} className="rest-glyph">{it.rest === 4 ? '𝄽' : '𝄾'}</text>}
              {it.label && <text x={at + 16} y={height - 6} textAnchor="middle" className="st-lbl">{it.label}</text>}
            </g>
          )
          const ms = ([] as number[]).concat(it.m), flat = it.acc === 'b'
          const ds = ms.map(m => diatonic(m, flat))
          const d = it.d ?? 4, hollow = d <= 2, cx = at + 16
          const mid = BOTTOM[clef] + 4, up = ds.reduce((a, b) => a + b, 0) / ds.length < mid
          const hi = Math.max(...ds), lo = Math.min(...ds)
          const ledgers: number[] = []
          for (let l = BOTTOM[clef] - 2; l >= lo; l -= 2) ledgers.push(l)
          for (let l = BOTTOM[clef] + 10; l <= hi; l += 2) ledgers.push(l)
          const sx = up ? cx + 6.5 : cx - 6.5
          return (
            <g key={i} className={'note' + (it.hl ? ' ' + it.hl : '')}>
              {ledgers.map(l => <line key={l} x1={cx - 12} x2={cx + 12} y1={y(l)} y2={y(l)} className="st-line" />)}
              {ds.map((dd, j) => <ellipse key={j} cx={cx} cy={y(dd)} rx="7.5" ry="5.5" transform={`rotate(-20 ${cx} ${y(dd)})`} className={hollow ? 'note-hollow' : 'note-fill'} />)}
              {it.acc && <text x={cx - 22} y={y(ds[0]) + 5} className="acc">{it.acc === '#' ? '♯' : it.acc === 'b' ? '♭' : '♮'}</text>}
              {it.dot && <circle cx={cx + 12} cy={y(ds[0]) - (ds[0] % 2 === BOTTOM[clef] % 2 ? 4 : 0)} r="2.2" className="note-fill" />}
              {d >= 2 && <line x1={sx} x2={sx} y1={y(up ? lo : hi)} y2={up ? y(hi) - 28 : y(lo) + 28} className="stem" />}
              {d === 8 && <path d={up ? `M${sx} ${y(hi) - 28} q10 8 8 20` : `M${sx} ${y(lo) + 28} q10 -8 8 -20`} className="flag" />}
              {it.label && <text x={cx} y={height - 6} textAnchor="middle" className="st-lbl">{it.label}</text>}
            </g>
          )
        })}
      </svg>
      {(caption || play) && (
        <figcaption className="staff-cap">
          {play && <button className="textbtn listen" onClick={listen}><Play size={14} fill="currentColor" /> Послушать</button>}
          {caption && <span>{caption}</span>}
        </figcaption>
      )}
    </figure>
  )
}

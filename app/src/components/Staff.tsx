import { useEffect, useRef, useState } from 'react'
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
// глифы нотного шрифта Bravura (стандарт SMuFL): размер шрифта = 4 промежутка нотоносца
const G = { gClef: '\uE050', fClef: '\uE062', sharp: '\uE262', flat: '\uE260', natural: '\uE261', rest: { 1: '\uE4E3', 2: '\uE4E4', 4: '\uE4E5', 8: '\uE4E6' } as Record<Dur, string> }

type Props = { items: StaffItem[]; clef?: Clef; keySig?: number; time?: [number, number]; caption?: string; play?: boolean; height?: number }

/** Ширина строки нотоносца в единицах рисунка */
const lineWidth = (items: StaffItem[], keySig: number, time?: unknown) =>
  74 + Math.abs(keySig) * 14 + (time ? 30 : 0) + items.reduce((a, it) => a + ('bar' in it ? 18 : Math.max(44, ('label' in it && it.label ? it.label.length : 0) * 9 + 14)), 0) + 16

/**
 * Нотоносец. На узком экране длинный пример переносится на несколько строк (как в нотах),
 * чтобы не мельчить и не листать вбок: масштаб не меньше 0,85 от натурального.
 */
export function Staff(props: Props) {
  const ref = useRef<HTMLElement>(null)
  const [avail, setAvail] = useState(10000)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const { items, keySig = 0, time } = props
  // сколько строк нужно, а затем — поровну по строкам, чтобы не оставалось «сирот» вроде 6+2
  const fits = (l: StaffItem[], first: boolean) => lineWidth(l, keySig, first && time) * 0.85 <= avail
  let n = 1
  for (let cur: StaffItem[] = [], first = true, i = 0; i < items.length; i++) {
    if (cur.length && !fits([...cur, items[i]], first)) { n++; cur = []; first = false }
    cur.push(items[i])
  }
  const notes = items.filter(it => !('bar' in it)).length, per = Math.ceil(notes / n)
  const lines: StaffItem[][] = [[]]
  // есть тактовые черты — переносим только по ним, целыми тактами
  if (n > 1 && items.some(it => 'bar' in it)) {
    const measures: StaffItem[][] = [[]]
    for (const it of items) { measures[measures.length - 1].push(it); if ('bar' in it) measures.push([]) }
    for (const m of measures.filter(m => m.length)) {
      const cur = lines[lines.length - 1]
      if (cur.length && !fits([...cur, ...m], lines.length === 1)) lines.push([])
      lines[lines.length - 1].push(...m)
    }
  } else {
  let count = 0
  for (const it of items) {
    if ('bar' in it) { if (lines[lines.length - 1].length) lines[lines.length - 1].push(it); continue }
    if (count === per && lines.length < n) { lines.push([]); count = 0 }
    lines[lines.length - 1].push(it); count++
  }
  }
  return (
    <figure className="fig staff-fig" ref={ref}>
      {lines.map((l, i) => <StaffLine key={i} {...props} items={l} time={i === 0 ? time : undefined} lineEnd={i === lines.length - 1} />)}
      {(props.caption || props.play !== false) && (
        <figcaption className="staff-cap">
          {props.play !== false && <button className="textbtn listen" onClick={() => listen(items)}><Play size={14} fill="currentColor" /> Послушать</button>}
          {props.caption && <span>{props.caption}</span>}
        </figcaption>
      )}
    </figure>
  )
}

function listen(items: StaffItem[]) {
  let t = engine.ensureCtx().currentTime + 0.05
  for (const it of items) {
    if ('bar' in it) continue
    if ('rest' in it) { t += BEAT_SEC[it.rest]; continue }
    const sec = BEAT_SEC[it.d ?? 4] * (it.dot ? 1.5 : 1)
    for (const m of ([] as number[]).concat(it.m)) engine.play(m, t, sec * 0.95, 72)
    t += sec
  }
}

function StaffLine({ items, clef = 'treble', keySig = 0, time, caption, height = 190, lineEnd }: Props & { lineEnd: boolean }) {
  const H = 8 // половина расстояния между линиями
  const top = 62, bottomY = top + 8 * H
  const y = (d: number) => bottomY - (d - BOTTOM[clef]) * H
  const shift = clef === 'bass' ? -14 : 0
  let x = 74 + Math.abs(keySig) * 14 + (time ? 30 : 0)
  const x0 = x
  // шаг у каждой ноты свой: подпись под ней не должна наезжать на соседнюю
  const stepOf = (it: StaffItem) => 'bar' in it ? 18 : Math.max(44, ('label' in it && it.label ? it.label.length : 0) * 9 + 14)
  const placed = items.map(it => { const at = x; x += stepOf(it); return { it, at } })
  // строка, оканчивающаяся тактовой чертой, обрывается на ней
  const last = placed[placed.length - 1]
  const W = last && 'bar' in last.it ? last.at + 10 : Math.max(x + 16, 200)

  return (
      <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} className="staff" role="img" aria-label={caption ?? 'Ноты на нотоносце'}>
        {[0, 1, 2, 3, 4].map(i => <line key={i} x1="4" x2={W - 4} y1={bottomY - i * 2 * H} y2={bottomY - i * 2 * H} className="st-line" />)}
        {lineEnd && <line x1={W - 4} x2={W - 4} y1={top} y2={bottomY} className="st-line" />}
        {/* ключ: скрипичный стоит на 2-й линии (соль), басовый — на 4-й (фа) */}
        <text x="8" y={clef === 'treble' ? y(32) : y(24)} className="smufl">{clef === 'treble' ? G.gClef : G.fClef}</text>
        {Array.from({ length: Math.abs(keySig) }, (_, i) => (
          <text key={i} x={60 + i * 14} y={y((keySig > 0 ? SHARPS : FLATS)[i] + shift)} className="smufl">{keySig > 0 ? G.sharp : G.flat}</text>
        ))}
        {time && <g className="time"><text x={x0 - 24} y={top + 2 * H + 6}>{time[0]}</text><text x={x0 - 24} y={top + 6 * H + 6}>{time[1]}</text></g>}
        {placed.map(({ it, at }, i) => {
          if ('bar' in it) return <line key={i} x1={at + 6} x2={at + 6} y1={top} y2={bottomY} className="st-line" />
          if ('rest' in it) return (
            <g key={i}>
              {/* паузы: целая висит под 4-й линией, остальные — от средней */}
              <text x={at + 8} y={it.rest === 1 ? top + 2 * H : top + 4 * H} className="smufl">{G.rest[it.rest]}</text>
              {it.label && <text x={at + 16} y={height - 6} textAnchor="middle" className="st-lbl">{it.label}</text>}
            </g>
          )
          const ms = ([] as number[]).concat(it.m), flat = it.acc === 'b' || (keySig < 0 && it.acc !== '#')
          const ds = ms.map(m => diatonic(m, flat))
          const d = it.d ?? 4, hollow = d <= 2, cx = at + 16
          const mid = BOTTOM[clef] + 4, up = ds.reduce((a, b) => a + b, 0) / ds.length < mid
          const hi = Math.max(...ds), lo = Math.min(...ds)
          const ledgers: number[] = []
          for (let l = BOTTOM[clef] - 2; l >= lo; l -= 2) ledgers.push(l)
          for (let l = BOTTOM[clef] + 10; l <= hi; l += 2) ledgers.push(l)
          const sx = up ? cx + 6.5 : cx - 6.5
          // секунда в аккорде: одна из соседних головок уходит на другую сторону штиля
          const sorted = [...ds].sort((a, b) => a - b)
          const side = (dd: number) => { const k = sorted.indexOf(dd); return k > 0 && sorted[k] - sorted[k - 1] === 1 && k % 2 === 1 ? (up ? 13 : -13) : 0 }
          return (
            <g key={i} className={'note' + (it.hl ? ' ' + it.hl : '')}>
              {ledgers.map(l => <line key={l} x1={cx - 12} x2={cx + 12} y1={y(l)} y2={y(l)} className="st-line" />)}
              {ds.map((dd, j) => <ellipse key={j} cx={cx + side(dd)} cy={y(dd)} rx="7.5" ry="5.5" transform={`rotate(-20 ${cx + side(dd)} ${y(dd)})`} className={hollow ? 'note-hollow' : 'note-fill'} />)}
              {it.acc && <text x={cx - 24} y={y(ds[0])} className="smufl">{it.acc === '#' ? G.sharp : it.acc === 'b' ? G.flat : G.natural}</text>}
              {it.dot && <circle cx={cx + 12} cy={y(ds[0]) - (ds[0] % 2 === BOTTOM[clef] % 2 ? H : 0)} r="2.2" className="note-fill" />}
              {d >= 2 && <line x1={sx} x2={sx} y1={y(up ? lo : hi)} y2={up ? y(hi) - 7 * H : y(lo) + 7 * H} className="stem" />}
              {d === 8 && <path d={up ? `M${sx} ${y(hi) - 7 * H} q12 10 9 24` : `M${sx} ${y(lo) + 7 * H} q12 -10 9 -24`} className="flag" />}
              {it.label && <text x={cx} y={height - 6} textAnchor="middle" className="st-lbl">{it.label}</text>}
            </g>
          )
        })}
      </svg>
  )
}

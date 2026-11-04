import { useEffect, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, Plus, Trash2 } from 'lucide-react'
import { isBlack, noteName, plural } from '../lib/music'
import { noteRole, type KeyChord } from '../lib/theory'

export type MelNote = { m: number; beat: number; d: number }

type Props = {
  melody: MelNote[]
  setMelody: (m: MelNote[]) => void
  bars: number
  lo: number
  rows?: number
  keyPc: number
  steps: readonly number[]
  prog: KeyChord[]
  /** Позиция воспроизведения в долях, null — стоим */
  pos: number | null
  onPreview: (m: number) => void
}

const STEP = 0.5 // сетка — восьмые

/**
 * Пианоролл для мелодии: клик по пустой клетке — нота на долю, клик по ноте — выбор.
 * Длительность, сдвиг и высота — кнопками или стрелками; фон клеток показывает роль ноты в аккорде такта.
 */
export default function MelodyEditor({ melody, setMelody, bars, lo, rows = 15, keyPc, steps, prog, pos, onPreview }: Props) {
  const [sel, setSel] = useState<number | null>(null)
  const cols = (bars * 4) / STEP
  const total = bars * 4
  const pitches = Array.from({ length: rows }, (_, i) => lo + rows - 1 - i)

  const update = (i: number, patch: Partial<MelNote>) => {
    const n = { ...melody[i], ...patch }
    n.d = Math.max(STEP, Math.min(total - n.beat, n.d))
    n.beat = Math.max(0, Math.min(total - STEP, n.beat))
    const next = melody.map((x, j) => (j === i ? n : x))
    setMelody(next)
    if (patch.m != null) onPreview(n.m)
  }
  const remove = (i: number) => { setMelody(melody.filter((_, j) => j !== i)); setSel(null) }
  const add = (m: number, beat: number) => {
    const n = { m, beat, d: Math.min(1, total - beat) }
    const next = [...melody, n].sort((a, b) => a.beat - b.beat || a.m - b.m)
    setMelody(next); setSel(next.indexOf(n)); onPreview(m)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sel == null || !melody[sel] || (e.target as HTMLElement).closest('input,select,textarea')) return
      const n = melody[sel]
      const map: Record<string, () => void> = {
        ArrowUp: () => update(sel, { m: n.m + 1 }), ArrowDown: () => update(sel, { m: n.m - 1 }),
        ArrowLeft: () => update(sel, { beat: n.beat - STEP }), ArrowRight: () => update(sel, { beat: n.beat + STEP }),
        Delete: () => remove(sel), Backspace: () => remove(sel),
        '+': () => update(sel, { d: n.d + STEP }), '-': () => update(sel, { d: n.d - STEP }),
      }
      if (map[e.key]) { e.preventDefault(); map[e.key]() }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const s = sel != null ? melody[sel] : null
  return (
    <div className="mel-editor">
      <div className="mel-scroll">
        <div className="mel-grid" style={{ gridTemplateColumns: `56px repeat(${cols}, minmax(18px, 1fr))` }}>
          {pitches.map((m, r) => {
            // явные позиции: иначе автораскладка сетки сдвигает клетки вокруг нот
            const label = <div key={'l' + m} style={{ gridRow: r + 1, gridColumn: 1 }} className={'mel-label' + (isBlack(m) ? ' black' : '')}>{noteName(m)}</div>
            const cells = Array.from({ length: cols }, (_, c) => {
              const beat = c * STEP, bar = Math.floor(beat / 4)
              const role = noteRole(m, keyPc, steps, prog[bar % Math.max(1, prog.length)] ?? null)
              return <div key={m + ':' + c} style={{ gridRow: r + 1, gridColumn: c + 2 }} className={`mel-cell ${role}${c % 8 === 0 ? ' bar' : c % 2 === 0 ? ' beat' : ''}`} onClick={() => add(m, beat)} />
            })
            return [label, ...cells]
          })}
          {melody.map((n, i) => {
            const row = lo + rows - 1 - n.m
            if (row < 0 || row >= rows) return null
            return (
              <button key={i} className={'mel-note' + (i === sel ? ' on' : '')} aria-label={`${noteName(n.m)}, ${n.d} доли`}
                style={{ gridRow: row + 1, gridColumn: `${2 + n.beat / STEP} / span ${Math.max(1, n.d / STEP)}` }}
                onClick={() => { setSel(i); onPreview(n.m) }}>{noteName(n.m).replace(/\d+$/, '')}</button>
            )
          })}
          {pos != null && <div className="mel-playhead" style={{ gridRow: `1 / span ${rows}`, gridColumn: 2 + Math.floor(pos / STEP) }} />}
        </div>
      </div>
      <div className="mel-tools">
        {s ? <>
          <span className="muted small mel-cur">{noteName(s.m)} · {String(s.d).replace('.', ',')} {Number.isInteger(s.d) ? plural(s.d, ['доля', 'доли', 'долей']) : 'доли'}</span>
          <span className="mel-group"><span>Длина</span><button onClick={() => update(sel!, { d: s.d - STEP })} aria-label="Короче"><Minus size={16} /></button><button onClick={() => update(sel!, { d: s.d + STEP })} aria-label="Длиннее"><Plus size={16} /></button></span>
          <span className="mel-group"><span>Сдвиг</span><button onClick={() => update(sel!, { beat: s.beat - STEP })} aria-label="Раньше"><ArrowLeft size={16} /></button><button onClick={() => update(sel!, { beat: s.beat + STEP })} aria-label="Позже"><ArrowRight size={16} /></button></span>
          <span className="mel-group"><span>Высота</span><button onClick={() => update(sel!, { m: s.m - 1 })} aria-label="Ниже"><ArrowDown size={16} /></button><button onClick={() => update(sel!, { m: s.m + 1 })} aria-label="Выше"><ArrowUp size={16} /></button></span>
          <button className="mel-del" onClick={() => remove(sel!)} aria-label="Удалить"><Trash2 size={16} /> Удалить</button>
        </> : <span className="muted small">Клик по клетке — нота на долю. Клик по ноте — выбрать; стрелки двигают, «+»/«−» меняют длину, Delete удаляет. Зелёные клетки — звуки аккорда этого такта.</span>}
      </div>
    </div>
  )
}

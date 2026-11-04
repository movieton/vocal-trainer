import { useEffect, useRef } from 'react'
import PianoRoll from '../components/PianoRoll'
import { CentsMeter, LiveNote, MicGate, useEngine } from '../components/Mic'
import { engine, SIM } from '../lib/audio'
import { mtof } from '../lib/music'
import { useStored, useWorkRange } from '../lib/store'

export default function Tuner() {
  const [octaves, setOctaves] = useStored('tunerOct', 2)
  const [win, setWin] = useStored('tunerWin', 8)
  const r = useWorkRange()
  const center = useRef((r.lo + r.hi) / 2)

  useEffect(() => {
    if (SIM) engine.simTarget = t => 55 + 5 * Math.sin(t / 2) + 0.2 * Math.sin(t * 30)
    return () => { engine.simTarget = null }
  }, [])

  // окно стоит на месте и сдвигается, только когда голос подходит к краю
  const view = () => {
    const half = (octaves * 12) / 2
    const m = engine.current
    if (m != null) {
      if (m > center.current + half - 2) center.current = m - half + 4
      if (m < center.current - half + 2) center.current = m + half - 4
    }
    const lo = Math.round(center.current - half)
    return { lo, hi: lo + octaves * 12 }
  }

  return (
    <div className="page">
      <h1>Тюнер</h1>
      <p className="muted">Пой что угодно: видно, какую ноту берёшь и на сколько уходишь. Зелёный — ±12 центов, жёлтый — до 25, красный — мимо.</p>
      <MicGate>
        <div className="tuner-top">
          <LiveNote big />
          <div className="tuner-meter">
            <CentsMeter tolerance={12} />
            <div className="scale"><span>−50</span><span>0</span><span>+50</span></div>
            <Hz />
          </div>
        </div>
        <PianoRoll view={view} windowSec={win} playhead={0.85} tolerance={24} className="tall" />
        <div className="settings">
          <label>Высота окна
            <span className="seg">{[1, 2, 3].map(o => <button key={o} aria-pressed={octaves === o} onClick={() => setOctaves(o)}>{o} окт</button>)}</span>
          </label>
          <label>История
            <span className="seg">{[4, 8, 15].map(s => <button key={s} aria-pressed={win === s} onClick={() => setWin(s)}>{s} с</button>)}</span>
          </label>
        </div>
      </MicGate>
    </div>
  )
}

function Hz() {
  useEngine(8)
  const m = engine.current
  return <div className="muted small">{m == null ? ' ' : Math.round(mtof(m)) + ' Гц'}</div>
}

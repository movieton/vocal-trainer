import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PianoRoll from '../components/PianoRoll'
import { LiveNote, MicGate } from '../components/Mic'
import { engine, SIM } from '../lib/audio'
import { guessVoiceType, noteName, VOICE_TYPES } from '../lib/music'
import { DEFAULT_VOICE, useStored, useWorkRange, type Range } from '../lib/store'

export default function RangeTest() {
  const [range, setRange] = useStored<Range | null>('range', null)
  const [measuring, setMeasuring] = useState(false)
  const [voice, setVoice] = useStored('voiceType', DEFAULT_VOICE)
  const work = useWorkRange()
  const found = useRef<Range | null>(null)
  const stable = useRef({ m: 0, n: 0 })
  const [live, setLive] = useState<Range | null>(null)

  useEffect(() => engine.subscribe(() => {
    if (!measuring || engine.current == null) { stable.current.n = 0; return }
    const m = Math.round(engine.current)
    stable.current = stable.current.m === m ? { m, n: stable.current.n + 1 } : { m, n: 1 }
    if (stable.current.n === 15) {
      const f = found.current
      found.current = f ? { lo: Math.min(f.lo, m), hi: Math.max(f.hi, m) } : { lo: m, hi: m }
      setLive(found.current)
    }
  }), [measuring])

  useEffect(() => {
    if (!SIM || !measuring) return
    const t0 = engine.now()
    engine.simTarget = t => 45 + 22 * (((t - t0) / 8) % 1)
    return () => { engine.simTarget = null }
  }, [measuring])

  const toggle = () => {
    if (measuring) {
      if (found.current && found.current.hi - found.current.lo >= 5) setRange(found.current)
      setMeasuring(false)
    } else { found.current = null; setLive(null); setMeasuring(true) }
  }

  const shown = measuring ? live : range
  const center = useRef(55)
  // окно 2,5 октавы едет за голосом, как в тюнере
  const view = () => {
    const m = engine.current
    if (m != null) {
      if (m > center.current + 13) center.current = m - 11
      if (m < center.current - 13) center.current = m + 11
    }
    const lo = Math.round(center.current - 15)
    return { lo, hi: lo + 30 }
  }
  const type = range ? guessVoiceType(range.lo, range.hi) : null

  return (
    <div className="page">
      <h1>Голос и диапазон</h1>
      <div className="card">
        <h2>Тип голоса</h2>
        <p className="muted small">Упражнения строятся в удобной зоне выбранного типа голоса, а не на крайних нотах. Сейчас рабочий диапазон: <b>{noteName(work.lo)}–{noteName(work.hi)}</b>.</p>
        <span className="seg wide voice-seg">
          {VOICE_TYPES.map(v => <button key={v.name} aria-pressed={voice === v.name} onClick={() => setVoice(v.name)}>{v.name}</button>)}
          <button aria-pressed={voice === 'measured'} disabled={!range} onClick={() => setVoice('measured')} title={range ? '' : 'Сначала измерь диапазон'}>По моему замеру</button>
        </span>
        <p className="muted small">Мужские голоса обычно бас, баритон или тенор, женские — контральто, меццо-сопрано или сопрано. Не уверен — выбирай баритон или меццо-сопрано, это самые частые.</p>
      </div>
      <h2 style={{ marginTop: 28 }}>Замер диапазона</h2>
      <p className="muted">Нажми «Начать», спокойно протяни «а-а-а» от самой низкой удобной ноты к самой высокой, без напряжения и крика. Засчитывается нота, которую ты удержал хотя бы четверть секунды. Замер нужен, чтобы узнать границы голоса. Упражнения по нему строятся, только если выбрать «По моему замеру» — тогда берутся нижние 70%, без пиковых нот.</p>
      <MicGate>
        <div className="tuner-top">
          <LiveNote big />
          <p className="rangeline">{shown ? <><b>{noteName(shown.lo)} – {noteName(shown.hi)}</b> · {shown.hi - shown.lo} полутонов</> : 'Диапазон ещё не найден'}</p>
        </div>
        <PianoRoll view={view} band={() => shown} neutral windowSec={10} playhead={0.85} className="tall" />
        <div className="toolbar">
          <button className={'btn' + (measuring ? ' stop' : '')} onClick={toggle}>{measuring ? 'Готово' : 'Начать'}</button>
          {range && !measuring && <button className="btn ghost" onClick={() => setRange(null)}>Сбросить</button>}
        </div>
      </MicGate>
      {type && range && (
        <div className="card">
          <h2>Похоже на: {type.name}</h2>
          <p className="muted">Это ориентир, а не диагноз: тип голоса определяет тембр и удобная зона (тесситура), а не только крайние ноты.</p>
          <div className="vtypes">
            {VOICE_TYPES.map(v => {
              const left = ((v.lo - 36) / 50) * 100, width = ((v.hi - v.lo) / 50) * 100
              return (
                <div key={v.name} className={'vt' + (v.name === type.name ? ' on' : '')}>
                  <span>{v.name}</span>
                  <div className="bar"><i style={{ left: left + '%', width: width + '%' }} />
                    <b style={{ left: ((range.lo - 36) / 50) * 100 + '%', width: ((range.hi - range.lo) / 50) * 100 + '%' }} /></div>
                </div>
              )
            })}
          </div>
          <p className="small muted">Серым — типичный диапазон, цветом — твой. <Link to="/library">К распевкам →</Link></p>
        </div>
      )}
    </div>
  )
}

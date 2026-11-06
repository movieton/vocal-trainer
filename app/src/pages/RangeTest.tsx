import { tr } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PianoRoll from '../components/PianoRoll'
import { LiveNote, MicGate } from '../components/Mic'
import { engine, SIM } from '../lib/audio'
import { guessVoiceType, noteName, VOICE_TYPES } from '../lib/music'
import { DEFAULT_VOICE, useStored, useWorkRange, type Range } from '../lib/store'

export default function RangeTest() {
  const [range, setRange] = useStored<Range | null>('range', null)
  const [rangeHist, setRangeHist] = useStored<{ date: number; lo: number; hi: number }[]>('rangeHist', [])
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
      if (found.current && found.current.hi - found.current.lo >= 5) {
        setRange(found.current)
        setRangeHist([{ date: Date.now(), ...found.current }, ...rangeHist].slice(0, 24))
      }
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
      <h1>{tr('Голос и диапазон')}</h1>
      <div className="card">
        <h2>{tr('Тип голоса')}</h2>
        <p className="muted small">{tr('Упражнения строятся в удобной зоне выбранного типа голоса, а не на крайних нотах. Сейчас рабочий диапазон:')} <b>{noteName(work.lo)}–{noteName(work.hi)}</b>.</p>
        <span className="seg wide voice-seg">
          {VOICE_TYPES.map(v => <button key={v.id} aria-pressed={voice === v.id} onClick={() => setVoice(v.id)}>{v.name}</button>)}
          <button aria-pressed={voice === 'measured'} disabled={!range} onClick={() => setVoice('measured')} title={range ? '' : tr('Сначала измерь диапазон')}>{tr('По моему замеру')}</button>
        </span>
        <p className="muted small">{tr('Мужские голоса обычно бас, баритон или тенор, женские — контральто, меццо-сопрано или сопрано. Не уверен — выбирай баритон или меццо-сопрано, это самые частые.')}</p>
      </div>
      <h2 style={{ marginTop: 28 }}>{tr('Замер диапазона')}</h2>
      <p className="muted">{tr('Нажми «Начать», спокойно протяни «а-а-а» от самой низкой удобной ноты к самой высокой, без напряжения и крика. Засчитывается нота, которую ты удержал хотя бы четверть секунды. Замер нужен, чтобы узнать границы голоса. Упражнения по нему строятся, только если выбрать «По моему замеру» — тогда берутся нижние 70%, без пиковых нот.')}</p>
      <MicGate>
        <div className="tuner-top">
          <LiveNote big />
          <p className="rangeline">{shown ? <><b>{noteName(shown.lo)} – {noteName(shown.hi)}</b> · {shown.hi - shown.lo} {tr('полутонов')}</> : tr('Диапазон ещё не найден')}</p>
        </div>
        <PianoRoll follow view={view} band={() => shown} neutral windowSec={10} playhead={0.85} className="tall" />
        <div className="toolbar">
          <button className={'btn' + (measuring ? ' stop' : '')} onClick={toggle}>{measuring ? tr('Готово') : tr('Начать')}</button>
          {range && !measuring && <button className="btn ghost" onClick={() => setRange(null)}>{tr('Сбросить')}</button>}
        </div>
      </MicGate>
      {type && range && (
        <div className="card">
          <h2>{tr('Похоже на:')} {type.name}</h2>
          <p className="muted">{tr('Это ориентир, а не диагноз: тип голоса определяет тембр и удобная зона (тесситура), а не только крайние ноты.')}</p>
          <div className="vtypes">
            {VOICE_TYPES.map(v => {
              const left = ((v.lo - 36) / 50) * 100, width = ((v.hi - v.lo) / 50) * 100
              return (
                <div key={v.id} className={'vt' + (v.id === type.id ? ' on' : '')}>
                  <span>{v.name}</span>
                  <div className="bar"><i style={{ left: left + '%', width: width + '%' }} />
                    <b style={{ left: ((range.lo - 36) / 50) * 100 + '%', width: ((range.hi - range.lo) / 50) * 100 + '%' }} /></div>
                </div>
              )
            })}
          </div>
          <p className="small muted">{tr('Серым — типичный диапазон, цветом — твой.')} <Link to="/library">{tr('К распевкам →')}</Link></p>
        </div>
      )}
    </div>
  )
}

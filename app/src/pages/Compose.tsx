import { tr } from '../lib/i18n'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Dices, Download, Pause, Play, Plus, Trash2, X } from 'lucide-react'
import CircleSvg from '../components/CircleSvg'
import MelodyEditor, { type MelNote } from '../components/MelodyEditor'
import MelodyAnalysis from '../components/MelodyAnalysis'
import CheckList from '../components/CheckList'
import PianoRoll from '../components/PianoRoll'
import { MicGate, LiveNote, useEngine } from '../components/Mic'
import { engine } from '../lib/audio'
import { isBlack, noteName, plural, transcribe } from '../lib/music'
import type { Target } from '../lib/run'
import { useStored, useWorkRange } from '../lib/store'
import { borrowed, chordLabel, CHORDS, CIRCLE, diatonic, diceProgression, GROOVES, NEXT, noteRole, SCALES, syllabify, TEMPLATES, type KeyChord } from '../lib/theory'
import { downloadBytes, toMidi, type MidiNote } from '../lib/midi'

type Sketch = { id: number; name: string; sel: number; minor: boolean; prog: KeyChord[]; melody: MelNote[]; bpm: number }

const ROLE_COLOR = { chord: '--good', scale: '--near', out: '--bad' } as const

/**
 * Контраст куплета и припева. В корпусах поп-песен припев обычно выше и «плотнее» куплета,
 * часто начинается с тоники и короче по ритму слов (Summach 2011; de Clercq 2017 — анализ форм).
 */
function ContrastCheck({ parts }: { parts: { name: string; prog: KeyChord[]; melody: MelNote[] }[] }) {
  const [v, c] = parts
  if (!v?.melody.length || !c?.melody.length) return <p className="muted small">{tr('Напиши мелодии куплета и припева — появится проверка контраста.')}</p>
  const mean = (m: MelNote[]) => m.reduce((a, n) => a + n.m, 0) / m.length
  const dens = (p: { prog: KeyChord[]; melody: MelNote[] }) => p.melody.length / Math.max(1, p.prog.length)
  const up = mean(c.melody) - mean(v.melody)
  const checks = [
    { ok: up >= 2, text: up >= 2 ? tr('Припев выше куплета на {0} {1} — это добавляет подъёма.', Math.round(up), plural(Math.round(up), [tr('полутон'), tr('полутона'), tr('полутонов')])) : tr('Припев не выше куплета. Обычно припев поднимают на 2–5 полутонов: попробуй.') },
    { ok: c.prog[0]?.root === 0, text: c.prog[0]?.root === 0 ? tr('Припев начинается с тоники — звучит как «приход домой».') : tr('Припев начинается не с тоники. Так тоже бывает, но тоника в начале припева — самый частый ход.') },
    { ok: Math.abs(dens(c) - dens(v)) >= 1, text: Math.abs(dens(c) - dens(v)) >= 1 ? tr('Ритм частей различается — контраст слышен.') : tr('Ритм куплета и припева похож. Контраст помогает: сделай одну часть плотнее, другую — длиннее нотами.') },
  ]
  return <CheckList items={checks} />
}

export default function Compose() {
  useEngine(10)
  const work = useWorkRange()
  const [sel, setSel] = useStored('cmp.sel', 0)
  const [minor, setMinor] = useStored('cmp.minor', false)
  const [prog, setProg] = useStored<KeyChord[]>('cmp.prog', [])
  const [melody, setMelody] = useStored<MelNote[]>('cmp.melody', [])
  const [bpm, setBpm] = useStored('cmp.bpm', 84)
  const [sketches, setSketches] = useStored<Sketch[]>('cmp.sketches', [])
  const [playing, setPlaying] = useState(false)
  const [rec, setRec] = useState(false)
  // части песни: у каждой своя гармония и мелодия; активная часть редактируется через prog/melody
  const [parts, setParts] = useStored<{ name: string; prog: KeyChord[]; melody: MelNote[]; lyrics?: string }[]>('cmp.parts', [{ name: tr('Куплет'), prog: [], melody: [] }, { name: tr('Припев'), prog: [], melody: [] }])
  const [part, setPart] = useStored('cmp.part', 0)
  const switchPart = (i: number) => {
    if (i === part) return
    stop()
    const saved = parts.map((p, j) => (j === part ? { ...p, prog, melody, lyrics } : p))
    setParts(saved); setPart(i); setProg(saved[i].prog); setMelody(saved[i].melody); setLyrics(saved[i].lyrics ?? '')
  }
  const [lyrics, setLyrics] = useStored('cmp.lyrics', '')
  const [groove, setGroove] = useStored('cmp.groove', 'none')
  const allParts = parts.map((p, j) => (j === part ? { ...p, prog, melody, lyrics } : p))
  // слоги текста по порядку нот
  const syls = syllabify(lyrics)
  const order = melody.map((n, i) => ({ n, i })).sort((a, b) => a.n.beat - b.n.beat).map(x => x.i)
  const sylOf: (string | undefined)[] = []
  order.forEach((idx, k) => { const sy = syls[k]; sylOf[idx] = sy ? (sy.stress ? sy.s.toUpperCase() : sy.s) : undefined })
  // просодия: ударный слог должен приходиться на сильную долю (Pattison, «Writing Better Lyrics»)
  const weakStress = order.filter((idx, k) => syls[k]?.stress && melody[idx].beat % 1 !== 0).length
  const strongStress = order.filter((idx, k) => syls[k]?.stress && melody[idx].beat % 1 === 0).length

  const keyPc = minor ? (CIRCLE[sel].pc + 9) % 12 : CIRCLE[sel].pc
  // бемольные тональности (Фа, Си♭…) и ♭-аккорды пишем через бемоли
  const flatKey = CIRCLE[sel].sig < 0
  const lbl = (c: KeyChord) => chordLabel(keyPc + c.root, c.q, flatKey || c.roman.startsWith('♭'))
  const steps: readonly number[] = minor ? SCALES.minor.steps : SCALES.major.steps
  const dia = useMemo(() => diatonic(steps), [steps])
  const borrow = useMemo(() => borrowed(minor), [minor])
  const beat = 60 / bpm
  // без гармонии мелодию пишем на 4 такта
  const bars = prog.length || 4
  const tonic = 12 * Math.floor((work.lo + work.hi) / 24) + keyPc // тоника в середине голоса
  const base = tonic - 12

  // ---- транспорт: цикл по тактам, планируем на такт вперёд ----
  const t0 = useRef(0), scheduled = useRef(-1), timer = useRef(0)
  const live = useRef({ prog, melody, beat, base, tonic, groove: 'none' })
  live.current = { prog, melody, beat, base, tonic, groove }
  const barAt = (t: number) => Math.floor((t - t0.current) / (4 * live.current.beat))
  const chordAt = (t: number): KeyChord | null => {
    const p = live.current.prog
    if (!playing || !p.length || t < t0.current) return null
    return p[((barAt(t) % p.length) + p.length) % p.length]
  }

  const scheduleBar = (n: number) => {
    const { prog, melody, beat, base } = live.current
    const L = prog.length || 4, T = t0.current + n * 4 * beat
    if (prog.length) {
      const ch = prog[n % L]
      CHORDS[ch.q].iv.forEach(x => engine.play(base + ch.root + x, T, 4 * beat * 0.95, 34))
      engine.play(base - 12 + ch.root, T, 4 * beat * 0.95, 48)
    } else if (n % L === 0 && live.current.groove === 'none') engine.click(true, T) // без гармонии — щелчок в начале круга
    const gr = GROOVES[live.current.groove]
    for (let e = 0; e < 8; e++) {
      const te = T + e * beat / 2
      if (gr.k.includes(e)) engine.drum('kick', te)
      if (gr.s.includes(e)) engine.drum('snare', te)
      if (gr.h.includes(e)) engine.drum('hat', te, e % 2 ? 0.6 : 1)
    }
    for (const nt of melody) {
      if (Math.floor(nt.beat / 4) === n % L) engine.play(nt.m, T + (nt.beat % 4) * beat, nt.d * beat * 0.95, 72)
    }
  }
  const play = () => {
    if (!prog.length && !melody.length) return
    const ctx = engine.ensureCtx()
    t0.current = ctx.currentTime + 0.2
    scheduled.current = -1
    setPlaying(true)
    clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      const next = barAt(engine.now() + 0.25)
      while (scheduled.current < next) scheduleBar(++scheduled.current)
    }, 50)
  }
  const stop = () => { clearInterval(timer.current); engine.stopAll(); setPlaying(false); setRec(false) }
  useEffect(() => () => clearInterval(timer.current), [])

  const now = engine.now()
  const curChord = chordAt(now)
  const curIdx = playing && prog.length ? ((barAt(now) % prog.length) + prog.length) % prog.length : -1

  // ---- клавиатура: две октавы вокруг голоса ----
  const kLo = 12 * Math.floor(work.lo / 12) + (work.lo % 12 > 6 ? 12 : 0)
  const keys = Array.from({ length: 25 }, (_, i) => kLo + i)
  // запись с клавиш: начало — по нажатию, длительность — по отпусканию, сетка восьмых
  const held = useRef<{ m: number; beat: number; t: number } | null>(null)
  const loopPos = () => (((engine.now() - t0.current) / beat) % (bars * 4) + bars * 4) % (bars * 4)
  const pressKey = (m: number) => {
    engine.play(m, engine.ensureCtx().currentTime, 0.6, 75)
    if (rec && playing) held.current = { m, beat: Math.round(loopPos() * 2) / 2 % (bars * 4), t: engine.now() }
  }
  const releaseKey = () => {
    const h = held.current
    if (!h) return
    held.current = null
    const d = Math.max(0.5, Math.round(((engine.now() - h.t) / beat) * 2) / 2)
    setMelody([...melody.filter(n => n.beat !== h.beat), { m: h.m, beat: h.beat, d: Math.min(d, bars * 4 - h.beat) }].sort((a, x) => a.beat - x.beat))
  }

  // «напой → ноты»: под гармонию — со следующего круга; без неё — после такта отсчёта метронома
  const [hum, setHum] = useState<{ start: number; end: number } | null>(null)
  const startHum = () => {
    const loop = 4 * beat * bars
    if (playing) {
      const k = Math.ceil((engine.now() - t0.current) / loop), start = t0.current + k * loop
      setHum({ start, end: start + loop }); return
    }
    const now = engine.ensureCtx().currentTime + 0.2, start = now + 4 * beat
    for (let i = 0; i < 4 + bars * 4; i++) engine.click(i % 4 === 0, now + i * beat)
    setHum({ start, end: start + loop })
  }
  useEffect(() => {
    if (!hum) return
    const id = window.setInterval(() => {
      if (engine.now() < hum.end + 0.2) return
      clearInterval(id)
      const frames = engine.history.filter(s => s.t >= hum.start - 0.1 && s.t < hum.end)
      const notes = transcribe(frames, hum.start, beat, bars * 4, snapScale ? { keyPc, steps } : undefined)
      if (notes.length) setMelody(notes)
      setHum(null)
    }, 100)
    return () => clearInterval(id)
  }, [hum]) // eslint-disable-line react-hooks/exhaustive-deps
  const [snapScale, setSnapScale] = useStored('cmp.snap', true)

  // ---- доска: аккорды и мелодия ближайших циклов ----
  const targets = (): Target[] => {
    if (!playing) return []
    const loop = 4 * beat * bars, k = Math.floor((engine.now() - t0.current) / loop)
    const out: Target[] = []
    for (const it of [k - 1, k, k + 1]) for (const nt of melody) {
      const t = t0.current + it * loop + nt.beat * beat
      out.push({ midi: nt.m, t0: t, t1: t + nt.d * beat * 0.95, sing: true, rep: 0 })
    }
    return out
  }
  const colorFor = (m: number, t: number) => ROLE_COLOR[noteRole(m, keyPc, steps, chordAt(t))]
  const overlay = () => (curChord ? lbl(curChord) : '')
  // доска по мелодии и голосу: от нижней −3 до верхней +3, не меньше 10 рядов
  const view = () => {
    const ms = melody.map(n => n.m)
    if (engine.current != null) ms.push(engine.current)
    if (!ms.length) return { lo: work.lo, hi: work.hi }
    let lo = Math.floor(Math.min(...ms)) - 3, hi = Math.ceil(Math.max(...ms)) + 3
    const pad = Math.max(0, 10 - (hi - lo)); lo -= Math.floor(pad / 2); hi += Math.ceil(pad / 2)
    return { lo, hi }
  }

  const last = prog.at(-1)
  const lastDeg = last ? dia.findIndex(d => d.root === last.root && d.q === last.q) : -1
  const suggest = lastDeg >= 0 ? NEXT[lastDeg] : [0]

  const add = (c: KeyChord) => { if (prog.length < 8) setProg([...prog, c]); engine.ensureCtx(); playKeyChord(c) }
  const playKeyChord = (c: KeyChord) => {
    const t = engine.ensureCtx().currentTime + 0.02
    CHORDS[c.q].iv.forEach(x => engine.play(base + c.root + x, t, 1.2, 55))
  }
  const pick = (i: number, m: boolean) => { stop(); setSel(i); setMinor(m); setProg([]); setMelody([]) }
  const save = () => {
    const name = `${minor ? CIRCLE[sel].minor + tr(' минор') : CIRCLE[sel].major + tr(' мажор')} · ${prog.map(c => c.roman).join('–')}`
    setSketches([{ id: Date.now(), name, sel, minor, prog, melody, bpm }, ...sketches].slice(0, 30))
  }
  // экспорт всех частей подряд в MIDI: мелодия, аккорды, бас, барабаны
  const exportMidi = () => {
    const mel: MidiNote[] = [], ch: MidiNote[] = [], bass: MidiNote[] = [], dr: MidiNote[] = []
    let off = 0
    for (const p of allParts) {
      const nb = p.prog.length || (p.melody.length ? 4 : 0)
      p.melody.forEach(n => mel.push({ m: n.m, beat: off + n.beat, d: n.d, vel: 100 }))
      p.prog.forEach((c, i) => {
        CHORDS[c.q].iv.forEach(x => ch.push({ m: base + c.root + x, beat: off + i * 4, d: 4, vel: 70 }))
        bass.push({ m: base - 12 + c.root, beat: off + i * 4, d: 4, vel: 85 })
      })
      const gr = GROOVES[groove]
      for (let b = 0; b < nb; b++) for (let e = 0; e < 8; e++) {
        const beatPos = off + b * 4 + e / 2
        if (gr.k.includes(e)) dr.push({ m: 36, beat: beatPos, d: 0.25, vel: 100 })
        if (gr.s.includes(e)) dr.push({ m: 38, beat: beatPos, d: 0.25, vel: 95 })
        if (gr.h.includes(e)) dr.push({ m: 42, beat: beatPos, d: 0.25, vel: e % 2 ? 60 : 85 })
      }
      off += nb * 4
    }
    const keyName = minor ? CIRCLE[sel].minor + '-minor' : CIRCLE[sel].major + '-major'
    downloadBytes(toMidi([
      { name: tr('Мелодия'), channel: 0, notes: mel, program: 52 },
      { name: tr('Аккорды'), channel: 1, notes: ch, program: 0 },
      { name: tr('Бас'), channel: 2, notes: bass, program: 33 },
      { name: tr('Барабаны'), channel: 9, notes: dr },
    ], bpm), `raspevka-${keyName}-${bpm}bpm.mid`)
  }
  const load = (s: Sketch) => { stop(); setSel(s.sel); setMinor(s.minor); setProg(s.prog); setMelody(s.melody); setBpm(s.bpm) }

  return (
    <div className="page compose">
      <h1>{tr('Сочинение')}</h1>
      <p className="muted">{tr('Выбери тональность на круге, собери гармонию и подбирай мелодию: клавиши и линия голоса показывают, какие ноты ложатся на текущий аккорд.')}</p>

      <div className="cmp-top">
        <div className="cmp-circle">
          <CircleSvg sel={sel} minor={minor} onPick={pick} />
          <p className="muted small">{tr('Снаружи мажор, внутри минор. Соседи по кругу — родственные тональности, в них проще всего модулировать.')}</p>
        </div>
        <div className="cmp-chords">
          <h2>{tr('Аккорды тональности')}</h2>
          <div className="chords-row">
            {dia.map((c, i) => (
              <button key={c.roman} className={'chordbtn' + (suggest.includes(i) ? ' hint' : '')} onClick={() => add(c)} title={tr('Добавить в гармонию')}>
                <b>{c.roman}</b><span>{lbl(c)}</span>
              </button>
            ))}
          </div>
          <p className="muted small">{tr('Подсвечены аккорды, которые естественно идут после последнего.')}</p>
          <details className="more-chords" open={innerWidth > 760}>
          <summary>{tr('Взаймы и шаблоны')}</summary>
          <h2 style={{ marginTop: 12 }}>{tr('Взаймы — для краски')}</h2>
          <div className="borrow">
            {borrow.map(c => (
              <button key={c.roman} className="chordbtn wide" onClick={() => add(c)} title={c.note}>
                <b>{c.roman} · {lbl(c)}</b><span>{c.note}</span>
              </button>
            ))}
          </div>
          <h2 style={{ marginTop: 16 }}>{tr('Шаблоны')}</h2>
          <div className="row-btns" style={{ marginTop: 8 }}>
            {TEMPLATES.map(t => (
              <button key={t.name} className="btn ghost small-btn" onClick={() => { setProg((minor ? t.minor : t.major).map(i => dia[i])); setMelody([]) }}>{t.name}</button>
            ))}
          </div>
          </details>
        </div>
      </div>

      <div className="card">
        <div className="prog-head">
          <h2>{tr('Гармония')}</h2>
          <span className="seg">{parts.map((p, i) => <button key={p.name} aria-pressed={i === part} onClick={() => switchPart(i)}>{p.name}</button>)}</span>
          <span className="muted small">{prog.length ? tr('{0} {1} по 4 доли', prog.length, plural(prog.length, [tr('такт'), tr('такта'), tr('тактов')])) : tr('Нажимай на аккорды выше')}</span>
        </div>
        <div className="prog">
          {prog.map((c, i) => (
            <div key={i} className={'prog-chip' + (i === curIdx ? ' on' : '')}>
              <b>{c.roman}</b><span>{lbl(c)}</span>
              <button aria-label={tr('Убрать')} onClick={() => setProg(prog.filter((_, j) => j !== i))}><X size={14} /></button>
            </div>
          ))}
          {prog.length < 8 && <div className="prog-chip empty"><Plus size={16} /></div>}
        </div>
        <ContrastCheck parts={allParts} />
        <div className="toolbar">
          <button className={'btn' + (playing ? ' stop' : '')} onClick={playing ? stop : play} disabled={!prog.length && !melody.length}>
            {playing ? <><Pause size={16} /> {tr('Стоп')}</> : <><Play size={16} /> {tr('Играть по кругу')}</>}
          </button>
          <label className="chk"><input type="checkbox" checked={rec} disabled={!playing} onChange={e => setRec(e.target.checked)} /> {tr('Записывать ноты с клавиш')}</label>
          <label className="tempo"><span>{tr('Барабаны')}</span>
            <select value={groove} onChange={e => setGroove(e.target.value)}>{Object.entries(GROOVES).map(([k, g]) => <option key={k} value={k}>{g.name}</option>)}</select>
          </label>
          <button className="btn ghost small-btn" title={tr('Случайная гармония из частых переходов')} onClick={() => { setProg(diceProgression(dia, borrow, 4)); engine.ensureCtx() }}><Dices size={16} /> {tr('Случайная гармония')}</button>
          <label className="tempo"><span>{tr('Темп')} {bpm}</span><input type="range" min={60} max={140} step={2} value={bpm} disabled={playing} onChange={e => setBpm(+e.target.value)} /></label>
          {prog.length > 0 && <button className="textbtn" onClick={() => { if (confirm(tr('Очистить гармонию и мелодию?'))) { stop(); setProg([]); setMelody([]) } }}><Trash2 size={14} /> {tr('Очистить')}</button>}
        </div>
      </div>

      <p className="muted small kb-caption">{tr('Клавиатура')} {noteName(kLo)}–{noteName(kLo + 24)}</p>
      <div className="keyboard" role="group" aria-label={tr('Клавиатура')}>
        {keys.map(m => {
          const role = noteRole(m, keyPc, steps, curChord ?? (prog[0] ?? null))
          const voiced = engine.current != null && Math.round(engine.current) === m
          return (
            <button key={m} className={'pk ' + (isBlack(m) ? 'black ' : 'white ') + role + (voiced ? ' voiced' : '')}
              onPointerDown={e => { e.preventDefault(); pressKey(m) }} onPointerUp={releaseKey} onPointerLeave={releaseKey} aria-label={noteName(m)}>
              {!isBlack(m) && <span>{noteName(m).replace(/\d+$/, '')}</span>}
            </button>
          )
        })}
      </div>
      <div className="legend cmp-legend">
        <span><i style={{ background: 'var(--good)' }} />{tr('опорная — звук аккорда')}</span>
        <span><i style={{ background: '#f2efe8' }} />{tr('проходящая — нота лада')}</span>
        <span><i style={{ background: 'var(--bad)' }} />{tr('чужая — вне тональности')}</span>
      </div>

      {playing && curChord && (
        <div className="cmp-sticky">
          <span>{tr('Такт')} {curIdx + 1}/{prog.length} · <b>{lbl(curChord)}</b></span>
          <button className="btn stop" onClick={stop}><Pause size={16} /> {tr('Стоп')}</button>
        </div>
      )}

      <div className="cmp-sing">
        <div className="prog-head"><h2>{tr('Напевай поверх')}</h2><LiveNote /></div>
        <MicGate />
        {engine.mic === 'on' && <><PianoRoll view={view} targets={targets} colorFor={colorFor} overlay={overlay} windowSec={Math.max(6, 4 * beat * 2)} playhead={0.4} className="tall" />
        <p className="muted small">{tr('Линия голоса окрашивается по роли ноты в текущем аккорде. Записанная мелодия видна плашками и звучит вместе с гармонией.')}</p></>}
      </div>

      <div className="card">
        <div className="prog-head">
          <h2>{tr('Набросок')}</h2>
          {melody.length > 0 && <button className="textbtn" onClick={() => setMelody([])}><Trash2 size={14} /> {tr('Стереть мелодию')}</button>}
        </div>
        <div className="row-btns" style={{ margin: '8px 0' }}>
          <button className="btn ghost small-btn" disabled={!!hum} onClick={async () => { if (engine.mic !== 'on') await engine.startMic(); if (engine.mic === 'on') startHum() }}>
            {hum ? (engine.now() < hum.start ? (playing ? tr('Со следующего круга…') : tr('Отсчёт…')) : tr('Пой! Слушаю…')) : tr('Напеть мелодию')}
          </button>
          <label className="chk small"><input type="checkbox" checked={snapScale} onChange={e => setSnapScale(e.target.checked)} /> {tr('Притягивать к ладу')}</label>
          <button className={'btn ghost small-btn' + (playing ? ' stop' : '')} disabled={!melody.length && !prog.length} onClick={playing ? stop : play}>{playing ? <><Pause size={16} /> {tr('Стоп')}</> : <><Play size={16} /> {tr('Проиграть')}</>}</button>
          <span className="muted small">{playing ? tr('Напев запишется со следующего круга.') : tr('Без гармонии: такт отсчёта, затем {0} такта пой — получатся ноты.', bars)}</span>
        </div>
        <MelodyEditor melody={melody} setMelody={setMelody} bars={bars} lo={tonic - 5} keyPc={keyPc} steps={steps} prog={prog}
          pos={playing ? loopPos() : null} onPreview={m => engine.play(m, engine.ensureCtx().currentTime, 0.4, 70)} labels={sylOf} />
        <h2 style={{ marginTop: 20 }}>{tr('Текст')}</h2>
        <textarea className="lyrics" value={lyrics} onChange={e => setLyrics(e.target.value)} rows={3}
          placeholder={tr('гори+ в ночи+ — плюс после ударной гласной')} />
        <p className="muted small">{tr('Слоги встают под ноты по порядку. Ударение — «+» после ударной гласной, такие слоги показываются ЗАГЛАВНЫМИ.')}</p>
        {lyrics.trim() && <CheckList items={[
          { ok: syls.length === melody.length, text: syls.length === melody.length ? tr('Слогов столько же, сколько нот: {0}.', melody.length) : tr('Слогов {0}, нот {1}. {2}', syls.length, melody.length, syls.length > melody.length ? tr('Добавь нот или сократи строку.') : tr('Лишние ноты — распевы на одном слоге; это нормально, если так задумано.')) },
          ...(strongStress + weakStress ? [{ ok: weakStress === 0, text: weakStress === 0 ? tr('Все ударные слоги на долях — текст ложится естественно.') : tr('{0} {1} между долями. Ударения лучше ставить на сильные доли, иначе слово звучит «с неправильным ударением».', weakStress, plural(weakStress, [tr('ударный слог'), tr('ударных слога'), tr('ударных слогов')])), src: 'Pattison, Writing Better Lyrics' }] : []),
        ]} />}
        <h2 style={{ marginTop: 20 }}>{tr('Разбор мелодии')}</h2>
        <MelodyAnalysis melody={melody} work={work} keyPc={keyPc} steps={steps} prog={prog} onTranspose={n => setMelody(melody.map(x => ({ ...x, m: x.m + n })))} />
        <div className="row-btns" style={{ marginTop: 14 }}>
          <button className="btn" onClick={save} disabled={!prog.length && !melody.length}>{tr('Сохранить набросок')}</button>
          <button className="btn ghost" onClick={exportMidi} disabled={!allParts.some(p => p.prog.length || p.melody.length)}><Download size={16} /> {tr('Скачать MIDI')}</button>
        </div>
        <p className="muted small">{tr('MIDI: все части подряд — мелодия, аккорды, бас и барабаны отдельными дорожками. Открывается в GarageBand, Logic, Ableton, FL Studio.')}</p>
        <h2 style={{ marginTop: 24 }}>{tr('Сохранённые')}</h2>
        {sketches.length ? (
          <ul className="sketches">
            {sketches.map(s => (
              <li key={s.id}>
                <button className="link" onClick={() => load(s)}>{s.name}</button>
                <span className="muted small">{s.melody.length} {plural(s.melody.length, [tr('нота'), tr('ноты'), tr('нот')])} · {s.bpm} {tr('уд/мин')}</span>
                <button aria-label={tr('Удалить')} className="icon" onClick={() => setSketches(sketches.filter(x => x.id !== s.id))}><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">{tr('Пока пусто. Собери гармонию и мелодию и сохрани — набросок можно открыть позже.')}</p>}
      </div>
    </div>
  )
}

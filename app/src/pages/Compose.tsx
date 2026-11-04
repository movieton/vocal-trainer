import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, Plus, Trash2, X } from 'lucide-react'
import CircleSvg from '../components/CircleSvg'
import MelodyEditor, { type MelNote } from '../components/MelodyEditor'
import MelodyAnalysis from '../components/MelodyAnalysis'
import PianoRoll from '../components/PianoRoll'
import { MicGate, LiveNote, useEngine } from '../components/Mic'
import { engine } from '../lib/audio'
import { isBlack, noteName, plural } from '../lib/music'
import type { Target } from '../lib/run'
import { useStored, useWorkRange } from '../lib/store'
import { borrowed, chordLabel, CHORDS, CIRCLE, diatonic, NEXT, noteRole, SCALES, TEMPLATES, type KeyChord } from '../lib/theory'

type Sketch = { id: number; name: string; sel: number; minor: boolean; prog: KeyChord[]; melody: MelNote[]; bpm: number }

const ROLE_COLOR = { chord: '--good', scale: '--near', out: '--bad' } as const

/**
 * Контраст куплета и припева. В корпусах поп-песен припев обычно выше и «плотнее» куплета,
 * часто начинается с тоники и короче по ритму слов (Summach 2011; de Clercq 2017 — анализ форм).
 */
function ContrastCheck({ parts }: { parts: { name: string; prog: KeyChord[]; melody: MelNote[] }[] }) {
  const [v, c] = parts
  if (!v?.melody.length || !c?.melody.length) return <span className="muted small">Напиши мелодии куплета и припева — появится проверка контраста.</span>
  const mean = (m: MelNote[]) => m.reduce((a, n) => a + n.m, 0) / m.length
  const dens = (p: { prog: KeyChord[]; melody: MelNote[] }) => p.melody.length / Math.max(1, p.prog.length)
  const up = mean(c.melody) - mean(v.melody)
  const checks = [
    { ok: up >= 2, text: up >= 2 ? `Припев выше куплета на ${Math.round(up)} ${plural(Math.round(up), ['полутон', 'полутона', 'полутонов'])} — это добавляет подъёма.` : 'Припев не выше куплета. Обычно припев поднимают на 2–5 полутонов: попробуй.' },
    { ok: c.prog[0]?.root === 0, text: c.prog[0]?.root === 0 ? 'Припев начинается с тоники — звучит как «приход домой».' : 'Припев начинается не с тоники. Так тоже бывает, но тоника в начале припева — самый частый ход.' },
    { ok: Math.abs(dens(c) - dens(v)) >= 1, text: Math.abs(dens(c) - dens(v)) >= 1 ? 'Ритм частей различается — контраст слышен.' : 'Ритм куплета и припева похож. Контраст помогает: сделай одну часть плотнее, другую — длиннее нотами.' },
  ]
  return <span className="contrast">{checks.map(x => <span key={x.text} className={x.ok ? 'ok' : 'hint'}>{x.text}</span>)}</span>
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
  const [parts, setParts] = useStored<{ name: string; prog: KeyChord[]; melody: MelNote[] }[]>('cmp.parts', [{ name: 'Куплет', prog: [], melody: [] }, { name: 'Припев', prog: [], melody: [] }])
  const [part, setPart] = useStored('cmp.part', 0)
  const switchPart = (i: number) => {
    if (i === part) return
    stop()
    const saved = parts.map((p, j) => (j === part ? { ...p, prog, melody } : p))
    setParts(saved); setPart(i); setProg(saved[i].prog); setMelody(saved[i].melody)
  }
  const allParts = parts.map((p, j) => (j === part ? { ...p, prog, melody } : p))

  const keyPc = minor ? (CIRCLE[sel].pc + 9) % 12 : CIRCLE[sel].pc
  // бемольные тональности (Фа, Си♭…) и ♭-аккорды пишем через бемоли
  const flatKey = CIRCLE[sel].sig < 0
  const lbl = (c: KeyChord) => chordLabel(keyPc + c.root, c.q, flatKey || c.roman.startsWith('♭'))
  const steps: readonly number[] = minor ? SCALES.minor.steps : SCALES.major.steps
  const dia = useMemo(() => diatonic(steps), [steps])
  const borrow = useMemo(() => borrowed(minor), [minor])
  const beat = 60 / bpm
  const bars = Math.max(1, prog.length)
  const tonic = 12 * Math.floor((work.lo + work.hi) / 24) + keyPc // тоника в середине голоса
  const base = tonic - 12

  // ---- транспорт: цикл по тактам, планируем на такт вперёд ----
  const t0 = useRef(0), scheduled = useRef(-1), timer = useRef(0)
  const live = useRef({ prog, melody, beat, base, tonic })
  live.current = { prog, melody, beat, base, tonic }
  const barAt = (t: number) => Math.floor((t - t0.current) / (4 * live.current.beat))
  const chordAt = (t: number): KeyChord | null => {
    const p = live.current.prog
    if (!playing || !p.length || t < t0.current) return null
    return p[((barAt(t) % p.length) + p.length) % p.length]
  }

  const scheduleBar = (n: number) => {
    const { prog, melody, beat, base } = live.current
    if (!prog.length) return
    const L = prog.length, ch = prog[n % L], T = t0.current + n * 4 * beat
    CHORDS[ch.q].iv.forEach(x => engine.play(base + ch.root + x, T, 4 * beat * 0.95, 34))
    engine.play(base - 12 + ch.root, T, 4 * beat * 0.95, 48)
    for (const nt of melody) {
      if (Math.floor(nt.beat / 4) === n % L) engine.play(nt.m, T + (nt.beat % 4) * beat, nt.d * beat * 0.95, 72)
    }
  }
  const play = () => {
    if (!prog.length) return
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
  useEffect(() => { if (playing && !prog.length) stop() }, [prog.length]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // «напой → ноты»: один круг гармонии слушаем голос и режем его на ноты по сетке восьмых
  const [hum, setHum] = useState<{ start: number; end: number } | null>(null)
  const startHum = () => {
    const loop = 4 * beat * bars, k = Math.ceil((engine.now() - t0.current) / loop)
    const start = t0.current + k * loop
    setHum({ start, end: start + loop })
  }
  useEffect(() => {
    if (!hum) return
    const id = window.setInterval(() => {
      if (engine.now() < hum.end + 0.2) return
      clearInterval(id)
      const frames = engine.history.filter(s => s.t >= hum.start && s.t < hum.end)
      const notes: MelNote[] = []
      let cur: { m: number; t0: number; t1: number } | null = null
      const flush = () => {
        if (cur && cur.t1 - cur.t0 >= 0.15) {
          const b = Math.round(((cur.t0 - hum.start) / beat) * 2) / 2
          const d = Math.max(0.5, Math.round(((cur.t1 - cur.t0) / beat) * 2) / 2)
          if (b < bars * 4 && !notes.some(n => n.beat === b)) notes.push({ m: cur.m, beat: b, d: Math.min(d, bars * 4 - b) })
        }
        cur = null
      }
      for (const f of frames) {
        const m = f.midi == null ? null : Math.round(f.midi)
        if (m == null) { flush(); continue }
        if (cur && cur.m === m) cur.t1 = f.t
        else { flush(); cur = { m, t0: f.t, t1: f.t } }
      }
      flush()
      if (notes.length) setMelody(notes)
      setHum(null)
    }, 100)
    return () => clearInterval(id)
  }, [hum]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- доска: аккорды и мелодия ближайших циклов ----
  const targets = (): Target[] => {
    if (!playing || !prog.length) return []
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
    const name = `${minor ? CIRCLE[sel].minor + ' минор' : CIRCLE[sel].major + ' мажор'} · ${prog.map(c => c.roman).join('–')}`
    setSketches([{ id: Date.now(), name, sel, minor, prog, melody, bpm }, ...sketches].slice(0, 30))
  }
  const load = (s: Sketch) => { stop(); setSel(s.sel); setMinor(s.minor); setProg(s.prog); setMelody(s.melody); setBpm(s.bpm) }

  return (
    <div className="page compose">
      <h1>Сочинение</h1>
      <p className="muted">Выбери тональность на круге, собери гармонию и подбирай мелодию: клавиши и линия голоса показывают, какие ноты ложатся на текущий аккорд.</p>

      <div className="cmp-top">
        <div className="cmp-circle">
          <CircleSvg sel={sel} minor={minor} onPick={pick} />
          <p className="muted small">Снаружи мажор, внутри минор. Соседи по кругу — родственные тональности, в них проще всего модулировать.</p>
        </div>
        <div className="cmp-chords">
          <h2>Аккорды тональности</h2>
          <div className="chords-row">
            {dia.map((c, i) => (
              <button key={c.roman} className={'chordbtn' + (suggest.includes(i) ? ' hint' : '')} onClick={() => add(c)} title="Добавить в гармонию">
                <b>{c.roman}</b><span>{lbl(c)}</span>
              </button>
            ))}
          </div>
          <p className="muted small">Подсвечены аккорды, которые естественно идут после последнего.</p>
          <details className="more-chords" open={innerWidth > 760}>
          <summary>Взаймы и шаблоны</summary>
          <h2 style={{ marginTop: 12 }}>Взаймы — для краски</h2>
          <div className="borrow">
            {borrow.map(c => (
              <button key={c.roman} className="chordbtn wide" onClick={() => add(c)} title={c.note}>
                <b>{c.roman} · {lbl(c)}</b><span>{c.note}</span>
              </button>
            ))}
          </div>
          <h2 style={{ marginTop: 16 }}>Шаблоны</h2>
          <div className="row-btns" style={{ marginTop: 8 }}>
            {TEMPLATES.map(t => (
              <button key={t.name} className="btn ghost small-btn" onClick={() => { setProg((minor ? t.minor : t.major).map(i => dia[i])); setMelody([]) }}>{t.name}</button>
            ))}
          </div>
          </details>
        </div>
      </div>

      <div className="parts">
        <span className="seg">{parts.map((p, i) => <button key={p.name} aria-pressed={i === part} onClick={() => switchPart(i)}>{p.name}</button>)}</span>
        <ContrastCheck parts={allParts} />
      </div>

      <div className="card">
        <div className="prog-head">
          <h2>Гармония · {parts[part]?.name.toLowerCase()}</h2>
          <span className="muted small">{prog.length ? `${prog.length} ${plural(prog.length, ['такт', 'такта', 'тактов'])} по 4 доли` : 'Нажимай на аккорды выше'}</span>
        </div>
        <div className="prog">
          {prog.map((c, i) => (
            <div key={i} className={'prog-chip' + (i === curIdx ? ' on' : '')}>
              <b>{c.roman}</b><span>{lbl(c)}</span>
              <button aria-label="Убрать" onClick={() => setProg(prog.filter((_, j) => j !== i))}><X size={14} /></button>
            </div>
          ))}
          {prog.length < 8 && <div className="prog-chip empty"><Plus size={16} /></div>}
        </div>
        <div className="toolbar">
          <button className={'btn' + (playing ? ' stop' : '')} onClick={playing ? stop : play} disabled={!prog.length}>
            {playing ? <><Pause size={16} /> Стоп</> : <><Play size={16} /> Играть по кругу</>}
          </button>
          <label className="chk"><input type="checkbox" checked={rec} disabled={!playing} onChange={e => setRec(e.target.checked)} /> Записывать ноты с клавиш</label>
          <label className="tempo"><span>Темп {bpm}</span><input type="range" min={60} max={140} step={2} value={bpm} disabled={playing} onChange={e => setBpm(+e.target.value)} /></label>
          {prog.length > 0 && <button className="textbtn" onClick={() => { if (confirm('Очистить гармонию и мелодию?')) { stop(); setProg([]); setMelody([]) } }}><Trash2 size={14} /> Очистить</button>}
        </div>
      </div>

      <p className="muted small kb-caption">Клавиатура {noteName(kLo)}–{noteName(kLo + 24)}</p>
      <div className="keyboard" role="group" aria-label="Клавиатура">
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
        <span><i style={{ background: 'var(--good)' }} />опорная — звук аккорда</span>
        <span><i style={{ background: '#f2efe8' }} />проходящая — нота лада</span>
        <span><i style={{ background: '#cfcac0' }} />чужая — вне тональности</span>
      </div>

      {playing && curChord && (
        <div className="cmp-sticky">
          <span>Такт {curIdx + 1}/{prog.length} · <b>{lbl(curChord)}</b></span>
          <button className="btn stop" onClick={stop}><Pause size={16} /> Стоп</button>
        </div>
      )}

      <div className="cmp-sing">
        <div className="prog-head"><h2>Напевай поверх</h2><LiveNote /></div>
        <MicGate />
        {engine.mic === 'on' && <><PianoRoll view={view} targets={targets} colorFor={colorFor} overlay={overlay} windowSec={Math.max(6, 4 * beat * 2)} playhead={0.4} className="tall" />
        <p className="muted small">Линия голоса окрашивается по роли ноты в текущем аккорде. Записанная мелодия видна плашками и звучит вместе с гармонией.</p></>}
      </div>

      <div className="card">
        <div className="prog-head">
          <h2>Набросок</h2>
          {melody.length > 0 && <button className="textbtn" onClick={() => setMelody([])}><Trash2 size={14} /> Стереть мелодию</button>}
        </div>
        <div className="row-btns" style={{ margin: '8px 0' }}>
          <button className="btn ghost small-btn" disabled={!playing || !!hum} onClick={async () => { if (engine.mic !== 'on') await engine.startMic(); if (engine.mic === 'on') startHum() }}>
            {hum ? (engine.now() < hum.start ? 'Со следующего круга…' : 'Пой! Слушаю круг…') : 'Напеть мелодию'}
          </button>
          <span className="muted small">{!playing ? 'Включи «Играть по кругу», затем «Напеть»: один круг пой — получатся ноты.' : ''}</span>
        </div>
        <MelodyEditor melody={melody} setMelody={setMelody} bars={bars} lo={tonic - 5} keyPc={keyPc} steps={steps} prog={prog}
          pos={playing ? loopPos() : null} onPreview={m => engine.play(m, engine.ensureCtx().currentTime, 0.4, 70)} />
        <h2 style={{ marginTop: 20 }}>Разбор мелодии</h2>
        <MelodyAnalysis melody={melody} work={work} keyPc={keyPc} steps={steps} prog={prog} onTranspose={n => setMelody(melody.map(x => ({ ...x, m: x.m + n })))} />
        <button className="btn" onClick={save} disabled={!prog.length} style={{ marginTop: 14 }}>Сохранить набросок</button>
        <h2 style={{ marginTop: 24 }}>Сохранённые</h2>
        {sketches.length ? (
          <ul className="sketches">
            {sketches.map(s => (
              <li key={s.id}>
                <button className="link" onClick={() => load(s)}>{s.name}</button>
                <span className="muted small">{s.melody.length} {plural(s.melody.length, ['нота', 'ноты', 'нот'])} · {s.bpm} уд/мин</span>
                <button aria-label="Удалить" className="icon" onClick={() => setSketches(sketches.filter(x => x.id !== s.id))}><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">Пока пусто. Собери гармонию и мелодию и сохрани — набросок можно открыть позже.</p>}
      </div>
    </div>
  )
}

import { tr } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Mic } from 'lucide-react'
import DrillPage from '../components/DrillPage'
import { MicGate, useEngine } from '../components/Mic'
import { engine } from '../lib/audio'
import type { Phrase } from '../lib/phrase'
import { noteName, transcribe } from '../lib/music'
import { useStored, useWorkRange, type Range } from '../lib/store'
import { LEVEL_TEXT, SONGS, songSpan, type Song, type SongNote } from '../data/songs'

type Mode = 'together' | 'call' | 'solo'
const MODES: { id: Mode; title: string }[] = [
  { id: 'together', title: tr('Вместе с пианино') },
  { id: 'call', title: tr('Слушай, потом пой') },
  { id: 'solo', title: tr('Без подсказки') },
]

/** Тоника песни: своя — как спета, встроенная — центр песни в центр рабочего диапазона */
function tonicFor(s: Song, r: Range) {
  if (s.base != null) return s.base
  const sp = songSpan(s)
  return Math.round((r.lo + r.hi) / 2 - (sp.lo + sp.hi) / 2)
}

function buildPhrase(notes: SongNote[], label: string, tonic: number, beat: number, mode: Mode, meter: number): Phrase {
  const piano: Phrase['piano'] = [], out: Phrase['notes'] = []
  const lead = beat // одна доля отсчёта перед фразой
  const total = notes.reduce((a, n) => a + n.d, 0) * beat
  const sing = mode === 'call' ? lead + total + beat : lead
  // ориентир тональности: тоника в басу на сильных долях
  const bars = Math.ceil((sing + total) / (beat * meter))
  for (let b = 0; b < bars; b++) piano.push({ m: tonic - 12, t: b * beat * meter, d: beat * meter * 0.95, vel: 32 })
  let t = 0
  for (const n of notes) {
    if (n.s != null) {
      const m = tonic + n.s, d = n.d * beat * 0.92
      if (mode === 'together') piano.push({ m, t: lead + t, d, vel: 52 })
      if (mode === 'call') {
        piano.push({ m, t: lead + t, d, vel: 64 })
        out.push({ m, t: lead + t, d, sing: false })
      }
      out.push({ m, t: sing + t, d, syl: n.syl === '~' ? undefined : n.syl, sing: true })
    }
    t += n.d * beat
  }
  return { label, piano, notes: out, len: sing + total, marks: mode === 'call' ? [{ t: 0, text: tr('Слушай') }, { t: sing, text: tr('Повтори') }] : undefined }
}

export function SongList() {
  const [mine] = useStored<Song | null>('songs.mine', null)
  const [best] = useStored<Record<string, number>>('songs.best', {})
  const r = useWorkRange()
  return (
    <div className="page">
      <h1>{tr('Песни')}</h1>
      <p className="muted">{tr('Мелодия бежит по доске, ты поёшь и видишь попадание. Тональность подстраивается под твой голос, темп можно замедлить, любую фразу — повторять.')}</p>
      <div className="grid">
        {SONGS.map(s => {
          const sp = songSpan(s), t = tonicFor(s, r)
          return (
            <Link key={s.id} to={`/songs/${s.id}`} className="tile">
              <span className="tile-top"><span className="lvl">{'●'.repeat(s.level)}{'○'.repeat(3 - s.level)}</span><span className="muted small">{LEVEL_TEXT[s.level]}</span></span>
              <strong>{s.title}</strong>
              <span className="muted small">{s.sub}</span>
              <span className="syl">{noteName(t + sp.lo)}–{noteName(t + sp.hi)}{best[s.id] != null ? tr(' · лучший {0}%', best[s.id]) : ''}</span>
            </Link>
          )
        })}
        <Link to="/songs/mine" className="tile">
          <span className="tile-top"><span className="lvl"><Mic size={14} aria-hidden /></span><span className="muted small">{tr('Своя')}</span></span>
          <strong>{mine ? tr('Моя мелодия') : tr('Напеть свою')}</strong>
          <span className="muted small">{mine ? tr('{0} фраз · можно перезаписать', mine.phrases.length) : tr('Напой мелодию любой песни — она станет упражнением')}</span>
          <span className="syl">{mine ? (best.mine != null ? tr('Лучший {0}%', best.mine) : tr('Записана')) : tr('С микрофоном')}</span>
        </Link>
      </div>
    </div>
  )
}

function SongRun({ song, extra }: { song: Song; extra?: React.ReactNode }) {
  const r = useWorkRange()
  const [mode, setMode] = useStored<Mode>('songs.mode', 'together')
  const [tempo, setTempo] = useStored('songs.tempo', 1)
  const [best, setBest] = useStored<Record<string, number>>('songs.best', {})
  const tonic = tonicFor(song, r)
  const beat = 60 / (song.bpm * tempo)
  const make = () => (i: number): Phrase | null => {
    const p = song.phrases[i]
    return p ? buildPhrase(p.notes, p.label, tonic, beat, mode, song.meter) : null
  }
  const longest = Math.max(...song.phrases.map(p => p.notes.reduce((a, n) => a + n.d, 0))) * beat
  return (
    <DrillPage
      back={{ to: '/songs', label: tr('Песни') }}
      lyrics
      span={{ lo: tonic + songSpan(song).lo, hi: tonic + songSpan(song).hi }}
      id={'song-' + song.id}
      title={song.title}
      intro={song.base != null ? tr('Твоя напетая мелодия. Пой под пианино и смотри, где попадаешь.') : song.sub}
      extra={extra}
      settingsKey={`${song.id}|${mode}|${tempo}|${tonic}`}
      windowSec={innerWidth < 500 ? Math.min(5, Math.max(4, longest * 0.5)) : Math.min(14, Math.max(6, (mode === 'call' ? longest * 2 : longest) * 0.8 + 1))}
      make={make}
      onFinish={s => { const v = Math.round(s * 100); if (v > (best[song.id] ?? -1)) setBest({ ...best, [song.id]: v }) }}
      controls={running => (
        <>
          <label>{tr('Режим')}
            <select value={mode} onChange={e => setMode(e.target.value as Mode)} disabled={running}>
              {MODES.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </label>
          <label>{tr('Темп')} {Math.round(tempo * 100)}%
            <input type="range" min={0.5} max={1.2} step={0.05} value={tempo} onChange={e => setTempo(+e.target.value)} disabled={running} />
          </label>
        </>
      )}
      how={[
        tr('Первый раз выбери «Слушай, потом пой» и темп 70–80%.'),
        tr('Не выходит фраза — включи «Повторять фразу» и пой её, пока не станет ровно.'),
        tr('Слоги под нотами — это текст. Пой на них или на «а», как удобнее.'),
        tr('Высоко или низко — сдвинь высоту на полутон или октаву.'),
      ]}
    />
  )
}

export function SongPage() {
  const { id = '' } = useParams()
  if (id === 'mine') return <MySong />
  const song = SONGS.find(s => s.id === id)
  if (!song) return <div className="page"><p>{tr('Песня не найдена.')} <Link to="/songs">{tr('К списку')}</Link></p></div>
  return <SongRun song={song} />
}

const REC_BPM = 90
const REC_MAX = 30

/** Записываем напетую мелодию и превращаем в ноты */
function MySong() {
  useEngine(4)
  const [mine, setMine] = useStored<Song | null>('songs.mine', null)
  const [rec, setRec] = useState<null | number>(null)
  const [left, setLeft] = useState(REC_MAX)
  const [err, setErr] = useState('')
  const frames = useRef<{ t: number; midi: number | null }[]>([])

  useEffect(() => engine.subscribe(() => {
    if (rec == null) return
    const last = engine.history.at(-1)
    if (last && last.t >= rec && frames.current.at(-1)?.t !== last.t) frames.current.push({ t: last.t, midi: last.midi })
    const l = Math.max(0, Math.ceil(REC_MAX - (engine.now() - rec)))
    setLeft(l)
    if (l === 0) finish()
  }), [rec]) // eslint-disable-line react-hooks/exhaustive-deps

  const begin = () => { setErr(''); frames.current = []; setLeft(REC_MAX); setRec(engine.now()) }
  const finish = () => {
    if (rec == null) return
    const t0 = rec, beat = 60 / REC_BPM
    setRec(null)
    const notes = transcribe(frames.current, t0, beat, Math.ceil((engine.now() - t0) / beat) + 1)
    if (notes.length < 3) { setErr(tr('Не расслышал мелодию. Пой громче и ближе к микрофону, хотя бы 3–4 ноты.')); return }
    // делим на фразы по паузам от доли или по 8 нот
    const base = notes[0].m
    const phrases: Song['phrases'] = []
    let cur: SongNote[] = [], end = notes[0].beat
    for (const n of notes) {
      const gap = n.beat - end
      if (cur.length && (gap >= 1 || cur.length >= 8)) { phrases.push({ label: tr('Фраза {0}', phrases.length + 1), notes: cur }); cur = [] }
      else if (cur.length && gap > 0) cur.push({ s: null, d: gap })
      cur.push({ s: n.m - base, d: n.d })
      end = n.beat + n.d
    }
    if (cur.length) phrases.push({ label: tr('Фраза {0}', phrases.length + 1), notes: cur })
    setMine({ id: 'mine', title: tr('Моя мелодия'), sub: tr('Напета тобой'), level: 1, bpm: REC_BPM, meter: 4, phrases, base })
  }

  const recorder = (
    <div className="card rec-card">
      <h2>{mine ? tr('Перезаписать мелодию') : tr('Напой мелодию')}</h2>
      <p className="muted small">{tr('Пой на «на» или «да», каждую ноту отдельно, без украшений. До')} {REC_MAX} {tr('секунд. Паузы между фразами — от секунды.')}</p>
      {engine.mic === 'on' && (
        <div className="toolbar">
          <button className={'btn' + (rec != null ? ' stop' : '')} onClick={rec != null ? finish : begin}>{rec != null ? tr('Готово · {0} с', left) : mine ? tr('Записать заново') : tr('Записать')}</button>
          {mine && rec == null && <button className="btn ghost" onClick={() => setMine(null)}>{tr('Удалить')}</button>}
        </div>
      )}
      {err && <p className="err small">{err}</p>}
    </div>
  )

  if (!mine || rec != null) return (
    <div className="page">
      <div className="crumbs"><Link to="/songs">{tr('Песни')}</Link></div>
      <h1>{tr('Своя мелодия')}</h1>
      <p className="muted">{tr('Напой кусочек песни, которую хочешь выучить. Приложение разложит её на ноты, и ты сможешь петь под пианино с оценкой попадания.')}</p>
      <MicGate />
      {recorder}
    </div>
  )
  return <SongRun song={mine} extra={recorder} />
}

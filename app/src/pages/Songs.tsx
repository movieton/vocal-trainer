import { tr } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Mic, PenLine, Play, Pencil, Trash2 } from 'lucide-react'
import DrillPage from '../components/DrillPage'
import { MicGate, useEngine } from '../components/Mic'
import { engine } from '../lib/audio'
import { ensureCustomSongs, MAX_CUSTOM_SONGS, MAX_TITLE_LEN, useCustomSongs } from '../lib/customSongs'
import type { Phrase } from '../lib/phrase'
import { noteName, plural, transcribe } from '../lib/music'
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
  const { songs: custom, rename, remove, atLimit } = useCustomSongs()
  const [best] = useStored<Record<string, number>>('songs.best', {})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const r = useWorkRange()

  useEffect(() => { ensureCustomSongs() }, [])

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
      </div>

      <section className="custom-songs" aria-labelledby="custom-songs-title">
        <div className="prog-head">
          <h2 id="custom-songs-title">{tr('Мои песни')}</h2>
          <span className="muted small">{custom.length} / {MAX_CUSTOM_SONGS}</span>
        </div>

        {atLimit && (
          <p className="note-box small" role="status">{tr('Достигнут лимит: 25 своих песен. Удали лишнюю песню, чтобы добавить новую.')}</p>
        )}

        {custom.length === 0 ? (
          <div className="card empty-custom">
            <p className="muted">{tr('Здесь появятся ваши мелодии из Сочинения и записи голоса')}</p>
            <div className="row-btns">
              <Link to="/songs/mine" className="btn"><Mic size={16} /> {tr('Записать с микрофона')}</Link>
              <Link to="/compose" className="btn ghost"><PenLine size={16} /> {tr('Открыть Сочинение')}</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="row-btns custom-songs-actions">
              <Link to="/songs/mine" className="btn ghost small-btn"><Mic size={16} /> {tr('Записать с микрофона')}</Link>
              <Link to="/compose" className="btn ghost small-btn"><PenLine size={16} /> {tr('Открыть Сочинение')}</Link>
            </div>
            <div className="custom-songs-list">
              {custom.map(s => {
                const isEditing = editingId === s.id
                const isConfirming = confirmId === s.id
                return (
                  <article key={s.id} className="card custom-song-card">
                    <div className="custom-song-head">
                      <strong className="custom-song-title">{s.title}</strong>
                      <span className="muted small">
                        {s.bpm} {tr('уд/мин')} · {s.phrases.length} {plural(s.phrases.length, [tr('фраза'), tr('фразы'), tr('фраз')])}
                        {best[s.id] != null ? tr(' · лучший {0}%', best[s.id]) : ''}
                      </span>
                      {s.sub && <span className="muted small">{s.sub}</span>}
                    </div>

                    {isEditing ? (
                      <form className="custom-song-rename" onSubmit={e => { e.preventDefault(); if (draftTitle.trim()) { rename(s.id, draftTitle); setEditingId(null) } }}>
                        <input
                          type="text"
                          value={draftTitle}
                          maxLength={MAX_TITLE_LEN}
                          aria-label={tr('Название песни')}
                          autoFocus
                          onChange={e => setDraftTitle(e.target.value)}
                        />
                        <div className="custom-song-btns">
                          <button type="submit" className="btn" disabled={!draftTitle.trim()}>{tr('Сохранить')}</button>
                          <button type="button" className="btn ghost" onClick={() => setEditingId(null)}>{tr('Отмена')}</button>
                        </div>
                      </form>
                    ) : isConfirming ? (
                      <div className="confirm-row" role="alertdialog" aria-label={tr('Подтверждение удаления')}>
                        <span className="small">{tr('Удалить «{0}»?', s.title)}</span>
                        <div className="confirm-btns">
                          <button type="button" className="danger-btn solid" onClick={() => { remove(s.id); setConfirmId(null) }}>{tr('Удалить')}</button>
                          <button type="button" className="btn ghost" onClick={() => setConfirmId(null)}>{tr('Отмена')}</button>
                        </div>
                      </div>
                    ) : (
                      <div className="custom-song-btns">
                        <Link to={`/songs/custom/${s.id}`} className="btn"><Play size={16} fill="currentColor" /> {tr('Петь')}</Link>
                        <button type="button" className="btn ghost" onClick={() => { setConfirmId(null); setEditingId(s.id); setDraftTitle(s.title) }}>
                          <Pencil size={15} /> {tr('Переименовать')}
                        </button>
                        <button type="button" className="danger-btn" onClick={() => { setEditingId(null); setConfirmId(s.id) }}>
                          <Trash2 size={15} /> {tr('Удалить')}
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </>
        )}
      </section>
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

function SongView({ custom }: { custom?: boolean }) {
  const { id = '' } = useParams()
  const { songs: customSongs } = useCustomSongs()
  useEffect(() => { ensureCustomSongs() }, [])
  if (!custom && id === 'mine') return <MySong />
  const song = custom ? customSongs.find(s => s.id === id) : SONGS.find(s => s.id === id)
  if (!song) return <div className="page"><p>{tr('Песня не найдена.')} <Link to="/songs">{tr('К списку')}</Link></p></div>
  return <SongRun song={song} />
}

export function SongPage() {
  return <SongView />
}

export function CustomSongPage() {
  return <SongView custom />
}

const REC_BPM = 90
const REC_MAX = 30

/** Записываем напетую мелодию и сохраняем новой песней в `songs.custom` */
function MySong() {
  useEngine(4)
  const go = useNavigate()
  const { songs: custom, add, atLimit } = useCustomSongs()
  const [rec, setRec] = useState<null | number>(null)
  const [left, setLeft] = useState(REC_MAX)
  const [err, setErr] = useState('')
  const frames = useRef<{ t: number; midi: number | null }[]>([])

  useEffect(() => { ensureCustomSongs() }, [])

  useEffect(() => engine.subscribe(() => {
    if (rec == null) return
    const last = engine.history.at(-1)
    if (last && last.t >= rec && frames.current.at(-1)?.t !== last.t) frames.current.push({ t: last.t, midi: last.midi })
    const l = Math.max(0, Math.ceil(REC_MAX - (engine.now() - rec)))
    setLeft(l)
    if (l === 0) finish()
  }), [rec]) // eslint-disable-line react-hooks/exhaustive-deps

  const begin = () => {
    if (atLimit) {
      setErr(tr('Достигнут лимит: 25 своих песен. Удали лишнюю в разделе «Песни», чтобы записать новую.'))
      return
    }
    setErr('')
    frames.current = []
    setLeft(REC_MAX)
    setRec(engine.now())
  }
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
    const title = custom.length ? tr('Моя мелодия {0}', custom.length + 1) : tr('Моя мелодия')
    const song: Song = {
      id: `rec-${Date.now().toString(36)}`,
      title,
      sub: tr('Записана с микрофона'),
      level: 1,
      bpm: REC_BPM,
      meter: 4,
      phrases,
      base,
    }
    const res = add(song)
    if (!res.ok) {
      setErr(res.reason === 'limit'
        ? tr('Достигнут лимит: 25 своих песен. Удали лишнюю в разделе «Песни», чтобы записать новую.')
        : tr('Не удалось сохранить запись. Попробуй ещё раз.'))
      return
    }
    go(`/songs/custom/${res.song.id}`)
  }

  const recorder = (
    <div className="card rec-card">
      <h2>{tr('Напой мелодию')}</h2>
      <p className="muted small">{tr('Пой на «на» или «да», каждую ноту отдельно, без украшений. До')} {REC_MAX} {tr('секунд. Паузы между фразами — от секунды.')}</p>
      {atLimit && (
        <p className="note-box small" role="status">{tr('Достигнут лимит: 25 своих песен. Удали лишнюю в разделе «Песни», чтобы записать новую.')}</p>
      )}
      {engine.mic === 'on' && (
        <div className="toolbar">
          <button className={'btn' + (rec != null ? ' stop' : '')} onClick={rec != null ? finish : begin} disabled={rec == null && atLimit}>
            {rec != null ? tr('Готово · {0} с', left) : tr('Записать')}
          </button>
        </div>
      )}
      {err && <p className="err small" role="alert">{err}</p>}
    </div>
  )

  return (
    <div className="page">
      <div className="crumbs"><Link to="/songs">{tr('Песни')}</Link></div>
      <h1>{tr('Своя мелодия')}</h1>
      <p className="muted">{tr('Напой кусочек песни, которую хочешь выучить. Приложение разложит её на ноты, и ты сможешь петь под пианино с оценкой попадания.')}</p>
      <MicGate />
      {recorder}
    </div>
  )
}

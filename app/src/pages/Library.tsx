import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { EXERCISES, type Section } from '../data/exercises'
import { BREATH } from '../data/breath'
import { LIBRARY, TOPICS, topicOf, type TopicId } from '../data/library'
import { ARTICLES } from './Theory'
import { Evidence, EVIDENCE } from './Breath'
import { plural } from '../lib/music'

/** Запись каталога: распевка на доске, дыхательный таймер или карточка из исследований */
type Entry = { key: string; title: string; goal: string; to: string; topic: TopicId; level: number; evidence?: 'И' | 'Ш' | 'П' | 'Т'; tag?: string }

const SECTION_TOPIC: Record<Section, TopicId> = { warmup: 'warmup', calm: 'sound', mix: 'registers', belt: 'registers', modes: 'registers', agility: 'agility' }

export const ENTRIES: Entry[] = [
  ...EXERCISES.map(e => ({ key: 'ex:' + e.id, title: e.title, goal: e.goal, to: `/ex/${e.id}`, topic: SECTION_TOPIC[e.section], level: e.level, tag: 'на доске' })),
  ...BREATH.map(b => ({ key: 'br:' + b.id, title: b.title, goal: b.goal, to: `/breath/${b.id}`, topic: (b.group === 'health' ? 'health' : 'breath') as TopicId, level: b.level, evidence: b.evidence, tag: 'таймер' })),
  ...LIBRARY.map(i => ({ key: 'lib:' + i.id, title: i.title, goal: i.goal, to: `/lib/${i.id}`, topic: topicOf(i), level: i.level, evidence: i.evidence, tag: i.notes ? 'на доске' : undefined })),
]

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е')

export default function Library() {
  const [params, setParams] = useSearchParams()
  const topic = (params.get('t') ?? '') as TopicId | ''
  const [q, setQ] = useState('')
  const found = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    return ENTRIES.filter(e => (!topic || e.topic === topic) && words.every(w => norm(e.title + ' ' + e.goal).includes(w)))
  }, [q, topic])
  const setTopic = (t: string) => setParams(t ? { t } : {}, { replace: true })

  return (
    <div className="page library">
      <h1>Библиотека</h1>
      <p className="muted lead-narrow">{ENTRIES.length} упражнений: как делать, частые ошибки и источник. Метка показывает, насколько упражнение проверено. При боли или осиплости — стоп.</p>
      <label className="search">
        <Search size={18} aria-hidden />
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск: трель, челюсть, микст…" aria-label="Поиск по библиотеке" />
        {q && <button className="textbtn" onClick={() => setQ('')} aria-label="Очистить"><X size={16} /></button>}
      </label>
      <nav className="anchors topics" aria-label="Темы">
        <button aria-pressed={!topic} onClick={() => setTopic('')}>Все</button>
        {TOPICS.map(t => <button key={t.id} aria-pressed={topic === t.id} onClick={() => setTopic(t.id)}>{t.title}</button>)}
      </nav>
      <ul className="ev-key small muted">{(["И", "Ш", "П", "Т"] as const).map(e => <li key={e}><Evidence e={e} /> {EVIDENCE[e].title.toLowerCase()}</li>)}</ul>

      {q || topic ? (
        <section className="lib-sec">
          <p className="muted small">{found.length ? `Найдено ${found.length} ${plural(found.length, ['упражнение', 'упражнения', 'упражнений'])}` : 'Ничего не нашлось. Попробуй другое слово или тему.'}</p>
          <Tiles list={found} />
        </section>
      ) : TOPICS.map(t => {
        const list = ENTRIES.filter(e => e.topic === t.id)
        return (
          <section key={t.id} className="lib-sec">
            <div className="prog-head"><h2>{t.title}</h2><button className="textbtn" onClick={() => setTopic(t.id)}>Все {list.length} →</button></div>
            <Tiles list={list.slice(0, 6)} />
          </section>
        )
      })}

      {!q && !topic && (
        <section className="lib-sec">
          <h2>Статьи</h2>
          <div className="grid">{ARTICLES.map(a => <Link key={a.id} to={`/theory/${a.id}`} className="tile"><strong>{a.title}</strong><span className="muted small">{a.lead}</span></Link>)}</div>
        </section>
      )}
    </div>
  )
}

function Tiles({ list }: { list: Entry[] }) {
  return (
    <div className="grid">
      {list.map(e => (
        <Link key={e.key} to={e.to} className="tile">
          <span className="tile-top">{e.evidence ? <Evidence e={e.evidence} /> : <span />}{e.tag && <span className="tag">{e.tag}</span>}</span>
          <strong>{e.title}</strong>
          <span className="muted small clamp2">{e.goal}</span>
        </Link>
      ))}
    </div>
  )
}

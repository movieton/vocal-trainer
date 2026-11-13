import { tr } from '../lib/i18n'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { EXERCISES, p, type ExNote, type Section } from '../data/exercises'
import { BREATH } from '../data/breath'
import { LIBRARY, TOPICS, topicOf, type TopicId } from '../data/library'
import { ARTICLES } from './Theory'
import { Evidence, EVIDENCE } from './Breath'
import { plural } from '../lib/music'

/** Запись каталога: распевка на доске, дыхательный таймер или карточка из исследований */
type Entry = { key: string; title: string; goal: string; to: string; topic: TopicId; level: number; evidence?: 'И' | 'Ш' | 'П' | 'Т'; tag?: string; skills: Skill[] }

/** Навык, который тренирует упражнение: по нотам видно, на что оно работает */
export type Skill = 'pitch' | 'speed' | 'range' | 'breath'
const SKILLS: { id: Skill; title: string }[] = [
  { id: 'pitch', title: tr('Точность') }, { id: 'speed', title: tr('Скорость') }, { id: 'range', title: tr('Диапазон') }, { id: 'breath', title: tr('Дыхание') },
]
function skillsOf(notes: ExNote[] | undefined, bpm = 70, breath = false): Skill[] {
  const out: Skill[] = breath ? ['breath'] : []
  if (!notes?.length) return out
  const sung = notes.filter(n => !n.rest)
  const ms = sung.flatMap(n => [n.s, n.glide ?? n.s])
  const beat = 60 / bpm
  // точность — интервальная работа: минимум два скачка на терцию и больше между нотами (не глиссандо)
  const plain = sung.filter(n => n.glide == null)
  if (plain.slice(1).filter((n, i) => Math.abs(n.s - plain[i].s) >= 3).length >= 2) out.push('pitch')
  if (sung.filter(n => n.stacc || n.d * beat <= 0.25).length >= 4) out.push('speed')
  if (Math.max(...ms) - Math.min(...ms) >= 9) out.push('range')
  // долгая фраза без пауз или длинная нота — работа дыхания
  const phrase = sung.reduce((a, n) => a + n.d, 0) * beat
  if (!breath && (phrase >= 10 || sung.some(n => n.d * beat >= 3)) && !notes.some(n => n.rest)) out.push('breath')
  return out
}

const SECTION_TOPIC: Record<Section, TopicId> = { warmup: 'warmup', calm: 'sound', mix: 'registers', belt: 'registers', modes: 'registers', agility: 'agility' }

const ENTRIES: Entry[] = [
  ...EXERCISES.map(e => ({ key: 'ex:' + e.id, title: e.title, goal: e.goal, to: `/ex/${e.id}`, topic: SECTION_TOPIC[e.section], level: e.level, tag: tr('на доске'), skills: skillsOf(e.notes, e.bpm) })),
  ...BREATH.map(b => ({ key: 'br:' + b.id, title: b.title, goal: b.goal, to: `/breath/${b.id}`, topic: (b.group === 'health' ? 'health' : 'breath') as TopicId, level: b.level, evidence: b.evidence, tag: tr('таймер'), skills: (b.group === 'health' ? [] : ['breath']) as Skill[] })),
  ...LIBRARY.map(i => ({ key: 'lib:' + i.id, title: i.title, goal: i.goal, to: `/lib/${i.id}`, topic: topicOf(i), level: i.level, evidence: i.evidence, tag: i.notes ? tr('на доске') : undefined, skills: skillsOf(i.notes ? p(i.notes) : undefined, i.bpm, i.cat === 'дыхание') })),
]

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е')

export default function Library() {
  const [params, setParams] = useSearchParams()
  const topic = (params.get('t') ?? '') as TopicId | ''
  const skill = (params.get('s') ?? '') as Skill | ''
  const [q, setQ] = useState('')
  const found = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    return ENTRIES.filter(e => (!topic || e.topic === topic) && (!skill || e.skills.includes(skill)) && words.every(w => norm(e.title + ' ' + e.goal).includes(w)))
  }, [q, topic, skill])
  const go = (t: string, sk: string) => setParams({ ...(t ? { t } : {}), ...(sk ? { s: sk } : {}) }, { replace: true })
  const setTopic = (t: string) => go(t, skill)

  return (
    <div className="page library">
      <h1>{tr('Библиотека')}</h1>
      <p className="muted lead-narrow">{ENTRIES.length} {tr('упражнений: как делать, частые ошибки и источник. Метка показывает, насколько упражнение проверено. При боли или осиплости — стоп.')}</p>
      <label className="search">
        <Search size={18} aria-hidden />
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={tr('Поиск: трель, челюсть, микст…')} aria-label={tr('Поиск по библиотеке')} />
        {q && <button className="textbtn" onClick={() => setQ('')} aria-label={tr('Очистить')}><X size={16} /></button>}
      </label>
      <nav className="anchors topics" aria-label={tr('Темы')}>
        <button aria-pressed={!topic} onClick={() => setTopic('')}>{tr('Все')}</button>
        {TOPICS.map(t => <button key={t.id} aria-pressed={topic === t.id} onClick={() => setTopic(t.id)}>{t.title}</button>)}
      </nav>
      <nav className="anchors skills" aria-label={tr('Навык')}>
        <span className="muted small">{tr('Навык:')}</span>
        {SKILLS.map(k => <button key={k.id} aria-pressed={skill === k.id} onClick={() => go(topic, skill === k.id ? '' : k.id)}>{k.title}</button>)}
      </nav>
      <details className="ev-wrap"><summary className="small muted">{tr('Что значат метки')}</summary><ul className="ev-key small muted">{(["И", "Ш", "П", "Т"] as const).map(e => <li key={e}><Evidence e={e} /> {EVIDENCE[e].title.toLowerCase()}</li>)}</ul></details>

      {q || topic || skill ? (
        <section className="lib-sec">
          <p className="muted small">{found.length ? tr('Найдено {0} {1}', found.length, plural(found.length, [tr('упражнение'), tr('упражнения'), tr('упражнений')])) : tr('Ничего не нашлось. Попробуй другое слово или тему.')}</p>
          <Tiles list={found} skill={skill} />
        </section>
      ) : TOPICS.map(t => {
        const list = ENTRIES.filter(e => e.topic === t.id)
        return (
          <section key={t.id} className="lib-sec overview">
            <div className="prog-head"><h2>{t.title}</h2><button className="textbtn" onClick={() => setTopic(t.id)}>{tr('Все')} {list.length} →</button></div>
            <Tiles list={list.slice(0, 6)} />
          </section>
        )
      })}

      {!q && !topic && !skill && (
        <section className="lib-sec">
          <h2>{tr('Статьи')}</h2>
          <div className="grid">{ARTICLES.map(a => <Link key={a.id} to={`/theory/${a.id}`} className="tile"><strong>{a.title}</strong><span className="muted small">{a.lead}</span></Link>)}</div>
        </section>
      )}
    </div>
  )
}

function Tiles({ list, skill = '' }: { list: Entry[]; skill?: string }) {
  return (
    <div className="grid">
      {list.map(e => (
        <Link key={e.key} to={e.to} className="tile">
          <span className="tile-top">{e.evidence ? <Evidence e={e.evidence} /> : <span />}{e.tag && <span className="tag">{e.tag}</span>}</span>
          <strong>{e.title}</strong>
          <span className="muted small clamp2">{e.goal}</span>
          {e.skills.length > 0 && <span className="skill-line small">{e.skills.map((k, i) => <span key={k} className={k === skill ? 'on' : ''}>{i ? ' · ' : ''}{SKILLS.find(x => x.id === k)!.title.toLowerCase()}</span>)}</span>}
        </Link>
      ))}
    </div>
  )
}

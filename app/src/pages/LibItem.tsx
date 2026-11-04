import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ExternalLink, Play, RotateCcw } from 'lucide-react'
import { libItem, TOPICS, topicOf } from '../data/library'
import { Evidence, EVIDENCE } from './Breath'
import { DiaphragmDiagram, FoldsDiagram, HeadProfile, Posture, type Action, type Part } from '../components/Anatomy'
import type { LibItem as Item } from '../data/library'

const LEVEL = ['', 'новичок', 'средний', 'продвинутый']

/** Страница упражнения из библиотеки: зачем, как делать, ошибки, источник и тренировка */
export default function LibItem() {
  const { id = '' } = useParams()
  const it = libItem(id)
  if (!it) return <div className="page"><p>Упражнение не найдено. <Link to="/library">В библиотеку</Link></p></div>
  const topic = TOPICS.find(t => t.id === topicOf(it))!
  return (
    <div className="page lib-item">
      <div className="crumbs"><Link to="/library">Библиотека</Link> / <Link to={`/library?t=${topic.id}`}>{topic.title}</Link></div>
      <h1>{it.title}</h1>
      <p className="lead-narrow">{it.goal}</p>
      <p className="meta"><Evidence e={it.evidence} /> <span className="muted small">{EVIDENCE[it.evidence].title}</span></p>
      <p className="meta muted small">Уровень: <b>{LEVEL[it.level]}</b>{it.dose && <> · {it.dose}</>}</p>
      <Figure it={it} />
      {it.notes
        ? <Link to={`/ex/${it.id}`} className="btn big-btn"><Play size={18} fill="currentColor" /> Тренировать на нотной доске</Link>
        : <Steps how={it.how} />}
      {it.notesHint && <p className="muted small">Подсказка к нотам: {it.notesHint}</p>}
      <div className="howto">
        <div><h2>Как делать</h2><ol>{it.how.map(t => <li key={t}>{t}</li>)}</ol></div>
        {it.mistakes.length > 0 && <div><h2>Частые ошибки</h2><ul>{it.mistakes.map(t => <li key={t}>{t}</li>)}</ul></div>}
      </div>
      <div className="note-box source">
        <b>Источник.</b> {it.source}
        {it.urls.map(u => <a key={u} href={u} target="_blank" rel="noreferrer">{new URL(u).hostname.replace(/^www\./, '')} <ExternalLink size={12} /></a>)}
      </div>
    </div>
  )
}

/** Пошаговый режим для упражнений без нот: шаг крупно, секундомер */
function Steps({ how }: { how: string[] }) {
  const [i, setI] = useState<number | null>(null)
  const [t, setT] = useState(0)
  useEffect(() => {
    if (i == null) return
    const start = Date.now() - t * 1000
    const h = setInterval(() => setT(Math.floor((Date.now() - start) / 1000)), 500)
    return () => clearInterval(h)
  }, [i == null]) // eslint-disable-line react-hooks/exhaustive-deps
  if (i == null) return <button className="btn big-btn" onClick={() => { setI(0); setT(0) }}><Play size={18} fill="currentColor" /> Делать по шагам</button>
  const last = i === how.length - 1
  return (
    <div className="card steps" aria-live="polite">
      <div className="prog-head"><span className="muted small">Шаг {i + 1} из {how.length}</span><span className="timer">{Math.floor(t / 60)}:{String(t % 60).padStart(2, '0')}</span></div>
      <p className="step-text">{how[i]}</p>
      <div className="toolbar">
        <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Назад"><ChevronLeft size={18} /></button>
        {last ? <button className="btn" onClick={() => { setI(0); setT(0) }}><RotateCcw size={16} /> Ещё раз</button>
          : <button className="btn" onClick={() => setI(i + 1)}>Дальше <ChevronRight size={18} /></button>}
        <button className="textbtn" onClick={() => setI(null)}>Закончить</button>
      </div>
    </div>
  )
}

/** Подбор схемы по теме и ключевым словам: где это и что сделать */
type Fig = { hl: Part; action?: Action; caption: string }
const RULES: [RegExp, Fig][] = [
  [/соломин|straw|бульк/i, { hl: 'lips', action: 'straw', caption: 'Губы плотно вокруг соломинки, воздух идёт только через неё.' }],
  [/челюст|jaw/i, { hl: 'jaw', action: 'jaw-drop', caption: 'Челюсть свободно опускается вниз и назад, без усилия.' }],
  [/зев|yawn|щен|whine|гортан/i, { hl: 'larynx', action: 'larynx-down', caption: 'Гортань мягко опускается, глотка расширяется.' }],
  [/язык|tongue|ла-ла|лопат|чашеч|иголоч|грибок/i, { hl: 'tongue', action: 'tongue-forward', caption: 'Кончик языка у нижних зубов, корень свободен.' }],
  [/нёб|неб|palate|хунг|нг|ка-га|kng/i, { hl: 'palate', action: 'palate-up', caption: 'Мягкое нёбо поднимается и закрывает проход в нос.' }],
  [/губ|lip|трел|п-б-м|трубоч|бррр|«в»|«з»|жужж|fricative|buzz/i, { hl: 'lips', action: 'lips-buzz', caption: 'Звук рождается у губ, гортань остаётся свободной.' }],
  [/резонан|гласн|форман|aggiust|глотк|твэнг|twang|купол/i, { hl: 'pharynx', caption: 'Звук усиливается в глотке и во рту — форма этих полостей и есть тембр.' }],
  [/мычан|«м»|hum|назал/i, { hl: 'nose', caption: 'Вибрация в носовой полости и губах.' }],
]
function Figure({ it }: { it: Item }) {
  const text = it.id + ' ' + it.title + ' ' + it.how.join(' ')
  const t = topicOf(it)
  if (it.cat === 'осанка' || /осанк|posture|сутул|slump/i.test(text)) return <Posture />
  if (t === 'breath') return <DiaphragmDiagram />
  const f = RULES.find(([re]) => re.test(it.id + ' ' + it.title))?.[1] ?? RULES.find(([re]) => re.test(text))?.[1]
  if (f) return <HeadProfile hl={f.hl} action={f.action} caption={f.caption} />
  if (/атака|onset|регистр|смыкан|складк|кашл|отдых|кофеин|гигиен/i.test(text + it.cat)) return <FoldsDiagram />
  return null
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EXERCISES, SECTIONS, type Section } from '../data/exercises'

export default function Library() {
  const [level, setLevel] = useState(0)
  return (
    <div className="page library">
      <h1>Распевки</h1>
      <p className="muted">{EXERCISES.length} упражнений. Тональность каждого подстраивается под твой диапазон. Начинай с разогрева, 10–15 минут в день достаточно. При боли или осиплости — стоп.</p>
      <div className="seg" style={{ marginBottom: 20 }}>
        {['Все', 'Новичок', 'Средний', 'Продвинутый'].map((t, i) => <button key={t} aria-pressed={level === i} onClick={() => setLevel(i)}>{t}</button>)}
      </div>
      <nav className="anchors" aria-label="Разделы">{(Object.keys(SECTIONS) as Section[]).map(sec => <a key={sec} href={`#sec-${sec}`} onClick={e => { e.preventDefault(); document.getElementById('sec-' + sec)?.scrollIntoView({ behavior: 'smooth' }) }}>{SECTIONS[sec].title.replace(' (CVT)', '')}</a>)}</nav>
      {(Object.keys(SECTIONS) as Section[]).map(sec => {
        const list = EXERCISES.filter(e => e.section === sec && (!level || e.level === level))
        if (!list.length) return null
        return (
          <section key={sec} id={`sec-${sec}`} className="lib-sec">
            <h2>{SECTIONS[sec].title}</h2>
            <p className="muted small">{SECTIONS[sec].text}</p>
            <div className="grid">
              {list.map(e => (
                <Link key={e.id} to={`/ex/${e.id}`} className="tile">
                  <span className="lvl" data-l={e.level}>{'●'.repeat(e.level)}{'○'.repeat(3 - e.level)}</span>
                  <strong>{e.title}</strong>
                  <span className="muted small">{e.goal}</span>
                  <span className="syl">«{e.syllable}»</span>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

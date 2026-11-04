import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Target, TrendingUp } from 'lucide-react'
import { noteName, plural } from '../lib/music'
import { dailyScores, problemNotes, streak, useStored, type SessionLog } from '../lib/store'

const KINDS = { exercise: 'Распевки', ear: 'Слух', breath: 'Дыхание' } as const

export default function Progress() {
  const [log, setLog] = useStored<SessionLog[]>('log', [])
  const [shown, setShown] = useState(innerWidth < 760 ? 5 : 12)
  const days = dailyScores(log, 30)
  const s = streak(log)
  const week = days.slice(-7).filter(d => d.avg != null), prev = days.slice(-14, -7).filter(d => d.avg != null)
  const avg = (a: typeof days) => (a.length ? Math.round(a.reduce((x, d) => x + d.avg!, 0) / a.length) : null)
  const wAvg = avg(week), pAvg = avg(prev)
  const probs = problemNotes(log)
  // ежемесячные замеры: объективная картина прогресса раз в ~30 дней
  const [thr] = useStored<{ date: number; cents: number }[]>('threshold', [])
  const [rh] = useStored<{ date: number; lo: number; hi: number }[]>('rangeHist', [])
  const [best] = useStored<Record<string, number>>('breathBest', {})
  const [degStats] = useStored<Record<number, number[]>>('degStats', {})
  const degRows = Object.entries(degStats).filter(([, v]) => v.length >= 3)
    .map(([d, v]) => ({ d: +d, c: v.reduce((a, x) => a + x, 0) / v.length, n: v.length })).sort((a, b) => a.d - b.d)
  const MONTH = 30 * 86400000
  const checks = [
    { title: 'Порог слуха', to: '/ear/threshold', last: thr[0]?.date, value: thr[0] ? `${thr[0].cents} ц` + (thr[1] ? ` (было ${thr[1].cents})` : '') : null },
    { title: 'Диапазон', to: '/range', last: rh[0]?.date, value: rh[0] ? `${noteName(rh[0].lo)}–${noteName(rh[0].hi)}` + (rh[1] ? ` (было ${noteName(rh[1].lo)}–${noteName(rh[1].hi)})` : '') : null },
    { title: 'Длинное «с»', to: '/breath/long-s', last: undefined, value: best['long-s'] ? `рекорд ${best['long-s'].toFixed(1)} с` : null },
  ]
  const counts = (Object.keys(KINDS) as (keyof typeof KINDS)[]).map(k => ({ k, n: log.filter(l => l.kind === k).length }))
  const totalN = Math.max(1, counts.reduce((a, c) => a + c.n, 0))

  if (!log.length) return (
    <div className="page"><h1>Прогресс</h1><div className="card empty">Пока пусто: закончи первое упражнение, и здесь появятся графики.</div></div>
  )

  // график средней точности по дням
  // на телефоне — узкий viewBox: подписи остаются читаемыми без прокрутки
  const narrow = innerWidth < 560
  const W = narrow ? 340 : 640, H = narrow ? 200 : 180, P = 28
  const x = (i: number) => P + (i / (days.length - 1)) * (W - 2 * P)
  const vals = days.filter(d => d.avg != null).map(d => d.avg!)
  const yMin = Math.max(0, Math.floor((Math.min(...vals) - 10) / 10) * 10)
  const y = (v: number) => H - P - ((v - yMin) / (100 - yMin)) * (H - 2 * P)
  const pts = days.map((d, i) => (d.avg == null ? null : [x(i), y(d.avg)] as const))
  let path = '', open = false
  for (const p of pts) { if (!p) { open = false; continue } path += (open ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); open = true }

  return (
    <div className="page">
      <h1>Прогресс</h1>
      <div className="card monthly">
        <h2>Ежемесячный замер</h2>
        <p className="muted small">Раз в месяц — короткие замеры, чтобы видеть прогресс не по ощущениям, а по цифрам.</p>
        <ul className="hist">{checks.map(c => {
          const due = !c.last || Date.now() - c.last > MONTH
          return (
            <li key={c.title}>
              <div><b>{c.title}</b><span className="muted small">{c.value ?? 'ещё не было'}{c.last ? ` · ${new Date(c.last).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}` : ''}</span></div>
              <Link to={c.to} className={due && c.last !== undefined ? 'btn small-btn' : 'btn ghost small-btn'}>{due && c.last !== undefined ? 'Пора' : 'Открыть'}</Link>
            </li>
          )
        })}</ul>
      </div>
      <div className="kpis">
        <div className="kpi"><Flame size={18} /><b>{s}</b><span>{plural(s, ['день', 'дня', 'дней'])} подряд</span></div>
        <div className="kpi"><Target size={18} /><b>{wAvg != null ? wAvg + '%' : '—'}</b><span>точность за неделю</span></div>
        <div className="kpi"><TrendingUp size={18} /><b>{wAvg != null && pAvg != null ? (wAvg - pAvg > 0 ? '+' : '') + (wAvg - pAvg) : '—'}</b><span>к прошлой неделе</span></div>
      </div>

      <div className="card">
        <h2>Точность по дням</h2>
        <p className="muted small">Средний процент попадания в распевках и упражнениях на слух за 30 дней.</p>
        <div className="scroll-x"><svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="График точности по дням">
          {[yMin, Math.round((yMin + 100) / 2), 100].map(v => <g key={v}><path d={`M${P} ${y(v)} H${W - P}`} className="grid-line" /><text x={P - 6} y={y(v) + 4} textAnchor="end" className="axis">{v}</text></g>)}
          <path d={path} className="line" />
          {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r="3.5" className="dot"><title>{days[i].day.toLocaleDateString('ru', { day: 'numeric', month: 'short' })}: {Math.round(days[i].avg!)}%, занятий {days[i].count}</title></circle>)}
          {[0, 14, 29].map(i => <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="axis">{days[i].day.toLocaleDateString('ru', { day: 'numeric', month: 'short' })}</text>)}
        </svg></div>
      </div>

      <div className="two-col">
        <div className="card">
          <h2>Где уходишь от ноты</h2>
          {probs.length ? <ul className="probs">{probs.map(p => (
            <li key={p.m}><b>{noteName(p.m)}</b><span className={p.c > 0 ? 'up' : 'down'}>{p.c > 0 ? '+' : '−'}{Math.round(Math.abs(p.c))} ц</span><span className="muted small">{p.c > 0 ? 'завышаешь' : 'занижаешь'}</span></li>
          ))}</ul> : <p className="muted small">Устойчивых ошибок пока нет — или мало данных из распевок.</p>}
          <p className="muted small">Совет: на проблемной ноте сделай «Длинную ноту» в разделе «Дыхание».</p>
        </div>
        {degRows.length > 0 && (
          <div className="card">
            <h2>Ступени под дрон</h2>
            <p className="muted small">Среднее отклонение удержанной ступени от точной высоты.</p>
            <ul className="probs">{degRows.map(r => (
              <li key={r.d}><b>{r.d + 1}-я</b><span className={Math.abs(r.c) < 5 ? '' : r.c > 0 ? 'up' : 'down'}>{r.c > 0 ? '+' : '−'}{Math.abs(Math.round(r.c))} ц</span><span className="muted small">{Math.abs(r.c) < 5 ? 'точно' : r.c > 0 ? 'завышаешь' : 'занижаешь'}</span></li>
            ))}</ul>
          </div>
        )}
        <div className="card">
          <h2>Чем занимался</h2>
          <p className="muted small">Доля занятий за всё время, всего {totalN}.</p>
          <div className="bars">{counts.map(c => (
            <div key={c.k} className="bar-row"><span>{KINDS[c.k]}</span><div><i style={{ width: (c.n / totalN) * 100 + '%' }} /></div><b>{Math.round((c.n / totalN) * 100)}%</b></div>
          ))}</div>
        </div>
      </div>

      <div className="card">
        <h2>История</h2>
        <ul className="hist">
          {log.slice(0, shown).map(l => (
            <li key={l.date}>
              <div><b>{l.title}</b><span className="muted small">{KINDS[l.kind]} · {new Date(l.date).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
              <b className="res">{l.kind === 'breath' && l.id === 'long-s' ? l.score + ' с' : l.score + '%'}</b>
            </li>
          ))}
        </ul>
        {log.length > shown && <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setShown(shown + 20)}>Показать ещё</button>}
        <div className="hist-foot"><span />
        <button className="textbtn" onClick={() => confirm('Удалить всю историю?') && setLog([])}>Очистить историю</button></div>
      </div>
    </div>
  )
}

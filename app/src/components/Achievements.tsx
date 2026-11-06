import { tr } from '../lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { ACHIEVEMENTS, earned, type Data } from '../lib/achievements'
import { useStored, write, type SessionLog } from '../lib/store'
import { Bean } from './Beans'

function useData(): Data {
  const [log] = useStored<SessionLog[]>('log', [])
  const [notationDone] = useStored<string[]>('notation.done', [])
  const [kgBest] = useStored<Record<string, number>>('kg.best', {})
  const [rangeHist] = useStored<unknown[]>('rangeHist', [])
  const [threshold] = useStored<unknown[]>('threshold', [])
  return useMemo(() => ({ log, notationDone, kgBest, rangeHist, threshold }), [log, notationDone, kgBest, rangeHist, threshold])
}

/** Коллекция фасолин на странице прогресса */
export function AchievementGrid() {
  const got = new Set(earned(useData()))
  return (
    <div className="card">
      <div className="prog-head"><h2>{tr('Фасолины')}</h2><span className="muted small">{got.size} {tr('из')} {ACHIEVEMENTS.length}</span></div>
      <ul className="ach-grid">
        {ACHIEVEMENTS.map((a, i) => (
          <li key={a.id} className={got.has(a.id) ? 'got' : ''}>
            <Bean size={40} rotate={(i % 5 - 2) * 18} className="ach-bean" />
            <b>{a.title}</b>
            <span>{got.has(a.id) ? tr('получена') : a.how}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Тост «новая фасолина». Уже полученные до появления фасолин не показываем — только новые */
export function AchievementToast() {
  const ids = earned(useData())
  const [seen, setSeen] = useStored<string[] | null>('ach.seen', null)
  const [show, setShow] = useState<string[] | null>(null)
  const go = useNavigate()
  useEffect(() => {
    if (seen == null) { write('ach.seen', ids); return }
    const fresh = ids.filter(id => !seen.includes(id))
    if (fresh.length) { setShow(fresh); setSeen([...seen, ...fresh]) }
  }, [ids.join(), seen]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!show) return; const t = setTimeout(() => setShow(null), 6000); return () => clearTimeout(t) }, [show])
  const list = (show ?? []).map(id => ACHIEVEMENTS.find(x => x.id === id)!).filter(Boolean)
  if (!list.length) return null
  const names = list.length <= 3 ? list.map(a => a.title).join(', ') : tr('{0} и ещё {1}', list[0].title, list.length - 1)
  return (
    <div className="ach-toast" role="status">
      <button className="ach-open" onClick={() => { setShow(null); go('/progress') }}>
        <Bean size={36} rotate={-14} className="ach-bean" />
        <span><b>{list.length > 1 ? tr('+{0} фасолины', list.length) : tr('+1 фасолина')}</b><span>{names}</span></span>
      </button>
      <button className="textbtn ach-x" aria-label={tr('Закрыть')} onClick={() => setShow(null)}><X size={18} /></button>
    </div>
  )
}

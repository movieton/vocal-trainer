import { Link } from 'react-router-dom'
import { InstallCard } from '../components/Pwa'

export function More() {
  const links = [
    ['/compose', 'Сочинение'], ['/range', 'Голос и диапазон'], ['/breath', 'Дыхание'], ['/theory', 'Теория'], ['/progress', 'Прогресс'],
  ]
  return (
    <div className="page">
      <h1>Ещё</h1>
      <InstallCard />
      <div className="grid">{links.map(([to, t]) => <Link key={to} to={to} className="tile"><strong>{t}</strong></Link>)}</div>
    </div>
  )
}

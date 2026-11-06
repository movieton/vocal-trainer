import { tr } from '../lib/i18n'
import { Link } from 'react-router-dom'
import { InstallCard } from '../components/Pwa'
import LangSwitch from '../components/LangSwitch'

export function More() {
  const links = [
    ['/songs', tr('Песни')], ['/compose', tr('Сочинение')], ['/range', tr('Голос и диапазон')], ['/breath', tr('Дыхание')], ['/theory', tr('Теория')], ['/progress', tr('Прогресс')], ['/account', tr('Аккаунт')],
  ]
  return (
    <div className="page">
      <h1>{tr('Ещё')}</h1>
      <LangSwitch className="more-lang" />
      <InstallCard />
      <div className="grid">{links.map(([to, t]) => <Link key={to} to={to} className="tile"><strong>{t}</strong></Link>)}</div>
    </div>
  )
}

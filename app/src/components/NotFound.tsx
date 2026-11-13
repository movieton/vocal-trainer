import { tr } from '../lib/i18n'
import { Link } from 'react-router-dom'

/** Пустое место: опечатка в адресе или упражнение, которого больше нет */
export default function NotFound({ what = 'page', back = '/', backLabel }: { what?: 'page' | 'exercise'; back?: string; backLabel?: string }) {
  return (
    <div className="page notfound">
      <h1>{what === 'exercise' ? tr('Упражнение не найдено') : tr('Такой страницы нет')}</h1>
      <p className="muted">{what === 'exercise' ? tr('Возможно, ссылка устарела или в ней опечатка. Все упражнения — в библиотеке.') : tr('Возможно, в адресе опечатка. Начни с главной — там программа на сегодня.')}</p>
      <Link className="btn" to={back}>{backLabel ?? tr('На главную')}</Link>
    </div>
  )
}

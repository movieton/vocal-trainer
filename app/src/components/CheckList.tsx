import { Check, Lightbulb } from 'lucide-react'

export type CheckItem = { ok: boolean; title?: string; text: string; src?: string }

/** Список проверок: подсказки первыми, «всё хорошо» — приглушённо. Нейтрально, без светофора: это не оценка голоса. */
export default function CheckList({ items }: { items: CheckItem[] }) {
  const sorted = [...items].sort((a, b) => Number(a.ok) - Number(b.ok))
  return (
    <ul className="checklist">
      {sorted.map(it => (
        <li key={(it.title ?? '') + it.text} className={it.ok ? 'ok' : 'hint'}>
          {it.ok ? <Check size={16} /> : <Lightbulb size={16} />}
          <div>
            {it.title && <b>{it.title}</b>}
            <span>{it.text}</span>
            {it.src && <small>{it.src}</small>}
          </div>
        </li>
      ))}
    </ul>
  )
}

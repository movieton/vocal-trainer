import { Link } from 'react-router-dom'
import { Ear, Mic } from 'lucide-react'

const SING = [
  { to: '/ear/levels', title: '10 уровней точности', text: 'От одной ноты до быстрой мелодии, допуск сужается.', level: 1 },
  { to: '/ear/drone', title: 'Пение под дрон', text: 'Держи ступени лада над тоникой, видя отклонение в центах.', level: 1 },
  { to: '/ear/match', title: 'Повтори ноту', text: 'Звучит нота — пропой её. С этого начинается слух.', level: 1 },
  { to: '/ear/sing-interval', title: 'Интервалы голосом', text: 'От заданной ноты пой интервал вверх или вниз.', level: 1 },
  { to: '/ear/scales', title: 'Гаммы с аккомпанементом', text: 'Мажор, миноры, пентатоники, блюз под аккорд тоники.', level: 2 },
  { to: '/ear/chords', title: 'Пение над аккордами', text: 'Основной тон, терция, арпеджио по гармонии и по квинтовому кругу.', level: 2 },
  { to: '/ear/melody', title: 'Повтори мелодию', text: 'Короткая фраза — повтори по памяти.', level: 2 },
  { to: '/ear/harmony', title: 'Вторая партия', text: 'Подпевай мелодии терцией, квинтой или секстой.', level: 3 },
]
const LISTEN = [
  { to: '/ear/intervals', title: 'Узнай интервал', text: '24 интервала: мелодические и гармонические.', level: 1 },
  { to: '/ear/chord-quality', title: 'Узнай аккорд', text: 'Мажор и минор, затем все трезвучия и септаккорды.', level: 2 },
  { to: '/ear/circle', title: 'Квинтовый круг', text: '24 тональности: гаммы, аккорды, каденции и вопросы.', level: 2 },
  { to: '/ear/rhythm', title: 'Ритм', text: 'Повтори ритмический рисунок под метроном.', level: 1 },
]

export default function EarHub() {
  return (
    <div className="page">
      <h1>Слух</h1>
      <p className="muted">Чтобы чище попадать в ноты, тренируй две вещи: слышать (узнавать на слух) и воспроизводить (петь услышанное). Чередуй оба вида, 3–5 минут в день.</p>
      {[{ title: 'Петь', icon: Mic, list: SING }, { title: 'Слышать и понимать', icon: Ear, list: LISTEN }].map(g => (
        <section key={g.title} className="lib-sec">
          <h2 className="with-ic"><g.icon size={18} strokeWidth={1.75} /> {g.title}</h2>
          <div className="grid grid3">
            {g.list.map(x => (
              <Link key={x.to} to={x.to} className="tile">
                <span className="lvl">{'●'.repeat(x.level)}{'○'.repeat(3 - x.level)}</span>
                <strong>{x.title}</strong>
                <span className="muted small">{x.text}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

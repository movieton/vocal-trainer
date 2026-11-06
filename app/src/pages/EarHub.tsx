import { tr } from '../lib/i18n'
import { Link } from 'react-router-dom'
import { Ear, Mic } from 'lucide-react'

const SING = [
  { to: '/ear/levels', title: tr('10 уровней точности'), text: tr('От одной ноты до быстрой мелодии, допуск сужается.'), level: 1 },
  { to: '/ear/sing-degree', title: tr('Спой ступень'), text: tr('После каденции спой названную ступень, не слыша её.'), level: 2 },
  { to: '/ear/drone', title: tr('Пение под дрон'), text: tr('Держи ступени лада над тоникой, видя отклонение в центах.'), level: 1 },
  { to: '/ear/match', title: tr('Повтори ноту'), text: tr('Звучит нота — пропой её. С этого начинается слух.'), level: 1 },
  { to: '/ear/sing-interval', title: tr('Интервалы голосом'), text: tr('От заданной ноты пой интервал вверх или вниз.'), level: 1 },
  { to: '/ear/scales', title: tr('Гаммы с аккомпанементом'), text: tr('Мажор, миноры, пентатоники, блюз под аккорд тоники.'), level: 2 },
  { to: '/ear/chords', title: tr('Пение над аккордами'), text: tr('Основной тон, терция, арпеджио по гармонии и по квинтовому кругу.'), level: 2 },
  { to: '/ear/melody', title: tr('Повтори мелодию'), text: tr('Короткая фраза — повтори по памяти.'), level: 2 },
  { to: '/ear/chord-voice', title: tr('Спой голос из аккорда'), text: tr('Звучит аккорд — вычлени и спой нижний, средний или верхний голос.'), level: 3 },
  { to: '/ear/harmony', title: tr('Вторая партия'), text: tr('Подпевай мелодии терцией, квинтой или секстой.'), level: 3 },
]
const LISTEN = [
  { to: '/ear/keys', title: tr('Игры с клавиатурой'), text: tr('Найди ноту, повтори мелодию, назови клавишу. Уроки по 10 заданий.'), level: 1 },
  { to: '/ear/degrees', title: tr('Ступени на слух'), text: tr('Каденция, затем нота: какая это ступень? С разрешением в тонику.'), level: 1 },
  { to: '/ear/dictation', title: tr('Мелодический диктант'), text: tr('Услышь короткую мелодию и запиши её ступенями.'), level: 2 },
  { to: '/ear/intervals', title: tr('Узнай интервал'), text: tr('24 интервала: мелодические и гармонические.'), level: 1 },
  { to: '/ear/chord-quality', title: tr('Узнай аккорд'), text: tr('Мажор и минор, затем все трезвучия и септаккорды.'), level: 2 },
  { to: '/ear/circle', title: tr('Квинтовый круг'), text: tr('24 тональности: гаммы, аккорды, каденции и вопросы.'), level: 2 },
  { to: '/ear/rhythm', title: tr('Ритм'), text: tr('Повтори ритмический рисунок под метроном.'), level: 1 },
  { to: '/ear/threshold', title: tr('Порог слуха'), text: tr('Замер в центах раз в месяц: насколько тонко ты различаешь высоту.'), level: 1 },
]

export default function EarHub() {
  return (
    <div className="page">
      <h1>{tr('Слух')}</h1>
      <p className="muted">{tr('Чтобы чище попадать в ноты, тренируй две вещи: слышать (узнавать на слух) и воспроизводить (петь услышанное). Чередуй оба вида, 3–5 минут в день.')}</p>
      {[{ title: tr('Петь'), icon: Mic, list: SING }, { title: tr('Слышать и понимать'), icon: Ear, list: LISTEN }].map(g => (
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

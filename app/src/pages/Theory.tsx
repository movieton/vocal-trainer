import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { noteName, VOICE_TYPES } from '../lib/music'
import { useWorkRange } from '../lib/store'

type Article = { id: string; title: string; lead: string; body: () => ReactNode }

// ---------- схемы (свои SVG, цвета из темы) ----------

function VoiceDiagram() {
  return (
    <svg viewBox="0 0 520 300" className="diagram" role="img" aria-label="Схема голосового аппарата: лёгкие, связки, резонаторы">
      <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" className="fill-accent" /></marker></defs>
      {/* лёгкие */}
      <ellipse cx="110" cy="220" rx="46" ry="58" className="part lung" /><ellipse cx="210" cy="220" rx="46" ry="58" className="part lung" />
      <path d="M160 160 V100" className="tube" />
      {/* гортань со связками */}
      <rect x="140" y="80" width="40" height="34" rx="8" className="part hl" />
      <path d="M148 97 Q160 90 172 97" className="fold" /><path d="M148 99 Q160 106 172 99" className="fold" />
      {/* глотка, рот, нос */}
      <path d="M160 80 V40 Q160 22 182 22 H250" className="tube" />
      <path d="M182 46 H250" className="tube" />
      {/* поток воздуха */}
      <path d="M160 200 V130" className="flow" markerEnd="url(#arr)" />
      <path d="M200 34 H262" className="flow" markerEnd="url(#arr)" />
      <text x="160" y="295" textAnchor="middle" className="lbl">1. Дыхание — «мотор»</text>
      <text x="200" y="102" className="lbl">2. Связки — источник звука</text>
      <text x="272" y="30" className="lbl">3. Резонаторы: глотка, рот, нос</text>
      <text x="272" y="48" className="lbl small">«усилитель» звука и тембр</text>
    </svg>
  )
}

function DiaphragmDiagram() {
  return (
    <svg viewBox="0 0 520 220" className="diagram" role="img" aria-label="Диафрагма на вдохе опускается, на выдохе поднимается">
      {[{ x: 130, t: 'Вдох', d: 'M50 150 Q130 175 210 150', note: 'диафрагма опускается, живот и рёбра расширяются' },
        { x: 390, t: 'Выдох с опорой', d: 'M310 130 Q390 95 470 130', note: 'поднимается медленно, рёбра держатся раскрытыми' }].map(s => (
        <g key={s.t}>
          <path d={`M${s.x - 70} 40 Q${s.x - 90} 110 ${s.x - 80} 160 M${s.x + 70} 40 Q${s.x + 90} 110 ${s.x + 80} 160`} className="tube" />
          <path d={s.d} className="fold thick" />
          <text x={s.x} y="28" textAnchor="middle" className="lbl strong">{s.t}</text>
          <text x={s.x} y="205" textAnchor="middle" className="lbl small">{s.note}</text>
        </g>
      ))}
    </svg>
  )
}

function RegistersDiagram() {
  const r = useWorkRange()
  const lo = 36, hi = 84, w = 480, x = (m: number) => 20 + ((m - lo) / (hi - lo)) * w
  const p1 = r.lo + Math.round((r.hi - r.lo) * 0.45), p2 = r.lo + Math.round((r.hi - r.lo) * 0.75)
  return (
    <svg viewBox="0 0 520 125" className="diagram" role="img" aria-label="Регистры голоса по высоте">
      <rect x={x(r.lo - 4)} y="50" width={x(p1) - x(r.lo - 4)} height="36" rx="6" className="reg chest" />
      <rect x={x(p1)} y="50" width={x(p2) - x(p1)} height="36" className="reg mix" />
      <rect x={x(p2)} y="50" width={x(r.hi + 6) - x(p2)} height="36" rx="6" className="reg head" />
      <text x={(x(r.lo - 4) + x(p1)) / 2} y="73" textAnchor="middle" className="lbl strong on">Грудной</text>
      <text x={(x(p1) + x(p2)) / 2} y="73" textAnchor="middle" className="lbl strong on">Микст</text>
      <text x={(x(p2) + x(r.hi + 6)) / 2} y="73" textAnchor="middle" className="lbl strong on">Головной</text>
      {[p1, p2].map(m => <g key={m}><path d={`M${x(m)} 40 V96`} className="tick" /><text x={x(m)} y="112" textAnchor="middle" className="lbl small">{noteName(m)}</text></g>)}
      <text x={x(r.lo - 4)} y="40" className="lbl small">{noteName(r.lo)}</text>
      <text x={x(r.hi + 6)} y="40" textAnchor="end" className="lbl small">{noteName(r.hi)}</text>
    </svg>
  )
}

function VoiceTypesDiagram() {
  const lo = 38, hi = 86, x = (m: number) => 110 + ((m - lo) / (hi - lo)) * 390
  return (
    <svg viewBox="0 0 520 230" className="diagram" role="img" aria-label="Диапазоны типов голоса">
      {VOICE_TYPES.map((v, i) => (
        <g key={v.name}>
          <text x="0" y={28 + i * 32} className="lbl">{v.name}</text>
          <rect x={x(v.lo)} y={16 + i * 32} width={x(v.hi) - x(v.lo)} height="16" rx="8" className="reg mix" />
          <text x={x(v.lo) - 6} y={28 + i * 32} textAnchor="end" className="lbl small">{noteName(v.lo)}</text>
          <text x={x(v.hi) + 6} y={28 + i * 32} className="lbl small">{noteName(v.hi)}</text>
        </g>
      ))}
    </svg>
  )
}

function RollDiagram() {
  return (
    <svg viewBox="0 0 520 170" className="diagram" role="img" aria-label="Как читать нотную доску">
      {[0, 1, 2, 3].map(i => <path key={i} d={`M60 ${30 + i * 32} H500`} className="tick" />)}
      {['Ми4', 'Ре4', 'До4', 'Си3'].map((n, i) => <text key={n} x="10" y={35 + i * 32} className="lbl small">{n}</text>)}
      <rect x="110" y="84" width="110" height="22" rx="11" className="pill" />
      <rect x="240" y="52" width="110" height="22" rx="11" className="pill" />
      <path d="M100 100 Q140 92 160 96 T220 95" className="voice good" />
      <path d="M232 92 Q240 80 255 66 T345 60" className="voice near" />
      <path d="M380 0 V140" className="tick dashed" />
      <text x="110" y="128" className="lbl small">плашка — нота, которую нужно спеть</text>
      <text x="260" y="40" className="lbl small">линия — твой голос</text>
      <text x="388" y="150" className="lbl small">курсор «сейчас»</text>
    </svg>
  )
}

// ---------- статьи ----------

export const ARTICLES: Article[] = [
  { id: 'voice', title: 'Как устроен голос', lead: 'Три части: дыхание, связки, резонаторы.', body: () => <>
    <VoiceDiagram />
    <p>Голос работает как духовой инструмент. <b>Дыхание</b> даёт поток воздуха. <b>Голосовые складки</b> (связки) в гортани смыкаются и вибрируют сотни раз в секунду: так рождается звук и его высота. <b>Резонаторы</b> (глотка, рот, нос) усиливают этот звук и придают тембр.</p>
    <p>Отсюда главный вывод для тренировки: громкость и сила идут от дыхания и резонанса, а не от напряжения горла. Если горлу тяжело, значит, работу делает не та часть.</p>
  </> },
  { id: 'support', title: 'Диафрагма и опора', lead: 'Что такое «петь на опоре» на самом деле.', body: () => <>
    <DiaphragmDiagram />
    <p>Диафрагма — куполообразная мышца под лёгкими. На вдохе она опускается: живот и нижние рёбра мягко расширяются. На выдохе поднимается.</p>
    <p><b>Опора</b> — это умение не «выплёскивать» воздух, а отдавать его ровно и порциями: рёбра остаются раскрытыми как можно дольше, живот работает плавно. В итальянской школе это называют апподжио. Тренируется упражнениями «Горизонт», «Шипящий метроном», «Длинная нота» в разделе «Дыхание».</p>
  </> },
  { id: 'registers', title: 'Регистры и микст', lead: 'Почему голос «ломается» и как это сгладить.', body: () => <>
    <RegistersDiagram />
    <p className="muted small">Переходные ноты на схеме примерные, для твоего рабочего диапазона. У каждого голоса они свои.</p>
    <p><b>Грудной регистр</b> — плотный, разговорный звук внизу. <b>Головной</b> — лёгкий, полётный звук наверху. Между ними — переходные ноты (пассаджо), где голос любит «переключаться» с щелчком.</p>
    <p><b>Микст</b> — смешанный механизм: плотность грудного с лёгкостью головного. Его тренируют узкими гласными и полузакрытыми звуками: «нэй», «гуг», «нг»-сирены, губная трель через весь диапазон. Раздел «Распевки → Микст».</p>
  </> },
  { id: 'types', title: 'Типы голоса', lead: 'Бас, баритон, тенор, контральто, меццо, сопрано.', body: () => <>
    <VoiceTypesDiagram />
    <p>Тип голоса определяет не столько крайние ноты, сколько <b>тесситура</b> — зона, где петь удобно долго — и тембр. Поэтому приложение строит упражнения по удобной зоне выбранного типа, а не по рекордным нотам замера.</p>
    <p><Link to="/range">Выбрать тип голоса →</Link></p>
  </> },
  { id: 'roll', title: 'Как читать нотную доску', lead: 'Плашки, линия голоса и центы.', body: () => <>
    <RollDiagram />
    <p>По вертикали — ноты (полутон на строку), по горизонтали — время. <b>Плашка</b> — нота, которую нужно спеть: контурная — слушать, сплошная — петь. <b>Линия</b> — твой голос в реальном времени: зелёная — попал, жёлтая — рядом, красная — мимо.</p>
    <p><b>Цент</b> — сотая часть полутона. Ухо слушателя замечает фальшь примерно от 15–25 центов, поэтому «Обычная» строгость — ±25 центов, а «Строгая» — ±12.</p>
  </> },
  { id: 'hygiene', title: 'Гигиена голоса', lead: 'Как заниматься и не навредить.', body: () => <>
    <ul className="facts">
      <li><b>Разогрев обязателен.</b> 5 минут дыхания и полузакрытых звуков (трель, трубочка, мычание) перед нагрузкой.</li>
      <li><b>Боль — стоп.</b> Осиплость, жжение, боль: прекращай и отдыхай. Если не проходит больше двух недель — к фониатру.</li>
      <li><b>Вода и воздух.</b> Пей воду в течение дня, сухой воздух сушит связки.</li>
      <li><b>Сон.</b> Невыспавшийся голос быстрее устаёт и хуже держит верх.</li>
      <li><b>Без крика и шёпота.</b> Шёпот нагружает связки сильнее, чем кажется.</li>
      <li><b>Коротко и каждый день.</b> 15 минут ежедневно лучше двух часов раз в неделю.</li>
      <li><b>Заминка.</b> После нагрузки — пара минут лёгкого мычания или трели сверху вниз.</li>
    </ul>
  </> },
  { id: 'glossary', title: 'Глоссарий', lead: 'Короткие объяснения терминов.', body: () => (
    <dl className="glossary">
      {[
        ['Апподжио', 'классическая опора дыхания: рёбра раскрыты, выдох ровный и экономный.'],
        ['SOVT', 'упражнения с полузакрытым речевым трактом: трель, трубочка, мычание. Разгружают связки.'],
        ['Легато', 'связное пение без разрывов между нотами.'],
        ['Стаккато', 'отрывистое пение, каждая нота короткая и отдельная.'],
        ['Филировка (messa di voce)', 'плавное усиление и ослабление звука на одной ноте.'],
        ['Тесситура', 'зона высот, где голосу удобно петь долго.'],
        ['Пассаджо', 'переходные ноты между регистрами.'],
        ['Микст', 'смешанный регистр: соединение грудного и головного звучания.'],
        ['Бэлтинг', 'громкое яркое пение верхних нот речевой позицией, без крика.'],
        ['Твэнг', 'яркий «звонкий» оттенок звука за счёт сужения в глотке, помогает в миксте и бэлтинге.'],
        ['Мелизм', 'несколько нот на одном слоге, распев.'],
        ['Интервал', 'расстояние между двумя нотами. Полутон — самое маленькое в европейской музыке.'],
        ['Тоника', 'главная, устойчивая нота тональности.'],
        ['Каденция', 'гармонический оборот, завершающий фразу, например IV–V–I.'],
        ['Цент', 'сотая часть полутона, единица точности интонации.'],
      ].map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
    </dl>
  ) },
]

export function TheoryList() {
  return (
    <div className="page">
      <h1>Теория</h1>
      <p className="muted">Коротко о том, как работает голос и что стоит за упражнениями. Каждую статью можно прочитать за 2–3 минуты.</p>
      <div className="grid grid3">
        {ARTICLES.slice(0, -1).map((a, i) => (
          <Link key={a.id} to={`/theory/${a.id}`} className="tile">
            <strong><span className="muted">{i + 1} · </span>{a.title}</strong>
            <span className="muted small">{a.lead}</span>
          </Link>
        ))}
      </div>
      <Link to="/theory/glossary" className="card next-art"><strong>Глоссарий →</strong><span className="muted small">{ARTICLES.at(-1)!.lead}</span></Link>
    </div>
  )
}

export function TheoryArticle() {
  const { id = '' } = useParams()
  const i = ARTICLES.findIndex(a => a.id === id)
  const a = ARTICLES[i]
  if (!a) return <div className="page"><p>Статья не найдена. <Link to="/theory">К теории</Link></p></div>
  const next = ARTICLES[i + 1]
  return (
    <div className="page article">
      <div className="crumbs"><Link to="/theory">Теория</Link></div>
      <h1>{a.title}</h1>
      <p className="muted lead">{a.lead}</p>
      <div className="article-body">{a.body()}</div>
      {next && <Link to={`/theory/${next.id}`} className="card next-art"><span className="muted small">Дальше</span><strong>{next.title} →</strong></Link>}
    </div>
  )
}

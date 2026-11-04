/**
 * Понятные анатомические схемы в стиле fasol: всегда на светлой подложке, подписи по-русски.
 * HeadProfile — голова в разрезе с подсветкой нужной части; FoldsDiagram — складки сверху; Posture — осанка.
 */
/** Грудная клетка спереди: лёгкие, рёбра, диафрагма — на вдохе и на выдохе с опорой */
function Torso({ x, inhale }: { x: number; inhale: boolean }) {
  const w = inhale ? 1.08 : 1 // рёбра раздвигаются в стороны
  const dome = inhale ? 'Q0 222 ' : 'Q0 168 ' // купол диафрагмы: на вдохе ниже и площе
  const lung = (side: 1 | -1) => {
    const bottom = inhale ? 214 : 182
    return `M${side * 10} 70 C${side * 30} 62 ${side * 70 * w} 80 ${side * 78 * w} ${bottom - 30} C${side * 80 * w} ${bottom} ${side * 40} ${bottom + 4} ${side * 12} ${bottom - 6} Z`
  }
  return (
    <g transform={`translate(${x} 0)`}>
      <path d="M-60 30 Q-62 44 -110 56 Q-128 64 -124 110 L-104 300 L104 300 L124 110 Q128 64 110 56 Q62 44 60 30 Z" className="body" />
      {[-1, 1].map(sd => <path key={sd} d={lung(sd as 1 | -1)} className="lung" />)}
      {[96, 126, 156, 186].map((y, i) => <path key={y} d={`M-${(84 + i * 4) * w} ${y + 14} Q0 ${y - 22} ${(84 + i * 4) * w} ${y + 14}`} className="rib" />)}
      <path d={`M-${92 * w} 214 ${dome}${92 * w} 214`} className="diaphragm" />
      {inhale ? <>
        <path d="M0 196 V236" className="arrow" markerEnd="url(#ah)" />
        <path d="M-112 150 H-140" className="arrow" markerEnd="url(#ah)" /><path d="M112 150 H140" className="arrow" markerEnd="url(#ah)" />
      </> : <>
        <path d="M0 214 V176" className="arrow" markerEnd="url(#ah)" />
        <path d="M-130 150 H-112" className="arrow muted" /><path d="M130 150 H112" className="arrow muted" />
      </>}
    </g>
  )
}

export function DiaphragmDiagram() {
  const marker = <defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" className="fill-accent" /></marker></defs>
  return (
    <figure className="fig">
      <div className="anat-pair">
        <svg viewBox="0 0 330 340" className="diagram anat" role="img" aria-label="Вдох: диафрагма опускается и уплощается, рёбра расходятся в стороны">
          {marker}
          <text x="160" y="22" textAnchor="middle" className="lbl strong">Вдох</text>
          <Torso x={160} inhale />
          <path d="M200 120 L248 100" className="leader" /><text x="250" y="96" className="lbl small">лёгкие</text>
          <path d="M226 168 L248 180" className="leader" /><text x="250" y="190" className="lbl small">рёбра</text>
          <path d="M200 226 L240 256" className="leader" /><text x="236" y="272" className="lbl small">диафрагма</text>
          <text x="160" y="326" textAnchor="middle" className="lbl small">опускается, рёбра расходятся</text>
        </svg>
        <svg viewBox="0 0 330 340" className="diagram anat" role="img" aria-label="Выдох с опорой: диафрагма поднимается медленно, рёбра остаются раскрытыми">
          {marker}
          <text x="165" y="22" textAnchor="middle" className="lbl strong">Выдох с опорой</text>
          <Torso x={165} inhale={false} />
          <text x="165" y="326" textAnchor="middle" className="lbl small">поднимается медленно, рёбра раскрыты</text>
        </svg>
      </div>
      <figcaption>Вид спереди. Синяя линия — диафрагма: купол под лёгкими.</figcaption>
    </figure>
  )
}

/** Живая анимация из Wikimedia Commons с указанием автора и лицензии */
export function Credit({ src, alt, caption, author, license, href }: { src: string; alt: string; caption: string; author: string; license: string; href: string }) {
  return (
    <figure className="fig photo">
      <img src={src} alt={alt} loading="lazy" />
      <figcaption>{caption} <a href={href} target="_blank" rel="noreferrer">{author}, {license}</a></figcaption>
    </figure>
  )
}


export type Part = 'lips' | 'jaw' | 'tongue' | 'palate' | 'pharynx' | 'larynx' | 'nose'
/** Действие поверх схемы: что сделать этой частью */
export type Action = 'jaw-drop' | 'straw' | 'larynx-down' | 'tongue-forward' | 'palate-up' | 'lips-buzz'
const PART_NAME: Record<Part, string> = { lips: 'губы', jaw: 'челюсть', tongue: 'язык', palate: 'мягкое нёбо', pharynx: 'глотка', larynx: 'гортань, связки', nose: 'носовая полость' }

const Arrow = ({ id }: { id: string }) => <defs><marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" className="fill-accent" /></marker></defs>

/**
 * Голова сбоку в разрезе. Воздух идёт одним путём: трахея → гортань со складками → глотка → рот и нос.
 * hl — подсвеченная часть, action — что ею сделать.
 */
export function HeadProfile({ hl, action, caption }: { hl?: Part; action?: Action; caption?: string }) {
  const c = (p: Part, base = 'organ') => base + (hl === p ? ' hl' : '')
  const label = (p: Part, x: number, y: number, tx: number, ty: number, anchor: 'start' | 'end' = 'start') => (
    <g className={hl === p ? 'lbl-hl' : ''}><path d={`M${x} ${y} L${tx + (anchor === 'end' ? 4 : -4)} ${ty - 4}`} className="leader" /><text x={tx} y={ty} textAnchor={anchor} className="lbl small">{PART_NAME[p]}</text></g>
  )
  return (
    <figure className="fig">
      <svg viewBox={action === 'straw' ? '-80 0 440 380' : '0 0 360 380'} className="diagram anat head" role="img" aria-label={`Голова в разрезе${hl ? ', выделено: ' + PART_NAME[hl] : ''}`}>
        <Arrow id="hp-ah" />
        {/* силуэт: лицо смотрит влево */}
        <path d="M150 18 C94 18 60 54 60 104 L60 116 L36 150 L56 160 L54 168 L46 174 L54 180 L46 186 L56 192 L58 212 C60 232 80 240 104 242 L126 246 L130 380 L234 380 L236 270 C266 240 280 200 278 150 C276 70 226 18 150 18 Z" className="body" />
        {/* дыхательный путь — один канал */}
        <path d="M162 380 V266 L192 236 V146 L178 136 H66 M192 186 L176 178 H60" className={c('pharynx', 'airway')} />
        <path d="M66 130 Q120 118 178 130 L178 144 H66 Z" className={c('nose')} />
        {/* нёбо: твёрдое (кость) и мягкое (свисает между носом и ртом) */}
        <path d="M58 160 Q108 152 152 156" className="bone" />
        <path d="M152 156 Q174 160 184 178" className={c('palate', 'palate')} />
        <rect x="50" y="162" width="11" height="11" rx="3" className="tooth" /><rect x="52" y="186" width="11" height="10" rx="3" className="tooth" />
        <path d="M46 168 Q40 175 48 179 M48 183 Q40 189 50 194" className={c('lips', 'lips')} />
        <path d="M62 198 Q92 184 140 186 Q174 188 182 212 Q182 240 160 246 Q112 242 72 214 Z" className={c('tongue')} />
        <path d="M58 198 C60 228 80 238 104 240 L150 242 C160 236 166 226 170 216" className={c('jaw', 'jawbone')} />
        <rect x="145" y="250" width="34" height="28" rx="8" className={c('larynx')} />
        <path d="M150 266 L162 260 L174 266" className="fold-line" />
        <path d="M152 278 V380 M172 278 V380" className="tube" />
        {/* путь воздуха */}
        <path d={action === 'straw' ? 'M162 352 V268 L190 240 V194 L176 182 H54 L-26 310' : 'M162 352 V268 L190 240 V194 L176 182 H26'} className="flow" markerEnd="url(#hp-ah)" />
        {action !== 'straw' && action !== 'palate-up' && <path d="M190 194 V150 L178 140 H40" className="flow thin" markerEnd="url(#hp-ah)" />}
        {action === 'jaw-drop' && <>
          <path d="M58 214 C62 252 84 262 106 264 L134 264" className="ghost" />
          <path d="M92 236 Q86 254 96 266" className="arrow" markerEnd="url(#hp-ah)" />
        </>}
        {action === 'straw' && <>
          <path d="M-74 236 V330 Q-74 340 -64 340 H-6 Q4 340 4 330 V236" className="glass" />
          <path d="M-72 270 H2 V330 Q2 338 -6 338 H-64 Q-72 338 -72 330 Z" className="water" />
          <path d="M50 180 L-30 316" className="straw" />
          {[[-36, 296], [-24, 284], [-40, 278], [-30, 262]].map(([x, y]) => <circle key={x + ':' + y} cx={x} cy={y} r="4" className="bubble" />)}
        </>}
        {action === 'larynx-down' && <path d="M196 252 V284" className="arrow" markerEnd="url(#hp-ah)" />}
        {action === 'tongue-forward' && <path d="M96 196 H66" className="arrow" markerEnd="url(#hp-ah)" />}
        {action === 'palate-up' && <path d="M170 182 L176 160" className="arrow" markerEnd="url(#hp-ah)" />}
        {action === 'lips-buzz' && <path d="M34 168 l-6 4 l6 4 l-6 4 l6 4 l-6 4" className="arrow" />}
        {label('nose', 120, 132, 240, 96)}
        {label('palate', 172, 166, 240, 128)}
        {label('pharynx', 196, 214, 240, 214)}
        {label('tongue', 128, 210, 240, 182)}
        {action !== 'straw' && label('jaw', 86, 238, 8, 290)}
        {label('larynx', 180, 262, 240, 262)}
        {action === 'straw' ? label('lips', 46, 172, 30, 150, 'end') : label('lips', 44, 182, 26, 236, 'end')}
        <text x="244" y="350" className="lbl small air-lbl">→ путь воздуха</text>
      </svg>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

/** Голосовые складки сверху: на вдохе раскрыты (щель), на звуке сомкнуты и колеблются */
export function FoldsDiagram() {
  const panel = (x: number, open: boolean, title: string, note: [string, string]) => {
    const L = open ? 40 : 68, Li = open ? 54 : 80
    return (
      <g transform={`translate(${x} 0)`}>
        <text x="80" y="20" textAnchor="middle" className="lbl strong">{title}</text>
        <ellipse cx="80" cy="102" rx="62" ry="66" className="body" />
        {open && <path d={`M80 52 L${Li} 152 L${160 - Li} 152 Z`} className="gap" />}
        <path d={`M80 44 L${L} 152 L${Li} 152 L80 ${open ? 52 : 46} Z`} className="fold-band" />
        <path d={`M80 44 L${160 - L} 152 L${160 - Li} 152 L80 ${open ? 52 : 46} Z`} className="fold-band" />
        {!open && <path d="M74 92 h12 M74 112 h12 M74 132 h12" className="vib" />}
        <text x="80" y="38" textAnchor="middle" className="lbl tiny">кадык ↑</text>
        <path d={`M${(L + Li) / 2 + 4} 128 L18 150`} className="leader" /><text x="16" y="162" className="lbl tiny">складки</text>
        {open && <><path d="M80 130 L134 158" className="leader" /><text x="114" y="170" className="lbl tiny">щель</text></>}
        <text x="80" y="190" textAnchor="middle" className="lbl small">{note[0]}</text>
        <text x="80" y="205" textAnchor="middle" className="lbl small">{note[1]}</text>
      </g>
    )
  }
  return (
    <figure className="fig">
      <svg viewBox="0 0 340 215" className="diagram anat folds" role="img" aria-label="Голосовые складки сверху: на вдохе раскрыты и между ними щель, на звуке сомкнуты и колеблются">
        {panel(0, true, 'Вдох', ['раскрыты,', 'воздух проходит'])}
        {panel(176, false, 'Звук', ['сомкнуты', 'и колеблются'])}
      </svg>
      <figcaption>Вид сверху, как в ларингоскоп.</figcaption>
    </figure>
  )
}

type Pose = { ear: [number, number]; sh: [number, number]; hip: [number, number]; knee: [number, number]; ank: [number, number] }
const POSES: { t: string; ok: boolean; p: Pose }[] = [
  { t: 'сутулость', ok: false, p: { ear: [30, 58], sh: [46, 92], hip: [56, 168], knee: [46, 224], ank: [52, 280] } },
  { t: 'перетянуто', ok: false, p: { ear: [62, 44], sh: [64, 86], hip: [40, 166], knee: [58, 224], ank: [52, 280] } },
  { t: 'свободно', ok: true, p: { ear: [42, 44], sh: [42, 86], hip: [42, 166], knee: [46, 224], ank: [52, 280] } },
]
/** Осанка в профиль: сравнение трёх поз, отвес через ухо — плечо — таз — стопу */
export function Posture() {
  return (
    <figure className="fig">
      <svg viewBox="0 0 330 320" className="diagram anat posture" role="img" aria-label="Три позы в профиль: сутулость и перетянутая поза — неверно, свободная — ухо, плечо и таз на одной вертикали над стопой">
        {POSES.map(({ t, ok, p }, i) => {
          const { ear, sh, hip, knee, ank } = p
          return (
            <g key={t} transform={`translate(${i * 110 + 4} 0)`}>
              <path d={`M${sh[0]} ${sh[1]} Q${(sh[0] + hip[0]) / 2 + (t === 'сутулость' ? 14 : t === 'перетянуто' ? -10 : 0)} ${(sh[1] + hip[1]) / 2} ${hip[0]} ${hip[1]}`} className="limb torso" />
              <path d={`M${hip[0]} ${hip[1]} L${knee[0]} ${knee[1]} L${ank[0]} ${ank[1]} L${ank[0] - 22} ${ank[1] + 2} M${ank[0]} ${ank[1] + 2} L${ank[0] + 4} ${ank[1] + 2}`} className="limb" />
              <path d={`M${sh[0]} ${sh[1] + 4} L${sh[0] + 4} ${sh[1] + 64}`} className="limb arm" />
              <path d={`M${ear[0]} ${ear[1] + 14} L${sh[0]} ${sh[1]}`} className="limb neck" />
              <circle cx={ear[0]} cy={ear[1]} r="15" className="head" />
              <path d={`M${ear[0] - 14} ${ear[1] - 2} l-7 5 l7 3`} className="head" />
              <path d={`M${ank[0] - 10} 16 V${ank[1] + 6}`} className={'plumb' + (ok ? '' : ' off')} />
              {[ear, sh, hip].map(([x, y]) => <circle key={x + ':' + y} cx={x} cy={y} r="4" className={Math.abs(x - (ank[0] - 10)) < 6 ? 'fill-accent' : 'dot-bad'} />)}
              <text x="50" y="306" textAnchor="middle" className={'lbl small' + (ok ? ' ok' : '')}>{ok ? '✓ ' : '✗ '}{t}</text>
            </g>
          )
        })}
      </svg>
      <figcaption>Пунктир — отвес над серединой стопы. Ухо, плечо и таз на нём — значит, свободно.</figcaption>
    </figure>
  )
}

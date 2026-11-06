import { tr } from '../lib/i18n'
/** Нота песни: s — полутоны от тоники (null — пауза), d — длительность в долях, syl — слог */
export type SongNote = { s: number | null; d: number; syl?: string }
export type Song = {
  id: string
  title: string
  sub: string
  level: 1 | 2 | 3
  bpm: number
  /** Сильная доля такта (3 — вальс), для баса */
  meter: number
  phrases: { label: string; notes: SongNote[] }[]
  /** Своя песня: исходная высота тоники; авто-тональность её не трогает */
  base?: number
}

// компактная запись: "0 1 Бра" — ступень в полутонах, доли, слог; "- 1" — пауза
const P = (label: string, src: string) => ({
  label,
  notes: src.trim().split(/\s*\|\s*/).map(tok => {
    const [s, d, syl] = tok.split(/\s+/)
    return { s: s === '-' ? null : +s, d: +d, syl }
  }),
})

// До=0 Ре=2 Ми=4 Фа=5 Соль=7 Ля=9 Си=11; нижняя соль = −5
export const SONGS: Song[] = [
  {
    id: 'brother-jacob', title: tr('Братец Яков'), sub: tr('Французская народная, канон'), level: 1, bpm: 96, meter: 4,
    phrases: [
      P(tr('Братец Яков'), tr('0 1 Бра | 2 1 тец | 4 1 Я | 0 1 ков | 0 1 бра | 2 1 тец | 4 1 Я | 0 1 ков')),
      P(tr('Спишь ли ты'), tr('4 1 спишь | 5 1 ли | 7 2 ты | 4 1 спишь | 5 1 ли | 7 2 ты')),
      P(tr('Звонят колокола'), tr('7 0.5 Зво | 9 0.5 нят | 7 0.5 ко | 5 0.5 ло | 4 1 ко | 0 1 ла | 7 0.5 зво | 9 0.5 нят | 7 0.5 ко | 5 0.5 ло | 4 1 ко | 0 1 ла')),
      P(tr('Бим-бом-бом'), tr('0 1 Бим | -5 1 бом | 0 2 бом | 0 1 бим | -5 1 бом | 0 2 бом')),
    ],
  },
  {
    id: 'twinkle', title: 'Twinkle, Twinkle', sub: tr('Мелодия «Ах, скажу я вам, мама», XVIII век'), level: 1, bpm: 92, meter: 4,
    phrases: [
      P(tr('Начало'), '0 1 Twin | 0 1 kle | 7 1 twin | 7 1 kle | 9 1 lit | 9 1 tle | 7 2 star'),
      P(tr('Спуск'), '5 1 how | 5 1 I | 4 1 won | 4 1 der | 2 1 what | 2 1 you | 0 2 are'),
      P(tr('Середина'), '7 1 up | 7 1 a | 5 1 bove | 5 1 the | 4 1 world | 4 1 so | 2 2 high'),
      P(tr('Середина 2'), '7 1 like | 7 1 a | 5 1 dia | 5 1 mond | 4 1 in | 4 1 the | 2 2 sky'),
      P(tr('Возврат'), '0 1 Twin | 0 1 kle | 7 1 twin | 7 1 kle | 9 1 lit | 9 1 tle | 7 2 star'),
      P(tr('Финал'), '5 1 how | 5 1 I | 4 1 won | 4 1 der | 2 1 what | 2 1 you | 0 2 are'),
    ],
  },
  {
    id: 'birthday', title: 'Happy Birthday', sub: tr('Сёстры Хилл, 1893 · «С днём рождения»'), level: 2, bpm: 100, meter: 3,
    phrases: [
      P(tr('Первая строка'), '-5 0.75 Hap | -5 0.25 py | -3 1 birth | -5 1 day | 0 1 to | -1 2 you | - 1'),
      P(tr('Вторая строка'), '-5 0.75 Hap | -5 0.25 py | -3 1 birth | -5 1 day | 2 1 to | 0 2 you | - 1'),
      P(tr('Вершина'), '-5 0.75 Hap | -5 0.25 py | 7 1 birth | 4 1 day | 0 1 dear | -1 1 ~ | -3 2 friend | - 1'),
      P(tr('Финал'), '5 0.75 Hap | 5 0.25 py | 4 1 birth | 0 1 day | 2 1 to | 0 2 you | - 1'),
    ],
  },
  {
    id: 'ode-to-joy', title: tr('Ода к радости'), sub: tr('Бетховен, Девятая симфония, 1824'), level: 2, bpm: 104, meter: 4,
    phrases: [
      P('Freude, schöner', '4 1 Freu | 4 1 de | 5 1 schö | 7 1 ner | 7 1 Göt | 5 1 ter | 4 1 fun | 2 1 ken'),
      P('Tochter aus Elysium', '0 1 Toch | 0 1 ter | 2 1 aus | 4 1 E | 4 1.5 ly | 2 0.5 si | 2 2 um'),
      P('Wir betreten', '4 1 Wir | 4 1 be | 5 1 tre | 7 1 ten | 7 1 feu | 5 1 er | 4 1 trun | 2 1 ken'),
      P('Himmlische, dein Heiligtum', '0 1 Himm | 0 1 li | 2 1 sche | 4 1 dein | 2 1.5 Hei | 0 0.5 lig | 0 2 tum'),
    ],
  },
  {
    id: 'amazing-grace', title: 'Amazing Grace', sub: tr('Гимн, Джон Ньютон, 1779'), level: 3, bpm: 84, meter: 3,
    phrases: [
      P('Amazing grace', '-5 1 A | 0 2 ma | 4 0.5 zing | 0 0.5 ~ | 4 2 grace | 2 1 how | 0 2 sweet | -3 1 the | -5 3 sound'),
      P('That saved a wretch', '-5 1 That | 0 2 saved | 4 0.5 a | 0 0.5 ~ | 4 2 wretch | 2 1 like | 7 3 me'),
      P('Was blind', '-5 1 Was | 0 2 blind | 4 0.5 but | 0 0.5 ~ | 4 2 now | 2 1 I | 0 3 see'),
    ],
  },
]

export const LEVEL_TEXT = ['', tr('Для начала'), tr('Средне'), tr('Широкий диапазон')] as const

/** Диапазон песни в полутонах от тоники */
export function songSpan(s: Song) {
  const ms = s.phrases.flatMap(p => p.notes).flatMap(n => (n.s == null ? [] : [n.s]))
  return { lo: Math.min(...ms), hi: Math.max(...ms) }
}

import { lang, tr } from '../lib/i18n'
/** Нота упражнения: ступень в полутонах от тоники, длительность в долях */
export type ExNote = { s: number; d: number; syl?: string; glide?: number; stacc?: boolean; rest?: boolean }

export type Section = 'warmup' | 'calm' | 'modes' | 'mix' | 'belt' | 'agility'

export type Exercise = {
  id: string
  title: string
  section: Section
  level: 1 | 2 | 3
  syllable: string
  goal: string
  bpm: number
  notes: ExNote[]
  how?: string[]
  mistakes?: string[]
}

export const SECTIONS: Record<Section, { title: string; text: string }> = {
  warmup: { title: tr('Разогрев'), text: tr('Трели, мычание, сирены: будим голос без нагрузки') },
  calm: { title: tr('Спокойный звук'), text: tr('Мягкая атака и связное пение, база для любого голоса') },
  mix: { title: tr('Микст'), text: tr('Соединяем грудной и головной регистры') },
  belt: { title: tr('Бэлтинг'), text: tr('Звонкий, сильный верх без крика') },
  agility: { title: tr('Подвижность'), text: tr('Стаккато, пассажи и мелизмы') },
  modes: { title: tr('Режимы голоса (CVT)'), text: tr('Нейтраль, плач, форсаж, острый и твэнг — по методике Complete Vocal Technique. Громкие режимы — только после разогрева и без боли.') },
}

/**
 * Компактная запись паттерна: "0 2 4 5 7" — ступени через пробел.
 * Суффиксы: ":2" — длительность в долях, "." — стаккато, "~7" — глиссандо до ступени 7, "r" — пауза.
 * Слоги можно дать списком через «‑» (по нотам) или одним слогом на все.
 */
export function p(src: string, d = 1, syl = ''): ExNote[] {
  const syls = syl.includes('‑') ? syl.split('‑') : null
  return src.trim().split(/\s+/).map((tok, i) => {
    const [body, dur] = tok.split(':')
    const nd = dur ? +dur : d
    if (body === 'r') return { s: 0, d: nd, rest: true }
    const stacc = body.endsWith('.')
    const core = stacc ? body.slice(0, -1) : body
    const [a, b] = core.split('~')
    return { s: +a, d: nd, syl: syls ? syls[i % syls.length] : syl, glide: b != null ? +b : undefined, stacc }
  })
}

export const EXERCISES: Exercise[] = [
  // Разогрев
  { id: 'lip-trill-5', title: tr('Губная трель, пять нот'), section: 'warmup', level: 1, syllable: tr('бррр'), bpm: 100,
    goal: tr('Ровный поток воздуха без зажима'), notes: p('0 2 4 5 7 5 4 2 0:2', 0.5, tr('брр')) },
  { id: 'trill-siren', title: tr('Трель-сирена'), section: 'warmup', level: 1, syllable: tr('бррр'), bpm: 80,
    goal: tr('Связать регистры плавным скольжением'), notes: p('0~12:3 12~0:3', 3, tr('брр')) },
  { id: 'hum', title: tr('Мычание'), section: 'warmup', level: 1, syllable: tr('мм'), bpm: 90,
    goal: tr('Найти вибрацию в передней части лица'), notes: p('0 4 7 4 0:2', 1, tr('мм')) },
  { id: 'straw', title: tr('Трубочка'), section: 'warmup', level: 1, syllable: tr('у'), bpm: 80,
    goal: tr('Разгрузить связки сопротивлением выдоху'), notes: p('0~7:2 7~0:2', 2, tr('у')) },
  { id: 'lazy-sigh', title: tr('Ленивый вздох'), section: 'warmup', level: 1, syllable: tr('ха'), bpm: 80,
    goal: tr('Снять напряжение гортани'), notes: p('7~0:3', 3, tr('ха')) },
  { id: 'yawn-sigh', title: tr('Зевок-вздох'), section: 'warmup', level: 1, syllable: tr('оу'), bpm: 80,
    goal: tr('Опустить гортань и открыть глотку'), notes: p('12~0:3', 3, tr('оу')) },
  { id: 'tongue-trill', title: tr('Языковая трель'), section: 'warmup', level: 2, syllable: tr('ррр'), bpm: 100,
    goal: tr('Освободить корень языка'), notes: p('0 4 7 12 7 4 0:2', 0.5, tr('рр')) },
  { id: 'ng-siren', title: tr('«Нг»-сирена'), section: 'warmup', level: 2, syllable: tr('нг'), bpm: 80,
    goal: tr('Мягкий головной звук через переходные ноты'), notes: p('0~12:3 12~0:3', 3, tr('нг')) },

  // Спокойный звук
  { id: 'mu-triad', title: tr('Трезвучие «Му»'), section: 'calm', level: 1, syllable: tr('му'), bpm: 90,
    goal: tr('Мягкая атака, округлый гласный'), notes: p('0 4 7 4 0:2', 1, tr('му')) },
  { id: 'five-vowels', title: tr('Пять гласных на одной ноте'), section: 'calm', level: 1, syllable: tr('ми‑мэ‑ма‑мо‑му'), bpm: 90,
    goal: tr('Ровный тембр при смене гласных'), notes: p('0 0 0 0 0:2', 1, tr('ми‑мэ‑ма‑мо‑му')) },
  { id: 'hi-pulses', title: tr('Толчки «Хи»'), section: 'calm', level: 1, syllable: tr('хи'), bpm: 100,
    goal: tr('Порционная подача воздуха'), notes: p('0. 0. 0. 0. 0.', 1, tr('хи')) },
  { id: 'scale-9', title: tr('Гамма на октаву'), section: 'calm', level: 2, syllable: tr('а'), bpm: 110,
    goal: tr('Октава legato на одном дыхании'), notes: p('0 2 4 5 7 9 11 12 11 9 7 5 4 2 0:2', 0.5, tr('а')) },
  { id: 'octave-lift', title: tr('Октавный лифт'), section: 'calm', level: 2, syllable: tr('ю'), bpm: 100,
    goal: tr('Брать верх сверху, без подъезда'), notes: p('0 12 11 9 7 5 4 2 0:2', 0.5, tr('ю')) },
  { id: 'dome', title: tr('Широкий купол'), section: 'calm', level: 2, syllable: tr('о'), bpm: 90,
    goal: tr('Широкие интервалы без толчка'), notes: p('0 7 12 7 0:2', 1, tr('о')) },
  { id: 'messa', title: tr('Филировка'), section: 'calm', level: 3, syllable: tr('а'), bpm: 70,
    goal: tr('Тихо → громко → тихо на одной ноте'), notes: p('0:4 r:1 0:4', 4, tr('а')) },
  { id: 'question-answer', title: tr('Вопрос и ответ'), section: 'calm', level: 2, syllable: lang === 'en' ? 'la' : 'ля', bpm: 100,
    goal: tr('Фразировка и мелодическая логика'), notes: p('0 4 7 9 7:2 r 7 4 2 0:2', 1, lang === 'en' ? 'la' : 'ля') },

  // Микст
  { id: 'nay', title: tr('Нэй-нэй'), section: 'mix', level: 2, syllable: tr('нэй'), bpm: 110,
    goal: tr('Яркость без форсирования через переход'), notes: p('0 4 7 12 7 4 0:2', 0.5, tr('нэй')) },
  { id: 'gug', title: tr('Гуг'), section: 'mix', level: 2, syllable: tr('гуг'), bpm: 100,
    goal: tr('Стабильная гортань на верхних нотах'), notes: p('0 4 7 4 0:2', 0.5, tr('гуг')) },
  { id: 'mam', title: tr('Мам-мам'), section: 'mix', level: 2, syllable: tr('мам'), bpm: 110,
    goal: tr('Носовой резонанс в миксте'), notes: p('0 2 4 5 7 5 4 2 0:2', 0.5, tr('мам')) },
  { id: 'vai', title: tr('Вай'), section: 'mix', level: 2, syllable: tr('вай'), bpm: 110,
    goal: tr('Плавная смена гласного на верху'), notes: p('0 4 7 12 7 4 0:2', 0.5, tr('вай')) },
  { id: 'nu', title: tr('Ну-ну'), section: 'mix', level: 2, syllable: tr('ну'), bpm: 110,
    goal: tr('Узкий гласный для перехода'), notes: p('0 7 4 12 7 4 0:2', 0.5, tr('ну')) },
  { id: 'whimper', title: tr('Хныканье'), section: 'mix', level: 2, syllable: tr('нье'), bpm: 80,
    goal: tr('«Плачущий» тембр, плотное смыкание'), notes: p('7~0:3', 3, tr('нье')) },
  { id: 'octave-jump', title: tr('Октавный скачок'), section: 'mix', level: 3, syllable: tr('ги'), bpm: 90,
    goal: tr('Скачок в головной регистр без срыва'), notes: p('0 12 0:2', 1, tr('ги')) },
  { id: 'penta', title: tr('Пентатоника'), section: 'mix', level: 3, syllable: tr('да'), bpm: 90,
    goal: tr('Подвижность и точность в миксте'), notes: p('0 2 4 7 9 12 9 7 4 2 0:1', 0.25, tr('да')) },

  // Бэлтинг
  { id: 'ey', title: tr('Эй-эй'), section: 'belt', level: 2, syllable: tr('эй'), bpm: 100,
    goal: tr('Речевая подача на высоте'), notes: p('0 4 7 4 0:2', 1, tr('эй')) },
  { id: 'ye', title: tr('Йе!'), section: 'belt', level: 2, syllable: tr('йе'), bpm: 100,
    goal: tr('Звонкая открытая атака'), notes: p('0 4 7:3', 1, tr('йе')) },
  { id: 'no', title: tr('Радостное «нет»'), section: 'belt', level: 2, syllable: tr('нет'), bpm: 100,
    goal: tr('Плотный речевой звук без крика'), notes: p('7 4 0:2', 1, tr('нет')) },
  { id: 'lion', title: tr('Голодный лев'), section: 'belt', level: 3, syllable: tr('ня'), bpm: 90,
    goal: tr('Яркий верх и широкая глотка'), notes: p('0 7 12 7 0:2', 1, tr('ня')) },
  { id: 'high-vowels', title: tr('Пять гласных на верху'), section: 'belt', level: 3, syllable: tr('эй‑и‑а‑о‑у'), bpm: 90,
    goal: tr('Звонкость на всех гласных'), notes: p('7 7 7 7 7:2', 1, tr('эй‑и‑а‑о‑у')) },
  { id: 'swing', title: tr('Динамические качели'), section: 'belt', level: 3, syllable: tr('да'), bpm: 80,
    goal: tr('Громкость без зажима'), notes: p('0:2 4:2 7:4', 2, tr('да')) },

  // Подвижность
  { id: 'stacc-arp', title: tr('Стаккато по арпеджио'), section: 'agility', level: 2, syllable: tr('ха'), bpm: 100,
    goal: tr('Точная атака каждой ноты'), notes: p('0. 4. 7. 12. 7. 4. 0.', 0.5, tr('ха')) },
  { id: 'rossini', title: tr('Гамма Россини'), section: 'agility', level: 3, syllable: tr('а'), bpm: 80,
    goal: tr('Беглость и точность'), notes: p('0 2 4 5 7 9 11 12 14 12 11 9 7 5 4 2 0:1', 0.25, tr('а')) },
  { id: 'jaws-up', title: tr('«Челюсти» вверх'), section: 'agility', level: 2, syllable: tr('а'), bpm: 90,
    goal: tr('Мелкие интервалы и полутона'), notes: p('0 1 0 1 0 2:1', 0.25, tr('а')) },
  { id: 'pendulum', title: tr('Маятник'), section: 'agility', level: 2, syllable: tr('у'), bpm: 90,
    goal: tr('Мелизм вокруг ноты'), notes: p('0 2 0 -1 0:1', 0.25, tr('у')) },
  { id: 'penta-down', title: tr('Пентатонический спуск'), section: 'agility', level: 3, syllable: tr('о'), bpm: 90,
    goal: tr('Классический R&B-ход'), notes: p('12 9 7 4 2 0:1', 0.25, tr('о')) },
  { id: 'wave', title: tr('Волна'), section: 'agility', level: 3, syllable: tr('а'), bpm: 90,
    goal: tr('Длинный мелизм на одном дыхании'), notes: p('0 2 4 2 4 7 4 7 9 7 4 0:1', 0.25, tr('а')) },
  // Режимы CVT (Complete Vocal Technique): от «без металла» к «полному металлу»
  { id: 'cvt-neutral', title: tr('Нейтраль: мягкое «у»'), section: 'modes', level: 1, syllable: tr('у'), bpm: 90,
    goal: tr('Режим без «металла»: мягкий звук, ощущение лёгкости'), notes: p('0 2 4 2 0:2', 1, tr('у')) },
  { id: 'cvt-curbing', title: tr('Плач: «ой»'), section: 'modes', level: 2, syllable: tr('ой'), bpm: 90,
    goal: tr('Полуметалл: хныкающий, сдержанный звук для середины и верха'), notes: p('0 2 4 2 0:2', 1, tr('ой')) },
  { id: 'cvt-overdrive', title: tr('Форсаж: «эй!»'), section: 'modes', level: 3, syllable: tr('эй'), bpm: 90,
    goal: tr('Полный металл, прямой громкий речевой звук без крика'), notes: p('0 4 7:2', 1, tr('эй')) },
  { id: 'cvt-edge', title: tr('Острый: «ня»'), section: 'modes', level: 3, syllable: tr('ня'), bpm: 90,
    goal: tr('Полный металл, резкий яркий звук для самого верха'), notes: p('0 4 7 4 0:2', 1, tr('ня')) },
  { id: 'twang', title: tr('Твэнг: «ня-ня»'), section: 'modes', level: 2, syllable: tr('ня'), bpm: 100,
    goal: tr('Звонкость без громкости: сужение надгортанной воронки (Estill, CVT)'), notes: p('0 0 0 0 0:2', 0.5, tr('ня')) },
  { id: 'straight-vib', title: tr('Прямой тон → вибрато'), section: 'modes', level: 2, syllable: tr('а'), bpm: 60,
    goal: tr('Управлять вибрато: сначала ровно, потом отпустить'), notes: p('0:4 0:4', 4, tr('а')) },
  { id: 'stacc-legato', title: tr('Стаккато-легато'), section: 'agility', level: 2, syllable: tr('ма'), bpm: 100,
    goal: tr('Смена способа звукоизвлечения'), notes: p('0. 4. 7. 12 7 4 0:2', 0.5, tr('ма')) },
]

export const exerciseById = (id: string) => EXERCISES.find(e => e.id === id)

/** Полный охват упражнения по высоте, с учётом глиссандо */
export function span(ex: Exercise) {
  const all = ex.notes.filter(n => !n.rest).flatMap(n => (n.glide != null ? [n.s, n.glide] : [n.s]))
  return { min: Math.min(...all), max: Math.max(...all) }
}

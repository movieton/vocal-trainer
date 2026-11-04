/** Нота упражнения: ступень в полутонах от тоники, длительность в долях */
export type ExNote = { s: number; d: number; syl?: string; glide?: number; stacc?: boolean; rest?: boolean }

export type Section = 'warmup' | 'calm' | 'mix' | 'belt' | 'agility'

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
  warmup: { title: 'Разогрев', text: 'Трели, мычание, сирены: будим голос без нагрузки' },
  calm: { title: 'Спокойный звук', text: 'Мягкая атака и связное пение, база для любого голоса' },
  mix: { title: 'Микст', text: 'Соединяем грудной и головной регистры' },
  belt: { title: 'Бэлтинг', text: 'Звонкий, сильный верх без крика' },
  agility: { title: 'Подвижность', text: 'Стаккато, пассажи и мелизмы' },
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
  { id: 'lip-trill-5', title: 'Губная трель, пять нот', section: 'warmup', level: 1, syllable: 'бррр', bpm: 100,
    goal: 'Ровный поток воздуха без зажима', notes: p('0 2 4 5 7 5 4 2 0:2', 0.5, 'брр') },
  { id: 'trill-siren', title: 'Трель-сирена', section: 'warmup', level: 1, syllable: 'бррр', bpm: 80,
    goal: 'Связать регистры плавным скольжением', notes: p('0~12:3 12~0:3', 3, 'брр') },
  { id: 'hum', title: 'Мычание', section: 'warmup', level: 1, syllable: 'мм', bpm: 90,
    goal: 'Найти вибрацию в передней части лица', notes: p('0 4 7 4 0:2', 1, 'мм') },
  { id: 'straw', title: 'Трубочка', section: 'warmup', level: 1, syllable: 'у', bpm: 80,
    goal: 'Разгрузить связки сопротивлением выдоху', notes: p('0~7:2 7~0:2', 2, 'у') },
  { id: 'lazy-sigh', title: 'Ленивый вздох', section: 'warmup', level: 1, syllable: 'ха', bpm: 80,
    goal: 'Снять напряжение гортани', notes: p('7~0:3', 3, 'ха') },
  { id: 'yawn-sigh', title: 'Зевок-вздох', section: 'warmup', level: 1, syllable: 'оу', bpm: 80,
    goal: 'Опустить гортань и открыть глотку', notes: p('12~0:3', 3, 'оу') },
  { id: 'tongue-trill', title: 'Языковая трель', section: 'warmup', level: 2, syllable: 'ррр', bpm: 100,
    goal: 'Освободить корень языка', notes: p('0 4 7 12 7 4 0:2', 0.5, 'рр') },
  { id: 'ng-siren', title: '«Нг»-сирена', section: 'warmup', level: 2, syllable: 'нг', bpm: 80,
    goal: 'Мягкий головной звук через переходные ноты', notes: p('0~12:3 12~0:3', 3, 'нг') },

  // Спокойный звук
  { id: 'mu-triad', title: 'Трезвучие «Му»', section: 'calm', level: 1, syllable: 'му', bpm: 90,
    goal: 'Мягкая атака, округлый гласный', notes: p('0 4 7 4 0:2', 1, 'му') },
  { id: 'five-vowels', title: 'Пять гласных на одной ноте', section: 'calm', level: 1, syllable: 'ми‑мэ‑ма‑мо‑му', bpm: 90,
    goal: 'Ровный тембр при смене гласных', notes: p('0 0 0 0 0:2', 1, 'ми‑мэ‑ма‑мо‑му') },
  { id: 'hi-pulses', title: 'Толчки «Хи»', section: 'calm', level: 1, syllable: 'хи', bpm: 100,
    goal: 'Порционная подача воздуха', notes: p('0. 0. 0. 0. 0.', 1, 'хи') },
  { id: 'scale-9', title: 'Гамма на октаву', section: 'calm', level: 2, syllable: 'а', bpm: 110,
    goal: 'Октава legato на одном дыхании', notes: p('0 2 4 5 7 9 11 12 11 9 7 5 4 2 0:2', 0.5, 'а') },
  { id: 'octave-lift', title: 'Октавный лифт', section: 'calm', level: 2, syllable: 'ю', bpm: 100,
    goal: 'Брать верх сверху, без подъезда', notes: p('0 12 11 9 7 5 4 2 0:2', 0.5, 'ю') },
  { id: 'dome', title: 'Широкий купол', section: 'calm', level: 2, syllable: 'о', bpm: 90,
    goal: 'Широкие интервалы без толчка', notes: p('0 7 12 7 0:2', 1, 'о') },
  { id: 'messa', title: 'Филировка', section: 'calm', level: 3, syllable: 'а', bpm: 70,
    goal: 'Тихо → громко → тихо на одной ноте', notes: p('0:4 r:1 0:4', 4, 'а') },
  { id: 'question-answer', title: 'Вопрос и ответ', section: 'calm', level: 2, syllable: 'ля', bpm: 100,
    goal: 'Фразировка и мелодическая логика', notes: p('0 4 7 9 7:2 r 7 4 2 0:2', 1, 'ля') },

  // Микст
  { id: 'nay', title: 'Нэй-нэй', section: 'mix', level: 2, syllable: 'нэй', bpm: 110,
    goal: 'Яркость без форсирования через переход', notes: p('0 4 7 12 7 4 0:2', 0.5, 'нэй') },
  { id: 'gug', title: 'Гуг', section: 'mix', level: 2, syllable: 'гуг', bpm: 100,
    goal: 'Стабильная гортань на верхних нотах', notes: p('0 4 7 4 0:2', 0.5, 'гуг') },
  { id: 'mam', title: 'Мам-мам', section: 'mix', level: 2, syllable: 'мам', bpm: 110,
    goal: 'Носовой резонанс в миксте', notes: p('0 2 4 5 7 5 4 2 0:2', 0.5, 'мам') },
  { id: 'vai', title: 'Вай', section: 'mix', level: 2, syllable: 'вай', bpm: 110,
    goal: 'Плавная смена гласного на верху', notes: p('0 4 7 12 7 4 0:2', 0.5, 'вай') },
  { id: 'nu', title: 'Ну-ну', section: 'mix', level: 2, syllable: 'ну', bpm: 110,
    goal: 'Узкий гласный для перехода', notes: p('0 7 4 12 7 4 0:2', 0.5, 'ну') },
  { id: 'whimper', title: 'Хныканье', section: 'mix', level: 2, syllable: 'нье', bpm: 80,
    goal: '«Плачущий» тембр, плотное смыкание', notes: p('7~0:3', 3, 'нье') },
  { id: 'octave-jump', title: 'Октавный скачок', section: 'mix', level: 3, syllable: 'ги', bpm: 90,
    goal: 'Скачок в головной регистр без срыва', notes: p('0 12 0:2', 1, 'ги') },
  { id: 'penta', title: 'Пентатоника', section: 'mix', level: 3, syllable: 'да', bpm: 90,
    goal: 'Подвижность и точность в миксте', notes: p('0 2 4 7 9 12 9 7 4 2 0:1', 0.25, 'да') },

  // Бэлтинг
  { id: 'ey', title: 'Эй-эй', section: 'belt', level: 2, syllable: 'эй', bpm: 100,
    goal: 'Речевая подача на высоте', notes: p('0 4 7 4 0:2', 1, 'эй') },
  { id: 'ye', title: 'Йе!', section: 'belt', level: 2, syllable: 'йе', bpm: 100,
    goal: 'Звонкая открытая атака', notes: p('0 4 7:3', 1, 'йе') },
  { id: 'no', title: 'Радостное «нет»', section: 'belt', level: 2, syllable: 'нет', bpm: 100,
    goal: 'Плотный речевой звук без крика', notes: p('7 4 0:2', 1, 'нет') },
  { id: 'lion', title: 'Голодный лев', section: 'belt', level: 3, syllable: 'ня', bpm: 90,
    goal: 'Яркий верх и широкая глотка', notes: p('0 7 12 7 0:2', 1, 'ня') },
  { id: 'high-vowels', title: 'Пять гласных на верху', section: 'belt', level: 3, syllable: 'эй‑и‑а‑о‑у', bpm: 90,
    goal: 'Звонкость на всех гласных', notes: p('7 7 7 7 7:2', 1, 'эй‑и‑а‑о‑у') },
  { id: 'swing', title: 'Динамические качели', section: 'belt', level: 3, syllable: 'да', bpm: 80,
    goal: 'Громкость без зажима', notes: p('0:2 4:2 7:4', 2, 'да') },

  // Подвижность
  { id: 'stacc-arp', title: 'Стаккато по арпеджио', section: 'agility', level: 2, syllable: 'ха', bpm: 100,
    goal: 'Точная атака каждой ноты', notes: p('0. 4. 7. 12. 7. 4. 0.', 0.5, 'ха') },
  { id: 'rossini', title: 'Гамма Россини', section: 'agility', level: 3, syllable: 'а', bpm: 80,
    goal: 'Беглость и точность', notes: p('0 2 4 5 7 9 11 12 14 12 11 9 7 5 4 2 0:1', 0.25, 'а') },
  { id: 'jaws-up', title: '«Челюсти» вверх', section: 'agility', level: 2, syllable: 'а', bpm: 90,
    goal: 'Мелкие интервалы и полутона', notes: p('0 1 0 1 0 2:1', 0.25, 'а') },
  { id: 'pendulum', title: 'Маятник', section: 'agility', level: 2, syllable: 'у', bpm: 90,
    goal: 'Мелизм вокруг ноты', notes: p('0 2 0 -1 0:1', 0.25, 'у') },
  { id: 'penta-down', title: 'Пентатонический спуск', section: 'agility', level: 3, syllable: 'о', bpm: 90,
    goal: 'Классический R&B-ход', notes: p('12 9 7 4 2 0:1', 0.25, 'о') },
  { id: 'wave', title: 'Волна', section: 'agility', level: 3, syllable: 'а', bpm: 90,
    goal: 'Длинный мелизм на одном дыхании', notes: p('0 2 4 2 4 7 4 7 9 7 4 0:1', 0.25, 'а') },
  { id: 'stacc-legato', title: 'Стаккато-легато', section: 'agility', level: 2, syllable: 'ма', bpm: 100,
    goal: 'Смена способа звукоизвлечения', notes: p('0. 4. 7. 12 7 4 0:2', 0.5, 'ма') },
]

export const exerciseById = (id: string) => EXERCISES.find(e => e.id === id)

/** Полный охват упражнения по высоте, с учётом глиссандо */
export function span(ex: Exercise) {
  const all = ex.notes.filter(n => !n.rest).flatMap(n => (n.glide != null ? [n.s, n.glide] : [n.s]))
  return { min: Math.min(...all), max: Math.max(...all) }
}

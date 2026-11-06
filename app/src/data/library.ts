import { lang, tr } from '../lib/i18n'
import rawRu from './library.json'
import rawEn from './library.en.json'

const raw = lang === 'en' ? rawEn : rawRu
import { p, type Exercise, type Section } from './exercises'

/** Карточка библиотеки из research/catalog-*.md (собирается scripts/build_library.py) */
export type LibItem = {
  id: string; title: string; kind: 'breath' | 'vocal' | 'diction'; cat: string
  goal: string; how: string[]; mistakes: string[]; dose: string
  evidence: 'И' | 'Ш' | 'П' | 'Т'; level: number; source: string; urls: string[]; illustration: string
  notes?: string; bpm?: number; syllable?: string; notesHint?: string
}

export const LIBRARY = raw as LibItem[]
export const libItem = (id: string) => LIBRARY.find(i => i.id === id)

/** Темы библиотеки: на что направлено упражнение */
export const TOPICS = [
  { id: 'warmup', title: tr('Разогрев'), cats: ['разогрев'] },
  { id: 'sound', title: tr('Звук и атака'), cats: ['атака', 'спокойный звук', 'динамика', 'вибрато', 'резонанс и гласные'] },
  { id: 'registers', title: tr('Регистры и диапазон'), cats: ['регистры', 'диапазон', 'cvt'] },
  { id: 'agility', title: tr('Подвижность и бельканто'), cats: ['подвижность', 'бельканто'] },
  { id: 'breath', title: tr('Дыхание и осанка'), cats: ['дыхание', 'осанка'] },
  { id: 'relax', title: tr('Расслабление и тело'), cats: ['расслабление', 'разминка тела', 'заминка'] },
  { id: 'diction', title: tr('Дикция'), cats: ['артикуляция', 'дикция', 'скороговорка'] },
  { id: 'health', title: tr('Здоровье голоса'), cats: ['гигиена'] },
] as const
export type TopicId = typeof TOPICS[number]['id']
export const topicOf = (i: LibItem): TopicId => TOPICS.find(t => (t.cats as readonly string[]).includes(i.cat))?.id ?? 'warmup'

const SECTION_OF: Record<string, Section> = { разогрев: 'warmup', регистры: 'mix', диапазон: 'mix', cvt: 'modes', подвижность: 'agility', бельканто: 'agility' }

/** Вокальная карточка с нотами — как упражнение для нотной доски */
export function libExercise(id: string): Exercise | undefined {
  const i = libItem(id)
  if (!i?.notes) return
  return {
    id: i.id, title: i.title, section: SECTION_OF[i.cat] ?? 'calm', level: Math.min(3, Math.max(1, i.level)) as 1 | 2 | 3,
    syllable: i.syllable ?? tr('а'), goal: i.goal, bpm: i.bpm ?? 70, notes: p(i.notes, 1, i.syllable ?? tr('а')), how: i.how, mistakes: i.mistakes,
  }
}

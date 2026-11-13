import { tr } from './i18n'
import { noteName } from './music'
import {
  DEFAULT_SKILL_PROFILE,
  normalizeGoals,
  normalizeSkillProfile,
  problemNotes,
  type Goal,
  type PlanFocus,
  type PlanMode,
  type SessionLog,
  type SkillProfile,
} from './store'

export type Domain = 'vocal' | 'breath' | 'ear' | 'range' | 'write'

export const DOMAIN_META: Record<Domain, { label: string }> = {
  vocal: { label: tr('Вокал') },
  breath: { label: tr('Опора') },
  range: { label: tr('Диапазон') },
  ear: { label: tr('Слух') },
  write: { label: tr('Сочинение') },
}

export const GOAL_LABEL: Record<Goal, string> = {
  pitch: tr('Чистые ноты'),
  range: tr('Диапазон'),
  ear: tr('Слух'),
  breath: tr('Дыхание'),
  write: tr('Сочинение'),
}

export type DayPlanStep = {
  min: number
  title: string
  text: string
  to: string
  id: string
  domain: Domain
}

export type DayPlanInput = {
  log: SessionLog[]
  goals?: unknown
  legacyGoal?: Goal
  minutes: number
  skillProfile?: unknown
  planMode?: PlanMode
  planFocus?: PlanFocus
  dayNumber?: number
  weekday?: number
  todayStr?: string
}

export type DayPlanResult = {
  steps: DayPlanStep[]
  goals: Goal[]
  mode: PlanMode
  focusGoal: Goal | null
  overloadProtected: boolean
  skillProfile: SkillProfile
}

const BREATH_ROT: [string, string][] = [
  ['hiss-metro', tr('Шипящий метроном')],
  ['horizon', tr('Апподжио «Горизонт»')],
  ['candle', tr('Свеча')],
  ['long-s', tr('Длинное «с»')],
]
const WARM_ROT: [string, string][] = [
  ['lip-trill-5', tr('Губная трель')],
  ['trill-siren', tr('Трель-сирена')],
  ['hum', tr('Мычание')],
  ['ng-siren', tr('«Нг»-сирена')],
]
const CALM_ROT: [string, string][] = [
  ['mu-triad', tr('Трезвучие «Му»')],
  ['five-vowels', tr('Пять гласных')],
  ['scale-9', tr('Гамма на октаву')],
  ['octave-lift', tr('Октавный лифт')],
]
const BASE_VOCAL_BLOCKS: [string, string, string][] = [
  [tr('Микст'), 'nay', tr('Нэй-нэй')],
  [tr('Бэлтинг'), 'ey', tr('Эй-эй')],
  [tr('Подвижность'), 'stacc-arp', tr('Стаккато по арпеджио')],
  [tr('Микст'), 'gug', tr('Гуг')],
  [tr('Спокойный звук'), 'dome', tr('Широкий купол')],
  [tr('Подвижность'), 'penta-down', tr('Пентатонический спуск')],
  [tr('Микст'), 'octave-jump', tr('Октавный скачок')],
]
const GENTLE_VOCAL_BLOCKS: [string, string, string][] = [
  [tr('Спокойный звук'), 'straw', tr('Трубочка')],
  [tr('Разогрев'), 'lazy-sigh', tr('Ленивый вздох')],
  [tr('Спокойный звук'), 'dome', tr('Широкий купол')],
  [tr('Микст'), 'nay', tr('Нэй-нэй')],
  [tr('Спокойный звук'), 'yawn-sigh', tr('Зевок-вздох')],
  [tr('Микст'), 'gug', tr('Гуг')],
  [tr('Разогрев'), 'mu-triad', tr('Трезвучие «Му»')],
]
const RANGE_GENTLE: [string, string][] = [
  ['ng-siren', tr('«Нг»-сирена')],
  ['trill-siren', tr('Трель-сирена')],
  ['octave-lift', tr('Октавный лифт')],
]
const RANGE_BASE: [string, string][] = [
  ['ng-siren', tr('«Нг»-сирена')],
  ['octave-lift', tr('Октавный лифт')],
  ['trill-siren', tr('Трель-сирена')],
  ['octave-jump', tr('Октавный скачок')],
]
const EAR_GENTLE: [string, string, string][] = [
  ['/ear/match', 'pitch-match', tr('Попади в одну ноту')],
  ['/ear/keys?g=find', 'keys-find', tr('Найди ноту на клавиатуре')],
  ['/ear/intervals', 'intervals', tr('Узнай интервал')],
  ['/ear/levels', 'level-', tr('10 уровней точности')],
]
const EAR_BASE: [string, string, string][] = [
  ['/ear/levels', 'level-', tr('10 уровней точности')],
  ['/ear/sing-interval', 'sing-interval', tr('Интервалы голосом')],
  ['/ear/scales', 'scale-sing', tr('Гаммы с аккомпанементом')],
  ['/ear/chords', 'chord-sing', tr('Пение над аккордами')],
  ['/ear/melody', 'melody', tr('Повтори мелодию')],
  ['/ear/dictation', 'dictation', tr('Мелодический диктант')],
  ['/ear/degrees', 'degrees', tr('Ступени на слух')],
]

const pick = <T,>(a: T[], idx: number) => a[((idx % a.length) + a.length) % a.length]

function dedup(steps: DayPlanStep[]): DayPlanStep[] {
  const seen = new Set<string>()
  const out: DayPlanStep[] = []
  for (const s of steps) {
    if (seen.has(s.to)) continue
    seen.add(s.to)
    out.push(s)
  }
  return out
}

function makePools(log: SessionLog[], skill: SkillProfile, d: number, w: number) {
  const avg = (k: SessionLog['kind']) => {
    const x = log.filter(l => l.kind === k).slice(0, 10)
    return x.length ? x.reduce((a, l) => a + l.score, 0) / x.length : null
  }
  const earAvg = avg('ear')
  const singAvg = avg('exercise')
  const earWeak = earAvg != null && singAvg != null && earAvg < singAvg - 10
  const weak = problemNotes(log)[0]

  const [b1, b1t] = pick(BREATH_ROT, d)
  const [b2, b2t] = pick(BREATH_ROT, d + 2)
  const [wId, wT] = pick(WARM_ROT, d + 1)
  const [cId, cT] = pick(CALM_ROT, d + 2)
  const [bName, bId, bEx] = (skill.vocal === 'base' ? BASE_VOCAL_BLOCKS : GENTLE_VOCAL_BLOCKS)[w % 7]

  const rangePool = skill.vocal === 'base' ? RANGE_BASE : RANGE_GENTLE
  const [r1, r1t] = pick(rangePool, d)
  const [r2, r2t] = pick(rangePool, d + 1)

  const earPool = skill.ear === 'base' ? EAR_BASE : EAR_GENTLE
  const [e1To, e1Id, e1T] = earWeak && skill.ear === 'base'
    ? ['/ear/levels', 'level-', tr('10 уровней точности')]
    : pick(earPool, d)
  const [e2To, e2Id, e2T] = pick(earPool, d + 1)
  const [e3To, e3Id, e3T] = pick(earPool, d + 2)

  const breath1: DayPlanStep = { min: 2, title: tr('Дыхание'), text: b1t, to: `/breath/${b1}`, id: b1, domain: 'breath' }
  const breath2: DayPlanStep = { min: 4, title: tr('Опора и выдох'), text: b2t, to: `/breath/${b2}`, id: b2, domain: 'breath' }
  const longNote: DayPlanStep = { min: 3, title: tr('Длинная нота'), text: tr('Удержание ровной ноты на выдохе'), to: '/breath/long-note', id: 'long-note', domain: 'breath' }
  const warmup: DayPlanStep = { min: 3, title: tr('Разогрев'), text: wT, to: `/ex/${wId}`, id: wId, domain: 'vocal' }
  const calmOrWeak: DayPlanStep = weak
    ? {
        min: 3,
        title: tr('Твоя трудная нота'),
        text: tr('{0}: {1} на {2} ц — длинная нота', noteName(weak.m), weak.c > 0 ? tr('завышаешь') : tr('занижаешь'), Math.round(Math.abs(weak.c))),
        to: `/breath/long-note?note=${weak.m}`,
        id: 'long-note',
        domain: 'vocal',
      }
    : { min: 3, title: tr('Спокойный звук'), text: cT, to: `/ex/${cId}`, id: cId, domain: 'vocal' }
  const vocalBlock: DayPlanStep = {
    min: earWeak ? 3 : 4,
    title: tr('Блок дня: {0}', bName.toLowerCase()),
    text: bEx,
    to: `/ex/${bId}`,
    id: bId,
    domain: 'vocal',
  }
  const range1: DayPlanStep = { min: 4, title: tr('Диапазон'), text: r1t, to: `/ex/${r1}`, id: r1, domain: 'range' }
  const range2: DayPlanStep = { min: 3, title: tr('Расширение'), text: r2t, to: `/ex/${r2}`, id: r2, domain: 'range' }
  const ear1: DayPlanStep = { min: earWeak ? 4 : 3, title: earWeak ? tr('Слух — слабое место') : tr('Слух'), text: e1T, to: e1To, id: e1Id, domain: 'ear' }
  const ear2: DayPlanStep = { min: 3, title: tr('Тренировка слуха'), text: e2T, to: e2To, id: e2Id, domain: 'ear' }
  const ear3: DayPlanStep = { min: 3, title: tr('Слух и память'), text: e3T, to: e3To, id: e3Id, domain: 'ear' }
  const compose: DayPlanStep = { min: 4, title: tr('Сочинение'), text: tr('Набросай 4 такта мелодии над гармонией'), to: '/compose', id: 'compose', domain: 'write' }
  const writeEar: DayPlanStep = { min: 3, title: tr('Гармония и слух'), text: tr('Квинтовый круг и модуляции'), to: '/ear/circle', id: 'circle', domain: 'ear' }

  return { breath1, breath2, longNote, warmup, calmOrWeak, vocalBlock, range1, range2, ear1, ear2, ear3, compose, writeEar }
}

function buildFocusedPlan(goal: Goal, log: SessionLog[], skill: SkillProfile, minutes: number, d: number, w: number): DayPlanStep[] {
  const p = makePools(log, skill, d, w)
  let seq: DayPlanStep[]
  switch (goal) {
    case 'range':
      seq = minutes <= 5
        ? [{ ...p.warmup, min: 2 }, { ...p.range1, min: 3 }]
        : minutes <= 10
          ? [p.breath1, { ...p.warmup, min: 3 }, { ...p.range1, min: 5 }]
          : [p.breath1, p.warmup, p.range1, p.calmOrWeak, p.range2]
      break
    case 'ear':
      seq = minutes <= 5
        ? [{ ...p.warmup, min: 2 }, { ...p.ear1, min: 3 }]
        : minutes <= 10
          ? [{ ...p.warmup, min: 2 }, { ...p.ear1, min: 4 }, { ...p.ear2, min: 4 }]
          : skill.ear === 'none' && skill.vocal === 'none'
            ? [{ ...p.warmup, min: 2 }, { ...p.ear1, min: 4 }, { ...p.ear2, min: 4 }, p.breath1]
            : [{ ...p.warmup, min: 2 }, p.ear1, p.ear2, p.ear3, p.breath1]
      break
    case 'breath':
      seq = minutes <= 5
        ? [{ ...p.breath1, min: 2 }, { ...p.warmup, min: 3 }]
        : minutes <= 10
          ? [p.breath1, { ...p.warmup, min: 3 }, { ...p.breath2, min: 5 }]
          : [p.breath1, p.warmup, p.breath2, p.longNote, p.calmOrWeak]
      break
    case 'write':
      seq = minutes <= 5
        ? [{ ...p.warmup, min: 2 }, { ...p.compose, min: 3 }]
        : minutes <= 10
          ? [{ ...p.warmup, min: 2 }, { ...p.compose, min: 5 }, p.writeEar]
          : [p.breath1, p.warmup, p.compose, p.writeEar, p.ear1]
      break
    case 'pitch':
    default:
      seq = minutes <= 5
        ? [{ ...p.warmup, min: 2 }, { ...p.calmOrWeak, min: 3 }]
        : minutes <= 10
          ? [p.breath1, p.warmup, { ...p.calmOrWeak, min: 5 }]
          : [p.breath1, p.warmup, p.calmOrWeak, p.vocalBlock, p.ear1]
      break
  }
  return dedup(seq)
}

export function buildDayPlan(input: DayPlanInput): DayPlanResult {
  const d = input.dayNumber ?? Math.floor(Date.now() / 86400000)
  const w = input.weekday ?? new Date().getDay()
  const todayStr = input.todayStr ?? new Date().toDateString()
  const goals = normalizeGoals(input.goals, input.legacyGoal)
  const skillProfile = normalizeSkillProfile(input.skillProfile ?? DEFAULT_SKILL_PROFILE)
  const mode: PlanMode = input.planMode === 'split' ? 'split' : 'mix'
  const newbie = skillProfile.ear === 'none' && skillProfile.vocal === 'none'

  if (goals.length === 1) {
    return {
      steps: buildFocusedPlan(goals[0], input.log, skillProfile, input.minutes, d, w),
      goals,
      mode,
      focusGoal: goals[0],
      overloadProtected: false,
      skillProfile,
    }
  }

  if (mode === 'split') {
    const manual = input.planFocus && input.planFocus.day === todayStr && goals.includes(input.planFocus.goal)
      ? input.planFocus.goal
      : null
    const focusGoal = manual ?? goals[d % goals.length]
    return {
      steps: buildFocusedPlan(focusGoal, input.log, skillProfile, input.minutes, d, w),
      goals,
      mode,
      focusGoal,
      overloadProtected: false,
      skillProfile,
    }
  }

  // Режим mix с >= 2 целями: комбинируем шаги разных направлений с цветными бейджами
  const p = makePools(input.log, skillProfile, d, w)
  const goalStep = (g: Goal): DayPlanStep => {
    switch (g) {
      case 'pitch': return skillProfile.vocal === 'base' ? p.vocalBlock : p.calmOrWeak
      case 'range': return p.range1
      case 'ear': return p.ear1
      case 'breath': return p.breath2
      case 'write': return p.compose
    }
  }

  if (newbie) {
    // Защита новичка: не перегружаем, 2-3 лёгких базовых шага (дыхание/мягкий разогрев + до 2 выбранных направлений)
    const maxSteps = input.minutes <= 5 ? 2 : 3
    const baseStep = goals.includes('breath') ? p.breath1 : { ...p.warmup, min: 2 }
    const candidates = goals.map(goalStep)
    const picked = dedup([baseStep, ...candidates]).slice(0, maxSteps)
    return {
      steps: picked,
      goals,
      mode,
      focusGoal: null,
      overloadProtected: true,
      skillProfile,
    }
  }

  const maxSteps = input.minutes <= 5 ? 3 : input.minutes <= 10 ? 4 : 5
  const needsWarmup = goals.some(g => g === 'pitch' || g === 'range' || g === 'write')
  const foundation: DayPlanStep[] = []
  if (input.minutes >= 10 && !goals.includes('breath')) foundation.push(p.breath1)
  if (input.minutes >= 10 && needsWarmup) foundation.push(p.warmup)

  const goalSteps = goals.map(goalStep)
  const combined = dedup([...goalSteps, ...foundation])
  if (combined.length < maxSteps && input.minutes >= 15) {
    for (const extra of [p.calmOrWeak, p.ear2, p.vocalBlock, p.breath1]) {
      if (combined.length >= maxSteps) break
      if (!combined.some(s => s.to === extra.to)) combined.push(extra)
    }
  }

  return {
    steps: combined.slice(0, maxSteps),
    goals,
    mode,
    focusGoal: null,
    overloadProtected: false,
    skillProfile,
  }
}

import { tr } from '../lib/i18n'
import { Check, Layers, Repeat } from 'lucide-react'
import { GOALS, toggleGoalList } from '../lib/goalMeta'
import type { Goal, PlanMode, SkillProfile } from '../lib/store'

export function GoalPicker({ goals, onChange }: { goals: Goal[]; onChange: (next: Goal[]) => void }) {
  return (
    <div className="choice-list" role="group" aria-label={tr('Выбор целей')}>
      {GOALS.map(g => {
        const on = goals.includes(g.id)
        return (
          <button
            key={g.id}
            type="button"
            className="choice"
            aria-pressed={on}
            onClick={() => onChange(toggleGoalList(goals, g.id))}
          >
            <g.icon size={22} aria-hidden />
            <span><b>{g.title}</b><small>{g.text}</small></span>
            <span className={'choice-chk' + (on ? ' on' : '')} aria-hidden>{on && <Check size={14} />}</span>
          </button>
        )
      })}
    </div>
  )
}

export function SkillPicker({ skill, onChange }: { skill: SkillProfile; onChange: (next: SkillProfile) => void }) {
  return (
    <div className="skill-qs">
      <div className="skill-q">
        <b>{tr('Есть ли уже музыкальный слух?')}</b>
        <div className="seg wide">
          <button type="button" aria-pressed={skill.ear === 'none'} onClick={() => onChange({ ...skill, ear: 'none' })}>{tr('Пока нет')}</button>
          <button type="button" aria-pressed={skill.ear === 'base'} onClick={() => onChange({ ...skill, ear: 'base' })}>{tr('Есть база')}</button>
        </div>
      </div>
      <div className="skill-q">
        <b>{tr('Есть ли опыт в вокале?')}</b>
        <div className="seg wide">
          <button type="button" aria-pressed={skill.vocal === 'none'} onClick={() => onChange({ ...skill, vocal: 'none' })}>{tr('Новичок')}</button>
          <button type="button" aria-pressed={skill.vocal === 'base'} onClick={() => onChange({ ...skill, vocal: 'base' })}>{tr('Уже пел')}</button>
        </div>
      </div>
    </div>
  )
}

export function FormatPicker({
  mode,
  onChange,
  newbie,
}: {
  mode: PlanMode
  onChange: (next: PlanMode) => void
  newbie: boolean
}) {
  return (
    <div className="format-pick">
      {newbie && (
        <p className="note-box small">
          {tr('Не перегружай голос и слух в один день: лучше чередовать направления по дням, а при совмещении план оставит 2–3 лёгких шага.')}
        </p>
      )}
      <div className="choice-list">
        <button type="button" className="choice" aria-pressed={mode === 'split'} onClick={() => onChange('split')}>
          <Repeat size={22} aria-hidden />
          <span>
            <b>{tr('Чередовать по дням (углублённо)')}{newbie ? ` · ${tr('Рекомендуем')}` : ''}</b>
            <small>{tr('Каждый день посвящён одному выбранному направлению без спешки')}</small>
          </span>
        </button>
        <button type="button" className="choice" aria-pressed={mode === 'mix'} onClick={() => onChange('mix')}>
          <Layers size={22} aria-hidden />
          <span>
            <b>{tr('Совмещать в одном дне')}</b>
            <small>{newbie ? tr('Облегчённый стек из 2–3 базовых шагов') : tr('Несколько направлений в одной тренировке с цветными метками')}</small>
          </span>
        </button>
      </div>
    </div>
  )
}

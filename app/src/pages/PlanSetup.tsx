import { tr } from '../lib/i18n'
import { Link } from 'react-router-dom'
import { FormatPicker, GoalPicker, SkillPicker } from '../components/PlanSettings'
import { DEFAULT_SKILL_PROFILE, normalizeSkillProfile, useGoals, useStored, type PlanMode, type SkillProfile } from '../lib/store'

export default function PlanSetup() {
  const [goals, setGoals] = useGoals()
  const [rawSkill, setSkill] = useStored<SkillProfile>('skillProfile', DEFAULT_SKILL_PROFILE)
  const skill = normalizeSkillProfile(rawSkill)
  const [mode, setMode] = useStored<PlanMode>('planMode', 'mix')
  const [minutes, setMinutes] = useStored('dailyMin', 15)
  const newbie = skill.ear === 'none' && skill.vocal === 'none'

  return (
    <div className="page welcome">
      <div className="crumbs"><Link to="/">{tr('← На главную')}</Link></div>
      <h1>{tr('Настроить цели и план')}</h1>
      <p className="lead-narrow muted">{tr('Выбери одно или несколько направлений. Голос и рабочий диапазон сохраняются.')}</p>

      <div className="card">
        <h2>{tr('Цели занятий')}</h2>
        <p className="muted small">{tr('Можно выбрать несколько — минимум одну.')}</p>
        <GoalPicker goals={goals} onChange={setGoals} />
      </div>

      <div className="card">
        <h2>{tr('Твой опыт')}</h2>
        <SkillPicker skill={skill} onChange={setSkill} />
      </div>

      {goals.length >= 2 && (
        <div className="card">
          <h2>{tr('Формат расписания')}</h2>
          <FormatPicker mode={mode} onChange={setMode} newbie={newbie} />
        </div>
      )}

      <div className="card">
        <h2>{tr('Время в день')}</h2>
        <div className="choice-list three">
          {[5, 10, 15].map(m => (
            <button key={m} type="button" className="choice center" aria-pressed={minutes === m} onClick={() => setMinutes(m)}>
              <b className="big">{m}</b><small>{tr('минут')}</small>
            </button>
          ))}
        </div>
      </div>

      <Link to="/" className="btn hero-btn">{tr('Сохранить и к плану')}</Link>
    </div>
  )
}

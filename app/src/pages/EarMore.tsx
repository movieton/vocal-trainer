import { tr } from '../lib/i18n'
import { useState } from 'react'
import { Lock } from 'lucide-react'
import DrillPage from '../components/DrillPage'
import type { Phrase } from '../lib/phrase'
import { useStored, useWorkRange, type Range } from '../lib/store'
import { degree, nearest, rand, randInt } from '../lib/theory'

type Level = { title: string; tol: number; text: string; gen: (r: Range) => Phrase }

/** Мелодия по ступеням мажора от тоники key; после пианино — пауза, затем пение */
function callResponse(key: number, degs: number[], beat: number, hidden = false, label?: string): Phrase {
  const piano: Phrase['piano'] = [], notes: Phrase['notes'] = []
  const A = 0, B = degs.length * beat + beat
  degs.forEach((d, i) => {
    piano.push({ m: key + degree(d), t: A + i * beat, d: beat * 0.9, vel: 70, voice: true })
    notes.push({ m: key + degree(d), t: A + i * beat, d: beat * 0.9, sing: false })
    notes.push({ m: key + degree(d), t: B + i * beat, d: beat * 0.9, sing: true, hidden })
  })
  return { label, piano, notes, len: B + degs.length * beat, marks: [{ t: A, text: tr('Слушай') }, { t: B, text: tr('Повтори') }] }
}

const mid = (r: Range) => Math.round((r.lo + r.hi) / 2)
const keyFor = (r: Range) => nearest(randInt(0, 11), mid(r) - 4)

export const LEVELS: Level[] = [
  { title: tr('Одна нота'), tol: 50, text: tr('Повтори одну ноту, допуск ±50 центов'), gen: r => callResponse(randInt(r.lo + 2, r.hi - 4), [0], 1.4) },
  { title: tr('Одна нота точно'), tol: 25, text: tr('То же, но допуск ±25'), gen: r => callResponse(randInt(r.lo + 2, r.hi - 4), [0], 1.4) },
  { title: tr('Секунда'), tol: 25, text: tr('Две соседние ноты'), gen: r => callResponse(keyFor(r), rand([[0, 1], [1, 0], [2, 3], [4, 3]]), 0.9) },
  { title: tr('Терция'), tol: 25, text: tr('Скачок через ноту'), gen: r => callResponse(keyFor(r), rand([[0, 2], [2, 0], [2, 4], [4, 2]]), 0.9) },
  { title: tr('Трезвучие'), tol: 25, text: tr('До-ми-соль и обратно'), gen: r => callResponse(keyFor(r), rand([[0, 2, 4], [4, 2, 0], [0, 2, 4, 2, 0]]), 0.7) },
  { title: tr('Пять нот'), tol: 20, text: tr('Гамма до пятой ступени'), gen: r => callResponse(keyFor(r), rand([[0, 1, 2, 3, 4], [4, 3, 2, 1, 0]]), 0.55) },
  { title: tr('Гамма'), tol: 20, text: tr('Вся октава вверх и вниз'), gen: r => callResponse(nearest(randInt(0, 11), r.lo + 2), [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0], 0.45) },
  { title: tr('Арпеджио'), tol: 20, text: tr('Трезвучие с октавой'), gen: r => callResponse(nearest(randInt(0, 11), r.lo + 2), [0, 2, 4, 7, 4, 2, 0], 0.55) },
  { title: tr('Скачки'), tol: 15, text: tr('Случайные интервалы в тональности, ±15'), gen: r => callResponse(keyFor(r), Array.from({ length: 5 }, () => randInt(-2, 7)), 0.8) },
  { title: tr('Мастер'), tol: 12, text: tr('Быстрая мелодия, ±12 центов'), gen: r => callResponse(keyFor(r), walk(7), 0.4) },
]

function walk(n: number) {
  const d = [0]
  while (d.length < n) d.push(Math.max(-2, Math.min(7, d.at(-1)! + rand([-2, -1, 1, 1, 2, 3]))))
  return d
}

const PASS = 0.7

export function Levels() {
  const r = useWorkRange()
  const [open, setOpen] = useStored('levelsOpen', 1)
  const [best, setBest] = useStored<Record<number, number>>('levelsBest', {})
  const [lvl, setLvl] = useState(Math.min(open, 10) - 1)
  const L = LEVELS[lvl]
  const make = () => (i: number) => (i >= 6 ? null : L.gen(r))
  const onFinish = (score: number) => {
    const pct = Math.round(score * 100)
    if (pct > (best[lvl] ?? 0)) setBest({ ...best, [lvl]: pct })
    if (score >= PASS && lvl + 2 > open) setOpen(lvl + 2)
  }
  return (
    <DrillPage id={`level-${lvl + 1}`} title={tr('10 уровней точности')} make={make} settingsKey={String(lvl)} tolerance={L.tol} onFinish={onFinish} windowSec={9}
      intro={tr('От одной ноты до быстрой мелодии. Слушаешь фразу и повторяешь её. Набери 70% за 6 фраз — откроется следующий уровень, а допуск будет сужаться.')}
      extra={
        <div className="levels">
          {LEVELS.map((x, i) => (
            <button key={i} className={'level' + (i === lvl ? ' on' : '')} disabled={i + 1 > open} onClick={() => setLvl(i)} title={x.text}>
              <b>{i + 1 > open ? <Lock size={14} strokeWidth={2} aria-label={tr('закрыт')} /> : i + 1}</b><span>{x.title}</span><small>{best[i] != null ? tr('лучший {0}%', best[i]) : i + 1 > open ? tr('закрыт') : tr('±{0} ц', x.tol)}</small>
            </button>
          ))}
          <p className="level-cur">{tr('Уровень')} {lvl + 1}: <b>{LEVELS[lvl].title}</b> {tr('· допуск ±')}{LEVELS[lvl].tol} {tr('ц')}</p>
        </div>
      } />
  )
}

export function Melody() {
  const r = useWorkRange()
  const [len, setLen] = useStored('mel.len', 4)
  const [leaps, setLeaps] = useStored('mel.leaps', false)
  const [hints, setHints] = useState(true)
  const make = () => (i: number): Phrase | null => {
    if (i >= 8) return null
    const degs = [0]
    while (degs.length < len) degs.push(Math.max(-2, Math.min(7, degs.at(-1)! + rand(leaps ? [-3, -2, -1, 1, 2, 3, 4] : [-1, 1, 1, -1, 2]))))
    return callResponse(keyFor(r), degs, 0.6, !hints, tr('Мелодия {0}', i + 1))
  }
  const seg = <T extends string | number | boolean>(v: T, set: (x: T) => void, opts: [T, string][], dis: boolean) =>
    <span className="seg">{opts.map(([o, t]) => <button key={String(o)} aria-pressed={v === o} disabled={dis} onClick={() => set(o)}>{t}</button>)}</span>
  return (
    <DrillPage id="melody" title={tr('Повтори мелодию')} make={make} settingsKey={`${len}-${leaps}-${hints}`} windowSec={10}
      intro={tr('Пианино играет короткую мелодию, затем ты повторяешь её по памяти. Тренирует музыкальную память и точность одновременно.')}
      how={[tr('Запоминай не отдельные ноты, а рисунок: вверх, вниз, на месте.'), tr('Сначала с подсказками, потом выключи их: тогда ноты появятся на доске только после того, как ты их споёшь.')]}
      controls={running => <>
        <label>{tr('Длина')} {seg(len, setLen, [[3, tr('3 ноты')], [4, '4'], [6, '6'], [8, '8']], running)}</label>
        <label>{tr('Движение')} {seg(leaps, setLeaps, [[false, tr('Плавное')], [true, tr('Со скачками')]], running)}</label>
        <label className="chk"><input type="checkbox" checked={hints} onChange={e => setHints(e.target.checked)} disabled={running} /> {tr('Показывать ноты заранее')}</label>
      </>} />
  )
}

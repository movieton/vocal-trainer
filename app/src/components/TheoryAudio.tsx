import { useEffect, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { engine } from '../lib/audio'
import { tr } from '../lib/i18n'

type DemoBtn = {
  key: string
  label: string
  notes: { midi: number; delay: number; dur: number }[]
  totalMs: number
}

function AudioDemoBox({ hint, buttons }: { hint: string; buttons: DemoBtn[] }) {
  const [active, setActive] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current)
      engine.stopTones()
    }
  }, [])

  const play = (btn: DemoBtn) => {
    clearTimeout(timerRef.current)
    engine.stopTones()
    const ctx = engine.ensureCtx()
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {})
    }
    const base = ctx.currentTime + 0.03
    for (const n of btn.notes) {
      engine.playTone(n.midi, base + n.delay, n.dur, 72)
    }
    setActive(btn.key)
    timerRef.current = setTimeout(() => {
      setActive(cur => (cur === btn.key ? null : cur))
    }, btn.totalMs)
  }

  return (
    <div className="theory-audio">
      <p className="muted small theory-audio-hint">
        <Volume2 size={15} aria-hidden="true" />
        <span>{hint}</span>
      </p>
      <div className="theory-audio-btns">
        {buttons.map(btn => (
          <button
            key={btn.key}
            type="button"
            className={'small-btn theory-audio-btn' + (active === btn.key ? ' on' : '')}
            aria-pressed={active === btn.key}
            onClick={() => play(btn)}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Сравнение чистой ноты и отклонения в центах (+12¢ / +25¢ / +50¢) */
export function CentsDemo() {
  const buttons: DemoBtn[] = [
    {
      key: '0',
      label: tr('Послушать эталон 0¢'),
      notes: [{ midi: 69, delay: 0, dur: 1.0 }],
      totalMs: 1100,
    },
    {
      key: '12',
      label: tr('Послушать +12¢'),
      notes: [
        { midi: 69, delay: 0, dur: 0.45 },
        { midi: 69.12, delay: 0.52, dur: 0.85 },
      ],
      totalMs: 1450,
    },
    {
      key: '25',
      label: tr('Послушать +25¢'),
      notes: [
        { midi: 69, delay: 0, dur: 0.45 },
        { midi: 69.25, delay: 0.52, dur: 0.85 },
      ],
      totalMs: 1450,
    },
    {
      key: '50',
      label: tr('Послушать +50¢'),
      notes: [
        { midi: 69, delay: 0, dur: 0.45 },
        { midi: 69.5, delay: 0.52, dur: 0.85 },
      ],
      totalMs: 1450,
    },
  ]

  return (
    <AudioDemoBox
      hint={tr('Сравни чистую ноту Ля4 (0¢) и завышение на 12, 25 или 50 центов (сначала звучит эталон, потом отклонение):')}
      buttons={buttons}
    />
  )
}

/** Примеры интервалов и скачка на октаву для понимания регистрового диапазона */
export function IntervalDemo() {
  const buttons: DemoBtn[] = [
    {
      key: 'third',
      label: tr('Послушать терцию'),
      notes: [
        { midi: 60, delay: 0, dur: 0.48 },
        { midi: 64, delay: 0.54, dur: 0.72 },
      ],
      totalMs: 1350,
    },
    {
      key: 'fifth',
      label: tr('Послушать квинту'),
      notes: [
        { midi: 60, delay: 0, dur: 0.48 },
        { midi: 67, delay: 0.54, dur: 0.72 },
      ],
      totalMs: 1350,
    },
    {
      key: 'octave',
      label: tr('Послушать октаву'),
      notes: [
        { midi: 60, delay: 0, dur: 0.48 },
        { midi: 72, delay: 0.54, dur: 0.8 },
      ],
      totalMs: 1400,
    },
  ]

  return (
    <AudioDemoBox
      hint={tr('Послушай разницу между узким шагом и широким скачком на октаву:')}
      buttons={buttons}
    />
  )
}

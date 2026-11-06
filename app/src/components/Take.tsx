import { useEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { engine, type Take } from '../lib/audio'
import type { Target } from '../lib/run'
import { useStored } from '../lib/store'

export type TakeWithTargets = Take & { targets: Target[] }

/**
 * Запись попытки и прослушивание с кривой высоты поверх нот.
 * Отложенная обратная связь по собственной записи — одна из самых действенных практик (motor learning).
 */
export function useTake() {
  const [take, setTake] = useState<TakeWithTargets | null>(null)
  const [playing, setPlaying] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const [on] = useStored('recordTakes', true)

  const begin = () => { if (on) engine.startRecording() }
  const end = async (targets: Target[]) => {
    const t = await engine.stopRecording()
    if (t) setTake(prev => { if (prev) URL.revokeObjectURL(prev.url); return { ...t, targets: [...targets] } })
  }
  const play = () => {
    if (!take) return
    audio.current?.pause()
    const a = new Audio(take.url)
    a.onended = () => setPlaying(false)
    audio.current = a
    void a.play(); setPlaying(true)
  }
  const stop = () => { audio.current?.pause(); setPlaying(false) }
  useEffect(() => () => { audio.current?.pause() }, [])

  const replay = playing && take ? { clock: () => take.t0 + (audio.current?.currentTime ?? 0), history: take.history } : null
  return { take, playing, begin, end, play, stop, replay, clear: () => setTake(null) }
}

/** Тембр эталонных нот: пианино или голос */

export function TakeBar({ t }: { t: ReturnType<typeof useTake> }) {
  if (!t.take) return null
  return (
    <div className="takebar">
      {!t.playing && <button className="btn ghost" onClick={t.play}><Play size={16} /> Прослушать попытку</button>}
      <span className="muted small">Запись идёт вместе с кривой голоса поверх нот — слушай и смотри, где уходишь. Хранится только до перезагрузки страницы.</span>
    </div>
  )
}

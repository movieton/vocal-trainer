import { noteName } from './music'
import { targetAt, type Target } from './run'

export type LivePitchDisplay = {
  note: string | null
  cents: number | null
  isTarget: boolean
}

/** Ищет активную целевую ноту в момент t (null при паузе или отсутствии цели) */
export function activeTargetMidi(targets: Target[], t: number, paused = false): number | null {
  if (paused || !targets.length) return null
  const g = targets.find(x => x.sing && t >= x.t0 && t <= x.t1) ?? targets.find(x => t >= x.t0 && t <= x.t1)
  return g ? targetAt(g, t) : null
}

/**
 * Считает отображаемую ноту и отклонение в центах:
 * - при активной целевой ноте — имя цели и центы относительно `targetMidi`
 * - при паузе/отсутствии цели — ближайшая хроматическая нота (как в Тюнере)
 */
export function computePitchDisplay(voicedMidi: number | null, targetMidi?: number | null): LivePitchDisplay {
  const hasTarget = targetMidi != null && Number.isFinite(targetMidi)
  if (hasTarget) {
    const ref = targetMidi!
    return {
      note: voicedMidi == null ? null : noteName(Math.round(ref)),
      cents: voicedMidi == null ? null : Math.round((voicedMidi - ref) * 100),
      isTarget: true,
    }
  }
  return {
    note: voicedMidi == null ? null : noteName(voicedMidi),
    cents: voicedMidi == null ? null : Math.round((voicedMidi - Math.round(voicedMidi)) * 100),
    isTarget: false,
  }
}

/**
 * Умное окно сетки PianoRoll: на длинных лесенках (> 7 кругов и размахе > 15 полутонов)
 * во время выполнения держит видимым окно вокруг текущего круга с запасом 1..2 круга.
 */
export function trainerViewWindow(
  roots: number[],
  relNotes: number[],
  activeRep: number,
  running: boolean,
): { lo: number; hi: number } {
  const minNote = relNotes.length ? Math.min(...relNotes) : 0
  const maxNote = relNotes.length ? Math.max(...relNotes) : 0
  const allLo = Math.min(...roots) + minNote - 2
  const allHi = Math.max(Math.max(...roots) + maxNote + 2, allLo + 9)

  if (!running || roots.length <= 7 || allHi - allLo <= 15) {
    return { lo: allLo, hi: allHi }
  }

  const idx = Math.max(0, Math.min(roots.length - 1, activeRep))
  let from = Math.max(0, idx - 1)
  let to = Math.min(roots.length - 1, idx + 2)
  // На краях сохраняем 4 круга в окне, чтобы сетка не сжималась
  if (to - from < 3) {
    if (from === 0) to = Math.min(roots.length - 1, 3)
    else if (to === roots.length - 1) from = Math.max(0, roots.length - 4)
  }
  const winRoots = roots.slice(from, to + 1)
  const rawLo = Math.min(...winRoots) + minNote - 2
  const rawHi = Math.max(...winRoots) + maxNote + 2
  let lo = Math.max(allLo, rawLo)
  const hi = Math.min(allHi, Math.max(rawHi, lo + 10))
  if (hi - lo < 10) lo = Math.max(allLo, hi - 10)
  return { lo, hi }
}

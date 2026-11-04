/** Фасолина — «почка» с ямкой сверху, главный графический элемент айдентики fasol. Масштабируется только пропорционально. */
export const BEAN_PATH = 'M14 34C10 14 26 4 40 10C46 13 54 13 60 10C76 3 92 14 88 34C85 52 66 62 50 62C32 62 17 52 14 34Z'
export const BEAN_VIEWBOX = '8 2 86 64'

export function Bean({ size = 24, rotate = 0, className }: { size?: number; rotate?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox={BEAN_VIEWBOX} className={className} aria-hidden style={{ transform: `rotate(${rotate}deg)` }}>
      <path d={BEAN_PATH} fill="currentColor" />
    </svg>
  )
}

// ритм как в концепте: точки по краям, фасолины растут к центру и лежат под разными углами
// arc — открытая дужка-полумесяц, обрамляет центр «звуковой волны»
const WAVE: [number, number, ('arc' | undefined)?][] = [
  [0.16, 0], [0.26, 90], [0.5, 0, 'arc'], [0.64, -28], [0.78, 95], [1, 90], [0.74, 80], [0.5, 15], [0.44, -20], [0.5, 180, 'arc'], [0.22, 80], [0.16, 0],
]

/** Волна из фасолин. animate — фасолины мягко дышат по очереди; levels (0…1) — живая громкость по фасолинам */
export function BeanWave({ animate = true, levels }: { animate?: boolean; levels?: number[] }) {
  return (
    <div className={'bean-wave' + (animate ? ' anim' : '')} aria-hidden>
      {WAVE.map(([s, r, kind], i) => {
        const v = levels ? 0.2 + 0.8 * (levels[i] ?? 0) : s
        return (
          <span key={i} style={{ ['--s' as string]: v, animationDelay: `${i * 0.1}s` }}>
            {kind === 'arc' ? <svg viewBox="0 0 20 40" style={{ transform: `rotate(${r}deg)` }}><path d="M15 4C6 10 6 30 15 36" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></svg>
              : s < 0.2 ? <svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="currentColor" /></svg>
              : <svg viewBox={BEAN_VIEWBOX} style={{ transform: `rotate(${r}deg)` }}><path d={BEAN_PATH} fill="currentColor" /></svg>}
          </span>
        )
      })}
    </div>
  )
}

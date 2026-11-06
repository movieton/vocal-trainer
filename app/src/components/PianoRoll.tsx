import { useEffect, useRef } from 'react'
import { engine, type PitchSample } from '../lib/audio'
import { isBlack, noteName } from '../lib/music'
import { targetAt, type Target } from '../lib/run'

type Props = {
  /** Видимые ноты по вертикали, вызывается каждый кадр */
  view: () => { lo: number; hi: number }
  /** раздвигать доску, если голос ушёл за край (тюнер, замер диапазона) */
  follow?: boolean
  targets?: () => Target[]
  windowSec?: number
  /** Где стоит курсор «сейчас», доля ширины */
  playhead?: number
  tolerance?: number
  /** Подпись поверх доски, например фаза упражнения */
  overlay?: () => string
  /** Подсветить полосу нот (например, найденный диапазон) */
  band?: () => { lo: number; hi: number } | null
  /** Линия голоса одним цветом, без оценки попадания */
  neutral?: boolean
  /** Своя раскраска голоса: имя CSS-переменной цвета для высоты в момент t */
  colorFor?: (midi: number, t: number) => string | null
  /** Прослушивание записи: своё время и своя история высоты вместо живых */
  replay?: { clock: () => number; history: PitchSample[] } | null
  /** Дополнительная подпись строки (например, номер ступени); null — строка вне лада, приглушается */
  rowLabel?: (m: number) => string | null
  className?: string
}

const LABEL_W = 72

export default function PianoRoll({ follow = false, view, targets, windowSec = 8, playhead = 0.35, tolerance = 25, overlay, band, neutral, colorFor, replay, rowLabel, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const props = useRef({ view, targets, windowSec, playhead, tolerance, overlay, band, neutral, colorFor, replay, rowLabel })
  props.current = { view, targets, windowSec, playhead, tolerance, overlay, band, neutral, colorFor, replay, rowLabel }

  useEffect(() => {
    // новый экран — без следа голоса с прошлого
    engine.history = []
    const cv = ref.current!
    const g = cv.getContext('2d')!
    const draw = () => {
      const { view, targets, windowSec, playhead, tolerance, overlay, band, neutral, colorFor, replay, rowLabel } = props.current
      const hist = replay?.history ?? engine.history
      const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight
      if (!W || !H) return
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr) }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const st = getComputedStyle(cv)
      const c = (n: string) => st.getPropertyValue(n).trim()
      const C = { bg: c('--roll-bg'), black: c('--roll-black'), line: c('--roll-line'), cline: c('--roll-cline'), label: c('--muted'),
        target: c('--roll-target'), listen: c('--roll-listen'), onTarget: c('--roll-on-target'), accent: c('--accent'),
        good: c('--good'), near: c('--near'), bad: c('--bad'), text: c('--text'), voice: c('--roll-voice') }

      let { lo, hi } = view()
      // в тюнере и замере диапазона доска следует за голосом; в упражнениях — стоит на месте
      const v = replay || !follow ? null : engine.current
      if (v != null) {
        if (v < lo + 0.5) lo = Math.max(Math.floor(v) - 1, hi - 36)
        if (v > hi - 0.5) hi = Math.min(Math.ceil(v) + 1, lo + 36)
      }
      const rows = hi - lo + 1, rh = H / rows
      const now = replay ? replay.clock() : engine.now()
      const t0 = now - windowSec * playhead
      const x = (t: number) => LABEL_W + ((t - t0) / windowSec) * (W - LABEL_W)
      const y = (m: number) => H - (m - lo + 0.5) * rh

      g.fillStyle = C.bg; g.fillRect(0, 0, W, H)
      // строки-полутоны
      for (let m = lo; m <= hi; m++) {
        const top = H - (m - lo + 1) * rh
        if (isBlack(m)) { g.fillStyle = C.black; g.fillRect(LABEL_W, top, W - LABEL_W, rh) }
        g.strokeStyle = m % 12 === 0 ? C.cline : C.line; g.lineWidth = 1
        g.beginPath(); g.moveTo(LABEL_W, Math.round(top) + 0.5); g.lineTo(W, Math.round(top) + 0.5); g.stroke()
      }
      const bd = band?.()
      if (bd) {
        g.fillStyle = C.accent; g.globalAlpha = 0.12
        g.fillRect(LABEL_W, H - (bd.hi - lo + 1) * rh, W - LABEL_W, (bd.hi - bd.lo + 1) * rh)
        g.globalAlpha = 1
      }
      // подписи нот
      g.font = `${Math.min(12, Math.max(9, rh * 0.55))}px Manrope, system-ui`; g.textBaseline = 'middle'; g.textAlign = 'left'
      let cur = engine.current
      if (replay) { let last: number | null = null; for (const p of replay.history) { if (p.t > now) break; last = p.midi } cur = last }
      for (let m = lo; m <= hi; m++) {
        const active = cur != null && Math.round(cur) === m
        if (rh < 11 && !active && m % 12 !== 0 && m % 12 !== 7) continue
        g.fillStyle = active ? C.accent : C.label
        g.globalAlpha = isBlack(m) && !active ? 0.55 : 1
        const extra = rowLabel?.(m)
        if (rowLabel && extra === null && !active) g.globalAlpha = 0.3
        g.fillText(noteName(m) + (extra ? ' · ' + extra : ''), 8, y(m))
      }
      g.globalAlpha = 1
      g.strokeStyle = C.line; g.beginPath(); g.moveTo(LABEL_W + 0.5, 0); g.lineTo(LABEL_W + 0.5, H); g.stroke()
      // сетка секунд
      g.strokeStyle = C.line; g.globalAlpha = 0.6
      for (let s = Math.ceil(t0); s < t0 + windowSec; s++) { g.beginPath(); g.moveTo(Math.round(x(s)) + 0.5, 0); g.lineTo(Math.round(x(s)) + 0.5, H); g.stroke() }
      g.globalAlpha = 1

      g.save(); g.beginPath(); g.rect(LABEL_W, 0, W - LABEL_W, H); g.clip()
      // цели
      const list = targets?.() ?? []
      const ph = Math.max(10, rh * 0.8)
      for (const tg of list) {
        if (tg.t1 < t0 || tg.t0 > t0 + windowSec || (tg.hidden && now < tg.t1)) continue
        const x0 = x(tg.t0) + 1, x1 = x(tg.t1) - 1
        const active = now >= tg.t0 && now < tg.t1
        const fill = tg.score != null ? (tg.score >= 0.7 ? C.good : tg.score >= 0.4 ? C.near : C.bad) : tg.sing ? C.target : C.listen
        if (tg.midiEnd != null) {
          g.strokeStyle = fill; g.lineWidth = ph * 0.7; g.lineCap = 'round'; g.globalAlpha = tg.sing ? 0.9 : 0.6
          g.beginPath(); g.moveTo(x0 + ph / 3, y(tg.midi)); g.lineTo(x1 - ph / 3, y(tg.midiEnd)); g.stroke()
          g.globalAlpha = 1
        } else {
          g.beginPath(); g.roundRect(x0, y(tg.midi) - ph / 2, Math.max(4, x1 - x0), ph, ph / 2)
          // «слушай» — контур, «пой» — сплошная заливка: различаются формой, а не только тоном
          if (tg.sing) { g.fillStyle = fill; g.globalAlpha = tg.score != null ? 0.85 : 1; g.fill() }
          else { g.strokeStyle = C.listen; g.lineWidth = 1.5; g.stroke() }
          g.globalAlpha = 1
          if (active) { g.strokeStyle = C.accent; g.lineWidth = 2; g.stroke() }
        }
        g.font = `600 ${Math.max(11, Math.min(13, ph * 0.6))}px Manrope, system-ui`
        if (tg.syl && x1 - x0 > g.measureText(tg.syl.toUpperCase()).width + 10) {
          g.fillStyle = tg.sing ? C.onTarget : C.text; g.textAlign = 'center'
          const ym = tg.midiEnd != null ? (y(tg.midi) + y(tg.midiEnd)) / 2 : y(tg.midi)
          g.fillText(tg.syl.toUpperCase(), (x0 + x1) / 2, ym)
        }
      }
      // линия голоса
      g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round'
      let prev: [number, number] | null = null
      const sing = list.filter(t => t.sing)
      for (const s of hist) {
        if (s.t > now) break
        if (s.t < t0 - 0.1) continue
        if (s.midi == null) { prev = null; continue }
        const pt: [number, number] = [x(s.t), y(s.midi)]
        // скачок больше полутона — новая линия, без вертикальных перемычек
        if (prev && Math.abs(pt[1] - prev[1]) > rh * 1.5) prev = null
        if (prev) {
          let col = C.voice
          const own = colorFor?.(s.midi, s.t)
          if (own) col = c(own)
          else if (neutral) { g.strokeStyle = col; g.beginPath(); g.moveTo(...prev); g.lineTo(...pt); g.stroke(); prev = pt; continue }
          const tg = own ? undefined : sing.find(t => s.t >= t.t0 && s.t < t.t1)
          if (tg) {
            const attack = s.t - tg.t0 < 0.2 * (tg.t1 - tg.t0)
            const d = Math.abs(s.midi - targetAt(tg, s.t)) * 100
            col = attack ? C.voice : d <= tolerance ? C.good : d <= tolerance * 2 ? C.near : C.bad
          } else if (!list.length && !own) {
            const d = Math.abs(s.midi - Math.round(s.midi)) * 100
            col = d <= tolerance / 2 ? C.good : d <= tolerance ? C.near : C.bad
          }
          g.strokeStyle = col; g.beginPath(); g.moveTo(...prev); g.lineTo(...pt); g.stroke()
        }
        prev = pt
      }
      g.restore()
      // курсор
      const px = Math.round(x(now)) + 0.5
      g.strokeStyle = C.cline; g.lineWidth = 1.5; g.setLineDash([4, 4])
      g.beginPath(); g.moveTo(px, 0); g.lineTo(px, H); g.stroke(); g.setLineDash([])
      if (cur != null && cur >= lo - 0.5 && cur <= hi + 0.5) {
        // точка голоса окрашена по точности относительно текущей цели
        const tg = list.find(t => t.sing && now >= t.t0 && now < t.t1)
        const d = Math.abs(cur - (tg ? targetAt(tg, now) : Math.round(cur))) * 100
        const lim = tg ? tolerance : tolerance / 2
        g.fillStyle = neutral ? C.voice : d <= lim ? C.good : d <= lim * 2 ? C.near : C.bad
        g.strokeStyle = C.bg; g.lineWidth = 2
        g.beginPath(); g.arc(px, y(cur), 7, 0, Math.PI * 2); g.fill(); g.stroke()
      } else if (cur != null) {
        // голос за краем доски: стрелка у края вместо прыжка масштаба
        const up = cur > hi, ey = up ? 10 : H - 10
        g.fillStyle = C.voice
        g.beginPath(); g.moveTo(px, up ? ey - 6 : ey + 6); g.lineTo(px - 8, up ? ey + 6 : ey - 6); g.lineTo(px + 8, up ? ey + 6 : ey - 6); g.closePath(); g.fill()
      }
      const label = overlay?.()
      if (label) {
        g.font = '700 20px Manrope, system-ui'; g.textAlign = 'left'; g.textBaseline = 'top'
        const w = g.measureText(label).width
        const lx = px + w + 30 > W ? Math.max(LABEL_W + 4, px - w - 22) : px + 6
        g.fillStyle = C.bg; g.globalAlpha = 0.85; g.beginPath(); g.roundRect(lx, 6, w + 16, 30, 8); g.fill(); g.globalAlpha = 1
        g.fillStyle = C.accent; g.fillText(label, lx + 8, 11)
      }
    }
    draw()
    const off = engine.subscribe(draw)
    const ro = new ResizeObserver(draw); ro.observe(cv)
    return () => { off(); ro.disconnect() }
  }, [])

  return <canvas ref={ref} className={'roll ' + (className ?? '')} />
}

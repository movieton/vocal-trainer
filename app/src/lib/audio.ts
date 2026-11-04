import { PitchDetector } from 'pitchy'
import { SplendidGrandPiano } from 'smplr'
import { ftom, median, mtof } from './music'

// ?sim — синтетический «голос» вместо микрофона, для проверки без певца
export const SIM = new URLSearchParams(location.search).has('sim')

export type PitchSample = { t: number; midi: number | null }
export type MicState = 'off' | 'starting' | 'on' | 'error'

const HISTORY_SEC = 40

class Engine {
  ctx: AudioContext | null = null
  master: GainNode | null = null
  piano: SplendidGrandPiano | null = null
  pianoReady = false
  mic: MicState = 'off'
  micError = ''
  history: PitchSample[] = []
  current: number | null = null
  /** Для режима ?sim: какую высоту «петь» в момент t */
  simTarget: ((t: number) => number | null) | null = null

  private analyser: AnalyserNode | null = null
  private buf: Float32Array<ArrayBuffer> | null = null
  private detector: PitchDetector<Float32Array<ArrayBuffer>> | null = null
  private simOsc: OscillatorNode | null = null
  private simGain: GainNode | null = null
  private recent: number[] = []
  private listeners = new Set<() => void>()
  private running = false

  now() { return this.ctx?.currentTime ?? 0 }

  ensureCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' })
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.9
      this.master.connect(this.ctx.destination)
      this.piano = new SplendidGrandPiano(this.ctx, { destination: this.master, volume: 90 })
      this.piano.load.then(() => { this.pianoReady = true }).catch(() => { this.pianoReady = false })
      this.startLoop()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  async startMic() {
    if (this.mic === 'on' || this.mic === 'starting') return
    const ctx = this.ensureCtx()
    this.mic = 'starting'; this.emit()
    try {
      this.analyser = ctx.createAnalyser()
      this.analyser.fftSize = 2048
      if (SIM) {
        this.simOsc = ctx.createOscillator()
        this.simGain = ctx.createGain()
        this.simGain.gain.value = 0
        this.simOsc.connect(this.simGain).connect(this.analyser)
        this.simOsc.start()
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        })
        ctx.createMediaStreamSource(stream).connect(this.analyser)
      }
      this.buf = new Float32Array(this.analyser.fftSize)
      this.detector = PitchDetector.forFloat32Array(this.buf.length)
      this.mic = 'on'
    } catch (e) {
      this.mic = 'error'
      const err = e as DOMException
      this.micError = err?.name === 'NotAllowedError'
        ? 'Нет доступа к микрофону. Разреши его в настройках браузера и попробуй снова.'
        : 'Не удалось включить микрофон: ' + (err?.message ?? String(e))
    }
    this.emit()
  }

  /** Нота пианино; при незагруженных сэмплах — простой синтез */
  play(midi: number, time: number, dur: number, velocity = 70) {
    const ctx = this.ensureCtx()
    if (this.pianoReady && this.piano) {
      this.piano.start({ note: Math.round(midi), time, duration: dur, velocity })
      return
    }
    const g = ctx.createGain()
    g.connect(this.master!)
    g.gain.setValueAtTime(0, time)
    g.gain.linearRampToValueAtTime(0.18 * (velocity / 70), time + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, time + Math.max(0.15, dur))
    for (const [h, type, a] of [[1, 'triangle', 1], [2, 'sine', 0.3], [3, 'sine', 0.1]] as const) {
      const o = ctx.createOscillator(), og = ctx.createGain()
      o.type = type; o.frequency.value = mtof(midi) * h; og.gain.value = a
      o.connect(og).connect(g); o.start(time); o.stop(time + dur + 0.1)
    }
  }

  stopAll() { this.piano?.stop() }

  /** Короткий щелчок метронома */
  click(accent = false, time = this.ensureCtx().currentTime) {
    const ctx = this.ensureCtx()
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.frequency.value = accent ? 1600 : 1000
    g.gain.setValueAtTime(0.25, time)
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.05)
    o.connect(g).connect(this.master!)
    o.start(time); o.stop(time + 0.06)
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private emit() { this.listeners.forEach(l => l()) }

  private readPitch(): number | null {
    if (!this.analyser || !this.buf || !this.detector || !this.ctx) return null
    if (SIM && this.simOsc && this.simGain) {
      const target = this.simTarget?.(this.ctx.currentTime) ?? null
      if (target != null) {
        this.simOsc.frequency.setValueAtTime(mtof(target), this.ctx.currentTime)
        this.simGain.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.01)
      } else this.simGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01)
    }
    this.analyser.getFloatTimeDomainData(this.buf)
    let s = 0
    for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i]
    if (Math.sqrt(s / this.buf.length) < 0.004) return null
    const [f, clarity] = this.detector.findPitch(this.buf, this.ctx.sampleRate)
    return clarity > 0.8 && f > 60 && f < 1500 ? ftom(f) : null
  }

  private startLoop() {
    if (this.running) return
    this.running = true
    const step = () => {
      if (this.ctx && this.mic === 'on') {
        const m = this.readPitch()
        // медиана трёх кадров гасит одиночные выбросы
        if (m == null) this.recent = []
        else { this.recent.push(m); if (this.recent.length > 3) this.recent.shift() }
        const smooth = m == null ? null : median(this.recent)
        this.current = smooth
        const t = this.ctx.currentTime
        this.history.push({ t, midi: smooth })
        while (this.history.length && this.history[0].t < t - HISTORY_SEC) this.history.shift()
      }
      this.emit()
      // в фоновой вкладке rAF спит, поэтому в режиме проверки идём по таймеру
      if (SIM) setTimeout(step, 16); else requestAnimationFrame(step)
    }
    step()
  }
}

export const engine = new Engine()

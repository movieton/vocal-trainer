import { PitchDetector } from 'pitchy'
import { SplendidGrandPiano } from 'smplr'
import { ftom, median, mtof } from './music'
import { read } from './store'

// ?sim — синтетический «голос» вместо микрофона, для проверки без певца
export const SIM = new URLSearchParams(location.search).has('sim')

export type PitchSample = { t: number; midi: number | null }
export type MicState = 'off' | 'starting' | 'on' | 'error'
export type Take = { url: string; t0: number; t1: number; history: PitchSample[] }

const HISTORY_SEC = 180

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
  private recSource: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private recChunks: Blob[] = []
  private recT0 = 0
  private droneNodes: AudioScheduledSourceNode[] = []

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
        const dest = ctx.createMediaStreamDestination()
        this.simGain.connect(dest)
        this.recSource = dest.stream
        this.simOsc.start()
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        })
        ctx.createMediaStreamSource(stream).connect(this.analyser)
        this.recSource = stream
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

  /** Эталонная нота: пианино или голосовой тембр — по настройке */
  ref(midi: number, time: number, dur: number, velocity = 70) {
    if (read('refVoice', false)) this.playVoice(midi, time, dur, velocity)
    else this.play(midi, time, dur, velocity)
  }

  /**
   * «Голосовой» эталон: пила через форманты гласной «а», лёгкое вибрато и мягкая атака.
   * Подражать голосовому тембру проще, чем фортепианному (Hutchins & Peretz 2012).
   */
  playVoice(midi: number, time: number, dur: number, velocity = 70) {
    const ctx = this.ensureCtx()
    const o = ctx.createOscillator(), vib = ctx.createOscillator(), vibG = ctx.createGain(), out = ctx.createGain()
    o.type = 'sawtooth'; o.frequency.value = mtof(midi)
    vib.frequency.value = 5.5; vibG.gain.value = mtof(midi) * 0.008
    vib.connect(vibG).connect(o.frequency)
    for (const [f, q, g] of [[750, 6, 1], [1150, 8, 0.6], [2600, 10, 0.25]] as const) {
      const bp = ctx.createBiquadFilter(), fg = ctx.createGain()
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; fg.gain.value = g
      o.connect(bp).connect(fg).connect(out)
    }
    const peak = 0.5 * (velocity / 70)
    out.gain.setValueAtTime(0, time)
    out.gain.linearRampToValueAtTime(peak, time + 0.06)
    out.gain.setValueAtTime(peak, time + Math.max(0.06, dur - 0.08))
    out.gain.linearRampToValueAtTime(0, time + dur)
    out.connect(this.master!)
    o.start(time); vib.start(time); o.stop(time + dur + 0.05); vib.stop(time + dur + 0.05)
  }

  /** Непрерывный фон (тоника + квинта) для пения под дрон */
  drone(midi: number | null) {
    const ctx = this.ensureCtx()
    this.droneNodes.forEach(n => { try { n.stop() } catch { /* уже остановлен */ } })
    this.droneNodes = []
    if (midi == null) return
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.5)
    g.connect(this.master!)
    for (const [m, type, a] of [[midi, 'sawtooth', 0.5], [midi + 7, 'sawtooth', 0.3], [midi - 12, 'triangle', 0.8]] as const) {
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), og = ctx.createGain()
      o.type = type; o.frequency.value = mtof(m); lp.type = 'lowpass'; lp.frequency.value = 1200; og.gain.value = a
      o.connect(lp).connect(og).connect(g); o.start()
      this.droneNodes.push(o)
    }
  }

  // ---- запись попытки (для прослушивания с кривой высоты) ----
  startRecording() {
    if (!this.recSource || typeof MediaRecorder === 'undefined') return false
    this.recChunks = []
    this.recorder = new MediaRecorder(this.recSource)
    this.recorder.ondataavailable = e => { if (e.data.size) this.recChunks.push(e.data) }
    this.recorder.start()
    this.recT0 = this.now()
    return true
  }

  stopRecording(): Promise<Take | null> {
    const rec = this.recorder
    if (!rec || rec.state === 'inactive') return Promise.resolve(null)
    const t0 = this.recT0, t1 = this.now()
    const history = this.history.filter(s => s.t >= t0 && s.t <= t1)
    return new Promise(res => {
      rec.onstop = () => {
        const blob = new Blob(this.recChunks, { type: rec.mimeType || 'audio/webm' })
        res({ url: URL.createObjectURL(blob), t0, t1, history })
      }
      rec.stop()
      this.recorder = null
    })
  }

  /** Синтез барабанов: бочка — падающий синус, малый и хэт — отфильтрованный шум */
  drum(kind: 'kick' | 'snare' | 'hat', time: number, vel = 1) {
    const ctx = this.ensureCtx(), g = ctx.createGain()
    g.connect(this.master!)
    if (kind === 'kick') {
      const o = ctx.createOscillator()
      o.frequency.setValueAtTime(140, time); o.frequency.exponentialRampToValueAtTime(45, time + 0.12)
      g.gain.setValueAtTime(0.55 * vel, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.25)
      o.connect(g); o.start(time); o.stop(time + 0.3)
      return
    }
    const len = kind === 'snare' ? 0.18 : 0.05
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate), d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter()
    src.buffer = buf
    f.type = kind === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 'snare' ? 1800 : 7000
    g.gain.setValueAtTime((kind === 'snare' ? 0.35 : 0.12) * vel, time); g.gain.exponentialRampToValueAtTime(0.001, time + len)
    src.connect(f).connect(g); src.start(time)
  }

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

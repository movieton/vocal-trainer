/** Минимальная запись Standard MIDI File (формат 1): дорожки мелодии, аккордов и баса — для переноса в DAW */

export type MidiNote = { m: number; beat: number; d: number; vel?: number }
export type MidiTrack = { name: string; channel: number; notes: MidiNote[]; program?: number }

const PPQ = 480

const vlq = (n: number) => {
  const out = [n & 0x7f]
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80)
  return out
}
const str = (s: string) => [...new TextEncoder().encode(s)]
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]

function trackChunk(events: { tick: number; data: number[] }[]) {
  events.sort((a, b) => a.tick - b.tick)
  const body: number[] = []
  let last = 0
  for (const e of events) { body.push(...vlq(e.tick - last), ...e.data); last = e.tick }
  body.push(0, 0xff, 0x2f, 0) // конец дорожки
  return [...str('MTrk'), ...u32(body.length), ...body]
}

export function toMidi(tracks: MidiTrack[], bpm: number, timeSig: [number, number] = [4, 4]) {
  const tempo = Math.round(60_000_000 / bpm)
  const meta = trackChunk([
    { tick: 0, data: [0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255] },
    { tick: 0, data: [0xff, 0x58, 4, timeSig[0], Math.log2(timeSig[1]), 24, 8] },
  ])
  const chunks = tracks.map(t => {
    const ev: { tick: number; data: number[] }[] = [
      { tick: 0, data: [0xff, 0x03, ...vlq(str(t.name).length), ...str(t.name)] },
      { tick: 0, data: [0xc0 | t.channel, t.program ?? 0] },
    ]
    for (const n of t.notes) {
      const on = Math.round(n.beat * PPQ), off = Math.round((n.beat + n.d) * PPQ) - 1
      ev.push({ tick: on, data: [0x90 | t.channel, n.m, n.vel ?? 90] }, { tick: Math.max(on + 1, off), data: [0x80 | t.channel, n.m, 0] })
    }
    return trackChunk(ev)
  })
  const header = [...str('MThd'), ...u32(6), 0, 1, 0, tracks.length + 1, (PPQ >> 8) & 255, PPQ & 255]
  return new Uint8Array([...header, ...meta, ...chunks.flat()])
}

export function downloadBytes(bytes: Uint8Array, filename: string, type = 'audio/midi') {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * 环境音接口（Language Explorer「Sound on」→ BRAINBOT 映射）
 *
 * 对外约定接口：playAmbient() / stopAmbient() / disposeAmbient()
 * 当前实现：WebAudio 实时合成的极轻环境垫音（无任何音频资源文件）。
 * 接入真实音频资源时，仅需替换本文件内部实现，接口不变。
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let oscs: OscillatorNode[] = []
let lfo: OscillatorNode | null = null

function build() {
  if (ctx) return
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  ctx = new AC()

  master = ctx.createGain()
  master.gain.value = 0

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 320
  filter.connect(master)
  master.connect(ctx.destination)

  /* 三层失谐正弦构成持续 pad，音量极低 */
  const freqs = [82.41, 123.47, 164.81]
  oscs = freqs.map((f, i) => {
    const o = ctx!.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    o.detune.value = i * 4 - 4
    const g = ctx!.createGain()
    g.gain.value = i === 2 ? 0.18 : 0.32
    o.connect(g)
    g.connect(filter)
    o.start()
    return o
  })

  /* 极慢 LFO 呼吸起伏 */
  lfo = ctx.createOscillator()
  lfo.frequency.value = 0.06
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 0.012
  lfo.connect(lfoGain)
  lfoGain.connect(master.gain)
  lfo.start()
}

export function playAmbient(): boolean {
  try {
    build()
    if (!ctx || !master) return false
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setValueAtTime(master.gain.value, t)
    master.gain.linearRampToValueAtTime(0.035, t + 1.6)
    return true
  } catch {
    return false
  }
}

export function stopAmbient(): void {
  if (!ctx || !master) return
  const t = ctx.currentTime
  master.gain.cancelScheduledValues(t)
  master.gain.setValueAtTime(master.gain.value, t)
  master.gain.linearRampToValueAtTime(0.0001, t + 0.8)
}

export function disposeAmbient(): void {
  try {
    oscs.forEach((o) => o.stop())
    lfo?.stop()
    void ctx?.close()
  } catch { /* 已释放则忽略 */ }
  ctx = null
  master = null
  oscs = []
  lfo = null
}

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { stopAmbient, playAmbient } from '../components/visual/useAmbient'
import { useVisualizerStore } from '../stores/visualizer'

const viz = useVisualizerStore()
const video = ref(null)
const playing = ref(false)
const failed = ref(false)
const source = '/media/brainbot-demo-20260921.mp4'
const chapters = [
  { time: 0, label: '开场' }, { time: 6, label: 'AI 协作' },
  { time: 15, label: '共享记忆' }, { time: 25, label: '科研证据' },
  { time: 35, label: '推进行动' }, { time: 41, label: '品牌落版' },
]
async function playFrom(time) {
  if (!video.value) return
  if (typeof time === 'number') video.value.currentTime = time
  try { await video.value.play() } catch { playing.value = false }
}
function togglePlay() {
  if (playing.value) video.value?.pause()
  else void playFrom()
}
onMounted(() => stopAmbient())
onBeforeUnmount(() => {
  video.value?.pause()
  if (viz.ambient) playAmbient()
})
</script>

<template>
  <main class="film-page">
    <header class="film-header">
      <RouterLink class="film-brand" to="/" aria-label="BrainBot 首页">BRAINBOT</RouterLink>
      <RouterLink to="/">← 返回星图首页</RouterLink>
    </header>
    <section class="film-content" aria-labelledby="film-title">
      <div class="film-heading">
        <div><p class="eyebrow">PRODUCT FILM / 45 SEC</p><h1 id="film-title">让每一次思考，<br>成为团队的积累。</h1></div>
        <p class="film-intro">从讨论到共享记忆，<br>让证据与行动自然相连。</p>
      </div>
      <div class="screen">
        <video ref="video" controls playsinline preload="none" :src="source"
          poster="/media/brainbot-demo-poster.jpg" aria-label="BrainBot 45 秒产品演示"
          @play="playing = true" @pause="playing = false" @ended="playing = false" @error="failed = true" />
      </div>
      <p v-if="failed" class="error" role="alert">视频暂时无法播放，请尝试刷新，或<a :href="source" download>下载影片</a>后观看。</p>
      <div class="film-controls">
        <button type="button" class="play-button" @click="togglePlay">{{ playing ? '暂停影片' : '播放影片' }} <span aria-hidden="true">{{ playing ? 'Ⅱ' : '▷' }}</span></button>
        <span class="film-meta">45 秒 · 原创配乐 · 演示数据</span>
        <RouterLink class="try-link" to="/login">亲自体验 BrainBot ↗</RouterLink>
      </div>
      <nav class="chapters" aria-label="影片章节">
        <button v-for="chapter in chapters" :key="chapter.time" type="button" @click="playFrom(chapter.time)">
          <span>00:{{ String(chapter.time).padStart(2, '0') }}</span>{{ chapter.label }}
        </button>
      </nav>
      <p class="film-note">KNOWLEDGE, IN MOTION.</p>
    </section>
  </main>
</template>

<style scoped>
.film-page { min-height: 100dvh; background: #090c12; color: #f1f3f7; padding: 0 clamp(20px, 5vw, 80px) 40px; }
.film-header { max-width: 1240px; margin: auto; min-height: 80px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.film-header a { color: #a5aebf; font-size: 13px; text-decoration: none; padding-block: 12px; }
.film-header .film-brand { color: #f1f3f7; letter-spacing: .15em; font-family: var(--bb-font-mono); }
.film-content { max-width: 1120px; margin: 32px auto 0; }
.film-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 32px; }
.eyebrow { color: #8da6ca; font: 11px var(--bb-font-mono); letter-spacing: .15em; margin: 0 0 16px; }
h1 { font-size: clamp(28px, 3.2vw, 44px); line-height: 1.3; font-weight: 500; letter-spacing: -.035em; margin: 0; }
.film-intro { color: #9ba6b8; font-size: 14px; line-height: 1.8; margin: 0; }
.screen { border: 1px solid #28303d; border-radius: 12px; overflow: hidden; background: #05070b; box-shadow: 0 28px 90px #0005; }
video { display: block; width: 100%; aspect-ratio: 16/9; }
.film-controls { display: flex; align-items: center; gap: 20px; padding: 22px 0; flex-wrap: wrap; }
button, a { -webkit-tap-highlight-color: transparent; }
.play-button { display: flex; align-items: center; gap: 18px; min-height: 44px; border: 1px solid #52627b; border-radius: 24px; color: #f1f3f7; background: #19202c; padding: 10px 22px; cursor: pointer; font-size: 14px; }
.film-meta { color: #8c99ad; font-size: 12px; }
.try-link { margin-left: auto; color: #c7daf6; text-decoration: none; font-size: 14px; min-height: 44px; display: flex; align-items: center; }
.chapters { display: grid; grid-template-columns: repeat(6, 1fr); border-top: 1px solid #29313e; gap: 12px; padding-top: 20px; }
.chapters button { text-align: left; border: 0; background: transparent; color: #b6bfce; cursor: pointer; min-height: 48px; padding: 6px 0; font-size: 13px; }
.chapters span { display: block; font: 11px var(--bb-font-mono); color: #74839b; margin-bottom: 8px; }
.chapters button:hover, a:hover { color: white; }
button:focus-visible, a:focus-visible { outline: 2px solid #91baff; outline-offset: 5px; }
.film-note { color: #66738a; font: 10px var(--bb-font-mono); letter-spacing: .15em; margin: 36px 0 0; }
.error { color: #ffc7c7; font-size: 14px; }.error a { color: inherit; }
@media(max-width: 640px) {
  .film-content { margin-top: 16px; }.film-heading { display: block; margin-bottom: 24px; }
  .film-intro { margin-top: 16px; }.chapters { grid-template-columns: repeat(3, 1fr); row-gap: 16px; }
  .film-controls { gap: 12px; }.try-link { width: 100%; margin-left: 0; }
}
</style>

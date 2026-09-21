/**
 * 视觉增强层总开关（Language Explorer 融合层）
 * 全部持久化到 localStorage；searchOpen 为运行时状态不持久化。
 * 关闭全部开关 + 移除挂载点即可完整还原原生落地页。
 */
import { defineStore } from 'pinia'

const KEY = 'bb.visualizer.v1'

interface VisualizerState {
  field: boolean    // 知识星图背景
  stats: boolean    // 右下统计卡
  float: boolean    // 右侧悬浮按钮组
  ambient: boolean  // 环境音
  searchOpen: boolean
}

const DEFAULTS: VisualizerState = {
  field: true,
  stats: true,
  float: true,
  ambient: false,
  searchOpen: false,
}

function load(): VisualizerState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<VisualizerState>), searchOpen: false }
  } catch {
    return { ...DEFAULTS }
  }
}

export const useVisualizerStore = defineStore('visualizer', {
  state: load,
  actions: {
    persist() {
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({ field: this.field, stats: this.stats, float: this.float, ambient: this.ambient }),
        )
      } catch { /* 存储不可用时静默 */ }
    },
    toggle(key: 'field' | 'stats' | 'float' | 'ambient') {
      if (key === 'field') this.field = !this.field
      else if (key === 'stats') this.stats = !this.stats
      else if (key === 'float') this.float = !this.float
      else if (key === 'ambient') this.ambient = !this.ambient
      this.persist()
    },
    openSearch() { this.searchOpen = true },
    closeSearch() { this.searchOpen = false },
  },
})

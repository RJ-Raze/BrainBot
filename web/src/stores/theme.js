import { defineStore } from 'pinia'
import { ref, watchEffect } from 'vue'

/**
 * 全局主题 store
 * 三套主题：dark（深色极简）/ light（浅色常规）/ blue（未来界面蓝）
 * 持久化：localStorage['bb_theme']
 * 应用方式：<html data-theme="dark|light|blue">
 */
export const THEMES = ['dark', 'light', 'blue']
export const DEFAULT_THEME = 'dark'    // 首次访问默认展示深色知识星图

function readInitial() {
  const saved = localStorage.getItem('bb_theme')
  if (saved && THEMES.includes(saved)) return saved
  return DEFAULT_THEME
}

export const useThemeStore = defineStore('bbTheme', () => {
  const theme = ref(readInitial())

  watchEffect(() => {
    document.documentElement.setAttribute('data-theme', theme.value)
    localStorage.setItem('bb_theme', theme.value)
  })

  // 切换时挂 class 触发统一颜色过渡，结束后移除避免污染组件自定义 transition
  let animTimer = null
  function animateThemeSwitch() {
    const el = document.documentElement
    el.classList.remove('theme-anim')
    // 强制重排，让 transition 从新值开始
    void el.offsetWidth
    el.classList.add('theme-anim')
    window.clearTimeout(animTimer)
    animTimer = window.setTimeout(() => el.classList.remove('theme-anim'), 400)
  }

  function setTheme(name) {
    if (THEMES.includes(name) && name !== theme.value) {
      animateThemeSwitch()
      theme.value = name
    }
  }
  function cycleTheme() {
    animateThemeSwitch()
    const i = THEMES.indexOf(theme.value)
    theme.value = THEMES[(i + 1) % THEMES.length]
  }

  return { theme, setTheme, cycleTheme, THEMES }
})

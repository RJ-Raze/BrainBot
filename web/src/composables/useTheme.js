/**
 * 主题切换 composable — 委托给 Pinia store
 * 保留此文件是为了向后兼容已有 import
 */
import { useThemeStore } from '../stores/theme'

export function useTheme() {
  const store = useThemeStore()
  return {
    theme: store.theme,
    setTheme: store.setTheme,
    cycleTheme: store.cycleTheme,
    getTheme: () => store.theme,
    THEMES: store.THEMES,
  }
}

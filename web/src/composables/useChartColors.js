import { computed, onBeforeUnmount } from 'vue'
import { useTheme } from './useTheme'

/**
 * 从 CSS 变量中读取图表配色
 *
 * 为什么需要这个桥接层？
 *   ECharts 的 option 是纯 JS 对象，不能直接写 var(--chart-color-1)。
 *   必须用 getComputedStyle 读出当前主题下的实际颜色值，喂给 ECharts。
 *
 * 用法：
 *   const colors = useChartColors()
 *   echarts.setOption({ color: colors.task })
 *
 *   // 主题切换时，组件应 watch(colors.version, () => echarts.setOption(newOption))
 */
function readVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#333'
}

/* 每色一个变量的组（见 style.css --chart-task-1..5 等） */
const GROUP_SPECS = {
  task: { names: ['--chart-task-1', '--chart-task-2', '--chart-task-3', '--chart-task-4', '--chart-task-5'] },
  direction: { names: ['--chart-direction-1', '--chart-direction-2', '--chart-direction-3', '--chart-direction-4'] },
  experiment: { names: ['--chart-experiment-1', '--chart-experiment-2', '--chart-experiment-3', '--chart-experiment-4'] },
  trend: { names: ['--chart-trend-1', '--chart-trend-2'] },
}

export function useChartColors() {
  const { theme } = useTheme()

  const readGroup = (names) => computed(() => names.map(readVar))

  const taskColors = readGroup(GROUP_SPECS.task.names)
  const directionColors = readGroup(GROUP_SPECS.direction.names)
  const experimentColors = readGroup(GROUP_SPECS.experiment.names)
  const trendColors = readGroup(GROUP_SPECS.trend.names)
  const axisColor = computed(() => readVar('--chart-axis-color'))
  const gridColor = computed(() => readVar('--chart-grid-color'))
  const tooltipBg = computed(() => readVar('--chart-tooltip-bg'))
  const tooltipBorder = computed(() => readVar('--chart-tooltip-border'))
  const tooltipText = computed(() => readVar('--chart-tooltip-text'))

  // 让订阅者知道主题变了（触发 setOption）
  const version = computed(() => theme.value + '-' + Date.now())

  // 监听 <html data-theme> 变化 — 用 MutationObserver 比 watch theme 更底层
  let observer = null
  function onThemeChange(cb) {
    if (!observer) {
      observer = new MutationObserver(() => cb())
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    }
  }
  onBeforeUnmount(() => { observer?.disconnect(); observer = null })

  const tooltipBase = computed(() => ({
    backgroundColor: tooltipBg.value,
    borderColor: tooltipBorder.value,
    textStyle: { color: tooltipText.value },
    padding: [10, 14],
    confine: true,
  }))

  const axisBase = computed(() => ({
    axisLine: { lineStyle: { color: axisColor.value } },
    axisLabel: { color: axisColor.value, fontSize: 11 },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: gridColor.value, type: 'dashed' } },
  }))

  const legendBase = computed(() => ({
    textStyle: { color: axisColor.value, fontSize: 11 },
    itemWidth: 10, itemHeight: 10, itemGap: 14,
  }))

  return {
    taskColors, directionColors, experimentColors, trendColors,
    axisColor, gridColor, tooltipBase, axisBase, legendBase,
    version, onThemeChange,
  }
}

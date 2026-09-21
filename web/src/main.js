import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useThemeStore } from './stores/theme'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// 主题初始化 — 必须在 Pinia 注册后
useThemeStore()

app.mount('#app')

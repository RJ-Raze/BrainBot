import { createRouter, createWebHistory } from 'vue-router'
import { getToken } from './api'

const routes = [
  // 登录前：公开首页（图5：把团队的讨论沉淀为记忆）
  { path: '/', component: () => import('./views/Projects.vue'), meta: { public: true } },
  { path: '/film', component: () => import('./views/ProductFilm.vue'), meta: { public: true } },
  { path: '/login', component: () => import('./views/Login.vue'), meta: { public: true } },

  // 登录后：团队工作台（图1：创建/加入团队 + 我的项目）
  { path: '/home', component: () => import('./views/TeamHome.vue') },

  // 旧路径兼容：原落地页地址统一进入登录后工作台
  { path: '/projects', redirect: '/home' },

  // 初始化模式（创立人）
  { path: '/setup', component: () => import('./views/Setup.vue') },
  { path: '/analyzing', component: () => import('./views/Analyzing.vue') },
  { path: '/proposal/:pid', component: () => import('./views/Proposal.vue') },
  // 组队（组员）
  { path: '/join', component: () => import('./views/Join.vue') },
  { path: '/claim/:pid', component: () => import('./views/Claim.vue') },
  // 运行模式
  { path: '/workspace/:pid', component: () => import('./views/Workbench.vue') },
  // 旧路径兼容
  { path: '/projects/:pid/workbench', redirect: (to) => `/workspace/${to.params.pid}` },
]

const router = createRouter({ history: createWebHistory(), routes })

// A deployment can replace hashed route chunks while an already-open tab is
// still holding the previous index bundle.  Recover that tab once by asking
// for a fresh entry document instead of leaving the user on a dead screen.
const chunkReloadKey = 'brainbot:chunk-reload'
router.onError((error, to) => {
  const message = String(error?.message || error)
  const isChunkLoadError = /failed to fetch dynamically imported module|importing a module script failed|loading chunk|chunkloaderror/i.test(message)
  if (!isChunkLoadError) return

  // 标记仍在说明上次恢复刷新未成功（afterEach 未执行），放弃以免死循环
  if (sessionStorage.getItem(chunkReloadKey) === '1') {
    sessionStorage.removeItem(chunkReloadKey)
    return
  }

  sessionStorage.setItem(chunkReloadKey, '1')
  const target = new URL(to?.fullPath || window.location.href, window.location.origin)
  target.searchParams.set('bb_reload', String(Date.now()))
  window.location.replace(target.href)
})
router.afterEach(() => sessionStorage.removeItem(chunkReloadKey))

router.beforeEach((to) => {
  const token = getToken()
  if (!to.meta.public && !token) return '/login'
})

export default router

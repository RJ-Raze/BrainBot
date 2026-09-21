// 统一 API 封装：自动带 JWT，统一解 {code,data,msg}
const BASE = ''
const API_TIMEOUT_MS = 15000
const FILE_TIMEOUT_MS = 120000
const CHAT_TIMEOUT_MS = 210000
const FILE_TEXT_TIMEOUT_MS = 40000

// SSE 重连与保活参数（统一收编，避免散落魔法数）
const SSE_IDLE_TIMEOUT_MS = 45000
const SSE_RECONNECT_BASE_MS = 1000
const SSE_RECONNECT_MAX_MS = 15000

export function getToken() { return sessionStorage.getItem('token') || localStorage.getItem('token') || '' }
export function setToken(t, remember = true) {
  localStorage.removeItem('token')
  sessionStorage.removeItem('token')
  if (t) (remember ? localStorage : sessionStorage).setItem('token', t)
}

// 离线演示模式开关（由 src/mock/demo.js 维护），仅透出给视图判断
export function isDemoMode() {
  try { return localStorage.getItem('bb_demo') === '1' } catch { return false }
}

function unauthorized(message = '登录已失效') {
  setToken('')
  if (location.pathname !== '/login') location.assign('/login')
  throw new Error(message)
}

async function timedRequest(url, options, timeoutMs, consume) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return await consume(response)
  } catch (error) {
    if (controller.signal.aborted) throw new Error('请求超时，请检查网络后重试')
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

// 解析一段 SSE 文本：按 \n\n 切分事件，返回 { events: [{type, raw}], rest }。
// 心跳/注释行（无 event 名）会被跳过；data 仅取首行（本项目事件体均为单行 JSON）。
function parseSSE(buffer) {
  const chunks = buffer.split('\n\n')
  const rest = chunks.pop() || ''
  const events = []
  for (const chunk of chunks) {
    const type = chunk.match(/^event: (.+)$/m)?.[1]
    const raw = chunk.match(/^data: (.*)$/m)?.[1]
    if (!type || raw == null) continue
    events.push({ type, raw })
  }
  return { events, rest }
}

// 触发浏览器下载（统一封装，供文件下载与文本导出复用）
export function saveBlob(blob, filename) {
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename || 'download'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}

// 带 Authorization 的项目事件流，避免将 JWT 放进 URL/代理日志。
export function subscribeProjectEvents(projectId, { onOpen, onDisconnect, onEvent }) {
  // 离线演示模式：不发真实 SSE 连接，直接报告已连接
  if (isDemoMode()) {
    onOpen?.()
    return { close() {} }
  }
  return subscribeEvents(() => `${BASE}/api/v1/projects/${projectId}/events`, { onOpen, onDisconnect, onEvent })
}

export function subscribeTeamMessages(projectId, after, callbacks) {
  // 离线演示模式：不发真实 SSE 连接
  if (isDemoMode()) {
    callbacks.onOpen?.()
    return { close() {} }
  }
  let cursor = after
  return subscribeEvents(() => `${BASE}/api/v1/projects/${projectId}/team-chat/events?after=${encodeURIComponent(cursor)}`, {
    ...callbacks,
    onEvent(type, data) {
      if (type === 'team.message') cursor = data.id
      callbacks.onEvent?.(type, data)
    },
  })
}

function subscribeEvents(getPath, { onOpen, onDisconnect, onEvent }) {
  let closed = false
  let controller = null
  async function run() {
    let failures = 0
    while (!closed) {
      controller = new AbortController()
      let idleTimer = null
      const resetIdleTimer = () => {
        window.clearTimeout(idleTimer)
        idleTimer = window.setTimeout(() => controller.abort(), SSE_IDLE_TIMEOUT_MS)
      }
      try {
        resetIdleTimer()
        const resp = await fetch(getPath(), {
          headers: { Authorization: `Bearer ${getToken()}` },
          signal: controller.signal,
          cache: 'no-store',
        })
        if (resp.status === 401) { closed = true; unauthorized('登录已失效') }
        if (resp.status === 403 || resp.status === 404) { closed = true; onDisconnect?.(new Error('已无权访问此团队')); break }
        if (!resp.ok || !resp.body) throw new Error(`同步连接失败 (${resp.status})`)
        failures = 0
        onOpen?.()
        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) throw new Error('同步连接已断开')
          resetIdleTimer()
          buffer += decoder.decode(value, { stream: true })
          const { events, rest } = parseSSE(buffer)
          buffer = rest
          for (const { type, raw } of events) {
            try { onEvent?.(type, JSON.parse(raw)) } catch { /* 忽略单个格式错误的事件 */ }
            if (type === 'access.revoked') { closed = true; controller.abort(); break }
          }
        }
      } catch (error) {
        if (closed) break
        onDisconnect?.(error)
        await pause(Math.min(SSE_RECONNECT_BASE_MS * 2 ** failures++, SSE_RECONNECT_MAX_MS))
      } finally {
        window.clearTimeout(idleTimer)
      }
    }
  }
  run()
  return { close() { closed = true; controller?.abort() } }
}

export async function api(method, path, body) {
  // 离线演示模式：直接走本地 mock 数据层，不发任何网络请求
  if (isDemoMode()) {
    const { mockApi } = await import('./mock/demo')
    return mockApi(method, path, body)
  }
  const attempts = method.toUpperCase() === 'GET' ? 3 : 1
  const timeoutMs = path.endsWith('/initialize') ? CHAT_TIMEOUT_MS : /\/files\/[^/]+\/(text|citations)$/.test(path) ? FILE_TEXT_TIMEOUT_MS : API_TIMEOUT_MS
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await timedRequest(BASE + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
        },
        body: body == null ? undefined : JSON.stringify(body),
      }, timeoutMs, async (resp) => {
        const json = await resp.json().catch(() => ({ code: -1, msg: '响应解析失败' }))
        if (resp.status === 401) unauthorized(json.msg)
        if (resp.status >= 500 && attempt < attempts - 1) {
          const error = new Error(json.msg || `服务暂不可用 (${resp.status})`)
          error.retryable = true
          throw error
        }
        if (!resp.ok || json.code !== 0) throw new Error(json.msg || `请求失败 (${resp.status})`)
        return json.data
      })
    } catch (error) {
      if (attempt === attempts - 1 || (error.retryable !== true && error.name !== 'TypeError' && error.message !== '请求超时，请检查网络后重试')) throw error
      await pause(300 * 2 ** attempt)
    }
  }
}

export async function uploadProjectFile(projectId, file) {
  const form = new FormData()
  form.append('file', file)
  return timedRequest(`${BASE}/api/v1/projects/${projectId}/files`, {
    method: 'POST',
    headers: { ...(getToken() && { Authorization: `Bearer ${getToken()}` }) },
    body: form,
  }, FILE_TIMEOUT_MS, async (resp) => {
    const json = await resp.json().catch(() => ({ code: -1, msg: '上传响应解析失败' }))
    if (resp.status === 401) unauthorized(json.msg)
    if (!resp.ok || json.code !== 0) throw new Error(json.msg || `上传失败 (${resp.status})`)
    return json.data
  })
}

export async function downloadProjectFile(projectId, file) {
  const blob = await timedRequest(`${BASE}/api/v1/projects/${projectId}/files/${file.id}/download`, {
    headers: { ...(getToken() && { Authorization: `Bearer ${getToken()}` }) },
  }, FILE_TIMEOUT_MS, async (resp) => {
    if (!resp.ok) {
      const json = await resp.json().catch(() => ({}))
      if (resp.status === 401) unauthorized(json.msg)
      throw new Error(json.msg || `下载失败 (${resp.status})`)
    }
    return resp.blob()
  })
  saveBlob(blob, file.original_name || 'research-file')
}

// SSE 流式对话：POST + ReadableStream 解析 event-stream
// callbacks: onMeta / onDelta / onDone / onError
export async function chatStream(cid, content, requestId, { onMeta, onDelta, onDone, onError }) {
  // 离线演示模式：走本地 mock 流式回复
  if (isDemoMode()) {
    const { mockChatStream } = await import('./mock/demo')
    return mockChatStream(cid, content, { onMeta, onDelta, onDone, onError })
  }
  let settled = false
  try {
    await timedRequest(`${BASE}/api/v1/conversations/${cid}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ content, request_id: requestId }),
    }, CHAT_TIMEOUT_MS, async (resp) => {
      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}))
        if (resp.status === 401) unauthorized(json.msg)
        throw new Error(json.msg || `HTTP ${resp.status}`)
      }
      if (!resp.body) throw new Error('浏览器未返回流式响应')
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const { events, rest } = parseSSE(buf)
        buf = rest
        for (const { type, raw } of events) {
          let data = null
          try { data = JSON.parse(raw) } catch { continue }
          if (type === 'meta') onMeta?.(data)
          else if (type === 'delta') onDelta?.(data.delta)
          else if (type === 'done') { settled = true; onDone?.(data) }
          else if (type === 'error') { settled = true; onError?.(data.message) }
        }
      }
      if (!settled) throw new Error('流式响应提前中断，请重试同一条消息')
    })
  } catch (error) {
    if (!settled) onError?.(error.message || '网络连接异常')
  }
}

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

globalThis.window = globalThis
const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
}
const session = new Map()
globalThis.sessionStorage = {
  getItem: (key) => session.get(key) || null,
  setItem: (key, value) => session.set(key, value),
  removeItem: (key) => session.delete(key),
}
globalThis.location = { pathname: '/', assign: () => {} }

const source = await readFile(new URL('../src/api.js', import.meta.url), 'utf8')
const client = await import(`data:text/javascript,${encodeURIComponent(source)}`)
client.setToken('test-token')

let calls = 0
globalThis.fetch = async () => {
  calls++
  return new Response(JSON.stringify(calls === 1
    ? { code: 50002, msg: '暂不可用' }
    : { code: 0, data: { status: 'ready' } }), {
    status: calls === 1 ? 503 : 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
assert.deepEqual(await client.api('GET', '/api/ready'), { status: 'ready' })
assert.equal(calls, 2, 'GET 应短暂重试')

calls = 0
globalThis.fetch = async () => {
  calls++
  return new Response(JSON.stringify({ code: 50002, msg: '失败' }), { status: 503 })
}
await assert.rejects(client.api('POST', '/api/v1/projects', { name: 'X' }))
assert.equal(calls, 1, '写入请求不能自动重试')

let streamError = ''
globalThis.fetch = async () => new Response(new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode('event: meta\ndata: {}\n\n'))
    controller.close()
  },
}), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
await client.chatStream('conversation-id', 'hello', 'request-id', { onError: (error) => { streamError = error } })
assert.match(streamError, /提前中断/, '无 done 的聊天流应报错')

let opened = 0
let connected = 0
globalThis.fetch = async (url, options) => {
  assert.equal(url, '/api/v1/projects/project-id/events')
  assert.equal(options.headers.Authorization, 'Bearer test-token')
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('event: connected\ndata: {"ok":true}\n\n'))
      options.signal.addEventListener('abort', () => controller.error(new Error('closed')))
    },
  })
  return new Response(body, { status: 200 })
}
const subscription = client.subscribeProjectEvents('project-id', {
  onOpen: () => { opened++ },
  onEvent: (name) => { if (name === 'connected') connected++ },
})
await new Promise((resolve) => setTimeout(resolve, 30))
subscription.close()
assert.equal(opened, 1)
assert.equal(connected, 1)

console.log('[test:api] GET 重试、写入不重试、聊天 EOF、鉴权事件流均通过')

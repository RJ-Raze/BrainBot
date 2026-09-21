import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const storage = new Map()
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
}

const source = await readFile(new URL('../src/mock/demo.js', import.meta.url), 'utf8')
const { mockApi, resetDemoDb } = await import(`data:text/javascript,${encodeURIComponent(source)}`)

resetDemoDb()
const joined = await mockApi('POST', '/api/v1/projects/join', { invite_code: ' research ' })

assert.ok(joined.project?.id, '演示邀请码 RESEARCH 应能查询到项目')
assert.ok(joined.roles.length > 0, '成功加入查询应返回可认领角色')

console.log('[test:demo-join] RESEARCH 邀请码可查询演示项目')

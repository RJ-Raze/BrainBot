/**
 * 知识星图 · 记忆网络（Language Explorer「粒子地球」→ BRAINBOT 语义映射）
 *
 * 粒子 = 记忆条目；连线 = 协作关联；缓慢漂移 + 鼠标视差。
 * 纯 three.js 逻辑，无框架依赖，可整体移除。
 * 逐帧动画只修改 TypedArray / three 对象属性，绝不触碰 Vue 响应式系统。
 *
 * 主题适配（v2）：
 *   dark  → 灰度白系（#f5f5f7 基准，AdditiveBlending 自发光）
 *   light → 低饱和蓝灰系（#6366F1 柔化，降低 opacity 避免刺眼）
 *   blue  → 界面蓝系（#5F86FF + #A9C2FF 分层）
 */
import * as THREE from 'three'

export type ThemeName = 'dark' | 'light' | 'blue'

export interface MemoryNetworkOptions {
  nodeCount: number
  linkCount: number
  theme?: ThemeName
}

export interface MemoryNetwork {
  group: THREE.Group
  update(delta: number, elapsed: number, pointer: { x: number; y: number }): void
  dispose(): void
  /** 运行时切换主题 — 重新给 material 上色 */
  applyTheme(theme: ThemeName): void
}

const BOUND_X = 8
const BOUND_Y = 4.2
const BOUND_Z = 3.2

/** 主题调色板 — 所有 three.js 颜色都从这里取 */
function themePalette(theme: ThemeName) {
  if (theme === 'dark') {
    return {
      // 粒子贴图：纯白发光中心
      particleCenter: 'rgba(255,255,255,1)',
      particleMid:    'rgba(255,255,255,0.45)',
      particleEdge:   'rgba(255,255,255,0)',
      // 中枢节点 + 连线
      hubColor: 0xf5f5f7,
      linkColor: 0xf5f5f7,
      // 节点灰度区间（0..1），越深越亮
      nodeRange: [0.35, 1.0] as [number, number],
      // 透明度
      nodeOpacity: 0.85,
      hubOpacity: 0.55,
      linkOpacity: 0.10,
      linkBreath: 0.03,
      // 混合模式
      blending: THREE.AdditiveBlending as THREE.Blending,
    }
  }
  if (theme === 'blue') {
    // 未来界面蓝 — 粒子用界面蓝 #5F86FF，中枢用科技浅蓝 #A9C2FF
    return {
      particleCenter: 'rgba(95,134,255,0.9)',
      particleMid:    'rgba(95,134,255,0.28)',
      particleEdge:   'rgba(95,134,255,0)',
      hubColor: 0xA9C2FF,
      linkColor: 0x5F86FF,
      nodeRange: [0.55, 1.0],
      nodeOpacity: 0.55,
      hubOpacity: 0.40,
      linkOpacity: 0.07,
      linkBreath: 0.025,
      blending: THREE.NormalBlending as THREE.Blending,
    }
  }
  // light
  // 浅色常规 — 低饱和蓝紫 #6366F1，弱化避免刺眼
  return {
    particleCenter: 'rgba(99,102,241,0.85)',
    particleMid:    'rgba(99,102,241,0.22)',
    particleEdge:   'rgba(99,102,241,0)',
    hubColor: 0x818CF8,
    linkColor: 0x6366F1,
    nodeRange: [0.55, 1.0],
    nodeOpacity: 0.40,
    hubOpacity: 0.30,
    linkOpacity: 0.06,
    linkBreath: 0.02,
    blending: THREE.NormalBlending as THREE.Blending,
  }
}

/** 圆形光点贴图（主题感知） */
function makeSpriteTexture(pal: ReturnType<typeof themePalette>): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, pal.particleCenter)
  g.addColorStop(0.35, pal.particleMid)
  g.addColorStop(1, pal.particleEdge)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

export function createMemoryNetwork(opts: MemoryNetworkOptions): MemoryNetwork {
  const theme: ThemeName = opts.theme || 'dark'
  let pal = themePalette(theme)
  let texture = makeSpriteTexture(pal)

  const group = new THREE.Group()

  /* ---------- 节点（记忆条目） ---------- */
  const nodeCount = opts.nodeCount
  const linkCount = opts.linkCount
  const positions = new Float32Array(nodeCount * 3)
  const velocities = new Float32Array(nodeCount * 3)
  const colors = new Float32Array(nodeCount * 3)
  for (let i = 0; i < nodeCount; i++) {
    positions[i * 3] = (Math.random() * 2 - 1) * BOUND_X
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * BOUND_Y
    positions[i * 3 + 2] = (Math.random() * 2 - 1) * BOUND_Z
    velocities[i * 3] = (Math.random() * 2 - 1) * 0.06
    velocities[i * 3 + 1] = (Math.random() * 2 - 1) * 0.04
    velocities[i * 3 + 2] = (Math.random() * 2 - 1) * 0.05
    const [lo, hi] = pal.nodeRange
    const b = lo + Math.random() * (hi - lo)
    colors[i * 3] = b
    colors[i * 3 + 1] = b
    colors[i * 3 + 2] = b
  }
  const nodeGeo = new THREE.BufferGeometry()
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  nodeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const nodeMat = new THREE.PointsMaterial({
    size: 0.045,
    sizeAttenuation: true,
    vertexColors: true,
    map: texture,
    transparent: true,
    opacity: pal.nodeOpacity,
    depthWrite: false,
    blending: pal.blending,
  })
  const nodes = new THREE.Points(nodeGeo, nodeMat)
  group.add(nodes)

  /* ---------- 中枢节点（少量大光点，增加纵深） ---------- */
  const hubCount = Math.max(12, Math.floor(nodeCount / 70))
  const hubPositions = new Float32Array(hubCount * 3)
  for (let i = 0; i < hubCount; i++) {
    hubPositions[i * 3] = (Math.random() * 2 - 1) * BOUND_X
    hubPositions[i * 3 + 1] = (Math.random() * 2 - 1) * BOUND_Y
    hubPositions[i * 3 + 2] = (Math.random() * 2 - 1) * BOUND_Z
  }
  const hubGeo = new THREE.BufferGeometry()
  hubGeo.setAttribute('position', new THREE.BufferAttribute(hubPositions, 3))
  const hubMat = new THREE.PointsMaterial({
    size: 0.12,
    sizeAttenuation: true,
    color: pal.hubColor,
    map: texture,
    transparent: true,
    opacity: pal.hubOpacity,
    depthWrite: false,
    blending: pal.blending,
  })
  const hubs = new THREE.Points(hubGeo, hubMat)
  group.add(hubs)

  /* ---------- 连线（协作关联） ---------- */
  const linkPairs: Array<[number, number]> = []
  const maxDist = 2.4
  let attempts = 0
  while (linkPairs.length < linkCount && attempts < linkCount * 40) {
    attempts++
    const a = Math.floor(Math.random() * nodeCount)
    const b = Math.floor(Math.random() * nodeCount)
    if (a === b) continue
    const dx = positions[a * 3] - positions[b * 3]
    const dy = positions[a * 3 + 1] - positions[b * 3 + 1]
    const dz = positions[a * 3 + 2] - positions[b * 3 + 2]
    if (dx * dx + dy * dy + dz * dz < maxDist * maxDist) linkPairs.push([a, b])
  }
  const linkPositions = new Float32Array(linkPairs.length * 6)
  const linkGeo = new THREE.BufferGeometry()
  linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPositions, 3))
  const linkMat = new THREE.LineBasicMaterial({
    color: pal.linkColor,
    transparent: true,
    opacity: pal.linkOpacity,
    depthWrite: false,
    blending: pal.blending,
  })
  const links = new THREE.LineSegments(linkGeo, linkMat)
  group.add(links)

  /* ---------- 主题热切换 ---------- */
  function applyTheme(newTheme: ThemeName) {
    const newPal = themePalette(newTheme)
    // 重绘粒子贴图
    texture.dispose()
    texture = makeSpriteTexture(newPal)
    nodeMat.map = texture
    hubMat.map = texture
    // 中枢 + 连线颜色
    hubMat.color.setHex(newPal.hubColor)
    linkMat.color.setHex(newPal.linkColor)
    // 透明度 + 混合模式
    nodeMat.opacity = newPal.nodeOpacity
    hubMat.opacity = newPal.hubOpacity
    linkMat.opacity = newPal.linkOpacity
    nodeMat.blending = newPal.blending
    hubMat.blending = newPal.blending
    linkMat.blending = newPal.blending
    // 节点灰度重采样
    const [lo, hi] = newPal.nodeRange
    const arr = colors
    for (let i = 0; i < nodeCount; i++) {
      const b = lo + Math.random() * (hi - lo)
      arr[i * 3] = b; arr[i * 3 + 1] = b; arr[i * 3 + 2] = b
    }
    nodeGeo.attributes.color.needsUpdate = true
    pal = newPal
  }

  return {
    group,
    update(delta, elapsed, pointer) {
      /* 节点漂移 + 边界回绕 */
      for (let i = 0; i < nodeCount; i++) {
        const ix = i * 3
        const iy = ix + 1
        const iz = ix + 2
        positions[ix] += velocities[ix] * delta
        positions[iy] += velocities[iy] * delta
        positions[iz] += velocities[iz] * delta
        if (positions[ix] > BOUND_X) positions[ix] -= BOUND_X * 2
        else if (positions[ix] < -BOUND_X) positions[ix] += BOUND_X * 2
        if (positions[iy] > BOUND_Y) positions[iy] -= BOUND_Y * 2
        else if (positions[iy] < -BOUND_Y) positions[iy] += BOUND_Y * 2
        if (positions[iz] > BOUND_Z) positions[iz] -= BOUND_Z * 2
        else if (positions[iz] < -BOUND_Z) positions[iz] += BOUND_Z * 2
      }
      nodeGeo.attributes.position.needsUpdate = true

      /* 连线跟随节点 */
      for (let k = 0; k < linkPairs.length; k++) {
        const a = linkPairs[k][0]
        const b = linkPairs[k][1]
        linkPositions[k * 6] = positions[a * 3]
        linkPositions[k * 6 + 1] = positions[a * 3 + 1]
        linkPositions[k * 6 + 2] = positions[a * 3 + 2]
        linkPositions[k * 6 + 3] = positions[b * 3]
        linkPositions[k * 6 + 4] = positions[b * 3 + 1]
        linkPositions[k * 6 + 5] = positions[b * 3 + 2]
      }
      linkGeo.attributes.position.needsUpdate = true

      /* 群组缓旋 + 连线呼吸 + 鼠标视差（lerp 平滑） */
      group.rotation.y = elapsed * 0.03
      group.rotation.x = Math.sin(elapsed * 0.05) * 0.04
      linkMat.opacity = pal.linkOpacity + Math.sin(elapsed * 0.6) * pal.linkBreath
      const t = Math.min(1, delta * 2)
      group.position.x += (pointer.x * 0.4 - group.position.x) * t
      group.position.y += (-pointer.y * 0.3 - group.position.y) * t
    },
    applyTheme,
    dispose() {
      nodeGeo.dispose(); nodeMat.dispose()
      hubGeo.dispose(); hubMat.dispose()
      linkGeo.dispose(); linkMat.dispose()
      texture.dispose()
    },
  }
}

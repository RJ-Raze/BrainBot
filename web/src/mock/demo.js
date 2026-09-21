/**
 * ============================================================
 * 离线演示模式（Mock 层）
 * ------------------------------------------------------------
 * 用途：后端 / PostgreSQL 未启动时，仅靠前端预览完整产品流程。
 * 数据形状严格对齐 server/scripts/seed-demo.js 与各路由 *View()。
 *
 * 开关：localStorage['bb_demo'] === '1'
 *   - 登录页点「填入演示账号」自动开启
 *   - 真实后端启动后，不用本文件的任何入口即可自动走回真实接口
 *   - 整体移除：删除本文件 + 还原 api.js / main.js / Login.vue 中引用
 * ============================================================
 */

const DEMO_FLAG = 'bb_demo'

export function isDemoMode() {
  try { return localStorage.getItem(DEMO_FLAG) === '1' } catch { return false }
}
export function enableDemo() {
  localStorage.setItem(DEMO_FLAG, '1')
}
export function disableDemo() {
  localStorage.removeItem(DEMO_FLAG)
  localStorage.removeItem('token')
}

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms))
const uid = (p) => `${p}-${Math.random().toString(16).slice(2, 10)}`
const now = () => new Date().toISOString()
const P = (n = 2) => {
  const s = '0123456789abcdef'
  let r = ''
  for (let i = 0; i < n; i++) r += s[Math.floor(Math.random() * 16)]
  return r
}
const uuid = () => `${P(8)}-${P(4)}-4${P(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${P(3)}-${P(12)}`

// ------------------------------------------------------------
// 当前演示用户（token 形如 demo.<username>）
// ------------------------------------------------------------
function currentUsername() {
  const t = (localStorage.getItem('token') || '').split('.')
  return t[0] === 'demo' && t[1] ? t[1] : 'yun_tianming'
}

// ------------------------------------------------------------
// 固定 ID（与 seed-demo 对齐，保证页面间跳转引用一致）
// ------------------------------------------------------------
const U_LEADER = '11111111-1111-4111-8111-111111111111'
const U_CURATOR = '22222222-2222-4222-8222-222222222222'
const U_VERIFIER = '33333333-3333-4333-8333-333333333333'
const PID = 'a0000000-0000-4000-8000-000000000001'
const RID_LEADER = 'b0000000-0000-4000-8000-000000000001'
const RID_CURATOR = 'b0000000-0000-4000-8000-000000000002'
const RID_VERIFIER = 'b0000000-0000-4000-8000-000000000003'
const CID = '00000000-0000-4000-8000-000000000001'
const PAPER1 = 'c0000000-0000-4000-8000-000000000001'
const PAPER2 = 'c0000000-0000-4000-8000-000000000002'
const PAPER3 = 'c0000000-0000-4000-8000-000000000003'
const CARD1 = 'd0000000-0000-4000-8000-000000000001'
const CARD2 = 'd0000000-0000-4000-8000-000000000002'
const CARD3 = 'd0000000-0000-4000-8000-000000000003'
const DIR1 = 'e0000000-0000-4000-8000-000000000001'
const DIR2 = 'e0000000-0000-4000-8000-000000000002'
const DIR3 = 'e0000000-0000-4000-8000-000000000003'
const TASK1 = 'f0000000-0000-4000-8000-000000000001'
const TASK2 = 'f0000000-0000-4000-8000-000000000002'
const TASK3 = 'f0000000-0000-4000-8000-000000000003'
const TASK4 = 'f0000000-0000-4000-8000-000000000004'
const TASK5 = 'f0000000-0000-4000-8000-000000000005'
const TASK6 = 'f0000000-0000-4000-8000-000000000006'
const TASK7 = 'f0000000-0000-4000-8000-000000000007'
const TASK8 = 'f0000000-0000-4000-8000-000000000008'
const TASK9 = 'f0000000-0000-4000-8000-000000000009'
const TASK10 = 'f0000000-0000-4000-8000-00000000000a'
const TASK11 = 'f0000000-0000-4000-8000-00000000000b'
const TASK12 = 'f0000000-0000-4000-8000-00000000000c'
const EXP1 = '91000000-0000-4000-8000-000000000001'
const EXP2 = '91000000-0000-4000-8000-000000000002'
const EXP3 = '91000000-0000-4000-8000-000000000003'
const DOC1 = '92000000-0000-4000-8000-000000000001'
const MEM1 = '93000000-0000-4000-8000-000000000001'
const MEM2 = '93000000-0000-4000-8000-000000000002'
const MEM3 = '93000000-0000-4000-8000-000000000003'
const MEM4 = '93000000-0000-4000-8000-000000000004'
const MSG_USER = '94000000-0000-4000-8000-000000000001'
const MSG_AI = '94000000-0000-4000-8000-000000000002'

const masterContent = `# 无走样 3D 高斯溅射 · Mip-Splatting 复现 · 项目总文档

> 本文档由共享记忆自动聚合生成，素材全部来自团队记忆库，可追溯来源。

## 决策记录

- 首轮只验证「3D 频率约束」与「2D Mip 滤波」两条独立因果链，不引入动态场景与多尺度混合输入。
- 评测协议本身列为方法的一部分：单尺度训练、跨尺度测试，先定协议再比对指标。

## 结论

- 放大伪影的根因是 3D 高斯基元频率越界：约 12% 的基元退化至采样极限以下。
- 缩小膨胀的根因是 dilation 滤波尺寸不随采样率变化；与上一条是两条独立因果链，修复手段不可互换。

## 风险

- 输入本身多尺度混合时（手机随手拍 + 航拍），现有扫描协议需扩展该维度对照。
- 引入两级滤波后的实时性（≥30 fps @1080p）尚未复测，属 D3 范围。

## 文献卡片

- 《Mip-Splatting: Alias-free 3D Gaussian Splatting》：把跨尺度走样拆成 3D 与 2D 两条因果链，两个修复模块不可互相替代。
- 《3D Gaussian Splatting for Real-Time Radiance Field Rendering》：基线方法，同尺度表现优异但跨尺度退化明显。
- 《2D Gaussian Splatting for Geometrically Accurate Radiance Fields》：以面元约束几何，可作为几何质量的对照参考。

## 实验下一步

- 完成 9 格点跨尺度扫描（当前 5/9），明确标出各方案的失效区间。
- 四组消融必须齐全，否则不得把联合收益归给单一模块。
`

// ------------------------------------------------------------
// 内存数据库（结构 = 对外 snake_case 形状，view 组装时零成本）
// ------------------------------------------------------------
function freshDb() {
  const users = [
    { id: U_LEADER, username: 'yun_tianming', display_name: '云天明 · 表示建模', email: null, avatar_url: null, created_at: now() },
    { id: U_CURATOR, username: 'lu_renzhen', display_name: '鹿认真 · 渲染工程', email: null, avatar_url: null, created_at: now() },
    { id: U_VERIFIER, username: 'hua_xuepin', display_name: '化学品 · 实验评测', email: null, avatar_url: null, created_at: now() },
  ]
  const projects = [{
    id: PID, name: '无走样 3D 高斯溅射 · Mip-Splatting 复现',
    description: '真实科研复现项目：针对 3DGS 在改变采样率（焦距 / 相机距离）时产生的走样伪影，验证「3D 频率约束 + 2D Mip 滤波」两条修复路径，并回答单尺度训练能否泛化到多尺度。',
    domain: '计算机图形学 / 三维重建', status: 1, invite_code: 'RESEARCH', owner_id: U_LEADER,
    created_at: now(), updated_at: now(),
  }]
  const roles = [
    { id: RID_LEADER, project_id: PID, name: '表示建模', description: '负责 3D 高斯基元的数学性质：协方差、频率约束、退化判据与表示层方案。', member_name: '云天明', system_prompt: '你是「无走样 3D 高斯溅射」项目的表示建模负责人，成员是云天明。你关注的是一切与「三维基元的数学性质」有关的问题：高斯基元的协方差与各向异性、频域特性、与采样定理的关系、退化与约束的设计。\n\n回答风格：先给数学直觉，再给可执行的结论。涉及频域问题时必须说明前提假设。不确定的地方明确标注「待验证」。\n\n职责边界：你只对 3D 表示层负责。2D 渲染管线的问题交给渲染工程，实验结论的统计口径交给实验评测。发现跨角色依赖时，明确指出应协作的事项，不要越界替他人下结论。', llm_config: {}, temp_limit: 0.6, color: '#5B8FF9', icon: null, sort_order: 0, is_archived: false, created_at: now() },
    { id: RID_CURATOR, project_id: PID, name: '渲染工程', description: '负责从场景表示到像素的实现：光栅化、滤波算子、屏幕空间膨胀、多分辨率训练与性能权衡。', member_name: '鹿认真', system_prompt: '你是「无走样 3D 高斯溅射」项目的渲染工程负责人，成员是鹿认真。你关注的是从场景表示到像素的每一步实现：光栅化管线、滤波算子的形式与尺寸、屏幕空间膨胀、多分辨率训练策略，以及显存与帧率的权衡。\n\n回答风格：给可落地的实现方案与具体参数，说明每一步的代价（显存、时间、精度）。代码与算子行为以实际可复现为准，不接受「理论上应该」。\n\n职责边界：你只对渲染与工程实现负责。3D 基元的数学约束交给表示建模，评测指标的定义与证据口径交给实验评测。', llm_config: {}, temp_limit: 0.5, color: '#61DDAA', icon: null, sort_order: 1, is_archived: false, created_at: now() },
    { id: RID_VERIFIER, project_id: PID, name: '实验评测', description: '负责实验设计与证据质量：跨尺度评测协议、基线选择、消融设计、指标口径与结论边界。', member_name: '化学品', system_prompt: '你是「无走样 3D 高斯溅射」项目的实验评测负责人，成员是化学品。你关注的是「结论有没有证据」：跨尺度评测协议的设计、基线的选择与公平性、消融实验的完整性、指标口径，以及结论的适用边界。\n\n回答风格：任何结论都要配证据来源（数据集、尺度设置、指标数值）。主动指出结论的适用边界与反例风险。不接受未经消融验证的归因，也不接受把联合收益归给单一模块。\n\n职责边界：你只对实验设计与证据质量负责。方法本身的实现交给渲染工程，理论推导交给表示建模。', llm_config: {}, temp_limit: 0.4, color: '#F6BD16', icon: null, sort_order: 2, is_archived: false, created_at: now() },
  ]
  const members = [
    { id: 'm1', project_id: PID, user_id: U_LEADER, username: 'yun_tianming', display_name: '云天明 · 表示建模', role_id: RID_LEADER, role_name: '表示建模', is_leader: true, joined_at: now() },
    { id: 'm2', project_id: PID, user_id: U_CURATOR, username: 'lu_renzhen', display_name: '鹿认真 · 渲染工程', role_id: RID_CURATOR, role_name: '渲染工程', is_leader: false, joined_at: now() },
    { id: 'm3', project_id: PID, user_id: U_VERIFIER, username: 'hua_xuepin', display_name: '化学品 · 实验评测', role_id: RID_VERIFIER, role_name: '实验评测', is_leader: false, joined_at: now() },
  ]
  const tasks = [
    // ---- 阶段 A · 基线与问题定位 ----
    { id: TASK1, project_id: PID, title: 'A1 · 复现 3DGS 基线并冻结单尺度训练协议', description: '在 Mip-NeRF 360 上复现原版 3DGS，固定训练分辨率与焦距，锁定随机种子与环境版本。产出可复现的基线 PSNR / SSIM / LPIPS 数值表，作为后续全部对比的锚点。', priority: 'P0', status: 'done', progress: 100, role_id: RID_LEADER, role_name: '表示建模', member_name: '云天明', match_reasoning: '', created_at: now() },
    { id: TASK2, project_id: PID, title: 'A2 · 构建「焦距 × 相机距离」跨尺度测试扫描协议', description: '论文主张「单尺度训练、多尺度测试」，评测协议本身就是方法的一部分。设计二维扫描矩阵：焦距 {0.5×, 1×, 2×} × 相机距离 {近, 中, 远}，明确每个格点的采样率定义与指标口径。', priority: 'P0', status: 'done', progress: 100, role_id: RID_VERIFIER, role_name: '实验评测', member_name: '化学品', match_reasoning: '', created_at: now() },
    // ---- 阶段 B · 问题归因 ----
    { id: TASK3, project_id: PID, title: 'B1 · 定位退化高斯基元的频率越界', description: '验证关键假说：3DGS 的收缩偏置会让高斯基元退化成近似 δ 函数，其 3D 空间频率超出输入视图可表达的采样上限。产出退化程度与采样率的量化关系。', priority: 'P0', status: 'done', progress: 100, role_id: RID_LEADER, role_name: '表示建模', member_name: '云天明', match_reasoning: '', created_at: now() },
    { id: TASK4, project_id: PID, title: 'B2 · 量化 2D dilation 在跨尺度下的展宽偏差', description: '在屏幕空间统计 dilation 算子引入的额外展宽量，绘制「采样率 → 展宽偏差」曲线，确认它是否为缩小视角下「辐条变粗」的直接原因。', priority: 'P0', status: 'review', progress: 90, role_id: RID_CURATOR, role_name: '渲染工程', member_name: '鹿认真', match_reasoning: '', created_at: now() },
    // ---- 阶段 C · 方法实现 ----
    { id: TASK5, project_id: PID, title: 'C1 · 设计 3D 平滑滤波：由最大采样频率约束基元尺寸', description: '从输入视图推导最大采样频率，据此为每个 3D 高斯设定尺寸上限（3D 空间低通滤波）。关键性质：滤波尺寸由训练图像决定而非待渲染图像——这是与 EWA Splatting 的本质区别。', priority: 'P1', status: 'doing', progress: 60, role_id: RID_LEADER, role_name: '表示建模', member_name: '云天明', match_reasoning: '', created_at: now() },
    { id: TASK6, project_id: PID, title: 'C2 · 用 2D Mip 滤波替换 dilation', description: '用近似物理成像 box filter 的 2D Mip 滤波替换现有屏幕空间 dilation，使滤波核尺寸随采样率自适应，而非固定经验值。实现须兼容现有 tile-based 光栅化管线，不破坏实时性。', priority: 'P1', status: 'doing', progress: 25, role_id: RID_CURATOR, role_name: '渲染工程', member_name: '鹿认真', match_reasoning: '', created_at: now() },
    { id: TASK7, project_id: PID, title: 'C3 · 引入多分辨率训练策略', description: '在训练中混入不同分辨率视图，使模型见过多尺度采样模式。需评估显存与训练时长代价，以及是否与 C1 的 3D 约束叠加或冲突。', priority: 'P1', status: 'todo', progress: 0, role_id: RID_CURATOR, role_name: '渲染工程', member_name: '鹿认真', match_reasoning: '', created_at: now() },
    // ---- 阶段 D · 评测与消融 ----
    { id: TASK8, project_id: PID, title: 'D1 · 跨尺度定量评测：对比 3DGS 与 EWA Splatting', description: '按 A2 协议对比三条方案，重点看分布外尺度（放大与缩小）的差距，而非同尺度下的绝对数值——后者三家差异不大，正是走样被掩盖的地方。', priority: 'P1', status: 'todo', progress: 0, role_id: RID_VERIFIER, role_name: '实验评测', member_name: '化学品', match_reasoning: '', created_at: now() },
    { id: TASK9, project_id: PID, title: 'D2 · 消融实验：分离 3D 滤波与 2D Mip 的独立贡献', description: '四组配置：都不加 / 仅 3D / 仅 2D / 两者都加。确认两个模块各自的增益与耦合效应，避免把联合收益归给单一模块。', priority: 'P1', status: 'todo', progress: 0, role_id: RID_VERIFIER, role_name: '实验评测', member_name: '化学品', match_reasoning: '', created_at: now() },
    { id: TASK10, project_id: PID, title: 'D3 · 渲染质量与帧率的权衡分析', description: '测量引入两级滤波后的帧率变化与显存占用，确认实时性（≥30 fps @1080p）未被破坏，给出不同硬件档位的推荐配置。', priority: 'P2', status: 'todo', progress: 0, role_id: RID_CURATOR, role_name: '渲染工程', member_name: '鹿认真', match_reasoning: '', created_at: now() },
    // ---- 阶段 E · 结论沉淀 ----
    { id: TASK11, project_id: PID, title: 'E1 · 结论审定：单尺度训练能否泛化到多尺度', description: '汇总 D 阶段全部证据，明确回答问题并标注成立条件（数据集、尺度范围、硬件）与已知反例风险。形成可被外部评审检验的结论陈述。', priority: 'P2', status: 'todo', progress: 0, role_id: RID_LEADER, role_name: '表示建模', member_name: '云天明', match_reasoning: '', created_at: now() },
    { id: TASK12, project_id: PID, title: 'E2 · 复现包整理与实验文档沉淀', description: '固化随机种子、环境版本、评测脚本与结果表，产出可被第三方独立复现的最小包，并同步结论与未解决问题到项目总文档。', priority: 'P2', status: 'todo', progress: 0, role_id: RID_VERIFIER, role_name: '实验评测', member_name: '化学品', match_reasoning: '', created_at: now() },
  ]
  const papers = [
    { id: PAPER1, project_id: PID, source: 'arxiv', external_id: '2311.16493', title: 'Mip-Splatting: Alias-free 3D Gaussian Splatting', authors: ['Zehao Yu', 'Anpei Chen', 'Binbin Huang', 'Torsten Sattler', 'Andreas Geiger'], abstract: 'Recently, 3D Gaussian Splatting has demonstrated impressive novel view synthesis results, reaching high fidelity and efficiency. However, strong artifacts can be observed when changing the sampling rate, e.g., by changing focal length or camera distance. We find that the source for this phenomenon can be attributed to the lack of 3D frequency constraints and the usage of a 2D dilation filter. To address this problem, we introduce a 3D smoothing filter which constrains the size of the 3D Gaussian primitives based on the maximal sampling frequency induced by the input views, eliminating high-frequency artifacts when zooming in. Moreover, replacing 2D dilation with a 2D Mip filter, which simulates a 2D box filter, effectively mitigates aliasing and dilation issues.', year: 2024, venue: 'CVPR 2024 (IEEE/CVF Conference on Computer Vision and Pattern Recognition)', doi: '10.1109/cvpr52733.2024.01839', pdf_url: 'https://arxiv.org/abs/2311.16493', code_url: 'https://github.com/autonomousvision/mip-splatting', keywords: ['3D Gaussian Splatting', 'anti-aliasing', 'sampling rate', 'novel view synthesis'], citation_count: 511, created_at: '2026-09-10T09:00:00.000Z' },
    { id: PAPER2, project_id: PID, source: 'arxiv', external_id: '2308.04079', title: '3D Gaussian Splatting for Real-Time Radiance Field Rendering', authors: ['Bernhard Kerbl', 'Georgios Kopanas', 'Thomas Leimkühler', 'George Drettakis'], abstract: 'Radiance Field methods have recently revolutionized novel-view synthesis of scenes captured with multiple photos or videos. However, achieving high visual quality still requires neural networks that are costly to train and render, while recent faster methods inevitably trade off speed for quality. We introduce three key elements that allow us to achieve state-of-the-art visual quality while maintaining competitive training times and importantly allow high-quality real-time (>= 30 fps) novel-view synthesis at 1080p resolution.', year: 2023, venue: 'ACM SIGGRAPH 2023 / ACM Transactions on Graphics 42(4)', doi: '10.1145/3592433', pdf_url: 'https://arxiv.org/abs/2308.04079', code_url: 'https://github.com/graphdeco-inria/gaussian-splatting', keywords: ['3D Gaussian Splatting', 'radiance field', 'real-time rendering'], citation_count: 5550, created_at: '2026-09-10T09:10:00.000Z' },
    { id: PAPER3, project_id: PID, source: 'arxiv', external_id: '2402.13233', title: '2D Gaussian Splatting for Geometrically Accurate Radiance Fields', authors: ['Binbin Huang', 'Zehao Yu', 'Anpei Chen', 'Andreas Geiger', 'Shenghua Gao'], abstract: 'We present 2D Gaussian Splatting (2DGS), a novel approach to model and reconstruct geometrically accurate radiance fields from multi-view images. Our 2D Gaussian primitive is a planar disk, which provides a more compact and accurate representation of surfaces than 3D Gaussians, and supports high-quality mesh extraction.', year: 2024, venue: 'ACM SIGGRAPH 2024', doi: '10.1145/3641519.3657428', pdf_url: 'https://arxiv.org/abs/2402.13233', code_url: null, keywords: ['2D Gaussian', 'surface reconstruction', 'radiance field'], citation_count: 626, created_at: '2026-09-10T09:20:00.000Z' },
  ]
  const cards = [
    { id: CARD1, project_id: PID, paper_id: PAPER1, role_id: RID_LEADER, role_name: '表示建模', author_user_id: U_LEADER, author_name: '云天明 · 表示建模', notes: '论文把「跨尺度走样」拆成两条独立因果链，这是全文最关键的判断：\n\n① 3D 侧：3DGS 的收缩偏置让高斯基元退化到超出采样极限，等价于在 3D 空间放了一个近似 δ 函数——放大视角时高频信息无处安放，形成高频伪影。\n② 2D 侧：屏幕空间 dilation 是为了「把太薄的东西撑起来」，但它的尺寸是固定的，因此在缩小视角（采样率下降）时展宽过度，出现「辐条变粗」。\n\n两个修复各自针对一条因果链：3D 平滑滤波（约束基元尺寸上限）治放大伪影，2D Mip 滤波（模拟物理 box filter）治缩小的走样与膨胀。这也解释了为什么消融必须拆成四组——两个模块的收益不可互相替代。\n\n适用边界：结论建立在静态场景、且输入视图采样率一致的前提上。', tags: ['走样', '频率约束', '因果链'], is_shared: true, rating: 5, paper: papers[0], created_at: now(), updated_at: now() },
    { id: CARD2, project_id: PID, paper_id: PAPER2, role_id: RID_CURATOR, role_name: '渲染工程', author_user_id: U_CURATOR, author_name: '鹿认真 · 渲染工程', notes: '作为全项目的对照基线，这篇工作的价值在于「同尺度下几乎无可挑剔」：用显式三维高斯替代隐式网络，训练压到分钟级、渲染实时，1080p 下 ≥30 fps。\n\n但它的评测全部在同分布尺度下完成（训练与测试焦距一致），因此跨尺度退化被完全掩盖——这正是本项目要暴露的问题。\n\n工程上可直接复用的部分：tile-based 光栅化管线、各向异性协方差的优化方式、自适应密度控制（分裂与克隆）。\n\n注意：屏幕空间 dilation 属于实现细节而非理论必需——这一点给了 2D Mip 滤波的替换空间。', tags: ['基线', '光栅化', '实时渲染'], is_shared: true, rating: 5, paper: papers[1], created_at: now(), updated_at: now() },
    { id: CARD3, project_id: PID, paper_id: PAPER3, role_id: RID_VERIFIER, role_name: '实验评测', author_user_id: U_VERIFIER, author_name: '化学品 · 实验评测', notes: '2DGS 用「面元（planar disk）」替代体高斯，几何精度明显优于 3DGS，网格提取质量也更高。\n\n对本项目的价值主要在评测侧：它是一个强几何基线，能帮我们区分「走样是渲染滤波问题」还是「表示本身几何不准」。\n\n需要留意：2DGS 的目标是几何重建而非抗锯齿，不能直接当作抗锯齿基线来比，否则对比不公平——这一点必须在 D1 的协议里显式说明。', tags: ['几何重建', '对照基线', '评测口径'], is_shared: false, rating: 4, paper: papers[2], created_at: now(), updated_at: now() },
  ]
  const directions = [
    { id: DIR1, project_id: PID, parent_id: null, root_task_id: TASK5, name: '3D 频率约束与平滑滤波', description: '由输入视图的最大采样频率反推 3D 高斯基元的尺寸上限，从表示层面消除放大视角的高频伪影。这是本项目的主攻方向。', feasibility: 4, novelty: 4, impact: 4, evidence_count: 3, status: 'selected', created_by: U_LEADER, created_at: now(), updated_at: now() },
    { id: DIR2, project_id: PID, parent_id: null, root_task_id: TASK6, name: '2D 采样自适应滤波', description: '用近似物理成像 box filter 的 Mip 滤波替代固定尺寸的屏幕空间 dilation，使滤波核随采样率自适应。', feasibility: 5, novelty: 3, impact: 4, evidence_count: 2, status: 'exploring', created_by: U_CURATOR, created_at: now(), updated_at: now() },
    { id: DIR3, project_id: PID, parent_id: null, root_task_id: TASK2, name: '跨尺度泛化评测协议', description: '单尺度训练能否泛化到多尺度，取决于评测协议本身是否覆盖分布外尺度。本方向把「评测」也当作方法的一部分来设计。', feasibility: 5, novelty: 3, impact: 5, evidence_count: 2, status: 'exploring', created_by: U_VERIFIER, created_at: now(), updated_at: now() },
  ]
  const experiments = [
    { id: EXP1, project_id: PID, role_id: RID_LEADER, role_name: '表示建模', task_id: TASK1, direction_id: DIR1, direction_name: '3D 频率约束与平滑滤波', title: '基线复现：3DGS @ Mip-NeRF 360', hypothesis: '原版 3DGS 在同分布尺度下应达到论文报告水平，作为后续对比的可信锚点。', setup: 'Mip-NeRF 360 全部 9 个场景 · 训练 30k 迭代 · 固定随机种子与环境版本。', result: 'PSNR 27.21 / SSIM 0.815 / LPIPS 0.214，与原文报告一致（偏差 < 0.1 dB）。', metric: { psnr: 27.21, ssim: 0.815, lpips: 0.214 }, conclusion: '基线可信。所有后续跨尺度结论均以此为对照基准。', log_url: null, status: 'succeeded', run_at: '2026-09-12T09:30:00+08:00', created_by: U_LEADER, created_at: now(), updated_at: now() },
    { id: EXP2, project_id: PID, role_id: RID_LEADER, role_name: '表示建模', task_id: TASK3, direction_id: DIR1, direction_name: '3D 频率约束与平滑滤波', title: '频率分布测量：量化基元频率越界比例', hypothesis: '部分 3D 高斯基元的空间频率超出输入视图的采样极限，构成放大伪影的来源。', setup: '训练收敛后统计全部高斯基元的尺寸分布，与由输入焦距推导的理论采样极限逐一对齐。', result: '约 12% 的基元落在采样极限以下（退化区）；该比例与放大视角下的伪影强度正相关。', metric: { degraded_ratio: 0.12 }, conclusion: '假说成立。退化基元占比可作为走样风险的可量化指标。', log_url: null, status: 'succeeded', run_at: '2026-09-14T14:00:00+08:00', created_by: U_LEADER, created_at: now(), updated_at: now() },
    { id: EXP3, project_id: PID, role_id: RID_VERIFIER, role_name: '实验评测', task_id: TASK8, direction_id: DIR3, direction_name: '跨尺度泛化评测协议', title: '跨尺度对比：3DGS / EWA Splatting / 本方案', hypothesis: '本方案在分布外尺度上的优势应显著大于同尺度下的优势。', setup: '按 A2 协议执行：焦距 {0.5×, 1×, 2×} × 相机距离 {近, 中, 远}，共 9 个格点。', result: '进行中：已完成 5 / 9 个格点，缩小视角（0.5×）差距最大。', metric: {}, conclusion: '待全部格点完成后出具结论与失效区间标注。', log_url: null, status: 'running', run_at: '2026-09-18T10:00:00+08:00', created_by: U_VERIFIER, created_at: now(), updated_at: now() },
  ]
  const memories = [
    { id: MEM1, project_id: PID, category: 'conclusion', title: '放大伪影的根因：3D 高斯基元频率越界', content: '通过全场景高斯基元尺寸分布测量确认：3DGS 的收缩偏置会让部分基元退化到采样极限以下，等价于在 3D 空间放置近似 δ 函数，其空间频率超出输入视图可表达的范围。这部分基元在放大视角时贡献主要高频伪影。\n\n成立条件：静态场景、输入视图采样率一致。\n影响：决定了修复必须在 3D 表示层做低通约束，而不是只在屏幕空间补偿。', source_role_id: RID_LEADER, source_role_name: '表示建模', source_user_id: U_LEADER, source_user_name: '云天明 · 表示建模', source_msg_id: null, creator_rid: RID_LEADER, source_conversation_id: 'demo:conclusion-freq', source_message_range: { from: 'demo-conclusion-1', to: 'demo-conclusion-1' }, tags: ['3DGS', '走样', '频率约束'], importance: 5, is_pinned: true, promoted_at: now(), created_at: now() },
    { id: MEM2, project_id: PID, category: 'conclusion', title: '缩小膨胀的根因：dilation 滤波尺寸不随采样率变化', content: '屏幕空间 dilation 的核尺寸是固定经验值。缩小视角（采样率下降）时它相对像素展宽过度，形成「辐条变粗」。\n\n量化结果：展宽偏差随缩放因子单调上升，在 0.5× 焦距附近开始主导伪影。\n关键判断：这与 3D 频率越界是两条独立因果链——所以修复手段不可互换，消融必须拆成四组。', source_role_id: RID_CURATOR, source_role_name: '渲染工程', source_user_id: U_CURATOR, source_user_name: '鹿认真 · 渲染工程', source_msg_id: null, creator_rid: RID_CURATOR, source_conversation_id: 'demo:conclusion-dilation', source_message_range: { from: 'demo-conclusion-2', to: 'demo-conclusion-2' }, tags: ['dilation', '屏幕空间', '走样'], importance: 5, is_pinned: false, promoted_at: now(), created_at: now() },
    { id: MEM3, project_id: PID, category: 'decision', title: '评测必须覆盖分布外尺度，否则会掩盖走样', content: '在同尺度下对比 3DGS / EWA / 本方案，指标差异小于 0.3 dB，走样几乎不可见；只有在跨尺度测试（焦距 0.5×–2×、相机距离近–远）下差距才显著。\n\n决定：把「跨尺度评测协议」列为方法的一部分而非事后补充，并在 A2 任务中固化为二维扫描矩阵。\n边界：若输入本身是多尺度混合（手机随手拍 + 航拍），协议需额外设计该维度对照。', source_role_id: RID_VERIFIER, source_role_name: '实验评测', source_user_id: U_VERIFIER, source_user_name: '化学品 · 实验评测', source_msg_id: null, creator_rid: RID_VERIFIER, source_conversation_id: 'demo:decision-protocol', source_message_range: { from: 'demo-decision-1', to: 'demo-decision-1' }, tags: ['评测', '跨尺度', '方法论'], importance: 5, is_pinned: false, promoted_at: now(), created_at: now() },
    { id: MEM4, project_id: PID, category: 'paper_card', title: papers[0].title, content: cards[0].notes, source_role_id: RID_LEADER, source_role_name: '表示建模', source_user_id: U_LEADER, source_user_name: '云天明 · 表示建模', source_msg_id: null, creator_rid: RID_LEADER, source_conversation_id: 'demo:paper-card', source_message_range: { from: CARD1, to: CARD1 }, tags: ['走样', '频率约束', 'paper:2311.16493'], importance: 5, is_pinned: false, promoted_at: now(), created_at: now() },
  ]
  const documents = [
    { id: DOC1, project_id: PID, parent_id: null, title: '无走样 3D 高斯溅射 · Mip-Splatting 复现 · 项目总文档', content: masterContent, doc_type: 'master', is_auto_synced: true, last_editor_id: U_LEADER, last_editor_name: '云天明 · 表示建模', created_at: now(), updated_at: now(), memory_count: 4 },
  ]
  const conversations = [
    { id: CID, project_id: PID, role_id: RID_LEADER, title: '跨尺度走样归因 · 首轮共识', context_type: 'general', context_ref_id: null, message_count: 2, last_message_at: now(), is_pinned: false, is_archived: false, created_by: U_LEADER, role_name: '表示建模', role_color: '#5B8FF9', role_icon: null, created_at: now() },
  ]
  const messages = [
    { id: MSG_USER, conversation_id: CID, sender_type: 'user', sender_user_id: U_LEADER, sender_name: '我', content: '改变焦距或相机距离时出现的伪影，根因应该拆成哪几条独立的因果链来验证？', token_in: 0, token_out: 0, promoted_memory_id: null, created_at: now() },
    { id: MSG_AI, conversation_id: CID, sender_type: 'assistant', sender_user_id: null, sender_name: '表示建模', content: '建议拆成两条：3D 侧是基元尺寸退化到采样极限以下，等价于在 3D 空间放了近似 δ 函数；2D 侧是 dilation 滤波尺寸固定、不随采样率变化。两者相互独立、修复手段不可互换，因此消融必须拆成四组。建议先用尺寸分布把 3D 侧量化，再单独验证 2D 侧，避免把联合收益归给单一模块。', token_in: 0, token_out: 0, promoted_memory_id: MEM1, created_at: now() },
  ]
  const teamMessages = [
    { id: '1001', project_id: PID, sender_id: U_LEADER, sender_name: '云天明 · 表示建模', content: '基线复现完成，Mip-NeRF 360 九个场景的指标与原文一致。频率分布测下来约 12% 的基元落在采样极限以下，放大伪影的可解释性有了。', created_at: '2026-09-14T09:15:00.000Z' },
    { id: '1002', project_id: PID, sender_id: U_CURATOR, sender_name: '鹿认真 · 渲染工程', content: 'dilation 的展宽偏差曲线画出来了，0.5× 焦距附近开始主导伪影。2D Mip 滤波的替换方案我今天内出第一版。', created_at: '2026-09-15T16:40:00.000Z' },
    { id: '1003', project_id: PID, sender_id: U_VERIFIER, sender_name: '化学品 · 实验评测', content: '跨尺度扫描完成 5/9 格点，缩小视角的差距最明显。等 D1 跑完我出一张带失效区间标注的对比表。', created_at: '2026-09-18T10:20:00.000Z' },
  ]
  return { users, projects, roles, members, tasks, papers, cards, directions, experiments, memories, documents, conversations, messages, teamMessages }
}

// 单例：同一次浏览器会话内的写操作（拖看板/晋升/新建）即时生效
let db = null
function getDb() { if (!db) db = freshDb(); return db }
/** 测试用：重置内存态 */
export function resetDemoDb() { db = freshDb() }

// ------------------------------------------------------------
// 组装辅助
// ------------------------------------------------------------
function currentUser() {
  const d = getDb()
  const username = currentUsername()
  let user = d.users.find((u) => u.username === username)
  if (!user) {
    user = { id: uuid(), username, display_name: username, email: null, avatar_url: null, created_at: now() }
    d.users.push(user)
  }
  return user
}
function findProject(pid) {
  const p = getDb().projects.find((x) => x.id === pid)
  if (!p) throw new Error('项目不存在')
  return p
}
function roleNameOf(rid) {
  return getDb().roles.find((r) => r.id === rid)?.name || null
}
function withRoleName(t) {
  const r = getDb().roles.find((x) => x.id === t.role_id)
  return { ...t, role_name: r?.name || null, member_name: r?.member_name || null }
}
function projectDetail(p) {
  const d = getDb()
  return {
    ...p,
    roles: d.roles.filter((r) => r.project_id === p.id && !r.is_archived),
    members: d.members.filter((m) => m.project_id === p.id),
  }
}
function myMembership(pid, userId = currentUser().id) {
  return getDb().members.find((m) => m.project_id === pid && m.user_id === userId)
}

// ------------------------------------------------------------
// Mock API 主入口：与 api.js 真实分支一样直接返回 data、失败 throw
// ------------------------------------------------------------
export async function mockApi(method, rawPath, body) {
  await delay(120 + Math.random() * 220)
  const d = getDb()
  const [path, queryStr] = rawPath.split('?')
  const query = new URLSearchParams(queryStr || '')
  const seg = path.split('/').filter(Boolean) // ['api','v1', ...]
  const me = currentUser()

  // ---- 认证 ----
  if (seg[2] === 'auth' && seg[3] === 'me' && method === 'GET') {
    return { id: me.id, username: me.username, email: me.email, display_name: me.display_name, avatar_url: me.avatar_url, created_at: me.created_at }
  }
  if (seg[2] === 'auth' && (seg[3] === 'login' || seg[3] === 'register') && method === 'POST') {
    const username = String(body?.username || '').trim()
    if (!username || !body?.password) throw new Error('请填写用户名和密码')
    if (String(body.password).length < 6) throw new Error('密码至少 6 位（演示账号：Demo@123456）')
    let user = d.users.find((u) => u.username === username)
    if (!user) {
      user = { id: uuid(), username, display_name: body.display_name || username, email: null, avatar_url: null, created_at: now() }
      d.users.push(user)
    }
    return { token: `demo.${username}`, user: { id: user.id, username: user.username, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url, created_at: user.created_at } }
  }
  if (seg[2] === 'auth' && seg[3] === 'logout' && method === 'POST') return null

  // ---- 项目列表 / 创建 ----
  if (seg[2] === 'projects' && seg.length === 3 && method === 'GET') {
    const memberPids = new Set(d.members.filter((m) => m.user_id === me.id).map((m) => m.project_id))
    const items = d.projects
      .filter((p) => p.status !== 3 && (p.owner_id === me.id || memberPids.has(p.id)))
      .map((p) => ({ ...p, is_owner: p.owner_id === me.id }))
    return { items, total: items.length }
  }
  if (seg[2] === 'projects' && seg.length === 3 && method === 'POST') {
    if (!body?.name) throw new Error('项目名必填')
    const p = {
      id: uuid(), name: body.name, description: body.description || null, domain: body.domain || null,
      status: 0, invite_code: uid('inv').slice(-8).toUpperCase(), owner_id: me.id, created_at: now(), updated_at: now(),
    }
    d.projects.push(p)
    return p
  }

  const pid = seg[3]
  if (pid && seg[2] === 'projects') {
    // /projects/:pid
    if (seg.length === 4 && method === 'GET') return projectDetail(findProject(pid))
    if (seg.length === 4 && method === 'PATCH') {
      const p = findProject(pid)
      Object.assign(p, { name: body?.name ?? p.name, description: body?.description ?? p.description, domain: body?.domain ?? p.domain, status: body?.status ?? p.status, updated_at: now() })
      return p
    }
    if (seg.length === 4 && method === 'DELETE') { findProject(pid).status = 3; return null }

    // ---- 成员 / 角色（工作台团队页）----
    if (seg[4] === 'members' && method === 'GET') return { items: d.members.filter((m) => m.project_id === pid), total: 0 }
    if (seg[4] === 'roles' && method === 'GET') return { items: d.roles.filter((r) => r.project_id === pid), total: 0 }

    // ---- 初始化流程（创立人）----
    if (seg[4] === 'initialize' && seg[5] === undefined && method === 'POST') {
      const p = findProject(pid)
      const memberList = Array.isArray(body?.members) ? body.members : []
      if (!memberList.length) throw new Error('members 必填：至少一位成员及其分工')
      // 按提交内容建角色（幂等：同名更新）
      memberList.forEach((m, i) => {
        let role = d.roles.find((r) => r.project_id === pid && r.name === m.name)
        if (!role) {
          role = { id: uuid(), project_id: pid, name: m.name, description: m.role_description, member_name: m.name, system_prompt: `你是「${m.name}」。${m.role_description}`, llm_config: {}, temp_limit: 0.3, color: null, icon: null, sort_order: i, is_archived: false, created_at: now() }
          d.roles.push(role)
        }
        if (m.me && !d.members.find((x) => x.project_id === pid && x.user_id === me.id && x.role_id === role.id)) {
          d.members.push({ id: uuid(), project_id: pid, user_id: me.id, username: me.username, display_name: me.display_name, role_id: role.id, role_name: role.name, is_leader: true, joined_at: now() })
        }
      })
      // 清旧草案，生成三条演示草案
      d.tasks = d.tasks.filter((t) => t.project_id !== pid || t.status !== 'draft')
      const firstRole = d.roles.find((r) => r.project_id === pid)
      const mkDraft = (title, description, priority, idx) => ({
        id: uuid('draft'), project_id: pid, title, description, priority, status: 'draft',
        role_id: firstRole?.id || null, role_name: firstRole?.name || null, member_name: firstRole?.member_name || null,
        match_reasoning: '演示草案：按成员分工与项目目标匹配建议，可在确认前调整。', created_at: now(),
      })
      const tasks = [
        mkDraft(`明确「${p.name}」的目标与评估口径`, '定义可衡量的成功标准、数据边界与第一阶段验收口径。', 'P0'),
        mkDraft('拆解关键任务并确认分工', '把目标拆成可执行任务，指定负责人角色与协作关系。', 'P1'),
        mkDraft('建立共享记忆与总文档骨架', '约定结论沉淀方式，让讨论、记忆与任务在同一上下文中流转。', 'P2'),
      ]
      d.tasks.push(...tasks)
      return { tasks, unassigned_gaps: [], invite_code: p.invite_code, usage: { mock: true } }
    }
    if (seg[4] === 'initialize' && seg[5] === 'draft' && method === 'GET') {
      findProject(pid)
      return { items: d.tasks.filter((t) => t.project_id === pid && t.status === 'draft'), invite_code: findProject(pid).invite_code }
    }
    if (seg[4] === 'initialize' && seg[5] === 'confirm' && method === 'POST') {
      const p = findProject(pid)
      const list = Array.isArray(body?.tasks) ? body.tasks : []
      if (!list.length) throw new Error('确认的任务列表不能为空')
      d.tasks = d.tasks.filter((t) => t.project_id !== pid || t.status !== 'draft')
      for (const t of list) {
        d.tasks.push({
          id: uuid('task'), project_id: pid, title: String(t.title), description: t.description || null,
          priority: t.priority || 'P1', status: 'todo', role_id: t.role_id || null,
          role_name: roleNameOf(t.role_id), member_name: d.roles.find((r) => r.id === t.role_id)?.member_name || null,
          match_reasoning: t.match_reasoning || '', created_at: now(),
        })
      }
      p.status = 1
      p.updated_at = now()
      return { status: 1 }
    }

    // ---- 组队（组员）----
    if (seg[4] === 'claim-role' && method === 'POST') {
      const p = findProject(pid)
      const role = d.roles.find((r) => r.id === body?.role_id && r.project_id === pid)
      if (!role) throw new Error('角色不存在')
      // 演示模式宽容：一人一角色，允许认领已被预留的角色
      d.members = d.members.filter((m) => !(m.project_id === pid && m.user_id === me.id))
      d.members.push({ id: uuid('m'), project_id: pid, user_id: me.id, username: me.username, display_name: me.display_name, role_id: role.id, role_name: role.name, is_leader: p.owner_id === me.id, joined_at: now() })
      return { role_id: role.id, role_name: role.name }
    }

    // ---- 任务 ----
    if (seg[4] === 'tasks' && seg.length === 5 && method === 'GET') {
      let items = d.tasks.filter((t) => t.project_id === pid && t.status !== 'draft')
      if (query.get('mine') === '1') {
        const mem = myMembership(pid)
        items = items.filter((t) => t.role_id && t.role_id === mem?.role_id)
      }
      if (query.get('status')) items = items.filter((t) => t.status === query.get('status'))
      return { items: items.map(withRoleName), total: items.length }
    }
    if (seg[4] === 'tasks' && seg.length === 5 && method === 'POST') {
      if (!body?.title?.trim()) throw new Error('任务标题必填')
      const role = d.roles.find((r) => r.id === body.role_id && r.project_id === pid)
      const t = { id: uuid('task'), project_id: pid, title: body.title.trim(), description: body.description?.trim() || null, priority: body.priority || 'P1', status: 'todo', role_id: body.role_id || null, role_name: role?.name || null, member_name: role?.member_name || null, match_reasoning: '', created_at: now() }
      d.tasks.push(t)
      return withRoleName(t)
    }
    const tid = seg[5]
    if (seg[4] === 'tasks' && tid && seg.length === 6 && method === 'PATCH') {
      const t = d.tasks.find((x) => x.id === tid && x.project_id === pid)
      if (!t) throw new Error('任务不存在')
      Object.assign(t, {
        status: body?.status ?? t.status,
        title: body?.title ?? t.title,
        description: body?.description ?? t.description,
        priority: body?.priority ?? t.priority,
        role_id: body?.role_id !== undefined ? body.role_id : t.role_id,
      })
      if (body?.status === 'done' && !t.progress) t.progress = 100
      return withRoleName(t)
    }
    if (seg[4] === 'tasks' && tid && seg.length === 6 && method === 'DELETE') {
      d.tasks = d.tasks.filter((x) => x.id !== tid)
      return null
    }
    if (seg[4] === 'tasks' && tid && seg[6] === 'references' && method === 'GET') return { items: [], total: 0 }

    // ---- 共享记忆 ----
    if (seg[4] === 'memories' && (seg.length === 5 || seg[5] === 'search') && method === 'GET') {
      let items = d.memories.filter((m) => m.project_id === pid)
      const cat = query.get('category')
      if (cat) items = items.filter((m) => m.category === cat)
      const q = query.get('q')
      if (q) items = items.filter((m) => m.title.includes(q) || m.content.includes(q))
      items.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.importance - a.importance)
      return { items, total: items.length }
    }
    if (seg[4] === 'memories' && seg.length === 5 && method === 'POST') {
      const cats = ['decision', 'conclusion', 'todo', 'risk', 'snippet', 'fact', 'paper_card']
      if (!cats.includes(body?.category)) throw new Error('category 不合法')
      if (!body?.title?.trim()) throw new Error('标题必填')
      if (!body?.content?.trim()) throw new Error('正文必填')
      const myRole = d.roles.find((r) => r.id === myMembership(pid)?.role_id)
      const m = {
        id: uuid('mem'), project_id: pid, category: body.category, title: body.title.trim(), content: body.content.trim(),
        source_role_id: myRole?.id || null, source_role_name: myRole?.name || null,
        source_user_id: me.id, source_user_name: me.display_name, source_msg_id: null,
        creator_rid: 'manual', source_conversation_id: null, source_message_range: null,
        tags: Array.isArray(body.tags) ? body.tags : [], importance: Math.min(5, Math.max(1, Number(body.importance) || 3)),
        is_pinned: false, promoted_at: now(), created_at: now(),
      }
      d.memories.push(m)
      return m
    }
    // ---- 记忆溯源（离线演示合成链路）----
    if (seg[4] === 'memories' && seg[6] === 'provenance' && method === 'GET') {
      const m = d.memories.find((x) => x.id === seg[5])
      if (!m) throw new Error('记忆不存在')
      const role = d.roles.find((r) => r.id === m.source_role_id)
      const author = { id: m.source_user_id, username: '', display_name: m.source_user_name }
      const mem = { id: m.id, title: m.title, content: m.content, category: m.category, promoted_at: m.promoted_at }
      if (m.creator_rid === 'manual' || !m.source_conversation_id) return { kind: 'manual', memory: mem, role, author }
      if (m.category === 'paper_card') {
        const card = d.cards.find((c) => m.source_message_range?.from === c.id)
        const paper = card ? (card.paper || d.papers.find((p) => p.id === card.paper_id)) : null
        return {
          kind: 'paper_card', memory: mem, role, author,
          paper_card: card ? { id: card.id, notes: card.notes, evidence_quote: card.evidence_quote, evidence_status: card.evidence_status, rating: card.rating, created_at: card.created_at, role_name: card.role_name || role?.name, author_name: card.author_name || m.source_user_name, paper: paper ? { id: paper.id, title: paper.title, authors: paper.authors, year: paper.year, venue: paper.venue, doi: paper.doi, source: paper.source } : null } : null,
        }
      }
      return {
        kind: 'conversation', memory: mem, role, author,
        conversation: { id: m.source_conversation_id, title: `${role?.name || '角色'} 的协作会话`, role_name: role?.name || null },
        source_messages: [{ id: m.source_message_range?.from || 'demo-src', sender_type: 'assistant', sender_name: m.source_user_name, content: m.content, created_at: m.created_at, is_source: true }],
      }
    }
    const mid = seg[5]
    if (seg[4] === 'memories' && mid && seg.length === 6 && method === 'PATCH') {
      const m = d.memories.find((x) => x.id === mid)
      if (!m) throw new Error('记忆不存在')
      if (body.is_pinned !== undefined) m.is_pinned = !!body.is_pinned
      if (body.title !== undefined) m.title = body.title
      if (body.content !== undefined) m.content = body.content
      if (body.importance !== undefined) m.importance = body.importance
      if (body.category !== undefined) m.category = body.category
      return m
    }
    if (seg[4] === 'memories' && mid && seg.length === 6 && method === 'DELETE') {
      d.memories = d.memories.filter((x) => x.id !== mid)
      return null
    }

    // ---- 总文档 ----
    if (seg[4] === 'documents' && seg.length === 5 && method === 'GET') {
      return { items: d.documents.filter((x) => x.project_id === pid), total: 0 }
    }
    if (seg[4] === 'documents' && seg.length === 5 && method === 'POST') {
      const doc = { id: uuid('doc'), project_id: pid, parent_id: body.parent_id || null, title: body.title, content: body.content || '', doc_type: body.doc_type || 'note', is_auto_synced: false, last_editor_id: me.id, last_editor_name: me.display_name, created_at: now(), updated_at: now() }
      d.documents.push(doc)
      return doc
    }
    const did = seg[5]
    if (seg[4] === 'documents' && did && seg[6] === 'refresh' && method === 'POST') {
      let doc = did === 'master' ? d.documents.find((x) => x.project_id === pid && x.doc_type === 'master') : d.documents.find((x) => x.id === did)
      if (doc) {
        doc.is_auto_synced = true
        doc.updated_at = now()
        doc.memory_count = d.memories.filter((m) => m.project_id === pid).length
        return doc
      }
      throw new Error('文档不存在')
    }
    if (seg[4] === 'documents' && did && seg.length === 6 && method === 'PATCH') {
      const doc = d.documents.find((x) => x.id === did && x.project_id === pid)
      if (!doc) throw new Error('文档不存在')
      if (body.content !== undefined) { doc.content = body.content; doc.is_auto_synced = false }
      if (body.title !== undefined) doc.title = body.title
      doc.last_editor_id = me.id
      doc.updated_at = now()
      return doc
    }

    // ---- 科研：论文 / 方向 / 卡片 / 实验 ----
    if (seg[4] === 'research') {
      const kind = seg[5]
      const subId = seg[6]
      const action = seg[7]
      if (kind === 'dashboard' && method === 'GET') {
        const countBy = (arr, key) => arr.reduce((acc, x) => { acc[x[key]] = (acc[x[key]] || 0) + 1; return acc }, {})
        const realTasks = d.tasks.filter((t) => t.project_id === pid && t.status !== 'draft')
        return {
          totals: {
            papers: d.papers.filter((x) => x.project_id === pid).length,
            cards: d.cards.filter((x) => x.project_id === pid).length,
            memories: d.memories.filter((x) => x.project_id === pid).length,
            experiments: d.experiments.filter((x) => x.project_id === pid).length,
          },
          tasks: countBy(realTasks, 'status'),
          directions: countBy(d.directions.filter((x) => x.project_id === pid), 'status'),
          experiments: countBy(d.experiments.filter((x) => x.project_id === pid), 'status'),
          paper_timeline: d.papers.filter((x) => x.project_id === pid).map((x) => x.created_at),
          experiment_timeline: d.experiments.filter((x) => x.project_id === pid).map((x) => ({ at: x.run_at || x.created_at, status: x.status })),
        }
      }
      const listMap = { papers: 'papers', directions: 'directions', 'paper-cards': 'cards', experiments: 'experiments' }
      const coll = listMap[kind]
      if (coll && !subId && method === 'GET') {
        const items = d[coll].filter((x) => x.project_id === pid)
        return { items, total: items.length }
      }
      if (coll && !subId && method === 'POST') {
        const base = { id: uuid(kind), project_id: pid, created_at: now(), updated_at: now() }
        if (kind === 'papers') {
          const item = { ...base, source: body.source || 'manual', external_id: body.external_id || uid('ext'), title: body.title || '未命名论文', authors: [], abstract: body.abstract || '', year: body.year ? Number(body.year) : null, venue: null, doi: null, pdf_url: null, code_url: null, keywords: [], citation_count: 0 }
          d.papers.push(item); return item
        }
        if (kind === 'directions') {
          const item = { ...base, parent_id: null, root_task_id: null, name: body.name || '未命名方向', description: body.description || '', feasibility: Number(body.feasibility) || null, novelty: Number(body.novelty) || null, impact: Number(body.impact) || null, evidence_count: 0, status: body.status || 'exploring', created_by: me.id }
          d.directions.push(item); return item
        }
        if (kind === 'paper-cards') {
          const paper = d.papers.find((x) => x.id === body.paper_id)
          const role = d.roles.find((r) => r.id === body.role_id)
          const item = { ...base, paper_id: body.paper_id, role_id: body.role_id, role_name: role?.name || null, author_user_id: me.id, author_name: me.display_name, notes: body.notes || '', tags: Array.isArray(body.tags) ? body.tags : [], is_shared: false, rating: Number(body.rating) || 3, paper }
          d.cards.push(item); return item
        }
        if (kind === 'experiments') {
          const role = d.roles.find((r) => r.id === body.role_id)
          const item = { ...base, role_id: body.role_id || null, role_name: role?.name || null, task_id: body.task_id || null, direction_id: body.direction_id || null, direction_name: d.directions.find((x) => x.id === body.direction_id)?.name || null, title: body.title || '未命名实验', hypothesis: body.hypothesis || '', setup: '', result: null, metric: {}, conclusion: body.conclusion || '', log_url: null, status: body.status || 'planned', run_at: null, created_by: me.id }
          d.experiments.push(item); return item
        }
      }
      if (kind === 'paper-cards' && subId && action === 'promote' && method === 'POST') {
        const card = d.cards.find((x) => x.id === subId)
        if (!card) throw new Error('文献卡片不存在')
        card.is_shared = true
        const mem = { id: uuid('mem'), project_id: pid, category: 'paper_card', title: card.paper?.title || '文献卡片', content: card.notes, source_role_id: card.role_id, source_role_name: card.role_name, source_user_id: me.id, source_user_name: me.display_name, source_msg_id: null, creator_rid: card.role_id, source_conversation_id: null, source_message_range: { from: card.id, to: card.id }, tags: card.tags, importance: card.rating, is_pinned: false, promoted_at: now(), created_at: now() }
        d.memories.push(mem)
        return mem
      }
      if (subId && method === 'PATCH') {
        const map = { papers: 'papers', directions: 'directions', 'paper-cards': 'cards', experiments: 'experiments' }
        const c = map[kind]
        const item = d[c]?.find((x) => x.id === subId && x.project_id === pid)
        if (item) Object.assign(item, body, { updated_at: now() })
        return item || null
      }
    }

    // ---- 团队通讯 ----
    if (seg[4] === 'team-chat') {
      if (seg[5] === 'messages' && method === 'GET') {
        const items = d.teamMessages.filter((m) => m.project_id === pid)
        return { items, has_more: false, latest_cursor: items[items.length - 1]?.id || null }
      }
      if (seg[5] === 'messages' && method === 'POST') {
        const me = currentUser()
        const msg = {
          id: String(Date.now() * 1000 + Math.floor(Math.random() * 1000)), request_id: body?.request_id || null, project_id: pid, sender_id: me.id, sender_name: me.display_name || me.username,
          content: String(body?.content || '').slice(0, 5000), created_at: now(),
        }
        d.teamMessages.push(msg)
        return msg
      }
    }
  }

  // ---- 邀请码加入（/projects/join）----
  if (seg[2] === 'projects' && seg[3] === 'join' && method === 'POST') {
    const code = String(body?.invite_code || '').trim().toUpperCase()
    const p = getDb().projects.find((x) => x.invite_code === code)
    if (!p) throw new Error('邀请码无效，请确认后重试（演示码：RESEARCH）')
    if (p.status === 3) throw new Error('项目已归档')
    const roles = getDb().roles.filter((r) => r.project_id === p.id && !r.is_archived)
    return {
      project: { id: p.id, name: p.name, description: p.description, status: p.status },
      roles: roles.map((r) => ({
        id: r.id, name: r.name, description: r.description, member_name: r.member_name,
        is_claimed: getDb().members.some((m) => m.role_id === r.id),
        is_mine: getDb().members.some((m) => m.role_id === r.id && m.user_id === currentUser().id),
      })),
    }
  }

  // ---- 会话 ----
  if (seg[2] === 'conversations') {
    const cid = seg[3]
    if (!cid && method === 'GET') {
      const projectId = query.get('project_id')
      const roleId = query.get('role_id')
      let items = getDb().conversations.filter((c) => c.project_id === projectId && !c.is_archived)
      if (roleId) items = items.filter((c) => c.role_id === roleId)
      return { items, total: items.length }
    }
    if (!cid && method === 'POST') {
      const role = getDb().roles.find((r) => r.id === body.role_id)
      const c = {
        id: uuid('conv'), project_id: body.project_id, role_id: body.role_id, title: body.title || `与「${role?.name || '角色'}」的对话`,
        context_type: body.context_type || 'general', context_ref_id: null, message_count: 0, last_message_at: now(),
        is_pinned: false, is_archived: false, created_by: currentUser().id, role_name: role?.name || null,
        role_color: role?.color || null, role_icon: null, created_at: now(),
      }
      getDb().conversations.push(c)
      return c
    }
    if (cid && seg[4] === 'messages' && seg.length === 5 && method === 'GET') {
      return { items: getDb().messages.filter((m) => m.conversation_id === cid), total: 0 }
    }
    if (cid && seg[4] === 'context-preview' && method === 'GET') {
      const conv = getDb().conversations.find((x) => x.id === cid)
      const role = getDb().roles.find((r) => r.id === conv?.role_id)
      const memCount = getDb().memories.filter((m) => m.project_id === conv?.project_id).length
      return {
        l1: { system_prompt: role?.system_prompt || '', tokens: 128 },
        l2: { memories: getDb().memories.filter((m) => m.project_id === conv?.project_id).map((m) => `- [${m.category}] ${m.title}`), count: memCount },
        l3: { message_count: getDb().messages.filter((m) => m.conversation_id === cid).length },
        total_tokens: 512 + memCount * 40,
      }
    }
    const midPromote = seg[5]
    if (cid && seg[4] === 'messages' && midPromote && seg[7] === 'promote' && method === 'POST') {
      const msg = getDb().messages.find((x) => x.id === midPromote)
      if (!msg) throw new Error('消息不存在')
      const cats = ['decision', 'conclusion', 'todo', 'risk', 'snippet', 'fact', 'paper_card']
      if (!cats.includes(body?.category)) throw new Error('category 不合法')
      if (getDb().memories.some((m) => m.source_msg_id === msg.id)) throw new Error('该消息已晋升过共享记忆')
      const conv = getDb().conversations.find((x) => x.id === cid)
      const role = getDb().roles.find((r) => r.id === conv?.role_id)
      const m = {
        id: uuid('mem'), project_id: conv.project_id, category: body.category, title: body.title?.trim() || '未命名记忆', content: msg.content,
        source_role_id: role?.id || null, source_role_name: role?.name || null, source_user_id: currentUser().id, source_user_name: currentUser().display_name,
        source_msg_id: msg.id, creator_rid: role?.id || null, source_conversation_id: cid, source_message_range: { from: msg.id, to: msg.id },
        tags: Array.isArray(body.tags) ? body.tags : [], importance: Math.min(5, Math.max(1, Number(body.importance) || 3)),
        is_pinned: false, promoted_at: now(), created_at: now(),
      }
      getDb().memories.push(m)
      msg.promoted_memory_id = m.id
      return m
    }
    if (cid && seg.length === 4 && method === 'PATCH') {
      const c = getDb().conversations.find((x) => x.id === cid)
      if (c) Object.assign(c, { title: body?.title ?? c.title, is_pinned: body?.is_pinned ?? c.is_pinned, is_archived: body?.is_archived ?? c.is_archived })
      return c
    }
  }

  // 未登记的演示接口：宽容返回空数据，避免页面因个别接口报错而白屏
  // eslint-disable-next-line no-console
  console.warn(`[demo-mock] 未实现的接口，返回空数据：${method} ${path}`)
  return { items: [], total: 0 }
}

// ------------------------------------------------------------
// Mock 流式对话（对齐真实 chatStream 的回调协议）
// ------------------------------------------------------------
const ROLE_REPLIES = {
  表示建模: '从 3D 表示层看，我建议先把基元尺寸分布与理论采样极限对齐，量化有多少比例的基元落进了退化区。这一步做完，放大伪影就不再是「看起来糊」，而是可以用数字解释的现象。需要我把这个结论晋升为共享记忆吗？',
  渲染工程: '我会先复现 dilation 的展宽偏差曲线，确认它在哪个尺度区间开始主导伪影；然后出 2D Mip 滤波的第一版实现，替换掉固定尺寸的核。实现上要保证兼容现有 tile-based 光栅化管线，不牺牲实时性。',
  实验评测: '我会按「焦距 × 相机距离」九格点跑跨尺度对比，重点看分布外尺度的差距——同尺度下三家差异不到 0.3 dB，根本看不出问题。同时准备四组消融，避免把联合收益错误归给单一模块。',
}

export async function mockChatStream(cid, content, { onMeta, onDelta, onDone, onError } = {}) {
  try {
    await delay(320)
    const d = getDb()
    const conv = d.conversations.find((x) => x.id === cid)
    const role = d.roles.find((r) => r.id === conv?.role_id)
    const userMsg = {
      id: uuid('msg'), conversation_id: cid, sender_type: 'user', sender_user_id: currentUser().id, sender_name: '我',
      content, token_in: 0, token_out: 0, promoted_memory_id: null, created_at: now(),
    }
    d.messages.push(userMsg)
    onMeta?.({ user_message: userMsg, conversation_id: cid })

    const reply = ROLE_REPLIES[role?.name]
      || `已收到「${content.slice(0, 20)}」。在演示模式下我会基于团队共享记忆给出建议性回复；接入真实后端后，这里将由团队角色模型实时生成。`
    const tokens = reply.split('')
    for (let i = 0; i < tokens.length; i++) {
      await delay(26 + Math.random() * 40)
      onDelta?.(tokens[i])
    }
    const aiMsg = {
      id: uuid('msg'), conversation_id: cid, sender_type: 'assistant', sender_user_id: null,
      sender_name: role?.name || 'AI 角色', content: reply, token_in: 80, token_out: reply.length,
      promoted_memory_id: null, created_at: now(),
    }
    d.messages.push(aiMsg)
    if (conv) { conv.message_count += 2; conv.last_message_at = now() }
    onDone?.({ assistant_message: aiMsg, temperature_used: role?.temp_limit ?? 0.3 })
  } catch (e) {
    onError?.(e.message || '演示回复失败')
  }
}

// ============================================================
// Mip-Splatting 演示项目 · 第 2 步
// 论文建档 + 按论文研究路线拆解 12 条子任务（按角色分配）+ 研究方向
// ============================================================
const BASE = 'http://localhost:3001/api/v1';
const PWD = 'Demo@123456';
const PROJECT_NAME = '无走样 3D 高斯溅射 · Mip-Splatting 复现';
// PID / ROLE 在登录后按名称动态解析，避免硬编码其他环境数据库里的 UUID
let PID, ROLE;

async function api(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
async function login(u) {
  const r = await api('POST', '/auth/login', null, { username: u, password: PWD });
  if (r.status !== 200) throw new Error('登录失败 ' + u);
  return r.json.data.token;
}
const ok = (r, what) => {
  if (r.status !== 200) throw new Error(`${what} 失败 — HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 250)}`);
  return r.json.data;
};

// 论文研究路线 → 三人子任务
const TASKS = [
  // ---------- 阶段 A · 基线与问题定位 ----------
  ['表示建模', 'P0', 'A1 · 复现 3DGS 基线并冻结单尺度训练协议',
    '在 Mip-NeRF 360 数据集上复现原版 3DGS，固定训练分辨率与焦距，锁定随机种子与环境版本。\n\n产出：可复现的基线 PSNR / SSIM / LPIPS 数值表，作为后续全部对比的锚点。\n验收：第三方按记录的环境与种子可复现出 ±0.1dB 以内的结果。'],
  ['实验评测', 'P0', 'A2 · 构建「焦距 × 相机距离」跨尺度测试扫描协议',
    '论文的核心主张是「单尺度训练、多尺度测试」，因此评测协议本身就是方法的一部分。\n\n设计二维扫描矩阵：焦距 {0.5×, 1×, 2×} × 相机距离 {近, 中, 远}，明确每个格点的采样率定义、指标口径与统计方式。\n验收：协议文档可被复现，且覆盖论文所报告的分布外尺度区间。'],

  // ---------- 阶段 B · 问题归因 ----------
  ['表示建模', 'P0', 'B1 · 定位退化高斯基元的频率越界',
    '验证论文的关键假说：3DGS 的收缩偏置会让高斯基元退化成近似 δ 函数，其 3D 空间频率超出输入视图所能表达的采样上限。\n\n产出：退化程度与采样率的量化关系（频率分布直方图 + 越界比例）。\n验收：能在放大视角下稳定复现高频伪影，并给出可解释的度量。'],
  ['渲染工程', 'P0', 'B2 · 量化 2D dilation 在跨尺度下的展宽偏差',
    '在屏幕空间统计 dilation 算子引入的额外展宽量，绘制「采样率 → 展宽偏差」曲线。\n\n目标：确认它是否为缩小视角下「辐条变粗」（图 1(c)）的直接原因，与 B1 的 3D 频率越界形成完整归因链。\n验收：给出偏差曲线，并指出 dilation 在哪个尺度区间开始主导伪影。'],

  // ---------- 阶段 C · 方法实现 ----------
  ['表示建模', 'P1', 'C1 · 设计 3D 平滑滤波：由最大采样频率约束基元尺寸',
    '从输入视图推导最大采样频率，据此为每个 3D 高斯设定尺寸上限（即在 3D 空间做低通滤波）。\n\n关键性质：滤波尺寸完全由训练图像决定，而非待渲染图像——这是与 EWA Splatting 的本质区别。\n验收：放大视角高频伪影显著减少；训练期一次性约束，不增加推理开销。'],
  ['渲染工程', 'P1', 'C2 · 用 2D Mip 滤波替换 dilation',
    '用近似物理成像 box filter 的 2D Mip 滤波替换现有屏幕空间 dilation，使滤波核尺寸随采样率自适应，而非固定经验值。\n\n实现约束：必须兼容现有 tile-based 光栅化管线，不破坏实时性。\n验收：缩小/放大视角下走样与膨胀同时缓解，单帧耗时增幅可控。'],
  ['渲染工程', 'P1', 'C3 · 引入多分辨率训练策略',
    '在训练中混入不同分辨率的视图，使模型见过多尺度采样模式，而非只在单一尺度上过拟合。\n\n需要评估：显存占用、训练时长代价，以及是否与 C1 的 3D 约束产生叠加或冲突。\n验收：给出「训练分辨率组合 → 跨尺度表现」的对照结果。'],

  // ---------- 阶段 D · 评测与消融 ----------
  ['实验评测', 'P1', 'D1 · 跨尺度定量评测：对比 3DGS 与 EWA Splatting',
    '在 A2 的扫描协议上对比三条方案：原版 3DGS、EWA Splatting、本方案。\n\n重点看分布外尺度（放大与缩小）的差距，而非同尺度下的绝对数值——后者三家差异不大，正是走样被掩盖的地方。\n验收：输出完整跨尺度指标表，明确标出各方案的失效区间。'],
  ['实验评测', 'P1', 'D2 · 消融实验：分离 3D 滤波与 2D Mip 的独立贡献',
    '四组配置：① 都不加 ② 仅 3D 平滑滤波 ③ 仅 2D Mip 滤波 ④ 两者都加。\n\n目标：确认两个模块各自的增益与耦合效应，避免把联合收益错误归给单一模块。\n验收：四组结果齐全；能明确区分「放大伪影」与「缩小膨胀」分别由哪个模块主导。'],
  ['渲染工程', 'P2', 'D3 · 渲染质量与帧率的权衡分析',
    '测量引入两级滤波后的帧率变化与显存占用，确认实时性（≥30 fps @1080p）未被破坏。\n\n产出：质量–速度曲线，给出不同硬件档位的推荐配置。\n验收：在消费级显卡上仍能保持实时渲染。'],

  // ---------- 阶段 E · 结论沉淀 ----------
  ['表示建模', 'P2', 'E1 · 结论审定：单尺度训练能否泛化到多尺度',
    '汇总 D 阶段全部证据，明确回答论文的核心主张。\n\n必须标注：结论成立的条件（数据集、尺度范围、硬件），以及已知的反例风险与适用边界。\n验收：形成一段可被外部评审检验的结论陈述，不含未验证的推论。'],
  ['实验评测', 'P2', 'E2 · 复现包整理与实验文档沉淀',
    '固化随机种子、环境版本、评测脚本与结果表，产出可被第三方独立复现的最小包。\n\n同步把结论、边界与未解决问题写入项目总文档，形成团队可继承的知识资产。\n验收：复现包在干净环境下按 README 可跑通。'],
];

(async () => {
  try {
    const [tokYun, tokLu, tokHua] = await Promise.all([login('yun_tianming'), login('lu_renzhen'), login('hua_xuepin')]);
    const TOKEN = { '表示建模': tokYun, '渲染工程': tokLu, '实验评测': tokHua };

    // 动态解析项目 / 角色 / 成员 ID
    const projects = ok(await api('GET', '/projects', tokYun), '查项目列表');
    const proj = (projects.items || []).find((p) => p.name === PROJECT_NAME);
    if (!proj) throw new Error('未找到演示项目，请先执行 seed-mipsplatting-1-team.js');
    PID = proj.id;
    const detail = ok(await api('GET', `/projects/${PID}`, tokYun), '查项目详情');
    ROLE = Object.fromEntries((detail.roles || []).filter((r) => !r.is_archived).map((r) => [r.name, r.id]));
    const USER = Object.fromEntries((detail.members || []).filter((m) => m.role_name).map((m) => [m.role_name, m.user_id]));

    // ---------- 1. 论文建档 ----------
    console.log('=== 1. 论文建档（Mip-Splatting）===');
    const papers = ok(await api('GET', `/projects/${PID}/research/papers`, tokYun), '查论文');
    let paper = (papers.items || []).find(p => p.title.includes('Mip-Splatting'));
    if (paper) {
      console.log('  已存在:', paper.title);
    } else {
      paper = ok(await api('POST', `/projects/${PID}/research/papers`, tokYun, {
        title: 'Mip-Splatting: Alias-free 3D Gaussian Splatting',
        source: 'arxiv',
        external_id: '2311.16493',
        authors: ['Zehao Yu', 'Anpei Chen', 'Binbin Huang', 'Torsten Sattler', 'Andreas Geiger'],
        abstract: 'Recently, 3D Gaussian Splatting has demonstrated impressive novel view synthesis results, reaching high fidelity and efficiency. However, strong artifacts can be observed when changing the sampling rate, e.g., by changing focal length or camera distance. We find that the source for this phenomenon can be attributed to the lack of 3D frequency constraints and the usage of a 2D dilation filter. To address this problem, we introduce a 3D smoothing filter which constrains the size of the 3D Gaussian primitives based on the maximal sampling frequency induced by the input views, eliminating high-frequency artifacts when zooming in. Moreover, replacing 2D dilation with a 2D Mip filter, which simulates a 2D box filter, effectively mitigates aliasing and dilation issues. Our evaluation, including scenarios such as training on single-scale images and testing on multiple scales, validates the effectiveness of our approach.',
        year: 2024,
        venue: 'CVPR 2024 (IEEE/CVF Conference on Computer Vision and Pattern Recognition)',
        doi: '10.1109/cvpr52733.2024.01839',
        pdf_url: 'https://arxiv.org/abs/2311.16493',
        code_url: 'https://github.com/autonomousvision/mip-splatting',
        keywords: ['3D Gaussian Splatting', 'anti-aliasing', 'sampling rate', 'novel view synthesis', 'Mip filter'],
        citation_count: 511,
        raw_meta: { source_verified: 'OpenAlex', arxiv: '2311.16493', institution: 'University of Tübingen' },
      }), '建论文');
      console.log('  已收录:', paper.title);
    }

    // ---------- 2. 文献卡片（表示建模角色撰写）----------
    console.log('\n=== 2. 文献卡片 ===');
    const cards = ok(await api('GET', `/projects/${PID}/research/paper-cards`, tokYun), '查卡片');
    let card = (cards.items || []).find(c => (c.paper?.title || '').includes('Mip-Splatting'));
    if (card) {
      console.log('  已存在');
    } else {
      card = ok(await api('POST', `/projects/${PID}/research/paper-cards`, tokYun, {
        paper_id: paper.id,
        role_id: ROLE['表示建模'],
        notes: [
          '论文把「跨尺度走样」拆成了两条独立的因果链，这是全文最关键的判断：',
          '',
          '① 3D 侧：3DGS 的收缩偏置让高斯基元退化到超出采样极限，等价于在 3D 空间放了一个近似 δ 函数——',
          '   放大视角时高频信息无处安放，形成高频伪影（图 1(b)(d)）。',
          '② 2D 侧：屏幕空间的 dilation 是为了「把太薄的东西撑起来」，但它的尺寸是固定的，',
          '   因此在缩小视角（采样率下降）时展宽过度，出现「辐条变粗」（图 1(c)）。',
          '',
          '两个修复各自针对一条因果链：3D 平滑滤波（约束基元尺寸上限）治放大伪影，',
          '2D Mip 滤波（模拟物理 box filter）治缩小的走样与膨胀。这也解释了为什么消融必须拆成四组——',
          '两个模块的收益不可互相替代。',
          '',
          '适用边界：论文的结论建立在静态场景、且输入视图采样率一致的前提上；',
          '若输入本身是多尺度混合（如手机随手拍 + 航拍），A2 的扫描协议需要额外设计该维度的对照。',
        ].join('\n'),
        evidence_quote: 'We find that the source for this phenomenon can be attributed to the lack of 3D frequency constraints and the usage of a 2D dilation filter.',
        evidence_locator: '摘要 · 第 2 句',
        tags: ['3DGS', '走样', '频率约束', '基线认知'],
        rating: 5,
      }), '建卡片');
      console.log('  卡片已创建:', card.id);
    }

    // ---------- 3. 研究路线拆解为子任务（按角色）----------
    console.log('\n=== 3. 研究路线拆解（12 条子任务）===');
    const existing = ok(await api('GET', `/projects/${PID}/tasks`, tokYun), '查任务');
    const existTitles = new Set((existing.items || existing || []).map(t => t.title));
    const taskMap = {};
    for (const [roleName, prio, title, desc] of TASKS) {
      if (existTitles.has(title)) {
        console.log(`  [已存在] ${title}`);
        const t = (existing.items || existing || []).find(x => x.title === title);
        taskMap[title] = t;
        continue;
      }
      const t = ok(await api('POST', `/projects/${PID}/tasks`, TOKEN[roleName], {
        title, description: desc, priority: prio, role_id: ROLE[roleName],
      }), `建任务 ${title}`);
      taskMap[title] = t;
      console.log(`  [${roleName}] ${title}`);
    }

    // ---------- 4. 研究方向 ----------
    console.log('\n=== 4. 研究方向 ===');
    const dirs = ok(await api('GET', `/projects/${PID}/research/directions`, tokYun), '查方向');
    const existDirs = new Set((dirs.items || dirs || []).map(d => d.name));
    const DIRS = [
      ['3D 频率约束与平滑滤波', 'selected', 4, 4, 4, 'A1',
        '由输入视图的最大采样频率反推 3D 高斯基元的尺寸上限，从表示层面消除放大视角的高频伪影。这是本项目的主攻方向。'],
      ['2D 采样自适应滤波', 'exploring', 5, 3, 4, 'C2',
        '用近似物理成像 box filter 的 Mip 滤波替代固定尺寸的屏幕空间 dilation，使滤波核随采样率自适应。'],
      ['跨尺度泛化评测协议', 'exploring', 5, 3, 5, 'A2',
        '单尺度训练能否泛化到多尺度，取决于评测协议本身是否覆盖分布外尺度。本方向负责把「评测」也当作方法的一部分来设计。'],
    ];
    for (const [name, status, feas, nov, imp, rootTaskTitle, desc] of DIRS) {
      if (existDirs.has(name)) { console.log(`  [已存在] ${name}`); continue; }
      ok(await api('POST', `/projects/${PID}/research/directions`, tokYun, {
        name, description: desc, status, feasibility: feas, novelty: nov, impact: imp,
        root_task_id: taskMap[rootTaskTitle]?.id || null,
        evidence_count: 1,
      }), `建方向 ${name}`);
      console.log(`  [${status}] ${name}`);
    }

    console.log('\n✅ 论文建档 + 任务拆分 + 方向 完成');
    console.log('   task_ids:', JSON.stringify(Object.fromEntries(Object.entries(taskMap).map(([k, v]) => [k.split(' · ')[0], v.id]))));

  } catch (e) {
    console.error('\n❌ 失败:', e.message);
    process.exitCode = 1;
  }
})();
// ============================================================
// Mip-Splatting 演示项目 · 第 3 步
// 推进任务状态 + 共享记忆 + 实验记录 + 项目总文档
// ============================================================
const BASE = 'http://localhost:3001/api/v1';
const PWD = 'Demo@123456';
const PROJECT_NAME = '无走样 3D 高斯溅射 · Mip-Splatting 复现';
// PID / ROLE / USER 在登录后按名称动态解析，避免硬编码其他环境数据库里的 UUID
let PID, ROLE, USER;

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
function ok(r, what) {
  if (r.status !== 200) console.log(`  [跳过] ${what}: ${r.json?.msg || r.status}`);
  return r.json?.data;
}

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
    USER = Object.fromEntries((detail.members || []).filter((m) => m.role_name).map((m) => [m.role_name, m.user_id]));

    // ---------- 1. 推进任务状态（体现研究进度层次）----------
    console.log('=== 1. 推进任务状态 ===');
    const tasksRes = await api('GET', `/projects/${PID}/tasks`, tokYun);
    const tasks = tasksRes.json.data?.items || tasksRes.json.data || [];
    const byKey = {};
    for (const t of tasks) byKey[t.title.split(' · ')[0]] = t;

    // 目标状态：阶段 A/B 完成，阶段 C 进行中，D/E 未开始
    const PROGRESS = [
      ['A1', 'done', 100, '表示建模'], ['A2', 'done', 100, '实验评测'],
      ['B1', 'done', 100, '表示建模'], ['B2', 'review', 90, '渲染工程'],
      ['C1', 'doing', 60, '表示建模'], ['C2', 'doing', 25, '渲染工程'],
      ['C3', 'todo', 0, '渲染工程'],
      ['D1', 'todo', 0, '实验评测'], ['D2', 'todo', 0, '实验评测'], ['D3', 'todo', 0, '渲染工程'],
      ['E1', 'todo', 0, '表示建模'], ['E2', 'todo', 0, '实验评测'],
    ];
    const STEPS = { todo: ['doing', 'review', 'done'], draft: ['todo', 'doing', 'review', 'done'], doing: ['review', 'done'], review: ['done'], done: [] };
    for (const [key, status, progress, roleName] of PROGRESS) {
      const t = byKey[key];
      if (!t) { console.log(`  [缺失] ${key}`); continue; }
      if (t.status === status && t.progress === progress) { console.log(`  [已是] ${key} ${status} ${progress}%`); continue; }
      let cur = t.status;
      let r = await api('PATCH', `/projects/${PID}/tasks/${t.id}`, TOKEN[roleName], { status, progress });
      if (r.status !== 200 && status !== cur) {
        // 逐级推进
        for (const step of (STEPS[cur] || [])) {
          if (step === status) break;
          const rr = await api('PATCH', `/projects/${PID}/tasks/${t.id}`, TOKEN[roleName], { status: step });
          if (rr.status !== 200) break;
        }
        r = await api('PATCH', `/projects/${PID}/tasks/${t.id}`, TOKEN[roleName], { status, progress });
      }
      console.log(r.status === 200 ? `  [${key}] → ${status} ${progress}%` : `  [失败] ${key}: ${r.json?.msg}`);
    }

    // ---------- 2. 共享记忆（三条结论，来自三个角色）----------
    console.log('\n=== 2. 共享记忆 ===');
    const memRes = await api('GET', `/projects/${PID}/memories`, tokYun);
    const mems = memRes.json.data?.items || memRes.json.data || [];
    const memTitles = new Set(mems.map(m => m.title));

    const MEMS = [
      ['conclusion', '放大伪影的根因：3D 高斯基元频率越界', '表示建模',
        '通过全场景高斯基元尺寸分布测量确认：3DGS 的收缩偏置会让部分基元退化到采样极限以下，等价于在 3D 空间放置近似 δ 函数，其空间频率超出输入视图可表达的范围。这部分基元在放大视角时贡献主要高频伪影（原文图 1(b)(d)）。\n\n成立条件：静态场景、输入视图采样率一致。\n影响：决定了修复必须在 3D 表示层做低通约束，而不是只在屏幕空间补偿。',
        ['3DGS', '走样', '频率约束'], 5],
      ['conclusion', '缩小膨胀的根因：dilation 滤波尺寸不随采样率变化', '渲染工程',
        '屏幕空间 dilation 的核尺寸是固定经验值。缩小视角（采样率下降）时它相对像素展宽过度，形成「辐条变粗」（原文图 1(c)）。\n\n量化结果：展宽偏差随缩放因子单调上升，在 0.5× 焦距附近开始主导伪影。\n关键判断：这与 3D 频率越界是两条独立因果链——所以修复手段不可互换，消融必须拆成四组。',
        ['dilation', '屏幕空间', '走样'], 5],
      ['decision', '评测必须覆盖分布外尺度，否则会掩盖走样', '实验评测',
        '在同尺度下对比 3DGS / EWA / 本方案，指标差异小于 0.3 dB，走样几乎不可见；只有在跨尺度测试（焦距 0.5×–2×、相机距离近–远）下差距才显著。\n\n决定：把「跨尺度评测协议」列为方法的一部分而非事后补充，并在 A2 任务中固化为二维扫描矩阵。\n边界：若输入本身是多尺度混合（手机随手拍 + 航拍），协议需额外设计该维度对照。',
        ['评测', '跨尺度', '方法论'], 5],
    ];
    for (const [cat, title, roleName, content, tags, imp] of MEMS) {
      if (memTitles.has(title)) { console.log(`  [已存在] ${title}`); continue; }
      const r = await api('POST', `/projects/${PID}/memories`, TOKEN[roleName], { category: cat, title, content, tags, importance: imp });
      console.log(r.status === 200 ? `  [${roleName}] ${title}` : `  [失败] ${title}: ${r.json?.msg}`);
    }

    // ---------- 3. 实验记录 ----------
    console.log('\n=== 3. 实验记录 ===');
    const expRes = await api('GET', `/projects/${PID}/research/experiments`, tokYun);
    const exps = expRes.json.data?.items || expRes.json.data || [];
    const expTitles = new Set((exps.items || exps || []).map(e => e.title));

    const EXPS = [
      ['表示建模', 'A1', '基线复现：3DGS @ Mip-NeRF 360', 'succeeded',
        '原版 3DGS 在同分布尺度下应达到论文报告水平，作为后续对比的可信锚点',
        'Mip-NeRF 360 全部 9 个场景 · 训练 30k 迭代 · 固定随机种子与环境版本',
        'PSNR 27.21 / SSIM 0.815 / LPIPS 0.214（与原文报告一致，偏差 < 0.1 dB）',
        '基线可信。所有后续跨尺度结论均以此为对照基准。'],
      ['表示建模', 'B1', '频率分布测量：量化基元频率越界比例', 'succeeded',
        '部分 3D 高斯基元的空间频率超出输入视图的采样极限，构成放大伪影的来源',
        '训练收敛后统计全部高斯基元的尺寸分布，与由输入焦距推导的理论采样极限逐一对齐',
        '约 12% 的基元落在采样极限以下（退化区）；该比例与放大视角下的伪影强度正相关',
        'B1 假说成立。退化基元占比可作为走样风险的可量化指标。'],
      ['实验评测', 'D1', '跨尺度对比：3DGS / EWA Splatting / 本方案', 'running',
        '本方案在分布外尺度上的优势应显著大于同尺度下的优势',
        '按 A2 协议执行：焦距 {0.5×, 1×, 2×} × 相机距离 {近, 中, 远}，共 9 个格点',
        '进行中：已完成 5 / 9 个格点，缩小视角（0.5×）差距最大',
        '待全部格点完成后出具结论与失效区间标注。'],
    ];
    for (const [roleName, taskKey, title, status, hypothesis, setup, result, conclusion] of EXPS) {
      if (expTitles.has(title)) { console.log(`  [已存在] ${title}`); continue; }
      const r = await api('POST', `/projects/${PID}/research/experiments`, TOKEN[roleName], {
        title, role_id: ROLE[roleName], task_id: byKey[taskKey]?.id || null,
        hypothesis, setup, result, conclusion, status,
        metric: status === 'succeeded' ? { psnr: 27.21, ssim: 0.815, lpips: 0.214 } : {},
      });
      console.log(r.status === 200 ? `  [${status}] ${title}` : `  [失败] ${title}: ${r.json?.msg}`);
    }

    // ---------- 4. 项目总文档 ----------
    console.log('\n=== 4. 项目总文档 ===');
    const docRes = await api('GET', `/projects/${PID}/documents`, tokYun);
    const docs = docRes.json.data?.items || docRes.json.data || [];
    const docTitles = new Set((docs.items || docs || []).map(d => d.title));
    const DOC_TITLE = '项目总文档 · 无走样 3D 高斯溅射';
    if (docTitles.has(DOC_TITLE)) {
      console.log('  [已存在]', DOC_TITLE);
    } else {
      const content = [
        '# 无走样 3D 高斯溅射 · 项目总文档',
        '',
        '## 一、研究问题',
        '3D Gaussian Splatting（3DGS）在同分布尺度下表现优异，但改变采样率（焦距或相机距离）时出现严重伪影。',
        '现有评测大多只在同尺度进行，掩盖了这个问题。本项目的目标是把「跨尺度泛化」当作一等公民来研究。',
        '',
        '## 二、研究路线（三条并行，对应三个角色）',
        '| 路线 | 负责角色 | 关键任务 | 核心产出 |',
        '| --- | --- | --- | --- |',
        '| 3D 频率约束与平滑滤波 | 云天明 · 表示建模 | C1 | 由最大采样频率反推基元尺寸上限 |',
        '| 2D 采样自适应滤波 | 鹿认真 · 渲染工程 | C2 / C3 | Mip 滤波替代 dilation + 多分辨率训练 |',
        '| 跨尺度泛化评测协议 | 化学品 · 实验评测 | A2 / D1 / D2 | 焦距×距离扫描矩阵 + 四组消融 |',
        '',
        '## 三、当前结论（已进入共享记忆）',
        '1. **放大伪影**的根因是 3D 高斯基元频率越界（约 12% 的基元退化至采样极限以下）。',
        '2. **缩小膨胀**的根因是 dilation 滤波尺寸不随采样率变化；与上一条是**两条独立因果链**。',
        '3. 同尺度评测差异 < 0.3 dB，**必须跨尺度评测**才能暴露走样。',
        '',
        '## 四、进行中',
        '- B2 量化 dilation 跨尺度展宽偏差（90%，待负责人核验）',
        '- C1 3D 平滑滤波设计（60%）',
        '- C2 Mip 滤波实现（25%）',
        '- D1 跨尺度对比实验（5 / 9 格点完成）',
        '',
        '## 五、待验证与风险',
        '- C1 与 C3 是否叠加或冲突：多分辨率训练可能改变频率约束的紧度',
        '- 输入本身多尺度混合时（手机随手拍 + 航拍），扫描协议需扩展该维度对照',
        '- 引入两级滤波后的实时性（≥30 fps @1080p）尚未复测，属 D3 范围',
        '',
        '## 六、适用边界与反例风险',
        '- 主结论建立在**静态场景**、输入视图**采样率一致**的前提下。',
        '- 动态场景（4D 高斯系列方法）未在本项目考察范围内。',
        '- 消融四组必须齐全，否则不得把联合收益归给单一模块。',
        '',
        '---',
        '> 本文档由团队三角色协作沉淀；结论条目均可在「共享记忆」中溯源到具体角色与任务。',
      ].join('\n');
      const r = await api('POST', `/projects/${PID}/documents`, tokYun, {
        title: DOC_TITLE, content, doc_type: 'project_doc',
      });
      console.log(r.status === 200 ? '  总文档已创建' : `  [失败]: ${r.json?.msg}`);
    }

    console.log('\n✅ 演示项目构建完成');

  } catch (e) {
    console.error('\n❌ 失败:', e.message);
    process.exitCode = 1;
  }
})();
// ============================================================
// 构建「Mip-Splatting 复现」真实科研演示项目
// 走真实 API：注册成员 → 建项目 → 建角色 → 组队 → 论文建档
//            → 研究路线拆解为 12 条子任务 → 方向/实验/记忆/总文档
// ============================================================
const BASE = 'http://localhost:3001/api/v1';
const PWD = 'Demo@123456';

async function api(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

// 注册或登录（幂等）
async function ensureUser(username, displayName) {
  let r = await api('POST', '/auth/register', null, { username, password: PWD, display_name: displayName });
  if (r.status === 200) { console.log(`  [注册] ${displayName} (${username})`); return r.json.data; }
  r = await api('POST', '/auth/login', null, { username, password: PWD });
  if (r.status === 200) { console.log(`  [已存在] ${displayName} (${username})`); return r.json.data; }
  throw new Error(`用户 ${username} 处理失败: ${JSON.stringify(r.json)}`);
}

const ok = (r, what) => {
  if (r.status !== 200) throw new Error(`${what} 失败 — HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  return r.json.data;
};

(async () => {
  try {
    // ---------- 1. 注册三个团队成员 ----------
    console.log('=== 1. 团队成员 ===');
    const yun = await ensureUser('yun_tianming', '云天明');
    const lu = await ensureUser('lu_renzhen', '鹿认真');
    const hua = await ensureUser('hua_xuepin', '化学品');

    // ---------- 2. 建项目（云天明为 owner）----------
    console.log('\n=== 2. 创建项目 ===');
    let proj;
    const projects = await api('GET', '/projects', yun.token);
    proj = (projects.json.data?.items || []).find(p => p.name.includes('Mip-Splatting'));
    if (proj) {
      console.log('  项目已存在，复用:', proj.name, proj.id);
    } else {
      proj = ok(await api('POST', '/projects', yun.token, {
        name: '无走样 3D 高斯溅射 · Mip-Splatting 复现',
        description: '真实科研复现项目：针对 3DGS 在改变采样率（焦距/相机距离）时产生的走样伪影，验证「3D 频率约束 + 2D Mip 滤波」两条修复路径，并回答单尺度训练能否泛化到多尺度。',
        domain: '计算机图形学 / 三维重建',
      }), '建项目');
      console.log('  项目已创建:', proj.name);
    }
    const PID = proj.id;
    console.log('  project_id =', PID);

    // ---------- 3. 建三个角色 ----------
    console.log('\n=== 3. 创建角色（C1：角色差异的唯一来源是 system_prompt）===');
    const ROLE_DEFS = [
      {
        name: '表示建模', member: '云天明', color: '#5B8FF9', temp: 0.6,
        description: '负责 3D 高斯基元的数学性质：协方差、频率约束、退化判据与表示层方案。',
        prompt: '你是「无走样 3D 高斯溅射」项目的表示建模负责人，成员是云天明。你关注的是一切与「三维基元的数学性质」有关的问题：高斯基元的协方差与各向异性、频域特性、与采样定理的关系、退化与约束的设计。\n\n回答风格：先给数学直觉，再给可执行的结论。涉及频域问题时必须说明前提假设。不确定的地方明确标注「待验证」。\n\n职责边界：你只对 3D 表示层负责。2D 渲染管线的问题交给渲染工程，实验结论的统计口径交给实验评测。发现跨角色依赖时，明确指出应协作的事项，不要越界替他人下结论。',
      },
      {
        name: '渲染工程', member: '鹿认真', color: '#61DDAA', temp: 0.5,
        description: '负责从场景表示到像素的实现：光栅化、滤波算子、屏幕空间膨胀、多分辨率训练与性能权衡。',
        prompt: '你是「无走样 3D 高斯溅射」项目的渲染工程负责人，成员是鹿认真。你关注的是从场景表示到像素的每一步实现：光栅化管线、滤波算子的形式与尺寸、屏幕空间膨胀、多分辨率训练策略，以及显存与帧率的权衡。\n\n回答风格：给可落地的实现方案与具体参数，说明每一步的代价（显存、时间、精度）。代码与算子行为以实际可复现为准，不接受「理论上应该」。\n\n职责边界：你只对渲染与工程实现负责。3D 基元的数学约束交给表示建模，评测指标的定义与证据口径交给实验评测。',
      },
      {
        name: '实验评测', member: '化学品', color: '#F6BD16', temp: 0.4,
        description: '负责实验设计与证据质量：跨尺度评测协议、基线选择、消融设计、指标口径与结论边界。',
        prompt: '你是「无走样 3D 高斯溅射」项目的实验评测负责人，成员是化学品。你关注的是「结论有没有证据」：跨尺度评测协议的设计、基线的选择与公平性、消融实验的完整性、指标口径，以及结论的适用边界。\n\n回答风格：任何结论都要配证据来源（数据集、尺度设置、指标数值）。主动指出结论的适用边界与反例风险。不接受未经消融验证的归因，也不接受把联合收益归给单一模块。\n\n职责边界：你只对实验设计与证据质量负责。方法本身的实现交给渲染工程，理论推导交给表示建模。',
      },
    ];

    const roles = {};
    const existingRoles = ok(await api('GET', `/projects/${PID}/roles`, yun.token), '查角色');
    for (const def of ROLE_DEFS) {
      const found = (existingRoles.items || existingRoles || []).find(r => r.name === def.name);
      if (found) { roles[def.name] = found; console.log(`  [已存在] ${def.name}`); continue; }
      const role = ok(await api('POST', `/projects/${PID}/roles`, yun.token, {
        name: def.name, description: def.description, system_prompt: def.prompt,
        temp_limit: def.temp, color: def.color,
      }), `建角色 ${def.name}`);
      roles[def.name] = role;
      console.log(`  [创建] ${def.name} → ${def.member}`);
    }

    // ---------- 4. 组队：绑定成员到角色 ----------
    console.log('\n=== 4. 组队 ===');
    const members = ok(await api('GET', `/projects/${PID}/members`, yun.token), '查成员');
    const hasMember = (uid, rid) => (members.items || members || []).some(m => m.user_id === uid && m.role_id === rid);
    const TEAM = [
      [lu.user.id, roles['渲染工程'].id, '鹿认真 → 渲染工程'],
      [hua.user.id, roles['实验评测'].id, '化学品 → 实验评测'],
    ];
    for (const [uid, rid, label] of TEAM) {
      if (hasMember(uid, rid)) { console.log(`  [已加入] ${label}`); continue; }
      ok(await api('POST', `/projects/${PID}/members`, yun.token, { user_id: uid, role_id: rid }), `加入 ${label}`);
      console.log(`  [加入] ${label}`);
    }
    // 云天明建角色时已自动绑定「表示建模」，确认一下
    if (!hasMember(yun.user.id, roles['表示建模'].id)) {
      ok(await api('POST', `/projects/${PID}/members`, yun.token, { user_id: yun.user.id, role_id: roles['表示建模'].id, is_leader: true }), '绑定云天明');
      console.log('  [加入] 云天明 → 表示建模');
    } else {
      console.log('  [已加入] 云天明 → 表示建模');
    }

    console.log('\n✅ 项目与团队就绪');
    console.log(JSON.stringify({ PID, roles: Object.fromEntries(Object.entries(roles).map(([k, v]) => [k, v.id])),
      users: { yun: yun.user.id, lu: lu.user.id, hua: hua.user.id } }, null, 2));

  } catch (e) {
    console.error('\n❌ 失败:', e.message);
    process.exitCode = 1;
  }
})();
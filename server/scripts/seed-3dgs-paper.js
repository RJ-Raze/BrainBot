// 在演示项目中为「3D Gaussian Splatting 开山之作」建档
// 走真实 API：登录 → 建论文 → 建文献卡片 → 核验来源 → 晋升共享记忆
const BASE = 'http://localhost:3001/api/v1';
const PROJECT_NAME = '低资源可靠推理 · 协作研究 Demo';
// PID 与角色 ID 登录后按名称动态解析，避免硬编码其他环境数据库里的 UUID
let PID, ROLE_CURATOR, ROLE_LEADER;

async function api(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function login(username, password) {
  const r = await api('POST', '/auth/login', null, { username, password });
  if (r.status !== 200) throw new Error('登录失败 ' + username + ': ' + JSON.stringify(r.json));
  return r.json.data.token;
}

(async () => {
  try {
    console.log('=== 1. 登录 ===');
    const curatorToken = await login('demo_curator', 'Demo@123456');
    console.log('  demo_curator 登录成功');
    const leaderToken = await login('demo_researcher', 'Demo@123456');
    console.log('  demo_researcher 登录成功');

    // 动态解析演示项目与角色 ID
    const projectsRes = await api('GET', '/projects', leaderToken);
    const proj = (projectsRes.json.data?.items || []).find((p) => p.name === PROJECT_NAME);
    if (!proj) throw new Error('未找到演示项目「' + PROJECT_NAME + '」，请先执行 npm run seed:demo');
    PID = proj.id;
    const detailRes = await api('GET', `/projects/${PID}`, leaderToken);
    const roles = detailRes.json.data?.roles || [];
    ROLE_CURATOR = roles.find((r) => r.name === '文献策展')?.id;
    ROLE_LEADER = roles.find((r) => r.name === '研究统筹')?.id;
    if (!ROLE_CURATOR || !ROLE_LEADER) throw new Error('未找到文献策展/研究统筹角色，请先执行 npm run seed:demo');
    console.log('  project_id =', PID);

    console.log('\n=== 2. 创建论文（3DGS 开山之作）===');
    const ABSTRACT =
      'Radiance Field methods have recently revolutionized novel-view synthesis of scenes captured with multiple photos or videos. ' +
      'However, achieving high visual quality still requires neural networks that are costly to train and render, while recent faster ' +
      'methods inevitably trade off speed for quality. For unbounded and complete scenes (rather than isolated objects) and 1080p ' +
      'resolution rendering, no current method can achieve real-time display rates. We introduce three key elements that allow us to ' +
      'achieve state-of-the-art visual quality while maintaining competitive training times and importantly allow high-quality real-time ' +
      '(>= 30 fps) novel-view synthesis at 1080p resolution. First, starting from sparse points produced during camera calibration, we ' +
      'represent the scene with 3D Gaussians that preserve desirable properties of continuous volumetric radiance fields for scene ' +
      'optimization while avoiding unnecessary computation in empty space; Second, we perform interleaved optimization/density control of ' +
      'the 3D Gaussians, notably optimizing anisotropic covariance to achieve an accurate representation of the scene; Third, we develop ' +
      'a fast visibility-aware rendering algorithm that supports anisotropic splatting and both accelerates training and allows real-time rendering.';

    const paperRes = await api('POST', `/projects/${PID}/research/papers`, curatorToken, {
      title: '3D Gaussian Splatting for Real-Time Radiance Field Rendering',
      source: 'arxiv',
      external_id: '2308.04079',
      authors: ['Bernhard Kerbl', 'Georgios Kopanas', 'Thomas Leimkühler', 'George Drettakis'],
      abstract: ABSTRACT,
      year: 2023,
      venue: 'ACM SIGGRAPH 2023 / ACM Transactions on Graphics 42(4)',
      doi: '10.1145/3592433',
      pdf_url: 'https://arxiv.org/abs/2308.04079',
      code_url: 'https://github.com/graphdeco-inria/gaussian-splatting',
      keywords: ['3D Gaussian Splatting', 'radiance field', 'real-time rendering', 'novel view synthesis'],
      citation_count: 5550,
      raw_meta: { source_verified: 'OpenAlex', doi_official: '10.1145/3592433', pages: 15 },
    });
    console.log('  HTTP', paperRes.status, '|', paperRes.json.msg);
    const paper = paperRes.json.data;
    if (!paper || !paper.id) throw new Error('论文创建返回异常: ' + JSON.stringify(paperRes.json));
    console.log('  paper_id =', paper.id);
    console.log('  created =', paper.created);

    console.log('\n=== 3. 创建文献卡片（文献策展角色）===');
    const NOTES = [
      '本文的取舍逻辑与本项目的「低资源约束」主线同源：作者用显式三维高斯替代隐式神经网络表示，',
      '把训练成本压到分钟级、渲染延迟压到实时，验证了「换一种更轻的表示，可以在同等甚至更高质量下大幅降低算力开销」。',
      '',
      '三条可迁移的经验：',
      '① 表示方式的选择比模型规模的堆叠更能决定成本上限——本项目在小模型蒸馏路线上的假设与此一致；',
      '② 稀疏初始化（用相机标定产生的稀疏点起步）比随机初始化收敛更快，可类比到本项目的冷启动策略；',
      '③ 用可微的显式光栅化替代体渲染，是绕过神经网络算力瓶颈的可行路径。',
      '',
      '适用边界（须在团队复现时明确）：结论建立在「静态场景 + 充足多视图输入」的前提上；',
      '本项目面对的是低资源、弱监督条件，二者数据分布不同，属于方法论参照而非直接复用。',
    ].join('\n');

    const cardRes = await api('POST', `/projects/${PID}/research/paper-cards`, curatorToken, {
      paper_id: paper.id,
      role_id: ROLE_CURATOR,
      notes: NOTES,
      evidence_quote:
        'However, achieving high visual quality still requires neural networks that are costly to train and render, ' +
        'while recent faster methods inevitably trade off speed for quality.',
      evidence_locator: '摘要 · 第 2 句',
      tags: ['实时渲染', '显式表示', '方法参照', '低资源'],
      rating: 5,
    });
    console.log('  HTTP', cardRes.status, '|', cardRes.json.msg);
    const card = cardRes.json.data;
    if (!card || !card.id) throw new Error('卡片创建返回异常: ' + JSON.stringify(cardRes.json));
    console.log('  card_id =', card.id);
    console.log('  evidence_status =', card.evidence_status ?? card.evidenceStatus);

    console.log('\n=== 4. 项目负责人核验来源 ===');
    const reviewRes = await api('POST', `/projects/${PID}/research/paper-cards/${card.id}/review-evidence`, leaderToken, {
      status: 'reviewed',
    });
    console.log('  HTTP', reviewRes.status, '|', reviewRes.json.msg);

    console.log('\n=== 5. 晋升为共享记忆（飞轮闭环）===');
    const promoteRes = await api('POST', `/projects/${PID}/research/paper-cards/${card.id}/promote`, leaderToken, {});
    console.log('  HTTP', promoteRes.status, '|', promoteRes.json.msg);
    if (promoteRes.json.data) console.log('  memory_id =', promoteRes.json.data.memory_id);

    console.log('\n✅ 建档完成');

  } catch (e) {
    console.error('\n❌ 失败:', e.message);
    process.exitCode = 1;
  }
})();
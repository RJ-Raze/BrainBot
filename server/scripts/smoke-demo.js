// 第一版 Demo 验收：只验证已准备的演示数据与关键隔离边界，不调用外部 API。
// 用法：先 npm run seed:demo，再执行 npm run smoke:demo。
const assert = require('assert');

const BASE = process.env.SMOKE_BASE || 'http://localhost:3001';
let passed = 0;

function ok(name, detail = '') {
  passed += 1;
  console.log(`  ✔ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function request(method, path, body, token) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* endpoint response is not JSON */ }
  return { status: response.status, json, text };
}

async function uploadFile(path, name, content, token) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'text/plain' }), name);
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

async function main() {
  console.log(`[smoke:demo] 目标 ${BASE}\n`);

  const health = await request('GET', '/api/health');
  assert(health.status === 200 && health.json?.data?.status === 'up');
  ok('API 健康检查');

  const ready = await request('GET', '/api/ready');
  assert(ready.status === 200 && ready.json?.data?.status === 'ready');
  ok('数据库就绪检查');

  const login = await request('POST', '/api/v1/auth/login', {
    username: 'demo_researcher', password: 'Demo@123456',
  });
  const token = login.json?.data?.token;
  assert(login.status === 200 && token, '演示账号登录失败；请先执行 npm run seed:demo');
  ok('演示账号登录');

  const projects = await request('GET', '/api/v1/projects', undefined, token);
  const project = projects.json?.data?.items?.find((item) => item.invite_code === 'RESEARCH');
  assert(project, '未找到邀请码为 RESEARCH 的演示项目');
  const pid = project.id;
  ok('演示项目可见', project.name);

  const [detail, tasks, memories, documents, files, papers, directions, cards, experiments, dashboard] = await Promise.all([
    request('GET', `/api/v1/projects/${pid}`, undefined, token),
    request('GET', `/api/v1/projects/${pid}/tasks`, undefined, token),
    request('GET', `/api/v1/projects/${pid}/memories`, undefined, token),
    request('GET', `/api/v1/projects/${pid}/documents`, undefined, token),
    request('GET', `/api/v1/projects/${pid}/files`, undefined, token),
    request('GET', `/api/v1/projects/${pid}/research/papers`, undefined, token),
    request('GET', `/api/v1/projects/${pid}/research/directions`, undefined, token),
    request('GET', `/api/v1/projects/${pid}/research/paper-cards`, undefined, token),
    request('GET', `/api/v1/projects/${pid}/research/experiments`, undefined, token),
    request('GET', `/api/v1/projects/${pid}/research/dashboard`, undefined, token),
  ]);

  assert(detail.json?.data?.roles?.length >= 3 && detail.json?.data?.members?.length >= 3);
  ok('团队结构完整', `${detail.json.data.roles.length} 个角色 / ${detail.json.data.members.length} 位成员`);

  const taskItems = tasks.json?.data?.items || [];
  const statuses = new Set(taskItems.map((task) => task.status));
  assert(taskItems.length >= 5 && ['todo', 'doing', 'review', 'blocked', 'done'].every((status) => statuses.has(status)));
  ok('任务看板覆盖完整状态机', `${taskItems.length} 项任务`);

  assert((memories.json?.data?.items || []).length >= 4);
  assert((documents.json?.data?.items || []).some((doc) => doc.doc_type === 'master'));
  ok('共享记忆与总文档已预置');

  assert((papers.json?.data?.items || []).length >= 3);
  assert((directions.json?.data?.items || []).length >= 3);
  assert((cards.json?.data?.items || []).length >= 3);
  assert((experiments.json?.data?.items || []).length >= 2);
  ok('离线科研链路完整', '论文 → 方向 → 卡片 → 实验');
  assert(files.status === 200 && Array.isArray(files.json?.data?.items));
  ok('科研文档归档接口可用');

  assert(dashboard.json?.data?.totals?.papers >= 3 && dashboard.json?.data?.totals?.experiments >= 2);
  ok('科研驾驶舱聚合正常');

  const unauthenticated = await request('GET', `/api/v1/projects/${pid}/research/papers`);
  assert.strictEqual(unauthenticated.status, 401);
  ok('未登录访问被拒绝');

  const outsiderName = `demo_guard_${Date.now()}`;
  const outsider = await request('POST', '/api/v1/auth/register', {
    username: outsiderName, password: 'Demo@123456', display_name: '权限验收用户',
  });
  const outsiderToken = outsider.json?.data?.token;
  assert(outsiderToken, '权限验收用户创建失败');
  const forbiddenProject = await request('GET', `/api/v1/projects/${pid}`, undefined, outsiderToken);
  const forbiddenResearch = await request('GET', `/api/v1/projects/${pid}/research/dashboard`, undefined, outsiderToken);
  const forbiddenFiles = await request('GET', `/api/v1/projects/${pid}/files`, undefined, outsiderToken);
  assert.strictEqual(forbiddenProject.status, 403);
  assert.strictEqual(forbiddenResearch.status, 403);
  assert.strictEqual(forbiddenFiles.status, 403);
  ok('非成员无法读取项目与研究数据');

  const conversations = await request('GET', `/api/v1/conversations?project_id=${pid}`, undefined, token);
  const cid = conversations.json?.data?.items?.[0]?.id;
  assert(cid, '未找到预置演示会话');
  const forbiddenConversation = await request('GET', `/api/v1/conversations/${cid}/messages`, undefined, outsiderToken);
  assert.strictEqual(forbiddenConversation.status, 403);
  ok('会话 ID 不可绕过项目权限');

  // 使用隔离的临时项目验证跨项目关系不会被伪造；不会改动演示项目数据。
  const isolated = await request('POST', '/api/v1/projects', { name: `隔离验收 ${Date.now()}` }, outsiderToken);
  const isolatedPid = isolated.json?.data?.id;
  assert(isolatedPid, '临时隔离项目创建失败');
  const fileContent = `科研文档上传验收 ${Date.now()}`;
  const uploaded = await uploadFile(`/api/v1/projects/${isolatedPid}/files`, 'smoke-research.txt', fileContent, outsiderToken);
  const uploadedFile = uploaded.json?.data;
  assert(uploaded.status === 200 && uploadedFile?.id);
  const duplicateUpload = await uploadFile(`/api/v1/projects/${isolatedPid}/files`, 'same-content.txt', fileContent, outsiderToken);
  assert(duplicateUpload.status === 200 && duplicateUpload.json?.data?.id === uploadedFile.id && duplicateUpload.json?.data?.duplicate === true);
  ok('科研文档上传与哈希去重');
  const downloaded = await request('GET', `/api/v1/projects/${isolatedPid}/files/${uploadedFile.id}/download`, undefined, outsiderToken);
  assert(downloaded.status === 200 && downloaded.text === fileContent);
  ok('科研文档授权下载');
  const deletedFile = await request('DELETE', `/api/v1/projects/${isolatedPid}/files/${uploadedFile.id}`, undefined, outsiderToken);
  assert.strictEqual(deletedFile.status, 200);
  ok('科研文档删除清理');
  const isolatedRole = await request('POST', `/api/v1/projects/${isolatedPid}/roles`, {
    name: '隔离角色', system_prompt: '仅用于权限验收。',
  }, outsiderToken);
  const foreignRoleConfirm = await request('POST', `/api/v1/projects/${isolatedPid}/initialize/confirm`, {
    tasks: [{ title: '不应接受跨项目角色', role_id: detail.json.data.roles[0].id }],
  }, outsiderToken);
  assert.strictEqual(foreignRoleConfirm.status, 400);
  ok('初始化确认拒绝跨项目角色');

  const ownTask = taskItems[0];
  const isolatedPaper = await request('POST', `/api/v1/projects/${isolatedPid}/research/papers`, {
    title: '隔离项目论文', source: 'smoke', external_id: `isolated-${Date.now()}`,
  }, outsiderToken);
  const foreignReference = await request('POST', `/api/v1/projects/${pid}/tasks/${ownTask.id}/references`, {
    ref_type: 'paper', ref_id: isolatedPaper.json?.data?.id,
  }, token);
  assert.strictEqual(foreignReference.status, 400);
  ok('任务引用拒绝跨项目资料');

  console.log(`\n[smoke:demo] 全部通过 ✔ (${passed}/18)`);
}

main().catch((error) => {
  console.error(`\n✘ Demo 验收失败: ${error.message}`);
  process.exit(1);
});

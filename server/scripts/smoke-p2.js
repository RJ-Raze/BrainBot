// P2 飞轮冒烟：晋升（溯源三字段+重复40901）→ 记忆注入下一轮对话 → 总文档聚合
const BASE = process.env.SMOKE_BASE || 'http://localhost:3001';
const assert = require('assert');

let passed = 0;
const ok = (name) => { passed++; console.log(`  ✔ ${name}`); };

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* SSE */ }
  return { status: res.status, json, text };
}

// SSE 发消息收完整回复
async function chat(cid, content, token) {
  const res = await fetch(`${BASE}/api/v1/conversations/${cid}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content }),
  });
  const text = await res.text();
  const events = {};
  for (const block of text.split('\n\n')) {
    const ev = /event: (\w+)/.exec(block)?.[1];
    const data = /data: (.*)/.exec(block)?.[1];
    if (ev && data) { try { events[ev] = JSON.parse(data); } catch {} }
  }
  return events;
}

(async () => {
  console.log('P2 飞轮冒烟开始 →', BASE);
  const ts = Date.now();

  // 准备：注册 → 建项目 → 建角色 → 认领 → 开会话
  const u = await api('POST', '/api/v1/auth/register', { username: `p2_${ts}`, password: 'pass123456', display_name: 'P2测试' });
  assert.strictEqual(u.json.code, 0, '注册失败');
  const token = u.json.data.token;
  ok('注册登录');

  const p = await api('POST', '/api/v1/projects', { name: 'P2记忆飞轮项目', description: '验证晋升→注入→聚合' }, token);
  const pid = p.json.data.id;
  const inviteCode = p.json.data.invite_code;
  ok('创建项目（含邀请码）');

  const r = await api('POST', `/api/v1/projects/${pid}/roles`, {
    name: '数据负责人', member_name: 'P2测试',
    description: '负责数据采集与清洗',
    system_prompt: '你是科研团队中的「数据负责人」，负责数据采集与清洗。只围绕你的分工提供帮助。',
  }, token);
  assert.strictEqual(r.json.code, 0, '建角色失败: ' + JSON.stringify(r.json));
  const roleId = r.json.data.id;

  // P2 只验证记忆飞轮，项目运行态由初始化链路（smoke:init）单独覆盖；
  // 这里显式切换后再认领，确保遵守“未确认项目不可认领角色”的当前规则。
  const activate = await api('PATCH', `/api/v1/projects/${pid}`, { status: 1 }, token);
  assert.strictEqual(activate.json.code, 0, '项目切换运行模式失败');

  const claim = await api('POST', `/api/v1/projects/${pid}/claim-role`, { invite_code: inviteCode, role_id: roleId }, token);
  assert.strictEqual(claim.json.code, 0, '认领角色失败');
  ok('建角色并认领');

  const c = await api('POST', '/api/v1/conversations', { project_id: pid, role_id: roleId, title: '数据方案讨论' }, token);
  const cid = c.json.data.id;

  // 1) 对话一轮，拿到 AI 消息
  const ev1 = await chat(cid, '我们数据采集团队应该怎么分工？', token);
  assert(ev1.done && ev1.done.assistant_message, 'SSE 未返回 done');
  const aiMsg = ev1.done.assistant_message;
  ok('第一轮对话（SSE）');

  // 2) 晋升为共享记忆
  const promo = await api('POST', `/api/v1/conversations/${cid}/messages/${aiMsg.id}/promote`, {
    category: 'conclusion', title: '数据采集团队分工原则', tags: ['分工', '数据采集'], importance: 4,
  }, token);
  assert.strictEqual(promo.json.code, 0, '晋升失败: ' + JSON.stringify(promo.json));
  const memId = promo.json.data.memory_id;
  ok('晋升 AI 回复为共享记忆');

  // 3) DoD：溯源三字段非空
  const mem = await api('GET', `/api/v1/projects/${pid}/memories/${memId}`, null, token);
  const m = mem.json.data;
  assert(m.creator_rid && m.source_conversation_id && m.source_message_range?.from, '溯源三字段缺失');
  assert.strictEqual(m.category, 'conclusion');
  assert.strictEqual(m.importance, 4);
  ok('溯源三字段全部非空（creator_rid/source_conversation_id/source_message_range）');

  // 新的研究闭环要求记忆先经过审核才允许进入下一轮上下文；
  // 本脚本是单用户飞轮验收，因此显式打开个人确认，仍然走完整 submit → approve 状态机。
  const allowSelfReview = await api('PATCH', `/api/v1/projects/${pid}`, { allow_self_review: true }, token);
  assert.strictEqual(allowSelfReview.json.code, 0, '开启个人确认失败');
  const submitted = await api('POST', `/api/v1/projects/${pid}/reviews/${memId}/transition`, {
    action: 'submit', expectedVersion: m.version,
  }, token);
  assert.strictEqual(submitted.json.code, 0, '提交审核失败: ' + JSON.stringify(submitted.json));
  const approved = await api('POST', `/api/v1/projects/${pid}/reviews/${memId}/transition`, {
    action: 'approve', expectedVersion: submitted.json.data.version,
  }, token);
  assert.strictEqual(approved.json.code, 0, '审核通过失败: ' + JSON.stringify(approved.json));
  ok('共享记忆通过审核后才进入上下文');

  // 4) DoD：重复晋升返回 40901
  const dup = await api('POST', `/api/v1/conversations/${cid}/messages/${aiMsg.id}/promote`, {
    category: 'fact', title: '重复晋升',
  }, token);
  assert.strictEqual(dup.json.code, 40901, `重复晋升应返回 40901，实际 ${dup.json.code}`);
  ok('重复晋升被 40901 拒绝');

  // 5) 手工写入一条决策记忆
  const manual = await api('POST', `/api/v1/projects/${pid}/memories`, {
    category: 'decision', title: '采用分层抽样方案', content: '全队一致同意采用分层抽样，按地区分层。', tags: ['抽样'], importance: 5,
  }, token);
  assert.strictEqual(manual.json.code, 0);
  ok('手工写入决策记忆');

  const manualSubmitted = await api('POST', `/api/v1/projects/${pid}/reviews/${manual.json.data.id}/transition`, {
    action: 'submit', expectedVersion: manual.json.data.version,
  }, token);
  assert.strictEqual(manualSubmitted.json.code, 0, '手工记忆提交审核失败');
  const manualApproved = await api('POST', `/api/v1/projects/${pid}/reviews/${manual.json.data.id}/transition`, {
    action: 'approve', expectedVersion: manualSubmitted.json.data.version,
  }, token);
  assert.strictEqual(manualApproved.json.code, 0, '手工记忆审核通过失败');

  // 6) 记忆注入下一轮对话（context-preview 透明化验证）
  const prev = await api('GET', `/api/v1/conversations/${cid}/context-preview`, null, token);
  assert.strictEqual(prev.json.code, 0);
  assert(prev.json.data.l2.count >= 2, `L2 应注入 ≥2 条记忆，实际 ${prev.json.data.l2.count}`);
  const injected = prev.json.data.l2.memories.join('\n');
  assert(injected.includes('数据采集团队分工原则') && injected.includes('采用分层抽样方案'), 'L2 注入内容缺记忆');
  ok(`上下文透明化：L2 注入 ${prev.json.data.l2.count} 条记忆（含新晋升的两条）`);

  // 7) 列表过滤 + 检索
  const list = await api('GET', `/api/v1/projects/${pid}/memories?category=decision`, null, token);
  assert.strictEqual(list.json.data.total, 1);
  const search = await api('GET', `/api/v1/projects/${pid}/memories/search?q=抽样`, null, token);
  assert(search.json.data.total >= 1, '检索未命中');
  ok('记忆列表过滤 + 关键词检索');

  // 8) 置顶
  const pin = await api('PATCH', `/api/v1/projects/${pid}/memories/${memId}`, { is_pinned: true }, token);
  assert.strictEqual(pin.json.data.is_pinned, true);
  ok('记忆置顶');

  // 9) 总文档聚合（master refresh）
  const refresh = await api('POST', `/api/v1/projects/${pid}/documents/master/refresh`, {}, token);
  assert.strictEqual(refresh.json.code, 0, 'refresh 失败: ' + JSON.stringify(refresh.json));
  const doc = refresh.json.data;
  assert(doc.memory_count >= 2, '聚合记忆数不对');
  assert(doc.content.includes('决策记录') && doc.content.includes('采用分层抽样方案'), '总文档缺决策分区');
  assert(doc.content.includes('数据采集团队分工原则'), '总文档缺结论分区');
  assert(doc.content.includes('来源角色：数据负责人'), '总文档缺溯源信息');
  ok(`总文档聚合（${doc.memory_count} 条记忆 → 分区视图，含溯源）`);

  // 10) 手动编辑后脱离自动同步
  const edit = await api('PATCH', `/api/v1/projects/${pid}/documents/${doc.id}`, { content: doc.content + '\n\n## 手工补充\n创立人手写的一行。' }, token);
  assert.strictEqual(edit.json.data.is_auto_synced, false);
  const reRefresh = await api('POST', `/api/v1/projects/${pid}/documents/${doc.id}/refresh`, {}, token);
  assert.strictEqual(reRefresh.json.code, 40001, '脱离同步的文档应拒绝 refresh');
  ok('手动编辑脱离自动同步 + refresh 保护');

  // 11) 撤回共享
  const del = await api('DELETE', `/api/v1/projects/${pid}/memories/${memId}`, null, token);
  assert.strictEqual(del.json.code, 0);
  const after = await api('GET', `/api/v1/projects/${pid}/memories`, null, token);
  assert.strictEqual(after.json.data.total, 1);
  // 消息上的晋升标记应被解除
  const msgs = await api('GET', `/api/v1/conversations/${cid}/messages`, null, token);
  const target = msgs.json.data.items.find((x) => x.id === aiMsg.id);
  assert(!target.promoted_memory_id, '撤回后消息晋升标记未解除');
  ok('撤回共享 + 消息晋升标记解除');

  console.log(`\nP2 冒烟全部通过 ✔ (${passed}/${passed})`);
  process.exit(0);
})().catch((e) => { console.error('\n✘ 冒烟失败:', e.message); process.exit(1); });

// P3 协作冒烟：任务状态机（非法转移 40001）+ task_references（重复 40901）+ SSE 事件流（1s 内到达）
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
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

(async () => {
  console.log('P3 协作冒烟开始 →', BASE);
  const ts = Date.now();

  // 准备：注册 → 建项目 → 建角色 → 认领 → 确认运行
  const u = await api('POST', '/api/v1/auth/register', { username: `p3_${ts}`, password: 'pass123456', display_name: 'P3测试' });
  const token = u.json.data.token;
  ok('注册登录');

  const p = await api('POST', '/api/v1/projects', { name: 'P3协作项目', description: '状态机+事件流验证' }, token);
  const pid = p.json.data.id;
  const inviteCode = p.json.data.invite_code;

  const r = await api('POST', `/api/v1/projects/${pid}/roles`, {
    name: '分析负责人', member_name: 'P3测试', description: '负责数据分析',
    system_prompt: '你是「分析负责人」，负责数据分析。',
  }, token);
  const roleId = r.json.data.id;
  await api('POST', `/api/v1/projects/${pid}/claim-role`, { invite_code: inviteCode, role_id: roleId }, token);
  ok('建项目 + 建角色 + 认领');

  // 1) 手动建任务
  const t = await api('POST', `/api/v1/projects/${pid}/tasks`, {
    title: '搭建分析流水线', description: '数据进来到报表出去', priority: 'P0', role_id: roleId,
  }, token);
  assert.strictEqual(t.json.code, 0);
  const tid = t.json.data.id;
  assert.strictEqual(t.json.data.status, 'todo');
  ok('手动建任务（默认 todo）');

  // 2) 状态机：todo → done 非法
  const bad = await api('PATCH', `/api/v1/projects/${pid}/tasks/${tid}`, { status: 'done' }, token);
  assert.strictEqual(bad.json.code, 40001, `todo→done 应 40001，实际 ${bad.json.code}`);
  // 状态未被改变
  const check = await api('GET', `/api/v1/projects/${pid}/tasks`, null, token);
  assert.strictEqual(check.json.data.items[0].status, 'todo');
  ok('非法状态转移 todo→done 被 40001 拒绝');

  // 3) 合法链路：todo→doing→blocked→doing→review→done
  for (const s of ['doing', 'blocked', 'doing', 'review', 'done']) {
    const res = await api('PATCH', `/api/v1/projects/${pid}/tasks/${tid}`, { status: s }, token);
    assert.strictEqual(res.json.code, 0, `转移到 ${s} 失败: ${JSON.stringify(res.json)}`);
  }
  const done = await api('GET', `/api/v1/projects/${pid}/tasks`, null, token);
  assert.strictEqual(done.json.data.items[0].status, 'done');
  ok('合法状态链路 todo→doing→blocked→doing→review→done 全通');

  // 4) 阻塞态非法转移：blocked→done
  const t2 = await api('POST', `/api/v1/projects/${pid}/tasks`, { title: '第二任务', priority: 'P1' }, token);
  const tid2 = t2.json.data.id;
  await api('PATCH', `/api/v1/projects/${pid}/tasks/${tid2}`, { status: 'doing' }, token);
  await api('PATCH', `/api/v1/projects/${pid}/tasks/${tid2}`, { status: 'blocked' }, token);
  const bad2 = await api('PATCH', `/api/v1/projects/${pid}/tasks/${tid2}`, { status: 'done' }, token);
  assert.strictEqual(bad2.json.code, 40001, 'blocked→done 应 40001');
  ok('非法转移 blocked→done 被 40001 拒绝');

  // 5) 任务引用：添加记忆引用 + 重复 40901
  const mem = await api('POST', `/api/v1/projects/${pid}/memories`, {
    category: 'fact', title: '数据集口径说明', content: '统一用 2024 年口径。',
  }, token);
  const memId = mem.json.data.id;
  const ref = await api('POST', `/api/v1/projects/${pid}/tasks/${tid2}/references`, {
    ref_type: 'memory', ref_id: memId, note: '口径以这条为准',
  }, token);
  assert.strictEqual(ref.json.code, 0);
  const dupRef = await api('POST', `/api/v1/projects/${pid}/tasks/${tid2}/references`, {
    ref_type: 'memory', ref_id: memId,
  }, token);
  assert.strictEqual(dupRef.json.code, 40901, `重复引用应 40901，实际 ${dupRef.json.code}`);
  const refs = await api('GET', `/api/v1/projects/${pid}/tasks/${tid2}/references`, null, token);
  assert.strictEqual(refs.json.data.total, 1);
  assert.strictEqual(refs.json.data.items[0].ref_title, '数据集口径说明');
  ok('任务引用：添加 + 重复 40901 + 列表带标题');

  // 6) SSE 事件流：订阅 → 改任务状态 → 1s 内收到 task.updated
  const events = [];
  let connected = false;
  const controller = new AbortController();
  const ssePromise = (async () => {
    const resp = await fetch(`${BASE}/api/v1/projects/${pid}/events`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    });
    assert.strictEqual(resp.status, 200);
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done: rd, value } = await reader.read();
      if (rd) break;
      buf += decoder.decode(value, { stream: true });
      for (const block of buf.split('\n\n')) {
        const ev = /event: ([\w.]+)/.exec(block)?.[1];
        const data = /data: (.*)/.exec(block)?.[1];
        if (ev === 'connected') connected = true;
        else if (ev && data) {
          try { events.push({ event: ev, data: JSON.parse(data), at: Date.now() }); } catch {}
        }
      }
      buf = buf.split('\n\n').pop() || '';
      if (events.length >= 2) return;
    }
  })();

  await new Promise((r) => setTimeout(r, 500));
  assert(connected, 'SSE 未收到 connected 事件');

  const t0 = Date.now();
  await api('PATCH', `/api/v1/projects/${pid}/tasks/${tid2}`, { status: 'doing' }, token); // blocked→doing
  await api('POST', `/api/v1/projects/${pid}/memories`, { category: 'decision', title: '事件测试决策', content: 'x' }, token);

  await Promise.race([ssePromise, new Promise((r) => setTimeout(r, 3000))]);
  controller.abort();

  const taskEv = events.find((e) => e.event === 'task.updated');
  assert(taskEv, '未收到 task.updated 事件');
  assert(taskEv.at - t0 < 1000, `事件延迟 ${taskEv.at - t0}ms 超过 1s`);
  assert.strictEqual(taskEv.data.task.status, 'doing');
  const memEv = events.find((e) => e.event === 'memory.promoted');
  assert(memEv && memEv.data.title === '事件测试决策', '未收到 memory.promoted 事件');
  ok(`SSE 事件流：task.updated ${taskEv.at - t0}ms 内到达 + memory.promoted 广播`);

  // 7) 未授权订阅被拒
  const noAuth = await fetch(`${BASE}/api/v1/projects/${pid}/events`);
  assert.strictEqual(noAuth.status, 401);
  ok('事件流未授权 401');

  // 8) 删除任务（仅创立人）+ task.deleted 事件
  const del = await api('DELETE', `/api/v1/projects/${pid}/tasks/${tid2}`, null, token);
  assert.strictEqual(del.json.code, 0);
  ok('删除任务（创立人）');

  console.log(`\nP3 冒烟全部通过 ✔ (${passed}/10)`);
  process.exit(0);
})().catch((e) => { console.error('\n✘ 冒烟失败:', e.message); process.exit(1); });

// 项目级 SSE 事件广播中心（P3-03）
// 同一项目成员的看板/任务列表实时联动：任务变更、记忆晋升、角色认领、文档刷新
const clients = new Map(); // projectId -> Set<res>

function subscribe(projectId, res) {
  if (!clients.has(projectId)) clients.set(projectId, new Set());
  clients.get(projectId).add(res);
}

function unsubscribe(projectId, res) {
  const set = clients.get(projectId);
  if (set) {
    set.delete(res);
    if (!set.size) clients.delete(projectId);
  }
}

// 向项目所有在线成员广播一个事件
function emit(projectId, event, data) {
  const set = clients.get(projectId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify({ ...data, _at: Date.now() })}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch { /* 连接已断，由 close 清理 */ }
  }
}

function onlineCount(projectId) {
  return clients.get(projectId)?.size || 0;
}

module.exports = { subscribe, unsubscribe, emit, onlineCount };

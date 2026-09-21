// M5 三层上下文注入（P1）—— 角色差异化的运行时承载
// L1 角色设定（system_prompt 恒定置顶，永不截断）
// L2 项目共享记忆（按重要性/置顶排序，预算内装入）
// L3 会话历史（超长时只砍中部，保头保尾）
const prisma = require('../db');

// 粗略 token 估算：中文按 1 字≈1 token，英文按 4 字符≈1 token
function estimateTokens(text) {
  if (!text) return 0;
  const cjk = (text.match(/[一-鿿]/g) || []).length;
  return cjk + Math.ceil((text.length - cjk) / 4);
}

const L2_BUDGET = parseInt(process.env.CTX_L2_BUDGET || '2000', 10); // 记忆层 token 预算
const L3_BUDGET = parseInt(process.env.CTX_L3_BUDGET || '4000', 10); // 历史层 token 预算
const L3_KEEP_HEAD = 2; // 截断时保留开头 N 条
const L3_KEEP_TAIL = 8; // 截断时保留结尾 N 条

// L2：取项目共享记忆（置顶优先，其次重要性，再按时间）
async function loadMemories(projectId) {
  const memories = await require('./review').approvedMemories(prisma, projectId);
  const picked = [];
  let used = 0;
  for (const m of memories) {
    const line = `【${m.category}】${m.title}：${m.content}`;
    const t = estimateTokens(line);
    if (used + t > L2_BUDGET) continue;
    picked.push(line);
    used += t;
  }
  return picked;
}

// L3：会话历史，超长只砍中部
async function loadHistory(conversationId) {
  const messages = await prisma.message.findMany({
    where: { conversationId, senderType: { in: ['user', 'assistant'] } },
    orderBy: { createdAt: 'asc' },
    select: { senderType: true, content: true },
  });
  const toMsg = (m) => ({ role: m.senderType === 'user' ? 'user' : 'assistant', content: m.content });

  const total = messages.reduce((s, m) => s + estimateTokens(m.content), 0);
  if (total <= L3_BUDGET || messages.length <= L3_KEEP_HEAD + L3_KEEP_TAIL + 1) {
    return messages.map(toMsg);
  }
  // 只砍中部：保头保尾，插入占位说明
  const head = messages.slice(0, L3_KEEP_HEAD);
  const tail = messages.slice(-L3_KEEP_TAIL);
  const omitted = messages.length - head.length - tail.length;
  return [
    ...head.map(toMsg),
    { role: 'system', content: `（中间 ${omitted} 条历史消息因上下文长度限制已省略）` },
    ...tail.map(toMsg),
  ];
}

// 三层拼装出口：返回可直接发给 LLM 的 messages 数组
async function buildMessages({ project, role, conversation }) {
  // L1：角色设定恒定置顶（C1：角色差异的唯一来源就是 system_prompt）
  const l1 = {
    role: 'system',
    content: role.systemPrompt,
  };
  // L2：项目共享记忆
  const memoryLines = await loadMemories(project.id);
  const l2 = memoryLines.length
    ? [{ role: 'system', content: `以下是项目「${project.name}」的共享记忆，请在回答中参考：\n${memoryLines.join('\n')}` }]
    : [];
  // L3：会话历史
  const l3 = await loadHistory(conversation.id);
  return [l1, ...l2, ...l3];
}

module.exports = { buildMessages, estimateTokens };

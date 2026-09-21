// 离线演示种子：不调用 LLM 或外部学术 API。
// 用法：在已迁移数据库的 server/ 目录执行 npm run seed:demo
// 可重复执行：固定邀请码与演示账号会更新，核心演示记录按标题/来源幂等复用。
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/db');

const DEMO_PASSWORD = 'Demo@123456';

async function ensureUser({ username, displayName }) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.upsert({
    where: { username },
    update: { displayName, passwordHash, status: 1 },
    create: { username, displayName, passwordHash },
  });
}

async function ensureTask(projectId, values) {
  const existing = await prisma.task.findFirst({ where: { projectId, title: values.title } });
  const data = { projectId, ...values };
  return existing
    ? prisma.task.update({ where: { id: existing.id }, data: values })
    : prisma.task.create({ data });
}

async function ensurePaper(projectId, values) {
  return prisma.paper.upsert({
    where: { projectId_source_externalId: { projectId, source: values.source, externalId: values.externalId } },
    update: { ...values, projectId },
    create: { ...values, projectId },
  });
}

async function ensureCard(values) {
  const existing = await prisma.paperCard.findFirst({
    where: { projectId: values.projectId, paperId: values.paperId, authorUserId: values.authorUserId },
  });
  return existing
    ? prisma.paperCard.update({ where: { id: existing.id }, data: values })
    : prisma.paperCard.create({ data: values });
}

async function ensureMemory(projectId, key, values) {
  const sourceConversationId = `demo-memory:${key}`;
  // 优先按 source_msg_id 幂等（v2.0 起有唯一约束），其次按 sourceConversationId；
  // 避免重复执行时把 source_msg_id 改成已被其他记忆占用的值而触发唯一冲突。
  let existing = values.sourceMsgId
    ? await prisma.memory.findFirst({ where: { sourceMsgId: values.sourceMsgId } })
    : null;
  if (!existing) {
    existing = await prisma.memory.findFirst({ where: { projectId, sourceConversationId } });
  }
  const data = { projectId, sourceConversationId, ...values };
  return existing
    ? prisma.memory.update({ where: { id: existing.id }, data: values })
    : prisma.memory.create({ data });
}

async function ensureExperiment(projectId, values) {
  const existing = await prisma.experiment.findFirst({ where: { projectId, title: values.title } });
  const data = { projectId, ...values };
  return existing
    ? prisma.experiment.update({ where: { id: existing.id }, data: values })
    : prisma.experiment.create({ data });
}

async function main() {
  const [leader, curator, verifier] = await Promise.all([
    ensureUser({ username: 'demo_researcher', displayName: '林知远 · 研究统筹' }),
    ensureUser({ username: 'demo_curator', displayName: '周明月 · 文献策展' }),
    ensureUser({ username: 'demo_verifier', displayName: '陈予安 · 实验验证' }),
  ]);

  const project = await prisma.project.upsert({
    where: { inviteCode: 'RESEARCH' },
    update: {
      name: '低资源可靠推理 · 协作研究 Demo',
      description: '展示团队如何把资料、研究方向、实验与决策沉淀到可追溯的共同工作区。',
      domain: 'AI for Science', status: 1, ownerId: leader.id,
    },
    create: {
      name: '低资源可靠推理 · 协作研究 Demo',
      description: '展示团队如何把资料、研究方向、实验与决策沉淀到可追溯的共同工作区。',
      domain: 'AI for Science', status: 1, inviteCode: 'RESEARCH', ownerId: leader.id,
    },
  });

  const roleSpecs = [
    { name: '研究统筹', memberName: '林知远', description: '负责研究取舍、证据汇总与团队决策。', user: leader, color: '#BFC0C7' },
    { name: '文献策展', memberName: '周明月', description: '负责资料收录、精读卡片与证据质量。', user: curator, color: '#8AB49A' },
    { name: '实验验证', memberName: '陈予安', description: '负责复现设计、指标记录与失败分析。', user: verifier, color: '#D8B45A' },
  ];
  const roles = {};
  for (const [sortOrder, spec] of roleSpecs.entries()) {
    const role = await prisma.role.upsert({
      where: { projectId_name: { projectId: project.id, name: spec.name } },
      update: {
        memberName: spec.memberName, description: spec.description, color: spec.color,
        systemPrompt: `你是「${spec.name}」。${spec.description} 仅基于团队已有资料提出可验证的下一步。`,
        sortOrder, isArchived: false,
      },
      create: {
        projectId: project.id, name: spec.name, memberName: spec.memberName, description: spec.description,
        color: spec.color, sortOrder,
        systemPrompt: `你是「${spec.name}」。${spec.description} 仅基于团队已有资料提出可验证的下一步。`,
        tempLimit: 0.3,
      },
    });
    roles[spec.name] = role;
    await prisma.projectMember.upsert({
      where: { projectId_userId_roleId: { projectId: project.id, userId: spec.user.id, roleId: role.id } },
      update: { isLeader: spec.user.id === leader.id },
      create: { projectId: project.id, userId: spec.user.id, roleId: role.id, isLeader: spec.user.id === leader.id },
    });
  }

  const baselineTask = await ensureTask(project.id, {
    roleId: roles['研究统筹'].id, title: '确定低资源可靠推理的对比基线',
    description: '明确可复现的公开基线、数据切分与评估口径。', priority: 1, status: 'done', progress: 100,
  });
  const literatureTask = await ensureTask(project.id, {
    roleId: roles['文献策展'].id, title: '整理候选论文与证据强度',
    description: '收录关键论文，标记可复用结论与不适用条件。', priority: 1, status: 'review', progress: 80,
  });
  const reproduceTask = await ensureTask(project.id, {
    roleId: roles['实验验证'].id, title: '复现实验：结构化提示策略',
    description: '固定随机种子，对比直接提示与结构化提示的稳定性。', priority: 1, status: 'doing', progress: 55,
  });
  await ensureTask(project.id, {
    roleId: roles['实验验证'].id, title: '补充失败案例的误差分析',
    description: '定位低资源条件下输出波动的主要来源。', priority: 2, status: 'blocked', progress: 35,
  });
  await ensureTask(project.id, {
    roleId: roles['研究统筹'].id, title: '形成下一轮实验决策建议',
    description: '基于文献卡片和复现结果提出下一轮取舍。', priority: 2, status: 'todo', progress: 0,
  });

  const directionSpecs = [
    { name: '结构化提示的低资源稳定性', description: '在有限标注下测试结构化中间步骤是否降低输出方差。', status: 'selected', feasibility: 5, novelty: 3, impact: 5, evidenceCount: 4, rootTaskId: reproduceTask.id },
    { name: '检索增强的证据约束', description: '评估外部证据在资源受限任务中的收益与成本边界。', status: 'exploring', feasibility: 3, novelty: 4, impact: 4, evidenceCount: 2, rootTaskId: literatureTask.id },
    { name: '小模型蒸馏的长期路线', description: '作为中长期方向，暂不进入当前 Demo 的验证范围。', status: 'parked', feasibility: 2, novelty: 4, impact: 3, evidenceCount: 1, rootTaskId: baselineTask.id },
  ];
  const directions = {};
  for (const spec of directionSpecs) {
    const existing = await prisma.directionNode.findFirst({ where: { projectId: project.id, name: spec.name } });
    const data = { projectId: project.id, createdBy: leader.id, ...spec };
    directions[spec.name] = existing
      ? await prisma.directionNode.update({ where: { id: existing.id }, data: spec })
      : await prisma.directionNode.create({ data });
  }

  const papers = await Promise.all([
    ensurePaper(project.id, {
      source: 'demo', externalId: 'reliable-reasoning-2026', title: 'Reliable Reasoning under Resource Constraints',
      authors: ['Demo Research Group'], abstract: 'A reproducible baseline for evaluating reliable reasoning under constrained data and compute.',
      year: 2026, venue: 'Demo Systems Workshop', keywords: ['reasoning', 'reproducibility'], citationCount: 12,
      rawMeta: { demo: true, evidence: 'baseline' },
    }),
    ensurePaper(project.id, {
      source: 'demo', externalId: 'structured-prompts-2025', title: 'Structured Prompts for Stable Small-Data Inference',
      authors: ['M. Zhou', 'A. Chen'], abstract: 'Structured intermediate steps improve output stability when supervision and compute are constrained.',
      year: 2025, venue: 'Demo ML Review', keywords: ['prompting', 'low-resource'], citationCount: 28,
      rawMeta: { demo: true, evidence: 'method' },
    }),
    ensurePaper(project.id, {
      source: 'demo', externalId: 'retrieval-boundaries-2024', title: 'When Retrieval Helps: Evidence Boundaries in Compact Research Agents',
      authors: ['L. Lin'], abstract: 'A study of benefit, latency and failure modes for evidence-constrained retrieval pipelines.',
      year: 2024, venue: 'Demo Agent Notes', keywords: ['retrieval', 'evidence'], citationCount: 9,
      rawMeta: { demo: true, evidence: 'comparison' },
    }),
  ]);

  const leaderCard = await ensureCard({
    projectId: project.id, paperId: papers[0].id, roleId: roles['研究统筹'].id, authorUserId: leader.id,
    notes: '基线定义清晰，可作为团队当前实验的共同对照。结论只在固定数据切分与随机种子下成立。',
    evidenceQuote: 'A reproducible baseline for evaluating reliable reasoning under constrained data and compute.',
    evidenceLocator: '摘要 · 第 1 句', evidenceStatus: 'reviewed', tags: ['基线', '可复现'], rating: 5, isShared: true,
  });
  await ensureCard({
    projectId: project.id, paperId: papers[1].id, roleId: roles['文献策展'].id, authorUserId: curator.id,
    notes: '结构化提示有降低方差的迹象，但需与本项目数据分布重新验证，不能直接外推。',
    evidenceQuote: 'Structured intermediate steps improve output stability when supervision and compute are constrained.',
    evidenceLocator: '摘要 · 第 1 句', evidenceStatus: 'unverified', tags: ['方法', '稳定性'], rating: 4, isShared: false,
  });
  await ensureCard({
    projectId: project.id, paperId: papers[2].id, roleId: roles['文献策展'].id, authorUserId: curator.id,
    notes: '检索增强适合下一阶段比较；当前先保持离线资料录入，避免把 API 接入混入核心链路验收。',
    evidenceQuote: 'Evidence-constrained retrieval pipelines trade latency against coverage and failure recovery.',
    evidenceLocator: '结论 · 第 2 段', evidenceStatus: 'conflicting', tags: ['边界', '后续'], rating: 3, isShared: false,
  });

  const conversation = await prisma.conversation.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: { projectId: project.id, roleId: roles['研究统筹'].id, title: '研究取舍 · 首轮共识', createdBy: leader.id, isArchived: false },
    create: {
      id: '00000000-0000-4000-8000-000000000001', projectId: project.id, roleId: roles['研究统筹'].id,
      title: '研究取舍 · 首轮共识', createdBy: leader.id, messageCount: 2, lastMessageAt: new Date(),
    },
  });
  const hasMessages = await prisma.message.count({ where: { conversationId: conversation.id } });
  let assistantMessage;
  if (!hasMessages) {
    await prisma.message.create({
      data: { conversationId: conversation.id, projectId: project.id, roleId: roles['研究统筹'].id, senderType: 'user', senderUserId: leader.id, content: '第一轮应该优先验证什么，才能让团队快速获得可信证据？' },
    });
    assistantMessage = await prisma.message.create({
      data: { conversationId: conversation.id, projectId: project.id, roleId: roles['研究统筹'].id, senderType: 'assistant', content: '先固定一个可复现基线，再把结构化提示作为单一变量比较。每轮实验都记录数据切分、随机种子、指标与失败样本，形成可审计的下一步决策。' },
    });
  } else {
    assistantMessage = await prisma.message.findFirst({ where: { conversationId: conversation.id, senderType: 'assistant' }, orderBy: { createdAt: 'desc' } });
  }

  await ensureMemory(project.id, 'decision', {
    category: 'decision', title: '首轮只验证结构化提示这一条变量',
    content: '先固定公开基线、数据切分与随机种子；首轮不接外部 API，也不并行引入检索增强，确保结论可解释。',
    sourceRoleId: roles['研究统筹'].id, sourceUserId: leader.id, creatorRid: roles['研究统筹'].id,
    sourceMessageRange: { from: 'demo-decision', to: 'demo-decision' }, tags: ['首轮', '范围控制'], importance: 5, isPinned: true,
  });
  await ensureMemory(project.id, 'risk', {
    category: 'risk', title: '低资源结论不能直接外推',
    content: '论文中的稳定性结论依赖任务分布和评估口径，Demo 中应明确展示其适用边界与待验证条件。',
    sourceRoleId: roles['文献策展'].id, sourceUserId: curator.id, creatorRid: roles['文献策展'].id,
    sourceMessageRange: { from: 'demo-risk', to: 'demo-risk' }, tags: ['风险', '外推'], importance: 4, isPinned: false,
  });
  await ensureMemory(project.id, 'paper-card', {
    category: 'paper_card', title: papers[0].title, content: leaderCard.notes,
    sourceRoleId: roles['研究统筹'].id, sourceUserId: leader.id, creatorRid: roles['研究统筹'].id,
    sourceMessageRange: { from: leaderCard.id, to: leaderCard.id }, tags: ['基线', '可复现', `paper:${papers[0].externalId}`], importance: 5, isPinned: false,
  });
  const conclusionMemory = await ensureMemory(project.id, 'conversation', {
    category: 'conclusion', title: '可复现基线先于功能扩张',
    content: assistantMessage?.content || '先固定一个可复现基线，再逐步扩展研究变量。',
    sourceRoleId: roles['研究统筹'].id, sourceUserId: leader.id, sourceMsgId: assistantMessage?.id || null,
    creatorRid: roles['研究统筹'].id, sourceMessageRange: { from: assistantMessage?.id || 'demo-conversation', to: assistantMessage?.id || 'demo-conversation' },
    tags: ['决策依据', '复现'], importance: 5, isPinned: false,
  });
  if (assistantMessage && assistantMessage.meta?.promoted_memory_id !== conclusionMemory.id) {
    await prisma.message.update({
      where: { id: assistantMessage.id }, data: { meta: { ...(assistantMessage.meta || {}), promoted_memory_id: conclusionMemory.id } },
    });
  }

  await ensureExperiment(project.id, {
    roleId: roles['实验验证'].id, taskId: reproduceTask.id, directionId: directions['结构化提示的低资源稳定性'].id,
    title: '基线复现：低资源推理', hypothesis: '固定随机种子后，结构化提示能减少输出波动。',
    setup: '固定数据切分，对比直接提示与结构化提示，各运行三次。',
    result: '已完成第一轮复现，结构化提示的方差更低。', metric: { accuracy: 0.71, variance: 0.03 },
    conclusion: '进入误差分析，确认收益是否来自模板而非数据泄漏。', status: 'succeeded', runAt: new Date('2026-09-08T09:30:00+08:00'), createdBy: verifier.id,
  });
  await ensureExperiment(project.id, {
    roleId: roles['实验验证'].id, taskId: reproduceTask.id, directionId: directions['结构化提示的低资源稳定性'].id,
    title: '消融：移除证据约束', hypothesis: '移除证据约束后，局部正确率可能提升但稳定性下降。',
    setup: '沿用相同数据切分，只移除证据约束。', result: null, metric: {},
    conclusion: '实验进行中，待收集失败案例。', status: 'running', runAt: new Date('2026-09-10T14:00:00+08:00'), createdBy: verifier.id,
  });

  const masterContent = `# ${project.name} · 项目总文档

> 演示种子已准备。内容来自团队共享记忆、文献卡片与实验记录，可在工作台中继续编辑或重新聚合。

## 当前决策

- 先固定可复现基线与评估口径，再验证结构化提示这一条变量。
- 外部 AI / 学术 API 保持关闭，待核心链路验收后统一接入。

## 研究证据

- 《${papers[0].title}》：${leaderCard.notes}
- 《${papers[1].title}》：提示结构的收益需在当前数据分布上复核。

## 实验下一步

- 完成消融实验并补齐失败样本的误差分析。
- 由研究统筹基于证据与实验记录形成下一轮决策建议。
`;
  const master = await prisma.document.findFirst({ where: { projectId: project.id, docType: 'master' } });
  if (master) {
    await prisma.document.update({ where: { id: master.id }, data: { title: `${project.name} · 项目总文档`, content: masterContent, isAutoSynced: true, lastEditorId: leader.id } });
  } else {
    await prisma.document.create({ data: { projectId: project.id, title: `${project.name} · 项目总文档`, content: masterContent, docType: 'master', isAutoSynced: true, lastEditorId: leader.id } });
  }

  console.log('演示数据已准备（可重复执行，不会重复创建核心记录）：');
  console.log(`  项目：${project.name}`);
  console.log(`  账号：demo_researcher / ${DEMO_PASSWORD}`);
  console.log('  备用成员：demo_curator、demo_verifier（密码相同）');
  console.log('  邀请码：RESEARCH');
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

// 初始化模式 + 组队 + 任务（对齐原版 BrainBot 设计逻辑）
// 初始化：创立人输入 项目描述 + 各成员分工 → AI 一次性出任务结构草案（人确认才生效）
// 组队：邀请码 → 组员按分工认领角色 → 进入运行模式
const express = require('express');
const crypto = require('crypto');
const prisma = require('../db');
const { ok, wrap, E } = require('../middleware/error');
const { authRequired } = require('../middleware/auth');
const { requireProjectAccess } = require('../middleware/permission');
const rateLimit = require('../middleware/rate-limit');
const initService = require('../services/init');
const hub = require('../services/events');

const router = express.Router();
router.use(authRequired);

// 邀请码为 8 位可枚举值：查询与认领接口按 IP 限流（10 次/分），防爆破
const inviteGuard = rateLimit({ limit: 10 });

const PRIORITY_MAP = { P0: 1, P1: 2, P2: 3 };
const PRIORITY_REV = { 1: 'P0', 2: 'P1', 3: 'P2' };

function genInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 位十六进制
}

const taskView = (t) => ({
  id: t.id, title: t.title, description: t.description,
  priority: PRIORITY_REV[t.priority] || 'P1', status: t.status,
  role_id: t.roleId, role_name: t.role?.name || null, member_name: t.role?.memberName || null,
  match_reasoning: t.meta?.match_reasoning || '',
  created_at: t.createdAt,
});

async function loadProjectTask(pid, tid) {
  const task = await prisma.task.findUnique({ where: { id: tid } });
  if (!task || task.projectId !== pid) throw E.notFound('任务不存在');
  return task;
}

function assertTaskWriteAccess(req, task) {
  // 未指派的协作任务允许任意项目成员推进；已指派任务仅负责人角色或项目负责人可变更。
  if (!req.isLeader && task.roleId) {
    const ownRoleId = req.membership?.roleId;
    if (ownRoleId !== task.roleId) throw E.noWrite('只能更新自己角色负责的任务');
  }
}

// ---------- 初始化模式 ----------

// POST /api/v1/projects/:pid/initialize
// body: { members: [{name, role_description, me?}] }
// 动作：按成员建角色（幂等：同名更新）→ 一次性 LLM 生成任务结构草案（status=draft）→ 返回草案 + 邀请码
router.post('/:pid/initialize', requireProjectAccess, wrap(async (req, res) => {
  if (req.project.ownerId !== req.user.id) throw E.noProject('仅项目创立人可执行初始化');
  if (req.project.status !== 0) throw E.param('项目已完成初始化并进入运行模式，请勿重复执行');
  const { members } = req.body || {};
  if (!Array.isArray(members) || members.length === 0) throw E.param('members 必填：至少一位成员及其分工');
  for (const m of members) {
    if (!m.name || !m.role_description) throw E.param('每位成员都需要 name 与 role_description');
  }

  const project = await prisma.project.findUnique({ where: { id: req.project.id } });

  // 1) 先一次性 LLM 生成任务结构草案：成功后才落库任何数据，避免 LLM 失败留下半完成态
  const draft = await initService.generateTaskDraft({ project, members });

  // 2) 草案生成成功后，角色 + 草案任务 + 邀请码在一个事务内落库
  const result = await prisma.$transaction(async (tx) => {
    const roleByName = {};
    const existingRoles = await tx.role.findMany({ where: { projectId: project.id } });
    const existingByName = new Map(existingRoles.map((r) => [r.name, r]));
    for (const [i, m] of members.entries()) {
      const current = existingByName.get(m.name);
      let role;
      if (current) {
        // 已归档角色不复活、不覆盖其已调优的 systemPrompt（复活走 roles/:rid/restore）
        role = current.isArchived
          ? current
          : await tx.role.update({
              where: { id: current.id },
              data: { description: m.role_description, memberName: m.name, systemPrompt: initService.deriveSystemPrompt(project.name, project.description, m) },
            });
      } else {
        role = await tx.role.create({
          data: {
            projectId: project.id, name: m.name, memberName: m.name,
            description: m.role_description,
            systemPrompt: initService.deriveSystemPrompt(project.name, project.description, m),
            sortOrder: i,
          },
        });
      }
      if (!role.isArchived) roleByName[m.name] = role;
      // 标记 me 的成员（创立人本人）自动绑定
      if (m.me && !role.isArchived) {
        await tx.projectMember.upsert({
          where: { projectId_userId_roleId: { projectId: project.id, userId: req.user.id, roleId: role.id } },
          update: { isLeader: true },
          create: { projectId: project.id, userId: req.user.id, roleId: role.id, isLeader: true },
        });
      }
    }

    // 3) 草案落库：清掉旧草案，写入新草案（status=draft，确认前不生效）
    await tx.task.deleteMany({ where: { projectId: project.id, status: 'draft' } });
    const created = [];
    for (const t of draft.tasks) {
      const ownerRole = t.suggested_owner ? roleByName[t.suggested_owner] : null;
      created.push(await tx.task.create({
        data: {
          projectId: project.id,
          title: t.title,
          description: t.description,
          priority: PRIORITY_MAP[t.priority] ?? 2,
          status: 'draft',
          roleId: ownerRole?.id || null,
          meta: { match_reasoning: t.match_reasoning, suggested_owner: t.suggested_owner },
        },
        include: { role: true },
      }));
    }

    // 4) 确保邀请码存在（保持 status=0 初始化中，确认后才转运行）
    let inviteCode = project.inviteCode;
    if (!inviteCode) {
      inviteCode = genInviteCode();
      await tx.project.update({ where: { id: project.id }, data: { inviteCode, status: 0 } });
    }
    return { created, inviteCode };
  });

  ok(res, {
    tasks: result.created.map(taskView),
    unassigned_gaps: draft.unassigned_gaps,
    invite_code: result.inviteCode,
    usage: draft.usage,
  }, '任务结构草案已生成，请确认调整后生效');
}));

// GET /api/v1/projects/:pid/initialize/draft 查看当前草案
router.get('/:pid/initialize/draft', requireProjectAccess, wrap(async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { projectId: req.project.id, status: 'draft' },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    include: { role: true },
  });
  ok(res, { items: tasks.map(taskView), invite_code: req.project.inviteCode });
}));

// POST /api/v1/projects/:pid/initialize/confirm
// body: { tasks: [{id?, title, description, priority, role_id?}] } —— 创立人调整后的最终版
// 动作：草案转正（status=todo），项目进入运行模式（status=1）
router.post('/:pid/initialize/confirm', requireProjectAccess, wrap(async (req, res) => {
  if (req.project.ownerId !== req.user.id) throw E.noProject('仅项目创立人可确认草案');
  const { tasks } = req.body || {};
  if (!Array.isArray(tasks) || tasks.length === 0) throw E.param('确认的任务列表不能为空');
  for (const t of tasks) {
    if (!t.title) throw E.param('任务标题不能为空');
  }
  const roleIds = [...new Set(tasks.map((t) => t.role_id).filter(Boolean))];
  if (roleIds.length) {
    const roleCount = await prisma.role.count({ where: { id: { in: roleIds }, projectId: req.project.id, isArchived: false } });
    if (roleCount !== roleIds.length) throw E.param('任务负责人必须是当前项目的有效角色');
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.deleteMany({ where: { projectId: req.project.id, status: 'draft' } });
    for (const t of tasks) {
      await tx.task.create({
        data: {
          projectId: req.project.id,
          title: String(t.title).slice(0, 255),
          description: t.description || null,
          priority: PRIORITY_MAP[t.priority] ?? 2,
          status: 'todo',
          roleId: t.role_id || null,
          meta: t.match_reasoning ? { match_reasoning: t.match_reasoning } : {},
        },
      });
    }
    await tx.project.update({ where: { id: req.project.id }, data: { status: 1 } }); // 进入运行模式
  });

  ok(res, { status: 1 }, '草案已生效，项目进入运行模式');
}));

// ---------- 组队 ----------

// POST /api/v1/projects/join  凭邀请码查看项目与可认领角色（不做绑定）
router.post('/join', inviteGuard, wrap(async (req, res) => {
  const { invite_code } = req.body || {};
  if (!invite_code) throw E.param('邀请码必填');
  const project = await prisma.project.findUnique({ where: { inviteCode: String(invite_code).trim().toUpperCase() } });
  if (!project) throw E.notFound('邀请码无效，请确认后重试');
  if (project.status === 3) throw E.param('项目已归档');

  const roles = await prisma.role.findMany({
    where: { projectId: project.id, isArchived: false },
    orderBy: { sortOrder: 'asc' },
    include: { members: { select: { userId: true } } },
  });
  ok(res, {
    project: { id: project.id, name: project.name, description: project.description, status: project.status },
    roles: roles.map((r) => ({
      id: r.id, name: r.name, description: r.description, member_name: r.memberName,
      is_claimed: r.members.length > 0,
      is_mine: r.members.some((m) => m.userId === req.user.id),
    })),
  });
}));

// POST /api/v1/projects/:pid/claim-role  组员认领角色（需带邀请码；一人一个角色）
router.post('/:pid/claim-role', inviteGuard, wrap(async (req, res) => {
  const { invite_code, role_id } = req.body || {};
  if (!invite_code || !role_id) throw E.param('invite_code 与 role_id 必填');
  const project = await prisma.project.findUnique({ where: { id: req.params.pid } });
  if (!project || project.inviteCode !== String(invite_code).trim().toUpperCase()) throw E.noProject('邀请码不匹配');
  if (project.status !== 1) throw E.param('项目尚未进入运行模式，暂不能认领角色');
  const role = await prisma.role.findUnique({ where: { id: role_id }, include: { members: true } });
  if (!role || role.projectId !== project.id || role.isArchived) throw E.notFound('角色不存在');

  await prisma.$transaction(async (tx) => {
    // 事务内对角色行加锁再复查占用，防止两人同时通过事务外检查而绑到同一角色
    await tx.$queryRaw`SELECT id FROM roles WHERE id = ${role.id}::uuid FOR UPDATE`;
    const taken = await tx.projectMember.findFirst({ where: { roleId: role.id } });
    if (taken && taken.userId !== req.user.id) {
      throw E.conflict(`该角色已被认领（预留：${role.memberName || '未指定'}）`);
    }
    // 一人一个角色：先解绑我在本项目的其他角色
    await tx.projectMember.deleteMany({ where: { projectId: project.id, userId: req.user.id } });
    await tx.projectMember.create({
      data: { projectId: project.id, userId: req.user.id, roleId: role.id, isLeader: project.ownerId === req.user.id },
    });
  });
  ok(res, { role_id: role.id, role_name: role.name }, `已认领角色「${role.name}」，进入运行模式`);
  hub.emit(project.id, 'role.claimed', {
    role_id: role.id, role_name: role.name,
    user_name: req.user.username,
  });
}));

// ---------- 任务（运行模式） ----------

// P3-01 任务状态机：合法转移表（draft 只能经 initialize/confirm 转正，不可 PATCH）
const TRANSITIONS = {
  todo: ['doing'],
  doing: ['todo', 'blocked', 'review', 'done'],
  blocked: ['todo', 'doing'],
  review: ['doing', 'done'],
  done: ['todo'], // 允许重开
};

// GET /api/v1/projects/:pid/tasks?mine=1&role_id=&status=
router.get('/:pid/tasks', requireProjectAccess, wrap(async (req, res) => {
  const { mine, role_id, status } = req.query;
  let roleId = role_id || null;
  if (mine === '1') {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId: req.project.id, userId: req.user.id },
    });
    roleId = membership?.roleId || '__none__';
  }
  const tasks = await prisma.task.findMany({
    where: {
      projectId: req.project.id,
      status: { not: 'draft' },
      ...(roleId && { roleId }),
      ...(status && { status }),
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    include: { role: true, references: true },
  });
  ok(res, {
    items: tasks.map((t) => ({ ...taskView(t), references: t.references.map(refView) })),
    total: tasks.length,
  });
}));

// POST /api/v1/projects/:pid/tasks  手动建任务（运行模式下补充任务）
router.post('/:pid/tasks', requireProjectAccess, wrap(async (req, res) => {
  const { title, description, priority, role_id } = req.body || {};
  if (!title || !title.trim()) throw E.param('任务标题必填');
  if (role_id) {
    const role = await prisma.role.findUnique({ where: { id: role_id } });
    if (!role || role.projectId !== req.project.id) throw E.param('角色不属于该项目');
    if (!req.isLeader) {
      const membership = await prisma.projectMember.findFirst({
        where: { projectId: req.project.id, userId: req.user.id },
      });
      if (membership?.roleId !== role_id) throw E.noWrite('普通成员只能为自己的角色创建任务');
    }
  }
  const task = await prisma.task.create({
    data: {
      projectId: req.project.id, title: title.trim(), description: description || null,
      priority: PRIORITY_MAP[priority] ?? 2, status: 'todo', roleId: role_id || null,
    },
    include: { role: true, references: true },
  });
  hub.emit(req.project.id, 'task.created', { task: taskView(task), by: req.user.username });
  ok(res, { ...taskView(task), references: [] }, '任务已创建');
}));

// PATCH /api/v1/projects/:pid/tasks/:tid  更新任务状态/进度（含状态机校验）
router.patch('/:pid/tasks/:tid', requireProjectAccess, wrap(async (req, res) => {
  const task = await loadProjectTask(req.params.pid, req.params.tid);
  const member = await prisma.projectMember.findFirst({
    where: { projectId: task.projectId, userId: req.user.id },
  });
  req.membership = member;
  assertTaskWriteAccess(req, task);

  const { status, progress, title, description, role_id } = req.body || {};
  if (status) {
    if (!['todo', 'doing', 'blocked', 'review', 'done'].includes(status)) throw E.param('非法任务状态');
    if (task.status === 'draft') throw E.param('草案任务不可直接改状态，请先确认初始化草案');
    // P3-01 DoD：非法状态转移返回 40001
    const allowed = TRANSITIONS[task.status] || [];
    if (status !== task.status && !allowed.includes(status)) {
      throw E.param(`非法状态转移：${task.status} → ${status}（允许：${allowed.join(' / ') || '无'}）`);
    }
  }
  if (role_id) {
    const role = await prisma.role.findUnique({ where: { id: role_id } });
    if (!role || role.projectId !== task.projectId) throw E.param('角色不属于该项目');
  }
  let progressValue;
  if (progress !== undefined) {
    progressValue = Number(progress);
    if (!Number.isInteger(progressValue) || progressValue < 0 || progressValue > 100) {
      throw E.param('progress 必须是 0–100 的整数');
    }
  }
  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      ...(status !== undefined && { status, completedAt: status === 'done' ? new Date() : null }),
      ...(progressValue !== undefined && { progress: progressValue }),
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(role_id !== undefined && { roleId: role_id || null }),
    },
    include: { role: true, references: true },
  });
  const view = { ...taskView(updated), references: updated.references.map(refView) };
  hub.emit(task.projectId, 'task.updated', { task: view, by: req.user.username });
  ok(res, view, '已更新');
}));

// DELETE /api/v1/projects/:pid/tasks/:tid  删除任务（仅创立人）
router.delete('/:pid/tasks/:tid', requireProjectAccess, wrap(async (req, res) => {
  if (req.project.ownerId !== req.user.id) throw E.noProject('仅项目创立人可删除任务');
  const task = await prisma.task.findUnique({ where: { id: req.params.tid } });
  if (!task || task.projectId !== req.project.id) throw E.notFound('任务不存在');
  await prisma.task.delete({ where: { id: task.id } });
  hub.emit(req.project.id, 'task.deleted', { task_id: task.id, by: req.user.username });
  ok(res, { id: task.id }, '任务已删除');
}));

// ---------- 任务引用（P3-02）：任务 ↔ 记忆/文献/方向 ----------

const refView = (r) => ({
  id: r.id, task_id: r.taskId, ref_type: r.refType, ref_id: r.refId,
  note: r.note, created_by: r.createdBy, created_at: r.createdAt,
});

// GET /api/v1/projects/:pid/tasks/:tid/references
router.get('/:pid/tasks/:tid/references', requireProjectAccess, wrap(async (req, res) => {
  await loadProjectTask(req.project.id, req.params.tid);
  const refs = await prisma.taskReference.findMany({
    where: { taskId: req.params.tid },
    orderBy: { createdAt: 'asc' },
  });
  // 补充引用对象的标题信息（记忆/文献）
  const enriched = [];
  for (const r of refs) {
    let title = null;
    if (r.refType === 'memory') {
      title = (await prisma.memory.findUnique({ where: { id: r.refId }, select: { title: true } }))?.title;
    } else if (r.refType === 'paper') {
      title = (await prisma.paper.findUnique({ where: { id: r.refId }, select: { title: true } }))?.title;
    } else if (r.refType === 'direction') {
      title = (await prisma.directionNode.findUnique({ where: { id: r.refId }, select: { name: true } }))?.name;
    }
    enriched.push({ ...refView(r), ref_title: title });
  }
  ok(res, { items: enriched, total: enriched.length });
}));

// POST /api/v1/projects/:pid/tasks/:tid/references  添加引用（重复 40901）
router.post('/:pid/tasks/:tid/references', requireProjectAccess, wrap(async (req, res) => {
  const { ref_type, ref_id, note } = req.body || {};
  if (!['paper', 'memory', 'direction'].includes(ref_type)) throw E.param('ref_type 必须是 paper/memory/direction');
  if (!ref_id) throw E.param('ref_id 必填');
  const task = await loadProjectTask(req.project.id, req.params.tid);
  const source = ref_type === 'memory'
    ? await prisma.memory.findUnique({ where: { id: ref_id }, select: { projectId: true } })
    : ref_type === 'paper'
      ? await prisma.paper.findUnique({ where: { id: ref_id }, select: { projectId: true } })
      : await prisma.directionNode.findUnique({ where: { id: ref_id }, select: { projectId: true } });
  if (!source || source.projectId !== req.project.id) throw E.param('引用对象不属于当前项目');

  const dup = await prisma.taskReference.findUnique({
    where: { taskId_refType_refId: { taskId: task.id, refType: ref_type, refId: ref_id } },
  });
  if (dup) throw E.conflict('该引用已存在');

  const ref = await prisma.taskReference.create({
    data: { taskId: task.id, refType: ref_type, refId: ref_id, note: note || null, createdBy: req.user.id },
  });
  hub.emit(req.project.id, 'task.updated', { task_id: task.id, by: req.user.username });
  ok(res, refView(ref), '引用已添加');
}));

// DELETE /api/v1/projects/:pid/tasks/:tid/references/:rid
router.delete('/:pid/tasks/:tid/references/:rid', requireProjectAccess, wrap(async (req, res) => {
  await loadProjectTask(req.project.id, req.params.tid);
  const ref = await prisma.taskReference.findUnique({ where: { id: req.params.rid } });
  if (!ref || ref.taskId !== req.params.tid) throw E.notFound('引用不存在');
  await prisma.taskReference.delete({ where: { id: ref.id } });
  ok(res, { id: ref.id }, '引用已移除');
}));

module.exports = router;

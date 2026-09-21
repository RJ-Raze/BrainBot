// M2 项目与角色管理（P0）：项目 CRUD / 成员 / 角色（含 system_prompt 与 temp_limit，软删除）
const express = require('express');
const crypto = require('crypto');
const prisma = require('../db');
const { ok, wrap, E } = require('../middleware/error');
const { authRequired } = require('../middleware/auth');
const { requireProjectAccess, requireRoleAccess } = require('../middleware/permission');

const router = express.Router();
router.use(authRequired);

const projectView = (p) => ({
  id: p.id, name: p.name, description: p.description, domain: p.domain,
  status: p.status, invite_code: p.inviteCode, owner_id: p.ownerId,
  created_at: p.createdAt, updated_at: p.updatedAt,
});

const roleView = (r) => ({
  id: r.id, project_id: r.projectId, name: r.name, description: r.description,
  member_name: r.memberName, system_prompt: r.systemPrompt, llm_config: r.llmConfig,
  temp_limit: r.tempLimit, color: r.color, icon: r.icon, sort_order: r.sortOrder,
  is_archived: r.isArchived, created_at: r.createdAt,
});

// ---------- 项目 ----------

// GET /api/v1/projects 我的项目列表（拥有的 + 加入的）
router.get('/', wrap(async (req, res) => {
  const owned = await prisma.project.findMany({ where: { ownerId: req.user.id, status: { not: 3 } } });
  const memberships = await prisma.projectMember.findMany({
    where: { userId: req.user.id, project: { ownerId: { not: req.user.id }, status: { not: 3 } } },
    include: { project: true },
  });
  const items = [
    ...owned.map((p) => ({ ...projectView(p), is_owner: true })),
    ...memberships.map((m) => ({ ...projectView(m.project), is_owner: false })),
  ];
  ok(res, { items, total: items.length });
}));

// POST /api/v1/projects 创建项目（初始化模式入口：status=0，同时生成邀请码）
router.post('/', wrap(async (req, res) => {
  const { name, description, domain } = req.body || {};
  if (!name) throw E.param('项目名必填');
  const project = await prisma.project.create({
    data: {
      name, description: description || null, domain: domain || null,
      ownerId: req.user.id, status: 0,
      inviteCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
    },
  });
  ok(res, projectView(project), '项目已创建，请继续初始化');
}));

// GET /api/v1/projects/:pid 项目详情
router.get('/:pid', requireProjectAccess, wrap(async (req, res) => {
  const [roles, members] = await Promise.all([
    prisma.role.findMany({ where: { projectId: req.project.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.projectMember.findMany({
      where: { projectId: req.project.id },
      include: { user: { select: { id: true, username: true, displayName: true } }, role: { select: { id: true, name: true } } },
    }),
  ]);
  ok(res, {
    ...projectView(req.project),
    roles: roles.map(roleView),
    members: members.map((m) => ({
      id: m.id, user_id: m.userId, username: m.user.username, display_name: m.user.displayName,
      role_id: m.roleId, role_name: m.role.name, is_leader: m.isLeader, joined_at: m.joinedAt,
    })),
  });
}));

// PATCH /api/v1/projects/:pid 修改项目
// 项目状态机：0 初始化中 → 1 运行中（确认或直接激活）↔ 2 已完成；1/2 → 3 归档；3 → 1 恢复。
// 禁止把运行中/已完成项目打回 0，也禁止写入未定义状态。
const PROJECT_TRANSITIONS = { 0: [1, 3], 1: [2, 3], 2: [1, 3], 3: [1] };
router.patch('/:pid', requireProjectAccess, wrap(async (req, res) => {
  if (!req.isLeader) throw E.noProject('仅项目负责人可以修改项目设置');
  const { name, description, domain, status } = req.body || {};
  if (req.body.allow_self_review !== undefined && req.project.ownerId !== req.user.id) throw E.noWrite('仅所有者可设置个人确认');
  let nextStatus;
  if (status !== undefined) {
    nextStatus = Number(status);
    const allowed = PROJECT_TRANSITIONS[req.project.status] || [];
    if (!Number.isInteger(nextStatus) || !allowed.includes(nextStatus)) {
      throw E.param(`非法项目状态转移：${req.project.status} → ${status}（允许：${allowed.join(' / ') || '无'}）`);
    }
  }
  const project = await prisma.project.update({
    where: { id: req.project.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(domain !== undefined && { domain }),
      ...(nextStatus !== undefined && { status: nextStatus }),
      ...(typeof req.body.allow_self_review === 'boolean' && { settings: { ...req.project.settings, allow_self_review: req.body.allow_self_review } }),
    },
  });
  ok(res, projectView(project), '已更新');
}));

// DELETE /api/v1/projects/:pid 归档项目（status=3，不物理删除）
router.delete('/:pid', requireProjectAccess, wrap(async (req, res) => {
  if (!req.isLeader) throw E.noProject('仅组长可归档项目');
  await prisma.project.update({ where: { id: req.project.id }, data: { status: 3 } });
  ok(res, null, '项目已归档');
}));

// ---------- 成员 ----------

// GET /api/v1/projects/:pid/members
router.get('/:pid/members', requireProjectAccess, wrap(async (req, res) => {
  const members = await prisma.projectMember.findMany({
    where: { projectId: req.project.id },
    include: { user: { select: { id: true, username: true, displayName: true } }, role: { select: { id: true, name: true } } },
  });
  ok(res, {
    items: members.map((m) => ({
      id: m.id, user_id: m.userId, username: m.user.username, display_name: m.user.displayName,
      role_id: m.roleId, role_name: m.role.name, is_leader: m.isLeader, joined_at: m.joinedAt,
    })),
    total: members.length,
  });
}));

// POST /api/v1/projects/:pid/members 邀请成员 {user_id, role_id}
router.post('/:pid/members', requireProjectAccess, wrap(async (req, res) => {
  if (!req.isLeader) throw E.noProject('仅项目负责人可以邀请成员');
  const { user_id, role_id, is_leader } = req.body || {};
  if (!user_id || !role_id) throw E.param('user_id 与 role_id 必填');
  // 先校验用户与角色有效，避免外键失败裸 500，也防止绑到已归档角色
  const [targetUser, role] = await Promise.all([
    prisma.user.findUnique({ where: { id: user_id } }),
    prisma.role.findUnique({ where: { id: role_id } }),
  ]);
  if (!targetUser || targetUser.status !== 1) throw E.param('用户不存在或已被禁用');
  if (!role || role.projectId !== req.project.id) throw E.param('角色不属于该项目');
  if (role.isArchived) throw E.param('角色已归档，请先复活再邀请成员');
  const member = await prisma.projectMember.create({
    data: { projectId: req.project.id, userId: user_id, roleId: role_id, isLeader: !!is_leader },
  });
  ok(res, { id: member.id }, '成员已加入');
}));

// DELETE /api/v1/projects/:pid/members/:uid 移除成员
router.delete('/:pid/members/:uid', requireProjectAccess, wrap(async (req, res) => {
  if (!req.isLeader) throw E.noProject('仅组长可移除成员');
  await prisma.projectMember.deleteMany({
    where: { projectId: req.project.id, userId: req.params.uid },
  });
  ok(res, null, '成员已移除');
}));

// ---------- 角色 ----------

// GET /api/v1/projects/:pid/roles 角色列表（含已归档，前端标注）
router.get('/:pid/roles', requireProjectAccess, wrap(async (req, res) => {
  const roles = await prisma.role.findMany({
    where: { projectId: req.project.id },
    orderBy: [{ isArchived: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  // 附带"我绑定的角色"标记
  const mine = await prisma.projectMember.findMany({
    where: { projectId: req.project.id, userId: req.user.id },
    select: { roleId: true },
  });
  const mineSet = new Set(mine.map((m) => m.roleId));
  ok(res, {
    items: roles.map((r) => ({ ...roleView(r), is_mine: mineSet.has(r.id) })),
    total: roles.length,
  });
}));

// POST /api/v1/projects/:pid/roles 创建角色（含 system_prompt；创建者自动绑定该角色）
router.post('/:pid/roles', requireProjectAccess, wrap(async (req, res) => {
  if (!req.isLeader) throw E.noProject('仅项目负责人可以创建角色');
  const { name, description, system_prompt, llm_config, temp_limit, color, icon } = req.body || {};
  if (!name) throw E.param('角色名必填');
  if (!system_prompt) throw E.param('system_prompt 必填（C1：角色差异的唯一来源）');
  const role = await prisma.role.create({
    data: {
      projectId: req.project.id, name,
      description: description || null,
      systemPrompt: system_prompt,
      llmConfig: llm_config || {},
      tempLimit: temp_limit ?? null,
      color: color || null, icon: icon || null,
    },
  });
  // 创建者自动绑定（幂等：唯一约束 project+user+role）
  await prisma.projectMember.upsert({
    where: { projectId_userId_roleId: { projectId: req.project.id, userId: req.user.id, roleId: role.id } },
    update: {},
    create: { projectId: req.project.id, userId: req.user.id, roleId: role.id },
  });
  ok(res, roleView(role), '角色已创建并绑定');
}));

// GET /api/v1/projects/:pid/roles/:rid 角色详情
router.get('/:pid/roles/:rid', requireProjectAccess, wrap(async (req, res) => {
  const role = await prisma.role.findUnique({ where: { id: req.params.rid } });
  if (!role || role.projectId !== req.project.id) throw E.notFound('角色不存在');
  ok(res, roleView(role));
}));

// PATCH /api/v1/projects/:pid/roles/:rid 改角色（含 system_prompt 调优）
router.patch('/:pid/roles/:rid', requireProjectAccess, wrap(async (req, res) => {
  if (!req.isLeader) throw E.noProject('仅项目负责人可以修改角色');
  const { name, description, system_prompt, llm_config, temp_limit, color, icon, sort_order } = req.body || {};
  const existing = await prisma.role.findUnique({ where: { id: req.params.rid } });
  if (!existing || existing.projectId !== req.project.id) throw E.notFound('角色不存在');
  const role = await prisma.role.update({
    where: { id: req.params.rid },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(system_prompt !== undefined && { systemPrompt: system_prompt }),
      ...(llm_config !== undefined && { llmConfig: llm_config }),
      ...(temp_limit !== undefined && { tempLimit: temp_limit }),
      ...(color !== undefined && { color }),
      ...(icon !== undefined && { icon }),
      ...(sort_order !== undefined && { sortOrder: sort_order }),
    },
  });
  ok(res, roleView(role), '已更新');
}));

// DELETE /api/v1/projects/:pid/roles/:rid 归档角色（v2.0：只软删除 is_archived=true，永不物理删除）
router.delete('/:pid/roles/:rid', requireProjectAccess, wrap(async (req, res) => {
  if (!req.isLeader) throw E.noProject('仅项目负责人可以归档角色');
  const existing = await prisma.role.findUnique({ where: { id: req.params.rid } });
  if (!existing || existing.projectId !== req.project.id) throw E.notFound('角色不存在');
  await prisma.role.update({ where: { id: req.params.rid }, data: { isArchived: true } });
  ok(res, null, '角色已归档（对话与贡献保留，可一键复活）');
}));

// POST /api/v1/projects/:pid/roles/:rid/restore 复活归档角色（v2.0 6.2）
router.post('/:pid/roles/:rid/restore', requireProjectAccess, wrap(async (req, res) => {
  if (!req.isLeader) throw E.noProject('仅项目负责人可以复活角色');
  const existing = await prisma.role.findUnique({ where: { id: req.params.rid } });
  if (!existing || existing.projectId !== req.project.id) throw E.notFound('角色不存在');
  const role = await prisma.role.update({ where: { id: req.params.rid }, data: { isArchived: false } });
  ok(res, roleView(role), '角色已复活，历史无缝续接');
}));

module.exports = router;

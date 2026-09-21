// 两级权限中间件（对齐骨架 v2.0 第六章 6.1）
// 项目级：JWT 有效 + 用户在 project_members 有记录（或就是项目 owner）
// 角色级：项目级 + 当前用户绑定的 role_id 与请求 rid 一致（组长/owner 豁免）
const prisma = require('../db');
const { E } = require('./error');

// 项目级权限：req.params.pid 必须是当前用户可访问的项目
async function requireProjectAccess(req, _res, next) {
  try {
    const pid = req.params.pid || req.body.projectId || req.query.project_id;
    if (!pid) return next(E.param('缺少项目 ID'));
    const project = await prisma.project.findUnique({ where: { id: pid } });
    if (!project) return next(E.notFound('项目不存在'));
    if (project.status === 3 && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next(E.param('项目已归档，只可查看不可继续修改'));
    }
    const isOwner = project.ownerId === req.user.id;
    let member = null;
    if (!isOwner) {
      member = await prisma.projectMember.findFirst({
        where: { projectId: pid, userId: req.user.id },
      });
      if (!member) return next(E.noProject());
    } else {
      member = await prisma.projectMember.findFirst({
        where: { projectId: pid, userId: req.user.id },
      });
    }
    req.project = project;
    req.isLeader = isOwner || (member && member.isLeader) || false;
    next();
  } catch (err) {
    next(err);
  }
}

// 角色级权限：:rid 归属 :pid，且当前用户绑定了该角色（组长/owner 豁免）
async function requireRoleAccess(req, _res, next) {
  try {
    const { pid, rid } = req.params;
    const role = await prisma.role.findUnique({ where: { id: rid } });
    if (!role || role.projectId !== pid) return next(E.notFound('角色不存在'));
    if (role.isArchived) return next(E.noRole('角色已归档，可回看不可续写'));
    if (!req.isLeader) {
      const bound = await prisma.projectMember.findFirst({
        where: { projectId: pid, userId: req.user.id, roleId: rid },
      });
      if (!bound) return next(E.noWrite());
    }
    req.role = role;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireProjectAccess, requireRoleAccess, prisma };

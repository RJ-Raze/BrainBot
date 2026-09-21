// M1 用户与认证（P0）：注册 / 登录 / 当前用户
const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../db');
const { ok, wrap, E } = require('../middleware/error');
const { authRequired, signToken } = require('../middleware/auth');

const router = express.Router();
router.use(['/login', '/register'], require('../middleware/rate-limit')());
router.use(['/login', '/register'], (req, _res, next) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || !username.trim() || username.length > 64 || typeof password !== 'string' || Buffer.byteLength(password) > 72) return next(E.param('用户名最多 64 字符，密码最多 72 字节'));
  next();
});

const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  email: u.email,
  display_name: u.displayName,
  avatar_url: u.avatarUrl,
  created_at: u.createdAt,
});

// POST /api/v1/auth/register
router.post('/register', wrap(async (req, res) => {
  const { username, password, email, display_name } = req.body || {};
  if (!username || !password) throw E.param('username 与 password 必填');
  if (String(password).length < 6) throw E.param('密码至少 6 位');
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) throw E.conflict('用户名已存在');
  const hash = await bcrypt.hash(String(password), 10);
  const user = await prisma.user.create({
    data: { username, passwordHash: hash, email: email || null, displayName: display_name || username },
  });
  ok(res, { token: signToken(user), user: publicUser(user) }, '注册成功');
}));

// POST /api/v1/auth/login
router.post('/login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) throw E.param('username 与 password 必填');
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    throw E.unauthorized('用户名或密码错误');
  }
  if (user.status !== 1) throw E.unauthorized('账号已被禁用');
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  ok(res, { token: signToken(user), user: publicUser(user) }, '登录成功');
}));

// POST /api/v1/auth/logout（前端清 token 即可，这里留语义接口）
router.post('/logout', authRequired, wrap(async (_req, res) => {
  ok(res, null, '已注销');
}));

// GET /api/v1/auth/me
router.get('/me', authRequired, wrap(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw E.notFound('用户不存在');
  ok(res, publicUser(user));
}));

// PATCH /api/v1/users/me
router.patch('/me', authRequired, wrap(async (req, res) => {
  const { display_name, avatar_url, email } = req.body || {};
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(display_name !== undefined && { displayName: display_name }),
      ...(avatar_url !== undefined && { avatarUrl: avatar_url }),
      ...(email !== undefined && { email }),
    },
  });
  ok(res, publicUser(user), '已更新');
}));

module.exports = router;

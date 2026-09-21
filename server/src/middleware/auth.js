// JWT 鉴权中间件（对齐《数据库与接口设计》4.2）
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const { E } = require('./error');

// 除验签外必须回库确认用户仍存在且未被禁用：
// 只验签名的话，被禁用（status=0）的账号在 token 7 天有效期内仍可通行全部接口。
async function authRequired(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(E.unauthorized());
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(E.unauthorized());
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, status: true },
    });
    if (!user || user.status !== 1) return next(E.unauthorized('账号不存在或已被禁用'));
    req.user = { id: user.id, username: user.username };
    next();
  } catch (error) {
    next(E.dbFail());
  }
}

function signToken(user) {
  // token 有效期 7 天（M1 功能点）
  return jwt.sign(
    { sub: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = { authRequired, signToken };

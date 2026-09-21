// 统一响应与业务错误码（对齐《数据库与接口设计》4.3 / 4.4）
class BizError extends Error {
  constructor(httpStatus, code, msg) {
    super(msg);
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

const E = {
  param: (msg = '请求参数校验失败') => new BizError(400, 40001, msg),
  unauthorized: (msg = '未登录 / JWT 失效') => new BizError(401, 40101, msg),
  noProject: (msg = '无项目访问权限') => new BizError(403, 40301, msg),
  noRole: (msg = '无角色访问权限') => new BizError(403, 40302, msg),
  noWrite: (msg = '无消息写入权限（role_id 不匹配）') => new BizError(403, 40303, msg),
  notFound: (msg = '资源不存在') => new BizError(404, 40401, msg),
  conflict: (msg = '资源冲突') => new BizError(409, 40901, msg),
  llmRate: (msg = 'LLM 调用频率超限') => new BizError(429, 42901, msg),
  llmFail: (msg = 'LLM 调用失败') => new BizError(500, 50001, msg),
  dbFail: (msg = '数据库异常') => new BizError(500, 50002, msg),
};

function ok(res, data = null, msg = 'ok') {
  res.json({ code: 0, data, msg });
}

function paged(res, items, total, page, pageSize) {
  res.json({ code: 0, data: { items, total, page, page_size: pageSize }, msg: 'ok' });
}

// async 路由包装器
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// 统一错误处理中间件
function errorHandler(err, req, res, _next) {
  if (err?.type === 'entity.too.large' || err?.type === 'entity.parse.failed') return res.status(err.type === 'entity.too.large' ? 413 : 400).json({ code: 40001, data: null, msg: '请求正文格式或大小无效' });
  if (err instanceof BizError) {
    return res.status(err.httpStatus).json({ code: err.code, data: null, msg: err.message });
  }
  if (err && err.code === 'P2002') {
    return res.status(409).json({ code: 40901, data: null, msg: '资源冲突（唯一约束）' });
  }
  if (err && err.code === 'P2003') {
    return res.status(400).json({ code: 40001, data: null, msg: '关联的资源不存在（外键约束）' });
  }
  if (err && err.code === 'P2025') {
    return res.status(404).json({ code: 40401, data: null, msg: '资源不存在' });
  }
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);
  res.status(500).json({ code: 50002, data: null, msg: '服务器内部错误' });
}

module.exports = { BizError, E, ok, paged, wrap, errorHandler };

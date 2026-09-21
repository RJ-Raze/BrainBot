// Single-instance fixed-window limiter.
// 默认按 req.ip 限流（生产环境经 trust proxy 取真实客户端 IP）；
// 已登录接口可传 key 改为按用户限流，避免共享出口 IP 互相挤占配额。
function rateLimit({ limit = 30, windowMs = 60000, key = (req) => req.ip } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now(), k = key(req);
    for (const [bk, v] of buckets) if (v.end <= now) buckets.delete(bk);
    const bucket = buckets.get(k) || { end: now + windowMs, count: 0 };
    buckets.set(k, bucket);
    if (++bucket.count > limit) { res.setHeader('Retry-After', Math.max(1, Math.ceil((bucket.end - now) / 1000))); return res.status(429).json({ code: 42901, data: null, msg: '请求过于频繁，请稍后重试' }); }
    next();
  };
}
module.exports = rateLimit;

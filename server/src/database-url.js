function configureDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { POSTGRES_HOST, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD } = process.env;
  if (!POSTGRES_HOST || !POSTGRES_DB || !POSTGRES_USER || !POSTGRES_PASSWORD) {
    throw new Error('缺少 PostgreSQL 容器连接参数或 DATABASE_URL');
  }
  process.env.DATABASE_URL = `postgresql://${encodeURIComponent(POSTGRES_USER)}:${encodeURIComponent(POSTGRES_PASSWORD)}` +
    `@${POSTGRES_HOST}:5432/${encodeURIComponent(POSTGRES_DB)}?schema=public`;
  return process.env.DATABASE_URL;
}

module.exports = { configureDatabaseUrl };

// 容器入口：安全编码数据库凭据，迁移完成后再启动 HTTP 服务。
const { spawnSync } = require('child_process');
require('../src/database-url').configureDatabaseUrl();

const migration = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
});
if (migration.error || migration.status !== 0) {
  console.error('[server] 数据库迁移失败', migration.error || `exit=${migration.status}`);
  process.exit(1);
}

require('../src/index');

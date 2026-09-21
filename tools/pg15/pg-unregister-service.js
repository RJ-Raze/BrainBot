// 注销便携 PG15 的 Windows 服务
// 用法：以「管理员身份」执行  node pg-unregister-service.js
const { spawnSync } = require('child_process');
const path = require('path');

const binDir = path.join(__dirname, 'bin');
const SERVICE_NAME = 'BrainBotDemoPG';

const r = spawnSync(
  path.join(binDir, 'pg_ctl.exe'),
  ['unregister', '-N', SERVICE_NAME],
  { encoding: 'utf8' }
);
console.log(((r.stdout || '') + (r.stderr || '')).trim());
process.exitCode = r.status;

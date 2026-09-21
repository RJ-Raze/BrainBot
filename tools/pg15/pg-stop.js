// 停止 PostgreSQL 服务
const { spawnSync } = require('child_process');
const path = require('path');
const base = __dirname;
const binDir = path.join(base, 'bin');
const cleanEnv = {
  PATH: binDir + ';C:\\Windows\\System32;C:\\Windows',
  SystemRoot: 'C:\\Windows',
  TEMP: 'C:\\Temp',
  TMP: 'C:\\Temp',
};
const r = spawnSync(path.join(binDir, 'pg_ctl.exe'), ['-D', path.join(base, 'data'), 'stop', '-m', 'fast'], { env: cleanEnv, encoding: 'utf8' });
console.log('status=', r.status);
console.log(r.stdout || '', r.stderr || '');

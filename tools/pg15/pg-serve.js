// 前台方式运行 PostgreSQL（保持进程存活，供后台任务托管）
const { spawn } = require('child_process');
const path = require('path');
const base = __dirname;
const binDir = path.join(base, 'bin');
const cleanEnv = {
  PATH: binDir + ';C:\\Windows\\System32;C:\\Windows',
  SystemRoot: 'C:\\Windows',
  TEMP: 'C:\\Temp',
  TMP: 'C:\\Temp',
};
const child = spawn(path.join(binDir, 'postgres.exe'), ['-D', path.join(base, 'data'), '-p', '5433'], {
  env: cleanEnv,
  stdio: 'inherit',
});
child.on('exit', (code) => { console.log('postgres exited', code); process.exit(code || 0); });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));

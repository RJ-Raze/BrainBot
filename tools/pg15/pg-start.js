// 以 pg_ctl 守护进程方式启动 PostgreSQL（后台常驻，不弹子进程控制台窗口）
// 用法: node pg-start.js   （停止: node pg-stop.js）
// 说明：pg_ctl 是 PG 官方守护化入口，会把 postmaster 及其全部子进程（checkpointer 等）
//       作为无控制台的后台进程运行，避免 raw spawn 下子进程间歇弹出 cmd 窗口、
//       以及多实例抢数据目录导致的文件锁（42501 Permission denied）。
const { spawnSync } = require('child_process');
const path = require('path');

const base = __dirname;
const binDir = path.join(base, 'bin');
const dataDir = path.join(base, 'data');
const logFile = path.join(base, 'server.log');

const cleanEnv = {
  PATH: binDir + ';C:\\Windows\\System32;C:\\Windows',
  SystemRoot: 'C:\\Windows',
  TEMP: 'C:\\Temp',
  TMP: 'C:\\Temp',
};

// 端口已在 postgresql.conf 固定为 5433，这里不再用 -o 覆盖
const r = spawnSync(
  path.join(binDir, 'pg_ctl.exe'),
  ['start', '-D', dataDir, '-l', logFile, '-w', '-t', '60'],
  { env: cleanEnv, encoding: 'utf8' }
);

const out = (r.stdout || '') + (r.stderr || '');
console.log(out.trim());
if (r.status === 0) {
  console.log('PostgreSQL 已就绪: 端口 5433');
} else if (/already running|another server might be running|已运行/i.test(out)) {
  console.log('PostgreSQL 已在运行（无需重复启动）');
  process.exitCode = 0;
} else {
  console.error(`pg_ctl 启动失败（退出码 ${r.status}），详见 ${logFile}`);
  process.exitCode = r.status || 1;
}

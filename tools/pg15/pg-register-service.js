// 将便携 PG15 注册为 Windows 服务（彻底解决沙箱干扰导致的崩溃/文件锁/控制台弹窗）
// 用法：以「管理员身份」打开终端，执行  node pg-register-service.js ，
//       再执行  net start BrainBotDemoPG  启动服务。
// 说明：注册后 PG 运行在会话 0（Windows 服务宿主），脱离用户会话与杀软实时扫描的干扰，
//       不再弹子进程控制台窗口、不再多实例抢数据目录、不再崩溃后锁文件。
const { spawnSync } = require('child_process');
const path = require('path');

const binDir = path.join(__dirname, 'bin');
const dataDir = path.join(__dirname, 'data');
const SERVICE_NAME = 'BrainBotDemoPG';

const r = spawnSync(
  path.join(binDir, 'pg_ctl.exe'),
  ['register', '-N', SERVICE_NAME, '-D', dataDir],
  { encoding: 'utf8' }
);

const out = (r.stdout || '') + (r.stderr || '');
console.log(out.trim());
if (r.status === 0) {
  console.log(`\n服务已注册：${SERVICE_NAME}`);
  console.log('启动服务：  net start ' + SERVICE_NAME);
  console.log('停止服务：  net stop ' + SERVICE_NAME);
  console.log('注销服务：  node pg-unregister-service.js');
} else if (/already exists|已存在|already registered/i.test(out)) {
  console.log(`服务 ${SERVICE_NAME} 已存在，直接 net start ${SERVICE_NAME} 即可`);
  process.exitCode = 0;
} else {
  console.error(`注册失败（退出码 ${r.status}）。请确认当前终端以管理员身份运行。`);
  process.exitCode = r.status || 1;
}

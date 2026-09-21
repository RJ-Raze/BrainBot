// 以 detached 方式常驻启动后端服务（脱离当前 shell）
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const serverDir = path.join(__dirname);
const nodeExe = process.execPath; // 当前 node
const logFile = path.join(serverDir, 'server-run.log');

const out = fs.openSync(logFile, 'a');
const err = fs.openSync(logFile, 'a');

const child = spawn(nodeExe, [path.join(serverDir, 'src', 'index.js')], {
  cwd: serverDir,
  env: { ...process.env },
  detached: true,
  windowsHide: true,
  stdio: ['ignore', out, err],
});
child.unref();
console.log('server starting, pid =', child.pid);
console.log('log =', logFile);
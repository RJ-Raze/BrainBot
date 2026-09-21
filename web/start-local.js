// 以 detached 方式常驻启动前端 Vite dev server
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const webDir = __dirname;
const nodeExe = process.execPath;
const viteBin = path.join(webDir, 'node_modules', 'vite', 'bin', 'vite.js');
const logFile = path.join(webDir, 'web-run.log');

const out = fs.openSync(logFile, 'a');
const err = fs.openSync(logFile, 'a');

const child = spawn(nodeExe, [viteBin, '--host', '127.0.0.1', '--port', '5173'], {
  cwd: webDir,
  env: { ...process.env },
  detached: true,
  windowsHide: true,
  stdio: ['ignore', out, err],
});
child.unref();
console.log('web starting, pid =', child.pid);
console.log('vite bin =', viteBin);
console.log('log =', logFile);
const { Worker } = require('node:worker_threads');
const path = require('node:path');
let active = 0;
function extract(filePath, extension) {
  if (active >= 2) return Promise.reject(new Error('解析繁忙，请稍后重试'));
  active++;
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'extract-worker.js'), { workerData: { path: filePath, extension }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true; clearTimeout(timer); active--; worker.terminate();
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('解析超时（30 秒）')), 30000);
    worker.once('message', r => finish(r.error ? new Error(r.error) : null, r));
    worker.once('error', e => finish(e));
    worker.once('exit', code => { if (!settled) finish(new Error(`解析进程退出 ${code}`)); });
  });
}
function verifyQuote(document, number, quote) {
  if (!Number.isInteger(number) || typeof quote !== 'string' || !quote.trim() || quote.length > 8000) return false;
  return Boolean(document.pages.find(p => p.number === number)?.text.includes(quote));
}
module.exports = { extract, verifyQuote };

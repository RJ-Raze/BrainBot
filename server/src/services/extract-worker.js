const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs/promises');
(async () => {
  const buffer = await fs.readFile(workerData.path);
  const pages = [];
  if (workerData.extension === '.pdf') {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
    try {
      if (doc.numPages > 500) throw new Error('文档超过 500 页上限');
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        pages.push({ number: i, text: content.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('').trim() });
        if (pages.reduce((n, p) => n + p.text.length, 0) > 2000000) throw new Error('文档文本超过 200 万字符');
        page.cleanup();
      }
    } finally { await doc.destroy(); }
  } else {
    const text = workerData.extension === '.docx'
      ? (await require('mammoth').extractRawText({ buffer })).value
      : new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    if (text.length > 2000000) throw new Error('文档文本超过 200 万字符');
    text.split(/\n\s*\n/).filter(x => x.trim()).forEach((text, i) => pages.push({ number: i + 1, text: text.trim() }));
  }
  parentPort.postMessage({ version: 1, locator_kind: workerData.extension === '.pdf' ? 'page' : 'paragraph', status: pages.some(p => p.text.trim()) ? 'ready' : 'needs_ocr', pages });
})().catch(e => parentPort.postMessage({ error: e.message }));

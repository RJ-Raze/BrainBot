const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { extract, verifyQuote } = require('./extraction');
async function validCitation(db, projectId, locator, quote) {
  if (!locator?.startsWith('file:')) return true; // Explicitly human-reviewed legacy sources.
  const match = /^file:([0-9a-f-]{36});sha256:([0-9a-f]{64});(page|paragraph):(\d+)$/.exec(locator);
  if (!match) return false;
  const file = await db.researchFile.findUnique({ where: { id: match[1] } });
  if (!file || file.projectId !== projectId || file.contentHash !== match[2]) return false;
  const root = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
  if (path.basename(file.storedName) !== file.storedName) return false;
  const source = path.join(root, projectId, file.storedName);
  try {
    const bytes = await fs.readFile(source);
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== match[2]) return false;
    let document;
    try { document = JSON.parse(await fs.readFile(source + '.text.json', 'utf8')); } catch { /* derive */ }
    if (document?.content_hash !== match[2] || document?.version !== 1) document = await extract(source, file.extension);
    return document.locator_kind === match[3] && verifyQuote(document, Number(match[4]), quote);
  } catch { return false; }
}
module.exports = { validCitation };

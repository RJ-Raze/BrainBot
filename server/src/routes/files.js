// 项目科研文件：本地归档、项目级权限、哈希去重；不做 AI 解析或外部上传。
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');
const multer = require('multer');
const prisma = require('../db');
const { authRequired } = require('../middleware/auth');
const { requireProjectAccess } = require('../middleware/permission');
const { ok, wrap, E } = require('../middleware/error');
const hub = require('../services/events');
const { extract, verifyQuote } = require('../services/extraction');

const router = express.Router({ mergeParams: true });
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
const MIME_BY_EXTENSION = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.markdown': 'text/markdown; charset=utf-8',
};
const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 0 },
}).single('file');

router.use(authRequired, requireProjectAccess);

// Derived data stays beside the immutable original and is rebuilt on demand.
async function documentFor(req) {
  const file = await prisma.researchFile.findUnique({ where: { id: req.params.fid } });
  if (!file || file.projectId !== req.project.id) throw E.notFound('文件不存在');
  const source = localPath(req.project.id, file.storedName);
  const bytes = await fs.readFile(source);
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== file.contentHash) throw E.conflict('原文件校验失败');
  let document;
  try { document = JSON.parse(await fs.readFile(source + '.text.json', 'utf8')); } catch { /* rebuild */ }
  if (document?.content_hash !== file.contentHash || document?.version !== 1) {
    try { document = { ...await extract(source, file.extension), content_hash: file.contentHash }; }
    catch (e) { throw E.param(e.message); }
    const temporary = source + '.' + crypto.randomUUID() + '.tmp';
    await fs.writeFile(temporary, JSON.stringify(document));
    await fs.rename(temporary, source + '.text.json');
  }
  return { file, document };
}

router.get('/:fid/text', wrap(async (req, res) => {
  const { file, document } = await documentFor(req);
  ok(res, { file_id: file.id, original_name: file.originalName, ...document });
}));

router.post('/:fid/citations', wrap(async (req, res) => {
  const { file, document } = await documentFor(req);
  const { number, quote } = req.body || {};
  if (!verifyQuote(document, number, quote)) throw E.param('摘录必须逐字存在于指定原文页或段落');
  ok(res, { file_id: file.id, content_hash: file.contentHash, number, quote,
    locator_kind: document.locator_kind,
    locator: `file:${file.id};sha256:${file.contentHash};${document.locator_kind}:${number}`,
    verified: true });
}));

const fileView = (file) => ({
  id: file.id,
  project_id: file.projectId,
  original_name: file.originalName,
  mime_type: file.mimeType,
  extension: file.extension,
  size_bytes: file.sizeBytes,
  content_hash: file.contentHash,
  uploaded_by: file.uploadedBy,
  uploader_name: file.uploader?.displayName || file.uploader?.username || '',
  created_at: file.createdAt,
});

function normalizeOriginalName(value) {
  let name = path.basename(String(value || 'research-file'));
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    if (!decoded.includes('\uFFFD')) name = decoded;
  } catch { /* 保留原文件名 */ }
  name = name.replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').trim();
  return [...name].slice(0, 200).join('') || 'research-file';
}

function localPath(projectId, storedName) {
  if (path.basename(storedName) !== storedName) throw E.param('文件存储路径无效');
  return path.join(UPLOAD_ROOT, projectId, storedName);
}

function receiveOne(req, res, next) {
  receive(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(E.param('单个文件不能超过 20 MB'));
    }
    next(E.param(error.message || '文件上传失败'));
  });
}

// GET /api/v1/projects/:pid/files
router.get('/', wrap(async (req, res) => {
  const files = await prisma.researchFile.findMany({
    where: { projectId: req.project.id },
    include: { uploader: { select: { username: true, displayName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  ok(res, { items: files.map(fileView), total: files.length });
}));

// POST /api/v1/projects/:pid/files multipart/form-data, field name: file
router.post('/', receiveOne, wrap(async (req, res) => {
  if (!req.file?.buffer?.length) throw E.param('请选择要上传的科研文件');
  const originalName = normalizeOriginalName(req.file.originalname);
  const extension = path.extname(originalName).toLowerCase();
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType) throw E.param('仅支持 PDF、DOCX、TXT 和 Markdown 文件');

  const contentHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const duplicate = await prisma.researchFile.findUnique({
    where: { projectId_contentHash: { projectId: req.project.id, contentHash } },
    include: { uploader: { select: { username: true, displayName: true } } },
  });
  if (duplicate) return ok(res, { ...fileView(duplicate), duplicate: true }, '相同文件已在项目中');

  const storedName = `${contentHash}${extension}`;
  const directory = path.join(UPLOAD_ROOT, req.project.id);
  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.writeFile(localPath(req.project.id, storedName), req.file.buffer, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }

  let file;
  try {
    file = await prisma.researchFile.create({
      data: {
        projectId: req.project.id,
        uploadedBy: req.user.id,
        originalName,
        storedName,
        mimeType,
        extension,
        sizeBytes: req.file.size,
        contentHash,
      },
      include: { uploader: { select: { username: true, displayName: true } } },
    });
  } catch (error) {
    if (error.code !== 'P2002') throw error;
    file = await prisma.researchFile.findUnique({
      where: { projectId_contentHash: { projectId: req.project.id, contentHash } },
      include: { uploader: { select: { username: true, displayName: true } } },
    });
  }
  hub.emit(req.project.id, 'file.created', { file: fileView(file), by: req.user.username });
  ok(res, { ...fileView(file), duplicate: false }, '科研文件已上传');
}));

// GET /api/v1/projects/:pid/files/:fid/download
router.get('/:fid/download', wrap(async (req, res) => {
  const file = await prisma.researchFile.findUnique({ where: { id: req.params.fid } });
  if (!file || file.projectId !== req.project.id) throw E.notFound('文件不存在');
  const absolutePath = localPath(req.project.id, file.storedName);
  try { await fs.access(absolutePath); } catch { throw E.notFound('文件内容不存在，请重新上传'); }
  res.type(file.mimeType);
  res.download(absolutePath, file.originalName);
}));

// DELETE /api/v1/projects/:pid/files/:fid
router.delete('/:fid', wrap(async (req, res) => {
  const file = await prisma.researchFile.findUnique({ where: { id: req.params.fid } });
  if (!file || file.projectId !== req.project.id) throw E.notFound('文件不存在');
  if (!req.isLeader && file.uploadedBy !== req.user.id) throw E.noWrite('只能删除自己上传的文件');
  await prisma.researchFile.delete({ where: { id: file.id } });
  await fs.unlink(localPath(req.project.id, file.storedName) + '.text.json').catch(() => {});
  await fs.unlink(localPath(req.project.id, file.storedName)).catch((error) => {
    if (error.code !== 'ENOENT') console.warn(`[files] 删除本地文件失败: ${error.message}`);
  });
  hub.emit(req.project.id, 'file.deleted', { file_id: file.id, by: req.user.username });
  ok(res, null, '科研文件已删除');
}));

module.exports = router;

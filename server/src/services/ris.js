const crypto = require('crypto');
const { E } = require('../middleware/error');
// 统一 DOI 归一化：去协议/前缀/doi:，小写，供各入库路径去重复用
const normalizeDoi = s => String(s || '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').trim().toLowerCase();
function parseRIS(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 1024 * 1024) throw E.param('RIS 文件最大 1 MB');
  const rows = []; let tags = null, last = null, start = 0;
  const finish = error => {
    if (!tags) return;
    const title = (tags.TI || tags.T1 || [])[0];
    const id = normalizeDoi(tags.DO?.[0]);
    // 无 DOI 时用「标题 + 排序后作者 + 年份」生成稳定键：字段顺序无关，重复导入不产生新 externalId
    const authorsKey = [...(tags.AU || tags.A1 || [])].map(String).sort().join('|');
    const yearKey = parseInt(tags.PY?.[0] || tags.Y1?.[0], 10) || '';
    const fingerprint = crypto.createHash('sha256').update([title || '', authorsKey, yearKey].join('||')).digest('hex').slice(0, 16);
    rows.push({ line: start, error: error || (!title ? '缺少 TI 标题' : null), title: title || '', doi: id || null, externalId: id || `local:${fingerprint}`, authors: tags.AU || tags.A1 || [], abstract: tags.AB?.[0] || '', year: parseInt(tags.PY?.[0] || tags.Y1?.[0], 10) || null, venue: tags.JO?.[0] || tags.T2?.[0] || null, keywords: tags.KW || [], rawMeta: tags });
    tags = null; last = null;
    if (rows.length > 500) throw E.param('一次最多 500 条文献');
  };
  text.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/^([A-Z0-9]{2})\s{2}-\s?(.*)$/);
    if (m?.[1] === 'TY') { finish('上条记录缺少 ER 结束标记'); tags = {}; start = i + 1; }
    if (m?.[1] === 'ER') { finish(); return; }
    if (m && tags) { (tags[m[1]] ||= []).push(m[2]); last = m[1]; }
    else if (line.trim() && tags && last) tags[last][tags[last].length - 1] += '\n' + line.trim();
    else if (line.trim()) rows.push({ line: i + 1, error: '记录必须以 TY 开始', title: '' });
  });
  finish('记录缺少 ER 结束标记');
  if (!rows.length) throw E.param('未发现 RIS 记录');
  return rows;
}
function exportRIS(papers) {
  const line = (tag, value) => value == null || value === '' ? [] : [`${tag}  - ${String(value).replace(/\r?\n/g, '\n      ')}`];
  return papers.map(p => ['TY  - JOUR', ...line('TI', p.title), ...(Array.isArray(p.authors) ? p.authors : []).flatMap(a => line('AU', typeof a === 'string' ? a : a.name)), ...line('DO', p.doi), ...line('PY', p.year), ...line('JO', p.venue), ...line('AB', p.abstract), ...(p.keywords || []).flatMap(k => line('KW', k)), 'ER  -', ''].join('\n')).join('\n');
}
module.exports = { parseRIS, exportRIS, normalizeDoi };

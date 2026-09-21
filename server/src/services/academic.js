// 联网学术检索适配器：arXiv（Atom XML）+ OpenAlex（REST）
// 设计约束：
// - 单请求 15s 超时，单源失败不拖垮整体（allSettled 降级）；
// - 结果归一化为 papers 表元数据形状，跨源按 doi/标题去重（优先保留引用计数）；
// - ACADEMIC_MOCK=1 时返回确定性离线结果，供验收脚本与隔离测试使用；
// - 并发由 routes 层的检索 worker 控制（≤3），本模块只保证单源单请求。
const ARXIV_ENDPOINT = 'https://export.arxiv.org/api/query';
const OPENALEX_ENDPOINT = 'https://api.openalex.org/works';
// 单请求超时：环境变量可调，内网/被墙场景下避免每次白等 15s
const TIMEOUT_MS = parseInt(process.env.ACADEMIC_TIMEOUT_MS, 10) || 10000;

const MOCK = process.env.ACADEMIC_MOCK === '1';

// 默认检索源：环境变量 ACADEMIC_SOURCES 可覆盖（逗号分隔，如 openalex）。
// 未配置时默认 arxiv+openalex；源被墙时设置 ACADEMIC_SOURCES=openalex 即可只走 OpenAlex。
const DEFAULT_SOURCES = (process.env.ACADEMIC_SOURCES || 'arxiv,openalex')
  .split(',').map((s) => s.trim()).filter(Boolean);

function decodeEntities(text) {
  return String(text || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decodeEntities(m[1]).trim() : '';
}

function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

// ---------- arXiv ----------
function parseArxivAtom(xml) {
  const entries = xml.split('<entry>').slice(1);
  const items = [];
  for (const entry of entries) {
    const rawId = tag(entry, 'id'); // http://arxiv.org/abs/2301.00001v1
    const externalId = rawId.split('/abs/')[1] || rawId;
    if (!externalId) continue;
    const pdfMatch = entry.match(/<link[^>]+title="pdf"[^>]+href="([^"]+)"/) || entry.match(/<link[^>]+href="([^"]+\/pdf\/[^"]+)"/);
    const authors = [...entry.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map(m => decodeEntities(m[1]).trim()).filter(Boolean);
    const categories = [...entry.matchAll(/<category[^>]+term="([^"]+)"/g)].map(m => m[1]);
    const published = tag(entry, 'published');
    items.push({
      source: 'arxiv',
      external_id: externalId,
      title: normalizeWhitespace(tag(entry, 'title')),
      authors,
      abstract: normalizeWhitespace(tag(entry, 'summary')) || null,
      year: published ? parseInt(published.slice(0, 4), 10) : null,
      venue: 'arXiv',
      doi: tag(entry, 'arxiv:doi') || null,
      pdf_url: pdfMatch ? pdfMatch[1] : null,
      code_url: null,
      keywords: categories,
      citation_count: 0,
      raw_meta: { published: published || null },
    });
  }
  return items;
}

async function searchArxiv(query, maxResults) {
  const url = `${ARXIV_ENDPOINT}?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${maxResults}&sortBy=relevance`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'BrainBotDemo/1.0 (research collaboration)' } });
  if (!res.ok) throw new Error(`arXiv HTTP ${res.status}`);
  return parseArxivAtom(await res.text());
}

// ---------- OpenAlex ----------
async function searchOpenAlex(query, maxResults) {
  const url = `${OPENALEX_ENDPOINT}?search=${encodeURIComponent(query)}&per-page=${Math.min(maxResults, 25)}&mailto=brainbot-demo@localhost`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'BrainBotDemo/1.0 (research collaboration)' } });
  if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(w => ({
    source: 'openalex',
    external_id: String(w.id || '').replace('https://openalex.org/', ''),
    title: normalizeWhitespace(w.title),
    authors: (w.authorships || []).map(a => a.author?.display_name).filter(Boolean),
    abstract: invertAbstract(w.abstract_inverted_index),
    year: w.publication_year || null,
    venue: w.primary_location?.source?.display_name || null,
    doi: w.doi ? String(w.doi).replace('https://doi.org/', '') : null,
    pdf_url: w.best_oa_location?.pdf_url || w.open_access?.oa_url || null,
    code_url: null,
    keywords: (w.topics || []).map(t => t.display_name).filter(Boolean).slice(0, 8),
    citation_count: Math.max(0, w.cited_by_count || 0),
    raw_meta: { openalex_type: w.type || null, is_oa: Boolean(w.open_access?.is_oa) },
  })).filter(p => p.external_id && p.title);
}

// OpenAlex 摘要是倒排索引，需要还原
function invertAbstract(index) {
  if (!index || typeof index !== 'object') return null;
  const positions = [];
  for (const [word, places] of Object.entries(index)) {
    for (const p of places) positions[p] = word;
  }
  const text = positions.filter(Boolean).join(' ');
  return text ? normalizeWhitespace(text) : null;
}

// ---------- 离线 mock（验收/隔离测试用） ----------
function mockResults(source, query) {
  const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) || 'query';
  return [1, 2].map(i => ({
    source,
    external_id: `mock-${slug}-${i}`,
    title: `[mock] ${query} — ${source} result ${i}`,
    authors: ['Mock Author'],
    abstract: `Deterministic offline result for "${query}" from ${source}.`,
    year: 2026,
    venue: source === 'arxiv' ? 'arXiv' : 'Mock Venue',
    doi: `10.mock/${slug}-${i}`,
    pdf_url: null,
    code_url: null,
    keywords: ['mock'],
    citation_count: source === 'openalex' ? i * 7 : 0,
    raw_meta: { mock: true },
  }));
}

const adapters = { arxiv: searchArxiv, openalex: searchOpenAlex };

// 并发查询多个源：单源失败降级为 errors 条目，不影响其他源
async function searchAll(query, { sources = DEFAULT_SOURCES, maxResults = 10 } = {}) {
  if (MOCK) {
    return { items: dedupe(sources.flatMap(s => mockResults(s, query))), errors: [] };
  }
  const settled = await Promise.allSettled(
    sources.filter(s => adapters[s]).map(s => adapters[s](query, maxResults).then(items => ({ source: s, items })))
  );
  const items = [], errors = [];
  for (const r of settled) {
    if (r.status === 'fulfilled') items.push(...r.value.items);
    else errors.push(String(r.reason?.message || r.reason));
  }
  return { items: dedupe(items), errors };
}

// 跨源去重：doi 优先，其次规范化标题；保留引用计数较高的记录
function dedupe(items) {
  const seen = new Map();
  for (const item of items) {
    const key = item.doi ? `doi:${item.doi.toLowerCase()}` : `t:${(item.title || '').toLowerCase()}`;
    const prev = seen.get(key);
    if (!prev || (item.citation_count || 0) > (prev.citation_count || 0)) seen.set(key, item);
  }
  return [...seen.values()];
}

module.exports = { searchAll, searchArxiv, searchOpenAlex, parseArxivAtom, dedupe, SOURCES: Object.keys(adapters), DEFAULT_SOURCES };

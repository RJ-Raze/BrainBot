// M4 LLM 统一接入层（P0）—— C1 约束的承载模块
// 全平台唯一 LLM 调用出口：单模型 + temperature 角色上限校验 + mock 模式 + 失败重试
const MODEL = process.env.LLM_MODEL || 'deepseek-chat';
const BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = process.env.LLM_API_KEY || '';
const IS_MOCK = String(process.env.LLM_MOCK).toLowerCase() === 'true';
const LLM_TIMEOUT_MS = Math.max(1000, Number(process.env.LLM_TIMEOUT_MS) || 90000);

// v2.0 保险二：temperature 不得超过角色上限，超限自动降档
function clampTemperature(roleTempLimit, requested) {
  const req = requested ?? 0.7;
  if (roleTempLimit == null) return req;
  return Math.min(req, roleTempLimit);
}

// ---------- mock 模式：2s 内开始返回假流式输出（演示彩排必跑） ----------
const MOCK_REPLY = `好的，我已收到你的输入。以下是基于当前项目上下文的示例回复（mock 模式）：

**一、思路拆解**
1. 先明确目标边界，再拆成可执行的子任务；
2. 每个子任务绑定负责人与验收标准（DoD）；
3. 关键结论及时晋升为共享记忆，保证团队信息同步。

**二、建议的下一步**
- 在任务看板创建对应任务并关联本会话；
- 如需文献支撑，先在「科研工作区」手动收录资料并写入文献卡片；
- 将经过确认的结论晋升为共享记忆，供团队下一轮协作复用。

> 本回复由离线 mock 模式生成。当前 Demo 不调用真实模型或外部学术 API。`;

async function mockChat({ onDelta }) {
  const started = Date.now();
  let content = '';
  // 按小块推送，模拟流式；首块 200ms 内到达，整体 ~2s
  const chunks = MOCK_REPLY.match(/[\s\S]{1,12}/g) || [];
  for (const c of chunks) {
    await new Promise((r) => setTimeout(r, 60));
    content += c;
    if (onDelta) onDelta(c);
  }
  const latencyMs = Date.now() - started;
  return {
    content,
    promptTokens: 512,
    completionTokens: Math.ceil(content.length / 1.5),
    latencyMs,
    model: 'mock-' + MODEL,
  };
}

// ---------- 真实调用：OpenAI 兼容 SSE 流式 ----------
async function realChat({ messages, temperature, maxTokens, onDelta }) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  let emitted = false;
  try {
    const resp = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens || 2048, stream: true }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      const err = new Error(`LLM HTTP ${resp.status}`);
      err.httpStatus = resp.status;
      throw err;
    }
    if (!resp.body) throw new Error('LLM 未返回流式响应');
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let usage = null;
    let completed = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') { completed = true; continue; }
        let json;
        try { json = JSON.parse(payload); } catch { continue; }
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          emitted = true;
          onDelta?.(delta);
        }
        if (json.usage) usage = json.usage;
      }
    }
    if (!completed) throw new Error('LLM 流式响应提前中断');
    return {
      content,
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? Math.ceil(content.length / 1.5),
      latencyMs: Date.now() - started,
      model: MODEL,
    };
  } catch (error) {
    if (controller.signal.aborted) error = new Error('LLM 请求超时');
    error.partialResponse = emitted;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// 统一入口：首轮失败后最多重试 1 次，总耗时受客户端超时约束。
async function chat({ messages, temperature, maxTokens, onDelta }) {
  if (IS_MOCK) return mockChat({ onDelta });
  let lastErr;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      return await realChat({ messages, temperature, maxTokens, onDelta });
    } catch (err) {
      lastErr = err;
      if (err.httpStatus === 429) throw Object.assign(err, { isRateLimit: true });
      // 已向浏览器发送片段后不能重试，否则会拼接两次回答。
      if (err.partialResponse || (err.httpStatus >= 400 && err.httpStatus < 500)) throw err;
      if (attempt < 1) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// ---------- 一次性结构化输出（初始化模式专用：非流式、强 prompt、JSON 解析） ----------
// mock 模式：由调用方提供 mockData 直接返回，保证演示链路可跑
async function chatJson({ messages, temperature = 0.4, maxTokens = 3000, mockData }) {
  if (IS_MOCK) {
    await new Promise((r) => setTimeout(r, 1200)); // 模拟分析耗时
    return { data: mockData, model: 'mock-' + MODEL, promptTokens: 800, completionTokens: 600, latencyMs: 1200 };
  }
  let lastErr;
  for (let attempt = 0; attempt <= 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const resp = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL, messages, temperature, max_tokens: maxTokens, stream: false,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        const err = new Error(`LLM HTTP ${resp.status}`);
        err.httpStatus = resp.status;
        if (resp.status === 429) throw Object.assign(err, { isRateLimit: true });
        throw err;
      }
      const json = await resp.json();
      const raw = json.choices?.[0]?.message?.content || '';
      // 剥离可能的 markdown 代码围栏
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      return {
        data: JSON.parse(cleaned),
        model: MODEL,
        promptTokens: json.usage?.prompt_tokens ?? 0,
        completionTokens: json.usage?.completion_tokens ?? 0,
        latencyMs: 0,
      };
    } catch (err) {
      lastErr = controller.signal.aborted ? new Error('LLM 请求超时') : err;
      if (err.isRateLimit) throw err;
      if (err.httpStatus >= 400 && err.httpStatus < 500) throw err;
      if (attempt < 1) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

module.exports = { chat, chatJson, clampTemperature, IS_MOCK };

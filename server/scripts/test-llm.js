const assert = require('assert');

process.env.LLM_MOCK = 'false';
process.env.LLM_TIMEOUT_MS = '1000';
const llm = require('../src/services/llm');

function streamResponse(text) {
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  }), { status: 200 });
}

(async () => {
  let calls = 0;
  let deltas = '';
  global.fetch = async () => {
    calls++;
    return streamResponse('data: {"choices":[{"delta":{"content":"开头"}}]}\n\n');
  };
  await assert.rejects(llm.chat({ messages: [], onDelta: (delta) => { deltas += delta; } }), /提前中断/);
  assert.strictEqual(calls, 1, '已经输出片段后不能自动重试');
  assert.strictEqual(deltas, '开头');

  calls = 0;
  deltas = '';
  global.fetch = async () => {
    calls++;
    if (calls === 1) throw new Error('临时网络故障');
    return streamResponse('data: {"choices":[{"delta":{"content":"完成"}}]}\n\ndata: [DONE]\n\n');
  };
  const result = await llm.chat({ messages: [], onDelta: (delta) => { deltas += delta; } });
  assert.strictEqual(calls, 2, '首片段前的网络错误允许重试一次');
  assert.strictEqual(result.content, '完成');
  assert.strictEqual(deltas, '完成');

  calls = 0;
  global.fetch = async () => {
    calls++;
    return new Response('bad request', { status: 400 });
  };
  await assert.rejects(llm.chatJson({ messages: [] }), /LLM HTTP 400/);
  assert.strictEqual(calls, 1, '上游 4xx 错误不应重试');
  console.log('[test:llm] 截断流不重复输出、首片段前重试、4xx 不重试均通过');
})().catch((error) => { console.error('[test:llm]', error); process.exitCode = 1; });

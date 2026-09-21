require('dotenv').config();
const assert = require('node:assert/strict');
const { chat, chatJson, IS_MOCK } = require('../src/services/llm');
(async () => {
  assert.equal(IS_MOCK, false, 'Real-model acceptance cannot run in mock mode');
  let streamed = '';
  const answer = await chat({ messages: [{role:'user',content:'Reply with OK only.'}], maxTokens:16, temperature:0, onDelta: x=>{streamed+=x} });
  assert(answer.content.includes('OK')); assert.equal(streamed,answer.content);
  const structured = await chatJson({ messages:[{role:'user',content:'Return exactly this JSON object: {"ok":true}'}],maxTokens:32,temperature:0 });
  assert.equal(structured.data.ok,true);
  console.log('[real-llm] PASS: authenticated DeepSeek SSE + JSON, no mock fallback');
})().catch(e=>{console.error(e.message);process.exitCode=1});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatHandler, HEAVY_LOAD, MODEL } from './ai.mjs';

const body = { messages: [{ role: 'system', content: 'Astreis system context.' }, { role: 'user', content: 'Hello' }], model: 'client-choice', stream: false, max_completion_tokens: 999999 };
const request = (payload = body) => new Request('https://astreis.example/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

test('the server owns the credential, model and token cap and preserves SSE', async () => {
  const events = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n';
  const handler = createChatHandler({ authenticate: async () => null, getKey: () => 'server-secret', fetchUpstream: async (url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer server-secret');
    const sent = JSON.parse(options.body);
    assert.equal(sent.model, MODEL); assert.equal(sent.stream, true); assert.equal(sent.max_completion_tokens, 1536);
    assert.equal(sent.messages[1].content, 'Hello');
    return new Response(events, { headers: { 'Content-Type': 'text/event-stream' } });
  } });
  const response = await handler(request());
  assert.equal(response.status, 200); assert.equal(await response.text(), events);
  assert.equal(response.headers.get('cache-control'), 'no-store, no-transform');
});
test('rate limits become the short public message and preserve a bounded retry delay', async () => {
  const response = await createChatHandler({ authenticate: async () => null, getKey: () => 'secret', fetchUpstream: async () => new Response('PRIVATE PROVIDER DETAILS', { status: 429, headers: { 'Retry-After': '12' } }) })(request());
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '12');
  assert.deepEqual(await response.json(), { error: { code: 'rate_limited', message: HEAVY_LOAD } });
});
test('bad requests never reach the paid upstream', async () => {
  const handler = createChatHandler({ authenticate: async () => null, getKey: () => 'secret', fetchUpstream: async () => { throw new Error('Should not call upstream'); } });
  for (const invalid of [{}, { messages: [] }, { messages: [{ role: 'system', content: 'a' }, { role: 'system', content: 'b' }] }, { messages: [{ role: 'system', content: 'a'.repeat(41000) }, { role: 'user', content: 'x' }] }]) {
    assert.equal((await handler(request(invalid))).status, 400);
  }
  assert.equal((await handler(new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(70000) }))).status, 413);
});
test('missing configuration, provider failures and timeouts do not leak credentials', async () => {
  const missing = await createChatHandler({ authenticate: async () => null, getKey: () => '' })(request());
  assert.equal(missing.status, 503); assert.equal((await missing.json()).error.code, 'not_configured');
  for (const upstream of [async () => new Response('secret provider trace', { status: 500 }), async () => { throw new Error('secret provider trace'); }]) {
    const response = await createChatHandler({ authenticate: async () => null, getKey: () => 'private-key', fetchUpstream: upstream })(request());
    const text = await response.text(); assert.equal(response.status, 503); assert.doesNotMatch(text, /private-key|secret provider trace/);
  }
});

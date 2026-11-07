export const HEAVY_LOAD = 'Under heavy load. Please try again shortly.';
export const MODEL = 'openai/gpt-oss-120b';
const MAX_BODY_BYTES = 64 * 1024;
const MAX_TEXT = 40_000;

function failure(status, code, message, retryAfter) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (retryAfter) headers['Retry-After'] = String(retryAfter);
  return new Response(JSON.stringify({ error: { code, message } }), { status, headers });
}

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new Error('too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid');
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new Error('too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function validateChat(body) {
  if (!Array.isArray(body?.messages) || body.messages.length < 2 || body.messages.length > 17) return null;
  let length = 0;
  const messages = [];
  for (const [index, message] of body.messages.entries()) {
    if (!message || !['system', 'user', 'assistant'].includes(message.role)
      || (message.role === 'system' && index !== 0)
      || typeof message.content !== 'string' || !message.content.trim()) return null;
    length += message.content.length;
    if (length > MAX_TEXT) return null;
    messages.push({ role: message.role, content: message.content });
  }
  if (messages[0].role !== 'system' || messages.at(-1).role !== 'user') return null;
  return {
    model: MODEL,
    messages,
    stream: true,
    max_completion_tokens: body.max_completion_tokens === 192 ? 192 : 1536,
  };
}

export function createChatHandler({ fetchUpstream = fetch, getKey = () => process.env.GROQ_API_KEY, authenticate = verifySession } = {}) {
  return async function chat(request) {
    if (request.method !== 'POST') return failure(405, 'invalid_request', 'Use POST for this endpoint.');
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
      return failure(415, 'invalid_request', 'A JSON request is required.');
    }
    const denied = await authenticate(request);
    if (denied) return failure(denied.status, denied.code, denied.message);
    let payload;
    try { payload = validateChat(await readBody(request)); }
    catch (error) { return failure(error.message === 'too_large' ? 413 : 400, 'invalid_request', 'The AI request is too large or invalid.'); }
    if (!payload) return failure(400, 'invalid_request', 'The AI request is too large or invalid.');
    const key = getKey()?.trim();
    if (!key) return failure(503, 'not_configured', 'Astreis AI is not online yet. Please try again later.');

    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 50_000);
    timer.unref?.();
    const signal = AbortSignal.any([request.signal, timeout.signal]);
    let upstream;
    try {
      upstream = await fetchUpstream('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal,
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      clearTimeout(timer);
      return failure(503, 'provider', HEAVY_LOAD, 15);
    }
    if (!upstream.ok) {
      clearTimeout(timer);
      await upstream.body?.cancel();
      if (upstream.status === 429) {
        const seconds = Number(upstream.headers.get('retry-after'));
        return failure(429, 'rate_limited', HEAVY_LOAD, Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 86400) : 30);
      }
      return failure(503, 'provider', 'Astreis AI is temporarily unavailable. Please try again shortly.', 15);
    }
    if (!upstream.body || !upstream.headers.get('content-type')?.includes('text/event-stream')) {
      clearTimeout(timer);
      await upstream.body?.cancel();
      return failure(502, 'malformed_response', 'The AI response was interrupted. Please try again.');
    }
    const reader = upstream.body.getReader();
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) { clearTimeout(timer); controller.close(); reader.releaseLock(); }
          else controller.enqueue(value);
        } catch {
          clearTimeout(timer); controller.error(new Error('The AI response was interrupted.'));
        }
      },
      async cancel() { clearTimeout(timer); timeout.abort(); await reader.cancel().catch(() => {}); },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } });
  };
}
import { verifySession } from './auth.mjs';


import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';

const project = new URL('../', import.meta.url);
const [checksum, filename] = (await readFile(new URL('../downloads/SHA256SUMS', import.meta.url), 'utf8')).trim().split(/\s+/);
const packageBytes = (await readFile(new URL('../downloads/' + filename, import.meta.url))).byteLength;
function launch(port, args = []) {
  const child = spawn(process.execPath, ['scripts/serve.mjs', ...args], {
    cwd: project, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return child;
}
async function stop(child) {
  if (child.exitCode !== null) return;
  const exit = once(child, 'exit');
  child.kill('SIGTERM');
  await exit;
}
async function ready(child) {
  let output = '';
  for await (const chunk of child.stdout) {
    output += chunk;
    const match = output.match(/Astreis website: (http:\/\/localhost:\d+)/);
    if (match) return { url: match[1], output };
  }
  throw new Error('Server exited before printing its URL');
}
test('an occupied port falls back without disturbing its owner', { timeout: 10000 }, async () => {
  const blocker = http.createServer((req, res) => res.end('original server'));
  blocker.listen(0, '127.0.0.1');
  await once(blocker, 'listening');
  const port = blocker.address().port;
  const child = launch(port);
  try {
    const { url, output } = await ready(child);
    assert.match(output, /is in use; trying/);
    assert.notEqual(new URL(url).port, String(port));
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'original server');
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /A PC optimizer/);
    assert.equal(page.headers.get('cache-control'), 'no-store');
    const head = await fetch(url + '/downloads/' + filename, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), String(packageBytes));
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    assert.equal((await fetch(url + '/missing-file')).status, 404);
  } finally {
    await stop(child);
    await new Promise(resolve => blocker.close(resolve));
  }
});
test('an explicit CLI port works, including an OS-assigned free port', { timeout: 10000 }, async () => {
  const child = launch('invalid', ['--port', '0']);
  try { assert.equal((await fetch((await ready(child)).url)).status, 200); }
  finally { await stop(child); }
});
test('an invalid port prints a useful message without an uncaught exception', { timeout: 10000 }, async () => {
  const child = launch('invalid');
  let stderr = '';
  child.stderr.on('data', data => { stderr += data; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(stderr, /Choose a port/);
  assert.doesNotMatch(stderr, /Unhandled|node:events/);
});

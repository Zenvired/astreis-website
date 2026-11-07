import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const site = fileURLToPath(new URL('../', import.meta.url));
const release = JSON.parse(await readFile(new URL('../dist/downloads/release.json', import.meta.url), 'utf8'));
const server = spawn(process.execPath, ['scripts/serve.mjs', 'dist'], {
  cwd: site, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
});
try {
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Release preview did not start.')), 8000);
    timeout.unref();
    let output = '';
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/Astreis website: (http:\/\/localhost:\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Release preview exited: ${code}`)));
  });
  const html = await (await fetch(url)).text();
  assert.ok(html.includes('Version ' + release.version));
  assert.ok(html.includes('downloads/' + release.filename));
  const response = await fetch(url + '/downloads/' + release.filename);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get('content-disposition').includes(release.filename));
  const binary = Buffer.from(await response.arrayBuffer());
  assert.equal(binary.length, release.bytes);
  assert.equal(createHash('sha256').update(binary).digest('hex'), release.sha256);
  console.log(`Verified actual HTTP download: Astreis ${release.version}, ${release.bytes} bytes, matching SHA-256.`);
} finally {
  if (server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await exited;
  }
}

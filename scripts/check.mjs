import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML ids must be unique');
for (const match of html.matchAll(/\b(?:src|href|data-dark-src)="([^"#][^"]*)"/g)) {
  const url = match[1];
  if (!/^(?:https?:|data:|mailto:)/.test(url)) await access(path.join(root, url.split('#')[0]));
}
for (const match of html.matchAll(/\b(?:href="#|aria-controls=")([^"]+)"/g)) {
  assert.ok(ids.includes(match[1]), `Missing anchor/control target: ${match[1]}`);
}
for (const match of html.matchAll(/\baria-labelledby="([^"]+)"/g)) {
  for (const id of match[1].split(' ')) assert.ok(ids.includes(id), `Missing label: ${id}`);
}
const sums = await readFile(path.join(root, 'downloads/SHA256SUMS'), 'utf8');
const [expected, filename] = sums.trim().split(/\s+/);
const binary = await readFile(path.join(root, 'downloads', filename));
const actual = createHash('sha256').update(binary).digest('hex');
assert.equal(actual, expected, 'Download must match its original release checksum');
assert.ok(html.includes(actual), 'Displayed checksum must match the release');
const release = JSON.parse(await readFile(path.join(root, 'downloads/release.json'), 'utf8'));
assert.equal(release.sha256, actual);
assert.equal(release.filename, filename);
assert.equal(release.bytes, binary.length);
assert.ok(html.includes('Version ' + release.version), 'Visible version must match the package');
for (const match of html.matchAll(/downloads\/(Astreis_[^" ]+\.deb)/g)) assert.equal(match[1], filename, 'All download buttons must use the current package');
for (const [hash, name] of sums.trim().split('\n').map(line => line.trim().split(/\s+/))) {
  const artifact = name === filename ? release : release.flatpak;
  const bytes = await readFile(path.join(root, 'downloads', name));
  assert.equal(name, artifact.filename);
  assert.equal(hash, artifact.sha256);
  assert.equal(bytes.length, artifact.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
  assert.ok(html.includes(hash));
  assert.ok(html.includes('downloads/' + name));
}
assert.ok(binary.length < 50 * 1024 * 1024, 'Package stays below the 50 MiB release budget');
for (const file of ['src/main.js', 'src/site-theme.js', 'src/celestial.js', 'src/shaders.js', 'scripts/build.mjs', 'scripts/serve.mjs']) {
  execFileSync(process.execPath, ['--check', path.join(root, file)]);
}
assert.ok(!/<(?:script|img)[^>]+src="https?:/i.test(html), 'Scripts and images must remain local');
console.log(`Passed: assets, links, scripts, and Astreis ${release.version} release metadata / SHA-256 (${binary.length} bytes).`);

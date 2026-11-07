import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { configurePackage, refreshRelease, publicOrigin } from './release-tools.mjs';

test('only a public HTTPS origin can be written into an installer', () => {
  assert.equal(publicOrigin('https://astreis.example/'), 'https://astreis.example');
  for (const url of ['http://example.test', 'https://user:secret@example.test', 'https://example.test/path', 'https://example.test/?key=secret']) assert.throws(() => publicOrigin(url));
});

test('deployment configures the .deb and updates every public release reference', async () => {
  const site = await mkdtemp(path.join(tmpdir(), 'astreis-release-test-'));
  try {
    const staging = path.join(site, 'package');
    for (const dir of ['DEBIAN', 'usr/share/astreis', 'usr/bin']) await mkdir(path.join(staging, dir), { recursive: true });
    await mkdir(path.join(site, 'downloads'));
    await writeFile(path.join(staging, 'DEBIAN/control'), 'Package: astreis\nVersion: 0.1.1\nArchitecture: amd64\nMaintainer: Astreis <test@example.test>\nDescription: Test fixture\n');
    await writeFile(path.join(staging, 'usr/share/astreis/service.json'), '{"apiBaseUrl":""}');
    await writeFile(path.join(staging, 'usr/bin/astreis'), 'unchanged test executable');
    const filename = 'Astreis_0.1.1_amd64.deb';
    const deb = path.join(site, 'downloads', filename);
    execFileSync('dpkg-deb', ['--root-owner-group', '--build', staging, deb], { stdio: 'ignore' });
    for (const name of ['netlify.toml', '_headers', 'README.md', 'ASSETS.md', 'SHARED-AI.md']) await writeFile(path.join(site, name), 'Astreis_0.1.0_amd64.deb');
    await writeFile(path.join(site, 'index.html'), '>v0.1.0 <span> Version 0.1.0 / 17.5 MiB / downloads/Astreis_0.1.0_amd64.deb <code class="hash">' + '0'.repeat(64) + '</code>');
    await configurePackage(deb, 'https://astreis.example');
    const hash = createHash('sha256').update(await readFile(deb)).digest('hex');
    await configurePackage(deb, 'https://astreis.example');
    assert.equal(createHash('sha256').update(await readFile(deb)).digest('hex'), hash, 'An unchanged address must not repackage the installer');
    const extracted = path.join(site, 'verified');
    execFileSync('dpkg-deb', ['-x', deb, extracted]);
    assert.equal(await readFile(path.join(extracted, 'usr/bin/astreis'), 'utf8'), 'unchanged test executable');
    assert.deepEqual(JSON.parse(await readFile(path.join(extracted, 'usr/share/astreis/service.json'), 'utf8')), { apiBaseUrl: 'https://astreis.example' });
    const release = await refreshRelease(site, filename);
    assert.equal(release.version, '0.1.1'); assert.equal(release.sha256, hash);
    assert.equal((await readFile(path.join(site, 'downloads/SHA256SUMS'), 'utf8')).trim(), hash + '  ' + filename);
    const html = await readFile(path.join(site, 'index.html'), 'utf8');
    assert.ok(html.includes('Version 0.1.1')); assert.ok(html.includes('>v0.1.1 ')); assert.ok(html.includes(hash)); assert.ok(!html.includes('0.1.0'));
    assert.equal(await readFile(path.join(site, '_headers'), 'utf8'), filename);
  } finally { await rm(site, { recursive: true, force: true }); }
});

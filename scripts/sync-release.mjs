import { cp, readFile, readdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { refreshRelease } from './release-tools.mjs';

const site = fileURLToPath(new URL('../', import.meta.url));
const app = path.resolve(site, '../Astreis');
const checksums = new Map((await readFile(path.join(app, 'release/SHA256SUMS'), 'utf8'))
  .trim().split('\n').map(line => line.trim().split(/\s+/).reverse()));
const filename = [...checksums.keys()].find(name => /^Astreis_\d+\.\d+\.\d+_amd64\.deb$/.test(name));
if (!filename) throw new Error('Missing Debian release checksum.');
const flatpak = filename.replace('_amd64.deb', '_x86_64.flatpak');
for (const name of [filename, flatpak]) {
  const binary = await readFile(path.join(app, 'release', name));
  const hash = createHash('sha256').update(binary).digest('hex');
  if (checksums.get(name) !== hash) throw new Error(`Release checksum mismatch for ${name}.`);
}
for (const name of [filename, flatpak, 'INSTALL.txt']) await cp(path.join(app, 'release', name), path.join(site, 'downloads', name));
const release = await refreshRelease(site, filename);
for (const name of await readdir(path.join(site, 'downloads'))) {
  if (/^Astreis_.*\.(deb|flatpak)$/.test(name) && name !== filename && name !== flatpak) await rm(path.join(site, 'downloads', name));
}
execFileSync(process.execPath, ['scripts/check.mjs'], { cwd: site, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: site, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-release.mjs'], { cwd: site, stdio: 'inherit' });
execFileSync('python3', ['scripts/package-delivery.py'], { cwd: site, stdio: 'inherit' });
console.log(`Website and delivery ZIPs now contain Astreis ${release.version} (${release.bytes} bytes).`);

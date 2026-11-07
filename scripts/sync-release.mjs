import { cp, readFile, readdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { refreshRelease } from './release-tools.mjs';

const site = fileURLToPath(new URL('../', import.meta.url));
const app = path.resolve(site, '../Astreis');
const [expectedHash, filename] = (await readFile(path.join(app, 'release/SHA256SUMS'), 'utf8')).trim().split(/\s+/);
if (!/^Astreis_\d+\.\d+\.\d+_amd64\.deb$/.test(filename)) throw new Error('Unexpected release package.');
const actualHash = createHash('sha256').update(await readFile(path.join(app, 'release', filename))).digest('hex');
if (actualHash !== expectedHash) throw new Error('The app release does not match its checksum; the website was not changed.');
for (const name of [filename, 'SHA256SUMS', 'INSTALL.txt']) await cp(path.join(app, 'release', name), path.join(site, 'downloads', name));
const release = await refreshRelease(site, filename);
for (const name of await readdir(path.join(site, 'downloads'))) {
  if (/^Astreis_.*\.deb$/.test(name) && name !== filename) await rm(path.join(site, 'downloads', name));
}
execFileSync(process.execPath, ['scripts/check.mjs'], { cwd: site, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: site, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-release.mjs'], { cwd: site, stdio: 'inherit' });
execFileSync('python3', ['scripts/package-delivery.py'], { cwd: site, stdio: 'inherit' });
console.log(`Website and delivery ZIPs now contain Astreis ${release.version} (${release.bytes} bytes).`);

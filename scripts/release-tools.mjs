import { readFile, writeFile, mkdtemp, rm, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);
export function publicOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('The release service address must be an HTTPS origin without credentials or paths.');
  }
  return url.origin;
}

export async function configurePackage(packagePath, origin) {
  origin = publicOrigin(origin);
  const staging = await mkdtemp(path.join(tmpdir(), 'astreis-release-'));
  const temporary = packagePath + '.next';
  try {
    await exec('dpkg-deb', ['--raw-extract', packagePath, staging]);
    const configPath = path.join(staging, 'usr/share/astreis/service.json');
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    if (config.apiBaseUrl === origin) return;
    await writeFile(configPath, JSON.stringify({ apiBaseUrl: origin }, null, 2) + '\n');
    // This writes only a public address. Provider credentials never enter the package.
    await exec('dpkg-deb', ['--root-owner-group', '-Zxz', '-z6', '--build', staging, temporary]);
    await rename(temporary, packagePath);
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(temporary, { force: true });
  }
}

export async function refreshRelease(site, filename) {
  if (!/^Astreis_\d+\.\d+\.\d+_amd64\.deb$/.test(filename)) throw new Error('Unexpected release filename.');
  const packagePath = path.join(site, 'downloads', filename);
  const { stdout } = await exec('dpkg-deb', ['-f', packagePath, 'Package', 'Version', 'Architecture']);
  const fields = Object.fromEntries(stdout.trim().split('\n').map(line => line.split(': ')));
  const version = filename.match(/^Astreis_(.+)_amd64\.deb$/)[1];
  if (fields.Package !== 'astreis' || fields.Version !== version || fields.Architecture !== 'amd64') throw new Error('Debian package metadata does not match the download.');
  const binary = await readFile(packagePath);
  const sha256 = createHash('sha256').update(binary).digest('hex');
  const size = (binary.byteLength / 1024 / 1024).toFixed(1) + ' MiB';
  const release = { version, filename, bytes: binary.byteLength, sha256 };
  await writeFile(path.join(site, 'downloads/release.json'), JSON.stringify(release, null, 2) + '\n');
  await writeFile(path.join(site, 'downloads/SHA256SUMS'), `${sha256}  ${filename}\n`);
  for (const name of ['index.html', 'netlify.toml', '_headers', 'README.md', 'ASSETS.md', 'SHARED-AI.md']) {
    const p = path.join(site, name);
    let text = await readFile(p, 'utf8');
    text = text.replace(/Astreis_\d+\.\d+\.\d+_amd64\.deb/g, filename);
    if (name === 'index.html') {
      text = text.replace(/>v\d+\.\d+\.\d+ /g, `>v${version} `)
        .replace(/Version \d+\.\d+\.\d+/g, `Version ${version}`)
        .replace(/\d+\.\d+ MiB/g, size)
        .replace(/(<code class="hash">)[a-f0-9]{64}/g, `$1${sha256}`);
    }
    if (name === 'ASSETS.md') text = text.replace(/`[a-f0-9]{64}`/g, '`' + sha256 + '`');
    await writeFile(p, text);
  }
  return release;
}

export async function prepareHostedRelease(site, environment = process.env) {
  const filename = (await readFile(path.join(site, 'downloads/SHA256SUMS'), 'utf8')).trim().split(/\s+/)[1];
  if (!/^Astreis_\d+\.\d+\.\d+_amd64\.deb$/.test(filename)) throw new Error('Unexpected release filename.');
  const origin = environment.ASTREIS_API_BASE_URL || (environment.NETLIFY === 'true' ? environment.URL : '');
  if (origin) await configurePackage(path.join(site, 'downloads', filename), origin);
  return refreshRelease(site, filename);
}

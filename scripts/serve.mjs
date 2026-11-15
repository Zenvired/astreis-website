import http from 'node:http';
import { open, readFile, realpath, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const configuredPort = portIndex >= 0 ? args[portIndex + 1] : process.env.PORT;
const startPort = configuredPort === undefined ? 4173 : Number(configuredPort);
if ((portIndex >= 0 && args[portIndex + 1] === undefined) || !Number.isInteger(startPort) || startPort < 0 || startPort > 65535) {
  console.error('Choose a port from 0 to 65535. Example: npm run dev -- --port 4200');
  process.exit(1);
}
if (portIndex >= 0) args.splice(portIndex, 2);
if (args.length > 1 || args.some(arg => arg.startsWith('--'))) {
  console.error('Usage: node scripts/serve.mjs [dist] [--port 4200]');
  process.exit(1);
}
const previewDirectory = path.resolve(project, args[0] || '.');
let root;
try {
  root = await realpath(previewDirectory);
  await stat(path.join(root, 'index.html'));
} catch {
  console.error(`No index.html in ${previewDirectory}. Run npm run build before npm run preview.`);
  process.exit(1);
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.deb': 'application/vnd.debian.binary-package',
  '.flatpak': 'application/vnd.flatpak',
  '.txt': 'text/plain; charset=utf-8',
};
const downloads = new Set(['.deb', '.flatpak']);

function insideRoot(file) {
  return file === root || file.startsWith(root + path.sep);
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let name;
  try {
    name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }

  let handle;
  try {
    let file = path.resolve(root, '.' + name);
    if (!insideRoot(file)) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const resolved = await realpath(file);
    if (!insideRoot(resolved)) {
      res.writeHead(403).end();
      return;
    }

    if (!(await stat(resolved)).isFile()) throw new Error('Expected a file');
    handle = await open(resolved, 'r');
    const { size } = await handle.stat();
    const extension = path.extname(file);
    const headers = {
      'Content-Type': types[extension] || 'application/octet-stream',
      'Content-Length': size,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    };
    if (downloads.has(extension)) {
      headers['Content-Disposition'] = `attachment; filename="${path.basename(file)}"`;
    }

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    await pipeline(handle.createReadStream(), res);
  } catch {
    if (res.destroyed || res.headersSent) {
      res.destroy();
      return;
    }
    const page = await readFile(path.join(root, '404.html')).catch(() => 'Page not found.');
    res.writeHead(404, { 'Content-Type': types['.html'] });
    res.end(req.method === 'HEAD' ? undefined : page);
  } finally {
    await handle?.close();
  }
});
let requestedPort = startPort;
server.on('error', error => {
  if (error.code === 'EADDRINUSE' && requestedPort < Math.min(startPort + 20, 65535)) {
    console.log(`Port ${requestedPort} is in use; trying ${requestedPort + 1}…`);
    requestedPort += 1;
    server.listen(requestedPort, '127.0.0.1');
  } else {
    console.error(error.code === 'EADDRINUSE'
      ? 'No free port nearby. Try npm run dev -- --port 4200.'
      : `Could not start the preview: ${error.message}`);
    process.exitCode = 1;
  }
});
server.on('listening', () => console.log(`Astreis website: http://localhost:${server.address().port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
server.listen(requestedPort, '127.0.0.1');

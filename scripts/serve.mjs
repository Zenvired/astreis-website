import http from 'node:http';
import { readFile, stat, access } from 'node:fs/promises';
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
const root = path.resolve(project, args[0] || '.');
try {
  await access(path.join(root, 'index.html'));
} catch {
  console.error(`No index.html in ${root}. Run npm run build before npm run preview.`);
  process.exit(1);
}
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.deb': 'application/vnd.debian.binary-package', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': body.byteLength, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' };
    if (file.endsWith('.deb')) headers['Content-Disposition'] = `attachment; filename="${path.basename(file)}"`;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    const page = await readFile(path.join(root, '404.html')).catch(() => 'Page not found.');
    res.end(req.method === 'HEAD' ? undefined : page);
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

// Optional integration QA. Uses an existing Chromium-compatible browser and Node 22.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const [releaseHash, releaseFilename] = (await readFile(path.join(root, 'downloads/SHA256SUMS'), 'utf8')).trim().split(/\s+/);
const output = path.join(root, 'output');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), 'astreis-site-qa-'));
const browser = spawn(process.env.BROWSER_BIN || '/usr/bin/brave-browser', [
  '--headless=new', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--remote-debugging-port=9433', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
const errors = [], failures = [];
try {
  let pages;
  for (let i = 0; i < 80; i++) {
    try { pages = await (await fetch('http://127.0.0.1:9433/json')).json(); if (pages.length) break; } catch {}
    await wait(100);
  }
  assert.ok(pages?.length, 'Browser should start');
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Network.loadingFailed' && !message.params.canceled) failures.push(message.params.errorText);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  const siteURL = process.env.QA_URL || 'http://127.0.0.1:4173/';
  await send('Page.navigate', { url: siteURL });
  for (let i=0; i<100; i++) {
    if (await evaluate(`document.readyState === 'complete' && !!document.querySelector('.scene-light[data-ready="true"]') && !!document.querySelector('.scene-dark[data-ready="true"]')`)) break;
    await wait(100);
  }
  assert.equal(await evaluate(`document.querySelectorAll('.scene-material[data-ready="true"]').length`), 2, 'Both original materials should compile');
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'Desktop must not overflow');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.menu-toggle')).display`), 'none', 'Desktop must hide the mobile menu control');
  const screenshot = async name => {
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(path.join(output, name + '.png'), Buffer.from(data, 'base64'));
  };
  const animatedSunShot = async () => (await send('Page.captureScreenshot', { format: 'png', clip: { x: 950, y: 520, width: 200, height: 80, scale: 1 } })).data;
  const sunBefore = await animatedSunShot();
  await wait(500);
  assert.notEqual(sunBefore, await animatedSunShot(), 'The solar material visibly animates');
  await evaluate(`document.querySelector('.motion-toggle').click()`);
  assert.equal(await evaluate(`document.querySelector('.motion-toggle').getAttribute('aria-pressed')`), 'true');
  await screenshot('desktop-light');
  await evaluate(`document.querySelector('[data-preview="home"]').click()`);
  assert.equal(await evaluate(`document.querySelector('.screenshot-dialog').open`), true, 'Full-size screenshot should open');
  assert.equal(await evaluate(`document.querySelector('.screenshot-full').src.includes('home-light.webp')`), true);
  await evaluate(`document.querySelector('.screenshot-close').click()`);
  assert.equal(await evaluate(`document.querySelector('.screenshot-dialog').open`), false, 'Screenshot should close');
  for (const feature of ['home','monitor','optimize','clean','setup','ai']) {
    await evaluate(`document.querySelector('[data-feature="${feature}"]').click()`);
    assert.equal(await evaluate(`!document.getElementById('panel-${feature}').hidden`), true, `${feature} panel should open`);
  }
  await evaluate(`document.querySelector('[data-feature="home"]').click()`);
  await evaluate(`document.querySelector('[data-feature="home"]').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}))`);
  assert.equal(await evaluate(`document.querySelector('[data-feature="ai"]').getAttribute('aria-selected')`), 'true', 'Keyboard tab navigation');
  await evaluate(`document.querySelector('[data-feature="monitor"]').click();document.getElementById('features').scrollIntoView()`);
  await wait(700);
  assert.equal(await evaluate(`(()=>{let i=document.querySelector('#panel-monitor img');return Math.abs(i.clientWidth/i.clientHeight-16/9)<.02})()`), true, 'Real screenshots retain their aspect ratio');
  await screenshot('features-light');
  assert.equal(await evaluate(`document.querySelector('.trailer-player iframe') === null`), true, 'YouTube loads only on request');
  assert.equal(await evaluate(`!!document.querySelector('a[href="https://github.com/Zenvired/astreis-releases"]')`), true);
  await evaluate(`document.getElementById('trailer').scrollIntoView()`);
  await wait(700);
  await screenshot('trailer-light');
  await evaluate(`document.getElementById('about').scrollIntoView()`);
  await wait(700);
  await screenshot('about-light');
  await evaluate(`document.getElementById('download').scrollIntoView()`);
  await wait(700);
  await screenshot('download-light');
  await evaluate(`scrollTo({top:0,behavior:'instant'}); document.querySelector('.theme-toggle').click()`);
  await wait(1400);
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), 'dark');
  await screenshot('desktop-dark');
  await evaluate(`document.querySelector('.motion-toggle').click()`);
  const movingShot = async () => (await send('Page.captureScreenshot', { format: 'png', clip: { x: 950, y: 520, width: 200, height: 80, scale: 1 } })).data;
  const before = await movingShot();
  await wait(500);
  const after = await movingShot();
  assert.notEqual(before, after, 'The black-hole material visibly animates');
  await evaluate(`document.querySelector('.motion-toggle').click()`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate(`document.querySelector('.theme-toggle').click()`);
  await wait(1300);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'Mobile must not overflow');
  await screenshot('mobile-light');
  await evaluate(`document.querySelector('.menu-toggle').click()`);
  assert.equal(await evaluate(`document.getElementById('mobile-nav').hidden`), false);
  await evaluate(`document.querySelector('#mobile-nav a').click()`);
  assert.equal(await evaluate(`document.getElementById('mobile-nav').hidden`), true);
  await evaluate(`scrollTo({top:0,behavior:'instant'});document.querySelector('.theme-toggle').click()`);
  await wait(1300);
  await screenshot('mobile-dark');
  for (const width of [320, 768, 1024]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `${width}px layout must not overflow`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate(`document.querySelector('.theme-toggle').click();document.getElementById('download').scrollIntoView()`);
  await wait(1300);
  await screenshot('download-mobile');
  await evaluate(`document.querySelectorAll('.faq-list details')[0].open=true`);
  assert.equal(await evaluate(`document.querySelector('.faq-list details').open`), true);
  await send('Emulation.setEmulatedMedia', { features: [{name:'prefers-reduced-motion',value:'reduce'}] });
  for (let i=0; i<20; i++) { if (await evaluate(`document.querySelector('.motion-toggle').disabled`)) break; await wait(50); }
  assert.equal(await evaluate(`document.querySelector('.motion-toggle').disabled`), true, 'Reduced motion must suspend decorative animation');
  const download = await fetch(new URL('downloads/' + releaseFilename, siteURL));
  assert.equal(download.status, 200);
  assert.ok(download.headers.get('content-disposition').includes('attachment'));
  assert.equal(createHash('sha256').update(Buffer.from(await download.arrayBuffer())).digest('hex'), releaseHash, 'The HTTP download must be the current release');
  assert.deepEqual(errors, [], 'No JavaScript runtime errors');
  assert.deepEqual(failures, [], 'No failed network requests');
  await evaluate(`document.querySelector('.trailer-play').click()`);
  assert.equal(await evaluate(`document.querySelector('.trailer-player iframe').src`), 'https://www.youtube-nocookie.com/embed/domnL69Yfew?autoplay=1&rel=0');
  await writeFile(path.join(output, 'qa.json'), JSON.stringify({ passed: true, checks: ['both WebGL shaders','visible sun and black-hole animation','320/390/768/1024/1440px overflow','screenshot proportions','six feature tabs','keyboard tabs','light/dark theme','pause/play','mobile menu','FAQ','reduced motion','complete .deb download'], errors, failures }, null, 2));
  console.log('Browser checks passed. Desktop/mobile screenshots saved in output/.');
} finally {
  socket?.close();
  browser.kill('SIGTERM');
  await wait(500);
  await rm(profile, { force: true, recursive: true, maxRetries: 4, retryDelay: 300 });
}

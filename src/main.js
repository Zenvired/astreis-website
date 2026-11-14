import { CelestialScene } from './celestial.js';
import { applySiteTheme, initialTheme } from './site-theme.js';

const root = document.documentElement;
const themeButton = document.querySelector('.theme-toggle');
let theme = initialTheme;
const themedScreenshots = [...document.querySelectorAll('img[data-dark-src]')].map(image => ({
  image, light: image.getAttribute('src'), dark: image.dataset.darkSrc,
}));
const scene = new CelestialScene(document.querySelector('.celestial-scene'));

function syncTheme() {
  const dark = theme === 'dark';
  applySiteTheme(theme);
  themeButton.setAttribute('aria-pressed', String(dark));
  themeButton.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
  document.querySelector('.app-preview-label').textContent = `Astreis · ${dark ? 'Dark' : 'Light'} mode`;
  const lightShot = document.querySelector('.home-light'), darkShot = document.querySelector('.home-dark');
  lightShot.setAttribute('aria-hidden', String(dark));
  darkShot.setAttribute('aria-hidden', String(!dark));
  darkShot.alt = dark ? 'The native Astreis Home screen in dark mode with its blue black hole, current profile and live hardware readings.' : '';
  for (const shot of themedScreenshots) shot.image.src = shot[theme];
  scene.setTheme(theme);
}
syncTheme();
let themeTransition;
themeButton.addEventListener('click', () => {
  theme = theme === 'light' ? 'dark' : 'light';
  themeTransition?.skipTransition();
  if (document.startViewTransition && !scene.reduced && document.visibilityState === 'visible') {
    const bounds = themeButton.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2, y = bounds.top + bounds.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('native-theme-transition');
    const transition = document.startViewTransition(syncTheme);
    themeTransition = transition;
    transition.ready.then(() => root.animate([
      { clipPath: `circle(0px at ${x}px ${y}px)` },
      { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
    ], { duration: 850, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)', fill: 'both' }).finished).catch(() => {});
    transition.finished.catch(() => {}).finally(() => {
      if (themeTransition === transition) { root.classList.remove('native-theme-transition'); themeTransition = null; }
    });
  } else {
    syncTheme();
  }
  try { localStorage.setItem('astreis-theme', theme); } catch { /* Optional preference. */ }
});

const motionButton = document.querySelector('.motion-toggle');
function syncMotion() {
  motionButton.setAttribute('aria-pressed', String(scene.stopped));
  motionButton.disabled = scene.reduced;
  motionButton.querySelector('span').textContent = scene.reduced ? 'Reduced motion' : scene.paused ? 'Play animation' : 'Pause animation';
  motionButton.querySelector('use').setAttribute('href', scene.stopped ? '#i-play' : '#i-pause');
}
scene.onStateChange = syncMotion;
syncMotion();
motionButton.addEventListener('click', () => { scene.toggle(); syncMotion(); });

const screenshotDialog = document.querySelector('.screenshot-dialog');
const fullScreenshot = screenshotDialog.querySelector('img');
document.querySelectorAll('[data-preview]').forEach(button => button.addEventListener('click', () => {
  const source = button.classList.contains('screenshot-trigger')
    ? button.querySelector('img')
    : document.querySelector(theme === 'dark' ? '.home-dark' : '.home-light');
  fullScreenshot.src = source.src;
  fullScreenshot.alt = source.alt;
  document.querySelector('#screenshot-title').textContent = `Astreis — ${button.dataset.preview === 'ai' ? 'AI chat' : button.dataset.preview.charAt(0).toUpperCase() + button.dataset.preview.slice(1)}`;
  screenshotDialog.showModal();
  document.body.classList.add('dialog-open');
}));
screenshotDialog.querySelector('.screenshot-close').addEventListener('click', () => screenshotDialog.close());
screenshotDialog.addEventListener('click', event => { if (event.target === screenshotDialog) {
  const bounds = screenshotDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) screenshotDialog.close();
} });
screenshotDialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));

const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab, focus = false) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  }
  if (focus) tab.focus();
  // Keep the active tab in view on narrow screens without moving the page.
  const strip = tab.parentElement;
  const left = tab.offsetLeft - strip.offsetLeft;
  if (left < strip.scrollLeft || left + tab.offsetWidth > strip.scrollLeft + strip.clientWidth) {
    strip.scrollTo({ left: Math.max(0, left - 12), behavior: scene.reduced ? 'instant' : 'smooth' });
  }
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    const directions = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 };
    if (event.key in directions) { event.preventDefault(); selectTab(tabs[directions[event.key]], true); }
  });
});

const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('#mobile-nav');
function closeMenu() { menu.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Open navigation'); }
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menu.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', `${open ? 'Close' : 'Open'} navigation`);
});
menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { closeMenu(); menuButton.focus(); } });
document.addEventListener('click', event => { if (!menu.hidden && !menu.contains(event.target) && !menuButton.contains(event.target)) closeMenu(); });
matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

let toastTimer;
function toast(message) {
  const node = document.querySelector('.toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 3000);
}
document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
  const command = button.dataset.copy;
  try {
    await navigator.clipboard.writeText(command);
    toast('Installation command copied.');
  } catch {
    const code = button.previousElementSibling;
    const range = document.createRange();
    range.selectNodeContents(code);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    toast('Command selected. Press Ctrl+C or ⌘C to copy.');
  }
}));

// Load YouTube only after an explicit play action.
const trailerPlay = document.querySelector('.trailer-play');
trailerPlay?.addEventListener('click', () => {
  const frame = document.createElement('iframe');
  frame.src = 'https://www.youtube-nocookie.com/embed/domnL69Yfew?autoplay=1&rel=0';
  frame.title = 'Astreis official trailer';
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  trailerPlay.replaceWith(frame);
  frame.focus();
});

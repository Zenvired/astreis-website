const root = document.documentElement;
const favicon = document.querySelector('link[rel="icon"]');
const themeColor = document.querySelector('meta[name="theme-color"]');
const lightIcon = new URL('../assets/favicon.png', import.meta.url).href;
const darkIcon = new URL('../assets/favicon-dark.png', import.meta.url).href;

function readTheme() {
  try {
    return localStorage.getItem('astreis-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applySiteTheme(theme) {
  const dark = theme === 'dark';
  root.dataset.theme = theme;
  if (favicon) favicon.href = dark ? darkIcon : lightIcon;
  if (themeColor) themeColor.content = dark ? '#050912' : '#faf7f2';
}

export const initialTheme = readTheme();
applySiteTheme(initialTheme);

const STORAGE_KEY = 'mdspeaker-theme';

/** @typedef {'light'|'dark'} Theme */

/**
 * @returns {Theme}
 */
export function getPreferredTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * @param {Theme} theme
 */
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}

/**
 * @returns {Theme}
 */
export function toggleTheme() {
  const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

/**
 * @param {(theme: Theme) => void} onChange
 */
export function initTheme(onChange) {
  const theme = getPreferredTheme();
  applyTheme(theme);
  onChange?.(theme);
}

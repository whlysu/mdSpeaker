const CN_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/** Decorative status / color marks — never spoken (circles, cross, check) */
const SILENT_MARKS =
  /[\u{1F534}\u{1F7E0}\u{1F7E1}\u{1F7E2}\u{1F535}\u{1F7E3}\u{26AB}\u{26AA}\u{1F7E4}\u{274C}\u{2705}]\u{FE0F}?/gu;

/**
 * Convert a count to Chinese speech form for star ratings.
 * @param {number} n
 * @returns {string}
 */
function countToChinese(n) {
  if (n >= 1 && n <= 10) return CN_NUM[n];
  return String(n);
}

/**
 * Normalize text for TTS: star runs →「N星」, drop decorative marks.
 * Display DOM is unchanged; only speech segment text uses this.
 * @param {string} text
 * @returns {string}
 */
export function normalizeSpeechText(text) {
  if (!text) return '';

  let out = text;

  // Continuous ⭐ / ⭐️ → 一星 / 三星 / …
  out = out.replace(/(?:\u2B50\uFE0F?)+/g, (match) => {
    const count = match.replace(/\uFE0F/g, '').length;
    return `${countToChinese(count)}星`;
  });

  // Colored circles, ❌, ✅ silent
  out = out.replace(SILENT_MARKS, '');

  // Collapse whitespace left by removals
  out = out.replace(/\s+/g, ' ').trim();

  return out;
}

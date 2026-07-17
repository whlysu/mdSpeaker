/**
 * @typedef {object} PlaybackHandle
 * @property {() => void} pause
 * @property {() => void} resume
 * @property {() => void} stop
 * @property {Promise<void>} done
 */

/** @type {SpeechSynthesisUtterance|null} */
let currentUtterance = null;

/**
 * Convert rate string like "+0%" to Web Speech rate (0.1–10).
 * @param {string} rateStr
 * @returns {number}
 */
function parseRate(rateStr) {
  const match = rateStr.match(/([+-]?\d+)%/);
  if (!match) return 1;
  const pct = Number(match[1]);
  return Math.max(0.5, Math.min(2, 1 + pct / 100));
}

/**
 * Find voice by name or fall back to Chinese.
 * @param {string} [voiceName]
 * @returns {SpeechSynthesisVoice|null}
 */
function findVoice(voiceName) {
  const voices = speechSynthesis.getVoices();
  if (voiceName) {
    const match = voices.find((v) => v.name === voiceName || v.voiceURI === voiceName);
    if (match) return match;
  }
  return (
    voices.find((v) => v.lang.startsWith('zh-CN')) ??
    voices.find((v) => v.lang.startsWith('zh')) ??
    voices[0] ??
    null
  );
}

/**
 * Synthesize text via Web Speech API.
 * @param {string} text
 * @param {{ rate?: string, voice?: string }} options
 * @returns {Promise<PlaybackHandle>}
 */
export function speakWithWebSpeech(text, options = {}) {
  const { rate = '+0%', voice: voiceName } = options;

  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('浏览器不支持 Web Speech API'));
      return;
    }

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = parseRate(rate);

    const voice = findVoice(voiceName);
    if (voice) utterance.voice = voice;

    currentUtterance = utterance;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      currentUtterance = null;
    };

    utterance.onend = () => finish();
    utterance.onerror = (e) => {
      finish();
      reject(new Error(e.error ?? '语音合成失败'));
    };

    speechSynthesis.speak(utterance);

    resolve({
      pause: () => speechSynthesis.pause(),
      resume: () => speechSynthesis.resume(),
      stop: () => {
        speechSynthesis.cancel();
        finish();
      },
      done: new Promise((res) => {
        utterance.onend = () => {
          finish();
          res();
        };
        utterance.onerror = () => {
          finish();
          res();
        };
      }),
    });
  });
}

/**
 * Warm up voice list (Chrome loads voices asynchronously).
 */
export function warmUpWebSpeechVoices() {
  if (!window.speechSynthesis) return;
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}

/**
 * @returns {Array<{ id: string, label: string }>}
 */
export function listWebSpeechVoices() {
  return speechSynthesis
    .getVoices()
    .filter((v) => v.lang.startsWith('zh'))
    .map((v) => ({ id: v.name, label: `${v.name} (${v.lang})` }));
}

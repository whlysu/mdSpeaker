import {
  synthesizeEdgeBlobWithRetry,
  listEdgeServiceVoices,
} from './edge-client.js';

/**
 * @typedef {object} PlaybackHandle
 * @property {() => void} pause
 * @property {() => void} resume
 * @property {() => void} stop
 * @property {Promise<void>} done
 */

/**
 * Play an audio Blob and return a playback handle.
 * @param {Blob} blob
 * @returns {PlaybackHandle}
 */
export function playBlob(blob) {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  let revoked = false;

  const revoke = () => {
    if (revoked) return;
    revoked = true;
    URL.revokeObjectURL(url);
  };

  /** @type {{ resolve: () => void, reject: (e: Error) => void } | null} */
  let deferred = null;

  const done = new Promise((resolve, reject) => {
    deferred = { resolve, reject };
  });

  audio.onended = () => {
    revoke();
    deferred?.resolve();
  };

  audio.onerror = () => {
    revoke();
    deferred?.reject(new Error('音频播放失败'));
  };

  const playPromise = audio.play();

  return {
    pause: () => audio.pause(),
    resume: () => {
      audio.play().catch(() => {});
    },
    stop: () => {
      audio.pause();
      audio.currentTime = 0;
      revoke();
      deferred?.resolve();
    },
    done: playPromise.then(() => done).catch((err) => {
      revoke();
      throw err;
    }),
  };
}

/**
 * Synthesize text via Edge TTS and play as audio.
 * @param {string} text
 * @param {{ voice?: string, rate?: string }} options
 * @returns {Promise<PlaybackHandle>}
 */
export async function speakWithEdge(text, options = {}) {
  const blob = await synthesizeEdgeBlobWithRetry(text, options);
  return playBlob(blob);
}

/**
 * Prefetch synthesis (returns Blob for later playback).
 * @param {string} text
 * @param {{ voice?: string, rate?: string }} options
 * @returns {Promise<Blob>}
 */
export function prefetchEdge(text, options = {}) {
  return synthesizeEdgeBlobWithRetry(text, options);
}

/**
 * Probe whether Edge TTS is available.
 * @returns {Promise<boolean>}
 */
export async function probeEdgeTTS() {
  try {
    const blob = await synthesizeEdgeBlobWithRetry('测', {
      voice: 'zh-CN-XiaoxiaoNeural',
    }, 1);
    return blob.size > 0;
  } catch {
    return false;
  }
}

/**
 * List Chinese voices from Edge TTS.
 * @returns {Promise<Array<{ id: string, label: string }>>}
 */
export async function listEdgeVoices() {
  try {
    const voices = await listEdgeServiceVoices();
    return voices
      .filter((v) => v.Locale?.startsWith('zh'))
      .map((v) => ({
        id: v.ShortName,
        label: `${v.LocalName} (${v.Locale})`,
      }));
  } catch {
    return [];
  }
}

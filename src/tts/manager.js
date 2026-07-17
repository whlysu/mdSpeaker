import { isEdgeBrowser } from './detect.js';
import {
  speakWithEdge,
  probeEdgeTTS,
  listEdgeVoices,
  prefetchEdge,
  playBlob,
} from './edge-adapter.js';
import {
  speakWithWebSpeech,
  warmUpWebSpeechVoices,
  listWebSpeechVoices,
} from './web-adapter.js';
import { FALLBACK_VOICES, DEFAULT_VOICE } from '../speech/segments.js';

/** @typedef {'edge'|'web'} TTSEngine */

export class TTSManager {
  /** @type {TTSEngine} */
  engine = 'web';

  /** @type {boolean} */
  ready = false;

  /** @type {Array<{ id: string, label: string }>} */
  voices = FALLBACK_VOICES;

  /** @type {string} */
  selectedVoice = DEFAULT_VOICE;

  /** @type {import('./edge-adapter.js').PlaybackHandle|null} */
  currentHandle = null;

  /** @type {string} */
  rate = '+0%';

  async init() {
    warmUpWebSpeechVoices();

    // Prefer Edge TTS whenever the probe succeeds (best on Edge; may work elsewhere).
    const ok = await probeEdgeTTS();
    if (ok) {
      this.engine = 'edge';
      const edgeVoices = await listEdgeVoices();
      if (edgeVoices.length) {
        this.voices = edgeVoices;
      }
      this.ready = true;
      return this.engine;
    }

    if (isEdgeBrowser()) {
      console.warn('Edge TTS probe failed; falling back to Web Speech');
    }

    this.engine = 'web';
    const webVoices = listWebSpeechVoices();
    if (webVoices.length) {
      this.voices = webVoices;
      this.selectedVoice = webVoices[0].id;
    } else {
      this.selectedVoice = 'zh-CN';
    }
    this.ready = true;
    return this.engine;
  }

  /**
   * @returns {string}
   */
  getEngineLabel() {
    return this.engine === 'edge' ? 'Edge TTS' : 'Web Speech';
  }

  /**
   * Prefetch audio for a segment (Edge only). Returns null for Web Speech.
   * @param {string} text
   * @returns {Promise<Blob|null>}
   */
  async prefetch(text) {
    if (this.engine !== 'edge' || !text.trim()) return null;
    try {
      return await prefetchEdge(text, {
        voice: this.selectedVoice,
        rate: this.rate,
      });
    } catch (err) {
      console.warn('Prefetch failed:', err);
      return null;
    }
  }

  /**
   * Speak text. Optionally reuse a prefetched Edge blob.
   * @param {string} text
   * @param {{ prefetched?: Blob|null }} [opts]
   * @returns {Promise<import('./edge-adapter.js').PlaybackHandle>}
   */
  async speak(text, opts = {}) {
    if (this.engine === 'edge') {
      try {
        if (opts.prefetched) {
          this.currentHandle = playBlob(opts.prefetched);
        } else {
          this.currentHandle = await speakWithEdge(text, {
            voice: this.selectedVoice,
            rate: this.rate,
          });
        }
        return this.currentHandle;
      } catch (err) {
        console.warn('Edge TTS failed, falling back to Web Speech for this segment:', err);
        this.currentHandle = await speakWithWebSpeech(text, {
          rate: this.rate,
          voice: this.selectedVoice,
        });
        return this.currentHandle;
      }
    }

    this.currentHandle = await speakWithWebSpeech(text, {
      rate: this.rate,
      voice: this.selectedVoice,
    });
    return this.currentHandle;
  }

  pause() {
    this.currentHandle?.pause();
  }

  resume() {
    this.currentHandle?.resume();
  }

  stop() {
    this.currentHandle?.stop();
    this.currentHandle = null;
    if (this.engine === 'web') {
      speechSynthesis.cancel();
    }
  }

  /**
   * @param {string} voiceId
   */
  setVoice(voiceId) {
    this.selectedVoice = voiceId;
  }

  /**
   * @param {string} rate
   */
  setRate(rate) {
    this.rate = rate;
  }
}

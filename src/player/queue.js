import { setHighlight, clearHighlight } from './highlight.js';

/** @typedef {import('../speech/segments.js').SpeechSegment} SpeechSegment */

export class SpeechQueue {
  /**
   * @param {import('../tts/manager.js').TTSManager} tts
   * @param {HTMLElement} container
   * @param {(info: { index: number, total: number, segment: SpeechSegment | undefined, state: string }) => void} [onProgress]
   */
  constructor(tts, container, onProgress) {
    this.tts = tts;
    this.container = container;
    this.onProgress = onProgress ?? (() => {});

    /** @type {SpeechSegment[]} */
    this.segments = [];

    this.index = 0;
    this.state = 'idle';
    /** @type {AbortController|null} */
    this.abort = null;

    /** @type {Promise<void>|null} */
    this._playLoop = null;

    /** Monotonic id so an aborted play loop cannot clobber a newer seek/play. */
    this._generation = 0;
  }

  /**
   * @param {SpeechSegment[]} segments
   */
  load(segments) {
    this.stop();
    this.segments = segments;
    this.index = 0;
    this.onProgress({ index: 0, total: segments.length, segment: segments[0], state: 'idle' });
  }

  async play() {
    if (!this.segments.length) return;

    if (this.state === 'paused') {
      this.state = 'playing';
      this.tts.resume();
      this.onProgress({
        index: this.index,
        total: this.segments.length,
        segment: this.segments[this.index],
        state: 'playing',
      });
      return;
    }

    if (this.state === 'playing' && this._playLoop) {
      return;
    }

    const generation = ++this._generation;
    this.state = 'playing';
    this.abort = new AbortController();
    const signal = this.abort.signal;

    this._playLoop = this._runPlayLoop(signal, generation);
    await this._playLoop;
    if (generation === this._generation) {
      this._playLoop = null;
    }
  }

  /**
   * @param {AbortSignal} signal
   * @param {number} generation
   */
  async _runPlayLoop(signal, generation) {
    /** @type {Promise<Blob|null>|null} */
    let prefetchPromise = null;

    if (this.segments[this.index]) {
      prefetchPromise = this.tts.prefetch(this.segments[this.index].text);
    }

    for (; this.index < this.segments.length; this.index++) {
      if (signal.aborted || generation !== this._generation) break;
      if (this.state === 'stopped') break;

      const segment = this.segments[this.index];
      this.onProgress({
        index: this.index,
        total: this.segments.length,
        segment,
        state: 'playing',
      });

      setHighlight(this.container, segment.elementId ?? segment.id);

      try {
        const prefetched = prefetchPromise ? await prefetchPromise : null;
        if (generation !== this._generation || signal.aborted) break;
        prefetchPromise = null;

        const next = this.segments[this.index + 1];
        if (next && !signal.aborted && generation === this._generation) {
          prefetchPromise = this.tts.prefetch(next.text);
        }

        const handle = await this.tts.speak(segment.text, { prefetched });
        if (signal.aborted || generation !== this._generation) {
          handle.stop();
          break;
        }

        await Promise.race([handle.done, waitForAbort(signal)]);

        if (signal.aborted || generation !== this._generation || this.state === 'stopped') break;

        if (this.state === 'paused') {
          await waitUntilResumed(() => this.state);
          if (this.state === 'stopped' || generation !== this._generation) break;
        }

        if (segment.pauseAfter > 0) {
          await delay(segment.pauseAfter, signal);
        }
      } catch (err) {
        if (generation !== this._generation) break;
        console.error('Speech segment failed:', segment, err);
        prefetchPromise = null;
      }
    }

    // Only the active generation may finalize UI state
    if (generation !== this._generation) return;

    if (this.state !== 'stopped' && this.state !== 'paused') {
      this.state = 'idle';
      this.index = Math.min(this.index, Math.max(this.segments.length - 1, 0));
      if (this.index >= this.segments.length - 1) {
        this.index = 0;
        clearHighlight(this.container);
      }
      this.onProgress({
        index: this.index,
        total: this.segments.length,
        segment: this.segments[this.index],
        state: 'idle',
      });
    }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.tts.pause();
    this.onProgress({
      index: this.index,
      total: this.segments.length,
      segment: this.segments[this.index],
      state: 'paused',
    });
  }

  stop() {
    this._generation += 1;
    this.state = 'stopped';
    this.abort?.abort();
    this.tts.stop();
    clearHighlight(this.container);
    this.index = 0;
    this.state = 'idle';
    this._playLoop = null;
    this.onProgress({
      index: 0,
      total: this.segments.length,
      segment: this.segments[0],
      state: 'idle',
    });
  }

  /**
   * Jump to a segment and continue reading from there.
   * Always resumes playback from the target segment (prev / next / seek bar).
   * @param {number} index
   */
  async seekTo(index) {
    if (!this.segments.length) return;
    const clamped = Math.max(0, Math.min(index, this.segments.length - 1));

    // Invalidate any in-flight play loop, then start from the new segment
    this._generation += 1;
    this.abort?.abort();
    this.tts.stop();
    this._playLoop = null;

    this.index = clamped;
    const segment = this.segments[clamped];
    setHighlight(this.container, segment.elementId ?? segment.id);

    this.state = 'idle';
    this.onProgress({
      index: clamped,
      total: this.segments.length,
      segment,
      state: 'idle',
    });

    await this.play();
  }

  /**
   * @returns {Promise<void>}
   */
  prev() {
    return this.seekTo(this.index - 1);
  }

  /**
   * @returns {Promise<void>}
   */
  next() {
    return this.seekTo(this.index + 1);
  }
}

/**
 * @param {number} ms
 * @param {AbortSignal} signal
 */
function delay(ms, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(undefined);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
      { once: true },
    );
  });
}

/**
 * @param {AbortSignal} signal
 */
function waitForAbort(signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    signal.addEventListener('abort', resolve, { once: true });
  });
}

/**
 * @param {() => string} getState
 */
function waitUntilResumed(getState) {
  return new Promise((resolve) => {
    const check = () => {
      const state = getState();
      if (state === 'playing') resolve(undefined);
      else if (state === 'stopped') resolve(undefined);
      else setTimeout(check, 100);
    };
    check();
  });
}

/** @typedef {import('../speech/segments.js').SpeechSegment} SpeechSegment */

/**
 * Viewport-scoped seek rail: only ticks for speech blocks currently visible
 * inside the reader scroll area (overlay near the scrollbar).
 */
export class SeekBar {
  /**
   * @param {HTMLElement} root
   * @param {HTMLElement} scrollRoot
   * @param {HTMLElement} contentRoot
   * @param {(index: number) => void} onSeek
   */
  constructor(root, scrollRoot, contentRoot, onSeek) {
    this.root = root;
    this.scrollRoot = scrollRoot;
    this.contentRoot = contentRoot;
    this.onSeek = onSeek;

    /** @type {SpeechSegment[]} */
    this.segments = [];
    this.currentIndex = 0;
    this.playState = 'idle';

    /** @type {number} */
    this._raf = 0;

    this.root.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const tick = target.closest('[data-seek-index]');
      if (!(tick instanceof HTMLElement)) return;
      e.preventDefault();
      e.stopPropagation();
      const index = Number(tick.dataset.seekIndex);
      if (Number.isFinite(index)) this.onSeek(index);
    });

    this.scrollRoot.addEventListener(
      'scroll',
      () => this.scheduleUpdate(),
      { passive: true },
    );

    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this.scheduleUpdate());
      this._ro.observe(this.scrollRoot);
      this._ro.observe(this.contentRoot);
    } else {
      window.addEventListener('resize', () => this.scheduleUpdate());
    }
  }

  scheduleUpdate() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this.updateVisible();
    });
  }

  /**
   * @param {SpeechSegment[]} segments
   */
  setSegments(segments) {
    this.segments = segments;
    this.currentIndex = 0;
    this.playState = 'idle';
    this.updateVisible();
  }

  /**
   * @param {number} index
   * @param {string} [state]
   */
  setCurrent(index, state = 'idle') {
    this.currentIndex = index;
    this.playState = state;
    this.root.querySelectorAll('.seek-tick').forEach((el) => {
      const i = Number(/** @type {HTMLElement} */ (el).dataset.seekIndex);
      el.classList.toggle('is-current', i === index);
      el.classList.toggle('is-played', i < index);
      el.classList.toggle('is-playing', i === index && state === 'playing');
    });
  }

  clear() {
    this.segments = [];
    this.currentIndex = 0;
    this.playState = 'idle';
    this.root.innerHTML = '';
    this.root.hidden = true;
  }

  updateVisible() {
    if (!this.segments.length || this.contentRoot.hidden) {
      this.root.innerHTML = '';
      this.root.hidden = true;
      return;
    }

    const scrollTop = this.scrollRoot.scrollTop;
    const clientHeight = this.scrollRoot.clientHeight;
    const pad = 8;
    const gap = 10;
    const railWidth = 14;

    const readerRect = this.scrollRoot.getBoundingClientRect();
    const contentRect = this.contentRoot.getBoundingClientRect();

    // Stick to the right edge of #content, 10px gap (coords relative to .reader)
    let left =
      contentRect.right - readerRect.left + this.scrollRoot.scrollLeft + gap;
    const maxLeft = this.scrollRoot.clientWidth - railWidth - 4;
    if (left > maxLeft) left = Math.max(0, maxLeft);

    this.root.hidden = false;
    this.root.style.left = `${left}px`;
    this.root.style.right = 'auto';
    this.root.style.top = `${scrollTop + pad}px`;
    this.root.style.height = `${Math.max(clientHeight - pad * 2, 0)}px`;

    const viewport = readerRect;
    const railHeight = Math.max(clientHeight - pad * 2, 1);

    /** @type {Array<{ index: number, top: number, height: number, text: string }>} */
    const visible = [];

    this.segments.forEach((seg, index) => {
      const id = seg.elementId ?? seg.id;
      const el = this.contentRoot.querySelector(`[data-speech-id="${CSS.escape(id)}"]`);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const intersects = rect.bottom > viewport.top && rect.top < viewport.bottom;
      if (!intersects) return;

      const overlapTop = Math.max(rect.top, viewport.top);
      const overlapBottom = Math.min(rect.bottom, viewport.bottom);
      const overlapHeight = Math.max(overlapBottom - overlapTop, 0);
      if (overlapHeight < 2) return;

      const top = ((overlapTop - viewport.top) / clientHeight) * railHeight;
      const height = Math.max((overlapHeight / clientHeight) * railHeight, 6);

      visible.push({
        index,
        top,
        height: Math.min(height, railHeight - top),
        text: seg.text,
      });
    });

    this.root.innerHTML = '';

    if (!visible.length) return;

    visible.forEach((item) => {
      const tick = document.createElement('button');
      tick.type = 'button';
      tick.className = 'seek-tick';
      tick.dataset.seekIndex = String(item.index);
      tick.style.top = `${item.top}px`;
      tick.style.height = `${item.height}px`;
      tick.title = `${item.index + 1}/${this.segments.length} · ${item.text.slice(0, 60)}${item.text.length > 60 ? '…' : ''}`;
      tick.setAttribute('aria-label', `跳转到第 ${item.index + 1} 段`);

      if (item.index === this.currentIndex) {
        tick.classList.add('is-current');
        if (this.playState === 'playing') tick.classList.add('is-playing');
      }
      if (item.index < this.currentIndex) tick.classList.add('is-played');

      this.root.appendChild(tick);
    });
  }
}

/** @type {Element|null} */
let currentHighlight = null;

/**
 * Highlight the element with the given speech id.
 * @param {HTMLElement} container
 * @param {string|null} elementId
 */
export function setHighlight(container, elementId) {
  clearHighlight(container);

  if (!elementId) return;

  const el = container.querySelector(`[data-speech-id="${elementId}"]`);

  if (!el) return;

  el.classList.add('is-speaking');
  currentHighlight = el;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * @param {HTMLElement} container
 */
export function clearHighlight(container) {
  if (currentHighlight) {
    currentHighlight.classList.remove('is-speaking');
    currentHighlight = null;
  }
  container.querySelectorAll('.is-speaking').forEach((el) => {
    el.classList.remove('is-speaking');
  });
}

/**
 * Detect if the browser is Microsoft Edge.
 * @returns {boolean}
 */
export function isEdgeBrowser() {
  if (navigator.userAgentData?.brands) {
    return navigator.userAgentData.brands.some((b) => /edge/i.test(b.brand));
  }
  return /\bEdg\//.test(navigator.userAgent);
}

import { createSegment } from './segments.js';
import { normalizeSpeechText } from './normalize-text.js';

/**
 * Extract plain text from an element, stripping HTML tags, then normalize for TTS.
 * @param {Element} el
 * @returns {string}
 */
function textOf(el) {
  const raw = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return normalizeSpeechText(raw);
}

/**
 * Get header labels from a table.
 * @param {HTMLTableElement} table
 * @returns {string[]}
 */
function getTableHeaders(table) {
  const headerCells = table.querySelectorAll(
    'thead th, tr[data-speech-type="table-header"] th, tr[data-speech-type="table-header"] td',
  );
  if (headerCells.length) {
    return [...headerCells].map((c) => textOf(c));
  }
  const firstRow = table.querySelector('tr');
  if (firstRow) {
    return [...firstRow.querySelectorAll('th, td')].map((c) => textOf(c));
  }
  return [];
}

/**
 * Build speech segments from rendered markdown DOM.
 * Skips layout-only nodes (hr, code blocks, images).
 * @param {HTMLElement} container
 * @returns {import('./segments.js').SpeechSegment[]}
 */
export function planSpeechSegments(container) {
  /** @type {import('./segments.js').SpeechSegment[]} */
  const segments = [];
  const processedTables = new Set();

  const blockSelectors = [
    'h1[data-speech-id]',
    'h2[data-speech-id]',
    'h3[data-speech-id]',
    'h4[data-speech-id]',
    'h5[data-speech-id]',
    'h6[data-speech-id]',
    'p[data-speech-id]',
    'blockquote[data-speech-id]',
    'li[data-speech-id]',
    'table[data-speech-id]',
  ].join(', ');

  const blocks = container.querySelectorAll(blockSelectors);

  blocks.forEach((el) => {
    // Skip nested speech blocks (e.g. <p> inside <li> / <blockquote>)
    const ancestor = el.parentElement?.closest('[data-speech-id]');
    if (ancestor && ancestor !== el) return;

    const type = el.getAttribute('data-speech-type') ?? 'p';
    const id = el.getAttribute('data-speech-id') ?? `seg-${segments.length}`;

    if (type === 'table') {
      if (processedTables.has(el)) return;
      processedTables.add(el);
      segments.push(...planTableSegments(/** @type {HTMLTableElement} */ (el)));
      return;
    }

    if (type === 'li') {
      const listIndex = el.getAttribute('data-list-index');
      const content = textOf(el);
      if (!content) return;
      const prefix = listIndex ? `第 ${listIndex} 项，` : '';
      segments.push(createSegment(id, `${prefix}${content}`, 'li', id));
      return;
    }

    const content = textOf(el);
    if (!content) return;

    /** @type {import('./segments.js').SpeechBlockType} */
    const blockType = /** @type {import('./segments.js').SpeechBlockType} */ (type);
    segments.push(createSegment(id, content, blockType, id));
  });

  return segments.filter((s) => s.text.length > 0);
}

/**
 * @param {HTMLTableElement} table
 * @returns {import('./segments.js').SpeechSegment[]}
 */
function planTableSegments(table) {
  /** @type {import('./segments.js').SpeechSegment[]} */
  const segments = [];
  const tableId = table.getAttribute('data-speech-id') ?? 'table';

  const dataRows = table.querySelectorAll('tr[data-speech-type="table-row"]');
  const rowCount = dataRows.length;
  const headers = getTableHeaders(table);
  const colCount = headers.length;

  segments.push(
    createSegment(
      `${tableId}-intro`,
      `表格，共 ${rowCount} 行 ${colCount} 列`,
      'table-intro',
      tableId,
    ),
  );

  const headerRow = table.querySelector('tr[data-speech-type="table-header"]');
  if (headerRow && headers.length) {
    const headerText = `表头：${headers.join('，')}`;
    const headerId = headerRow.getAttribute('data-speech-id') ?? `${tableId}-header`;
    segments.push(createSegment(headerId, headerText, 'table-header', headerId));
  }

  dataRows.forEach((row) => {
    const rowIndex = row.getAttribute('data-row-index') ?? '?';
    const cells = [...row.querySelectorAll('td, th')].map((c) => textOf(c));
    const pairs = cells.map((cell, i) => {
      const header = headers[i] ?? `列 ${i + 1}`;
      return `${header} ${cell}`;
    });
    const rowId = row.getAttribute('data-speech-id') ?? `${tableId}-row-${rowIndex}`;
    segments.push(
      createSegment(rowId, `第 ${rowIndex} 行：${pairs.join('，')}`, 'table-row', rowId),
    );
  });

  return segments;
}

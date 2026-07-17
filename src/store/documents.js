/** @typedef {import('../speech/segments.js').SpeechSegment} SpeechSegment */

const STORAGE_KEY = 'mdspeaker-docs';

/**
 * @typedef {object} DocumentEntry
 * @property {string} id
 * @property {string} name
 * @property {string} markdown
 * @property {string} html
 * @property {SpeechSegment[]} segments
 * @property {number} scrollTop
 */

/**
 * @typedef {object} PersistedDoc
 * @property {string} id
 * @property {string} name
 * @property {string} markdown
 * @property {number} scrollTop
 */

/**
 * @typedef {object} PersistedState
 * @property {string|null} activeId
 * @property {number} nextId
 * @property {PersistedDoc[]} docs
 */

let nextId = 1;

/** @type {DocumentEntry[]} */
let documents = [];

/** @type {string|null} */
let activeId = null;

/** @type {((message: string) => void)|null} */
let onPersistError = null;

/**
 * @param {(message: string) => void} handler
 */
export function setPersistErrorHandler(handler) {
  onPersistError = handler;
}

/**
 * @returns {string}
 */
function createId() {
  const id = `doc-${nextId}`;
  nextId += 1;
  return id;
}

/**
 * Persist docs to localStorage (markdown only, not html/segments).
 * @returns {boolean}
 */
export function persist() {
  /** @type {PersistedState} */
  const payload = {
    activeId,
    nextId,
    docs: documents.map((d) => ({
      id: d.id,
      name: d.name,
      markdown: d.markdown,
      scrollTop: d.scrollTop,
    })),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    const msg =
      err instanceof Error && /quota/i.test(err.name + err.message)
        ? '文档过大，无法保存到本地（配额不足）'
        : '保存文档列表失败';
    console.warn(msg, err);
    onPersistError?.(msg);
    return false;
  }
}

/**
 * Load persisted metadata from localStorage (without rebuilding html).
 * @returns {PersistedState|null}
 */
export function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.docs)) return null;
    return {
      activeId: data.activeId ?? null,
      nextId: typeof data.nextId === 'number' ? data.nextId : 1,
      docs: data.docs.filter(
        (d) => d && typeof d.id === 'string' && typeof d.markdown === 'string',
      ),
    };
  } catch {
    return null;
  }
}

/**
 * Apply restored entries into memory (caller builds html/segments).
 * @param {DocumentEntry[]} entries
 * @param {string|null} restoredActiveId
 * @param {number} restoredNextId
 */
export function applyRestoredDocuments(entries, restoredActiveId, restoredNextId) {
  documents = entries;
  nextId = restoredNextId;
  activeId =
    restoredActiveId && entries.some((e) => e.id === restoredActiveId)
      ? restoredActiveId
      : entries[0]?.id ?? null;
}

/**
 * @param {string} name
 * @param {string} markdown
 * @param {string} html
 * @param {SpeechSegment[]} segments
 * @returns {DocumentEntry}
 */
export function addDocument(name, markdown, html, segments) {
  const entry = {
    id: createId(),
    name,
    markdown,
    html,
    segments,
    scrollTop: 0,
  };
  documents.push(entry);
  activeId = entry.id;
  persist();
  return entry;
}

/**
 * @returns {DocumentEntry[]}
 */
export function getDocuments() {
  return documents;
}

/**
 * @returns {DocumentEntry|null}
 */
export function getActiveDocument() {
  return documents.find((d) => d.id === activeId) ?? null;
}

/**
 * @param {string} id
 * @returns {DocumentEntry|null}
 */
export function getDocument(id) {
  return documents.find((d) => d.id === id) ?? null;
}

/**
 * @param {string} id
 * @returns {DocumentEntry|null}
 */
export function setActiveDocument(id) {
  const doc = documents.find((d) => d.id === id);
  if (!doc) return null;
  activeId = id;
  persist();
  return doc;
}

/**
 * @param {string} id
 * @param {number} scrollTop
 */
export function saveScrollPosition(id, scrollTop) {
  const doc = documents.find((d) => d.id === id);
  if (doc) {
    doc.scrollTop = scrollTop;
    persist();
  }
}

/**
 * @param {string} id
 */
export function removeDocument(id) {
  const index = documents.findIndex((d) => d.id === id);
  if (index === -1) return;

  documents.splice(index, 1);

  if (activeId === id) {
    activeId = documents[Math.min(index, documents.length - 1)]?.id ?? null;
  }
  persist();
}

/**
 * Clear all documents and remove localStorage.
 */
export function clearAll() {
  documents = [];
  activeId = null;
  nextId = 1;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @returns {string|null}
 */
export function getActiveId() {
  return activeId;
}

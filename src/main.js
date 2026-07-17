import { readMarkdownFile, getMarkdownFilesFromDrop } from './md/loader.js';
import { renderMarkdown, normalizeTableStructure } from './md/renderer.js';
import { planSpeechSegments } from './speech/planner.js';
import { TTSManager } from './tts/manager.js';
import { SpeechQueue } from './player/queue.js';
import { SeekBar } from './player/seekbar.js';
import { DEFAULT_VOICE } from './speech/segments.js';
import {
  addDocument,
  applyRestoredDocuments,
  clearAll,
  getActiveDocument,
  getActiveId,
  getDocuments,
  loadPersistedState,
  removeDocument,
  saveScrollPosition,
  setActiveDocument,
  setPersistErrorHandler,
} from './store/documents.js';
import { initTheme, toggleTheme } from './theme.js';

const fileInput = /** @type {HTMLInputElement} */ (document.getElementById('file-input'));
const btnPlay = /** @type {HTMLButtonElement} */ (document.getElementById('btn-play'));
const btnPause = /** @type {HTMLButtonElement} */ (document.getElementById('btn-pause'));
const btnStop = /** @type {HTMLButtonElement} */ (document.getElementById('btn-stop'));
const btnPrev = /** @type {HTMLButtonElement} */ (document.getElementById('btn-prev'));
const btnNext = /** @type {HTMLButtonElement} */ (document.getElementById('btn-next'));
const btnTheme = /** @type {HTMLButtonElement} */ (document.getElementById('btn-theme'));
const btnClearDocs = /** @type {HTMLButtonElement} */ (document.getElementById('btn-clear-docs'));
const rateSelect = /** @type {HTMLSelectElement} */ (document.getElementById('rate-select'));
const voiceSelect = /** @type {HTMLSelectElement} */ (document.getElementById('voice-select'));
const engineBadge = /** @type {HTMLElement} */ (document.getElementById('engine-badge'));
const dropZone = /** @type {HTMLElement} */ (document.getElementById('drop-zone'));
const emptyState = /** @type {HTMLElement} */ (document.getElementById('empty-state'));
const content = /** @type {HTMLElement} */ (document.getElementById('content'));
const progressText = /** @type {HTMLElement} */ (document.getElementById('progress-text'));
const fileList = /** @type {HTMLUListElement} */ (document.getElementById('file-list'));
const fileListEmpty = /** @type {HTMLElement} */ (document.getElementById('file-list-empty'));
const docCount = /** @type {HTMLElement} */ (document.getElementById('doc-count'));
const seekRail = /** @type {HTMLElement} */ (document.getElementById('seek-rail'));

const tts = new TTSManager();
const queue = new SpeechQueue(tts, content, updateProgress);
const seekBar = new SeekBar(seekRail, dropZone, content, (index) => {
  queue.seekTo(index);
});

setPersistErrorHandler((msg) => {
  progressText.textContent = msg;
});

/**
 * @param {{ index: number, total: number, segment: import('./speech/segments.js').SpeechSegment | undefined, state: string }} info
 */
function updateProgress({ index, total, segment, state }) {
  const hasDoc = !content.hidden && total > 0;
  const atStart = index <= 0;
  const atEnd = index >= total - 1;

  btnPrev.disabled = !hasDoc || atStart;
  btnNext.disabled = !hasDoc || atEnd || total === 0;

  if (hasDoc) {
    seekBar.setCurrent(Math.min(index, Math.max(total - 1, 0)), state);
  }

  if (state === 'idle') {
    progressText.textContent = total ? `就绪 · 第 ${Math.min(index + 1, total)} / ${total} 段` : '就绪';
    btnPlay.disabled = !hasDoc;
    btnPause.disabled = true;
    btnStop.disabled = true;
    return;
  }
  if (state === 'paused') {
    progressText.textContent = `已暂停 · ${index + 1} / ${total}`;
    btnPlay.disabled = false;
    btnPause.disabled = true;
    btnStop.disabled = false;
    return;
  }
  const preview = segment?.text?.slice(0, 40) ?? '';
  progressText.textContent = `朗读中 ${index + 1} / ${total}：${preview}${preview.length >= 40 ? '…' : ''}`;
  btnPlay.disabled = true;
  btnPause.disabled = false;
  btnStop.disabled = false;
}

function populateVoices() {
  voiceSelect.innerHTML = '';
  tts.voices.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.label;
    if (v.id === DEFAULT_VOICE || v.id === tts.selectedVoice) {
      opt.selected = true;
    }
    voiceSelect.appendChild(opt);
  });
  voiceSelect.disabled = false;
}

function updateEngineBadge() {
  engineBadge.textContent = tts.getEngineLabel();
  engineBadge.classList.toggle('web', tts.engine === 'web');
}

function updateThemeButton(theme) {
  btnTheme.textContent = theme === 'dark' ? '☀️' : '🌙';
  btnTheme.title = theme === 'dark' ? '切换为明亮模式' : '切换为深色模式';
}

function renderFileList() {
  const docs = getDocuments();
  const activeId = getActiveId();

  docCount.textContent = String(docs.length);
  fileListEmpty.hidden = docs.length > 0;
  btnClearDocs.disabled = docs.length === 0;
  fileList.innerHTML = '';

  docs.forEach((doc) => {
    const li = document.createElement('li');
    li.className = 'file-list-item';
    if (doc.id === activeId) li.classList.add('active');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'file-list-btn';
    btn.dataset.id = doc.id;
    btn.title = doc.name;

    const name = document.createElement('span');
    name.className = 'file-list-name';
    name.textContent = doc.name;

    const meta = document.createElement('span');
    meta.className = 'file-list-meta';
    meta.textContent = `${doc.segments.length} 段`;

    btn.append(name, meta);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'file-list-close';
    closeBtn.title = '关闭';
    closeBtn.dataset.id = doc.id;
    closeBtn.textContent = '×';

    li.append(btn, closeBtn);
    fileList.appendChild(li);
  });
}

function persistScrollPosition() {
  const activeId = getActiveId();
  if (activeId) {
    saveScrollPosition(activeId, dropZone.scrollTop);
  }
}

/**
 * Build html + segments from markdown source.
 * @param {string} markdown
 * @returns {{ html: string, segments: import('./speech/segments.js').SpeechSegment[] }}
 */
function buildFromMarkdown(markdown) {
  const wrapper = document.createElement('article');
  wrapper.innerHTML = renderMarkdown(markdown);
  normalizeTableStructure(wrapper);
  const segments = planSpeechSegments(wrapper);
  return { html: wrapper.innerHTML, segments };
}

function displayDocument(docId) {
  const currentId = getActiveId();
  if (currentId && currentId !== docId) {
    saveScrollPosition(currentId, dropZone.scrollTop);
  }

  queue.stop();

  const doc = setActiveDocument(docId);
  if (!doc) {
    showEmptyState();
    renderFileList();
    return;
  }

  content.innerHTML = doc.html;
  normalizeTableStructure(content);

  emptyState.hidden = true;
  content.hidden = false;

  queue.load(doc.segments);
  seekBar.setSegments(doc.segments);
  btnPlay.disabled = doc.segments.length === 0;
  progressText.textContent = `已加载 · 共 ${doc.segments.length} 段`;

  renderFileList();

  requestAnimationFrame(() => {
    dropZone.scrollTop = doc.scrollTop;
  });
}

function showEmptyState() {
  content.innerHTML = '';
  content.hidden = true;
  emptyState.hidden = false;
  btnPlay.disabled = true;
  btnPrev.disabled = true;
  btnNext.disabled = true;
  progressText.textContent = '就绪';
  queue.load([]);
  seekBar.clear();
}

async function importFile(file) {
  const { name, text } = await readMarkdownFile(file);
  const { html, segments } = buildFromMarkdown(text);
  const entry = addDocument(name, text, html, segments);
  displayDocument(entry.id);
  return entry;
}

async function loadDocuments(files) {
  const mdFiles = [...files].filter(
    (f) => f.name.match(/\.(md|markdown)$/i) || f.type === 'text/markdown',
  );
  if (!mdFiles.length) {
    progressText.textContent = '未找到 Markdown 文件';
    return;
  }

  try {
    let lastEntry = null;
    for (const file of mdFiles) {
      lastEntry = await importFile(file);
    }
    if (lastEntry) {
      progressText.textContent = `已加载 ${mdFiles.length} 个文档 · 当前：${lastEntry.name}`;
    }
  } catch (err) {
    progressText.textContent = err instanceof Error ? err.message : '加载失败';
  }
}

function closeDocument(docId) {
  const wasActive = getActiveId() === docId;
  persistScrollPosition();
  removeDocument(docId);
  renderFileList();

  if (wasActive) {
    const active = getActiveDocument();
    if (active) {
      displayDocument(active.id);
    } else {
      showEmptyState();
    }
  }
}

function clearAllDocuments() {
  if (!getDocuments().length) return;
  if (!window.confirm('确定清空全部文档列表？此操作不可撤销。')) return;
  queue.stop();
  clearAll();
  showEmptyState();
  renderFileList();
  progressText.textContent = '已清空文档列表';
}

/**
 * Restore documents from localStorage.
 */
function restoreDocuments() {
  const state = loadPersistedState();
  if (!state?.docs.length) return;

  const entries = state.docs.map((d) => {
    const { html, segments } = buildFromMarkdown(d.markdown);
    return {
      id: d.id,
      name: d.name,
      markdown: d.markdown,
      html,
      segments,
      scrollTop: d.scrollTop ?? 0,
    };
  });

  applyRestoredDocuments(entries, state.activeId, state.nextId);

  const active = getActiveDocument();
  if (active) {
    // Avoid double-persist from setActiveDocument during display
    content.innerHTML = active.html;
    normalizeTableStructure(content);
    emptyState.hidden = true;
    content.hidden = false;
    queue.load(active.segments);
    seekBar.setSegments(active.segments);
    btnPlay.disabled = active.segments.length === 0;
    progressText.textContent = `已还原 · ${entries.length} 个文档 · 当前：${active.name}`;
    renderFileList();
    requestAnimationFrame(() => {
      dropZone.scrollTop = active.scrollTop;
    });
  } else {
    renderFileList();
  }
}

fileInput.addEventListener('change', () => {
  const files = fileInput.files;
  if (files?.length) loadDocuments(files);
  fileInput.value = '';
});

btnPlay.addEventListener('click', () => {
  queue.play();
});

btnPause.addEventListener('click', () => {
  queue.pause();
});

btnStop.addEventListener('click', () => {
  queue.stop();
});

btnPrev.addEventListener('click', () => {
  queue.prev();
});

btnNext.addEventListener('click', () => {
  queue.next();
});

btnClearDocs.addEventListener('click', () => {
  clearAllDocuments();
});

btnTheme.addEventListener('click', () => {
  updateThemeButton(toggleTheme());
});

rateSelect.addEventListener('change', () => {
  tts.setRate(rateSelect.value);
});

voiceSelect.addEventListener('change', () => {
  tts.setVoice(voiceSelect.value);
});

fileList.addEventListener('click', (e) => {
  const target = /** @type {HTMLElement} */ (e.target);
  const closeBtn = target.closest('.file-list-close');
  if (closeBtn instanceof HTMLElement && closeBtn.dataset.id) {
    closeDocument(closeBtn.dataset.id);
    return;
  }

  const itemBtn = target.closest('.file-list-btn');
  if (itemBtn instanceof HTMLElement && itemBtn.dataset.id) {
    if (itemBtn.dataset.id !== getActiveId()) {
      displayDocument(itemBtn.dataset.id);
    }
  }
});

let scrollPersistTimer = 0;
dropZone.addEventListener('scroll', () => {
  clearTimeout(scrollPersistTimer);
  scrollPersistTimer = window.setTimeout(() => persistScrollPosition(), 200);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const files = getMarkdownFilesFromDrop(e.dataTransfer);
  if (files.length) loadDocuments(files);
});

async function init() {
  initTheme(updateThemeButton);
  engineBadge.textContent = '检测引擎…';
  await tts.init();
  updateEngineBadge();
  populateVoices();
  restoreDocuments();
  renderFileList();
  if (!getDocuments().length) {
    progressText.textContent = '就绪';
  }
}

init();

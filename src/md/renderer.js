import { Marked } from 'marked';

let speechCounter = 0;

function nextId(prefix) {
  speechCounter += 1;
  return `${prefix}-${speechCounter}`;
}

function resetIds() {
  speechCounter = 0;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapBlock(tag, attrs, inner) {
  return `<${tag} ${attrs}>${inner}</${tag}>`;
}

/**
 * Create a marked instance with custom renderer that injects speech IDs.
 * Inline markdown (bold/italic/links/code) is parsed via tokens, not raw text.
 */
export function createMarkdownRenderer() {
  resetIds();
  const marked = new Marked({ gfm: true, breaks: false });

  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const id = nextId('h');
        const tag = `h${depth}`;
        const inner = this.parser.parseInline(tokens);
        return wrapBlock(
          tag,
          `data-speech-id="${id}" data-speech-type="${tag}"`,
          inner,
        );
      },

      paragraph({ tokens }) {
        const id = nextId('p');
        const inner = this.parser.parseInline(tokens);
        return wrapBlock('p', `data-speech-id="${id}" data-speech-type="p"`, inner);
      },

      blockquote({ tokens }) {
        const id = nextId('bq');
        const inner = this.parser.parse(tokens);
        return wrapBlock(
          'blockquote',
          `data-speech-id="${id}" data-speech-type="blockquote"`,
          inner,
        );
      },

      list(token) {
        const tag = token.ordered ? 'ol' : 'ul';
        const startAttr = token.ordered && token.start !== 1 ? ` start="${token.start}"` : '';
        const body = token.items
          .map((item, index) => {
            const id = nextId('li');
            const prefix = token.ordered ? String((token.start ?? 1) + index) : '';
            const orderAttr = token.ordered ? ` data-list-index="${prefix}"` : '';
            const inner = this.parser.parse(item.tokens);
            const task = item.task
              ? `<input type="checkbox" disabled${item.checked ? ' checked' : ''}> `
              : '';
            return `<li data-speech-id="${id}" data-speech-type="li"${orderAttr}>${task}${inner}</li>`;
          })
          .join('');
        return `<${tag}${startAttr}>${body}</${tag}>`;
      },

      code({ text, lang }) {
        const id = nextId('pre');
        const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
        return `<pre data-speech-id="${id}" data-speech-type="pre" data-speech-skip="true"><code${langClass}>${escapeHtml(text)}</code></pre>`;
      },

      hr() {
        // Layout-only: no speech id, never read aloud
        return '<hr data-speech-skip="true" />';
      },

      table(token) {
        const tableId = nextId('table');
        const headerCells = token.header.map((cell, i) => {
          const cellId = nextId('th');
          const inner = this.parser.parseInline(cell.tokens);
          return `<th data-speech-id="${cellId}" data-speech-type="th" data-col-index="${i}">${inner}</th>`;
        });

        const headerRowId = nextId('tr-h');
        const headerHtml = `<thead><tr data-speech-id="${headerRowId}" data-speech-type="table-header">${headerCells.join('')}</tr></thead>`;

        const bodyHtml = token.rows
          .map((row, rowIndex) => {
            const rowId = nextId('tr');
            const cells = row.map((cell, colIndex) => {
              const cellId = nextId('td');
              const inner = this.parser.parseInline(cell.tokens);
              return `<td data-speech-id="${cellId}" data-speech-type="td" data-col-index="${colIndex}">${inner}</td>`;
            });
            return `<tr data-speech-id="${rowId}" data-speech-type="table-row" data-row-index="${rowIndex + 1}">${cells.join('')}</tr>`;
          })
          .join('');

        return `<table data-speech-id="${tableId}" data-speech-type="table">${headerHtml}<tbody>${bodyHtml}</tbody></table>`;
      },

      html({ text }) {
        return text;
      },

      image({ href, title, text }) {
        const alt = text || title || '图片';
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        // Layout/media: display only, do not speak
        return `<figure data-speech-skip="true"><img src="${href}" alt="${escapeHtml(alt)}"${titleAttr} /></figure>`;
      },
    },
  });

  return marked;
}

/**
 * Strip YAML frontmatter if present.
 * @param {string} markdown
 * @returns {string}
 */
export function stripFrontmatter(markdown) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

/**
 * Render markdown string to HTML with speech annotations.
 * @param {string} markdown
 * @returns {string}
 */
export function renderMarkdown(markdown) {
  const marked = createMarkdownRenderer();
  return marked.parse(stripFrontmatter(markdown));
}

/**
 * Ensure thead/tbody separation for planner.
 * @param {HTMLElement} container
 */
export function normalizeTableStructure(container) {
  container.querySelectorAll('table').forEach((table) => {
    const firstRow = table.querySelector('tr[data-speech-type="table-header"]');
    if (!firstRow) return;

    let thead = table.querySelector('thead');
    if (!thead) {
      thead = document.createElement('thead');
      thead.appendChild(firstRow);
      table.insertBefore(thead, table.firstChild);
    }

    let tbody = table.querySelector('tbody');
    if (!tbody) {
      tbody = document.createElement('tbody');
      table.querySelectorAll('tr[data-speech-type="table-row"]').forEach((row) => {
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
    }
  });
}

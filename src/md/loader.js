/**
 * Read a local Markdown file and return its text content.
 * @param {File} file
 * @returns {Promise<{ name: string, text: string }>}
 */
export function readMarkdownFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.name.match(/\.(md|markdown)$/i) && file.type !== 'text/markdown') {
      reject(new Error('请选择 .md 或 .markdown 文件'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      resolve({ name: file.name, text: String(reader.result ?? '') });
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * @param {DataTransfer} dataTransfer
 * @returns {File[]}
 */
export function getMarkdownFilesFromDrop(dataTransfer) {
  return [...dataTransfer.files].filter((f) => f.name.match(/\.(md|markdown)$/i));
}

/**
 * @param {DataTransfer} dataTransfer
 * @returns {File|null}
 */
export function getMarkdownFromDrop(dataTransfer) {
  return getMarkdownFilesFromDrop(dataTransfer)[0] ?? null;
}

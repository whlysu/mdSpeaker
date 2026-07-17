import { readFileSync } from 'fs';
import { renderMarkdown } from '../src/md/renderer.js';

const md = readFileSync(new URL('../../videos/sdd-best-practices/STORYBOARD.md', import.meta.url), 'utf8');
const html = renderMarkdown(md);
const count = (html.match(/data-speech-id=/g) ?? []).length;
const headings = (html.match(/data-speech-type="h[1-6]"/g) ?? []).length;
console.log('STORYBOARD speech blocks:', count);
console.log('headings:', headings);
console.log('ok:', count > 50 && headings >= 10);

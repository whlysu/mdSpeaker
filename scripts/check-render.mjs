import { renderMarkdown } from '../src/md/renderer.js';
import { planSpeechSegments } from '../src/speech/planner.js';

const md = `Hello **bold** and *italic*

---

Next para with \`code\`

\`\`\`
code block
\`\`\`

| A | B |
|---|---|
| 1 | 2 |
`;

const html = renderMarkdown(md);
console.log(html);
console.log('has strong:', html.includes('<strong>bold</strong>'));
console.log('has em:', html.includes('<em>italic</em>'));
console.log('hr skip:', /<hr[^>]*data-speech-skip/.test(html));
console.log('no hr speech type:', !/data-speech-type="hr"/.test(html));
console.log('pre skip:', /pre[^>]*data-speech-skip/.test(html));

// Minimal DOM for planner using linkedom-like regex count
const speechTypes = [...html.matchAll(/data-speech-type="([^"]+)"/g)].map((m) => m[1]);
console.log('speech types:', speechTypes);
console.log('ok:', html.includes('<strong>bold</strong>') && !/data-speech-type="hr"/.test(html));

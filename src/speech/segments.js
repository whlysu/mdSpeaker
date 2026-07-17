/** @typedef {'h1'|'h2'|'h3'|'h4'|'h5'|'h6'|'p'|'blockquote'|'li'|'table-intro'|'table-header'|'table-row'} SpeechBlockType */

/** Pause durations in milliseconds after each segment (kept short; Edge TTS latency already adds gaps) */
export const PAUSES = {
  h1: 450,
  h2: 400,
  h3: 350,
  h4: 300,
  h5: 280,
  h6: 260,
  p: 120,
  blockquote: 180,
  li: 100,
  'table-intro': 180,
  'table-header': 180,
  'table-row': 120,
};

export const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural';

export const FALLBACK_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (zh-CN)' },
  { id: 'zh-CN-YunxiNeural', label: '云希 (zh-CN)' },
  { id: 'zh-CN-YunyangNeural', label: '云扬 (zh-CN)' },
  { id: 'zh-CN-XiaoyiNeural', label: '晓伊 (zh-CN)' },
];

/**
 * @typedef {object} SpeechSegment
 * @property {string} id
 * @property {string} text
 * @property {SpeechBlockType} type
 * @property {number} pauseAfter
 * @property {string} [elementId]
 */

export function createSegment(id, text, type, elementId) {
  return {
    id,
    text: text.trim(),
    type,
    pauseAfter: PAUSES[type] ?? 120,
    elementId,
  };
}

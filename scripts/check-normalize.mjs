import { normalizeSpeechText } from '../src/speech/normalize-text.js';

const cases = [
  ['评级 ⭐⭐⭐ 🔵 通过', '评级 三星 通过'],
  ['⭐', '一星'],
  ['⭐⭐⭐⭐⭐', '五星'],
  ['⭐️⭐️⭐️⭐', '四星'],
  ['⭐️⭐️⭐️', '三星'],
  ['⭐️⭐️', '二星'],
  ['状态 🟠 待审 🟢 通过', '状态 待审 通过'],
  ['🔴🟠🟡🟢🔵🟣⚫⚪🟤', ''],
  ['❌ 失败 ✅ 成功', '失败 成功'],
  ['普通文字无符号', '普通文字无符号'],
  ['十二级 ⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐', '十二级 12星'],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = normalizeSpeechText(input);
  const ok = got === expected;
  console.log(ok ? 'ok' : 'FAIL', JSON.stringify(input), '=>', JSON.stringify(got), ok ? '' : `(want ${JSON.stringify(expected)})`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`normalize-text: ${failed} failed`);
  process.exit(1);
}
console.log('normalize-text: all passed');

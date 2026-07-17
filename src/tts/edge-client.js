/**
 * Browser Edge TTS client using Microsoft Edge Cognitive Services endpoint.
 * Prefer api.msedgeservices.com over the legacy speech.platform.bing.com host.
 */

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL =
  'wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1';
const VOICES_URL =
  'https://api.msedgeservices.com/tts/cognitiveservices/voices/list';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH = 11644473600;
const CONNECT_TIMEOUT_MS = 8000;
const SYNTH_TIMEOUT_MS = 20000;

let clockSkewSeconds = 0;

function generateUUID() {
  return crypto.randomUUID().replace(/-/g, '');
}

function generateMuid() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

async function generateSecMsGec() {
  let ticks = Date.now() / 1000 + clockSkewSeconds;
  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= 1e9 / 100;
  const data = new TextEncoder().encode(`${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function findInArray(arr, pattern) {
  for (let i = 0; i <= arr.length - pattern.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (arr[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createSSML(text, voice, rate = '+0%', pitch = '+0Hz', volume = '+0%') {
  const escaped = escapeXml(text);
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">` +
    `<voice name="${voice}">` +
    `<prosody pitch="${pitch}" rate="${rate}" volume="${volume}">${escaped}</prosody>` +
    `</voice></speak>`
  );
}

function buildConfigMessage() {
  const timestamp = new Date().toUTCString();
  return (
    `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
    `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":false},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
  );
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Synthesize text to an audio Blob via Edge TTS WebSocket.
 * @param {string} text
 * @param {{ voice?: string, rate?: string }} options
 * @returns {Promise<Blob>}
 */
export async function synthesizeEdgeBlob(text, options = {}) {
  const { voice = 'zh-CN-XiaoxiaoNeural', rate = '+0%' } = options;
  const secMsGEC = await generateSecMsGec();
  const reqId = generateUUID();
  const url =
    `${WSS_URL}?Ocp-Apim-Subscription-Key=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${reqId}`;

  const audioChunks = [];

  await withTimeout(
    new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      let settled = false;

      const finish = (err) => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        if (err) reject(err);
        else resolve(undefined);
      };

      const connectTimer = setTimeout(() => {
        finish(new Error('Edge TTS WebSocket connect timeout'));
      }, CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        clearTimeout(connectTimer);
        ws.send(buildConfigMessage());
        const timestamp = new Date().toUTCString();
        const ssml = createSSML(text, voice, rate);
        ws.send(
          `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${timestamp}\r\nPath:ssml\r\n\r\n${ssml}`,
        );
      };

      ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          if (event.data.includes('Path:turn.end')) {
            finish();
          }
          return;
        }

        try {
          const buffer =
            event.data instanceof ArrayBuffer
              ? event.data
              : await /** @type {Blob} */ (event.data).arrayBuffer();
          const uint8 = new Uint8Array(buffer);
          const needle = new TextEncoder().encode('Path:audio\r\n');
          const idx = findInArray(uint8, needle);
          if (idx !== -1) {
            audioChunks.push(uint8.slice(idx + needle.length));
          }
        } catch (err) {
          finish(err instanceof Error ? err : new Error(String(err)));
        }
      };

      ws.onerror = () => finish(new Error('Edge TTS WebSocket error'));
      ws.onclose = () => {
        clearTimeout(connectTimer);
        if (!settled) finish();
      };
    }),
    SYNTH_TIMEOUT_MS,
    'Edge TTS synthesis',
  );

  if (!audioChunks.length) {
    throw new Error('Edge TTS returned no audio');
  }

  const total = audioChunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of audioChunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new Blob([merged], { type: 'audio/mpeg' });
}

/**
 * @param {string} text
 * @param {{ voice?: string, rate?: string }} options
 * @param {number} [retries]
 * @returns {Promise<Blob>}
 */
export async function synthesizeEdgeBlobWithRetry(text, options = {}, retries = 2) {
  let lastError = /** @type {Error|null} */ (null);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await synthesizeEdgeBlob(text, options);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }
  throw lastError ?? new Error('Edge TTS failed');
}

/**
 * @returns {Promise<Array<{ ShortName: string, LocalName: string, Locale: string, Gender: string }>>}
 */
export async function listEdgeServiceVoices() {
  const secMsGEC = await generateSecMsGec();
  const url =
    `${VOICES_URL}?Ocp-Apim-Subscription-Key=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${secMsGEC}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;

  const response = await withTimeout(
    fetch(url, {
      headers: {
        Accept: '*/*',
        Cookie: `MUID=${generateMuid()}`,
      },
    }),
    CONNECT_TIMEOUT_MS,
    'Edge TTS voices',
  );

  if (!response.ok) {
    const date = response.headers.get('Date');
    if (date) {
      const server = new Date(date).getTime() / 1000;
      if (!Number.isNaN(server)) {
        clockSkewSeconds += server - Date.now() / 1000;
      }
    }
    throw new Error(`Voice list failed: ${response.status}`);
  }

  return response.json();
}

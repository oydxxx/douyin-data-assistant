const MAX_RECORDS = 200;
const MAX_RESPONSE_CHARS = 2_000_000;
const HANDOFF_DELAY_MS = 1_500;
const CAPTURE_VERSION = 2;
const sessions = new Map();
let handoffTimer;

function isDouyinApi(url, type) {
  return url.startsWith('https://creator.douyin.com/') &&
    (type === 'XHR' || type === 'Fetch');
}

// 只接受“关联词列表 + 指标”的响应。不要再因为 URL 中含有 api 就整包保存。
const ASSOCIATION_URL_HINT = /related|relation|associate|correl|relevance|keyword|search(?:[-_]?word)?|arithmetic-index/i;
const ASSOCIATION_PAYLOAD_HINT = /related|relation|associate|correl|relevance|\u5173\u8054|\u76f8\u5173|\u5173\u952e\u8bcd/i;
const TERM_FIELD_HINT = /(^|[_-])(related_?)?(word|keyword|query|term|search_word)([_-]|$)|\u5173\u8054\u8bcd|\u5173\u952e\u8bcd|\u8bcd\u6761/i;
const METRIC_FIELD_HINT = /index|score|relevance|rank|count|heat|hot|trend|\u6307\u6570|\u70ed\u5ea6|\u76f8\u5173\u5ea6|\u641c\u7d22\u91cf/i;

function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function collectAssociationTerms(value, terms = [], depth = 0) {
  if (depth > 10 || value == null || typeof value !== 'object') return terms;
  if (Array.isArray(value)) {
    for (const item of value) collectAssociationTerms(item, terms, depth + 1);
    return terms;
  }

  const entries = Object.entries(value);
  const hasMetric = entries.some(([key]) => METRIC_FIELD_HINT.test(key));
  const rowTerms = entries
    .filter(([key, item]) => TERM_FIELD_HINT.test(key) && (typeof item === 'string' || typeof item === 'number'))
    .map(([, item]) => normalizeText(item))
    .filter(Boolean);
  if (hasMetric && rowTerms.length) terms.push(...rowTerms);

  for (const [, item] of entries) collectAssociationTerms(item, terms, depth + 1);
  return terms;
}

function associationSignature(url, payload) {
  const payloadText = JSON.stringify(payload);
  const hasAssociationHint = ASSOCIATION_URL_HINT.test(url) || ASSOCIATION_PAYLOAD_HINT.test(payloadText);
  if (!hasAssociationHint) return null;
  const terms = [...new Set(collectAssociationTerms(payload))].sort();
  return terms.length ? terms.join('|') : null;
}

async function recordId(url, body) {
  const bytes = new TextEncoder().encode(`${url}\n${body}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getRecords() {
  const { capturedRecords = [] } = await chrome.storage.local.get('capturedRecords');
  // 旧版会抓到不相关接口。保留在浏览器本地但不再交给 Agent 导入。
  return capturedRecords.filter((record) => record.captureVersion === CAPTURE_VERSION);
}

async function saveRecord(record) {
  const records = await getRecords();
  if (records.some((item) => item.id === record.id)) return false;
  await chrome.storage.local.set({ capturedRecords: [...records, record].slice(-MAX_RECORDS) });
  scheduleHandoff();
  return true;
}

async function startCapture(tabId) {
  if (!tabId || sessions.has(tabId)) return { ok: true, message: '正在监听。' };
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url?.startsWith('https://creator.douyin.com/')) {
      return { ok: false, message: '请先打开并登录抖音数据页面。' };
    }
    await chrome.debugger.attach({ tabId }, '1.3');
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
    sessions.set(tabId, { startedAt: Date.now() });
    return { ok: true, message: '已开始监听。现在正常搜索、筛选或翻页即可。' };
  } catch (error) {
    return { ok: false, message: `无法开始监听：${error.message}` };
  }
}

async function stopCapture(tabId) {
  if (!sessions.has(tabId)) return { ok: true, message: '当前没有监听任务。' };
  try { await chrome.debugger.detach({ tabId }); } catch (_) { /* 页面可能已关闭。 */ }
  sessions.delete(tabId);
  return { ok: true, message: '已停止监听。' };
}

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  if (!sessions.has(source.tabId) || method !== 'Network.responseReceived') return;
  const { response, type, requestId } = params;
  if (!isDouyinApi(response.url, type)) return;
  const contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';
  if (!/json|javascript/i.test(contentType)) return;
  try {
    const { body, base64Encoded } = await chrome.debugger.sendCommand(
      { tabId: source.tabId }, 'Network.getResponseBody', { requestId }
    );
    if (base64Encoded || body.length > MAX_RESPONSE_CHARS) return;
    const payload = JSON.parse(body);
    const signature = associationSignature(response.url, payload);
    if (!signature) return;
    const id = await recordId(response.url, body);
    const tab = await chrome.tabs.get(source.tabId);
    await saveRecord({
      id,
      captureVersion: CAPTURE_VERSION,
      capturedAt: new Date().toISOString(),
      sourceUrl: tab.url || '',
      apiUrl: response.url,
      status: response.status,
      payload
    });
  } catch (error) {
    console.debug('跳过无法读取的返回数据。', error);
  }
});

chrome.debugger.onDetach.addListener((source) => sessions.delete(source.tabId));
chrome.tabs.onRemoved.addListener((tabId) => sessions.delete(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('https://creator.douyin.com/')) {
    void startCapture(tabId);
  }
});

function handoffPacket(records) {
  return {
    format: 'douyin-data-assistant/v1',
    exportedAt: new Date().toISOString(),
    records
  };
}

function scheduleHandoff() {
  clearTimeout(handoffTimer);
  handoffTimer = setTimeout(() => {
    void writeAgentHandoff().catch((error) => console.debug('无法更新 Agent 交接文件。', error));
  }, HANDOFF_DELAY_MS);
}

async function requestDownload({ content, filename, saveAs, conflictAction }) {
  await ensureDownloadDocument();
  const result = await chrome.runtime.sendMessage({
    target: 'douyin-download-document',
    type: 'DOWNLOAD_JSON',
    content,
    filename,
    saveAs,
    conflictAction
  });
  if (!result?.ok) throw new Error(result?.message || '浏览器没有完成下载。');
}

async function writeAgentHandoff() {
  const records = await getRecords();
  if (!records.length) return { ok: false, message: '还没有可交接的数据。' };
  await requestDownload({
    content: JSON.stringify(handoffPacket(records), null, 2),
    filename: 'douyin-data-assistant/agent-handoff.json',
    saveAs: false,
    conflictAction: 'overwrite'
  });
  return { ok: true, message: '数据已自动交给 Agent。' };
}

async function ensureDownloadDocument() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS'],
    justification: '把用户主动导出的采集数据生成 JSON 下载文件。'
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'douyin-download-document') return;
  (async () => {
    if (message.type === 'STATUS') {
      if (message.tabId) await startCapture(message.tabId);
      const records = await getRecords();
      if (records.length) scheduleHandoff();
      return { ok: true, active: sessions.has(message.tabId), count: records.length };
    }
    if (message.type === 'CLEAR') {
      clearTimeout(handoffTimer);
      await chrome.storage.local.remove('capturedRecords');
      return { ok: true, message: '本地采集数据已清空。' };
    }
    return { ok: false, message: '未知操作。' };
  })().then(sendResponse).catch((error) => sendResponse({ ok: false, message: error.message }));
  return true;
});

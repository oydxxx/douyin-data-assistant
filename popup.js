const $ = (id) => document.getElementById(id);
let tabId;

function show(text, isError = false) {
  $('message').textContent = text;
  $('message').style.color = isError ? '#ba3b3b' : '#647084';
}

async function message(type) { return chrome.runtime.sendMessage({ type, tabId }); }

async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  const result = await message('STATUS');
  $('status').textContent = result.active ? `正在监听 · 已采集 ${result.count} 条` : `等待监听 · 已采集 ${result.count} 条`;
  if (result.warning) {
    show(result.warning.message, true);
  } else if (result.handoff?.status === 'error') {
    show(`交接失败：${result.handoff.message}`, true);
  } else if (result.handoff?.status === 'written') {
    show(`交接已写出：${result.handoff.recordCount} 条（批次 ${result.handoff.batchId}）`);
  }
  $('hint').textContent = result.active
    ? '现在正常搜索、筛选或翻页即可。数据会自动交给 Codex。'
    : '请打开并登录抖音数据页面；插件会自动开始监听。';
}

$('clear').addEventListener('click', async () => { const result = await message('CLEAR'); show(result.message, !result.ok); await refresh(); });
refresh();

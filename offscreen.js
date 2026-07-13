chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'douyin-download-document' || message.type !== 'DOWNLOAD_JSON') return;
  const blob = new Blob([message.content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url,
    filename: message.filename,
    saveAs: Boolean(message.saveAs),
    conflictAction: message.conflictAction || 'uniquify'
  })
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, message: error.message }))
    .finally(() => setTimeout(() => URL.revokeObjectURL(url), 60_000));
  return true;
});

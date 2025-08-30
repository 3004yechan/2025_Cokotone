chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== "toggle-panel") return;
  const { powerOn } = await chrome.storage.local.get("powerOn");
  if (powerOn === false) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_CLIENT_PANEL" });
});

/**
 * content script로부터 메시지를 수신하고 처리합니다.
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'CAPTURE_VISIBLE_TAB') {
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
        sendResponse({ payload: dataUrl });
      } catch (e) {
        console.error("화면 캡처에 실패했습니다.", e);
        sendResponse({ error: e.message });
      }
    }
  })();
  
  // 비동기 응답을 위해 true를 반환합니다.
  return true;
});
  
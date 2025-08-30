chrome.commands.onCommand.addListener(async (cmd) => {
    if (cmd !== "toggle-panel") return;
    const { powerOn } = await chrome.storage.local.get("powerOn");
    if (!powerOn) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_CLIENT_PANEL" });
  });
  
document.getElementById('analyzePageBtn').addEventListener('click', () => {
    // 현재 활성화된 탭에 메시지를 보낸다.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "analyze" });
    });
  });
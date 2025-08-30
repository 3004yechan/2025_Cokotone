(function () {
    const qs = (s) => document.querySelector(s);
    const mode = new URLSearchParams(location.search).get("mode") || "popup";
  
    qs("#year").textContent = new Date().getFullYear();
    const powerBtn  = qs("#power");
    const mainEl    = qs("#main");
    const closeBtn  = qs("#closeBtn");
    const openPanel = qs("#openPanel");
    const readDemo  = qs("#readDemo");
    const reqBtn    = qs("#reqSummary");
    const useTTS    = qs("#useTTS");
    const summaryEl = qs("#summary");
  
    // 기능 활성화/비활성화 상태 관리
    const 건강상태_업데이트 = (powerOn) => {
      mainEl.style.opacity = powerOn ? 1 : .5;
      [openPanel, readDemo, reqBtn, useTTS].forEach(el => {
        if(el) el.disabled = !powerOn;
      });
    };

    // 전원 상태 불러오기
    chrome.storage.local.get("powerOn", ({ powerOn }) => {
      powerBtn.checked = powerOn;
      건강상태_업데이트(powerOn);
    });

    // 전원 상태 변경 이벤트
    powerBtn.addEventListener("change", (e) => {
      const powerOn = e.target.checked;
      chrome.storage.local.set({ powerOn });
      건강상태_업데이트(powerOn);
    });

    // 팝업/패널 공용 버튼
    openPanel?.addEventListener("click", async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_CLIENT_PANEL" });
    });
  
    readDemo?.addEventListener("click", async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "READ_DEMO_SUMMARY" });
    });
  
    // 패널 모드 동작
    if (mode === "panel") {
      closeBtn.style.display = "inline-block";
      closeBtn.addEventListener("click", () => parent.postMessage({ type:"CLIENT_PANEL_CLOSE" },"*"));
  
      reqBtn?.addEventListener("click", () => {
        parent.postMessage({ type:"REQUEST_PAGE_SUMMARY" },"*");
      });
  
      window.addEventListener("message", (e) => {
        if (e?.data?.type === "PAGE_SUMMARY") {
          const text = String(e.data.payload || "");
          summaryEl.textContent = text;
          if (useTTS?.checked) parent.postMessage({ type:"READ_TTS", text }, "*");
        }
      });
    } else {
      // 팝업 모드에서는 닫기/요약요청 비활성
      closeBtn.style.display = "none";
      reqBtn.disabled = true;
    }
  })();
  
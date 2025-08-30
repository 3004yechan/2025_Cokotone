(function () {
    const qs = (s) => document.querySelector(s);
    const mode = new URLSearchParams(location.search).get("mode") || "popup";
  
    qs("#year").textContent = new Date().getFullYear();
    const powerBtn  = qs("#power");
    const mainEl    = qs("#main");
    const closeBtn  = qs("#closeBtn");
    const openPanel = qs("#openPanel");
    const reqBtn    = qs("#reqSummary");
    const useTTS    = qs("#useTTS");
    const summaryEl = qs("#summary");
    const ttsPlayBtn = qs("#ttsPlay");
    const ttsStopBtn = qs("#ttsStop");
    const ttsStatusEl = qs("#ttsStatus");
  
    // 기능 활성화/비활성화 상태 관리
    const 건강상태_업데이트 = (powerOn) => {
      mainEl.style.opacity = powerOn ? 1 : .5;
      [openPanel, reqBtn, useTTS, ttsPlayBtn, ttsStopBtn].forEach(el => {
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
  
    // --- TTS 기능 ---
    let sentences = [];
    let currentSentence = 0;
    const updateTtsStatus = () => {
      if (sentences.length > 0) {
        ttsStatusEl.textContent = `${currentSentence} / ${sentences.length} 문장 읽는 중`;
      } else {
        ttsStatusEl.textContent = "";
      }
    };
    const speak = () => {
      if (currentSentence >= sentences.length) {
        sentences = [];
        currentSentence = 0;
        updateTtsStatus();
        return;
      }
      chrome.tts.speak(sentences[currentSentence], {
        rate: 1.0,
        onEvent: (e) => {
          if (e.type === 'end' || e.type === 'interrupted') {
            currentSentence++;
            updateTtsStatus();
            speak();
          }
          if (e.type === 'error') {
            console.error('TTS Error:', e.errorMessage);
          }
        }
      });
    };
    ttsPlayBtn?.addEventListener("click", async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      chrome.tts.stop(); // 기존 재생 중지
      ttsStatusEl.textContent = "본문 내용 가져오는 중...";

      chrome.tabs.sendMessage(tab.id, { type: "REQUEST_PAGE_CONTENT" }, (res) => {
        if (chrome.runtime.lastError) {
          return ttsStatusEl.textContent = "본문을 가져올 수 없습니다. 페이지를 새로고침 해주세요.";
        }
        const content = res?.payload || "";
        sentences = content.split(/[.!?\n]+/g).filter(s => s.trim().length > 0);
        currentSentence = 0;
        updateTtsStatus();
        speak();
      });
    });
    ttsStopBtn?.addEventListener("click", () => {
      chrome.tts.stop();
      sentences = [];
      currentSentence = 0;
      updateTtsStatus();
    });
    // --- TTS 기능 끝 ---
  
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
          if (useTTS?.checked && text) parent.postMessage({ type:"READ_TTS", text }, "*");
        }
      });
    } else {
      // 팝업 모드에서는 닫기 비활성
      closeBtn.style.display = "none";
      
      reqBtn?.addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;

        // content.js 가 준비되었는지 먼저 확인
        chrome.tabs.sendMessage(tab.id, { type: "PING" }, (res) => {
          if (chrome.runtime.lastError || res?.payload !== "PONG") {
            summaryEl.textContent = "요약 정보를 가져올 수 없습니다. 페이지를 새로고침하고 다시 시도해 주세요.";
            return console.error("Content script not ready:", chrome.runtime.lastError?.message);
          }

          // 준비된 것을 확인한 후, 실제 요약 요청 전송
          chrome.tabs.sendMessage(tab.id, { type: "REQUEST_PAGE_SUMMARY" }, (res) => {
            if (chrome.runtime.lastError) {
              summaryEl.textContent = "요약 정보 요청에 실패했습니다.";
              return console.error(chrome.runtime.lastError.message);
            }
            const text = res?.payload || "";
            summaryEl.textContent = text;
            if (useTTS?.checked && text) chrome.tts.speak(text, { rate: 1.0 });
          });
        });
      });
    }
  })();
  
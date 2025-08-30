// client/js/api.js

/**
 * 활성 탭에 메시지를 보내고 응답을 받는 함수
 * @param {object} message - 전송할 메시지
 * @returns {Promise<object|undefined>} - content script 로부터의 응답
 */
function sendMessageToActiveTab(message) {
  return new Promise(async (resolve, reject) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, message, (response) => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          resolve(response);
        });
      } else {
        resolve(undefined); // 활성 탭이 없는 경우
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 패널을 토글하도록 content script에 요청합니다.
 */
export function togglePanel() {
  return sendMessageToActiveTab({ type: "TOGGLE_CLIENT_PANEL" });
}

/**
 * 페이지 종합 분석을 content script에 요청합니다.
 */
export function requestComprehensiveAnalysis() {
  return sendMessageToActiveTab({ type: "REQUEST_COMPREHENSIVE_ANALYSIS" });
}

/**
 * 페이지 전체 콘텐츠를 TTS용으로 요청합니다.
 */
export function requestPageContent() {
  return sendMessageToActiveTab({ type: "REQUEST_PAGE_CONTENT" });
}

/**
 * content script가 준비되었는지 확인합니다.
 */
export function pingContentScript() {
  return sendMessageToActiveTab({ type: "PING" });
}


/**
 * 부모 창(패널을 삽입한 페이지)에 메시지를 전송합니다. (패널 모드용)
 * @param {object} message - 전송할 메시지 객체
 */
function postMessageToParent(message) {
  if (window.parent) {
    window.parent.postMessage(message, "*");
  }
}

/**
 * 패널을 닫도록 부모 창에 요청합니다.
 */
export function closePanel() {
  postMessageToParent({ type: "CLIENT_PANEL_CLOSE" });
}

/**
 * 페이지 요약을 요청하도록 부모 창에 요청합니다.
 */
export function requestSummaryFromPanel() {
  postMessageToParent({ type: "REQUEST_PAGE_SUMMARY" });
}

/**
 * TTS(Text-to-Speech) 재생을 부모 창에 요청합니다.
 * @param {string} text - 읽을 텍스트
 */
export function requestTTS(text) {
  postMessageToParent({ type: "READ_TTS", text });
}

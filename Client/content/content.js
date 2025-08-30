// client/content/content.js

let frame = null;

// 패널을 로드하지 않을 URL 리스트
const BLOCKED_URLS = [
  "https://accounts.google.com",
  "https://drive.google.com",
  "https://mail.google.com"
];

function createPanel() {
  // 현재 URL이 차단 목록에 있는지 확인
  if (BLOCKED_URLS.some(url => window.location.href.startsWith(url))) {
    console.warn("이 페이지는 보안 정책으로 인해 패널 생성이 차단되었습니다.");
    return null;
  }
  
  if (frame) return frame;
  frame = document.createElement("iframe");
  frame.src = chrome.runtime.getURL("Client.html") + "?mode=panel";
  frame.title = "A11y Client Panel";
  Object.assign(frame.style, {
    position: "fixed", right: "16px", bottom: "16px",
    width: "420px", height: "560px",
    border: "1px solid #e2e8f0", borderRadius: "16px",
    boxShadow: "0 14px 46px rgba(2,8,23,.24)", background: "#fff",
    zIndex: 2147483647
  });
  document.documentElement.appendChild(frame);
  return frame;
}
function togglePanel() {
  if (frame && frame.isConnected) { frame.remove(); frame = null; }
  else createPanel();
}

// --- Helper Functions for Comprehensive Analysis ---

/**
 * Data URL을 Blob 객체로 변환합니다.
 * @param {string} dataUrl - 변환할 Data URL
 * @returns {Blob} 변환된 Blob 객체
 */
function dataURLtoBlob(dataUrl) {
  const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * 페이지 HTML에서 불필요한 요소를 제거하여 AI 분석에 적합한 형태로 만듭니다.
 * @returns {string} 정제된 HTML 소스 코드 문자열
 */
function getSanitizedHtml() {
  const clonedDoc = document.documentElement.cloneNode(true);
  clonedDoc.querySelectorAll('script, style, svg, noscript').forEach(el => el.remove());

  const iterator = document.createTreeWalker(clonedDoc, NodeFilter.SHOW_COMMENT);
  const commentsToRemove = [];
  let currentNode;
  while (currentNode = iterator.nextNode()) {
    commentsToRemove.push(currentNode);
  }
  commentsToRemove.forEach(comment => comment.remove());

  return clonedDoc.outerHTML;
}

/**
 * 페이지 종합 분석을 수행하고 결과를 처리합니다.
 */
async function handleComprehensiveAnalysis() {
  const imageElements = document.querySelectorAll('img:not([alt]), img[alt=""]');
  const imageUrls = [];
  const imageIds = [];

  imageElements.forEach((img, i) => {
    const absoluteUrl = new URL(img.src, window.location.href).href;
    
    if (absoluteUrl.startsWith('chrome-extension://')) {
        console.log(`확장 프로그램 URL 제외: ${absoluteUrl}`);
        return;
    }
    
    const clientId = `temp-img-${i}`;
    img.dataset.clientId = clientId;
    imageUrls.push(absoluteUrl);
    imageIds.push(clientId);
    console.log(`이미지 ${i}: URL=${absoluteUrl}, ID=${clientId}`);
  });
  console.log(`페이지에서 발견된 이미지 수: ${imageElements.length}`);
  console.log(`분석 대상 이미지 수: ${imageUrls.length}`);

  const screenshotDataUrl = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
  console.log("캡처 데이터 수신:", screenshotDataUrl);

  if (!screenshotDataUrl?.payload) {
    console.error("화면 캡처 실패:", screenshotDataUrl?.error);
    return { page_description: '화면 캡처에 실패하여 분석을 진행할 수 없습니다. 일반 웹페이지에서 다시 시도해주세요.', error: true };
  }

  const screenshotBlob = dataURLtoBlob(screenshotDataUrl.payload);
  const htmlContent = getSanitizedHtml();

  const API_BASE_URL = "http://127.0.0.1:8000";
  let endpoint = '';
  const formData = new FormData();
  formData.append('screenshot_file', screenshotBlob, 'screenshot.png');
  formData.append('html_content', htmlContent);

  if (imageUrls.length === 0) {
    endpoint = '/analyses/page_context';
    console.log("이미지가 없어 페이지 맥락 분석 API를 호출합니다.");
  } else {
    endpoint = '/analyses/batch_comprehensive';
    formData.append('image_urls', imageUrls.join(','));
    formData.append('image_ids', imageIds.join(','));
    console.log("이미지가 있어 종합 분석 API를 호출합니다.");
    console.log("전송할 이미지 URL 목록:", imageUrls);
    console.log("전송할 이미지 ID 목록:", imageIds);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`서버 오류: ${response.status} - ${response.statusText} - ${errorData}`);
    }
    const result = await response.json();

    result.image_results?.forEach(imageResult => {
      const imgElement = document.querySelector(`img[data-client-id="${imageResult.client_id}"]`);
      if (imgElement) {
        imgElement.alt = imageResult.alt_text;
      }
    });

    return { page_description: result.page_description };

  } catch (error) {
    console.error(`API 요청 실패 (${endpoint}):`, error);
    return { page_description: `오류가 발생했습니다: ${error.message}`, error: true };
  }
}

// --- Message Listeners ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const { powerOn } = await chrome.storage.local.get("powerOn");
    if (powerOn === false) return;

    switch (msg?.type) {
      case "TOGGLE_CLIENT_PANEL":
        togglePanel();
        break;
        
      case "PING":
        sendResponse({ payload: "PONG" });
        break;

      case "REQUEST_COMPREHENSIVE_ANALYSIS":
        const result = await handleComprehensiveAnalysis();
        sendResponse({ payload: result });
        break;
        
      case "REQUEST_PAGE_CONTENT":
        sendResponse({ payload: document.body.innerText });
        break;
    }
  })();
  return true;
});

// 패널(iframe)과의 통신
window.addEventListener("message", (e) => {
  (async () => {
    const { powerOn } = await chrome.storage.local.get("powerOn");
    if (powerOn === false) return;

    const data = e?.data;
    if (!data || typeof data !== "object") return;
    
    switch (data.type) {
      case "CLIENT_PANEL_CLOSE":
        if (frame) { frame.remove(); frame = null; }
        break;
        
      case "REQUEST_PAGE_SUMMARY":
        if (frame) {
          const summary = "간단 요약 기능은 현재 비활성화되어 있습니다.";
          frame.contentWindow?.postMessage({ type: "PAGE_SUMMARY", payload: summary }, "*");
        }
        break;

      case "READ_TTS":
        if (chrome.tts) chrome.tts.speak(String(data.text || ""), { rate: 1.0 });
        break;
    }
  })();
});
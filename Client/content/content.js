// client/content/content.js

let frame = null;

function createPanel() {
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
 * 이미지 URL을 Blob 객체로 변환합니다. Data URL도 지원합니다.
 * @param {string} src - 이미지의 src 속성값
 * @returns {Promise<Blob|null>} 변환된 Blob 객체 또는 실패 시 null
 */
async function imageSrcToBlob(src) {
  if (!src) return null;
  try {
    if (src.startsWith('data:')) {
      return dataURLtoBlob(src);
    }
    // 상대 경로를 절대 경로로 변환
    const absoluteUrl = new URL(src, window.location.href).href;
    const response = await fetch(absoluteUrl);
    if (!response.ok) return null;
    return await response.blob();
  } catch (error) {
    console.error(`이미지 로드 실패: ${src}`, error);
    return null;
  }
}

/**
 * 페이지 종합 분석을 수행하고 결과를 처리합니다.
 */
async function handleComprehensiveAnalysis() {
  // 1. 대체 텍스트가 없는 이미지 찾기 및 ID 부여
  const imagesToAnalyze = [];
  const imageElements = document.querySelectorAll('img:not([alt]), img[alt=""]');
  imageElements.forEach((img, i) => {
    const clientId = `temp-img-${i}`;
    img.dataset.clientId = clientId;
    imagesToAnalyze.push({ element: img, clientId, src: img.src });
  });

  // 2. 데이터 수집 (이미지 Blob, 스크린샷, HTML)
  const imageBlobs = await Promise.all(imagesToAnalyze.map(img => imageSrcToBlob(img.src)));
  const screenshotDataUrl = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
  const screenshotBlob = screenshotDataUrl?.payload ? dataURLtoBlob(screenshotDataUrl.payload) : null;
  const htmlContent = document.documentElement.outerHTML;

  // 3. FormData 구성
  const formData = new FormData();
  const imageIds = [];
  
  imagesToAnalyze.forEach((imgInfo, i) => {
    const blob = imageBlobs[i];
    if (blob) {
      formData.append('image_files', blob, `image_${i}.${blob.type.split('/')[1] || 'png'}`);
      imageIds.push(imgInfo.clientId);
    }
  });
  
  formData.append('image_ids', JSON.stringify(imageIds)); // 서버측 파싱 방식에 따라調整
  if (screenshotBlob) formData.append('screenshot_file', screenshotBlob, 'screenshot.png');
  formData.append('html_content', htmlContent);

  // 4. 백엔드 API 요청
  try {
    const API_BASE_URL = "http://127.0.0.1:8000";
    const response = await fetch(`${API_BASE_URL}/analyses/batch_comprehensive`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error(`서버 오류: ${response.status}`);
    const result = await response.json();

    // 5. 결과 처리: alt 태그 삽입
    result.image_results?.forEach(imageResult => {
      const imgElement = document.querySelector(`img[data-client-id="${imageResult.client_id}"]`);
      if (imgElement) {
        imgElement.alt = imageResult.alt_text;
      }
    });

    return { page_description: result.page_description };

  } catch (error) {
    console.error("종합 분석 API 요청 실패:", error);
    return { page_description: `오류가 발생했습니다: ${error.message}` };
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

      case "REQUEST_COMPREhensive_ANALYSIS": // 오타 수정 필요
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
      
      case "REQUEST_PAGE_SUMMARY": // 패널의 간단 요약 요청 (현재는 미사용, 추후 별도 API 구현 가능)
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

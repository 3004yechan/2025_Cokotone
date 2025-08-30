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
 * 페이지 HTML에서 불필요한 요소를 제거하여 AI 분석에 적합한 형태로 만듭니다.
 * @returns {string} 정제된 HTML 소스 코드 문자열
 */
function getSanitizedHtml() {
  // 현재 문서를 그대로 복제하여 원본 페이지에 영향을 주지 않도록 합니다.
  const clonedDoc = document.documentElement.cloneNode(true);

  // 불필요한 태그(스크립트, 스타일, SVG)를 모두 제거합니다.
  clonedDoc.querySelectorAll('script, style, svg, noscript').forEach(el => el.remove());

  // 모든 주석 노드를 찾아서 제거합니다.
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
  // 공통 데이터 수집 (스크린샷, HTML)
  const htmlContent = getSanitizedHtml();
  const screenshotDataUrl = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });

  // VALIDATION: 화면 캡처는 두 API 모두에 필수이므로 먼저 확인합니다.
  if (!screenshotDataUrl?.payload) {
    console.error("화면 캡처 실패:", screenshotDataUrl?.error);
    return { page_description: '화면 캡처에 실패하여 분석을 진행할 수 없습니다. 일반 웹페이지에서 다시 시도해주세요.', error: true };
  }
  const screenshotBlob = dataURLtoBlob(screenshotDataUrl.payload);

  // 분석할 이미지 찾기
  const imagesToAnalyze = [];
  const imageElements = document.querySelectorAll('img:not([alt]), img[alt=""]');

  const API_BASE_URL = "http://127.0.0.1:8000";
  let endpoint = '';
  const formData = new FormData();
  formData.append('screenshot_file', screenshotBlob, 'screenshot.png');
  formData.append('html_content', htmlContent);

  // 조건부 분기: 분석할 이미지 유무에 따라 엔드포인트와 FormData 구성을 변경합니다.
  if (imageElements.length === 0) {
    // Case 1: 이미지가 없으면 /page_context API 호출
    endpoint = '/analyses/page_context';
    // formData에는 스크린샷과 HTML만 포함됩니다.
  } else {
    // Case 2: 이미지가 있으면 /batch_comprehensive API 호출
    endpoint = '/analyses/batch_comprehensive';
    
    imageElements.forEach((img, i) => {
      const clientId = `temp-img-${i}`;
      img.dataset.clientId = clientId;
      imagesToAnalyze.push({ element: img, clientId, src: img.src });
    });

    const imageBlobs = await Promise.all(imagesToAnalyze.map(img => imageSrcToBlob(img.src)));
    const imageIds = [];
    
    imagesToAnalyze.forEach((imgInfo, i) => {
      const blob = imageBlobs[i];
      if (blob) {
        formData.append('image_files', blob, `image_${i}.${blob.type.split('/')[1] || 'png'}`);
        imageIds.push(imgInfo.clientId);
      }
    });

    // image_ids가 비어있으면 전송하지 않아 422 오류를 방지합니다.
    if (imageIds.length > 0) {
      formData.append('image_ids', imageIds.join(','));
    } else {
       // 모든 이미지가 Blob 변환에 실패한 경우, 이미지가 없는 것으로 간주하고 다른 API를 호출합니다.
       endpoint = '/analyses/page_context';
    }
  }

  // API 요청 및 결과 처리
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error(`서버 오류: ${response.status} - ${response.statusText}`);
    const result = await response.json();

    // batch_comprehensive API의 응답일 경우에만 alt 태그를 처리합니다.
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

      case "REQUEST_COMPREHENSIVE_ANALYSIS": // 오타 수정
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

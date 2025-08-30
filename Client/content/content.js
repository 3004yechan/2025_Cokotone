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
 * 이미지 URL을 가져와 Blob 객체로 변환합니다. CORS 문제를 우회하기 위해 background script에 요청을 보냅니다.
 * @param {string} src - 이미지의 src URL
 * @returns {Promise<Blob|null>} 변환된 Blob 객체 또는 실패 시 null
 */
async function imageSrcToBlob(src) {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'FETCH_IMAGE', payload: src });
        if (response.error) {
            console.error(`이미지 fetch 실패 (${src}):`, response.error);
            return null;
        }
        const blob = await fetch(response.payload).then(r => r.blob());
        return blob;
    } catch (e) {
        console.error(`이미지 Blob 변환 중 예외 발생 (${src}):`, e);
        return null;
    }
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
    console.log("분석할 이미지가 없어 페이지 맥락 분석 API를 호출합니다.");
  } else {
    // Case 2: 이미지가 있으면 /batch_comprehensive API 호출
    endpoint = '/analyses/batch_comprehensive';
    console.log(`페이지에서 발견된 이미지 수: ${imageElements.length}, 종합 분석 API를 호출합니다.`);
    
    imageElements.forEach((img, i) => {
      const clientId = `temp-img-${i}`;
      img.dataset.clientId = clientId;
      
      const absoluteUrl = new URL(img.src, window.location.href).href;
      if (absoluteUrl.startsWith('chrome-extension://')) {
        console.log(`확장 프로그램 내부 URL은 제외합니다: ${absoluteUrl}`);
        return;
      }
      imagesToAnalyze.push({ element: img, clientId, src: absoluteUrl });
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
      console.log("전송할 이미지 ID 목록:", imageIds);
    } else {
        // 모든 이미지가 Blob 변환에 실패한 경우, 이미지가 없는 것으로 간주하고 다른 API를 호출합니다.
        console.log("모든 이미지의 Blob 변환에 실패하여 페이지 맥락 분석 API로 전환합니다.");
        endpoint = '/analyses/page_context';
    }
  }

  // API 요청 및 결과 처리
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
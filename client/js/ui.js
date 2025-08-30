// client/js/ui.js

/**
 * 자주 사용하는 DOM 요소를 효율적으로 관리하기 위한 객체
 */
export const elements = {
  powerBtn: document.querySelector("#power"),
  mainEl: document.querySelector("#main"),
  closeBtn: document.querySelector("#closeBtn"),
  openPanelBtn: document.querySelector("#openPanel"),
  requestSummaryBtn: document.querySelector("#reqSummary"), // 패널의 간단 요약 요청
  requestComprehensiveBtn: document.querySelector("#reqComprehensive"), // 팝업의 종합 분석 요청
  useTTSCheckbox: document.querySelector("#useTTS"),
  summaryEl: document.querySelector("#summary"),
  yearEl: document.querySelector("#year"),
  ttsPlayBtn: document.querySelector("#ttsPlay"),
  ttsStopBtn: document.querySelector("#ttsStop"),
  ttsStatusEl: document.querySelector("#ttsStatus"),
};

/**
 * UI 컨트롤의 활성화/비활성화 상태를 업데이트합니다.
 * @param {boolean} isEnabled - 활성화 여부
 */
export function updateControlState(isEnabled) {
  elements.mainEl.style.opacity = isEnabled ? 1 : 0.5;
  [
    elements.openPanelBtn,
    elements.requestSummaryBtn,
    elements.requestComprehensiveBtn,
    elements.useTTSCheckbox,
    elements.ttsPlayBtn,
    elements.ttsStopBtn,
  ].forEach((el) => {
    if (el) el.disabled = !isEnabled;
  });
}

/**
 * 현재 모드(popup/panel)에 따라 UI를 설정합니다.
 * @param {'popup' | 'panel'} mode - 현재 UI 모드
 */
export function setupUIMode(mode) {
  const popupOnly = [elements.requestComprehensiveBtn, elements.ttsPlayBtn, elements.ttsStopBtn, elements.ttsStatusEl, elements.openPanelBtn];
  const panelOnly = [elements.requestSummaryBtn, elements.closeBtn];

  if (mode === "panel") {
    popupOnly.forEach(el => { if (el) el.style.display = 'none'; });
    panelOnly.forEach(el => { if (el) el.style.display = 'inline-block'; });
  } else { // popup mode
    popupOnly.forEach(el => { if (el) el.style.display = 'inline-block'; });
    panelOnly.forEach(el => { if (el) el.style.display = 'none'; });
    if (document.querySelector('.ttsBox hr')) document.querySelector('.ttsBox hr').style.display = 'block';
  }
}

/**
 * 요약 결과를 화면에 표시합니다.
 * @param {string} text - 표시할 텍스트
 */
export function displaySummary(text) {
  elements.summaryEl.textContent = text;
}

/**
 * TTS 상태 메시지를 화면에 표시합니다.
 * @param {string} text - 표시할 텍스트
 */
export function displayTTSStatus(text) {
  if (elements.ttsStatusEl) {
    elements.ttsStatusEl.textContent = text;
  }
}

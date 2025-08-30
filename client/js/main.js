// client/js/main.js
import * as ui from "./ui.js";
import * as api from "./api.js";

/**
 * TTS 재생과 상태를 관리하는 클래스
 */
class TTSPlayer {
  constructor() {
    this.sentences = [];
    this.currentSentence = 0;
  }

  /**
   * 주어진 텍스트로 문장 목록을 설정합니다.
   * @param {string} text - 전체 텍스트
   */
  setText(text) {
    this.sentences = text.split(/[.!?\n]+/g).filter(s => s.trim().length > 0);
    this.currentSentence = 0;
    this.updateStatus();
  }

  /**
   * 재생을 시작합니다.
   */
  play() {
    chrome.tts.stop(); // 기존 재생 중지
    if (this.currentSentence >= this.sentences.length) {
      this.reset();
      return;
    }
    this._speak();
  }
  
  /**
   * 현재 문장을 TTS로 읽습니다.
   * @private
   */
  _speak() {
    chrome.tts.speak(this.sentences[this.currentSentence], {
      rate: 1.0,
      onEvent: (e) => {
        if (['end', 'interrupted', 'cancelled'].includes(e.type)) {
          this.currentSentence++;
          this.updateStatus();
          this.play();
        }
        if (e.type === 'error') {
          console.error('TTS Error:', e.errorMessage);
          ui.displayTTSStatus(`오류: ${e.errorMessage}`);
        }
      }
    });
  }

  /**
   * 재생을 중지하고 상태를 초기화합니다.
   */
  stop() {
    chrome.tts.stop();
    this.reset();
  }
  
  /**
   * 상태를 초기화합니다.
   */
  reset() {
    this.sentences = [];
    this.currentSentence = 0;
    this.updateStatus();
  }

  /**
   * UI에 현재 상태를 업데이트합니다.
   */
  updateStatus() {
    if (this.sentences.length > 0) {
      const status = (this.currentSentence >= this.sentences.length)
        ? "재생 완료"
        : `${this.currentSentence + 1} / ${this.sentences.length} 문장`;
      ui.displayTTSStatus(status);
    } else {
      ui.displayTTSStatus("");
    }
  }
}

/**
 * 애플리케이션의 메인 로직을 관리하는 클래스
 */
class App {
  constructor() {
    this.mode = new URLSearchParams(location.search).get("mode") || "popup";
    this.powerOn = true;
    this.useTTS = true;
    this.ttsPlayer = new TTSPlayer();
  }

  /**
   * 애플리케이션 초기화
   */
  async init() {
    ui.elements.yearEl.textContent = new Date().getFullYear();

    const storage = await chrome.storage.local.get(["powerOn", "useTTS"]);
    this.powerOn = storage.powerOn ?? true;
    this.useTTS = storage.useTTS ?? true;

    ui.elements.powerBtn.checked = this.powerOn;
    if(ui.elements.useTTSCheckbox) ui.elements.useTTSCheckbox.checked = this.useTTS;

    ui.updateControlState(this.powerOn);
    ui.setupUIMode(this.mode);

    this.addEventListeners();
  }

  /**
   * 이벤트 리스너 등록
   */
  addEventListeners() {
    ui.elements.powerBtn.addEventListener("change", (e) => this.handlePowerToggle(e));
    if(ui.elements.useTTSCheckbox) ui.elements.useTTSCheckbox.addEventListener("change", (e) => this.handleTtsOptionToggle(e));
    if(ui.elements.openPanelBtn) ui.elements.openPanelBtn.addEventListener("click", () => api.togglePanel());

    if (this.mode === "panel") {
      this.addPanelListeners();
    } else {
      this.addPopupListeners();
    }
  }

  /**
   * 패널 모드 전용 이벤트 리스너
   */
  addPanelListeners() {
    ui.elements.closeBtn.addEventListener("click", () => api.closePanel());
    ui.elements.requestSummaryBtn?.addEventListener("click", () => api.requestSummaryFromPanel());

    window.addEventListener("message", (e) => {
      const { type, payload } = e.data || {};
      if (type === "PAGE_SUMMARY") ui.displaySummary(payload);
    });
  }

  /**
   * 팝업 모드 전용 이벤트 리스너
   */
  addPopupListeners() {
    if (ui.elements.requestComprehensiveBtn) {
      ui.elements.requestComprehensiveBtn.addEventListener("click", () => this.handleComprehensiveAnalysisRequest());
    }
    ui.elements.ttsPlayBtn?.addEventListener("click", () => this.handleTtsPlay());
    ui.elements.ttsStopBtn?.addEventListener("click", () => this.ttsPlayer.stop());
  }

  // --- 이벤트 핸들러 ---
  
  handlePowerToggle(e) {
    this.powerOn = e.target.checked;
    chrome.storage.local.set({ powerOn: this.powerOn });
    ui.updateControlState(this.powerOn);
  }
  
  handleTtsOptionToggle(e) {
    this.useTTS = e.target.checked;
    chrome.storage.local.set({ useTTS: this.useTTS });
  }

  async handleComprehensiveAnalysisRequest() {
    ui.displaySummary("종합 분석을 시작합니다. 페이지를 스캔하고 서버와 통신하는 데 시간이 걸릴 수 있습니다...");
    try {
      const res = await api.requestComprehensiveAnalysis();
      this.handleAnalysisResponse(res.payload);
    } catch (e) {
      ui.displaySummary("종합 분석에 실패했습니다. 페이지를 새로고침하고 다시 시도해 주세요.");
      console.error("Comprehensive analysis request failed:", e.message);
    }
  }
  
  handleAnalysisResponse(payload) {
    const description = payload?.page_description || "페이지 설명을 가져오지 못했습니다.";
    ui.displaySummary(description);
    if (this.useTTS && description) {
      chrome.tts.speak(description, { rate: 1.0 });
    }
  }

  async handleTtsPlay() {
    ui.displayTTSStatus("본문 내용 가져오는 중...");
    try {
      const res = await api.requestPageContent();
      this.ttsPlayer.setText(res.payload || "");
      this.ttsPlayer.play();
    } catch (e) {
      ui.displayTTSStatus("본문을 가져올 수 없습니다. 페이지를 새로고침 해주세요.");
      console.error("TTS content request failed:", e.message);
    }
  }
}

// 애플리케이션 시작
const app = new App();
app.init();


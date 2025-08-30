let frame = null;

function createPanel() {
  if (frame) return frame;
  frame = document.createElement("iframe");
  frame.src = chrome.runtime.getURL("Client.html") + "?mode=panel";
  frame.title = "A11y Client Panel";
  Object.assign(frame.style, {
    position:"fixed", right:"16px", bottom:"16px",
    width:"420px", height:"560px",
    border:"1px solid #e2e8f0", borderRadius:"16px",
    boxShadow:"0 14px 46px rgba(2,8,23,.24)", background:"#fff",
    zIndex: 2147483647
  });
  document.documentElement.appendChild(frame);
  return frame;
}
function togglePanel() {
  if (frame && frame.isConnected) { frame.remove(); frame = null; }
  else createPanel();
}

chrome.runtime.onMessage.addListener(async (msg) => {
  const { powerOn } = await chrome.storage.local.get("powerOn");
  if (!powerOn) return;

chrome.runtime.onMessage.addListener((msg) => {

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg?.type === "TOGGLE_CLIENT_PANEL") togglePanel();
  if (msg?.type === "READ_DEMO_SUMMARY") {
    const text = `이 페이지의 제목은 ${document.title} 입니다.`;
    if (chrome.tts) chrome.tts.speak(text, { rate: 1.0 });
    else console.log("[TTS]", text);
  }
  if (msg?.type === "PING") {
    sendResponse({ payload: "PONG" });
    return true; // 비동기 응답을 위해 true 반환
  }
  if (msg?.type === "REQUEST_PAGE_SUMMARY") {
    const summary = `제목: ${document.title} / 호스트: ${location.hostname}`;
    sendResponse({ payload: summary });
    return true; // 비동기 응답을 위해 true 반환
  }
  if (msg?.type === "REQUEST_PAGE_CONTENT") {
    const selectors = "h1, h2, h3, h4, h5, h6, p, a, li";
    const content = [...document.querySelectorAll(selectors)]
      .map(el => el.innerText?.trim())
      .filter(Boolean) // 내용이 있는 것만 필터링
      .join("\n"); // 줄바꿈으로 문장 구분
    sendResponse({ payload: content });
    return true;
  }
});

window.addEventListener("message", async (e) => {
  const { powerOn } = await chrome.storage.local.get("powerOn");
  if (!powerOn) return;
window.addEventListener("message", (e) => {
  const data = e?.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "CLIENT_PANEL_CLOSE" && frame) { frame.remove(); frame = null; }
  if (data.type === "REQUEST_PAGE_SUMMARY" && frame) {
    const summary = `제목: ${document.title} / 호스트: ${location.hostname}`;
    frame.contentWindow?.postMessage({ type: "PAGE_SUMMARY", payload: summary }, "*");
  }
  if (data.type === "READ_TTS" && chrome.tts) chrome.tts.speak(String(data.text||""), { rate: 1.0 });
});

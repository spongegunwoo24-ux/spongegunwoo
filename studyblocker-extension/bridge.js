// 일일플래너 페이지가 window.postMessage로 보내는 상태 변화를
// 확장 프로그램 저장소(chrome.storage.local)로 전달합니다.
// 다른 사이트에서는 'daily-planner-app'이라는 표시가 없으면 아무 동작도 하지 않습니다.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== "daily-planner-app") return;

  if (data.action === "timerState") {
    chrome.runtime.sendMessage({
      type: "PLANNER_TIMER_STATE",
      running: !!(data.payload && data.payload.running)
    });
  }

  if (data.action === "lockMode") {
    chrome.runtime.sendMessage({
      type: "PLANNER_LOCK_MODE",
      enabled: !!(data.payload && data.payload.enabled)
    });
  }
});

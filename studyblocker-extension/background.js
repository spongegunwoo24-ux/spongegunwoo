// content.js(두 번째로 주신 파일)에 있던 목록을 기본값으로 전부 포함합니다.
const DEFAULT_BANNED_URLS = ["youtube", "yt", ".io", "x.com", "tiktok", "중계", "pinter", "rogue"];
const DEFAULT_BANNED_CLICK_KEYWORDS = ["유튜브", "youtube"];

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get([
    "bannedUrls", "bannedClickKeywords", "timerRunning", "lockModeEnabled"
  ]);
  const updates = {};
  if (!Array.isArray(stored.bannedUrls)) updates.bannedUrls = DEFAULT_BANNED_URLS;
  if (!Array.isArray(stored.bannedClickKeywords)) updates.bannedClickKeywords = DEFAULT_BANNED_CLICK_KEYWORDS;
  if (typeof stored.timerRunning !== "boolean") updates.timerRunning = false;
  if (typeof stored.lockModeEnabled !== "boolean") updates.lockModeEnabled = false;
  if (Object.keys(updates).length) await chrome.storage.local.set(updates);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  // 일일플래너 페이지(bridge.js)로부터 전달받은 상태 업데이트
  if (message.type === "PLANNER_TIMER_STATE") {
    console.log("[공부 타이머 사이트 차단기] 타이머 상태 수신:", message.running);
    chrome.storage.local.set({ timerRunning: !!message.running });
    return;
  }

  if (message.type === "PLANNER_LOCK_MODE") {
    console.log("[공부 타이머 사이트 차단기] 잠금모드 상태 수신:", message.enabled);
    chrome.storage.local.set({ lockModeEnabled: !!message.enabled });
    return;
  }

  // 팝업에서 차단 키워드 추가/삭제/조회
  if (message.type === "GET_STATUS") {
    chrome.storage.local.get(
      ["timerRunning", "lockModeEnabled", "bannedUrls", "bannedClickKeywords"],
      (result) => sendResponse(result)
    );
    return true;
  }

  if (message.type === "ADD_BANNED_KEYWORD") {
    chrome.storage.local.get(["bannedUrls"], (result) => {
      const list = Array.isArray(result.bannedUrls) ? result.bannedUrls.slice() : DEFAULT_BANNED_URLS.slice();
      const keyword = (message.keyword || "").trim().toLowerCase();
      if (keyword && !list.includes(keyword)) list.push(keyword);
      chrome.storage.local.set({ bannedUrls: list }, () => sendResponse({ ok: true, bannedUrls: list }));
    });
    return true;
  }

  if (message.type === "REMOVE_BANNED_KEYWORD") {
    chrome.storage.local.get(["bannedUrls"], (result) => {
      const list = (Array.isArray(result.bannedUrls) ? result.bannedUrls : DEFAULT_BANNED_URLS)
        .filter((k) => k !== message.keyword);
      chrome.storage.local.set({ bannedUrls: list }, () => sendResponse({ ok: true, bannedUrls: list }));
    });
    return true;
  }
});

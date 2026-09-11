// 차단하고 싶은 웹사이트 주소 키워드 (기본값. chrome.storage에서 최신 값을 덮어씁니다)
let bannedUrls = ["youtube", "yt", ".io", "x.com", "tiktok", '중계', 'pinter', 'rogue'];
let bannedClickKeywords = ["유튜브", "youtube"];

// 타이머가 실행 중이거나 잠금모드가 켜져 있을 때만 차단을 활성화합니다.
let isBlockingActive = false;

function refreshBlockState(callback) {
  chrome.storage.local.get(
    ["bannedUrls", "bannedClickKeywords", "timerRunning", "lockModeEnabled"],
    (result) => {
      if (Array.isArray(result.bannedUrls)) bannedUrls = result.bannedUrls;
      if (Array.isArray(result.bannedClickKeywords)) bannedClickKeywords = result.bannedClickKeywords;
      isBlockingActive = !!result.timerRunning || !!result.lockModeEnabled;
      if (callback) callback();
    }
  );
}

// 방어 기능 1: 웹사이트 주소(URL)
async function checkCurrentUrl() {
  const currentUrl = window.location.href.toLowerCase();

  if (currentUrl.includes("chrome-extension://") || currentUrl.includes("warning.html")) {
    return;
  }

  // 타이머가 꺼져 있고 잠금모드도 꺼져 있으면 차단하지 않습니다.
  if (!isBlockingActive) return;

  // 현재 접속한 주소에 금지된 사이트 키워드가 포함되어 있는지 확인
  const isBannedUrl = bannedUrls.some(keyword => currentUrl.includes(keyword));

  if (isBannedUrl) {
    const isAllowed = await new Promise((resolve) => {
      chrome.storage.local.get(['allowedTabs'], (result) => {
        const allowedTabs = result.allowedTabs || {};

        const allowed = Object.values(allowedTabs).some(url => {
          if (!url) return false;
          return currentUrl === url.toLowerCase() || currentUrl.startsWith(url.toLowerCase());
        });

        resolve(allowed);
      });
    });

    if (!isAllowed) {
      console.log("⚠️ 공부 타이머가 실행 중이거나 잠금모드가 켜져 있어 차단 화면으로 이동합니다.");
      triggerBlock();
    }
  }
}

document.addEventListener('click', function (event) {
  if (!isBlockingActive) return;

  const clickedElement = event.target;

  const isYoutubeButton =
    clickedElement.matches('[data-tooltip*="유튜브"], [data-tooltip*="YouTube"], [aria-label*="유튜브"], [aria-label*="YouTube"], .yt-icon, [href*="youtube.com"]') ||
    clickedElement.closest('[data-tooltip*="유튜브"], [data-tooltip*="YouTube"], [aria-label*="유튜브"], [aria-label*="YouTube"], .yt-icon');

  if (isYoutubeButton) {
    event.preventDefault();
    event.stopPropagation();

    chrome.storage.local.get(['allowedTabs'], (result) => {
      const allowedTabs = result.allowedTabs || {};
      const currentUrl = window.location.href.toLowerCase();

      const isAllowed = Object.values(allowedTabs).some(url => url && currentUrl.includes(url.toLowerCase()));

      if (!isAllowed) {
        console.log("⚠️ 유튜브 버튼 클릭이 감지되어 차단 화면으로 이동합니다.");
        triggerBlock();
      } else {
        window.open("https://youtube.com", "_blank");
      }
    });
  }
}, true);


function triggerBlock() {
  const targetUrl = encodeURIComponent(window.location.href);
  window.top.location.href = chrome.runtime.getURL(`warning.html?target=${targetUrl}`);
}


refreshBlockState(() => checkCurrentUrl());

const observer = new MutationObserver(() => {
  checkCurrentUrl();
});
if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}

window.addEventListener('popstate', checkCurrentUrl);
window.addEventListener('hashchange', checkCurrentUrl);

// 신호(메시지)를 놓치는 경우를 대비한 안전장치: 2초마다 최신 상태를 다시 확인합니다.
setInterval(() => refreshBlockState(checkCurrentUrl), 2000);

// 타이머 시작/종료, 잠금모드 on/off, 키워드 변경이 발생하면 실시간으로 반영합니다.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.timerRunning || changes.lockModeEnabled || changes.bannedUrls || changes.bannedClickKeywords) {
    refreshBlockState(checkCurrentUrl);
  }
});

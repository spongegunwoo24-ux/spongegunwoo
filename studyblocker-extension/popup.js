function setBadge(el, on) {
  el.textContent = on ? "ON" : "OFF";
  el.className = "badge " + (on ? "on" : "off");
}

function renderKeywords(list) {
  const wrap = document.getElementById("kw-list");
  wrap.innerHTML = "";
  (list || []).forEach((kw) => {
    const row = document.createElement("div");
    row.className = "kw-item";
    const span = document.createElement("span");
    span.textContent = kw;
    const btn = document.createElement("button");
    btn.textContent = "삭제";
    btn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "REMOVE_BANNED_KEYWORD", keyword: kw }, (res) => {
        if (res && res.bannedUrls) renderKeywords(res.bannedUrls);
      });
    });
    row.appendChild(span);
    row.appendChild(btn);
    wrap.appendChild(row);
  });
}

function loadStatus() {
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => {
    if (!res) return;
    setBadge(document.getElementById("status-timer"), !!res.timerRunning);
    setBadge(document.getElementById("status-lock"), !!res.lockModeEnabled);
    renderKeywords(res.bannedUrls);
  });
}

document.getElementById("kw-add-btn").addEventListener("click", () => {
  const input = document.getElementById("kw-input");
  const keyword = input.value.trim();
  if (!keyword) return;
  chrome.runtime.sendMessage({ type: "ADD_BANNED_KEYWORD", keyword }, (res) => {
    if (res && res.bannedUrls) renderKeywords(res.bannedUrls);
    input.value = "";
  });
});

document.getElementById("kw-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("kw-add-btn").click();
});

loadStatus();

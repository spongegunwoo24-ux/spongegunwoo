// 이모지 디펜스 — 화면과 입력
import { CHARS, CHAR_BY_ID, STARTER, RARITY, ATTR, PITY, PULL_COST, RULES, MAP, ENEMIES, STAGES, UP, TRACKS, SPECIAL, MODES, SKILL, tracksOf, spKey, synergyOf, gachaPull, makeWaves, mulberry32 } from './data.js';
import { Game } from './engine.js';
import { Bot } from './bot.js';
import { Brawl, BR, bcost, unitOf, BR_ENEMY } from './brawl.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

// ---------- 저장 ----------
const KEY = 'emojiDefense.v1';
function freshSave() {
  const owned = {};
  STARTER.forEach((id) => (owned[id] = 1));
  return { owned, deck: STARTER.slice(0, 5), gems: 1000, stars: {}, bstars: {}, mute: false, pity: { hero: 0, legend: 0, myth: 0 }, pulls: 0 };
}
let save = freshSave();
try {
  const raw = localStorage.getItem(KEY);
  if (raw) save = Object.assign(freshSave(), JSON.parse(raw));
} catch (e) { /* 저장소를 못 쓰는 환경에서는 새 게임으로 진행 */ }
save.deck = save.deck.filter((id) => save.owned[id] && CHAR_BY_ID[id]);
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* 무시 */ }
}
let mode = 'td'; // 'td' 디펜스 | 'br' 난투
const starsOf = (m = mode) => (m === 'td' ? save.stars : save.bstars);
const totalStars = () => [save.stars, save.bstars].reduce((t, o) => t + Object.values(o).reduce((a, b) => a + b, 0), 0);
const unlocked = (n) => n === 1 || (starsOf()[n - 1] || 0) > 0;

// ---------- 소리 (WebAudio로 즉석 합성) ----------
const TONES = {
  shot: [560, 0.04, 'square', 0.02, -220], hit: [210, 0.06, 'triangle', 0.07, -110], crit: [900, 0.1, 'square', 0.06, -520],
  die: [320, 0.11, 'sine', 0.1, 380], boom: [95, 0.28, 'sawtooth', 0.13, -60], leak: [130, 0.32, 'sawtooth', 0.15, -90],
  place: [420, 0.09, 'sine', 0.1, 260], up: [620, 0.16, 'sine', 0.1, 520], coin: [1250, 0.06, 'sine', 0.05, 300],
  tap: [300, 0.07, 'triangle', 0.1, 160], flip: [700, 0.05, 'triangle', 0.06, 200], rare: [520, 0.35, 'sine', 0.12, 900],
};
const Sfx = {
  ac: null, last: {},
  tone(f, dur, type, vol, slide, delay = 0) {
    const ac = this.ac;
    const t0 = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    o.frequency.linearRampToValueAtTime(Math.max(40, f + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  },
  play(name) {
    if (save.mute) return;
    const now = performance.now();
    if (now - (this.last[name] || 0) < 50) return;
    this.last[name] = now;
    try {
      if (!this.ac) this.ac = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ac.state === 'suspended') this.ac.resume();
      if (name === 'win') [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.1, 0, i * 0.11));
      else if (name === 'lose') [392, 330, 262].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.1, -30, i * 0.18));
      else this.tone(...TONES[name]);
    } catch (e) { /* 소리를 못 내는 환경은 조용히 진행 */ }
  },
};

// ---------- 공통 UI ----------
let toastT = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 1500);
}
function modal(html) {
  $('#sheet').innerHTML = html;
  $('#modal').classList.add('on');
}
function closeModal() {
  $('#modal').classList.remove('on');
}
function refreshGems() {
  $$('.gems').forEach((el) => (el.textContent = save.gems.toLocaleString()));
}
const rarDot = (c) => `<i class="rar-dot" style="background:${RARITY[c.rar].color}"></i>`;

let current = 'home';
function go(name) {
  if (current === 'battle' && name !== 'battle') Battle.stop();
  if (current === 'brawl' && name !== 'brawl') BrawlView.stop();
  current = name;
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === name));
  refreshGems();
  if (name === 'home') Home.enter(); else Home.leave();
  if (name === 'stages') renderStages();
  if (name === 'deck') renderDeck();
  if (name === 'gacha') renderGacha();
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) go(b.dataset.go);
});
$('#btnPlay').onclick = () => {
  if (save.deck.length < 5) { toast('덱에 5명을 채워 주세요'); go('deck'); return; }
  go('stages');
};

// ---------- 홈: 돌아다니는 캐릭터들 ----------
const LINES = {
  any: ['출격하자!', '키보드는 우리가 지킨다', '오늘 기분 최고', '개미 싫어…', '□ 조심해!', '나도 덱에 넣어줘', '산책 중~'],
  joy: ['헤헤', '신난다!'], rage: ['다 덤벼!', '으으 열받아'], sad: ['훌쩍…', '비 올 것 같아'],
  fear: ['으악 깜짝이야', '뒤에 뭐 있어?'], calm: ['좋은 날씨네', '…'], prank: ['메롱~', '장난칠 사람?'],
};
const Home = {
  items: [], raf: 0, last: 0, talkT: 2,
  enter() {
    const ground = $('#ground');
    ground.innerHTML = '';
    this.items = Object.keys(save.owned).filter((id) => CHAR_BY_ID[id]).map((id) => {
      const c = CHAR_BY_ID[id];
      const el = document.createElement('div');
      el.className = 'w';
      const aura = c.rar >= 3 ? `<div class="aura" style="background:radial-gradient(${RARITY[c.rar].color}aa, transparent 68%)"></div>` : '';
      el.innerHTML = `<div class="shadow"></div>${aura}<div class="body">${c.e}</div>`;
      ground.appendChild(el);
      const it = { c, el, body: el.querySelector('.body'), x: Math.random(), y: Math.random(), tx: 0, ty: 0, pause: Math.random() * 2, speed: 0.05 + Math.random() * 0.05, dir: 1, sayT: 0 };
      this.retarget(it);
      el.onclick = () => this.poke(it);
      return it;
    });
    $('#homeStars').textContent = `⭐ ${totalStars()}/${STAGES.length * 6}`;
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.tick(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  leave() { cancelAnimationFrame(this.raf); },
  retarget(it) {
    it.tx = 0.06 + Math.random() * 0.88;
    it.ty = Math.random();
  },
  say(it, html, dur = 2.2) {
    it.el.querySelector('.say')?.remove();
    const s = document.createElement('div');
    s.className = 'say';
    s.innerHTML = html;
    it.el.appendChild(s);
    it.sayT = dur;
  },
  poke(it) {
    const c = it.c;
    it.el.classList.remove('hop');
    void it.el.offsetWidth;
    it.el.classList.add('hop');
    it.pause = 1.6;
    this.say(it, `${c.name}<small style="color:${RARITY[c.rar].color}">${RARITY[c.rar].name} · ${ATTR[c.attr].icon}${ATTR[c.attr].name}${save.deck.includes(c.id) ? ' · 덱' : ''}</small>`, 2.6);
  },
  tick(dt) {
    const g = $('#ground');
    const W = g.clientWidth;
    const H = g.clientHeight;
    const top = 30;
    const bottom = H - 150; // 아래 버튼 영역은 비워 둠
    for (const it of this.items) {
      if (it.sayT > 0) { it.sayT -= dt; if (it.sayT <= 0) it.el.querySelector('.say')?.remove(); }
      let moving = false;
      if (it.pause > 0) {
        it.pause -= dt;
      } else {
        const dx = it.tx - it.x;
        const dy = it.ty - it.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.01) { it.pause = 0.6 + Math.random() * 3; this.retarget(it); }
        else {
          const step = Math.min(d, it.speed * dt);
          it.x += (dx / d) * step;
          it.y += (dy / d) * step * (W / Math.max(200, bottom - top));
          it.y = Math.max(0, Math.min(1, it.y));
          if (Math.abs(dx) > 0.002) it.dir = dx > 0 ? 1 : -1;
          moving = true;
        }
      }
      const sc = (0.62 + 0.5 * it.y) * (1 + it.c.rar * 0.05);
      it.el.style.transform = `translate(${it.x * W}px, ${top + it.y * Math.max(60, bottom - top)}px) scale(${sc})`;
      it.el.style.zIndex = Math.round(it.y * 1000);
      it.body.style.scale = `${it.dir} 1`;
      it.el.classList.toggle('moving', moving);
    }
    this.talkT -= dt;
    if (this.talkT <= 0 && this.items.length) {
      this.talkT = 2.5 + Math.random() * 3;
      const it = this.items[Math.floor(Math.random() * this.items.length)];
      if (it.sayT <= 0) {
        const pool = LINES.any.concat(LINES[it.c.attr]);
        this.say(it, pool[Math.floor(Math.random() * pool.length)]);
      }
    }
  },
};

// ---------- 스테이지 선택 ----------
const starsHtml = (n) => '★'.repeat(n) + `<i>${'★'.repeat(3 - n)}</i>`;
function renderStages() {
  $$('#modeTabs [data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  $('#stageHint').textContent = mode === 'td'
    ? '디펜스: 길 옆에 캐릭터를 세워 몰려오는 적을 막으세요.'
    : '난투: 캐릭터를 필드에 내보내면 스스로 걸어가 싸웁니다. 적 기지를 부수세요.';
  $('#stageList').innerHTML = STAGES.map((st, i) => {
    const n = i + 1;
    const open = unlocked(n);
    const en = [...new Set([...(st.fresh ? [st.fresh] : st.pool.slice(0, 3)), ...Object.values(st.boss || {})])].map((t) => ENEMIES[t].e).join('');
    return `<button class="key stage ${open ? '' : 'locked'} ${st.boss ? 'boss' : ''}" data-stage="${n}">
      <span class="no">${mode === 'td' ? '디펜스' : '난투'} 1-${n}${st.boss ? ' · 보스' : ''}</span><span class="nm">${open ? st.name : '🔒 잠김'}</span>
      <span class="en">${open ? en : ''}</span><span class="st">${starsHtml(starsOf()[n] || 0)}</span></button>`;
  }).join('');
}
$('#modeTabs').onclick = (e) => {
  const b = e.target.closest('[data-mode]');
  if (b) { mode = b.dataset.mode; renderStages(); }
};
$('#stageList').onclick = (e) => {
  const b = e.target.closest('[data-stage]');
  if (!b) return;
  const n = +b.dataset.stage;
  if (!unlocked(n)) { toast('앞 스테이지를 먼저 클리어하세요'); return; }
  const st = STAGES[n - 1];
  const types = mode === 'td' ? [...new Set(makeWaves(n).flatMap((w) => w.types))] : [...new Set([...st.pool, ...Object.values(st.boss || {})])];
  const rule = mode === 'td' ? `웨이브 ${RULES.wavesPerStage}개 · 마음 ${RULES.hearts}` : `제한 시간 ${BR.time}초 · 적 기지를 부수면 승리`;
  modal(`<h3>1-${n} ${st.name}</h3><p>${rule}</p>
    <div class="enemy-list">${types.map((t) => `<div><span>${ENEMIES[t].e}</span><b>${ENEMIES[t].name}</b><small>${ENEMIES[t].desc}</small></div>`).join('')}</div>
    <div class="btns"><button class="key" id="mCancel">닫기</button><button class="key primary" id="mGo">▶ 출격</button></div>`);
  $('#mCancel').onclick = closeModal;
  $('#mGo').onclick = () => { closeModal(); (mode === 'td' ? Battle : BrawlView).start(n); };
};

// ---------- 덱 ----------
let selChar = null;
function renderDeck() {
  const syn = synergyOf(save.deck);
  $('#ownCount').textContent = `${Object.keys(save.owned).length}/${CHARS.length}`;
  $('#deckSlots').innerHTML = Array.from({ length: 5 }, (_, i) => {
    const c = CHAR_BY_ID[save.deck[i]];
    return c
      ? `<div class="slot ${selChar === c.id ? 'sel' : ''}" data-id="${c.id}" style="border-bottom-color:${RARITY[c.rar].color}"><div class="em">${c.e}</div>${c.name}</div>`
      : '<div class="slot empty">＋</div>';
  }).join('');
  const cnt = {};
  save.deck.forEach((id) => (cnt[CHAR_BY_ID[id].attr] = (cnt[CHAR_BY_ID[id].attr] || 0) + 1));
  $('#synChips').innerHTML = syn.active.length
    ? syn.active.map((s) => `<span class="chip" style="color:${ATTR[s.attr].color}">${ATTR[s.attr].icon} ${ATTR[s.attr].name} ${s.n}명 · ${s.text}</span>`).join('')
    : '<span class="chip off">같은 속성 2명 / 4명을 모으면 시너지가 켜져요</span>';
  $('#ownGrid').innerHTML = CHARS.map((c) => {
    const own = save.owned[c.id];
    return `<button class="key card ${own ? '' : 'lock'} ${save.deck.includes(c.id) ? 'in' : ''} ${selChar === c.id ? 'sel' : ''}" data-id="${c.id}">
      ${own > 1 ? `<span class="cnt">×${own}</span>` : ''}<div class="em">${own ? c.e : '❔'}</div><div>${rarDot(c)}${own ? c.name : '???'}</div><div class="cost">⚡${c.cost}</div></button>`;
  }).join('');
  const info = $('#charInfo');
  const c = CHAR_BY_ID[selChar];
  info.classList.toggle('on', !!c);
  if (c) {
    const inDeck = save.deck.includes(c.id);
    const dps = c.itv > 0 && c.dmg ? ` · 초당 ${(c.dmg / c.itv * (1 + (c.crit || 0) * ((c.critMul || 2) - 1))).toFixed(1)}` : '';
    info.innerHTML = `<div class="em">${c.e}</div><div class="tx"><b>${c.name}</b> <span style="color:${RARITY[c.rar].color}">${RARITY[c.rar].name}</span> · <span style="color:${ATTR[c.attr].color}">${ATTR[c.attr].icon}${ATTR[c.attr].name}</span><br>${c.desc}<br><span style="color:#a855f7">✨ 강화 특수 · ${SPECIAL[spKey(c)].name}: ${SPECIAL[spKey(c)].per}</span><br>⚡${c.cost}${c.range ? ` · 사거리 ${c.range}` : ''}${dps}</div>
      <button class="key ${inDeck ? '' : 'primary'}" id="btnToggle">${inDeck ? '빼기' : '넣기'}</button>`;
    $('#btnToggle').onclick = () => {
      if (inDeck) save.deck = save.deck.filter((id) => id !== c.id);
      else if (save.deck.length >= 5) { toast('덱은 5명까지예요. 먼저 한 명을 빼 주세요'); return; }
      else save.deck.push(c.id);
      persist();
      renderDeck();
    };
  }
}
$('#deck').addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (!b) return;
  if (!save.owned[b.dataset.id]) { toast('아직 만나지 못한 캐릭터예요'); return; }
  selChar = selChar === b.dataset.id ? null : b.dataset.id;
  renderDeck();
});

// ---------- 뽑기 ----------
const gachaRng = mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0);
function renderGacha() {
  const rows = [['영웅 확정', 'hero', 2], ['전설 확정', 'legend', 3], ['신화 확정', 'myth', 4]];
  $('#pityBox').innerHTML = rows.map(([label, k, r]) => {
    const left = PITY[k] - save.pity[k];
    return `<div class="row"><span style="color:${RARITY[r].color}">${label}</span><div class="track"><div class="fill" style="width:${(save.pity[k] / PITY[k]) * 100}%;background:${RARITY[r].color}"></div></div><span>${left}회 남음</span></div>`;
  }).join('');
  $('#rates').innerHTML = `확률: ${RARITY.map((r) => `<span style="color:${r.color}">${r.name} ${(r.rate * 100).toFixed(1)}%</span>`).join(' · ')}<br>
    천장: 영웅 ${PITY.hero}회 · 전설 ${PITY.legend}회 · 신화 ${PITY.myth}회 안에 확정 (천장은 해당 등급을 지급)`;
  $('#pull1').disabled = save.gems < PULL_COST;
  $('#pull10').disabled = save.gems < PULL_COST * 10;
  refreshGems();
}
function pull(n) {
  if (save.gems < PULL_COST * n) { toast('젬이 부족해요. 스테이지를 클리어해 모아 보세요'); return; }
  save.gems -= PULL_COST * n;
  const got = [];
  for (let i = 0; i < n; i++) {
    const c = gachaPull(save.pity, gachaRng);
    const isNew = !save.owned[c.id];
    save.owned[c.id] = (save.owned[c.id] || 0) + 1;
    got.push({ c, isNew });
  }
  save.pulls += n;
  persist();
  renderGacha();
  gachaShow(got);
}
// 연출: 상자를 세 번 두드려 열고(빛 색이 최고 등급을 예고), 뒤집힌 키캡을 하나씩 눌러 공개
function gachaShow(got) {
  const top = Math.max(...got.map((g) => g.c.rar));
  modal(`<div class="gbox-wrap"><div class="gbox" id="gbox" style="--glow:${RARITY[top].color}">🎁</div><p id="gboxHint">상자를 두드려 여세요 (0/3)</p></div>`);
  let taps = 0;
  const box = $('#gbox');
  box.onclick = () => {
    taps++;
    Sfx.play('tap');
    box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
    box.style.setProperty('--lv', taps);
    $('#gboxHint').textContent = `상자를 두드려 여세요 (${taps}/3)`;
    if (taps >= 3) setTimeout(reveal, 260);
  };
  function reveal() {
    Sfx.play(top >= 3 ? 'rare' : 'up');
    modal(`<h3>누가 나왔을까?</h3><div class="results ${got.length === 1 ? 'one' : ''}">${got.map((g, i) =>
      `<button class="rcard back" data-i="${i}" style="animation-delay:${i * 0.06}s"><span class="q">?</span></button>`).join('')}</div>
      <p>키를 눌러 한 명씩 확인하세요. 이미 가진 캐릭터는 조각(×N)으로 쌓여요.</p>
      <div class="btns"><button class="key" id="mAll">모두 열기</button><button class="key primary" id="mOk" hidden>확인</button></div>`);
    let left = got.length;
    const open = (el) => {
      if (!el.classList.contains('back')) return;
      const { c, isNew } = got[+el.dataset.i];
      el.classList.remove('back');
      el.classList.add('open');
      el.style.animationDelay = '0s';
      el.style.borderColor = RARITY[c.rar].color;
      if (c.rar >= 2) el.style.boxShadow = `0 0 ${6 + c.rar * 5}px ${RARITY[c.rar].color}`;
      el.innerHTML = `${isNew ? '<span class="new">NEW</span>' : ''}<div class="em">${c.e}</div><div>${c.name}</div><div style="color:${RARITY[c.rar].color}">${RARITY[c.rar].name}</div>`;
      Sfx.play(c.rar >= 3 ? 'rare' : 'flip');
      if (c.rar >= 3) { const sh = $('#sheet'); sh.classList.remove('flash'); void sh.offsetWidth; sh.style.setProperty('--glow', RARITY[c.rar].color); sh.classList.add('flash'); }
      if (--left === 0) { $('#mAll').hidden = true; $('#mOk').hidden = false; }
    };
    $$('#sheet .rcard').forEach((el) => (el.onclick = () => open(el)));
    $('#mAll').onclick = () => $$('#sheet .rcard.back').forEach((el, i) => setTimeout(() => open(el), i * 110));
    $('#mOk').onclick = closeModal;
  }
}
$('#pull1').onclick = () => pull(1);
$('#pull10').onclick = () => pull(10);

// ---------- 전투 ----------
const cv = $('#board');
const boardCtx = cv.getContext('2d');
let ctx = boardCtx; // 지금 그리는 캔버스 (디펜스 판 또는 난투 필드)
const Battle = {
  g: null, stage: 1, raf: 0, last: 0, acc: 0, speed: 1, sel: null, selTower: null, hover: null, bot: null, parts: [], kick: new Map(), flash: new Map(), shake: 0, hurt: 0, ts: 40, shownWave: -1,
  start(stage) {
    this.stage = stage;
    ctx = boardCtx;
    this.g = new Game({ deck: save.deck, stage, seed: (Date.now() >>> 0) || 1, fx: true, waitStart: true });
    this.flash.clear(); this.shake = 0; this.hurt = 0; this.done = false;
    this.sel = null; this.selTower = null; this.hover = null; this.bot = null; this.parts = []; this.kick.clear(); this.acc = 0; this.shownWave = -1;
    $('#btnAuto').classList.remove('on');
    go('battle');
    this.renderHand();
    this.renderChips();
    this.previewRange = 0; this.white = 0;
    this.resize(); // 카드와 시너지 칩이 자리를 잡은 뒤에 전투판 크기를 잼
    this.hidePanel();
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
      if (this.g) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  stop() { cancelAnimationFrame(this.raf); this.g = null; },
  resize() {
    const wrap = $('#boardWrap');
    cv.style.width = cv.style.height = '0px'; // 캔버스가 영역을 밀어내지 않게 비운 뒤 측정
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ts = Math.floor(Math.min(wrap.clientWidth / MAP.cols, (wrap.clientHeight - 16) / MAP.rows));
    this.ts = Math.max(18, ts);
    cv.style.width = this.ts * MAP.cols + 'px';
    cv.style.height = this.ts * MAP.rows + 'px';
    cv.width = this.ts * MAP.cols * dpr;
    cv.height = this.ts * MAP.rows * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },
  renderHand() {
    const g = this.g;
    $('#hand').innerHTML = g.deck.map((c) => `<button class="key hcard" data-id="${c.id}" style="border-bottom-color:${RARITY[c.rar].color}">
      <span class="n"></span><div class="em">${c.e}</div><div>${c.name}</div><div class="cost">⚡${c.cost}</div></button>`).join('');
  },
  updateHud() {
    const g = this.g;
    $('#hudHearts').textContent = g.hearts;
    $('#hudEnergy').textContent = Math.floor(g.energy);
    $('#hudWave').textContent = `🌊 ${Math.max(0, g.waveIdx + 1)}/${g.waves.length}`;
    const next = g.waves[g.waveIdx + 1];
    $('#hudNext').textContent = next ? '다음 ' + next.types.map((t) => ENEMIES[t].e).join('') : '마지막!';
    $$('#hand .hcard').forEach((el) => {
      const c = CHAR_BY_ID[el.dataset.id];
      el.classList.toggle('poor', g.energy < c.cost);
      el.classList.toggle('sel', this.sel === c.id);
      el.querySelector('.n').textContent = `${g.countOf(c.id)}/${c.max || RULES.maxCopies}`;
    });
    if (this.selTower) this.showPanel(this.selTower);
    $('#startBox').classList.toggle('on', !g.started);
    // 기술 버튼과 다음 웨이브 부르기
    const bl = $('#skBlast');
    bl.style.setProperty('--p', Math.round(g.blast * 100) + '%');
    bl.classList.toggle('ready', g.blast >= 1);
    bl.querySelector('small').textContent = g.blast >= 1 ? '준비 완료!' : `처치로 충전 ${Math.floor(g.blast * 100)}%`;
    const ch = $('#skCheer');
    const cdMax = SKILL.cheerCd / (1 + g.pk.charge);
    ch.style.setProperty('--p', Math.round((1 - Math.max(0, g.cheerCd) / cdMax) * 100) + '%');
    ch.classList.toggle('ready', g.cheerCd <= 0);
    ch.classList.toggle('active', g.cheerT > 0);
    ch.querySelector('small').textContent = g.cheerT > 0 ? `공속 ×${SKILL.cheerMul} ${g.cheerT.toFixed(1)}초` : g.cheerCd > 0 ? `${Math.ceil(g.cheerCd)}초 뒤` : '준비 완료!';
    const nx = $('#btnNext');
    nx.disabled = !g.canCallNext();
    const eb = g.earlyBonus();
    nx.querySelector('small').textContent = g.waveIdx >= g.waves.length - 1 ? '마지막 웨이브' : !g.canCallNext() ? '적 등장 중' : eb ? `일찍 부르면 +${eb}⚡` : '바로 시작';
  },
  // 캐릭터 정보 패널: 현재 능력치, 갈래별 강화(전 → 후), 조준 방식, 판매
  showPanel(t) {
    const g = this.g;
    if (!g.towers.includes(t)) { this.hidePanel(); return; }
    this.selTower = t;
    const p = $('#towerPanel');
    const def = t.def;
    const tracks = tracksOf(def);
    const lv = g.levelOf(t);
    const key = [t.id, lv, t.mode, g.perks.length, ...tracks.map((k) => (g.whyNoUp(t, k) ? 0 : 1))].join(':');
    $('#pKills') && ($('#pKills').textContent = t.kills);
    $('#pDealt') && ($('#pDealt').textContent = Math.round(t.dealt).toLocaleString());
    if (p.dataset.key === key && p.classList.contains('on')) return;
    p.dataset.key = key;
    const opening = !p.classList.contains('on');
    p.classList.add('on');
    $('#hand').style.display = 'none';
    if (opening) requestAnimationFrame(() => this.g && this.resize()); // 패널 높이만큼 전투판을 줄여 전체가 보이게
    const s = t.s;
    const f1 = (v) => (Math.round(v * 10) / 10).toString();
    const pct = (v) => Math.round(v * 100) + '%';
    // 특수 갈래가 지금 주는 값
    const spVal = (o) => ({
      slow: `감속 ${pct(o.slow)}`, poison: `독 ${f1(o.poison)}/초`, vuln: `받는 피해 +${pct(o.vuln)}`, knock: `밀어내기 ${f1(o.knock)}칸`, pull: `끌어당김 ${f1(o.pull)}칸`,
      zone: `장판 반경 ${f1(o.zoneR)}칸`, aura: o.auraSpd ? `아군 공속 +${pct(o.auraSpd)}` : `아군 피해 +${pct(o.auraDmg)}`, income: `5초마다 +${o.income}⚡`,
      sleep: `수면 ${f1(o.sleep)}초`, confuse: `혼란 ${o.confN}기`, seal: `봉인 ${o.seal}초`, crit: `치명타 ${pct(o.crit)}`, splash: `폭발 반경 ${f1(o.splash)}칸`,
      hunter: `보스·정예 피해 +${pct(0.25 * o.sp)}`, opener: `체력 절반 이상 적에게 +${pct(0.2 * o.sp)}`, double: `연타 확률 ${pct(0.15 * o.sp)}`,
    }[o.key]);
    const val = (o, k) => k === 'dmg' ? (def.zone ? `${f1(o.zoneDps)}/초` : f1(o.dmg))
      : k === 'spd' ? `${(def.itv > 0 ? o.itv : o.pulseEvery).toFixed(2)}초`
        : k === 'rng' ? `${f1(o.range)}칸` : spVal(o);
    const stats = [];
    if (def.itv > 0) {
      stats.push(`💥 ${def.zone ? f1(s.zoneDps * t.dmgMul) + '/초' : f1(s.dmg * t.dmgMul)}`, `⚡ ${(s.itv / t.spdMul).toFixed(2)}초`);
    }
    if (s.range > 0) stats.push(`🎯 ${f1(s.range)}칸`);
    if (s.dps > 0) stats.push(`<b>초당 ${f1(s.dps * t.dmgMul * t.spdMul)}</b>`);
    stats.push(`<span style="color:${TRACKS.sp.color}">✨ ${spVal(s)}</span>`);
    const buff = t.dmgMul > 1 || t.spdMul > 1.001 ? `<small class="buff">버프 적용 중: ${t.dmgMul > 1 ? '피해 +' + pct(t.dmgMul - 1) + ' ' : ''}${t.spdMul > 1.001 ? '공속 +' + pct(t.spdMul - 1) : ''}</small>` : '';
    const ups = tracks.map((k) => {
      const n = t.up[k];
      const pips = '■'.repeat(n) + '□'.repeat(UP.max - n);
      const maxed = n >= UP.max;
      const capped = !maxed && lv >= UP.total;
      const next = g.calc(def, { ...t.up, [k]: n + 1 });
      const why = g.whyNoUp(t, k);
      return `<button class="key upb" data-track="${k}" ${why ? 'data-off="1"' : ''} style="--tc:${TRACKS[k].color}">
        <span class="t">${TRACKS[k].icon} ${k === 'sp' ? SPECIAL[s.key].name : TRACKS[k].name} <i>${pips}</i></span>
        <span class="v">${maxed ? val(s, k) + ' (최대)' : capped ? val(s, k) : `${val(s, k)} → <b>${val(next, k)}</b>`}</span>
        <span class="c">${maxed ? '완료' : capped ? '합계 한도' : '⚡' + g.upCost(t, k)}</span></button>`;
    }).join('');
    const modeName = (MODES.find((m) => m.id === t.mode) || MODES[0]).name;
    p.innerHTML = `<div class="tp-head"><span class="em">${def.e}</span>
        <div class="nm"><b>${def.name}</b> <small style="color:${RARITY[def.rar].color}">${RARITY[def.rar].name}</small> <small>강화 ${lv}/${UP.total}</small><br>
        <small>처치 <b id="pKills">${t.kills}</b> · 누적 피해 <b id="pDealt">${Math.round(t.dealt).toLocaleString()}</b></small></div>
        <button class="key mini" id="pClose">✕</button></div>
      <div class="tp-stats">${stats.join(' · ')} ${buff}</div>
      <div class="tp-ups n${tracks.length}">${ups}</div>
      <div class="tp-foot">${def.itv > 0 ? `<button class="key" id="pMode">조준: ${modeName} ⟳</button>` : '<span></span>'}<button class="key" id="pSell">판매 +${g.refundOf(t)}⚡</button></div>`;
    p.querySelectorAll('.upb').forEach((b) => {
      const k = b.dataset.track;
      b.onclick = () => {
        const why = g.whyNoUp(t, k);
        if (why) { toast(why); return; }
        g.upgrade(t, k);
        Sfx.play('up');
      };
      if (k === 'rng') {
        b.onpointerenter = () => { if (t.up.rng < UP.max) this.previewRange = g.calc(def, { ...t.up, rng: t.up.rng + 1 }).range; };
        b.onpointerleave = () => { this.previewRange = 0; };
      }
    });
    $('#pClose').onclick = () => this.hidePanel();
    if (!opening) this.resize();
    const pm = $('#pMode');
    if (pm) pm.onclick = () => { t.mode = MODES[(MODES.findIndex((m) => m.id === t.mode) + 1) % MODES.length].id; Sfx.play('flip'); };
    $('#pSell').onclick = () => { g.sell(t); Sfx.play('coin'); this.hidePanel(); };
  },
  hidePanel() {
    const was = $('#towerPanel').classList.contains('on');
    this.selTower = null; this.previewRange = 0;
    $('#towerPanel').classList.remove('on');
    $('#hand').style.display = '';
    if (was && this.g) this.resize();
  },
  tap(c, r) {
    const g = this.g;
    if (!g || g.result) return;
    const t = g.grid.get(c + ',' + r);
    if (t) {
      this.sel = null;
      if (this.selTower === t) this.hidePanel(); else this.showPanel(t);
      return;
    }
    this.hidePanel();
    if (!this.sel) { if (!MAP.isPath(c, r)) toast('아래에서 캐릭터를 먼저 골라 주세요'); return; }
    const why = g.whyNot(this.sel, c, r);
    if (why) { toast(why); return; }
    g.place(this.sel, c, r);
    Sfx.play('place');
    if (g.energy < CHAR_BY_ID[this.sel].cost) this.sel = null;
  },
  // 특성 카드 3장 중 1장 고르기
  showPerks() {
    const g = this.g;
    modal(`<h3>특성 카드 ${g.perksGiven + 1}/5</h3><p>하나를 골라 이번 전투 내내 적용하세요.</p>
      <div class="perk-row">${g.perkOffer.map((p, i) => `<button class="key perk" data-i="${i}"><span class="em">${p.e}</span><b>${p.name}</b><small>${p.text}</small></button>`).join('')}</div>`);
    $$('#sheet .perk').forEach((b) => (b.onclick = () => {
      g.pickPerk(+b.dataset.i);
      Sfx.play('rare');
      closeModal();
      this.renderChips();
      if (this.selTower) $('#towerPanel').dataset.key = '';
    }));
  },
  renderChips() {
    const g = this.g;
    $('#battleSyn').innerHTML = g.syn.active.map((s) => `<span class="chip" style="color:${ATTR[s.attr].color}">${ATTR[s.attr].icon} ${s.text}</span>`).join('')
      + (g.perks.length ? `<button class="chip perks" id="perkChip">${g.perks.map((p) => p.e).join('')} 특성 ${g.perks.length}</button>` : '');
    const pc = $('#perkChip');
    if (pc) pc.onclick = () => {
      modal(`<h3>적용 중인 특성</h3><div class="enemy-list">${g.perks.map((p) => `<div><span>${p.e}</span><b>${p.name}</b><small>${p.text}</small></div>`).join('')}</div><div class="btns"><button class="key primary" id="mOk">확인</button></div>`);
      $('#mOk').onclick = closeModal;
    };
  },
  frame(dt) {
    const g = this.g;
    if (!g) return;
    if (g.perkOffer && !g.result && !$('#modal').classList.contains('on')) {
      if (this.bot) { this.bot.tick(0); this.renderChips(); } else this.showPerks();
    }
    if (!g.result && !$('#modal').classList.contains('on')) {
      this.acc += dt * this.speed;
      let n = 0;
      while (this.acc >= 0.05 && n++ < 12) {
        this.acc -= 0.05;
        if (this.bot) this.bot.tick(0.05);
        g.step(0.05);
        if (g.result) break;
      }
      if (n >= 12) this.acc = 0;
    }
    this.consumeFx();
    this.draw(dt);
    this.updateHud();
    if (g.result && !this.done) { this.done = true; setTimeout(() => this.finish(), 600); }
  },
  consumeFx() {
    const g = this.g;
    const push = (o, life) => this.parts.push({ ...o, t: 0, life });
    const sparks = (x, y, n, color, power) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = power * (0.4 + Math.random() * 0.8);
        push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color }, 0.22 + Math.random() * 0.15);
      }
    };
    for (const ev of g.fx) {
      if (ev.k === 'shot') {
        const l = Math.hypot(ev.x2 - ev.x1, ev.y2 - ev.y1) || 1;
        this.kick.set(ev.tid, { t: 0.14, dx: (ev.x2 - ev.x1) / l, dy: (ev.y2 - ev.y1) / l });
        push(ev, 0.1);
        Sfx.play('shot');
      } else if (ev.k === 'lunge') {
        const l = Math.hypot(ev.x2 - ev.x1, ev.y2 - ev.y1) || 1;
        this.kick.set(ev.tid, { t: 0.14, dx: (ev.x2 - ev.x1) / l, dy: (ev.y2 - ev.y1) / l });
      } else if (ev.k === 'boss') {
        this.shake = 8;
        Sfx.play('boom');
        toast('보스 등장!');
      } else if (ev.k === 'hit') {
        // 맞은 적은 하얗게 번쩍이며 움찔하고, 피해 숫자와 파편이 튐
        this.flash.set(ev.id, 0.13);
        if (ev.n >= 1) push({ k: 'num', x: ev.x + (Math.random() - 0.5) * 0.3, y: ev.y, n: Math.round(ev.n), crit: ev.crit }, ev.crit ? 0.7 : 0.5);
        sparks(ev.x, ev.y, ev.crit ? 7 : 3, ev.crit ? '#ff4d6d' : '#fff', ev.crit ? 4 : 2.6);
        if (ev.crit) this.shake = Math.max(this.shake, 3);
        Sfx.play(ev.crit ? 'crit' : 'hit');
      } else if (ev.k === 'die') {
        this.flash.delete(ev.id);
        push({ k: 'pop', x: ev.x, y: ev.y, e: ev.e, size: ev.size || (ev.boss ? 1.05 : ev.elite ? 0.72 : 0.56) }, 0.28);
        if (ev.b) push({ k: 'gain', x: ev.x, y: ev.y, n: Math.round(ev.b) }, 0.7);
        sparks(ev.x, ev.y, ev.boss ? 26 : 8, '#ffd24d', ev.boss ? 6 : 3.4);
        if (ev.boss) { this.shake = 12; push({ k: 'die', x: ev.x, y: ev.y, boss: true }, 0.8); }
        Sfx.play(ev.boss ? 'boom' : 'die');
      } else if (ev.k === 'splash') {
        push(ev, 0.3);
        if (ev.big) { this.shake = Math.max(this.shake, 6); Sfx.play('boom'); }
      } else if (ev.k === 'up') {
        push({ k: 'ring', x: ev.x, y: ev.y, color: TRACKS[ev.track].color }, 0.45);
        push({ k: 'float', x: ev.x, y: ev.y, tx: TRACKS[ev.track].icon + '▲' }, 0.7);
      } else if (ev.k === 'blast') {
        this.shake = 16; this.white = 0.35;
        Sfx.play('boom');
      } else if (ev.k === 'cheer') {
        Sfx.play('rare');
      } else if (ev.k === 'combo') {
        push({ k: 'float', x: MAP.cols / 2 - 0.5, y: 0.6, tx: `콤보 ${ev.n}!  +${SKILL.comboBonus}⚡`, big: true }, 1.1);
        Sfx.play('coin');
      } else if (ev.k === 'bonus') {
        push({ k: 'float', x: MAP.cols / 2 - 0.5, y: 1.4, tx: `일찍 부르기 +${ev.n}⚡`, big: true }, 1.1);
        Sfx.play('coin');
      } else if (ev.k === 'leak') {
        this.shake = 9; this.hurt = 0.4;
        Sfx.play('leak');
        if (navigator.vibrate) navigator.vibrate(60);
      } else if (ev.k === 'wave') {
        const w = g.waves[ev.n - 1];
        const b = $('#waveBanner');
        b.textContent = `웨이브 ${ev.n} ${w.boss ? '· 보스!' : w.elite ? '· 정예' : ''} ${w.types.map((t) => ENEMIES[t].e).join(' ')}`;
        b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
      } else {
        if (ev.k === 'coin') Sfx.play('coin');
        push(ev, ev.k === 'coin' || ev.k === 'heal' || ev.k === 'ink' ? 0.8 : 0.3);
      }
    }
    g.fx.length = 0;
    if (this.parts.length > 500) this.parts.splice(0, this.parts.length - 500);
  },
  emoji(e, x, y, size, alpha = 1) { drawEmoji(e, x, y, size, alpha); },
  draw(dt) {
    const g = this.g;
    const ts = this.ts;
    const P = (v) => (v + 0.5) * ts;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    if (this.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake *= Math.pow(0.002, dt); // 빠르게 잦아드는 흔들림
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 바닥: 놓을 수 있는 칸은 키캡, 길은 모래색
    ctx.fillStyle = '#cfeab4';
    ctx.fillRect(0, 0, ts * MAP.cols, ts * MAP.rows);
    for (let c = 0; c < MAP.cols; c++) {
      for (let r = 0; r < MAP.rows; r++) {
        const x = c * ts;
        const y = r * ts;
        if (MAP.isPath(c, r)) {
          ctx.fillStyle = '#f6e3b8';
          ctx.fillRect(x, y, ts, ts);
        } else {
          const canPlace = this.sel && g.canBuild(c, r);
          ctx.fillStyle = '#a9d68b';
          rr(x + 2, y + 4, ts - 4, ts - 5, ts * 0.2);
          ctx.fillStyle = canPlace ? '#e9ffd0' : '#c3e8a6';
          rr(x + 2, y + 2, ts - 4, ts - 6, ts * 0.2);
        }
      }
    }
    this.emoji('🕳️', P(-0.25), P(1), ts * 0.7);
    this.emoji('💛', P(10.35), P(5) + Math.sin(g.t * 3) * 2, ts * 0.85);

    // 장판
    for (const z of g.zones) {
      ctx.fillStyle = `rgba(120,200,60,${0.12 + 0.18 * Math.min(1, z.t)})`;
      circle(P(z.x), P(z.y), z.r * ts, true);
    }
    // 사거리 표시
    const showRange = (x, y, range, ok) => {
      if (range <= 0) return;
      ctx.fillStyle = ok ? 'rgba(59,42,74,.08)' : 'rgba(229,72,77,.10)';
      circle(P(x), P(y), range * ts, true);
      ctx.strokeStyle = ok ? 'rgba(59,42,74,.35)' : 'rgba(229,72,77,.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      circle(P(x), P(y), range * ts, false);
      ctx.setLineDash([]);
    };
    if (this.selTower) {
      showRange(this.selTower.x, this.selTower.y, this.selTower.range, true);
      if (this.previewRange) { // 사거리 강화 버튼에 올리면 강화 후 범위를 미리 보여 줌
        ctx.strokeStyle = TRACKS.rng.color;
        ctx.lineWidth = 2.5;
        circle(P(this.selTower.x), P(this.selTower.y), this.previewRange * ts, false);
      }
    }
    if (this.sel && this.hover && MAP.inBounds(this.hover.c, this.hover.r)) {
      showRange(this.hover.c, this.hover.r, g.rangeOf(CHAR_BY_ID[this.sel]), g.canBuild(this.hover.c, this.hover.r));
    }

    // 아군: 쏠 때 표적 쪽으로 튕겨 나갔다 돌아옴
    for (const t of g.towers) {
      const k = this.kick.get(t.id);
      let a = 0;
      if (k && k.t > 0) { k.t -= dt; a = Math.max(0, k.t / 0.14); }
      const lv = g.levelOf(t);
      const size = ts * (0.68 + 0.025 * lv) * (1 + a * 0.16);
      const x = P(t.x) + (k ? k.dx * ts * 0.18 * a : 0);
      const y = P(t.y) - ts * 0.06 + (k ? k.dy * ts * 0.18 * a : 0);
      if (t.def.rar >= 3) {
        ctx.fillStyle = RARITY[t.def.rar].color + '33';
        circle(P(t.x), P(t.y), ts * 0.48, true);
      }
      if (g.cheerT > 0) {
        ctx.strokeStyle = `rgba(245,163,0,${0.5 + 0.4 * Math.sin(g.t * 14)})`;
        ctx.lineWidth = 3;
        circle(P(t.x), P(t.y), ts * 0.46, false);
      }
      this.emoji(t.def.e, x, y, size, t.disT > 0 ? 0.35 : 1);
      if (t.disT > 0) this.emoji('🖤', x, y, ts * 0.4);
      // 강화 단계: 갈래 색 점으로 표시
      if (lv) {
        const d = ts * 0.11;
        let i = 0;
        for (const k of ['dmg', 'spd', 'rng', 'sp']) {
          for (let n = 0; n < t.up[k]; n++, i++) {
            ctx.fillStyle = '#fff';
            circle(P(t.x) + (i - (lv - 1) / 2) * d, P(t.y) + ts * 0.4, d * 0.5, true);
            ctx.fillStyle = TRACKS[k].color;
            circle(P(t.x) + (i - (lv - 1) / 2) * d, P(t.y) + ts * 0.4, d * 0.36, true);
          }
        }
      }
    }
    // 적
    for (const e of g.enemies) {
      let f = this.flash.get(e.id) || 0;
      if (f > 0) { f -= dt; this.flash.set(e.id, f); }
      const fa = Math.max(0, f) / 0.13;
      const x = P(e.x) + (Math.random() - 0.5) * ts * 0.12 * fa;
      const y = P(e.y) + (Math.random() - 0.5) * ts * 0.12 * fa;
      const size = ts * (e.boss ? 1.05 : e.elite ? 0.72 : 0.56) * (1 + 0.25 * fa);
      if (e.slowT > 0) { ctx.fillStyle = 'rgba(80,160,255,.3)'; circle(x, y, size * 0.6, true); }
      if (e.poisonT > 0) { ctx.fillStyle = 'rgba(110,200,60,.35)'; circle(x, y + size * 0.3, size * 0.35, true); }
      if (e.vulnT > 0) { ctx.strokeStyle = 'rgba(236,72,153,.7)'; ctx.lineWidth = 2; circle(x, y, size * 0.62, false); }
      this.emoji(e.def.e, x, y, size, e.hidden ? 0.28 : 1);
      if (fa > 0) { ctx.fillStyle = `rgba(255,255,255,${0.6 * fa})`; circle(x, y, size * 0.5, true); }
      if (e.sleepT > 0) this.emoji('💤', x + size * 0.4, y - size * 0.5, ts * 0.3);
      if (e.confT > 0) this.emoji('🌀', x, y - size * 0.6, ts * 0.3);
      if (e.sealT > 0) this.emoji('🚫', x + size * 0.4, y + size * 0.3, ts * 0.24);
      const w = size * 0.9;
      const hp = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(59,42,74,.35)';
      rr(x - w / 2, y - size * 0.72, w, 4, 2);
      ctx.fillStyle = hp > 0.5 ? '#5bc84a' : hp > 0.25 ? '#f5a300' : '#e5484d';
      rr(x - w / 2, y - size * 0.72, w * hp, 4, 2);
    }
    drawParts(this, P, ts, dt);
    this.parts = this.parts.filter((p) => p.t < p.life);
    ctx.restore();
    if (this.hurt > 0) {
      // 마음이 다치면 화면이 붉게 번쩍임
      this.hurt -= dt;
      ctx.fillStyle = `rgba(229,72,77,${0.4 * Math.max(0, this.hurt) / 0.4})`;
      ctx.fillRect(0, 0, ts * MAP.cols, ts * MAP.rows);
    }
    if (this.white > 0) {
      this.white -= dt;
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, this.white) / 0.35 * 0.8})`;
      ctx.fillRect(0, 0, ts * MAP.cols, ts * MAP.rows);
    }
    if (g.combo >= 3) {
      const pop = 1 + 0.3 * Math.max(0, g.comboT - (SKILL.comboWindow - 0.15)) / 0.15;
      ctx.textAlign = 'right';
      ctx.font = `${ts * 0.36 * pop}px Jua, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = g.combo >= 10 ? '#e5484d' : '#f5a300';
      ctx.strokeText(`콤보 x${g.combo}`, ts * MAP.cols - 8, ts * 0.35);
      ctx.fillText(`콤보 x${g.combo}`, ts * MAP.cols - 8, ts * 0.35);
    }
  },
  finish() {
    const g = this.g;
    if (!g) return;
    const n = this.stage;
    Sfx.play(g.result === 'win' ? 'win' : 'lose');
    if (g.result === 'win') {
      const stars = g.stars();
      const prev = save.stars[n] || 0;
      const reward = prev === 0 ? 300 + stars * 100 : Math.max(0, stars - prev) * 100 + 30;
      save.stars[n] = Math.max(prev, stars);
      save.gems += reward;
      persist();
      modal(`<div class="big">🥳</div><h3>디펜스 1-${n} 클리어!</h3><div class="stars">${starsHtml(stars)}</div>
        <p>남은 마음 ${g.hearts}/${g.maxHearts} · 보상 💎 ${reward}</p>
        <div class="btns"><button class="key" id="mHome">홈</button><button class="key" id="mRetry">다시</button>${n < STAGES.length ? '<button class="key primary" id="mNext">다음 ▶</button>' : ''}</div>`);
    } else {
      modal(`<div class="big">😵</div><h3>마음이 무너졌어요</h3><p>웨이브 ${g.waveIdx + 1}/${g.waves.length}에서 패배</p>
        <p>놓은 캐릭터를 눌러 강화하고, 💥 폭발과 📣 응원을 아껴 두었다가 몰릴 때 써 보세요.</p>
        <div class="btns"><button class="key" id="mHome">홈</button><button class="key" id="mDeck">덱 편성</button><button class="key primary" id="mRetry">다시</button></div>`);
    }
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = () => { closeModal(); fn(); }; };
    on('#mHome', () => go('home'));
    on('#mDeck', () => go('deck'));
    on('#mRetry', () => this.start(n));
    on('#mNext', () => this.start(n + 1));
  },
};
// 타격 효과(탄환·파편·피해 숫자·터짐)를 그림. 디펜스와 난투가 함께 씀.
function drawEmoji(e, x, y, size, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000'; // 컬러 이모지도 fillStyle의 투명도를 따라가므로 불투명으로 고정
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.fillText(e, x, y + size * 0.05);
  ctx.globalAlpha = 1;
}
function drawParts(view, P, ts, dt) {
for (const p of view.parts) {
    p.t += dt;
    const k = Math.min(1, p.t / p.life);
    if (p.k === 'shot') {
      const x = P(p.x1 + (p.x2 - p.x1) * k);
      const y = P(p.y1 + (p.y2 - p.y1) * k);
      const k0 = Math.max(0, k - 0.45);
      const col = p.crit ? '#ff4d6d' : ATTR[p.attr].color;
      ctx.strokeStyle = col;
      ctx.lineCap = 'round';
      ctx.lineWidth = ts * (p.crit ? 0.14 : 0.09);
      ctx.beginPath(); ctx.moveTo(P(p.x1 + (p.x2 - p.x1) * k0), P(p.y1 + (p.y2 - p.y1) * k0)); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = '#fff';
      circle(x, y, ts * (p.crit ? 0.09 : 0.06), true);
    } else if (p.k === 'ring') {
    ctx.strokeStyle = p.color;
    ctx.globalAlpha = 1 - k;
    ctx.lineWidth = 4;
    circle(P(p.x), P(p.y), ts * (0.3 + 0.7 * k), false);
    ctx.globalAlpha = 1;
  } else if (p.k === 'float') {
    ctx.globalAlpha = 1 - k * k;
    ctx.font = `${ts * (p.big ? 0.42 : 0.3)}px Jua, ${EMOJI_FONT}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#3b2a4a';
    ctx.strokeText(p.tx, P(p.x), P(p.y) - ts * (0.3 + 0.5 * k));
    ctx.fillText(p.tx, P(p.x), P(p.y) - ts * (0.3 + 0.5 * k));
    ctx.globalAlpha = 1;
  } else if (p.k === 'spark') {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = p.color;
      circle(P(p.x + p.vx * p.t), P(p.y + p.vy * p.t + 2 * p.t * p.t), ts * 0.05 * (1 - k * 0.5), true);
      ctx.globalAlpha = 1;
    } else if (p.k === 'num') {
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `${ts * (p.crit ? 0.42 : 0.26) * (p.crit ? 1 + 0.5 * Math.max(0, 1 - k * 4) : 1)}px Jua, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = p.crit ? '#e5484d' : '#3b2a4a';
      const tx = p.crit ? p.n + '!' : p.n;
      ctx.strokeText(tx, P(p.x), P(p.y) - ts * (0.45 + 0.5 * k));
      ctx.fillText(tx, P(p.x), P(p.y) - ts * (0.45 + 0.5 * k));
      ctx.globalAlpha = 1;
    } else if (p.k === 'pop') {
      drawEmoji(p.e, P(p.x), P(p.y), ts * p.size * (1 + 0.8 * k), 1 - k);
    } else if (p.k === 'gain') {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#c98a00';
      ctx.font = `${ts * 0.24}px Jua, sans-serif`;
      ctx.fillText(`+${p.n}⚡`, P(p.x), P(p.y) + ts * (0.2 - 0.5 * k));
      ctx.globalAlpha = 1;
    } else if (p.k === 'splash' || p.k === 'pulse') {
      ctx.strokeStyle = p.k === 'pulse' ? `rgba(120,90,220,${1 - k})` : `rgba(240,90,60,${1 - k})`;
      ctx.lineWidth = 3;
      circle(P(p.x), P(p.y), p.r * ts * (0.3 + 0.7 * k), false);
      if (p.e) drawEmoji(p.e, P(p.x), P(p.y) - ts * 0.6 * k, ts * 0.4, 1 - k);
    } else if (p.k === 'beam') {
      ctx.strokeStyle = `rgba(150,110,255,${1 - k})`;
      ctx.lineWidth = ts * 0.16 * (1 - k) + 1;
      ctx.beginPath(); ctx.moveTo(P(p.x1), P(p.y1)); ctx.lineTo(P(p.x2), P(p.y2)); ctx.stroke();
    } else if (p.k === 'die') {
      drawEmoji(p.boss ? '🎉' : '✨', P(p.x), P(p.y) - ts * 0.3 * k, ts * (p.boss ? 1 : 0.4), 1 - k);
    } else if (p.k === 'coin' || p.k === 'heal') {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = p.k === 'coin' ? '#c98a00' : '#ec4899';
      ctx.font = `${ts * 0.3}px Jua, sans-serif`;
      ctx.fillText(p.k === 'coin' ? `+${p.n}⚡` : '+1 ❤', P(p.x), P(p.y) - ts * (0.4 + 0.5 * k));
      ctx.globalAlpha = 1;
    } else if (p.k === 'ink') {
      drawEmoji('💦', P(p.x), P(p.y), ts * (0.5 + 0.5 * k), 1 - k);
    } else if (p.k === 'place') {
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
      ctx.lineWidth = 3;
      circle(P(p.x), P(p.y), ts * (0.3 + 0.4 * k), false);
    }
  }
}
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), h, r);
  ctx.fill();
}
function circle(x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  if (fill) ctx.fill(); else ctx.stroke();
}
const tileAt = (ev) => {
  const b = cv.getBoundingClientRect();
  return { c: Math.floor((ev.clientX - b.left) / Battle.ts), r: Math.floor((ev.clientY - b.top) / Battle.ts) };
};
cv.addEventListener('pointerdown', (ev) => { const p = tileAt(ev); Battle.hover = p; Battle.tap(p.c, p.r); });
cv.addEventListener('pointermove', (ev) => { Battle.hover = tileAt(ev); });
cv.addEventListener('pointerleave', () => { Battle.hover = null; });
$('#hand').onclick = (e) => {
  const b = e.target.closest('[data-id]');
  if (!b || !Battle.g) return;
  Battle.hidePanel();
  Battle.sel = Battle.sel === b.dataset.id ? null : b.dataset.id;
};
$('#btnSpeed').onclick = () => {
  Battle.speed = Battle.speed === 1 ? 2 : Battle.speed === 2 ? 4 : 1;
  $('#btnSpeed').textContent = 'x' + Battle.speed;
};
$('#btnAuto').onclick = () => {
  if (!Battle.g) return;
  Battle.bot = Battle.bot ? null : new Bot(Battle.g, mulberry32(Date.now() >>> 0));
  $('#btnAuto').classList.toggle('on', !!Battle.bot);
  toast(Battle.bot ? '자동 배치 켬 (시뮬레이터와 같은 봇)' : '자동 배치 끔');
};
$('#btnQuit').onclick = () => {
  modal(`<h3>전투를 그만둘까요?</h3><p>진행 상황은 저장되지 않아요.</p><div class="btns"><button class="key" id="mNo">계속하기</button><button class="key primary" id="mYes">나가기</button></div>`);
  $('#mNo').onclick = closeModal;
  $('#mYes').onclick = () => { closeModal(); go('stages'); };
};
$('#skBlast').onclick = () => { const g = Battle.g; if (g && !g.useBlast()) toast(g.blast < 1 ? '적을 처치하면 충전돼요' : '적이 없어요'); };
$('#skCheer').onclick = () => { const g = Battle.g; if (g && !g.useCheer()) toast(`응원은 ${Math.ceil(g.cheerCd)}초 뒤에 쓸 수 있어요`); };
$('#btnNext').onclick = () => { const g = Battle.g; if (g) g.callNext(); };
$('#btnStart').onclick = () => { if (Battle.g) { Battle.g.started = true; Sfx.play('up'); } };
const paintMute = () => $$('.mute-btn').forEach((el) => (el.textContent = save.mute ? '🔇' : '🔊'));
$$('.mute-btn').forEach((el) => (el.onclick = () => { save.mute = !save.mute; persist(); paintMute(); }));
paintMute();

// ---------- 난투 모드 화면 ----------
const av = $('#arena');
const arenaCtx = av.getContext('2d');
const BrawlView = {
  g: null, stage: 1, raf: 0, last: 0, acc: 0, speed: 1, sel: null, parts: [], kick: new Map(), flash: new Map(), shake: 0, hurt: 0, ts: 40, done: false, lastMy: 0,
  consumeFx: Battle.consumeFx,
  start(stage) {
    this.stage = stage;
    ctx = arenaCtx;
    this.g = new Brawl({ deck: save.deck, stage, seed: (Date.now() >>> 0) || 1, fx: true });
    this.sel = null; this.parts = []; this.kick.clear(); this.flash.clear(); this.shake = 0; this.hurt = 0; this.acc = 0; this.done = false;
    this.lastMy = this.g.bases[0].hp;
    go('brawl');
    $('#bHand').innerHTML = this.g.deck.map((c) => `<button class="key hcard" data-id="${c.id}" style="border-bottom-color:${RARITY[c.rar].color}">
      <div class="em">${c.e}</div><div>${c.name}</div><div class="cost">⚡${bcost(c)}</div></button>`).join('');
    this.resize();
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
      if (this.g) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },
  stop() { cancelAnimationFrame(this.raf); this.g = null; },
  resize() {
    const wrap = $('#arenaWrap');
    av.style.width = av.style.height = '0px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.ts = Math.max(16, Math.floor(Math.min(wrap.clientWidth / BR.W, (wrap.clientHeight - 16) / BR.H)));
    av.style.width = this.ts * BR.W + 'px';
    av.style.height = this.ts * BR.H + 'px';
    av.width = this.ts * BR.W * dpr;
    av.height = this.ts * BR.H * dpr;
    arenaCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },
  tap(x, y) {
    const g = this.g;
    if (!g || g.result) return;
    if (!this.sel) { toast('아래에서 내보낼 캐릭터를 먼저 골라 주세요'); return; }
    const why = g.whyNot(this.sel, x, y);
    if (why) { toast(why); return; }
    g.deploy(this.sel, x, y);
    Sfx.play('place');
  },
  frame(dt) {
    const g = this.g;
    if (!g) return;
    ctx = arenaCtx;
    if (!g.result && !$('#modal').classList.contains('on')) {
      this.acc += dt * this.speed;
      let n = 0;
      while (this.acc >= 0.05 && n++ < 8) { this.acc -= 0.05; g.step(0.05); if (g.result) break; }
      if (n >= 8) this.acc = 0;
    }
    if (g.bases[0].hp < this.lastMy - 0.5) { this.hurt = Math.max(this.hurt, 0.2); }
    this.lastMy = g.bases[0].hp;
    this.consumeFx();
    this.draw(dt);
    $('#bMy').textContent = Math.ceil(g.bases[0].hp);
    $('#bEn').textContent = Math.ceil(g.bases[1].hp);
    $('#bTime').textContent = `⏱ ${Math.max(0, Math.ceil(BR.time - g.t))}`;
    $('#eFill').style.width = (g.energy / BR.maxE) * 100 + '%';
    $('#eNum').textContent = `⚡ ${Math.floor(g.energy)} / ${BR.maxE}`;
    $$('#bHand .hcard').forEach((el) => {
      const c = CHAR_BY_ID[el.dataset.id];
      el.classList.toggle('poor', g.energy < bcost(c));
      el.classList.toggle('sel', this.sel === c.id);
    });
    if (g.result && !this.done) { this.done = true; setTimeout(() => this.finish(), 700); }
  },
  draw(dt) {
    const g = this.g;
    const ts = this.ts;
    const P = (v) => v * ts;
    const W = BR.W * ts;
    const H = BR.H * ts;
    ctx.clearRect(0, 0, av.width, av.height);
    ctx.save();
    if (this.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake *= Math.pow(0.002, dt);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 필드: 위는 적 진영, 아래는 내 진영
    ctx.fillStyle = '#c3e8a6';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(120,90,160,.10)';
    ctx.fillRect(0, 0, W, P(BR.deployMinY));
    for (let r = 0; r < BR.H; r++) for (let c = 0; c < BR.W; c++) {
      if ((r + c) % 2) { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(c * ts, r * ts, ts, ts); }
    }
    if (this.sel) {
      ctx.fillStyle = 'rgba(255,240,150,.35)';
      ctx.fillRect(0, P(BR.deployMinY), W, H - P(BR.deployMinY));
    }
    ctx.strokeStyle = 'rgba(59,42,74,.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(0, P(BR.deployMinY)); ctx.lineTo(W, P(BR.deployMinY)); ctx.stroke();
    ctx.setLineDash([]);
    const bar = (x, y, w, ratio, color) => {
      ctx.fillStyle = 'rgba(59,42,74,.35)';
      rr(x - w / 2, y, w, 5, 2.5);
      ctx.fillStyle = color;
      rr(x - w / 2, y, w * Math.max(0, ratio), 5, 2.5);
    };
    // 기지
    for (const b of g.bases) {
      const f = Math.max(0, (this.flash.get(b.id) || 0) / 0.13);
      if (f > 0) this.flash.set(b.id, this.flash.get(b.id) - dt);
      ctx.fillStyle = b.team ? '#5b4a6b' : '#ffe08a';
      rr(P(b.x) - ts * 0.8, P(b.y) - ts * 0.6, ts * 1.6, ts * 1.2, ts * 0.3);
      drawEmoji(b.team ? '🕳️' : '💛', P(b.x), P(b.y), ts * (0.95 + 0.2 * f));
      bar(P(b.x), P(b.y) + (b.team ? ts * 0.7 : -ts * 0.82), ts * 1.6, b.hp / b.maxHp, b.team ? '#e5484d' : '#5bc84a');
    }
    // 유닛 (아래쪽에 있을수록 앞에 그림)
    const us = g.units.slice().sort((a, b) => a.y - b.y);
    for (const u of us) {
      let f = this.flash.get(u.id) || 0;
      if (f > 0) { f -= dt; this.flash.set(u.id, f); }
      const fa = Math.max(0, f) / 0.13;
      const k = this.kick.get(u.id);
      let a = 0;
      if (k && k.t > 0) { k.t -= dt; a = Math.max(0, k.t / 0.14); }
      const x = P(u.x) + (k ? k.dx * ts * 0.22 * a : 0) + (Math.random() - 0.5) * ts * 0.1 * fa;
      const y = P(u.y) + (k ? k.dy * ts * 0.22 * a : 0) + (Math.random() - 0.5) * ts * 0.1 * fa;
      const size = ts * u.size * (1 + 0.22 * fa);
      ctx.fillStyle = 'rgba(40,80,20,.2)';
      ctx.beginPath(); ctx.ellipse(P(u.x), P(u.y) + size * 0.45, size * 0.36, size * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      if (u.slowT > 0) { ctx.fillStyle = 'rgba(80,160,255,.3)'; circle(x, y, size * 0.6, true); }
      if (u.poisonT > 0) { ctx.fillStyle = 'rgba(110,200,60,.35)'; circle(x, y + size * 0.3, size * 0.35, true); }
      drawEmoji(u.e, x, y - (u.fly ? ts * 0.25 : 0), size);
      if (fa > 0) { ctx.fillStyle = `rgba(255,255,255,${0.6 * fa})`; circle(x, y, size * 0.5, true); }
      if (u.stunT > 0) drawEmoji('💤', x + size * 0.4, y - size * 0.5, ts * 0.3);
      bar(x, y - size * 0.72 - (u.fly ? ts * 0.25 : 0), size * 0.9, u.hp / u.maxHp, u.team ? '#e5484d' : '#3b9cff');
    }
    drawParts(this, P, ts, dt);
    this.parts = this.parts.filter((p) => p.t < p.life);
    ctx.restore();
    if (this.hurt > 0) {
      this.hurt -= dt;
      ctx.fillStyle = `rgba(229,72,77,${0.3 * Math.max(0, this.hurt) / 0.2})`;
      ctx.fillRect(0, P(BR.deployMinY), W, H);
    }
  },
  finish() {
    const g = this.g;
    if (!g) return;
    const n = this.stage;
    Sfx.play(g.result === 'win' ? 'win' : 'lose');
    if (g.result === 'win') {
      const stars = g.stars();
      const prev = save.bstars[n] || 0;
      const reward = prev === 0 ? 300 + stars * 100 : Math.max(0, stars - prev) * 100 + 30;
      save.bstars[n] = Math.max(prev, stars);
      save.gems += reward;
      persist();
      modal(`<div class="big">🥳</div><h3>난투 1-${n} 승리!</h3><div class="stars">${starsHtml(stars)}</div>
        <p>내 기지 ${Math.ceil(g.bases[0].hp)}/${g.bases[0].maxHp} · 보상 💎 ${reward}</p>
        <div class="btns"><button class="key" id="mHome">홈</button><button class="key" id="mRetry">다시</button>${n < STAGES.length ? '<button class="key primary" id="mNext">다음 ▶</button>' : ''}</div>`);
    } else {
      modal(`<div class="big">😵</div><h3>${g.bases[0].hp <= 0 ? '기지가 무너졌어요' : '시간 종료 · 판정패'}</h3>
        <p>튼튼한 근접 캐릭터를 앞에, 원거리 캐릭터를 뒤에 내보내 보세요.</p>
        <div class="btns"><button class="key" id="mHome">홈</button><button class="key" id="mDeck">덱 편성</button><button class="key primary" id="mRetry">다시</button></div>`);
    }
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = () => { closeModal(); fn(); }; };
    on('#mHome', () => go('home'));
    on('#mDeck', () => go('deck'));
    on('#mRetry', () => this.start(n));
    on('#mNext', () => this.start(n + 1));
  },
};
av.addEventListener('pointerdown', (ev) => {
  const b = av.getBoundingClientRect();
  BrawlView.tap((ev.clientX - b.left) / BrawlView.ts, (ev.clientY - b.top) / BrawlView.ts);
});
$('#bHand').onclick = (e) => {
  const b = e.target.closest('[data-id]');
  if (b && BrawlView.g) BrawlView.sel = BrawlView.sel === b.dataset.id ? null : b.dataset.id;
};
$('#bSpeed').onclick = () => { BrawlView.speed = BrawlView.speed === 1 ? 2 : 1; $('#bSpeed').textContent = 'x' + BrawlView.speed; };
$('#bQuit').onclick = () => $('#btnQuit').onclick();

// ---------- 설정: 소리, 전체 초기화 ----------
$('#btnSet').onclick = () => {
  modal(`<h3>설정</h3>
    <div class="btns"><button class="key" id="sMute">${save.mute ? '🔇 소리 꺼짐' : '🔊 소리 켜짐'}</button></div>
    <p style="margin-top:16px">전체 초기화는 캐릭터, 젬, 별, 뽑기 천장 기록을 모두 지우고 처음 상태로 되돌립니다.</p>
    <div class="btns"><button class="key danger" id="sReset">🗑️ 게임 전체 초기화</button><button class="key" id="sClose">닫기</button></div>`);
  $('#sMute').onclick = () => { save.mute = !save.mute; persist(); paintMute(); $('#btnSet').onclick(); };
  $('#sClose').onclick = closeModal;
  $('#sReset').onclick = () => {
    modal(`<div class="big">🫥</div><h3>정말 모두 지울까요?</h3><p>되돌릴 수 없어요. 모은 캐릭터 ${Object.keys(save.owned).length}명과 별 ${totalStars()}개가 사라집니다.</p>
      <div class="btns"><button class="key primary" id="rNo">취소</button><button class="key danger" id="rYes">초기화</button></div>`);
    $('#rNo').onclick = closeModal;
    $('#rYes').onclick = () => {
      save = freshSave();
      persist();
      selChar = null;
      mode = 'td';
      closeModal();
      paintMute();
      go('home');
      toast('처음 상태로 되돌렸어요');
    };
  };
};
window.addEventListener('resize', () => { if (Battle.g) Battle.resize(); if (BrawlView.g) BrawlView.resize(); });

// 테스트와 디버깅용 손잡이
window.__game = { Battle, BrawlView, save: () => save, go };
void unitOf; void BR_ENEMY;

go('home');

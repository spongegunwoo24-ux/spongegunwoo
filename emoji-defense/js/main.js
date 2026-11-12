// 이모지 디펜스 — 화면과 입력
import { CHARS, CHAR_BY_ID, STARTER, RARITY, ATTR, PITY, PULL_COST, RULES, MAP, ENEMIES, STAGES, synergyOf, gachaPull, makeWaves, mulberry32 } from './data.js';
import { Game } from './engine.js';
import { Bot } from './bot.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

// ---------- 저장 ----------
const KEY = 'emojiDefense.v1';
function freshSave() {
  const owned = {};
  STARTER.forEach((id) => (owned[id] = 1));
  return { owned, deck: STARTER.slice(0, 5), gems: 1000, stars: {}, pity: { hero: 0, legend: 0, myth: 0 }, pulls: 0 };
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
const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);
const unlocked = (n) => n === 1 || (save.stars[n - 1] || 0) > 0;

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
    $('#homeStars').textContent = `⭐ ${totalStars()}/${STAGES.length * 3}`;
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
  $('#stageList').innerHTML = STAGES.map((st, i) => {
    const n = i + 1;
    const open = unlocked(n);
    const en = [...new Set([...(st.fresh ? [st.fresh] : st.pool.slice(0, 3)), ...Object.values(st.boss || {})])].map((t) => ENEMIES[t].e).join('');
    return `<button class="key stage ${open ? '' : 'locked'} ${st.boss ? 'boss' : ''}" data-stage="${n}">
      <span class="no">1-${n}${st.boss ? ' · 보스' : ''}</span><span class="nm">${open ? st.name : '🔒 잠김'}</span>
      <span class="en">${open ? en : ''}</span><span class="st">${starsHtml(save.stars[n] || 0)}</span></button>`;
  }).join('');
}
$('#stageList').onclick = (e) => {
  const b = e.target.closest('[data-stage]');
  if (!b) return;
  const n = +b.dataset.stage;
  if (!unlocked(n)) { toast('앞 스테이지를 먼저 클리어하세요'); return; }
  const st = STAGES[n - 1];
  const types = [...new Set(makeWaves(n).flatMap((w) => w.types))];
  modal(`<h3>1-${n} ${st.name}</h3><p>웨이브 ${RULES.wavesPerStage}개 · 마음 ${RULES.hearts}</p>
    <div class="enemy-list">${types.map((t) => `<div><span>${ENEMIES[t].e}</span><b>${ENEMIES[t].name}</b><small>${ENEMIES[t].desc}</small></div>`).join('')}</div>
    <div class="btns"><button class="key" id="mCancel">닫기</button><button class="key primary" id="mGo">▶ 출격</button></div>`);
  $('#mCancel').onclick = closeModal;
  $('#mGo').onclick = () => { closeModal(); Battle.start(n); };
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
    info.innerHTML = `<div class="em">${c.e}</div><div class="tx"><b>${c.name}</b> <span style="color:${RARITY[c.rar].color}">${RARITY[c.rar].name}</span> · <span style="color:${ATTR[c.attr].color}">${ATTR[c.attr].icon}${ATTR[c.attr].name}</span><br>${c.desc}<br>⚡${c.cost}${c.range ? ` · 사거리 ${c.range}` : ''}${dps}</div>
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
  modal(`<h3>뽑기 결과</h3><div class="results ${n === 1 ? 'one' : ''}">${got.map(({ c, isNew }, i) =>
    `<div class="rcard" style="border-color:${RARITY[c.rar].color};animation-delay:${i * 0.09}s;${c.rar >= 3 ? `box-shadow:0 0 18px ${RARITY[c.rar].color}` : ''}">
      ${isNew ? '<span class="new">NEW</span>' : ''}<div class="em">${c.e}</div><div>${c.name}</div><div style="color:${RARITY[c.rar].color}">${RARITY[c.rar].name}</div></div>`).join('')}</div>
    <p>이미 가진 캐릭터는 조각(×N)으로 쌓여요. 진화에 쓰일 예정입니다.</p>
    <div class="btns"><button class="key primary" id="mOk">확인</button></div>`);
  $('#mOk').onclick = closeModal;
}
$('#pull1').onclick = () => pull(1);
$('#pull10').onclick = () => pull(10);

// ---------- 전투 ----------
const cv = $('#board');
const ctx = cv.getContext('2d');
const Battle = {
  g: null, stage: 1, raf: 0, last: 0, acc: 0, speed: 1, sel: null, selTower: null, hover: null, bot: null, parts: [], kick: new Map(), ts: 40, shownWave: -1,
  start(stage) {
    this.stage = stage;
    this.g = new Game({ deck: save.deck, stage, seed: (Date.now() >>> 0) || 1, fx: true });
    this.sel = null; this.selTower = null; this.hover = null; this.bot = null; this.parts = []; this.kick.clear(); this.acc = 0; this.shownWave = -1;
    $('#btnAuto').classList.remove('on');
    go('battle');
    this.renderHand();
    const syn = this.g.syn.active;
    $('#battleSyn').innerHTML = syn.map((s) => `<span class="chip" style="color:${ATTR[s.attr].color}">${ATTR[s.attr].icon} ${s.text}</span>`).join('');
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
    $('#hudWave').textContent = `웨이브 ${Math.max(0, g.waveIdx + 1)}/${g.waves.length}`;
    const next = g.waves[g.waveIdx + 1];
    $('#hudNext').textContent = next ? '다음 ' + next.types.map((t) => ENEMIES[t].e).join('') : '마지막!';
    $$('#hand .hcard').forEach((el) => {
      const c = CHAR_BY_ID[el.dataset.id];
      el.classList.toggle('poor', g.energy < c.cost);
      el.classList.toggle('sel', this.sel === c.id);
      el.querySelector('.n').textContent = `${g.countOf(c.id)}/${c.max || RULES.maxCopies}`;
    });
    if (this.selTower) this.showPanel(this.selTower);
  },
  showPanel(t) {
    const g = this.g;
    if (!g.towers.includes(t)) { this.hidePanel(); return; }
    this.selTower = t;
    const p = $('#towerPanel');
    const key = t.id + ':' + t.star + ':' + (g.energy >= t.def.cost);
    if (p.dataset.key === key && p.classList.contains('on')) return;
    p.dataset.key = key;
    p.classList.add('on');
    p.innerHTML = `<span style="font:22px ${EMOJI_FONT}">${t.def.e}</span><span>${t.def.name} ${'★'.repeat(t.star)}</span>
      ${t.star < RULES.maxStar ? `<button class="key up" id="pUp" ${g.energy < t.def.cost ? 'disabled' : ''}>강화 ⚡${t.def.cost}</button>` : '<span style="color:#c98a00">최대</span>'}
      <button class="key" id="pSell">판매 +${Math.floor(t.spent * RULES.refund)}</button>`;
    const up = $('#pUp');
    if (up) up.onclick = () => { g.upgrade(t); };
    $('#pSell').onclick = () => { g.sell(t); this.hidePanel(); };
  },
  hidePanel() { this.selTower = null; $('#towerPanel').classList.remove('on'); },
  tap(c, r) {
    const g = this.g;
    if (!g || g.result) return;
    const t = g.grid.get(c + ',' + r);
    if (t) {
      if (this.sel === t.def.id && t.star < RULES.maxStar) {
        if (!g.upgrade(t)) toast('에너지가 부족해요');
        return;
      }
      this.sel = null;
      this.showPanel(t);
      return;
    }
    this.hidePanel();
    if (!this.sel) { if (!MAP.isPath(c, r)) toast('아래에서 캐릭터를 먼저 골라 주세요'); return; }
    const why = g.whyNot(this.sel, c, r);
    if (why) { toast(why); return; }
    g.place(this.sel, c, r);
    if (g.energy < CHAR_BY_ID[this.sel].cost) this.sel = null;
  },
  frame(dt) {
    const g = this.g;
    if (!g) return;
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
    for (const ev of g.fx) {
      if (ev.k === 'shot') { this.kick.set(ev.tid, 0.12); this.parts.push({ ...ev, t: 0, life: 0.12 }); }
      else if (ev.k === 'wave') {
        const w = g.waves[ev.n - 1];
        const b = $('#waveBanner');
        b.textContent = `웨이브 ${ev.n} ${w.boss ? '· 보스!' : w.elite ? '· 정예' : ''} ${w.types.map((t) => ENEMIES[t].e).join(' ')}`;
        b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
      } else this.parts.push({ ...ev, t: 0, life: ev.k === 'die' ? 0.45 : ev.k === 'coin' || ev.k === 'heal' || ev.k === 'ink' ? 0.8 : 0.3 });
    }
    g.fx.length = 0;
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
  },
  emoji(e, x, y, size, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.font = `${size}px ${EMOJI_FONT}`;
    ctx.fillText(e, x, y + size * 0.05);
    ctx.globalAlpha = 1;
  },
  draw(dt) {
    const g = this.g;
    const ts = this.ts;
    const P = (v) => (v + 0.5) * ts;
    ctx.clearRect(0, 0, cv.width, cv.height);
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
    if (this.selTower) showRange(this.selTower.x, this.selTower.y, this.selTower.range, true);
    if (this.sel && this.hover && MAP.inBounds(this.hover.c, this.hover.r)) {
      showRange(this.hover.c, this.hover.r, g.rangeOf(CHAR_BY_ID[this.sel]), g.canBuild(this.hover.c, this.hover.r));
    }

    // 아군
    for (const t of g.towers) {
      let k = this.kick.get(t.id) || 0;
      if (k > 0) { k -= dt; this.kick.set(t.id, k); }
      const size = ts * (0.66 + 0.07 * t.star) * (1 + Math.max(0, k) * 1.5);
      const x = P(t.x);
      const y = P(t.y) - ts * 0.04;
      if (t.def.rar >= 3) {
        ctx.fillStyle = RARITY[t.def.rar].color + '33';
        circle(x, y, ts * 0.48, true);
      }
      this.emoji(t.def.e, x, y, size, t.disT > 0 ? 0.35 : 1);
      if (t.disT > 0) this.emoji('🖤', x, y, ts * 0.4);
      ctx.fillStyle = '#f5a300';
      ctx.font = `${ts * 0.2}px sans-serif`;
      ctx.fillText('★'.repeat(t.star), x, P(t.y) + ts * 0.38);
    }
    // 적
    for (const e of g.enemies) {
      const x = P(e.x);
      const y = P(e.y);
      const size = ts * (e.boss ? 1.05 : e.elite ? 0.72 : 0.56);
      if (e.slowT > 0) { ctx.fillStyle = 'rgba(80,160,255,.3)'; circle(x, y, size * 0.6, true); }
      if (e.poisonT > 0) { ctx.fillStyle = 'rgba(110,200,60,.35)'; circle(x, y + size * 0.3, size * 0.35, true); }
      if (e.vulnT > 0) { ctx.strokeStyle = 'rgba(236,72,153,.7)'; ctx.lineWidth = 2; circle(x, y, size * 0.62, false); }
      this.emoji(e.def.e, x, y, size, e.hidden ? 0.28 : 1);
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
    // 효과
    for (const p of this.parts) {
      p.t += dt;
      const k = Math.min(1, p.t / p.life);
      if (p.k === 'shot') {
        const x = P(p.x1 + (p.x2 - p.x1) * k);
        const y = P(p.y1 + (p.y2 - p.y1) * k);
        ctx.fillStyle = p.crit ? '#ff4d6d' : '#3b2a4a';
        circle(x, y, p.crit ? ts * 0.11 : ts * 0.07, true);
        if (p.crit && k > 0.8) this.emoji('💥', P(p.x2), P(p.y2), ts * 0.5);
      } else if (p.k === 'splash' || p.k === 'pulse') {
        ctx.strokeStyle = p.k === 'pulse' ? `rgba(120,90,220,${1 - k})` : `rgba(240,90,60,${1 - k})`;
        ctx.lineWidth = 3;
        circle(P(p.x), P(p.y), p.r * ts * (0.3 + 0.7 * k), false);
        if (p.e) this.emoji(p.e, P(p.x), P(p.y) - ts * 0.6 * k, ts * 0.4, 1 - k);
      } else if (p.k === 'beam') {
        ctx.strokeStyle = `rgba(150,110,255,${1 - k})`;
        ctx.lineWidth = ts * 0.16 * (1 - k) + 1;
        ctx.beginPath(); ctx.moveTo(P(p.x1), P(p.y1)); ctx.lineTo(P(p.x2), P(p.y2)); ctx.stroke();
      } else if (p.k === 'die') {
        this.emoji(p.boss ? '🎉' : '✨', P(p.x), P(p.y) - ts * 0.3 * k, ts * (p.boss ? 1 : 0.4), 1 - k);
      } else if (p.k === 'coin' || p.k === 'heal') {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = p.k === 'coin' ? '#c98a00' : '#ec4899';
        ctx.font = `${ts * 0.3}px Jua, sans-serif`;
        ctx.fillText(p.k === 'coin' ? `+${p.n}⚡` : '+1 ❤', P(p.x), P(p.y) - ts * (0.4 + 0.5 * k));
        ctx.globalAlpha = 1;
      } else if (p.k === 'ink') {
        this.emoji('💦', P(p.x), P(p.y), ts * (0.5 + 0.5 * k), 1 - k);
      } else if (p.k === 'place') {
        ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
        ctx.lineWidth = 3;
        circle(P(p.x), P(p.y), ts * (0.3 + 0.4 * k), false);
      }
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
  },
  finish() {
    const g = this.g;
    if (!g) return;
    const n = this.stage;
    if (g.result === 'win') {
      const stars = g.stars();
      const prev = save.stars[n] || 0;
      const reward = prev === 0 ? 300 + stars * 100 : Math.max(0, stars - prev) * 100 + 30;
      save.stars[n] = Math.max(prev, stars);
      save.gems += reward;
      persist();
      modal(`<div class="big">🥳</div><h3>1-${n} 클리어!</h3><div class="stars">${starsHtml(stars)}</div>
        <p>남은 마음 ${g.hearts}/${g.maxHearts} · 보상 💎 ${reward}</p>
        <div class="btns"><button class="key" id="mHome">홈</button><button class="key" id="mRetry">다시</button>${n < STAGES.length ? '<button class="key primary" id="mNext">다음 ▶</button>' : ''}</div>`);
    } else {
      modal(`<div class="big">😵</div><h3>마음이 무너졌어요</h3><p>웨이브 ${g.waveIdx + 1}/${g.waves.length}에서 패배</p>
        <p>덱을 바꾸거나, 같은 캐릭터를 눌러 ★강화해 보세요.</p>
        <div class="btns"><button class="key" id="mHome">홈</button><button class="key" id="mDeck">덱 편성</button><button class="key primary" id="mRetry">다시</button></div>`);
    }
    this.done = false;
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = () => { closeModal(); fn(); }; };
    on('#mHome', () => go('home'));
    on('#mDeck', () => go('deck'));
    on('#mRetry', () => this.start(n));
    on('#mNext', () => this.start(n + 1));
  },
};
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
window.addEventListener('resize', () => { if (Battle.g) Battle.resize(); });

// 테스트와 디버깅용 손잡이
window.__game = { Battle, save: () => save, go };

go('home');

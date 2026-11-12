// 이모지 디펜스 — 데이터 정의 (DOM 의존 없음: 브라우저와 시뮬레이터가 함께 씀)

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ATTR = {
  joy: { name: '기쁨', icon: '✨', color: '#f5a300' },
  rage: { name: '분노', icon: '🔥', color: '#e5484d' },
  sad: { name: '슬픔', icon: '💧', color: '#3b82f6' },
  fear: { name: '공포', icon: '⚡', color: '#8b5cf6' },
  calm: { name: '평온', icon: '🍃', color: '#16a085' },
  prank: { name: '장난', icon: '🎈', color: '#f97316' },
};

export const RARITY = [
  { name: '일반', color: '#8b95a5', rate: 0.6 },
  { name: '희귀', color: '#3b82f6', rate: 0.28 },
  { name: '영웅', color: '#a855f7', rate: 0.09 },
  { name: '전설', color: '#f59e0b', rate: 0.027 },
  { name: '신화', color: '#ec4899', rate: 0.003 },
];

export const PITY = { hero: 10, legend: 60, myth: 150 };
export const PULL_COST = 100;

// 상시 캐릭터 22명. 거리 단위는 칸, 시간은 초.
export const CHARS = [
  // 일반
  { id: 'smile', e: '🙂', name: '미소', rar: 0, attr: 'joy', cost: 50, dmg: 5.5, itv: 0.5, range: 2.5, desc: '빠르게 한 명씩 공격' },
  { id: 'angry', e: '😠', name: '뿔남', rar: 0, attr: 'rage', cost: 70, dmg: 12, itv: 1.5, range: 2.0, splash: 1.0, desc: '주변까지 터지는 광역 공격' },
  { id: 'sad', e: '🙁', name: '시무룩', rar: 0, attr: 'sad', cost: 60, dmg: 6, itv: 1.0, range: 2.5, slow: { pct: 0.25, dur: 2 }, desc: '맞은 적을 25% 느리게' },
  { id: 'wow', e: '😮', name: '깜짝', rar: 0, attr: 'fear', cost: 60, dmg: 9, itv: 1.0, range: 2.0, crit: 0.25, critMul: 3, desc: '25% 확률로 3배 치명타' },
  { id: 'neutral', e: '😐', name: '무덤덤', rar: 0, attr: 'calm', cost: 70, dmg: 13, itv: 1.6, range: 3.5, desc: '멀리까지 닿는 공격' },
  { id: 'tongue', e: '😛', name: '메롱', rar: 0, attr: 'prank', cost: 60, dmg: 3, itv: 1.0, range: 2.5, poison: { dps: 5, dur: 3 }, desc: '독을 묻혀 지속 피해' },
  // 희귀
  { id: 'huff', e: '😤', name: '씩씩', rar: 1, attr: 'rage', cost: 110, dmg: 30, itv: 1.5, range: 1.5, splash: 0.9, desc: '가까운 적 무리에 강한 콧김' },
  { id: 'cold', e: '🥶', name: '꽁꽁', rar: 1, attr: 'sad', cost: 110, dmg: 6, itv: 1.2, range: 2.5, splash: 1.2, slow: { pct: 0.3, dur: 2 }, desc: '범위 안의 적을 30% 느리게' },
  { id: 'sneeze', e: '🤧', name: '에취', rar: 1, attr: 'sad', cost: 110, dmg: 32, itv: 2.5, range: 2.0, knock: 0.8, desc: '재채기로 적을 밀어냄' },
  { id: 'fear', e: '😨', name: '덜덜', rar: 1, attr: 'fear', cost: 110, dmg: 17, itv: 1.0, range: 2.0, crit: 0.25, critMul: 3, desc: '강한 치명타 공격' },
  { id: 'cool', e: '😎', name: '쿨가이', rar: 1, attr: 'calm', cost: 120, dmg: 40, itv: 2.5, range: 5.0, target: 'strong', desc: '가장 튼튼한 적을 저격' },
  { id: 'sick', e: '🤢', name: '울렁', rar: 1, attr: 'prank', cost: 110, dmg: 0, itv: 2.5, range: 2.5, zone: { r: 1.0, dps: 11, dur: 4 }, desc: '독 장판을 깔아 지속 피해' },
  // 영웅
  { id: 'party', e: '🥳', name: '파티', rar: 2, attr: 'joy', cost: 150, dmg: 0, itv: 0, range: 2.0, aura: { spd: 0.25 }, desc: '주변 아군 공격속도 +25%' },
  { id: 'money', e: '🤑', name: '돈돈', rar: 2, attr: 'joy', cost: 120, dmg: 0, itv: 0, range: 0, income: { amt: 10, every: 5 }, max: 2, desc: '5초마다 에너지 +10 (최대 2기)' },
  { id: 'plead', e: '🥺', name: '글썽', rar: 2, attr: 'sad', cost: 140, dmg: 8, itv: 1.0, range: 3.0, vuln: { pct: 0.15, dur: 4 }, desc: '맞은 적이 받는 피해 +15%' },
  { id: 'sleepy', e: '😴', name: '쿨쿨', rar: 2, attr: 'calm', cost: 140, dmg: 0, itv: 0, range: 2.0, pulse: { every: 6, sleep: 2 }, desc: '6초마다 주변 적을 재움' },
  { id: 'cowboy', e: '🤠', name: '카우', rar: 2, attr: 'prank', cost: 150, dmg: 45, itv: 3.0, range: 3.0, pull: 1.5, desc: '올가미로 적을 뒤로 끌어당김' },
  // 전설
  { id: 'angel', e: '😇', name: '천사', rar: 3, attr: 'joy', cost: 220, dmg: 0, itv: 0, range: 2.5, aura: { dmg: 0.2 }, heal: { every: 10 }, desc: '주변 아군 피해 +20%, 마음 회복' },
  { id: 'boom', e: '🤯', name: '펑', rar: 3, attr: 'rage', cost: 250, dmg: 100, itv: 3.0, range: 3.0, splash: 1.5, desc: '넓은 범위 대폭발' },
  { id: 'ghost', e: '👻', name: '유령', rar: 3, attr: 'fear', cost: 230, dmg: 36, itv: 1.0, range: 3.0, pierce: true, detect: true, crit: 0.2, critMul: 3, desc: '일직선 관통, 숨은 적 감지' },
  { id: 'clown', e: '🤡', name: '삐에로', rar: 3, attr: 'prank', cost: 240, dmg: 38, itv: 1.5, range: 3.0, pulse: { every: 6, confuse: 2.5, n: 4 }, desc: '적 4기를 혼란시켜 뒤로 걷게 함' },
  // 신화
  { id: 'void', e: '🫥', name: '공허', rar: 4, attr: 'calm', cost: 260, dmg: 75, itv: 1.0, range: 3.5, seal: 3, desc: '맞은 적의 특수능력을 봉인' },
];
export const CHAR_BY_ID = Object.fromEntries(CHARS.map((c) => [c.id, c]));
export const STARTER = ['smile', 'angry', 'sad', 'wow', 'neutral', 'tongue'];

export const RULES = {
  startEnergy: 250,
  hearts: 20,
  maxUnits: 12,
  maxCopies: 3,
  maxStar: 3,
  refund: 0.7,
  slowCap: 0.6,
  ccResetTime: 5,
  bossCcFactor: 0.3,
  firstWaveDelay: 5,
  waveDelay: 3,
  wavesPerStage: 10,
};

// 덱 속성 시너지: 2명(소) / 4명(대)
const SYN = {
  joy: [0.08, 0.2],
  rage: [0.1, 0.25],
  sad: [0.05, 0.12],
  fear: [0.06, 0.15],
  calm: [0.3, 0.8],
  prank: [0.15, 0.4],
};
const SYN_TEXT = {
  joy: (v) => `공속 +${Math.round(v * 100)}%`,
  rage: (v) => `광역 피해 +${Math.round(v * 100)}%`,
  sad: (v) => `감속 +${Math.round(v * 100)}%p`,
  fear: (v) => `치명타 +${Math.round(v * 100)}%p`,
  calm: (v) => `사거리 +${v}칸`,
  prank: (v) => `상태이상 지속 +${Math.round(v * 100)}%`,
};
export function synergyOf(deckIds) {
  const cnt = {};
  for (const id of deckIds) {
    const c = CHAR_BY_ID[id];
    if (c) cnt[c.attr] = (cnt[c.attr] || 0) + 1;
  }
  const val = {};
  const active = [];
  for (const a of Object.keys(SYN)) {
    const n = cnt[a] || 0;
    val[a] = n >= 4 ? SYN[a][1] : n >= 2 ? SYN[a][0] : 0;
    if (val[a]) active.push({ attr: a, n, text: SYN_TEXT[a](val[a]) });
  }
  return { spd: val.joy, aoe: val.rage, slow: val.sad, crit: val.fear, range: val.calm, cc: val.prank, active };
}

// ---------- 맵 ----------
function buildPath(pts) {
  const segs = [];
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const l = Math.hypot(x2 - x1, y2 - y1);
    segs.push({ x1, y1, x2, y2, l, start: len });
    len += l;
  }
  return { pts, segs, len };
}
export function posAt(path, d, out) {
  const segs = path.segs;
  let s = segs[0];
  for (let i = 0; i < segs.length; i++) {
    s = segs[i];
    if (d <= s.start + s.l) break;
  }
  const t = Math.max(0, Math.min(1, (d - s.start) / s.l));
  out.x = s.x1 + (s.x2 - s.x1) * t;
  out.y = s.y1 + (s.y2 - s.y1) * t;
  return out;
}

const WAYPOINTS = [[-1, 1], [2, 1], [2, 5], [5, 5], [5, 1], [8, 1], [8, 5], [11, 5]];
const pathTiles = new Set();
for (let i = 0; i < WAYPOINTS.length - 1; i++) {
  const [x1, y1] = WAYPOINTS[i];
  const [x2, y2] = WAYPOINTS[i + 1];
  const n = Math.abs(x2 - x1) + Math.abs(y2 - y1);
  for (let k = 0; k <= n; k++) {
    pathTiles.add(`${x1 + Math.sign(x2 - x1) * k},${y1 + Math.sign(y2 - y1) * k}`);
  }
}
export const MAP = {
  cols: 11,
  rows: 7,
  ground: buildPath(WAYPOINTS),
  air: buildPath([WAYPOINTS[0], WAYPOINTS[WAYPOINTS.length - 1]]),
  isPath: (c, r) => pathTiles.has(`${c},${r}`),
  inBounds: (c, r) => c >= 0 && r >= 0 && c < 11 && r < 7,
};

// ---------- 적 (챕터 1: 동물·자연 탭) ----------
// hpf: 같은 예산에서 체력 보정(빠르거나 까다로운 적은 낮게), count: 웨이브 w에서의 기본 마릿수
export const ENEMIES = {
  ant: { e: '🐜', name: '개미', speed: 1.0, gap: 0.6, hpf: 1.0, count: (w) => 7 + w, desc: '떼로 몰려오는 기본 적' },
  bee: { e: '🐝', name: '벌', speed: 1.7, gap: 0.45, hpf: 0.65, count: (w) => 6 + w, desc: '아주 빠름' },
  boar: { e: '🐗', name: '멧돼지', speed: 0.6, gap: 2.2, hpf: 1.0, count: (w) => 2 + Math.floor(w / 3), desc: '느리지만 튼튼함' },
  bat: { e: '🦇', name: '박쥐', speed: 1.0, gap: 0.9, hpf: 0.5, air: true, count: (w) => 4 + Math.floor(w / 2), desc: '길을 무시하고 날아옴' },
  worm: { e: '🐛', name: '애벌레', speed: 0.8, gap: 1.0, hpf: 0.8, regen: 0.03, count: (w) => 4 + Math.floor(w / 2), desc: '체력을 계속 회복' },
  turtle: { e: '🐢', name: '거북', speed: 0.65, gap: 1.6, hpf: 0.8, armor: 3, count: (w) => 2 + Math.floor(w / 3), desc: '껍질이 피해를 3 줄임' },
  lizard: { e: '🦎', name: '도마뱀', speed: 1.1, gap: 0.9, hpf: 0.8, stealth: true, count: (w) => 4 + Math.floor(w / 2), desc: '주기적으로 숨어서 조준 불가' },
  bear: { e: '🐻', name: '곰', speed: 0.5, gap: 0, hpf: 1.0, boss: true, count: () => 1, desc: '중간 보스' },
  octo: { e: '🐙', name: '문어', speed: 0.45, gap: 0, hpf: 1.0, boss: true, ink: true, count: () => 1, desc: '먹물로 아군을 잠시 멈춤' },
};

export const STAGES = [
  { name: '풀밭 입구', pool: ['ant'], fresh: 'ant' },
  { name: '꽃밭', pool: ['ant', 'bee'], fresh: 'bee' },
  { name: '덤불 숲', pool: ['ant', 'bee', 'boar'], fresh: 'boar' },
  { name: '어두운 동굴', pool: ['ant', 'bee', 'boar', 'bat'], fresh: 'bat' },
  { name: '곰의 굴', pool: ['ant', 'bee', 'boar', 'bat', 'worm'], fresh: 'worm', boss: { 10: 'bear' } },
  { name: '연못가', pool: ['ant', 'bee', 'boar', 'bat', 'worm', 'turtle'], fresh: 'turtle' },
  { name: '바위 언덕', pool: ['ant', 'bee', 'boar', 'bat', 'worm', 'turtle', 'lizard'], fresh: 'lizard' },
  { name: '깊은 숲', pool: ['bee', 'boar', 'bat', 'worm', 'turtle', 'lizard'], fresh: null },
  { name: '해안 절벽', pool: ['bee', 'boar', 'bat', 'worm', 'turtle', 'lizard'], fresh: null },
  { name: '문어의 바다', pool: ['ant', 'bee', 'boar', 'bat', 'worm', 'turtle', 'lizard'], fresh: null, boss: { 5: 'bear', 10: 'octo' } },
];

// 스테이지별 체력 배율 (시뮬레이터로 조정하는 값)
export const STAGE_MULT = [0.75, 0.85, 0.95, 1.05, 1.1, 1.25, 1.35, 1.45, 1.55, 1.7];

export function waveReward(w) {
  return 80 + 35 * w;
}
// 웨이브 w가 시작될 때까지 벌 수 있는 누적 에너지
export function energyBy(w) {
  let e = RULES.startEnergy;
  for (let i = 1; i < w; i++) e += waveReward(i);
  return e;
}
// 적 총체력은 그 시점의 누적 에너지에 비례 (에너지 1당 체력 2.4)
export function waveBudget(w) {
  return 2.4 * energyBy(w);
}

export function makeWaves(stage) {
  const st = STAGES[stage - 1];
  const rng = mulberry32(7777 + stage * 131);
  const mult = STAGE_MULT[stage - 1];
  const waves = [];
  for (let w = 1; w <= RULES.wavesPerStage; w++) {
    const budget = waveBudget(w) * mult;
    const reward = waveReward(w);
    const boss = st.boss && st.boss[w];
    const pick = () => st.pool[Math.floor(rng() * st.pool.length)];
    let main = st.fresh && (w === 1 || w % 3 === 2) ? st.fresh : pick();
    let sub = null;
    if (w >= 3 && st.pool.length > 1) {
      for (let k = 0; k < 6 && (!sub || sub === main); k++) sub = pick();
      if (sub === main) sub = null;
    }
    const elite = !boss && w >= 4 && rng() < 0.25; // 정예 웨이브: 수는 절반, 체력은 두 배
    const groups = boss
      ? [{ type: boss, share: 0.55 }, { type: main, share: 0.45 }]
      : sub
        ? [{ type: main, share: 0.65 }, { type: sub, share: 0.35 }]
        : [{ type: main, share: 1 }];
    const spawns = [];
    groups.forEach((g, gi) => {
      const def = ENEMIES[g.type];
      let n = Math.max(1, Math.round(def.count(w) * g.share * (elite ? 0.5 : 1)));
      if (def.boss) n = 1;
      const hp = (budget * g.share * def.hpf) / n;
      const bounty = (reward * g.share) / n;
      for (let i = 0; i < n; i++) {
        spawns.push({ t: gi * 1.5 + i * def.gap * (elite ? 1.6 : 1), type: g.type, hp, bounty, elite });
      }
    });
    spawns.sort((a, b) => a.t - b.t);
    waves.push({ spawns, types: groups.map((g) => g.type), elite, boss: !!boss });
  }
  return waves;
}

// ---------- 뽑기 ----------
export function gachaPull(pity, rng) {
  pity.hero++;
  pity.legend++;
  pity.myth++;
  const R = RARITY.map((r) => r.rate);
  let rar;
  const rollFrom = (min) => {
    let tot = 0;
    for (let i = min; i < R.length; i++) tot += R[i];
    let x = rng() * tot;
    for (let i = min; i < R.length; i++) {
      x -= R[i];
      if (x < 0) return i;
    }
    return R.length - 1;
  };
  // 천장은 해당 등급을 정확히 지급 (상위 등급으로 튀지 않음 → 공개 확률과 실측이 일치)
  if (pity.myth >= PITY.myth) rar = 4;
  else if (pity.legend >= PITY.legend) rar = 3;
  else if (pity.hero >= PITY.hero) rar = 2;
  else rar = rollFrom(0);
  if (rar >= 4) pity.myth = 0;
  if (rar >= 3) pity.legend = 0;
  if (rar >= 2) pity.hero = 0;
  const pool = CHARS.filter((c) => c.rar === rar);
  return pool[Math.floor(rng() * pool.length)];
}

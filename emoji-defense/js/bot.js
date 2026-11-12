// 자동 배치 봇 — 시뮬레이터와 게임 내 "자동" 버튼이 함께 씀
import { MAP, RULES, UP, posAt, tracksOf } from './data.js';

const samples = [];
{
  const p = { x: 0, y: 0 };
  for (let d = 0; d <= MAP.ground.len; d += 0.25) {
    posAt(MAP.ground, d, p);
    samples.push({ x: p.x, y: p.y, w: 1 });
  }
  for (let d = 0; d <= MAP.air.len; d += 0.25) {
    posAt(MAP.air, d, p);
    samples.push({ x: p.x, y: p.y, w: 0.35 });
  }
}
const covCache = new Map();
function coverage(c, r, range) {
  const rr = Math.round(range * 4) / 4;
  const key = c + ',' + r + ',' + rr;
  let v = covCache.get(key);
  if (v === undefined) {
    v = 0;
    for (const s of samples) if ((s.x - c) ** 2 + (s.y - r) ** 2 <= rr * rr) v += s.w;
    covCache.set(key, v);
  }
  return v;
}

const roleOf = (def) =>
  def.income ? 'econ'
    : def.aura || (def.pulse && !def.dmg) ? 'support'
      : def.slow || def.vuln || def.knock || def.pull || def.pulse ? 'ctrl'
        : 'dmg';
const isAtk = (def) => def.itv > 0;
// 특성 카드 선호 순서 (앞일수록 먼저 고름)
const PERK_ORDER = ['dmg', 'a_', 'spd', 'bounty', 'crit', 'boss', 'sale', 'range', 'aoe', 'dot', 'cash', 'mud', 'cc', 'charge', 'heart', 'refund'];

export class Bot {
  // novice: 사람 초보를 흉내 — 느리게 반응하고 자리 선택이 엉성하며 강화·기술을 잘 안 씀
  constructor(game, rng, { novice = false } = {}) {
    this.novice = novice;
    this.g = game;
    this.rng = rng;
    this.want = null;
    this.waited = 0;
    this.acc = 0;
  }
  tick(dt) {
    const g = this.g;
    g.started = true;
    if (g.perkOffer) {
      let best = 0;
      if (this.novice) best = Math.floor(this.rng() * g.perkOffer.length);
      else {
        let bi = 99;
        g.perkOffer.forEach((p, i) => {
          const k = PERK_ORDER.findIndex((o) => p.id.startsWith(o));
          if (k >= 0 && k < bi) { bi = k; best = i; }
        });
      }
      g.pickPerk(best);
    }
    this.acc += dt;
    const every = this.novice ? 3 : 0.5;
    if (this.acc < every) return;
    this.acc = 0;
    this.waited += every;
    const boss = g.enemies.some((e) => e.boss);
    if (g.blast >= 1 && (g.enemies.length >= (this.novice ? 8 : 5) || boss)) g.useBlast();
    if (!this.novice && g.cheerCd <= 0 && (g.enemies.length >= 6 || boss)) g.useCheer();
    for (let i = 0; i < (this.novice ? 1 : 4); i++) if (!this.act()) break;
  }
  counts() {
    const c = { econ: 0, support: 0, dmg: 0, ctrl: 0, by: {} };
    for (const t of this.g.towers) {
      c[roleOf(t.def)]++;
      c.by[t.def.id] = (c.by[t.def.id] || 0) + 1;
    }
    return c;
  }
  canNew(def) {
    const g = this.g;
    return g.towers.length < RULES.maxUnits && g.countOf(def.id) < (def.max || RULES.maxCopies);
  }
  pickNew() {
    const g = this.g;
    const c = this.counts();
    const avail = g.deck.filter((d) => this.canNew(d));
    const dmg = avail.filter((d) => roleOf(d) === 'dmg');
    const econ = avail.filter((d) => roleOf(d) === 'econ');
    const lim = c.dmg >= 5 ? 2 : 1;
    const sup = avail.filter((d) => (roleOf(d) === 'support' || roleOf(d) === 'ctrl') && (c.by[d.id] || 0) < lim);
    if (econ.length && c.dmg + c.ctrl >= 1 && g.waveIdx <= 2) return econ[0];
    let pool;
    if (c.dmg < 2 && dmg.length) {
      const cheap = dmg.filter((d) => d.cost <= Math.max(g.energy, 130));
      pool = cheap.length ? cheap : [dmg.slice().sort((a, b) => a.cost - b.cost)[0]];
    } else {
      pool = dmg.concat(sup);
    }
    if (!pool.length) pool = avail.filter((d) => isAtk(d) && roleOf(d) !== 'econ');
    if (!pool.length) return null;
    const late = g.waveIdx >= 3;
    let tot = 0;
    const ws = pool.map((d) => {
      const w = late ? d.cost : 100;
      tot += w;
      return w;
    });
    let x = this.rng() * tot;
    for (let i = 0; i < pool.length; i++) {
      x -= ws[i];
      if (x < 0) return pool[i];
    }
    return pool[pool.length - 1];
  }
  // 강화할 캐릭터와 갈래를 고름: 좋은 자리에 있는 캐릭터부터, 공격력과 공속을 번갈아
  pickUp() {
    const g = this.g;
    let best = null;
    for (const t of g.towers) {
      if (g.levelOf(t) >= UP.total) continue;
      const tracks = tracksOf(t.def).filter((k) => t.up[k] < UP.max);
      if (!tracks.length) continue;
      const role = roleOf(t.def);
      const s = coverage(t.col, t.row, t.range || 2.5) * (role === 'dmg' ? 1 : role === 'ctrl' ? 0.6 : 0.35) * (0.8 + this.rng() * 0.4) / (1 + g.levelOf(t) * 0.25);
      if (!best || s > best.s) best = { t, s, tracks };
    }
    if (!best) return null;
    const { t, tracks } = best;
    let track;
    const r = this.rng();
    if (this.novice) track = tracks[Math.floor(r * tracks.length)];
    else if (roleOf(t.def) === 'dmg' || roleOf(t.def) === 'ctrl') {
      const main = ['dmg', 'spd'].filter((k) => tracks.includes(k)).sort((a, b) => t.up[a] - t.up[b]);
      track = r < 0.14 && tracks.includes('rng') ? 'rng' : r < 0.32 && tracks.includes('sp') ? 'sp' : main[0] || tracks[0];
    } else track = tracks.includes('sp') ? 'sp' : tracks[0];
    return { t, track };
  }
  pickWant() {
    const g = this.g;
    const def = this.pickNew();
    const up = this.novice && g.towers.length < RULES.maxUnits && def ? null : this.pickUp();
    if (def && (!up || g.towers.length < 5 || this.rng() < 0.4)) return { def, cost: def.cost };
    if (up) return { up, cost: g.upCost(up.t, up.track) };
    return def ? { def, cost: def.cost } : null;
  }
  bestTile(def) {
    const g = this.g;
    const role = roleOf(def);
    const cand = [];
    for (let c = 0; c < MAP.cols; c++) {
      for (let r = 0; r < MAP.rows; r++) {
        if (!g.canBuild(c, r)) continue;
        let s;
        if (role === 'econ') {
          s = -coverage(c, r, 2.5);
        } else if (def.aura) {
          const R = g.rangeOf(def);
          s = 0;
          for (const t of g.towers) {
            if (isAtk(t.def) && (t.x - c) ** 2 + (t.y - r) ** 2 <= R * R) s += t.spent;
          }
          s -= coverage(c, r, 2.5) * 2;
        } else {
          s = coverage(c, r, g.rangeOf(def));
          for (const t of g.towers) {
            if (t.def.aura && (t.x - c) ** 2 + (t.y - r) ** 2 <= t.range * t.range) s *= 1.15;
          }
        }
        cand.push({ c, r, s });
      }
    }
    if (!cand.length) return null;
    cand.sort((a, b) => b.s - a.s);
    return cand[Math.floor(this.rng() * Math.min(this.novice ? Math.ceil(cand.length * 0.6) : 3, cand.length))];
  }
  act() {
    const g = this.g;
    if (g.result) return false;
    const w = this.want;
    const stale = !w || (w.def && !this.canNew(w.def)) || (w.up && (!g.towers.includes(w.up.t) || g.whyNoUp(w.up.t, w.up.track) === '이 갈래는 최대예요' || g.levelOf(w.up.t) >= UP.total));
    if (stale) {
      this.want = this.pickWant();
      this.waited = 0;
    }
    if (!this.want) return g.towers.length >= RULES.maxUnits ? this.swap() : false;
    if (g.energy < this.want.cost) {
      // 너무 오래 기다렸으면 다시 고름
      if (this.waited > 15) { this.want = null; this.waited = 0; }
      return false;
    }
    const want = this.want;
    this.want = null;
    if (want.up) return g.upgrade(want.up.t, want.up.track);
    const tile = this.bestTile(want.def);
    return tile ? !!g.place(want.def.id, tile.c, tile.r) : false;
  }
  // 12칸이 꽉 차고 강화할 것도 없으면 가장 적게 투자한 공격 캐릭터를 팔고 더 비싼 것으로 교체
  swap() {
    const g = this.g;
    let worst = null;
    for (const t of g.towers) {
      if (!isAtk(t.def)) continue;
      if (!worst || t.spent < worst.spent) worst = t;
    }
    if (!worst) return false;
    const refund = g.refundOf(worst);
    const opts = g.deck.filter(
      (d) => isAtk(d) && d.cost >= worst.spent * 1.4 && d.cost <= g.energy + refund && g.countOf(d.id) - (d === worst.def ? 1 : 0) < (d.max || RULES.maxCopies),
    );
    if (!opts.length) return false;
    const best = opts.sort((a, b) => b.cost - a.cost)[0];
    const { col, row } = worst;
    g.sell(worst);
    return !!g.place(best.id, col, row);
  }
}

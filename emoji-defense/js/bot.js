// 자동 배치 봇 — 시뮬레이터와 게임 내 "자동" 버튼이 함께 씀
import { MAP, RULES, posAt } from './data.js';

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
  const key = c + ',' + r + ',' + range;
  let v = covCache.get(key);
  if (v === undefined) {
    v = 0;
    for (const s of samples) if ((s.x - c) ** 2 + (s.y - r) ** 2 <= range * range) v += s.w;
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

export class Bot {
  constructor(game, rng) {
    this.g = game;
    this.rng = rng;
    this.want = null;
    this.waited = 0;
    this.acc = 0;
  }
  tick(dt) {
    this.acc += dt;
    if (this.acc < 0.5) return;
    this.acc = 0;
    this.waited += 0.5;
    for (let i = 0; i < 4; i++) if (!this.act()) break;
  }
  counts() {
    const c = { econ: 0, support: 0, dmg: 0, ctrl: 0, by: {} };
    for (const t of this.g.towers) {
      c[roleOf(t.def)] += t.star;
      c.by[t.def.id] = (c.by[t.def.id] || 0) + t.star;
    }
    return c;
  }
  canNew(def) {
    const g = this.g;
    return g.towers.length < RULES.maxUnits && g.countOf(def.id) < (def.max || RULES.maxCopies);
  }
  mergeTarget(def) {
    let best = null;
    for (const t of this.g.towers) {
      if (t.def !== def || t.star >= RULES.maxStar) continue;
      const s = coverage(t.col, t.row, t.range || 2.5);
      if (!best || s > best.s) best = { t, s };
    }
    return best;
  }
  pickWant() {
    const g = this.g;
    const c = this.counts();
    const avail = g.deck.filter((d) => this.canNew(d) || this.mergeTarget(d));
    const dmg = avail.filter((d) => roleOf(d) === 'dmg');
    const econ = avail.filter((d) => roleOf(d) === 'econ');
    const lim = c.dmg >= 9 ? 3 : c.dmg >= 5 ? 2 : 1;
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
    // 후반으로 갈수록 비싼 캐릭터를 선호
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
            if (isAtk(t.def) && (t.x - c) ** 2 + (t.y - r) ** 2 <= R * R) s += t.def.cost;
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
    return cand[Math.floor(this.rng() * Math.min(3, cand.length))];
  }
  act() {
    const g = this.g;
    if (g.result) return false;
    if (!this.want || !(this.canNew(this.want) || this.mergeTarget(this.want))) {
      this.want = this.pickWant();
      this.waited = 0;
    }
    if (!this.want) return g.towers.length >= RULES.maxUnits ? this.swap() : false;
    const def = this.want;
    if (g.energy < def.cost) {
      // 너무 오래 기다렸으면 지금 살 수 있는 것으로 바꿈
      if (this.waited > 15) {
        const aff = g.deck.filter((d) => d.cost <= g.energy && isAtk(d) && (this.canNew(d) || this.mergeTarget(d)));
        if (aff.length) {
          this.want = aff.sort((a, b) => b.cost - a.cost)[0];
          this.waited = 0;
          return true;
        }
      }
      return false;
    }
    this.want = null;
    const merge = this.mergeTarget(def);
    const tile = this.canNew(def) ? this.bestTile(def) : null;
    // 새로 놓을지, 좋은 자리의 기존 캐릭터를 강화할지
    let doMerge = !!merge && !tile;
    if (merge && tile) {
      if (roleOf(def) === 'dmg') doMerge = merge.s >= tile.s && !(g.towers.length < 5 && this.rng() < 0.5);
      else doMerge = g.countOf(def.id) >= 1;
    }
    if (doMerge) return g.upgrade(merge.t);
    if (tile) return !!g.place(def.id, tile.c, tile.r);
    return false;
  }
  // 12칸이 꽉 차고 강화할 것도 없으면 가장 적게 투자한 공격 캐릭터를 팔고 더 비싼 것으로 교체
  swap() {
    const g = this.g;
    let worst = null;
    for (const t of g.towers) {
      if (roleOf(t.def) === 'econ' && g.waveIdx >= 5) { worst = t; break; }
      if (!isAtk(t.def)) continue;
      if (!worst || t.spent < worst.spent) worst = t;
    }
    if (!worst) return false;
    const refund = Math.floor(worst.spent * RULES.refund);
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

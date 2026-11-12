// 이모지 디펜스 — 난투 모드 엔진: 캐릭터를 필드에 내보내면 스스로 걸어가 싸움 (DOM 의존 없음)
import { CHAR_BY_ID, STAGES, mulberry32 } from './data.js';

export const BR = {
  W: 7, H: 11,
  maxE: 10, startE: 5, regen: 0.55, // 에너지: 초당 0.55, 최대 10
  time: 150,
  myBase: { x: 3.5, y: 10.2 }, enBase: { x: 3.5, y: 0.8 },
  baseHp: 1000, baseDmg: 14, baseItv: 0.8, baseRange: 2.6,
  deployMinY: 5.6,
};
// 디펜스 비용(50~260)을 난투 에너지(1~7)로 환산
// 공격하지 않는 지원형은 1 싸게
export const bcost = (c) => Math.max(1, Math.round(c.cost / 40) - (c.dmg > 0 || c.zone ? 0 : 1));

// 디펜스 캐릭터 정의에서 난투 유닛 능력치를 만듦: 사거리 2 이하는 근접(튼튼), 그 외는 원거리(약함)
export function unitOf(c) {
  const attacker = c.dmg > 0 || !!c.zone;
  const melee = attacker && c.range <= 2.0;
  return {
    e: c.e, src: c, attr: c.attr,
    hp: Math.round(c.cost * (melee ? 5.5 : c.income ? 2 : 3.2)),
    dmg: c.zone ? c.zone.dps * 1.6 : c.dmg,
    itv: c.zone ? 1.6 : c.itv,
    range: !attacker ? 0 : melee ? 0.75 : 1.2 + (c.range - 2) * 0.9,
    speed: c.income ? 0 : melee ? 0.95 : 0.75,
    melee, attacker,
    splash: c.splash ? Math.min(1.2, c.splash) : c.zone ? 1.0 : c.pierce ? 0.9 : 0,
    slow: c.slow, poison: c.poison || (c.zone ? { dps: 4, dur: 3 } : null), crit: c.crit || 0, critMul: c.critMul || 2,
    knock: c.knock || (c.pull ? 0.6 : 0), vuln: c.vuln, seal: c.seal,
    aura: c.aura, heal: c.heal ? { every: 2, amt: 30, r: 2.4 } : null,
    pulse: c.pulse ? { every: 6, stun: c.pulse.sleep ? 1.5 : 1.2, r: 1.8 } : null,
    income: c.income ? { every: 5, amt: 1 } : null, life: c.income ? 35 : 0,
    size: 0.62 + c.rar * 0.04,
  };
}

// 적 유닛 (동물 탭). cost는 적 AI가 쓰는 에너지, n은 한 번에 나오는 수
export const BR_ENEMY = {
  ant: { hp: 60, dmg: 8, itv: 1.0, speed: 1.0, n: 3, cost: 2, size: 0.45 },
  bee: { hp: 42, dmg: 9, itv: 0.7, speed: 1.6, n: 2, cost: 2, size: 0.45 },
  boar: { hp: 430, dmg: 26, itv: 1.4, speed: 0.6, n: 1, cost: 4, size: 0.75 },
  bat: { hp: 85, dmg: 11, itv: 1.0, speed: 1.2, n: 2, cost: 3, size: 0.5, fly: true },
  worm: { hp: 210, dmg: 10, itv: 1.0, speed: 0.8, n: 1, cost: 3, size: 0.55, regen: 0.04 },
  turtle: { hp: 300, dmg: 16, itv: 1.3, speed: 0.55, n: 1, cost: 4, size: 0.65, armor: 3 },
  lizard: { hp: 130, dmg: 22, itv: 0.9, speed: 1.15, n: 1, cost: 3, size: 0.55, sniper: true },
  bear: { hp: 1500, dmg: 55, itv: 1.5, speed: 0.5, n: 1, cost: 0, size: 1.1, boss: true },
  octo: { hp: 1500, dmg: 45, itv: 1.2, speed: 0.45, n: 1, cost: 0, size: 1.2, boss: true, splash: 1.0 },
};
const ENEMY_E = { ant: '🐜', bee: '🐝', boar: '🐗', bat: '🦇', worm: '🐛', turtle: '🐢', lizard: '🦎', bear: '🐻', octo: '🐙' };
// 스테이지별 적 세기: [적 에너지 회복 배율, 능력치 배율, 적 기지 체력 배율] (시뮬레이터로 조정)
export const BR_STAGE = (s) => ({ regen: 0.62 + 0.085 * s, stat: 0.85 + 0.09 * s, base: 0.85 + 0.15 * s });

let uid = 1;

export class Brawl {
  constructor({ deck, stage, seed = 1, fx = false }) {
    this.rng = mulberry32(seed);
    this.deck = deck.map((id) => CHAR_BY_ID[id]);
    this.stage = stage;
    this.st = STAGES[stage - 1];
    this.k = BR_STAGE(stage);
    this.t = 0;
    this.energy = BR.startE;
    this.ee = 2;
    this.units = [];
    this.bases = [
      { team: 0, x: BR.myBase.x, y: BR.myBase.y, hp: BR.baseHp, maxHp: BR.baseHp, cd: 0, id: uid++, isBase: true, size: 1 },
      { team: 1, x: BR.enBase.x, y: BR.enBase.y, hp: Math.round(BR.baseHp * this.k.base), maxHp: Math.round(BR.baseHp * this.k.base), cd: 0, id: uid++, isBase: true, size: 1 },
    ];
    this.result = null;
    this.fxOn = fx;
    this.fx = [];
    this.aiPick = null;
    this.bossQ = Object.values(this.st.boss || {}).map((type, i) => ({ t: 30 + i * 45, type }));
    this.stats = {};
  }
  emit(ev) { if (this.fxOn) this.fx.push(ev); }

  // ---------- 배치 ----------
  whyNot(id, x, y) {
    const c = CHAR_BY_ID[id];
    if (y < BR.deployMinY) return '내 진영(아래쪽)에만 내보낼 수 있어요';
    if (this.energy < bcost(c)) return '에너지가 부족해요';
    return null;
  }
  deploy(id, x, y) {
    if (this.result || this.whyNot(id, x, y)) return null;
    const c = CHAR_BY_ID[id];
    this.energy -= bcost(c);
    const u = this.add(0, unitOf(c), Math.max(0.5, Math.min(BR.W - 0.5, x)), Math.max(BR.deployMinY, Math.min(BR.H - 1.4, y)));
    this.emit({ k: 'place', x: u.x, y: u.y });
    return u;
  }
  add(team, s, x, y) {
    const u = {
      ...s, id: uid++, team, x, y, maxHp: s.hp, cd: 0.3, abilT: 0, incT: 0,
      slowT: 0, slowPct: 0, poisonT: 0, poisonDps: 0, stunT: 0, vulnT: 0, sealT: 0, spdMul: 1, dmgMul: 1, dead: false,
    };
    this.units.push(u);
    return u;
  }
  spawnEnemy(type) {
    const d = BR_ENEMY[type];
    const x = 0.9 + this.rng() * (BR.W - 1.8);
    for (let i = 0; i < d.n; i++) {
      const s = this.k.stat;
      this.add(1, {
        e: ENEMY_E[type], type, attr: 'rage', hp: Math.round(d.hp * s), dmg: d.dmg * s, itv: d.itv, range: 0.7, speed: d.speed,
        melee: true, attacker: true, splash: d.splash || 0, crit: 0, critMul: 2, knock: 0, fly: d.fly, regen: d.regen, armor: d.armor,
        sniper: d.sniper, boss: d.boss, size: d.size, life: 0,
      }, x + (i - (d.n - 1) / 2) * 0.5, 1.7 + this.rng() * 0.4);
    }
  }

  // ---------- 전투 ----------
  damage(t, amt, src, crit, dot) {
    if (t.dead) return;
    if (!dot && t.armor && !(t.sealT > 0)) amt = Math.max(1, amt - t.armor);
    if (t.vulnT > 0) amt *= 1.15;
    const real = Math.min(t.hp, amt);
    t.hp -= amt;
    if (src) this.stats[src] = (this.stats[src] || 0) + real;
    if (!dot) this.emit({ k: 'hit', id: t.id, x: t.x, y: t.y, n: real, crit });
    if (t.hp <= 0 && !t.isBase) {
      t.dead = true;
      this.emit({ k: 'die', id: t.id, x: t.x, y: t.y, e: t.e, boss: t.boss, size: t.size });
    }
  }
  strike(u, target) {
    let dmg = u.dmg * u.dmgMul;
    const crit = u.crit > 0 && this.rng() < u.crit;
    if (crit) dmg *= u.critMul;
    if (!u.melee || u.isBase) this.emit({ k: 'shot', x1: u.x, y1: u.y, x2: target.x, y2: target.y, attr: u.attr || 'joy', crit, tid: u.id });
    else this.emit({ k: 'lunge', tid: u.id, x1: u.x, y1: u.y, x2: target.x, y2: target.y });
    const src = u.src ? u.src.id : null;
    const apply = (t) => {
      this.damage(t, dmg, src, crit, false);
      if (t.dead || t.isBase) return;
      if (u.slow && u.slow.pct >= t.slowPct) { t.slowPct = u.slow.pct; t.slowT = u.slow.dur; }
      if (u.poison) { t.poisonDps = Math.max(t.poisonDps, u.poison.dps); t.poisonT = u.poison.dur; t.poisonSrc = src; }
      if (u.vuln) t.vulnT = u.vuln.dur;
      if (u.seal) t.sealT = u.seal;
      if (u.knock && !t.boss) t.y += (t.team === 1 ? -1 : 1) * u.knock;
    };
    if (u.splash) {
      this.emit({ k: 'splash', x: target.x, y: target.y, r: u.splash, big: u.splash >= 1.2 && dmg >= 60 });
      for (const t of this.units) {
        if (t.team === u.team || t.dead) continue;
        if ((t.x - target.x) ** 2 + (t.y - target.y) ** 2 <= u.splash * u.splash) apply(t);
      }
      if (target.isBase) apply(target);
    } else apply(target);
  }
  nearest(u, maxD, filter) {
    let best = null;
    let bd = maxD * maxD;
    for (const t of this.units) {
      if (t.team === u.team || t.dead || (filter && !filter(t))) continue;
      const d = (t.x - u.x) ** 2 + (t.y - u.y) ** 2;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  step(dt) {
    if (this.result) return;
    this.t += dt;
    this.energy = Math.min(BR.maxE, this.energy + BR.regen * dt);
    // 적 AI: 에너지가 모이면 무작위 유닛을 내보냄
    this.ee = Math.min(BR.maxE, this.ee + BR.regen * this.k.regen * dt);
    if (!this.aiPick) this.aiPick = this.st.pool[Math.floor(this.rng() * this.st.pool.length)];
    if (this.t > 3 && this.ee >= BR_ENEMY[this.aiPick].cost) {
      this.ee -= BR_ENEMY[this.aiPick].cost;
      this.spawnEnemy(this.aiPick);
      this.aiPick = null;
    }
    while (this.bossQ.length && this.bossQ[0].t <= this.t) {
      this.spawnEnemy(this.bossQ.shift().type);
      this.emit({ k: 'boss' });
    }

    // 오라
    for (const u of this.units) { u.spdMul = 1; u.dmgMul = 1; }
    for (const a of this.units) {
      if (!a.aura || a.dead) continue;
      for (const u of this.units) {
        if (u.team !== a.team || u === a) continue;
        if ((u.x - a.x) ** 2 + (u.y - a.y) ** 2 > 4) continue;
        if (a.aura.spd) u.spdMul = Math.max(u.spdMul, 1 + a.aura.spd);
        if (a.aura.dmg) u.dmgMul = Math.max(u.dmgMul, 1 + a.aura.dmg);
      }
    }

    for (const u of this.units) {
      if (u.dead) continue;
      if (u.slowT > 0) { u.slowT -= dt; if (u.slowT <= 0) u.slowPct = 0; }
      if (u.vulnT > 0) u.vulnT -= dt;
      if (u.sealT > 0) u.sealT -= dt;
      if (u.regen && !(u.sealT > 0)) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * u.regen * dt);
      if (u.poisonT > 0) { u.poisonT -= dt; this.damage(u, u.poisonDps * dt, u.poisonSrc, false, true); if (u.dead) continue; }
      if (u.life) { u.life -= dt; if (u.life <= 0) { u.dead = true; this.emit({ k: 'die', id: u.id, x: u.x, y: u.y, e: u.e, size: u.size }); continue; } }
      if (u.income) {
        u.incT += dt;
        if (u.incT >= u.income.every) { u.incT = 0; this.energy = Math.min(BR.maxE, this.energy + u.income.amt); this.emit({ k: 'coin', x: u.x, y: u.y, n: u.income.amt }); }
      }
      if (u.stunT > 0) { u.stunT -= dt; continue; }
      if (u.heal) {
        u.abilT += dt;
        if (u.abilT >= u.heal.every) {
          u.abilT = 0;
          for (const a of this.units) {
            if (a.team === u.team && !a.dead && a.hp < a.maxHp && (a.x - u.x) ** 2 + (a.y - u.y) ** 2 <= u.heal.r ** 2) a.hp = Math.min(a.maxHp, a.hp + u.heal.amt);
          }
          this.emit({ k: 'pulse', x: u.x, y: u.y, r: u.heal.r, e: '💗' });
        }
      }
      if (u.pulse) {
        u.abilT += dt;
        if (u.abilT >= u.pulse.every && this.nearest(u, u.pulse.r)) {
          u.abilT = 0;
          for (const t of this.units) {
            if (t.team !== u.team && !t.dead && (t.x - u.x) ** 2 + (t.y - u.y) ** 2 <= u.pulse.r ** 2) t.stunT = Math.max(t.stunT, u.pulse.stun * (t.boss ? 0.3 : 1));
          }
          this.emit({ k: 'pulse', x: u.x, y: u.y, r: u.pulse.r, e: '💤' });
        }
      }
      if (!u.speed) continue;

      const foeBase = this.bases[1 - u.team];
      const speed = u.speed * (1 - u.slowPct) * dt;
      if (!u.attacker) {
        // 지원형: 적이 가까워지면 멈추고, 아니면 아군을 따라 전진
        if (!this.nearest(u, 2.4) && Math.abs(foeBase.y - u.y) > 3) u.y += (u.team === 0 ? -1 : 1) * speed;
        continue;
      }
      // 박쥐는 유닛을 무시하고 기지로, 도마뱀은 원거리 유닛부터 노림. 근접 유닛은 나는 적을 못 때림.
      let target = null;
      if (!u.fly) {
        if (u.sniper) target = this.nearest(u, 4, (t) => !t.melee);
        if (!target) target = this.nearest(u, Math.max(3, u.range + 0.8), u.melee ? (t) => !t.fly : null);
      }
      if (!target) target = foeBase;
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const reach = u.range + (target.isBase ? 0.7 : 0.25);
      if (d <= reach) {
        u.cd -= dt * u.spdMul;
        if (u.cd <= 0) { u.cd += u.itv; this.strike(u, target); }
      } else {
        if (u.cd > 0) u.cd -= dt;
        u.x += (dx / d) * speed;
        u.y += (dy / d) * speed;
      }
    }
    // 기지도 가까운 적을 쏨
    for (const b of this.bases) {
      b.cd -= dt;
      if (b.cd > 0) continue;
      const t = this.nearest(b, BR.baseRange);
      if (t) { b.cd = BR.baseItv; this.strike({ ...b, dmg: BR.baseDmg, dmgMul: 1, crit: 0, attr: b.team ? 'rage' : 'joy' }, t); }
      else b.cd = 0;
    }
    // 겹침 방지
    const us = this.units;
    for (let i = 0; i < us.length; i++) {
      const a = us[i];
      for (let j = i + 1; j < us.length; j++) {
        const b = us[j];
        if (a.team !== b.team) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 0.2 && d2 > 0) {
          const d = Math.sqrt(d2);
          const p = (0.45 - d) * 0.25;
          a.x -= (dx / d) * p; b.x += (dx / d) * p;
        } else if (d2 === 0) b.x += 0.05;
      }
      a.x = Math.max(0.35, Math.min(BR.W - 0.35, a.x));
      a.y = Math.max(0.6, Math.min(BR.H - 0.6, a.y));
    }
    if (us.some((u) => u.dead)) this.units = us.filter((u) => !u.dead);

    const [me, en] = this.bases;
    if (en.hp <= 0) { en.hp = 0; this.result = 'win'; this.emit({ k: 'die', id: en.id, x: en.x, y: en.y, e: '🕳️', boss: true }); }
    else if (me.hp <= 0) { me.hp = 0; this.result = 'lose'; }
    else if (this.t >= BR.time) this.result = me.hp / me.maxHp > en.hp / en.maxHp ? 'win' : 'lose';
  }
  stars() {
    if (this.result !== 'win') return 0;
    const r = this.bases[0].hp / this.bases[0].maxHp;
    return r >= 0.7 ? 3 : r >= 0.35 ? 2 : 1;
  }
}

// 시뮬레이터용: 아무 카드나 낼 수 있을 때 내는 단순한 플레이어
export class BrawlBot {
  constructor(g, rng) { this.g = g; this.rng = rng; this.pick = null; this.acc = 0; }
  tick(dt) {
    this.acc += dt;
    if (this.acc < 0.5) return;
    this.acc = 0;
    const g = this.g;
    if (!this.pick) this.pick = g.deck[Math.floor(this.rng() * g.deck.length)];
    if (g.energy < bcost(this.pick)) return;
    const u = unitOf(this.pick);
    g.deploy(this.pick.id, 1 + this.rng() * (BR.W - 2), u.melee ? 6 : u.attacker ? 7.6 : 8.4);
    this.pick = null;
  }
}

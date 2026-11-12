// 이모지 디펜스 — 전투 엔진 (DOM 의존 없음, 고정 시간 간격으로 step 호출)
import { CHAR_BY_ID, ENEMIES, MAP, RULES, makeWaves, synergyOf, posAt, mulberry32 } from './data.js';

let nextId = 1;

export class Game {
  constructor({ deck, stage, seed = 1, fx = false, waitStart = false }) {
    this.started = !waitStart; // 화면에서는 플레이어가 시작을 누를 때까지 첫 웨이브를 기다림
    this.critNow = false;
    this.rng = mulberry32(seed);
    this.deckIds = deck.slice();
    this.deck = deck.map((id) => CHAR_BY_ID[id]);
    this.syn = synergyOf(deck);
    this.stage = stage;
    this.waves = makeWaves(stage);
    this.energy = RULES.startEnergy;
    this.maxHearts = RULES.hearts;
    this.hearts = RULES.hearts;
    this.t = 0;
    this.waveIdx = -1;
    this.spawnQ = [];
    this.spawnClock = 0;
    this.gap = RULES.firstWaveDelay;
    this.enemies = [];
    this.towers = [];
    this.zones = [];
    this.grid = new Map();
    this.result = null;
    this.fxOn = fx;
    this.fx = [];
    this.stats = {};
    this.leaks = 0;
  }

  emit(ev) {
    if (this.fxOn) this.fx.push(ev);
  }

  // ---------- 배치 ----------
  rangeOf(def) {
    return def.range > 0 ? def.range + this.syn.range : 0;
  }
  countOf(id) {
    let n = 0;
    for (const t of this.towers) if (t.def.id === id) n++;
    return n;
  }
  canBuild(c, r) {
    return MAP.inBounds(c, r) && !MAP.isPath(c, r) && !this.grid.has(c + ',' + r);
  }
  whyNot(id, c, r) {
    const def = CHAR_BY_ID[id];
    if (!this.canBuild(c, r)) return '여기에는 놓을 수 없어요';
    if (this.towers.length >= RULES.maxUnits) return `최대 ${RULES.maxUnits}칸까지 배치할 수 있어요`;
    if (this.countOf(id) >= (def.max || RULES.maxCopies)) return `${def.name}은(는) 최대 ${def.max || RULES.maxCopies}기까지예요`;
    if (this.energy < def.cost) return '에너지가 부족해요';
    return null;
  }
  place(id, c, r) {
    if (this.result || this.whyNot(id, c, r)) return null;
    const def = CHAR_BY_ID[id];
    this.energy -= def.cost;
    const t = { id: nextId++, def, star: 1, spent: def.cost, col: c, row: r, x: c, y: r, cd: 0, abilT: 0, healT: 0, incT: 0, disT: 0, spdMul: 1, dmgMul: 1, range: this.rangeOf(def) };
    if (def.pulse) t.abilT = def.pulse.every * 0.5;
    this.towers.push(t);
    this.grid.set(c + ',' + r, t);
    this.recalcAuras();
    this.emit({ k: 'place', x: c, y: r });
    return t;
  }
  // 강화: 같은 캐릭터 비용을 한 번 더 내고 ★을 올림 (최대 ★3). 한 칸에 화력을 압축하는 수단.
  canUpgrade(t) {
    return !this.result && t.star < RULES.maxStar && this.energy >= t.def.cost;
  }
  upgrade(t) {
    if (!this.canUpgrade(t)) return false;
    this.energy -= t.def.cost;
    t.spent += t.def.cost;
    t.star++;
    this.recalcAuras();
    this.emit({ k: 'place', x: t.x, y: t.y });
    return true;
  }
  sell(t) {
    const i = this.towers.indexOf(t);
    if (i < 0) return;
    this.towers.splice(i, 1);
    this.grid.delete(t.col + ',' + t.row);
    this.energy += Math.floor(t.spent * RULES.refund);
    this.recalcAuras();
  }
  recalcAuras() {
    for (const t of this.towers) {
      let spd = 0;
      let dmg = 0;
      for (const o of this.towers) {
        if (!o.def.aura || o === t) continue;
        const dx = o.x - t.x;
        const dy = o.y - t.y;
        if (dx * dx + dy * dy > o.range * o.range) continue;
        // 같은 종류의 버프는 중첩되지 않음
        const k = 1 + 0.5 * (o.star - 1);
        if (o.def.aura.spd) spd = Math.max(spd, o.def.aura.spd * k);
        if (o.def.aura.dmg) dmg = Math.max(dmg, o.def.aura.dmg * k);
      }
      t.spdMul = (1 + spd) * (1 + this.syn.spd);
      t.dmgMul = 1 + dmg;
    }
  }

  // ---------- 웨이브 ----------
  startWave() {
    this.waveIdx++;
    this.spawnQ = this.waves[this.waveIdx].spawns.slice();
    this.spawnClock = 0;
    this.emit({ k: 'wave', n: this.waveIdx + 1 });
  }
  spawn(s) {
    const def = ENEMIES[s.type];
    const path = def.air ? MAP.air : MAP.ground;
    const e = {
      id: nextId++, def, type: s.type, path, hp: s.hp, maxHp: s.hp, bounty: s.bounty, d: 0, x: 0, y: 0,
      boss: !!def.boss, elite: !!s.elite,
      slowPct: 0, slowT: 0, poisonDps: 0, poisonT: 0, poisonSrc: null, vulnT: 0, sleepT: 0, confT: 0, sealT: 0,
      ccN: 0, ccReset: 0, st: 0, hidden: false, inkT: 6, dead: false, kidnapped: false,
    };
    posAt(path, 0, e);
    this.enemies.push(e);
  }

  // ---------- 피해와 상태이상 ----------
  damage(e, amt, src, dot) {
    if (e.dead) return;
    if (!dot && e.def.armor && e.sealT <= 0) amt = Math.max(1, amt - e.def.armor);
    if (e.vulnT > 0) amt *= 1.15;
    const real = Math.min(e.hp, amt);
    e.hp -= amt;
    if (src) this.stats[src] = (this.stats[src] || 0) + real;
    if (!dot) this.emit({ k: 'hit', id: e.id, x: e.x, y: e.y, n: real, crit: this.critNow });
    if (e.hp <= 0) {
      e.dead = true;
      this.energy += e.bounty;
      this.emit({ k: 'die', id: e.id, x: e.x, y: e.y, e: e.def.e, boss: e.boss, elite: e.elite, b: e.bounty });
    }
  }
  // 강한 군중 제어는 연속으로 걸릴수록 절반씩 약해짐. 보스는 이동 방해 면역.
  cc(e, kind, amount) {
    if (e.boss) {
      if (kind === 'knock' || kind === 'pull') return 0;
      amount *= RULES.bossCcFactor;
    }
    const m = Math.pow(0.5, e.ccN);
    e.ccN++;
    e.ccReset = RULES.ccResetTime;
    return amount * m;
  }
  hit(e, dmg, t) {
    const def = t.def;
    if (dmg > 0) this.damage(e, dmg, def.id, false);
    if (e.dead) return;
    const dur = 1 + this.syn.cc;
    if (def.slow) {
      const pct = Math.min(RULES.slowCap, def.slow.pct + this.syn.slow);
      if (pct >= e.slowPct || e.slowT <= 0) {
        e.slowPct = pct;
        e.slowT = def.slow.dur * dur;
      }
    }
    if (def.poison && (def.poison.dps * t.star >= e.poisonDps || e.poisonT <= 0)) {
      e.poisonDps = def.poison.dps * t.star;
      e.poisonT = def.poison.dur * dur;
      e.poisonSrc = def.id;
    }
    if (def.vuln) e.vulnT = def.vuln.dur * dur;
    if (def.seal) e.sealT = def.seal * dur;
    if (def.knock) this.pushBack(e, this.cc(e, 'knock', def.knock));
    if (def.pull) this.pushBack(e, this.cc(e, 'pull', def.pull));
  }
  pushBack(e, dist) {
    if (dist <= 0) return;
    e.d = Math.max(0, e.d - dist);
    posAt(e.path, e.d, e);
  }

  // ---------- 조준 ----------
  findTarget(t) {
    const r2 = t.range * t.range;
    const def = t.def;
    let best = null;
    let bestScore = -Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.hidden) continue;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      if (dx * dx + dy * dy > r2) continue;
      let score = def.target === 'strong' ? e.hp : e.d / e.path.len;
      // 상태이상 부여 캐릭터는 아직 안 걸린 적을 우선
      if (def.slow && e.slowT > 0.3) score -= 10;
      if (def.poison && e.poisonT > 0.3) score -= 10;
      if (def.vuln && e.vulnT > 0.5) score -= 10;
      if (def.seal && e.sealT > 0.5) score -= 10;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }
  attack(t, target) {
    const def = t.def;
    let dmg = def.dmg * t.star * t.dmgMul;
    const chance = (def.crit || 0) + this.syn.crit;
    let crit = false;
    if (dmg > 0 && chance > 0 && this.rng() < chance) {
      dmg *= def.critMul || 2;
      crit = true;
    }
    this.emit({ k: 'shot', x1: t.x, y1: t.y, x2: target.x, y2: target.y, attr: def.attr, crit, tid: t.id });
    this.critNow = crit;
    if (def.zone) {
      this.zones.push({ x: target.x, y: target.y, r: def.zone.r, dps: def.zone.dps * t.star * t.dmgMul * (1 + this.syn.aoe), t: def.zone.dur * (1 + this.syn.cc), src: def.id });
      return;
    }
    if (def.splash) {
      const r2 = def.splash * def.splash;
      const tx = target.x;
      const ty = target.y;
      dmg *= 1 + this.syn.aoe;
      this.emit({ k: 'splash', x: tx, y: ty, r: def.splash, attr: def.attr, big: def.splash >= 1.4 });
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = e.x - tx;
        const dy = e.y - ty;
        if (dx * dx + dy * dy <= r2) this.hit(e, dmg, t);
      }
    } else if (def.pierce) {
      const dx = target.x - t.x;
      const dy = target.y - t.y;
      const l = Math.hypot(dx, dy) || 1;
      const ux = dx / l;
      const uy = dy / l;
      this.emit({ k: 'beam', x1: t.x, y1: t.y, x2: t.x + ux * t.range, y2: t.y + uy * t.range });
      for (const e of this.enemies) {
        if (e.dead) continue;
        const px = e.x - t.x;
        const py = e.y - t.y;
        const along = px * ux + py * uy;
        if (along < 0 || along > t.range) continue;
        if (Math.abs(px * uy - py * ux) <= 0.45) this.hit(e, dmg, t);
      }
    } else {
      this.hit(target, dmg, t);
    }
    this.critNow = false;
  }
  pulse(t) {
    const p = t.def.pulse;
    const r2 = t.range * t.range;
    const inRange = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      if (dx * dx + dy * dy <= r2) inRange.push(e);
    }
    if (!inRange.length) return false;
    const dur = (1 + this.syn.cc) * (1 + 0.25 * (t.star - 1));
    if (p.sleep) {
      for (const e of inRange) e.sleepT = Math.max(e.sleepT, this.cc(e, 'sleep', p.sleep * dur));
      this.emit({ k: 'pulse', x: t.x, y: t.y, r: t.range, e: '💤' });
    }
    if (p.confuse) {
      inRange.sort((a, b) => b.d / b.path.len - a.d / a.path.len);
      for (const e of inRange.slice(0, p.n)) e.confT = Math.max(e.confT, this.cc(e, 'confuse', p.confuse * dur));
      this.emit({ k: 'pulse', x: t.x, y: t.y, r: t.range, e: '🌀' });
    }
    return true;
  }

  // ---------- 한 틱 ----------
  step(dt) {
    if (this.result) return;
    this.t += dt;

    // 웨이브 진행
    if (!this.started) {
      // 준비 시간: 배치만 가능
    } else if (this.spawnQ.length) {
      this.spawnClock += dt;
      while (this.spawnQ.length && this.spawnQ[0].t <= this.spawnClock) this.spawn(this.spawnQ.shift());
    } else if (!this.enemies.length) {
      if (this.waveIdx >= this.waves.length - 1) {
        this.result = 'win';
        return;
      }
      this.gap -= dt;
      if (this.gap <= 0) {
        this.gap = RULES.waveDelay;
        this.startWave();
      }
    }

    // 장판
    for (const z of this.zones) z.t -= dt;
    if (this.zones.length && this.zones[0].t <= 0) this.zones = this.zones.filter((z) => z.t > 0);

    const detectors = this.towers.filter((t) => t.def.detect);

    // 적
    let anyDead = false;
    for (const e of this.enemies) {
      if (e.dead) { anyDead = true; continue; }
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowPct = 0; }
      if (e.vulnT > 0) e.vulnT -= dt;
      if (e.sealT > 0) e.sealT -= dt;
      if (e.ccReset > 0) { e.ccReset -= dt; if (e.ccReset <= 0) e.ccN = 0; }
      const sealed = e.sealT > 0;
      if (e.def.regen && !sealed && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.def.regen * dt);
      if (e.poisonT > 0) {
        e.poisonT -= dt;
        this.damage(e, e.poisonDps * dt, e.poisonSrc, true);
      }
      if (this.zones.length && !e.dead) {
        // 장판끼리는 중첩되지 않고 가장 강한 것만 적용
        let zb = null;
        for (const z of this.zones) {
          const dx = e.x - z.x;
          const dy = e.y - z.y;
          if (dx * dx + dy * dy <= z.r * z.r && (!zb || z.dps > zb.dps)) zb = z;
        }
        if (zb) this.damage(e, zb.dps * dt, zb.src, true);
      }
      if (e.dead) { anyDead = true; continue; }

      // 이동
      if (e.sleepT > 0) {
        e.sleepT -= dt;
      } else if (e.confT > 0) {
        e.confT -= dt;
        e.d = Math.max(0, e.d - e.def.speed * dt);
      } else {
        e.d += e.def.speed * (1 - e.slowPct) * dt;
      }
      if (e.d >= e.path.len) {
        e.dead = true;
        anyDead = true;
        this.leaks++;
        this.hearts -= e.boss ? 10 : 1;
        this.emit({ k: 'leak' });
        if (this.hearts <= 0) {
          this.hearts = 0;
          this.result = 'lose';
          return;
        }
        continue;
      }
      posAt(e.path, e.d, e);

      // 은신: 3초 보이고 2초 숨음. 유령 사거리 안이거나 봉인되면 드러남.
      if (e.def.stealth) {
        e.st += dt;
        let hidden = !sealed && e.st % 5 >= 3;
        if (hidden) {
          for (const g of detectors) {
            const dx = e.x - g.x;
            const dy = e.y - g.y;
            if (dx * dx + dy * dy <= g.range * g.range) { hidden = false; break; }
          }
        }
        e.hidden = hidden;
      }
      // 문어 먹물: 10초마다 가장 가까운 아군을 3초간 멈춤
      if (e.def.ink && !sealed) {
        e.inkT -= dt;
        if (e.inkT <= 0) {
          e.inkT = 10;
          let near = null;
          let nd = Infinity;
          for (const t of this.towers) {
            const d2 = (t.x - e.x) ** 2 + (t.y - e.y) ** 2;
            if (d2 < nd) { nd = d2; near = t; }
          }
          if (near) {
            near.disT = 3;
            this.emit({ k: 'ink', x: near.x, y: near.y });
          }
        }
      }
    }
    if (anyDead) this.enemies = this.enemies.filter((e) => !e.dead);

    // 아군
    for (const t of this.towers) {
      const def = t.def;
      if (def.income) {
        t.incT += dt;
        if (t.incT >= def.income.every) {
          t.incT -= def.income.every;
          this.energy += def.income.amt * t.star;
          this.emit({ k: 'coin', x: t.x, y: t.y, n: def.income.amt * t.star });
        }
      }
      if (def.heal) {
        t.healT += dt * t.star;
        if (t.healT >= def.heal.every) {
          t.healT -= def.heal.every;
          if (this.hearts < this.maxHearts) {
            this.hearts++;
            this.emit({ k: 'heal', x: t.x, y: t.y });
          }
        }
      }
      if (t.disT > 0) { t.disT -= dt; continue; }
      if (def.pulse) {
        t.abilT -= dt;
        if (t.abilT <= 0) t.abilT = this.pulse(t) ? def.pulse.every : 0;
      }
      if (def.itv > 0) {
        t.cd -= dt * t.spdMul;
        if (t.cd <= 0) {
          const target = this.findTarget(t);
          if (target) {
            this.attack(t, target);
            t.cd += def.itv;
          } else {
            t.cd = 0;
          }
        }
      }
    }
  }

  stars() {
    if (this.result !== 'win') return 0;
    return this.hearts >= 15 ? 3 : this.hearts >= 8 ? 2 : 1;
  }
}

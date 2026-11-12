// 이모지 디펜스 — 디펜스 전투 엔진 (DOM 의존 없음, 고정 시간 간격으로 step 호출)
import { CHAR_BY_ID, ENEMIES, MAP, RULES, UP, PERKS, SKILL, makeWaves, waveReward, synergyOf, posAt, mulberry32, tracksOf, spKey } from './data.js';

let nextId = 1;

export class Game {
  constructor({ deck, stage, seed = 1, fx = false, waitStart = false }) {
    this.started = !waitStart; // 화면에서는 플레이어가 시작을 누를 때까지 첫 웨이브를 기다림
    this.rng = mulberry32(seed);
    this.prng = mulberry32(seed ^ 0x9e3779b9); // 특성 카드 추첨용 (전투 난수와 분리)
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
    this.kills = 0;
    this.critNow = false;
    // 특성 카드로 쌓이는 보정치
    this.pk = { dmg: 0, spd: 0, range: 0, crit: 0, bounty: 0, aoeR: 0, cc: 0, upCost: 0, enemySlow: 0, boss: 0, dot: 0, charge: 0, refund: 0, attr: {} };
    this.perks = [];
    this.perkOffer = null;
    this.perksGiven = 0;
    // 기술과 콤보
    this.blast = 0;
    this.cheerCd = 0;
    this.cheerT = 0;
    this.combo = 0;
    this.comboT = 0;
    this.offerPerk();
  }

  emit(ev) {
    if (this.fxOn) this.fx.push(ev);
  }

  // ---------- 능력치 계산: 강화·시너지·특성을 모두 반영한 실제 값 ----------
  calc(def, up) {
    const pk = this.pk;
    const sp = up.sp;
    const key = spKey(def);
    const dmgK = (1 + UP.dmg * up.dmg) * (1 + pk.dmg + (pk.attr[def.attr] || 0));
    const o = { key, sp };
    o.dmg = def.dmg * dmgK;
    o.itv = def.itv > 0 ? def.itv / (1 + UP.spd * up.spd) : 0;
    o.range = def.range > 0 ? def.range + this.syn.range + pk.range + UP.rng * up.rng : 0;
    o.splash = def.splash ? (def.splash + (key === 'splash' ? 0.2 * sp : 0)) * (1 + pk.aoeR) : 0;
    o.crit = (def.crit || 0) + this.syn.crit + pk.crit + (key === 'crit' ? 0.08 * sp : 0);
    o.critMul = def.critMul || 2;
    o.zoneDps = def.zone ? def.zone.dps * dmgK * (1 + this.syn.aoe) * (1 + pk.dot) : 0;
    o.zoneR = def.zone ? (def.zone.r + 0.2 * sp) * (1 + pk.aoeR) : 0;
    o.slow = def.slow ? Math.min(RULES.slowCap, def.slow.pct + this.syn.slow + (key === 'slow' ? 0.07 * sp : 0)) : 0;
    o.poison = def.poison ? def.poison.dps * (1 + UP.dmg * up.dmg) * (1 + 0.4 * sp) * (1 + pk.dot) : 0;
    o.vuln = def.vuln ? def.vuln.pct + 0.05 * sp : 0;
    o.knock = def.knock ? def.knock + 0.25 * sp : 0;
    o.pull = def.pull ? def.pull + 0.4 * sp : 0;
    o.seal = def.seal ? def.seal + sp : 0;
    o.auraSpd = def.aura && def.aura.spd ? def.aura.spd * (1 + 0.4 * sp) : 0;
    o.auraDmg = def.aura && def.aura.dmg ? def.aura.dmg * (1 + 0.4 * sp) : 0;
    o.income = def.income ? def.income.amt + 4 * sp : 0;
    o.pulseEvery = def.pulse ? def.pulse.every / (def.dmg ? 1 : 1 + UP.spd * up.spd) : 0;
    o.sleep = def.pulse && def.pulse.sleep ? def.pulse.sleep + 0.4 * sp : 0;
    o.confN = def.pulse && def.pulse.confuse ? def.pulse.n + sp : 0;
    o.dps = o.itv > 0 ? (def.zone ? o.zoneDps : (o.dmg * (1 + o.crit * (o.critMul - 1)) * (key === 'double' ? 1 + 0.15 * sp : 1)) / o.itv) : 0;
    return o;
  }
  levelOf(t) {
    return t.up.dmg + t.up.spd + t.up.rng + t.up.sp;
  }

  // ---------- 배치 ----------
  rangeOf(def) {
    return def.range > 0 ? def.range + this.syn.range + this.pk.range : 0;
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
    const t = {
      id: nextId++, def, up: { dmg: 0, spd: 0, rng: 0, sp: 0 }, mode: def.target || 'first', spent: def.cost, kills: 0, dealt: 0,
      col: c, row: r, x: c, y: r, cd: 0, abilT: 0, healT: 0, incT: 0, disT: 0, spdMul: 1, dmgMul: 1, s: null, range: 0,
    };
    this.towers.push(t);
    this.grid.set(c + ',' + r, t);
    this.recalc();
    if (def.pulse) t.abilT = t.s.pulseEvery * 0.5;
    this.emit({ k: 'place', x: c, y: r });
    return t;
  }
  // 강화: 갈래(dmg/spd/rng/sp)를 골라 올림
  upCost(t, track) {
    return Math.round(t.def.cost * UP.costK[Math.min(UP.max - 1, t.up[track])] * (1 - this.pk.upCost));
  }
  whyNoUp(t, track) {
    if (!tracksOf(t.def).includes(track)) return '이 캐릭터에게는 없는 강화예요';
    if (t.up[track] >= UP.max) return '이 갈래는 최대예요';
    if (this.levelOf(t) >= UP.total) return `캐릭터당 강화는 합계 ${UP.total}단계까지예요`;
    if (this.energy < this.upCost(t, track)) return '에너지가 부족해요';
    return null;
  }
  upgrade(t, track) {
    if (this.result || this.whyNoUp(t, track)) return false;
    const cost = this.upCost(t, track);
    this.energy -= cost;
    t.spent += cost;
    t.up[track]++;
    this.recalc();
    this.emit({ k: 'up', x: t.x, y: t.y, track });
    return true;
  }
  refundOf(t) {
    return Math.floor(t.spent * (this.pk.refund ? 1 : RULES.refund));
  }
  sell(t) {
    const i = this.towers.indexOf(t);
    if (i < 0) return;
    this.towers.splice(i, 1);
    this.grid.delete(t.col + ',' + t.row);
    this.energy += this.refundOf(t);
    this.recalc();
  }
  recalc() {
    for (const t of this.towers) {
      t.s = this.calc(t.def, t.up);
      t.range = t.s.range;
    }
    for (const t of this.towers) {
      let spd = 0;
      let dmg = 0;
      for (const o of this.towers) {
        if (!o.def.aura || o === t) continue;
        const dx = o.x - t.x;
        const dy = o.y - t.y;
        if (dx * dx + dy * dy > o.range * o.range) continue;
        // 같은 종류의 버프는 중첩되지 않음
        spd = Math.max(spd, o.s.auraSpd);
        dmg = Math.max(dmg, o.s.auraDmg);
      }
      t.spdMul = (1 + spd) * (1 + this.syn.spd + this.pk.spd);
      t.dmgMul = 1 + dmg;
    }
  }

  // ---------- 특성 카드 ----------
  offerPerk() {
    const have = new Set(this.perks.map((p) => p.id));
    const attrs = new Set(this.deck.map((d) => d.attr));
    const pool = PERKS.filter((p) => !(p.once && have.has(p.id)) && (!p.attr || attrs.has(p.attr)));
    const pick = [];
    while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(this.prng() * pool.length), 1)[0]);
    this.perkOffer = pick;
  }
  pickPerk(i) {
    const p = this.perkOffer && this.perkOffer[i];
    if (!p) return;
    this.perkOffer = null;
    this.perksGiven++;
    this.perks.push(p);
    if (p.add) for (const k in p.add) this.pk[k] += p.add[k];
    if (p.attr) this.pk.attr[p.attr] = (this.pk.attr[p.attr] || 0) + 0.25;
    if (p.now) {
      if (p.now.energy) this.energy += p.now.energy;
      if (p.now.hearts) { this.maxHearts += p.now.hearts; this.hearts += p.now.hearts; }
    }
    this.recalc();
  }

  // ---------- 기술 ----------
  // 폭발: 처치로 충전. 화면의 모든 적에게 최대 체력 비례 피해 + 잠깐 기절
  useBlast() {
    if (this.blast < 1 || this.result || !this.enemies.length) return false;
    this.blast = 0;
    for (const e of this.enemies) {
      this.damage(e, Math.max(25, e.maxHp * (e.boss ? SKILL.blastBoss : SKILL.blastPct)), null, true);
      if (!e.dead) e.sleepT = Math.max(e.sleepT, e.boss ? 0.4 : SKILL.blastStun);
      this.emit({ k: 'hit', id: e.id, x: e.x, y: e.y, n: 0, crit: true });
    }
    this.emit({ k: 'blast' });
    return true;
  }
  // 응원: 잠시 동안 모든 캐릭터 공속 증가 (재사용 대기)
  useCheer() {
    if (this.cheerCd > 0 || this.result) return false;
    this.cheerT = SKILL.cheerDur;
    this.cheerCd = SKILL.cheerCd / (1 + this.pk.charge);
    this.emit({ k: 'cheer' });
    return true;
  }
  // 다음 웨이브를 미리 부름: 적이 남아 있을 때 부르면 보너스 에너지
  earlyBonus() {
    return this.enemies.length ? Math.round(waveReward(this.waveIdx + 2) * SKILL.earlyBonus) : 0;
  }
  canCallNext() {
    return this.started && !this.result && !this.perkOffer && this.waveIdx >= 0 && this.waveIdx < this.waves.length - 1 && !this.spawnQ.length;
  }
  callNext() {
    if (!this.canCallNext()) return false;
    const b = this.earlyBonus();
    this.energy += b;
    this.gap = RULES.waveDelay;
    this.startWave();
    if (b) this.emit({ k: 'bonus', n: b });
    return true;
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
      slowPct: 0, slowT: 0, poisonDps: 0, poisonT: 0, poisonBy: null, vulnT: 0, vulnPct: 0, sleepT: 0, confT: 0, sealT: 0,
      ccN: 0, ccReset: 0, st: 0, hidden: false, inkT: 6, dead: false,
    };
    posAt(path, 0, e);
    this.enemies.push(e);
  }

  // ---------- 피해와 상태이상 ----------
  damage(e, amt, by, dot) {
    if (e.dead) return;
    if (!dot && e.def.armor && e.sealT <= 0) amt = Math.max(1, amt - e.def.armor);
    if (e.vulnT > 0) amt *= 1 + e.vulnPct;
    const real = Math.min(e.hp, amt);
    e.hp -= amt;
    if (by) {
      by.dealt += real;
      this.stats[by.def.id] = (this.stats[by.def.id] || 0) + real;
    }
    if (!dot) this.emit({ k: 'hit', id: e.id, x: e.x, y: e.y, n: real, crit: this.critNow });
    if (e.hp <= 0) {
      e.dead = true;
      if (by) by.kills++;
      this.kills++;
      const gain = e.bounty * (1 + this.pk.bounty);
      this.energy += gain;
      this.blast = Math.min(1, this.blast + (e.boss ? 1 : (1 + this.pk.charge) / SKILL.blastKills));
      this.combo++;
      this.comboT = SKILL.comboWindow;
      if (this.combo % SKILL.comboEvery === 0) {
        this.energy += SKILL.comboBonus;
        this.emit({ k: 'combo', n: this.combo });
      }
      this.emit({ k: 'die', id: e.id, x: e.x, y: e.y, e: e.def.e, boss: e.boss, elite: e.elite, b: gain });
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
    const s = t.s;
    if (dmg > 0) {
      let m = 1;
      if (e.boss || e.elite) m += this.pk.boss + (s.key === 'hunter' ? 0.25 * s.sp : 0);
      if (s.key === 'opener' && e.hp >= e.maxHp * 0.5) m += 0.2 * s.sp;
      this.damage(e, dmg * m, t, false);
    }
    if (e.dead) return;
    const dur = 1 + this.syn.cc + this.pk.cc;
    if (def.slow && (s.slow >= e.slowPct || e.slowT <= 0)) {
      e.slowPct = s.slow;
      e.slowT = def.slow.dur * dur;
    }
    if (def.poison && (s.poison >= e.poisonDps || e.poisonT <= 0)) {
      e.poisonDps = s.poison;
      e.poisonT = def.poison.dur * dur;
      e.poisonBy = t;
    }
    if (def.vuln) { e.vulnT = def.vuln.dur * dur; e.vulnPct = Math.max(e.vulnPct, s.vuln); }
    if (def.seal) e.sealT = s.seal * dur;
    if (def.knock) this.pushBack(e, this.cc(e, 'knock', s.knock));
    if (def.pull) this.pushBack(e, this.cc(e, 'pull', s.pull));
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
    const mode = t.mode;
    let best = null;
    let bestScore = -Infinity;
    let bestPen = 2;
    for (const e of this.enemies) {
      if (e.dead || e.hidden) continue;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const prog = e.d / e.path.len;
      const score = mode === 'strong' ? e.hp : mode === 'weak' ? -e.hp : mode === 'last' ? -prog : mode === 'near' ? -d2 : prog;
      // 상태이상 부여 캐릭터는 아직 안 걸린 적을 우선
      const pen = (def.slow && e.slowT > 0.3) || (def.poison && e.poisonT > 0.3) || (def.vuln && e.vulnT > 0.5) || (def.seal && e.sealT > 0.5) ? 1 : 0;
      if (pen < bestPen || (pen === bestPen && score > bestScore)) {
        bestPen = pen;
        bestScore = score;
        best = e;
      }
    }
    return best;
  }
  attack(t, target, echo) {
    const def = t.def;
    const s = t.s;
    let dmg = s.dmg * t.dmgMul;
    let crit = false;
    if (dmg > 0 && s.crit > 0 && this.rng() < s.crit) {
      dmg *= s.critMul;
      crit = true;
    }
    this.emit({ k: 'shot', x1: t.x, y1: t.y, x2: target.x, y2: target.y, attr: def.attr, crit, tid: t.id });
    this.critNow = crit;
    if (def.zone) {
      this.zones.push({ x: target.x, y: target.y, r: s.zoneR, dps: s.zoneDps * t.dmgMul, t: def.zone.dur * (1 + this.syn.cc + this.pk.cc), by: t });
    } else if (def.splash) {
      const r2 = s.splash * s.splash;
      const tx = target.x;
      const ty = target.y;
      dmg *= 1 + this.syn.aoe;
      this.emit({ k: 'splash', x: tx, y: ty, r: s.splash, attr: def.attr, big: s.splash >= 1.4 });
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
    // 연타 특수: 확률로 한 번 더
    if (!echo && s.key === 'double' && s.sp > 0 && !target.dead && this.rng() < 0.15 * s.sp) this.attack(t, target, true);
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
    const dur = 1 + this.syn.cc + this.pk.cc;
    if (p.sleep) {
      for (const e of inRange) e.sleepT = Math.max(e.sleepT, this.cc(e, 'sleep', t.s.sleep * dur));
      this.emit({ k: 'pulse', x: t.x, y: t.y, r: t.range, e: '💤' });
    }
    if (p.confuse) {
      inRange.sort((a, b) => b.d / b.path.len - a.d / a.path.len);
      for (const e of inRange.slice(0, t.s.confN)) e.confT = Math.max(e.confT, this.cc(e, 'confuse', p.confuse * dur));
      this.emit({ k: 'pulse', x: t.x, y: t.y, r: t.range, e: '🌀' });
    }
    return true;
  }

  // ---------- 한 틱 ----------
  step(dt) {
    if (this.result || this.perkOffer) return;
    this.t += dt;
    if (this.cheerT > 0) this.cheerT -= dt;
    if (this.cheerCd > 0) this.cheerCd -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }

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
      // 2웨이브를 넘길 때마다 특성 카드 한 장
      if (this.waveIdx >= 0 && this.perksGiven < 1 + Math.floor((this.waveIdx + 1) / 2)) {
        this.offerPerk();
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
    const moveK = 1 - this.pk.enemySlow;

    // 적
    let anyDead = false;
    for (const e of this.enemies) {
      if (e.dead) { anyDead = true; continue; }
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowPct = 0; }
      if (e.vulnT > 0) { e.vulnT -= dt; if (e.vulnT <= 0) e.vulnPct = 0; }
      if (e.sealT > 0) e.sealT -= dt;
      if (e.ccReset > 0) { e.ccReset -= dt; if (e.ccReset <= 0) e.ccN = 0; }
      const sealed = e.sealT > 0;
      if (e.def.regen && !sealed && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.def.regen * dt);
      if (e.poisonT > 0) {
        e.poisonT -= dt;
        this.damage(e, e.poisonDps * dt, e.poisonBy, true);
      }
      if (this.zones.length && !e.dead) {
        // 장판끼리는 중첩되지 않고 가장 강한 것만 적용
        let zb = null;
        for (const z of this.zones) {
          const dx = e.x - z.x;
          const dy = e.y - z.y;
          if (dx * dx + dy * dy <= z.r * z.r && (!zb || z.dps > zb.dps)) zb = z;
        }
        if (zb) this.damage(e, zb.dps * dt, zb.by, true);
      }
      if (e.dead) { anyDead = true; continue; }

      // 이동
      if (e.sleepT > 0) {
        e.sleepT -= dt;
      } else if (e.confT > 0) {
        e.confT -= dt;
        e.d = Math.max(0, e.d - e.def.speed * dt);
      } else {
        e.d += e.def.speed * moveK * (1 - e.slowPct) * dt;
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
    const cheer = this.cheerT > 0 ? SKILL.cheerMul : 1;
    for (const t of this.towers) {
      const def = t.def;
      if (def.income) {
        t.incT += dt;
        if (t.incT >= def.income.every) {
          t.incT -= def.income.every;
          this.energy += t.s.income;
          this.emit({ k: 'coin', x: t.x, y: t.y, n: t.s.income });
        }
      }
      if (def.heal) {
        t.healT += dt * (1 + 0.4 * t.up.sp);
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
        if (t.abilT <= 0) t.abilT = this.pulse(t) ? t.s.pulseEvery : 0;
      }
      if (def.itv > 0) {
        t.cd -= dt * t.spdMul * cheer;
        if (t.cd <= 0) {
          const target = this.findTarget(t);
          if (target) {
            this.attack(t, target);
            t.cd += t.s.itv;
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

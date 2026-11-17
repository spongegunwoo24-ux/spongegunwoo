'use strict';
/* ===== 게임 상태 ===== */
var G = { running: false, needCursor: false, runId: 0, idx: 0, time: 0, hp: 100, mp: 100, ctl: true, talking: false, cine: null, shake: 0,
  beamPow: 1, beamColor: 0x7fd0ff, spell: 0, boltCd: 0, beamMode: 'cast', canFire: true, canShield: true, canJump: true, useLock: 0, fireLock: 0, mpIdle: 0, staff: false, busy: false, dead: false };
let L = null;
const P = { pos: new V3(), vy: 0, yaw: 0, pitch: -0.08, face: 0, char: null, ground: true, dashT: 0, dashCd: 0, dashDir: new V3(), inv: 0, firing: false,
  castT: 0, shield: false, shieldT: 0, aim: new V3(), speed: 0, hitT: null, tip: new V3() };
P.char = castChar('luka'); scene.add(P.char); P.char.visible = false;
const shieldMesh = new THREE.Group();
shieldMesh.add(new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 16), new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
shieldMesh.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.17, 1), new THREE.MeshBasicMaterial({ color: 0xcfeaff, wireframe: true, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));
shieldMesh.visible = false; scene.add(shieldMesh);

/* ===== 비동기 스크립트 도구 ===== */
const tasks = [];
const wait = s => new Promise(r => tasks.push({ t: s, r }));
const until = fn => new Promise(r => tasks.push({ fn, r }));
const tween = (dur, fn) => new Promise(r => tasks.push({ e: 0, dur, tw: fn, r }));
const ease = k => k * k * (3 - 2 * k);
function updateTasks(dt) {
  for (let i = tasks.length - 1; i >= 0; i--) {
    const k = tasks[i]; let done = false;
    if (k.tw) { k.e += dt; const u = Math.min(1, k.e / k.dur); k.tw(ease(u), u); done = u >= 1; }
    else if (k.fn) done = !!k.fn(); else { k.t -= dt; done = k.t <= 0; }
    if (done) { tasks.splice(tasks.indexOf(k), 1); k.r(); }
  }
}
/* ===== 화면 UI ===== */
let dlgRes = null, dlgFull = '', dlgShown = -1, dlgT = 0, dlgClick = false;
$('dlg').addEventListener('click', () => { dlgClick = true; });
$('dlg').addEventListener('touchstart', () => { dlgClick = true; }, { passive: true });
function say(who, text) {
  return new Promise(res => { G.talking = true; $('dlg').hidden = false; $('who').textContent = who; $('who').hidden = !who; $('txt').textContent = ''; dlgFull = text; dlgShown = -1; dlgT = 0; dlgRes = res; });
}
async function talk(lines) { for (const l of lines) await say(l[0], l[1]); }
function closeDialog() { dlgRes = null; G.talking = false; $('dlg').hidden = true; $('choices').hidden = true; G.needCursor = false; }
function updateDialog(dt) {
  if (!dlgRes) { dlgClick = false; return; }
  dlgT += dt; const n = Math.min(dlgFull.length, Math.floor(dlgT * 48));
  if (n !== dlgShown) { dlgShown = n; $('txt').textContent = dlgFull.slice(0, n); if (n % 3 === 0 && n < dlgFull.length) sfx('talk'); }
  const adv = pressed.KeyE || pressed.Enter || pressed.Space || mouse.lp || pressed.Tap || dlgClick; dlgClick = false;
  if (adv && dlgT > 0.18) {
    if (n < dlgFull.length) dlgT = 999;
    else { const r = dlgRes; dlgRes = null; G.talking = false; $('dlg').hidden = true; G.useLock = 0.3; G.fireLock = 0.3; r(); }
  }
}
function choose(opts) {
  return new Promise(res => {
    G.talking = true; G.needCursor = true; if (document.exitPointerLock && locked) document.exitPointerLock();
    const c = $('choices'); c.innerHTML = ''; c.hidden = false; const id = G.runId;
    const done = i => { if (id !== G.runId) return; c.hidden = true; G.talking = false; G.needCursor = false; G.useLock = G.fireLock = 0.3; sfx('pop'); tasks.splice(tasks.indexOf(kt), 1); res(i); };
    opts.forEach((o, i) => { const b = document.createElement('button'); b.textContent = (i + 1) + '. ' + o; b.onclick = () => done(i); c.appendChild(b); });
    const kt = { fn: () => { for (let i = 0; i < opts.length; i++) if (pressed['Digit' + (i + 1)]) { done(i); return false; } return false; }, r() {} };
    tasks.push(kt);
  });
}
let toastT = null;
function toast(t, dur = 1.6) { const e = $('toast'); e.textContent = t; e.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { e.style.opacity = 0; }, dur * 1000); }
function objective(title, desc = '') { const e = $('obj'); e.hidden = !title; e.innerHTML = title ? `<b>${title}</b>${desc}` : ''; }
async function fade(to, dur = 0.7) { $('fade').style.transitionDuration = dur + 's'; $('fade').style.opacity = to; await wait(dur + 0.05); }
async function card(h, p) { $('cardh').textContent = h; $('cardp').textContent = p || ''; $('card').style.opacity = 1; await wait(2.3); $('card').style.opacity = 0; await wait(0.5); }
function flash(a = 1, dur = 0.8) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = `opacity ${dur}s`; f.style.opacity = 0; }); }
function bossBar(name, k) { $('boss').hidden = name === null; if (name) $('bossn').textContent = name; if (k !== undefined) $('bossb').style.transform = `scaleX(${clamp(k, 0, 1)})`; }
function camTo(px, py, pz, lx, ly, lz, dur = 1.5) {
  if (!G.cine) { const d = new V3(); camera.getWorldDirection(d); G.cine = { pos: camera.position.clone(), look: camera.position.clone().addScaledVector(d, 6) }; }
  const p0 = G.cine.pos.clone(), l0 = G.cine.look.clone(), p1 = new V3(px, py, pz), l1 = new V3(lx, ly, lz), c = G.cine;
  if (dur <= 0) { c.pos.copy(p1); c.look.copy(l1); return Promise.resolve(); }
  return tween(dur, k => { c.pos.lerpVectors(p0, p1, k); c.look.lerpVectors(l0, l1, k); });
}
function cineOff() { G.cine = null; }

/* ===== 레벨 뼈대 ===== */
function newLevel(o = {}) {
  const world = new THREE.Group(); scene.add(world);
  const lv = { world, solids: [], colliders: [], boxes: [], bounds: null, targets: [], interacts: [], npcs: [], flick: [], bob: [], upd: [], camBox: null, camDist: 4.6, projs: [], groundY: 0 };
  scene.background = new THREE.Color(o.bg ?? 0x0b0d1f);
  scene.fog = new THREE.FogExp2(o.fog ?? o.bg ?? 0x0b0d1f, o.fogD ?? 0.02);
  world.add(new THREE.HemisphereLight(o.skyC ?? 0x8fa0ff, o.gndC ?? 0x2a2440, o.hemi ?? 0.55));
  const sun = new THREE.DirectionalLight(o.sunC ?? 0xbfd0ff, o.sunI ?? 0.9);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = sc.bottom = -24; sc.right = sc.top = 24; sc.near = 1; sc.far = 120; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  lv.sunOff = new V3(...(o.sunP ?? [14, 30, 10])); world.add(sun, sun.target); lv.sun = sun;
  renderer.toneMappingExposure = o.exp ?? 1.2;
  return lv;
}
function addSky(lv, top, bot, stars = 600, moon = null) {
  const g = new THREE.SphereGeometry(450, 24, 16), c = [], ct = new THREE.Color(top), cb = new THREE.Color(bot), cc = new THREE.Color();
  for (let i = 0; i < g.attributes.position.count; i++) { const y = g.attributes.position.getY(i) / 450; cc.copy(cb).lerp(ct, clamp(y * 1.6 + 0.1, 0, 1)); c.push(cc.r, cc.g, cc.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  lv.world.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  if (stars) {
    const p = []; for (let i = 0; i < stars; i++) { const a = rand(TAU), e = Math.asin(rand(0.03, 1)); p.push(Math.cos(a) * Math.cos(e) * 420, Math.sin(e) * 420, Math.sin(a) * Math.cos(e) * 420); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    lv.world.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
  }
  if (moon) { const m = glow(moon.c ?? 0xdfe6ff, moon.s ?? 90, 1); m.position.set(...moon.p); lv.world.add(m); const d = glow(0xffffff, (moon.s ?? 90) * 0.32, 1); d.position.copy(m.position); lv.world.add(d); }
}
function solid(lv, m) { lv.world.add(m); lv.solids.push(m); return m; }
function torch(lv, x, y, z, light = true, color = 0xffa24a) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(cyl(0.05, 0.03, 0.4, M(0x3a2a1a), 0, -0.2, 0, 6));
  const f = cone(0.09, 0.26, new THREE.MeshBasicMaterial({ color: 0xffe0a0 }), 0, 0.12, 0, 6); f.castShadow = false; g.add(f);
  const gl = glow(color, 1.5, 0.9); gl.position.y = 0.15; g.add(gl);
  let pl = null; if (light) { pl = new THREE.PointLight(color, 1.3, 14, 2); pl.position.y = 0.3; g.add(pl); }
  lv.world.add(g); lv.flick.push({ gl, pl, f, base: pl ? pl.intensity : 0, s: rand(9) }); return g;
}
function floaters(lv, n, fn, color = 0xffd98a, size = 0.7) {
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group(), p = fn(i); g.position.set(p[0], p[1], p[2]);
    g.add(cyl(0.035, 0.035, 0.22, M(0xf2ead8, { emi: 0x5a4a2a }), 0, 0, 0, 6)); const gl = glow(color, size, 0.9); gl.position.y = 0.18; g.add(gl);
    lv.world.add(g); lv.bob.push({ o: g, y: p[1], s: rand(9), a: 0.18, sp: rand(0.6, 1.2) });
  }
}
function tree(lv, x, z, s = 1, leaf = 0x2f5d3a) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  g.add(cyl(0.16 * s, 0.26 * s, 2.2 * s, M(0x4a3524), 0, 1.1 * s, 0, 7));
  [[0, 2.9, 0, 1.3], [0.7, 2.4, 0.3, 0.9], [-0.6, 2.5, -0.4, 1.0], [0.1, 3.6, -0.2, 0.9]].forEach(b => { const m = mesh(new THREE.IcosahedronGeometry(b[3] * s, 1), M(leaf, { flat: true }), b[0] * s, b[1] * s, b[2] * s); g.add(m); });
  lv.world.add(g); lv.colliders.push({ x, z, r: 0.4 * s }); return g;
}
function addNPC(lv, id, x, z, face, fn, label) {
  const c = castChar(id); c.position.set(x, 0, z); c.rotation.y = face; lv.world.add(c);
  const n = { char: c, face, speed: 0, casting: false, look: true }; lv.npcs.push(n);
  lv.colliders.push(n.col = { x, z, r: 0.45 });
  if (fn) n.it = addInteract(lv, c.position, 2.3, label || (c.userData.name + '와 대화'), fn);
  return n;
}
function addInteract(lv, pos, r, label, fn, once = false) { const it = { pos, r, label, fn, once, off: false }; lv.interacts.push(it); return it; }
function marker(lv, x, z, color = 0xffd76a) {
  const g = new THREE.Group(); g.position.set(x, 0.05, z);
  const ring = mesh(new THREE.TorusGeometry(0.9, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color }), 0, 0, 0, false); ring.rotation.x = Math.PI / 2; g.add(ring);
  const col = mesh(new THREE.CylinderGeometry(0.9, 0.9, 5, 24, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 0, 2.5, 0, false); g.add(col);
  lv.world.add(g); lv.upd.push(dt => { ring.scale.setScalar(1 + Math.sin(G.time * 3) * 0.08); if (Math.random() < dt * 8) emit(new V3(x + rand(-0.8, 0.8), 0.2, z + rand(-0.8, 0.8)), 1, { color, speed: 0.2, vy: 1.2, life: 1.4, size: 0.1, drag: 0.2 }); });
  return g;
}
const near = (x, z, r) => Math.hypot(P.pos.x - x, P.pos.z - z) < r;

/* ===== 광선 ===== */
function makeBeam(parent, color) {
  const g = new THREE.Group();
  const geo = r => { const c = new THREE.CylinderGeometry(r, r, 1, 12, 1, true); c.translate(0, 0.5, 0); c.rotateX(Math.PI / 2); return c; };
  const bm = (op, map) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, map: map || null, side: THREE.DoubleSide });
  const core = new THREE.Mesh(geo(0.028), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  const mid = new THREE.Mesh(geo(0.075), bm(0.85, streakTex)), outer = new THREE.Mesh(geo(0.2), bm(0.3, streakTex)), halo = new THREE.Mesh(geo(0.4), bm(0.07));
  const sg = glow(color, 1.1, 1), eg = glow(color, 2.4, 1), eg2 = glow(0xffffff, 0.9, 1);
  const light = new THREE.PointLight(color, 2.2, 11, 2);
  g.add(core, mid, outer, halo, sg, eg, eg2, light); g.visible = false; parent.add(g);
  [core, mid, outer, halo].forEach(m => { m.frustumCulled = false; });
  const b = { g, len: 0, color,
    setColor(c) { b.color = c; [mid, outer, halo].forEach(m => m.material.color.set(c)); sg.material.color.set(c); eg.material.color.set(c); light.color.set(c); },
    set(a, t, w = 1) {
      g.visible = true; g.position.copy(a); g.lookAt(t); const len = b.len = a.distanceTo(t), j = 1 + Math.sin(G.time * 47) * 0.12 + rand(-0.08, 0.08);
      core.scale.set(w * j, w * j, len); mid.scale.set(w * j, w * j, len); outer.scale.set(w * (2 - j), w * (2 - j), len); halo.scale.set(w, w, len);
      mid.rotation.z += 0.3; outer.rotation.z -= 0.17;
      eg.position.z = eg2.position.z = light.position.z = len; light.position.z = len - 0.4;
      eg.scale.setScalar(2.4 * w * rand(0.8, 1.25)); eg2.scale.setScalar(0.9 * w * rand(0.8, 1.2)); sg.scale.setScalar(1.1 * w * rand(0.8, 1.2));
    },
    off() { g.visible = false; }
  };
  return b;
}
const PB = makeBeam(scene, G.beamColor);
const ray = new THREE.Raycaster(), _v = new V3(), _v2 = new V3(), _ndc = new THREE.Vector2();
function computeAim() {
  const c = locked || isTouch; _ndc.set(c ? 0 : mouse.nx, c ? 0 : mouse.ny);
  ray.setFromCamera(_ndc, camera); ray.far = 70;
  const o = ray.ray.origin, d = ray.ray.direction; let best = 55, hitT = null;
  if (L.solids.length) { const h = ray.intersectObjects(L.solids, false); if (h.length) best = h[0].distance; }
  const minD = camera.position.distanceTo(P.pos) * 0.75;
  for (const t of L.targets) {
    if (t.off) continue; const r = t.r * 1.2;
    _v.subVectors(t.pos, o); const tca = _v.dot(d); if (tca < 0) continue;
    const d2 = _v.lengthSq() - tca * tca; if (d2 > r * r) continue;
    const th = tca - Math.sqrt(r * r - d2) * 0.6; if (th < best && th > minD) { best = th; hitT = t; }
  }
  P.aim.copy(o).addScaledVector(d, best); P.hitT = hitT;
}

/* ===== 투사체 ===== */
function shoot(pos, vel, o = {}) {
  const color = o.color ?? 0xff5a8a, r = o.r ?? 0.22;
  const m = new THREE.Mesh(o.geo || new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  m.add(glow(color, r * 7, 1)); m.position.copy(pos); L.world.add(m);
  const p = { m, pos: m.position, vel: vel.clone(), r, dmg: o.dmg ?? 12, color, life: o.life ?? 6, owner: o.owner || 'enemy', homing: o.homing || 0, grav: o.grav || 0, src: o.src || null, spin: o.geo ? 6 : 0 };
  L.projs.push(p); return p;
}
function killProj(p, burst = true) { p.dead = true; L.world.remove(p.m); if (burst) emit(p.pos, 14, { color: p.color, speed: 4, life: 0.5, size: 0.16 }); }
function updateProjectiles(dt) {
  const pc = _v2.copy(P.pos); pc.y += 1;
  for (let i = L.projs.length - 1; i >= 0; i--) {
    const p = L.projs[i]; if (p.dead) { L.projs.splice(i, 1); continue; }
    if (p.homing && p.owner === 'enemy') { _v.subVectors(pc, p.pos).normalize().multiplyScalar(p.vel.length()); p.vel.lerp(_v, p.homing * dt); }
    p.vel.y -= p.grav * dt; p.pos.addScaledVector(p.vel, dt); p.life -= dt; if (p.spin) { p.m.rotation.x += dt * p.spin; p.m.rotation.y += dt * p.spin * 0.7; }
    if (Math.random() < dt * 40) emit(p.pos, 1, { color: p.color, speed: 0.4, life: 0.4, size: p.r * 0.9 });
    if (p.life <= 0 || p.pos.y < L.groundY - 0.1) { killProj(p); continue; }
    let blocked = false;
    for (const c of L.colliders) if (c.h && !c.off && p.pos.y < c.h && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < c.r + p.r) { blocked = true; break; }
    if (blocked) { killProj(p); continue; }
    if (p.owner === 'enemy') {
      const d = p.pos.distanceTo(pc);
      if (P.shield && d < 1.3 + p.r) {
        if (P.shieldT < 0.4) { // 타이밍 맞춘 방패 = 되받아치기
          p.owner = 'player'; p.dmg *= 4; p.color = 0x9fe0ff; p.m.children[0].material.color.set(0x9fe0ff);
          if (p.src && !p.src.off) _v.subVectors(p.src.pos, p.pos).normalize(); else _v.copy(p.vel).normalize().negate();
          p.vel.copy(_v).multiplyScalar(p.vel.length() * 1.6 + 6); p.life = 4; sfx('parry'); toast('되받아치기!', 0.7); emit(p.pos, 20, { color: 0xbfeaff, speed: 5, life: 0.4 });
        } else { G.mp = Math.max(0, G.mp - 5); sfx('shield'); killProj(p); }
        continue;
      }
      if (d < 0.6 + p.r && Math.abs(p.pos.y - pc.y) < 1.1) { hurt(p.dmg); killProj(p); continue; }
    } else {
      for (const t of L.targets) if (!t.off && p.pos.distanceTo(t.pos) < t.r + p.r) { if (t.hit) t.hit(p.dmg, p.pos, 0, true); sfx('hit'); killProj(p); break; }
    }
  }
}
function hurt(d, force) {
  if (G.dead || (!force && (P.inv > 0 || P.dashT > 0))) return;
  G.hp -= d; P.inv = 0.8; G.shake = 0.35; sfx('hurt'); $('vign').style.transition = 'none'; $('vign').style.opacity = 0.9;
  requestAnimationFrame(() => { $('vign').style.transition = 'opacity .6s'; $('vign').style.opacity = 0; });
  emit(_v.copy(P.pos).setY(P.pos.y + 1), 12, { color: 0xff4466, speed: 3, life: 0.4 });
  if (G.hp <= 0) die();
}
async function die() {
  if (G.dead) return; G.dead = true; G.ctl = false; toast('다시 도전!', 2); await fade(1, 0.8); startLevel(G.idx);
}

/* ===== 플레이어 ===== */
function collide(p, r = 0.4) {
  for (const c of L.colliders) { if (c.off) continue; const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; } }
  for (const b of L.boxes) {
    if (b.off) continue;
    if (p.x > b.x0 - r && p.x < b.x1 + r && p.z > b.z0 - r && p.z < b.z1 + r) {
      const a = p.x - (b.x0 - r), c = (b.x1 + r) - p.x, e = p.z - (b.z0 - r), f = (b.z1 + r) - p.z, m = Math.min(a, c, e, f);
      if (m === a) p.x = b.x0 - r; else if (m === c) p.x = b.x1 + r; else if (m === e) p.z = b.z0 - r; else p.z = b.z1 + r;
    }
  }
  const B = L.bounds; if (!B) return;
  if (B.r) { const dx = p.x - (B.x || 0), dz = p.z - (B.z || 0), d = Math.hypot(dx, dz); if (d > B.r) { p.x = (B.x || 0) + dx / d * B.r; p.z = (B.z || 0) + dz / d * B.r; } }
  else { p.x = clamp(p.x, B.x0, B.x1); p.z = clamp(p.z, B.z0, B.z1); }
}
function updatePlayer(dt) {
  G.useLock -= dt; G.fireLock -= dt; P.inv -= dt; P.dashCd -= dt;
  if (L.customPlayer) { PB.off(); beamSound(false); shieldMesh.visible = false; P.firing = P.shield = false; return; }
  const cl = !!G.clash, free = G.ctl && !G.talking && !G.cine && !G.dead;
  // G.fireLock -= dt; P.inv -= dt; P.dashCd -= dt;
  if (free || G.lookOnly) {
    P.yaw -= mouse.dx * 0.0026; P.pitch = clamp(P.pitch - mouse.dy * 0.0022, -0.85, 0.7);
    if (!locked && !isTouch) {
      const ax = Math.abs(mouse.nx); if (ax > 0.5) P.yaw -= Math.sign(mouse.nx) * (ax - 0.5) * 5 * dt;
      P.pitch = damp(P.pitch, mouse.ny * 0.3 - 0.05, 3, dt);
    }
    P.yaw += ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * 2.2 * dt;
    P.pitch = clamp(P.pitch + ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * 1.2 * dt, -0.85, 0.7);
  }
  let mx = 0, mz = 0;
  if (free && !cl) { mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.x; mz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + joy.y; }
  const fireIn = free && G.canFire && G.fireLock <= 0 && (mouse.l || keys.T_fire || keys.KeyF);
  if (free && G.beamMode === 'cast') for (let i = 0; i < 3; i++) if (pressed['Digit' + (i + 1)]) selectSpell(i);
  const spl = (cl || G.beamMode !== 'cast') ? 0 : G.spell;
  const wantFire = cl || (fireIn && spl === 0);
  if (wantFire && !P.firing && G.mp > 8) P.firing = true;
  if (!wantFire || G.mp <= 0) P.firing = false;
  const sh = free && !cl && G.canShield && (mouse.r || keys.KeyQ || keys.T_shield) && G.mp > 2 && !P.firing;
  if (sh && !P.shield) { P.shieldT = 0; sfx('shield'); }
  P.shield = sh; if (sh) { P.shieldT += dt; G.mp -= 9 * dt; }
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), rx = -fz, rz = fx;
  let dx = fx * mz + rx * mx, dz = fz * mz + rz * mx; const ml = Math.hypot(dx, dz); if (ml > 1) { dx /= ml; dz /= ml; }
  if (free && !cl && (pressed.ShiftLeft || pressed.ShiftRight) && P.dashCd <= 0) {
    P.dashT = 0.26; P.dashCd = 0.75; if (ml > 0.1) P.dashDir.set(dx / Math.max(ml, 1e-3), 0, dz / Math.max(ml, 1e-3)); else P.dashDir.set(fx, 0, fz);
    sfx('dash'); emit(_v.copy(P.pos).setY(P.pos.y + 0.8), 16, { color: 0x9fd8ff, speed: 2, life: 0.4 });
  }
  let sp = P.firing ? 3.4 : P.shield ? 2.6 : 5.4;
  if (P.dashT > 0) { P.dashT -= dt; P.pos.x += P.dashDir.x * 17 * dt; P.pos.z += P.dashDir.z * 17 * dt; if (Math.random() < 0.6) emit(_v.copy(P.pos).setY(P.pos.y + rand(0.3, 1.4)), 1, { color: 0x9fd8ff, speed: 0.5, life: 0.35, size: 0.2 }); }
  else { P.pos.x += dx * sp * dt; P.pos.z += dz * sp * dt; }
  if (free && !cl && pressed.Space && P.ground && G.canJump) { P.vy = 7.4; P.ground = false; sfx('jump'); }
  P.vy -= 21 * dt; P.pos.y += P.vy * dt;
  if (P.pos.y <= L.groundY) { P.pos.y = L.groundY; P.vy = 0; P.ground = true; }
  collide(P.pos);
  P.speed = P.dashT > 0 ? 8 : ml * sp;
  if (cl) { P.aim.copy(G.clash.pt); P.hitT = null; } else if (free) computeAim();
  P.castT -= dt; G.boltCd -= dt;
  if (spl === 1 && free && !cl && G.canFire && G.fireLock <= 0 && (mouse.lp || pressed.T_fire || pressed.KeyF) && G.boltCd <= 0 && G.mp >= 20) { // 폭발탄
    G.mp -= 20; G.mpIdle = 0; G.boltCd = 0.38; P.castT = 0.3; P.face = Math.atan2(P.aim.x - P.pos.x, P.aim.z - P.pos.z);
    const o = new V3(P.pos.x + Math.sin(P.face) * 0.6, P.pos.y + 1.35, P.pos.z + Math.cos(P.face) * 0.6);
    shoot(o, _v.subVectors(P.aim, o).normalize().multiplyScalar(30), { owner: 'player', dmg: 44 * G.beamPow, color: G.staff ? 0xffd76a : 0xff9a4a, r: 0.3, life: 3 });
    sfx('shoot'); G.shake = Math.max(G.shake, 0.06); emit(o, 14, { color: 0xffc070, speed: 4, life: 0.35 });
  }
  if (spl === 2 && fireIn && G.mp > 1 && G.hp < 100) { // 치유
    G.mp -= 28 * dt; G.hp = Math.min(100, G.hp + 17 * dt); G.mpIdle = 0; P.castT = 0.1;
    emit(_v.set(P.pos.x + rand(-0.5, 0.5), P.pos.y + rand(0.1, 0.6), P.pos.z + rand(-0.5, 0.5)), 2, { color: 0x7affb0, speed: 0.3, vy: 2.4, life: 0.8, size: 0.13, drag: 0.3 });
    if (Math.random() < dt * 5) sfx('ring');
  }
  if (P.firing || P.shield || P.castT > 0) P.face += angDiff(P.face, Math.atan2(P.aim.x - P.pos.x, P.aim.z - P.pos.z)) * Math.min(1, 16 * dt);
  else if (ml > 0.1) P.face += angDiff(P.face, Math.atan2(dx, dz)) * Math.min(1, 12 * dt);
  const ch = P.char; ch.position.copy(P.pos); ch.rotation.y = P.face;
  ch.visible = L.hidePlayer ? false : !(P.inv > 0 && Math.floor(G.time * 20) % 2 === 0);
  const tip = ch.userData.tip; let ap = 0;
  if (P.firing) { tip.getWorldPosition(P.tip); ap = Math.atan2(P.aim.y - P.tip.y, Math.hypot(P.aim.x - P.tip.x, P.aim.z - P.tip.z)); }
  animChar(ch, dt, P.speed, P.firing || P.castT > 0, ap);
  if (P.firing) {
    ch.updateMatrixWorld(true); tip.getWorldPosition(P.tip);
    const w = G.staff ? 1.7 : 1; PB.set(P.tip, P.aim, w);
    if (G.beamMode === 'cast' && !cl) G.mp -= 15 * dt;
    G.mpIdle = 0; beamSound(true, G.staff ? 1.3 : 1);
    if (P.hitT && P.hitT.hit) P.hitT.hit(36 * G.beamPow * dt, P.aim, dt, false);
    emit(P.aim, P.hitT ? 3 : 1, { color: P.hitT ? 0xffffff : PB.color, speed: P.hitT ? 5 : 2.5, life: 0.35, size: 0.11, grav: 4 });
    if (Math.random() < 0.5) { _v.lerpVectors(P.tip, P.aim, Math.random()); emit(_v, 1, { color: PB.color, speed: 0.6, life: 0.3, size: 0.08 }); }
  } else { PB.off(); beamSound(false); }
  $('cross').classList.toggle('hot', !!P.hitT);
  if (!P.firing && !P.shield) { G.mpIdle += dt; if (G.mpIdle > 0.35) G.mp = Math.min(100, G.mp + 40 * dt); } else G.mpIdle = 0;
  shieldMesh.visible = P.shield; if (P.shield) { shieldMesh.position.copy(P.pos).y += 1; shieldMesh.rotation.y += dt * 2; shieldMesh.children[0].material.opacity = P.shieldT < 0.4 ? 0.38 : 0.15; }
}
function updateCamera(dt) {
  if (G.cine) { camera.position.copy(G.cine.pos); camera.lookAt(G.cine.look); }
  else {
    const cp = Math.cos(P.pitch), fx = Math.sin(P.yaw) * cp, fy = Math.sin(P.pitch), fz = Math.cos(P.yaw) * cp;
    const tx = P.pos.x - Math.cos(P.yaw) * 0.7, ty = P.pos.y + 1.6, tz = P.pos.z + Math.sin(P.yaw) * 0.7, d = L.camDist;
    let cx = tx - fx * d, cy = ty - fy * d, cz = tz - fz * d;
    const B = L.camBox; if (B) { cx = clamp(cx, B.x0, B.x1); cz = clamp(cz, B.z0, B.z1); cy = Math.min(cy, B.y1 ?? 99); }
    if (L.camR) { const cd = Math.hypot(cx, cz); if (cd > L.camR) { cx *= L.camR / cd; cz *= L.camR / cd; } cy = Math.min(cy, 16); }
    cy = Math.max(cy, L.groundY + 0.3);
    camera.position.set(cx, cy, cz); camera.lookAt(tx + fx * 12, ty + fy * 12, tz + fz * 12);
  }
  if (G.shake > 0.005) { camera.position.x += rand(-1, 1) * G.shake; camera.position.y += rand(-1, 1) * G.shake; G.shake = damp(G.shake, 0, 7, dt); }
  L.sun.target.position.copy(P.pos); L.sun.position.copy(P.pos).add(L.sunOff);
}
let curIt = null;
function updateInteracts() {
  curIt = null; let bd = 1e9;
  if (G.ctl && !G.talking && !G.cine && !G.busy && !G.dead) for (const it of L.interacts) { if (it.off) continue; const d = Math.hypot(P.pos.x - it.pos.x, P.pos.z - it.pos.z); if (d < it.r && d < bd) { bd = d; curIt = it; } }
  const pr = $('prompt'); pr.hidden = !curIt; if (curIt) { const h = (isTouch ? '' : '<kbd>E</kbd>') + curIt.label; if (pr.innerHTML !== h) pr.innerHTML = h; }
  if (curIt && pressed.KeyE && G.useLock <= 0) {
    const it = curIt; if (it.once) it.off = true; G.busy = true; const id = G.runId;
    Promise.resolve(it.fn()).then(() => { if (id === G.runId) G.busy = false; });
  }
}
function updateDecor(dt) {
  for (const f of L.flick) { f.s += dt * 9; const k = 0.85 + Math.sin(f.s) * 0.1 + Math.sin(f.s * 2.7) * 0.07; if (f.pl) f.pl.intensity = f.base * k; f.gl.scale.setScalar(1.5 * k); f.f.scale.y = k; }
  for (const b of L.bob) { b.s += dt * b.sp; b.o.position.y = b.y + Math.sin(b.s) * b.a; }
  for (const n of L.npcs) {
    const c = n.char; n.col.x = c.position.x; n.col.z = c.position.z;
    if (n.look && n.speed < 0.1) { const d = Math.hypot(P.pos.x - c.position.x, P.pos.z - c.position.z); const tgt = d < 5 ? Math.atan2(P.pos.x - c.position.x, P.pos.z - c.position.z) : n.face; c.rotation.y += angDiff(c.rotation.y, tgt) * Math.min(1, 4 * dt); }
    animChar(c, dt, n.speed, n.casting, n.castPitch || 0);
  }
}
/* NPC를 한 지점까지 걸어가게 한다 */
function walkTo(n, x, z, sp = 3) {
  return new Promise(res => {
    const c = n.char; n.speed = sp;
    const k = { fn: () => { const dx = x - c.position.x, dz = z - c.position.z, d = Math.hypot(dx, dz); if (d < 0.15) { n.speed = 0; n.face = c.rotation.y; return true; }
      const st = Math.min(d, sp * G.dt); c.position.x += dx / d * st; c.position.z += dz / d * st; c.rotation.y += angDiff(c.rotation.y, Math.atan2(dx, dz)) * 0.2; return false; }, r: res };
    tasks.push(k);
  });
}
function selectSpell(i) { if (G.spell !== i) sfx('pop'); G.spell = i; document.querySelectorAll('#spells .slot').forEach((e, k) => e.classList.toggle('on', k === i)); }
const namePool = [];
function updateNames() {
  let n = 0; const show = G.running && L && !L.customPlayer;
  if (show) for (const np of L.npcs) {
    const c = np.char; if (!c.visible || !c.userData.name) continue;
    const d = Math.hypot(c.position.x - P.pos.x, c.position.z - P.pos.z); if (d > 15) continue;
    _v.set(c.position.x, c.position.y + 2.15 * c.scale.y, c.position.z).project(camera); if (_v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) continue;
    let e = namePool[n]; if (!e) { e = document.createElement('div'); e.className = 'np'; $('names').appendChild(e); namePool.push(e); }
    e.hidden = false; if (e.textContent !== c.userData.name) e.textContent = c.userData.name;
    e.style.left = (_v.x * 0.5 + 0.5) * 100 + '%'; e.style.top = (-_v.y * 0.5 + 0.5) * 100 + '%'; e.style.opacity = clamp(1.6 - d / 10, 0.25, 1); n++;
  }
  for (; n < namePool.length; n++) namePool[n].hidden = true;
}
function updateHUD() {
  updateNames(); const lb = !!G.cine && !L.customPlayer; $('lb1').classList.toggle('on', lb); $('lb2').classList.toggle('on', lb);
  $('spells').hidden = !!L.customPlayer || G.beamMode !== 'cast' || !!G.cine;
  $('hp').firstElementChild.style.transform = `scaleX(${clamp(G.hp / 100, 0, 1)})`;
  $('mp').firstElementChild.style.transform = `scaleX(${clamp(G.mp / 100, 0, 1)})`;
  const cr = $('cross'), show = G.ctl && !G.cine && !G.talking && !L.noCross; cr.hidden = !show;
  if (show) { if (locked || isTouch) { cr.style.left = '50%'; cr.style.top = '50%'; } else { cr.style.left = (mouse.nx * 0.5 + 0.5) * 100 + '%'; cr.style.top = (-mouse.ny * 0.5 + 0.5) * 100 + '%'; } }
}

/* ===== 레벨 진행 ===== */
const LEVELS = [];
function disposeWorld(w) { w.traverse(o => { if (o.geometry) o.geometry.dispose(); }); scene.remove(w); }
async function startLevel(i) {
  G.runId++; const id = G.runId; tasks.length = 0; closeDialog();
  $('fade').style.transitionDuration = '0s'; $('fade').style.opacity = 1;
  if (L) { if (L.cleanup) L.cleanup(); disposeWorld(L.world); }
  clearParticles(); PB.off(); beamSound(false); bossBar(null); objective(''); $('clash').hidden = true; $('prompt').hidden = true; $('card').style.opacity = 0;
  if (i >= LEVELS.length) i = 0;
  Object.assign(G, { hp: 100, mp: 100, ctl: true, cine: null, talking: false, canFire: true, canShield: true, canJump: true, beamMode: 'cast', busy: false, dead: false, lookOnly: false, idx: i, shake: 0 });
  G.staff = i >= 8; G.clash = null; G.beamPow = G.staff ? 1.8 : 1; PB.setColor(G.staff ? 0xffd76a : 0x7fd0ff);
  P.vy = 0; P.dashT = 0; P.inv = 0; P.firing = false; P.pitch = -0.05; P.char.visible = true; P.char.rotation.set(0, 0, 0);
  try { localStorage.setItem('astra_ch', String(i)); } catch (e) {}
  $('bars').hidden = false; $('help').hidden = isTouch;
  L = newLevel(LEVELS[i].env || {});
  LEVELS[i].run(L).then(() => { if (id === G.runId) startLevel(i + 1); }).catch(e => console.error('level error', e));
}
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta()); G.dt = dt;
  if (G.running && L) {
    G.time += dt; updateTasks(dt); updateDialog(dt); updatePlayer(dt);
    for (const f of L.upd) f(dt);
    updateInteracts(); updateProjectiles(dt); updateDecor(dt); updateCamera(dt); updateHUD();
  }
  updateParticles(dt); streakTex.offset.y -= dt * 2.5;
  renderer.render(scene, camera);
  for (const k in pressed) delete pressed[k]; mouse.dx = mouse.dy = 0; mouse.lp = false;
  if (keys.KeyM && !G._m) { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8; } G._m = keys.KeyM;
}
function boot() {
  document.querySelectorAll('#spells .slot').forEach((e, k) => { const f = ev => { ev.preventDefault(); selectSpell(k); }; e.addEventListener('click', f); e.addEventListener('touchstart', f, { passive: false }); }); selectSpell(0);
  $('help').innerHTML = '1·2·3 주문 선택 · WASD 이동 · 마우스 조준 · 좌클릭 광선 · 우클릭/Q 방패<br>Shift 회피 · Space 점프 · E 대화 · M 음소거';
  $('keys').innerHTML = isTouch ? '' : '주문 선택 1·2·3 · 이동 WASD · 조준 마우스 · 시전 좌클릭 · 방패 우클릭 또는 Q<br>회피 Shift · 점프 Space · 대화 E · 음소거 M';
  const go = i => { audioInit(); $('title').hidden = true; G.running = true; tryLock(); startLevel(i); };
  $('bstart').onclick = () => go(0);
  let saved = 0; try { saved = +localStorage.getItem('astra_ch') || 0; } catch (e) {}
  if (saved > 0 && saved < LEVELS.length) { $('bcont').hidden = false; $('bcont').textContent = `이어하기 · ${LEVELS[saved].name}`; $('bcont').onclick = () => go(saved); }
  LEVELS.forEach((l, i) => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = `${i + 1}. ${l.name}`; b.onclick = () => go(i); $('chap').appendChild(b); });
  // 타이틀 뒤 배경
  L = newLevel({ bg: 0x0b0d1f, fogD: 0.004 }); addSky(L, 0x05061a, 0x2a2f6a, 900, { p: [-120, 160, -300], s: 110 });
  camera.position.set(0, 4, 0); camera.lookAt(-30, 30, -100);
  $('fade').style.opacity = 0;
  const m = /[?&]ch=(\d+)/.exec(location.search); if (m) go(+m[1]);
  frame();
}

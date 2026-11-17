'use strict';
/* ===== 공용 배경 요소 ===== */
TEXFN.books = (g, w, h) => {
  g.fillStyle = '#2a1c12'; g.fillRect(0, 0, w, h);
  const cols = ['#7a2b3a', '#2b3a7a', '#2f7a5a', '#b98a2e', '#5a2f7a', '#8a4a2a', '#3a6a8a', '#d8c8a0'];
  for (let r = 0; r < 4; r++) { let x = 3; while (x < w - 6) { const bw = rand(8, 20), bh = rand(40, 56); g.fillStyle = pick(cols); g.fillRect(x, r * 64 + 60 - bh, bw - 1, bh); g.fillStyle = 'rgba(255,220,140,.5)'; g.fillRect(x + 2, r * 64 + 60 - bh + 8, bw - 5, 3); x += bw; } g.fillStyle = '#4a3020'; g.fillRect(0, r * 64 + 60, w, 4); }
};
function castle(lv, cx, cz, s = 1, lit = 0xffd98a) {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); g.scale.setScalar(s);
  const st = M(0xa29fb0, { map: tex('stone', 8, 3) }), st2 = M(0x9794a8, { map: tex('stone', 3, 5) }), roof = M(0x2b3a7a, { rough: 0.6, flat: true });
  const win = new THREE.MeshBasicMaterial({ color: lit });
  g.add(box(56, 13, 4, st, 0, 6.5, 0));
  for (let x = -27; x <= 27; x += 2.4) g.add(box(1.2, 1.2, 4.2, st, x, 13.6, 0));
  g.add(box(16, 24, 9, st2, 0, 12, -4)); const kr = cone(12.5, 10, roof, 0, 29, -4, 4); kr.rotation.y = Math.PI / 4; g.add(kr);
  [[-26, 0, 4.4, 24], [26, 0, 4.4, 24], [-12, -7, 3.2, 33], [12, -7, 3.2, 33], [0, -10, 3.6, 42]].forEach(t => {
    g.add(cyl(t[2], t[2] * 1.08, t[3], st2, t[0], t[3] / 2, t[1], 14)); g.add(cone(t[2] * 1.3, t[2] * 2.4, roof, t[0], t[3] + t[2] * 1.2, t[1], 14));
    for (let k = 0; k < 3; k++) { const a = -0.6 + k * 0.6, wy = t[3] * (0.45 + k * 0.17); const w = mesh(new THREE.BoxGeometry(0.7, 1.5, 0.2), win, t[0] + Math.sin(a) * t[2] * 1.02, wy, t[1] + Math.cos(a) * t[2] * 1.02, false); w.rotation.y = a; g.add(w); }
    const fl = glow(0xffe9a0, 3, 0.8); fl.position.set(t[0], t[3] + t[2] * 2.5, t[1]); g.add(fl);
  });
  for (let x = -24; x <= 24; x += 4) if (Math.abs(x) > 3) { g.add(mesh(new THREE.BoxGeometry(1, 2.4, 0.2), win, x, 7.5, 2.05, false)); g.add(mesh(new THREE.BoxGeometry(1, 1.6, 0.2), win, x, 3, 2.05, false)); }
  for (let x = -5; x <= 5; x += 2.5) g.add(mesh(new THREE.BoxGeometry(1.1, 3, 0.2), win, x, 15, 0.55, false));
  const rose = mesh(new THREE.CircleGeometry(1.8, 20), new THREE.MeshBasicMaterial({ color: 0x9fc8ff }), 0, 21, 0.56, false); g.add(rose); const rg = glow(0x9fc8ff, 9, 0.5); rg.position.set(0, 21, 1); g.add(rg);
  g.add(box(4.4, 6.4, 0.5, M(0x4a3020, { map: tex('wood', 1, 1) }), 0, 3.2, 2.1)); g.add(box(5.2, 0.6, 0.8, st2, 0, 6.7, 2.1));
  [-1, 1].forEach(sd => { g.add(box(1.3, 6, 0.15, M(sd < 0 ? 0x7a2b3a : 0x2b3a7a), sd * 8, 8, 2.15)); g.add(box(1.3, 0.3, 0.2, M(0xf2cf7a, { metal: 0.5 }), sd * 8, 5, 2.16)); });
  lv.world.add(g); return g;
}
function buildCourt(lv, mode) {
  const sk = { dusk: [0x1a1c4a, 0xe08a5a], night: [0x05061a, 0x3a1f5a], dawn: [0x4a6ac8, 0xffc890] }[mode];
  addSky(lv, sk[0], sk[1], mode === 'dawn' ? 120 : 800, mode === 'dawn' ? { p: [200, 40, -300], s: 160, c: 0xffe0a0 } : { p: [-150, 170, -300], s: 90 });
  const gr = solid(lv, mesh(new THREE.CircleGeometry(140, 48), M(0x6a9a6a, { map: tex('grass', 40, 40) }), 0, 0, 0)); gr.rotation.x = -Math.PI / 2;
  const pz = mesh(new THREE.CircleGeometry(9.5, 40), M(0xb0adc0, { map: tex('tile', 6, 6) }), 0, 0.02, 0); pz.rotation.x = -Math.PI / 2; lv.world.add(pz);
  const pa = mesh(new THREE.PlaneGeometry(5, 16), M(0xb0adc0, { map: tex('tile', 2, 6) }), 0, 0.02, -16); pa.rotation.x = -Math.PI / 2; lv.world.add(pa);
  lv.castle = castle(lv, 0, -27, 1, mode === 'night' ? 0xb08aff : 0xffd98a);
  lv.boxes.push({ x0: -30, x1: 30, z0: -30, z1: -24.6 });
  // 분수
  const f = new THREE.Group(); lv.world.add(f); lv.fountain = f;
  f.add(cyl(3.1, 3.3, 0.7, M(0xa29fb0, { map: tex('stone', 6, 1) }), 0, 0.35, 0, 28));
  const water = mesh(new THREE.CircleGeometry(2.8, 28), M(0x3a7ad8, { emi: 0x2a5ab0, ei: 0.9, rough: 0.1, metal: 0.4, fresh: true }), 0, 0.62, 0, false); water.rotation.x = -Math.PI / 2; f.add(water); lv.water = water;
  f.add(cyl(0.35, 0.5, 2.4, M(0xa29fb0), 0, 1.5, 0)); const cr = mesh(new THREE.OctahedronGeometry(0.55), M(0xbfe6ff, { emi: 0x7fc8ff, ei: 1.6, flat: true }), 0, 3.2, 0, false); f.add(cr); cr.add(glow(0x9fd8ff, 4, 0.7)); lv.star = cr;
  lv.fcol = { x: 0, z: 0, r: 3.4 }; lv.colliders.push(lv.fcol);
  const fl = new THREE.PointLight(0x7fc8ff, 1.2, 16, 2); fl.position.set(0, 3.2, 0); f.add(fl);
  lv.upd.push(dt => { cr.rotation.y += dt; cr.position.y = 3.2 + Math.sin(G.time * 1.5) * 0.15; if (Math.random() < dt * 14 && !lv.dry) emit(new V3(rand(-0.3, 0.3), 2.7, rand(-0.3, 0.3)), 1, { color: 0x9fd8ff, speed: 1.6, vy: 2, grav: 6, life: 1, size: 0.1, drag: 0.2 }); });
  for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + 0.17, r = 19 + (i % 3) * 3.2; if (Math.abs(Math.sin(a)) < 0.28 && Math.cos(a) < 0) continue; const x = Math.sin(a) * r, z = Math.cos(a) * r * 0.95 + 1; if (z < -19) continue; tree(lv, x, z, rand(0.9, 1.4), mode === 'night' ? 0x24384a : 0x2f6a4a); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.52, x = Math.sin(a) * 11.5, z = Math.cos(a) * 11.5; lv.world.add(cyl(0.08, 0.12, 3, M(0x2a2a3a, { metal: 0.6 }), x, 1.5, z, 6)); torch(lv, x, 3.3, z, i % 2 === 0, mode === 'night' ? 0xb08aff : 0xffb060); lv.colliders.push({ x, z, r: 0.25 }); }
  floaters(lv, 34, () => { const a = rand(TAU), r = rand(4, 22); return [Math.sin(a) * r, rand(3.2, 8), Math.cos(a) * r]; }, mode === 'night' ? 0xc7a0ff : 0xffd98a);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + rand(0.3), r = rand(250, 330); const m = cone(rand(60, 110), rand(90, 170), M(0x1c2248, { flat: true }), Math.sin(a) * r, 40, Math.cos(a) * r, 5); m.castShadow = false; lv.world.add(m); }
  [[-6.5, 5.5, 0.9], [6.5, 5.5, -0.9]].forEach(b => { const g = new THREE.Group(); g.position.set(b[0], 0, b[1]); g.rotation.y = b[2]; g.add(box(2.2, 0.12, 0.6, M(0x7a5334, { map: tex('wood') }), 0, 0.5, 0)); g.add(box(0.15, 0.5, 0.5, M(0x555566), -0.9, 0.25, 0)); g.add(box(0.15, 0.5, 0.5, M(0x555566), 0.9, 0.25, 0)); lv.world.add(g); lv.colliders.push({ x: b[0], z: b[1], r: 0.9 }); });
  lv.bounds = { x0: -25, x1: 25, z0: -24, z1: 25 };
  lv.upd.push(dt => { if (Math.random() < dt * 5) emit(new V3(P.pos.x + rand(-12, 12), rand(0.3, 4), P.pos.z + rand(-12, 12)), 1, { color: mode === 'night' ? 0xb08aff : 0xfff0a0, speed: 0.3, life: 2.5, size: 0.09, drag: 0.1 }); });
}
/* 방(실내) 만들기 */
function buildRoom(lv, w, d, h, o = {}) {
  const fl = solid(lv, mesh(new THREE.PlaneGeometry(w, d), M(o.floorC ?? 0xffffff, { map: tex(o.floor || 'wood', w / 3, d / 3) }), 0, 0, 0)); fl.rotation.x = -Math.PI / 2;
  const wm = M(o.wallC ?? 0xb8b4c4, { map: tex(o.wall || 'stone', w / 5, h / 4), side: THREE.DoubleSide });
  const mk = (ww, x, z, ry) => { const m = solid(lv, mesh(new THREE.PlaneGeometry(ww, h), wm, x, h / 2, z, false)); m.rotation.y = ry; return m; };
  mk(w, 0, -d / 2, 0); mk(w, 0, d / 2, Math.PI); mk(d, -w / 2, 0, Math.PI / 2); mk(d, w / 2, 0, -Math.PI / 2);
  const ce = solid(lv, mesh(new THREE.PlaneGeometry(w, d), M(o.ceilC ?? 0x3a2c22, { map: tex('wood', w / 3, d / 3) }), 0, h, 0, false)); ce.rotation.x = Math.PI / 2;
  for (let x = -w / 2 + 2; x < w / 2; x += 3) lv.world.add(box(0.3, 0.3, d, M(0x3a2618), x, h - 0.15, 0));
  lv.bounds = { x0: -w / 2 + 0.5, x1: w / 2 - 0.5, z0: -d / 2 + 0.5, z1: d / 2 - 0.5 };
  lv.camBox = { x0: -w / 2 + 0.3, x1: w / 2 - 0.3, z0: -d / 2 + 0.3, z1: d / 2 - 0.3, y1: h - 0.3 };
}
function windowLight(lv, x, y, z, ry, color = 0xbfd0ff, w = 1.6, h = 3) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
  g.add(mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }), 0, 0, 0.03, false));
  g.add(box(w + 0.3, 0.14, 0.14, M(0x3a2618), 0, h / 2, 0.05), box(w + 0.3, 0.14, 0.14, M(0x3a2618), 0, -h / 2, 0.05), box(0.1, h, 0.1, M(0x3a2618), 0, 0, 0.05), box(w, 0.1, 0.1, M(0x3a2618), 0, 0, 0.05));
  const sg = new THREE.CylinderGeometry(w * 0.5, w * 1.5, 9, 4, 1, true); sg.translate(0, -4.5, 0);
  const shaft = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  shaft.rotation.x = -Math.PI / 2 + 0.75; g.add(shaft); const gl = glow(color, 5, 0.5); gl.position.z = 0.3; g.add(gl);
  lv.world.add(g); return g;
}
/* 잉크 그림자 — 기본 적 */
function spawnBlob(lv, x, z, hp = 34) {
  const g = new THREE.Group(), bm = M(0x1a0f2e, { emi: 0x3a1466, ei: 0.8, rough: 0.3, fresh: true });
  const b = sph(0.5, bm, 0, 0, 0, 14); g.add(b);
  [-1, 1].forEach(s => { const e = sph(0.08, new THREE.MeshBasicMaterial({ color: 0xff4fd8 }), s * 0.18, 0.12, 0.42, 6); e.castShadow = false; g.add(e); });
  g.add(glow(0x7a2cff, 2, 0.35)); g.position.set(x, 0.5, z); lv.world.add(g);
  const e = { g, pos: g.position, r: 0.65, hp, off: false, t: rand(9), kx: 0, kz: 0, fl: 0,
    hit(d, pt) { e.hp -= d; e.fl = 0.1; if (Math.random() < 0.3) emit(pt, 2, { color: 0xb04cff, speed: 3, life: 0.4 }); if (e.hp <= 0 && !e.off) { e.off = true; lv.world.remove(g); emit(g.position, 40, { color: 0x9a4cff, speed: 6, life: 0.8, size: 0.2 }); sfx('hit'); sfx('pop'); } } };
  lv.targets.push(e); (lv.enemies = lv.enemies || []).push(e);
  lv.upd.push(dt => {
    if (e.off) return; e.t += dt; e.fl -= dt;
    const dx = P.pos.x - g.position.x, dz = P.pos.z - g.position.z, d = Math.hypot(dx, dz) || 1, hop = Math.abs(Math.sin(e.t * 4));
    if (!G.cine && !G.talking) { g.position.x += (dx / d * 2.3 * hop + e.kx) * dt; g.position.z += (dz / d * 2.3 * hop + e.kz) * dt; }
    e.kx *= 0.9; e.kz *= 0.9; g.position.y = 0.45 + hop * 0.35; b.scale.set(1.1 - hop * 0.2, 0.8 + hop * 0.35, 1.1 - hop * 0.2); g.rotation.y = Math.atan2(dx, dz);
    bm.emissive.setHex(e.fl > 0 ? 0xffffff : 0x3a1466);
    if (d < 1 && P.pos.y < 1) { hurt(8); e.kx = -dx / d * 9; e.kz = -dz / d * 9; }
  });
  return e;
}
const face = (x, z) => { P.face = P.yaw = Math.atan2(x - P.pos.x, z - P.pos.z); };

/* ===== 1장: 다락방의 소동 ===== */
LEVELS.push({ name: '다락방의 소동', env: { bg: 0x070918, fogD: 0.03, hemi: 0.5, sunC: 0x9fb4ff, sunI: 0.7, sunP: [-5, 12, -9], exp: 1.35 }, async run(lv) {
  music('mystery');
  buildRoom(lv, 10, 8, 4, { floor: 'wood', wall: 'wood', wallC: 0x8a7a6a });
  windowLight(lv, -1, 2.3, -3.97, 0, 0xbfd0ff, 1.8, 2);
  const wd = M(0x7a5334, { map: tex('wood') });
  // 침대
  lv.world.add(box(1.5, 0.4, 2.4, wd, -3.4, 0.3, -2.4), box(1.4, 0.2, 2.3, M(0xe9e4d4), -3.4, 0.6, -2.4), box(1.42, 0.22, 1.5, M(0x2b3a7a), -3.4, 0.62, -2), box(0.9, 0.16, 0.5, M(0xffffff), -3.4, 0.76, -3.3), box(1.5, 1.1, 0.12, wd, -3.4, 0.7, -3.62));
  lv.boxes.push({ x0: -4.2, x1: -2.6, z0: -3.7, z1: -1.2 });
  // 긴 탁자와 받침
  lv.world.add(box(4, 0.12, 1.2, wd, 2.4, 0.95, 1.2)); [[0.6, 0.8], [4.2, 0.8], [0.6, 1.6], [4.2, 1.6]].forEach(p => lv.world.add(box(0.12, 0.9, 0.12, wd, p[0], 0.45, p[1])));
  lv.boxes.push({ x0: 0.4, x1: 4.4, z0: 0.6, z1: 1.8 });
  const colors = [0x8fd0ff, 0xffd76a, 0xff8fb0, 0x9fffb0, 0xc79fff], peds = [], jars = [];
  for (let i = 0; i < 5; i++) {
    const x = 1 + i * 0.7, ring = mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 20), new THREE.MeshBasicMaterial({ color: 0xffd76a }), x, 1.03, 1.2, false); ring.rotation.x = Math.PI / 2; ring.visible = false; lv.world.add(ring);
    peds.push({ x, y: 1.2, z: 1.2, ring, used: false });
  }
  // 선반·트렁크·소품
  lv.world.add(box(0.5, 0.08, 4, wd, 4.6, 1.5, -1.5), box(0.5, 0.08, 4, wd, 4.6, 2.3, -1.5), box(1.2, 0.7, 0.8, M(0x5a3a22), -0.5, 0.35, 3.2), box(1.25, 0.1, 0.85, M(0xb98a2e, { metal: 0.6 }), -0.5, 0.72, 3.2));
  lv.boxes.push({ x0: -1.2, x1: 0.2, z0: 2.7, z1: 3.7 });
  const rug = mesh(new THREE.CircleGeometry(1.8, 24), M(0x7a2b3a), -0.5, 0.01, -0.3, false); rug.rotation.x = -Math.PI / 2; lv.world.add(rug);
  for (let i = 0; i < 9; i++) lv.world.add(box(0.12, rand(0.3, 0.45), 0.3, M(pick([0x7a2b3a, 0x2f7a5a, 0xb98a2e, 0x5a2f7a])), 4.6, 2.55, -3.2 + i * 0.16));
  torch(lv, -4.7, 2, 1.5, true); torch(lv, 4.7, 3, 2.8, true);
  colors.forEach((c, i) => {
    const g = new THREE.Group(); g.position.set(4.6, 1.72, -3 + i * 0.7);
    g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.32, 12), M(0xffffff, { op: 0.3, rough: 0.05, fresh: true }), 0, 0, 0, false)); g.add(sph(0.09, new THREE.MeshBasicMaterial({ color: c }), 0, -0.02, 0, 8));
    g.add(cyl(0.11, 0.11, 0.05, M(0x8a6a3a), 0, 0.18, 0, 10)); const gl = glow(c, 1.3, 0.8); g.add(gl);
    const j = { jar: true, g, pos: g.position, r: 0.42, off: true, placed: false, vel: new V3(), home: new V3(), nt: 0, color: c }; jars.push(j); lv.targets.push(j); lv.world.add(g);
  });
  const pong = makePong(); pong.position.set(0, -5, 0); lv.world.add(pong); lv.upd.push(dt => animPong(pong, dt));
  // 도입: 침대에 누워 있는 루카
  lv.groundY = 0.72; P.pos.set(-3.4, 0.72, -1.4); P.face = P.yaw = 0; P.char.rotation.x = -Math.PI / 2; G.ctl = false;
  G.cine = { pos: new V3(-1, 2.6, -3.2), look: new V3(-1, 2.3, -4) };
  await fade(0, 1.2); await camTo(0.5, 2.6, 1, -3.4, 0.8, -2.4, 3.5);
  await card('제1장', '다락방의 소동');
  sfx('pop'); pong.position.set(-2.6, 1.9, -1.2); emit(pong.position, 40, { color: 0xbfc8ff, speed: 3, life: 0.8, size: 0.2 });
  await camTo(-0.8, 2, 0.2, -2.8, 1.6, -1.6, 1.2);
  await talk([['???', '쉿! 루카, 자는 거야? 나야, 다락방 먼지 정령 퐁!'], ['퐁', '네 방학 숙제 "달빛 병"… 뚜껑 열어 보고 싶어서 참을 수가 없었어!']]);
  P.char.rotation.x = 0; lv.groundY = 0; P.pos.set(-2, 0, -1.6); face(4, -1.5);
  await Promise.all([camTo(-3.5, 2.4, 1.5, 4.6, 1.8, -1.5, 1.4), tween(1.2, k => { pong.position.set(lerp(-2.6, 4, k), 1.9 + Math.sin(k * 3.14) * 0.8, lerp(-1.2, -1.5, k)); })]);
  sfx('chime'); jars.forEach(j => { j.off = false; j.home.set(rand(-3, 3), rand(1.4, 2.5), rand(-2.4, 2.6)); j.vel.set(rand(-2, -1), rand(0.5, 1.5), rand(-1, 1)); emit(j.pos, 10, { color: j.color, speed: 2 }); });
  peds.forEach(p => { p.ring.visible = true; });
  await wait(1.4); cineOff(); G.ctl = true; G.beamMode = 'lift'; G.canShield = false; PB.setColor(0xc7b0ff);
  let placed = 0, held = null, holdD = 4, pongT = 4;
  objective('달빛 병 되돌리기', '광선으로 병을 붙잡아 탁자 위 금빛 고리에 놓기 0/5');
  toast('좌클릭을 누르고 있으면 광선!', 2.5);
  lv.upd.push(dt => {
    for (const j of jars) {
      if (j.placed || j === held) continue;
      j.nt -= dt; if (j.nt <= 0) { j.nt = rand(2.5, 5); j.home.set(rand(-3.4, 3.4), rand(1.4, 2.6), rand(-2.6, 2.8)); }
      _v.subVectors(j.home, j.pos); j.vel.addScaledVector(_v, 0.7 * dt); j.vel.multiplyScalar(1 - 0.5 * dt); const mx = placed >= 3 ? 1.9 : 1.2; if (j.vel.length() > mx) j.vel.setLength(mx);
      j.pos.addScaledVector(j.vel, dt); j.pos.y = clamp(j.pos.y, 0.6, 3.3); j.g.rotation.z = Math.sin(G.time * 2 + j.nt) * 0.3;
    }
    if (P.firing) {
      if (!held && P.hitT && P.hitT.jar) { held = P.hitT; held.off = true; holdD = clamp(camera.position.distanceTo(held.pos), 3.5, 7.5); sfx('pop'); }
      if (held) {
        const dd = Math.min(holdD, camera.position.distanceTo(P.aim) - 0.35); _v.copy(ray.ray.origin).addScaledVector(ray.ray.direction, dd);
        held.pos.lerp(_v, 1 - Math.exp(-10 * dt)); PB.set(P.tip, held.pos, 1); held.g.rotation.z = 0;
        for (const p of peds) p.ring.scale.setScalar(!p.used && Math.hypot(held.pos.x - p.x, held.pos.z - p.z) < 0.5 ? 1.5 : 1);
      }
    } else if (held) {
      const j = held; held = null; let best = null, bd = 0.6;
      for (const p of peds) { p.ring.scale.setScalar(1); const d = Math.hypot(j.pos.x - p.x, j.pos.z - p.z); if (!p.used && d < bd && j.pos.y > 0.9 && j.pos.y < 2.8) { bd = d; best = p; } }
      if (best) { best.used = true; j.placed = true; placed++; sfx('chime'); const s = j.pos.clone(); tween(0.35, k => j.pos.lerpVectors(s, _v2.set(best.x, best.y, best.z), k)); best.ring.visible = false; emit(j.pos, 24, { color: j.color, speed: 3, life: 0.7 });
        objective('달빛 병 되돌리기', `광선으로 병을 붙잡아 탁자 위 금빛 고리에 놓기 ${placed}/5`); if (placed === 3) toast('퐁이 병을 더 빨리 날린다!', 1.6); }
      else { j.off = false; j.vel.set(0, 0.4, 0); j.home.copy(j.pos); }
    }
    // 퐁의 장난
    pongT -= dt; const free = jars.filter(j => !j.placed && j !== held);
    if (pongT <= 0 && free.length) { pongT = rand(3, 5); const j = pick(free), s = pong.position.clone(); tween(0.6, k => { pong.position.lerpVectors(s, _v2.copy(j.pos).setY(j.pos.y + 0.5), k); }).then(() => { j.vel.set(rand(-3, 3), rand(1, 2), rand(-3, 3)); sfx('pop'); emit(j.pos, 8, { color: 0xffffff, speed: 2 }); }); }
  });
  await until(() => placed >= 5);
  objective(''); G.ctl = false; PB.off(); await wait(0.6);
  await camTo(-1, 1.9, 2.2, 1.5, 1.6, 0, 1.2);
  { const s = pong.position.clone(); await tween(0.8, k => pong.position.lerpVectors(s, _v2.set(1.2, 1.7, 0), k)); }
  await talk([['퐁', '우와, 다 잡았네! 역시 아스트라의 2학년!'], ['퐁', '나도 학교 구경하고 싶어. 트렁크에 숨어서 따라갈래. 비밀이야!']]);
  { const s = pong.position.clone(); await tween(0.9, k => { pong.position.lerpVectors(s, _v2.set(-0.5, 0.9, 3.2), k); pong.scale.setScalar(1 - k * 0.7); }); sfx('pop'); pong.visible = false; }
  flash(0.7, 1.2); sfx('ring'); await say('', '창밖에 혜성 마차가 도착했다. 학교로 갈 시간이다!');
  await fade(1);
} });

/* ===== 2장: 아스트라 마법학교 (안뜰) ===== */
LEVELS.push({ name: '학교 안뜰', env: { bg: 0x1a1c4a, fog: 0x4a3a6a, fogD: 0.011, hemi: 0.7, skyC: 0xa0a8ff, gndC: 0x4a3a40, sunC: 0xffb080, sunI: 1.0, sunP: [-20, 22, 14] }, async run(lv) {
  music('calm'); buildCourt(lv, 'dusk');
  P.pos.set(0, 0, 20); P.face = P.yaw = Math.PI; G.ctl = false;
  G.cine = { pos: new V3(60, 45, 80), look: new V3(0, 14, -27) };
  const comet = glow(0xbfe6ff, 6, 1); lv.world.add(comet);
  let seen = { miro: false, sera: false }, practiced = false, practicing = false;
  const miro = addNPC(lv, 'miro', 5, 4.5, -2.4, async () => {
    if (!seen.miro) { seen.miro = true; await talk([['미로', '루카! 방학 잘 보냈어? 나 방패 마법 엄청 늘었다!'], ['미로', '상대 마법이 닿기 직전에 방패를 펴면 그대로 되돌려 보낼 수 있어.']]); }
    const c = await choose(['방패 연습하자! (우클릭 / Q)', '나중에 할게']);
    if (c === 0) { practicing = true; let n = 0; objective('방패 연습', '미로의 마법을 막거나 되받아치기 0/3');
      const base = G.mp; lv.onBlock = () => { n++; objective('방패 연습', `미로의 마법을 막거나 되받아치기 ${n}/3`); };
      while (n < 3) { miro.casting = true; await wait(0.5); const s = miro.char.position.clone().setY(1.3); const before = lv.projs.length;
        const pr = shoot(s, _v.copy(P.pos).setY(1).sub(s).normalize().multiplyScalar(9).clone(), { dmg: 3, color: 0x6affc0 }); sfx('shoot'); miro.casting = false;
        await until(() => pr.dead || pr.owner === 'player'); if (G.hp === lv.lastHp) n++; lv.lastHp = G.hp; objective('방패 연습', `미로의 마법을 막거나 되받아치기 ${Math.min(n, 3)}/3`); await wait(0.8); }
      G.hp = 100; practicing = false; practiced = true; sfx('good'); await say('미로', '완벽해! 이제 누가 덤벼도 문제없겠다.'); check(); }
  });
  lv.lastHp = 100;
  const sera = addNPC(lv, 'sera', -6.2, 4.6, 2.2, async () => {
    seen.sera = true;
    await talk([['세라', '루카, 왔구나. 있지… 요즘 옛 서고에서 밤마다 속삭이는 소리가 들린대.'], ['세라', '기록을 찾아봤는데, 오십 년 전에도 똑같은 일이 있었어. 수업 끝나고 같이 가 보자.']]); check();
  });
  addNPC(lv, 'orbel', -3, -13, 0.2, async () => { await talk([['오르벨 교장', '돌아온 걸 환영한다, 루카. 별빛이 올해도 너를 지켜 주기를.'], ['오르벨 교장', '…다만 지하에서 오래된 무언가가 뒤척이는구나. 늘 깨어 있거라.']]); });
  const piz = addNPC(lv, 'pizel', 9, -17, -0.5, async () => {
    if (!(seen.miro && seen.sera)) { await say('피젤 교수', '오, 루카 군! 친구들과 먼저 인사하고 오게. 수업은 그다음이야!'); return; }
    await say('피젤 교수', '자, 정령학 수업을 시작하지! 오늘은 아주… 얌전한 별정령을 준비했다네.'); done = true;
  }, '피젤 교수와 대화 (수업 시작)');
  let done = false, mk = null;
  function check() { if (seen.miro && seen.sera && !mk) { mk = marker(lv, 9, -15.4); objective('정령학 수업', '피젤 교수에게 가서 수업 시작하기'); sfx('good'); } }
  await fade(0, 1.2);
  await Promise.all([camTo(8, 9, 34, 0, 8, -27, 5), tween(4.5, k => { comet.position.set(lerp(120, 0, k), lerp(90, 2, k), lerp(-40, 21, k)); emit(comet.position, 2, { color: 0xbfe6ff, speed: 1, life: 0.8, size: 0.3 }); })]);
  comet.visible = false; emit(comet.position, 60, { color: 0xbfe6ff, speed: 6, life: 1 }); sfx('chime');
  await card('제2장', '아스트라 마법학교'); cineOff(); G.ctl = true;
  objective('친구들과 인사하기', '미로와 세라에게 다가가 E로 대화');
  await until(() => done);
  objective(''); await fade(1);
} });

/* ===== 3장: 정령학 수업 ===== */
LEVELS.push({ name: '정령학 수업', env: { bg: 0x2a2440, fogD: 0.012, hemi: 0.85, skyC: 0xfff0d0, gndC: 0x6a5a4a, sunC: 0xffe0b0, sunI: 0.9, sunP: [-12, 14, 4], exp: 1.25 }, async run(lv) {
  music('calm'); buildRoom(lv, 18, 14, 7.5, { floor: 'wood', wall: 'stone' });
  for (let z = -4; z <= 4; z += 4) { windowLight(lv, -8.97, 4, z, Math.PI / 2, 0xffe6b0, 1.8, 4); }
  const wd = M(0x7a5334, { map: tex('wood') });
  lv.world.add(box(7, 3, 0.15, M(0x1f3a30), 0, 3.2, -6.9), box(7.4, 0.2, 0.25, wd, 0, 1.6, -6.85)); // 칠판
  lv.world.add(box(3.4, 1, 1.1, wd, 0, 0.5, -4.6)); lv.boxes.push({ x0: -1.7, x1: 1.7, z0: -5.2, z1: -4 });
  for (let r = 0; r < 2; r++) for (let c = -1; c <= 1; c++) { const x = c * 4.6, z = 1 + r * 3.2; lv.world.add(box(2.2, 0.1, 0.9, wd, x, 0.85, z), box(0.1, 0.85, 0.8, wd, x - 1, 0.42, z), box(0.1, 0.85, 0.8, wd, x + 1, 0.42, z)); lv.boxes.push({ x0: x - 1.1, x1: x + 1.1, z0: z - 0.45, z1: z + 0.45 }); }
  torch(lv, 8.8, 3.5, -3, true); torch(lv, 8.8, 3.5, 3, true);
  floaters(lv, 16, () => [rand(-8, 8), rand(5, 6.8), rand(-6, 6)]);
  // 등불 우리
  const cage = new THREE.Group(); cage.position.set(0, 1.6, -4.6); lv.world.add(cage);
  cage.add(cyl(0.6, 0.6, 0.08, M(0xb98a2e, { metal: 0.7, rough: 0.3 }), 0, -0.55, 0), cone(0.62, 0.4, M(0xb98a2e, { metal: 0.7, rough: 0.3 }), 0, 0.75, 0));
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; cage.add(cyl(0.015, 0.015, 1.1, M(0xb98a2e, { metal: 0.7 }), Math.sin(a) * 0.55, 0, Math.cos(a) * 0.55, 4)); }
  const cg = glow(0xffe28a, 3, 0.9); cage.add(cg);
  const piz = addNPC(lv, 'pizel', 2.4, -4.8, 0), miro = addNPC(lv, 'miro', -4.6, 4.9, Math.PI), sera = addNPC(lv, 'sera', 4.6, 4.9, Math.PI);
  P.pos.set(0, 0, 3); P.face = P.yaw = Math.PI; G.ctl = false; G.cine = { pos: new V3(0, 3, 4), look: new V3(1, 1.8, -4.6) };
  await fade(0); await card('제3장', '정령학 수업');
  await talk([['피젤 교수', '별정령은 수줍음이 많지. 절대 달아나지 않으니 안심하게. 자, 우리를 열면—']]);
  sfx('glass'); flash(0.5, 0.6); cg.visible = false; G.shake = 0.3;
  const N = 14, wisps = []; let caught = 0;
  const cols = [0xffe28a, 0x8fd0ff, 0xff9fc8, 0x9fffb0];
  for (let i = 0; i < N; i++) {
    const g = makeWisp(cols[i % 4]); g.position.set(0, 1.8, -4.6); lv.world.add(g);
    const w = { g, pos: g.position, r: 0.55, off: false, vel: new V3(rand(-6, 6), rand(2, 6), rand(0, 8)), dest: new V3(), nt: 0, cap: 0, sp: rand(3.5, 5.5), shotT: rand(3, 9),
      hit(d, pt, dt) { w.cap += dt * 2; } };
    wisps.push(w); lv.targets.push(w);
  }
  emit(new V3(0, 1.8, -4.6), 80, { color: 0xffe28a, speed: 8, life: 1 });
  piz.casting = true; await wait(0.9); piz.casting = false;
  await say('피젤 교수', '으아악! 계, 계획대로야! 루카 군, 광선으로 붙잡아 주게!');
  walkTo(piz, 0, -5.9, 5).then(() => { piz.char.scale.y = 0.55; piz.look = false; });
  cineOff(); G.ctl = true; music('fly');
  const upObj = () => objective('별정령 붙잡기', `광선을 정령에게 잠깐 맞추고 있기 ${caught}/${N}`); upObj();
  lv.upd.push(dt => {
    for (const w of wisps) {
      if (w.off) continue; const last = N - caught <= 1, sp = last ? 8 : w.sp;
      w.nt -= dt; if (w.nt <= 0) { w.nt = rand(0.8, 2); w.dest.set(rand(-7.5, 7.5), rand(1.3, 6), rand(-5.5, 6)); }
      _v.subVectors(w.dest, w.pos).normalize(); w.vel.lerp(_v.multiplyScalar(sp), 2.5 * dt);
      if (P.firing && w.pos.distanceTo(P.aim) < 2.2 && P.hitT !== w) { _v.subVectors(w.pos, P.aim).normalize(); w.vel.addScaledVector(_v, 14 * dt); }
      w.pos.addScaledVector(w.vel, dt * (w.cap > 0 ? 0.35 : 1)); w.pos.x = clamp(w.pos.x, -8.3, 8.3); w.pos.y = clamp(w.pos.y, 0.8, 6.8); w.pos.z = clamp(w.pos.z, -6.3, 6.3);
      w.g.userData.core.rotation.y += dt * 5; const f = Math.sin(G.time * 22 + w.sp * 9) * 0.6; w.g.userData['w-1'].rotation.z = -1.1 + f; w.g.userData.w1.rotation.z = 1.1 - f;
      w.g.scale.setScalar(1 + w.cap * 0.6); w.cap = Math.max(0, w.cap - dt * 0.8);
      if (Math.random() < dt * 6) emit(w.pos, 1, { color: 0xfff0b0, speed: 0.3, life: 0.5, size: 0.1 });
      w.shotT -= dt; if (w.shotT <= 0 && caught > 2) { w.shotT = rand(5, 10); shoot(w.pos.clone(), _v.copy(P.pos).setY(1).sub(w.pos).normalize().multiplyScalar(8).clone(), { dmg: 4, color: 0xffb050, r: 0.14, src: w }); sfx('pop'); }
      if (w.cap >= 0.75) { w.off = true; caught++; sfx('ring'); upObj(); const s = w.pos.clone(); emit(s, 20, { color: 0xffe28a, speed: 4 });
        tween(0.4, k => { w.pos.lerpVectors(s, P.tip, k); w.g.scale.setScalar(1.4 - k * 1.3); }).then(() => { lv.world.remove(w.g); }); if (N - caught === 1) toast('마지막 한 마리! 엄청 빠르다!', 1.6); }
    }
  });
  await until(() => caught >= N);
  objective(''); G.ctl = false; PB.off(); sfx('chime'); music('calm'); await wait(0.6);
  piz.char.scale.y = 1; G.cine = null; await camTo(0, 2.6, 0, 0, 1.6, -5.9, 1);
  await talk([['피젤 교수', '훌륭해! 내가 책상 밑에서 지휘한 보람이 있군!'], ['세라', '(작게) 루카, 오늘 밤 옛 서고야. 잊지 마.']]);
  await fade(1);
} });

/* ===== 4장: 옛 서고의 속삭임 ===== */
LEVELS.push({ name: '옛 서고의 속삭임', env: { bg: 0x060714, fog: 0x0a0c22, fogD: 0.035, hemi: 0.38, sunC: 0x8fa8ff, sunI: 0.45, sunP: [-10, 16, -6], exp: 1.4 }, async run(lv) {
  music('mystery'); buildRoom(lv, 26, 20, 8, { floor: 'tile', floorC: 0x8a88a0, wall: 'stone', wallC: 0x7a7890 });
  const bk = M(0xffffff, { map: tex('books', 2, 1) }), wd = M(0x4a3020, { map: tex('wood') });
  const shelf = (x, z, len, rot) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot ? Math.PI / 2 : 0; g.add(box(len, 4.6, 0.7, wd, 0, 2.3, 0)); g.add(mesh(new THREE.PlaneGeometry(len - 0.2, 4.2), bk, 0, 2.35, 0.36, false)); const b2 = mesh(new THREE.PlaneGeometry(len - 0.2, 4.2), bk, 0, 2.35, -0.36, false); b2.rotation.y = Math.PI; g.add(b2); lv.world.add(g); g.children.forEach(c => lv.solids.push(c)); lv.world.updateMatrixWorld(true);
    lv.boxes.push(rot ? { x0: x - 0.4, x1: x + 0.4, z0: z - len / 2, z1: z + len / 2 } : { x0: x - len / 2, x1: x + len / 2, z0: z - 0.4, z1: z + 0.4 }); };
  for (let x = -9; x <= 9; x += 4.5) { if (x !== 0) { shelf(x, 3.5, 7, true); } shelf(x, -5, 5, true); }
  shelf(-6, -9.4, 9, false); shelf(4, -9.4, 6, false);
  for (let z = -6; z <= 6; z += 6) windowLight(lv, -12.97, 5, z, Math.PI / 2, 0x9fb4ff, 2, 4.5);
  floaters(lv, 26, () => [rand(-12, 12), rand(3.5, 7), rand(-9, 9)], 0xffc878, 0.6);
  torch(lv, 0, 2.6, 9.7, true, 0xffb060); torch(lv, 12.7, 2.6, 0, true, 0xffb060);
  // 낡은 거울과 조각
  const mir = new THREE.Group(); mir.position.set(11.2, 0, -8.2); mir.rotation.y = -0.9; lv.world.add(mir);
  mir.add(box(2.2, 3.6, 0.2, M(0xb98a2e, { metal: 0.8, rough: 0.35 }), 0, 2.1, 0)); mir.add(box(2.6, 0.3, 0.6, M(0x4a3020), 0, 0.15, 0));
  const glassM = new THREE.MeshBasicMaterial({ color: 0x1a1030 }); const glass = mesh(new THREE.PlaneGeometry(1.8, 3.2), glassM, 0, 2.1, 0.11, false); mir.add(glass);
  const echo = castChar('nox'); echo.traverse(m => { if (m.isMesh) m.material = new THREE.MeshBasicMaterial({ color: 0x4a2a7a, transparent: true, opacity: 0 }); }); echo.userData.tipGlow.visible = false; echo.position.set(0, 0.45, 0.14); echo.scale.set(1, 1, 0.05); mir.add(echo);
  const eyes = [-1, 1].map(s => { const e = glow(0xd0a0ff, 0.25, 0); e.position.set(s * 0.08, 2.03, 0.3); mir.add(e); return e; });
  const mg = glow(0x7a2cff, 5, 0.25); mg.position.set(0, 2.1, 0.3); mir.add(mg);
  lv.colliders.push({ x: 11.2, z: -8.2, r: 1.3 });
  const shard = mesh(new THREE.OctahedronGeometry(0.22), M(0xd8c8ff, { emi: 0x9a5cff, ei: 2, flat: true, metal: 0.6, rough: 0.1 }), 9.4, 0.5, -6.6, false); shard.scale.y = 1.8; lv.world.add(shard); shard.add(glow(0xb07aff, 2.5, 0.8));
  lv.upd.push(dt => { shard.rotation.y += dt * 1.5; shard.position.y = 0.6 + Math.sin(G.time * 2) * 0.12; mg.material.opacity = 0.25 + Math.sin(G.time * 1.3) * 0.1;
    if (Math.random() < dt * 10) { const a = rand(TAU); emit(new V3(P.pos.x + Math.sin(a) * 2, rand(0.5, 2), P.pos.z + Math.cos(a) * 2), 1, { color: 0x9a6cff, speed: 0.1, vx: (9.4 - P.pos.x) * 0.25, vz: (-6.6 - P.pos.z) * 0.25, life: 1.6, size: 0.1, drag: 0 }); } });
  // 유령 사서
  const ghost = addNPC(lv, 'orbel', -1.5, 5.5, Math.PI, async () => { await talk([['유령 사서 휘슬', '쉬잇! 서고에서는 정숙… 아, 살아 있는 학생이군요. 오랜만이에요.'], ['유령 사서 휘슬', '저 안쪽, 낡은 거울 근처에서 누가 자꾸 속삭여요. 보랏빛 먼지를 따라가 보세요.']]); }, '유령 사서와 대화');
  ghost.char.userData.name = '유령 사서 휘슬'; ghost.char.traverse(m => { if (m.isMesh) m.material = M(0xbfe6ff, { op: 0.4, emi: 0x7fc8ff, ei: 0.8, fresh: true }); });
  lv.bob.push({ o: ghost.char, y: 0.35, s: 0, a: 0.15, sp: 1.2 }); ghost.col.off = true;
  const sera = addNPC(lv, 'sera', 1.5, 8, Math.PI, async () => { await say('세라', '난 여기서 오십 년 전 기록을 찾아볼게. 속삭임이 어디서 나는지 알아봐 줘!'); });
  P.pos.set(0, 0, 8); P.face = P.yaw = Math.PI; G.ctl = false; G.cine = { pos: new V3(0, 6, 9), look: new V3(8, 1, -6) };
  await fade(0); await card('제4장', '옛 서고의 속삭임'); cineOff(); G.ctl = true;
  objective('속삭임의 근원 찾기', '보랏빛 먼지가 흘러가는 곳으로');
  await until(() => near(9.4, -6.6, 7.5));
  // 잉크 그림자 등장
  G.ctl = false; await camTo(P.pos.x, 2.4, P.pos.z + 3, 8, 0.8, -5, 0.9); sfx('roar'); music('battle');
  const bl = [[7, -4.5], [10.5, -3.5], [6.5, -7.5], [11, -6]].map(p => { emit(new V3(p[0], 0.5, p[1]), 30, { color: 0x7a2cff, speed: 4, life: 0.8 }); return spawnBlob(lv, p[0], p[1]); });
  await say('', '책갈피 사이에서 잉크 그림자들이 흘러나온다!'); cineOff(); G.ctl = true;
  objective('잉크 그림자 물리치기', '광선으로 공격 · Shift로 피하기');
  await until(() => bl.every(b => b.off)); music('mystery'); sfx('good');
  objective('거울 조각 줍기', '반짝이는 조각에 다가가 E');
  let got = false; addInteract(lv, shard.position, 2.2, '거울 조각 줍기', async () => { got = true; }, true);
  await until(() => got);
  objective(''); G.ctl = false; sfx('glass'); shard.visible = false; PB.off();
  // 거울 속 에코와 대화
  const mp = new V3(), md = new V3(Math.sin(-0.9), 0, Math.cos(-0.9)); mp.set(11.2, 2.1, -8.2);
  await camTo(mp.x + md.x * 3.6, 2.2, mp.z + md.z * 3.6, mp.x, 2.1, mp.z, 1.6);
  await tween(1.5, k => { echo.traverse(m => { if (m.isMesh) m.material.opacity = k * 0.9; }); eyes.forEach(e => { e.material.opacity = k; }); glassM.color.setRGB(0.1 + k * 0.1, 0.06, 0.19 + k * 0.2); });
  lv.upd.push(dt => animChar(echo, dt, 0, false));
  await talk([['???', '…드디어. 내 목소리가 들리는 사람이 왔구나.'], ['에코', '안녕, 루카. 난 에코야. 오십 년 동안 누구와도 말을 못 했어.']]);
  const c1 = await choose(['넌 누구야?', '왜 거울 속에 있어?']);
  await say('에코', c1 === 0 ? '예전엔 이 학교 학생이었지. 누구보다 뛰어난. 지금은… 메아리일 뿐이야.' : '갇혔거든. 학교 아래 "잠든 서고"에 내 진짜 몸이 있어. 차갑고 조용한 곳이지.');
  await say('에코', '그 조각을 지니고 다녀 줄래? 네가 걸으면 나도 세상을 볼 수 있어. 친구가 되자.');
  const c2 = await choose(['알았어, 도와줄게', '…조금 수상한데']);
  G.trust = c2 === 0; eyes.forEach(e => e.material.color.set(0xff3a6a)); sfx('roar'); G.shake = 0.2;
  await say('에코', c2 === 0 ? '고마워, 루카. 넌 정말… 쓸모 있는 친구야.' : '현명하네. 하지만 넌 결국 내려오게 될 거야. 모두가 그랬듯이.');
  await tween(0.8, k => { echo.traverse(m => { if (m.isMesh) m.material.opacity = (1 - k) * 0.9; }); eyes.forEach(e => { e.material.opacity = 1 - k; }); });
  await say('세라', '루카! 찾았어! 오십 년 전 사라진 학생의 이름은— …어? 그 조각, 뭐야?');
  await fade(1);
} });

/* ===== 5장: 별고리 경주 ===== */
function makeBroom(ch) {
  const g = new THREE.Group();
  const st = cyl(0.035, 0.045, 2.4, M(0x6b4a2a), 0, 0, 0, 8); st.rotation.x = Math.PI / 2; g.add(st);
  const br = cone(0.24, 0.9, M(0xc8a05a, { flat: true }), 0, 0, -1.5, 8); br.rotation.x = Math.PI / 2; g.add(br);
  ch.position.set(0, -0.62, -0.1); ch.rotation.set(0.25, 0, 0); g.add(ch);
  const u = ch.userData; u.armL.rotation.x = -1.1; u.armR.rotation.x = -1.1; u.footL.position.set(-0.2, 0.3, 0.1); u.footR.position.set(0.2, 0.3, 0.1);
  return g;
}
LEVELS.push({ name: '별고리 경주', env: { bg: 0x2a2a6a, fog: 0x6a4a7a, fogD: 0.0035, hemi: 0.9, skyC: 0xffc8a0, gndC: 0x3a4a5a, sunC: 0xffb070, sunI: 1.1, sunP: [-30, 30, 20] }, async run(lv) {
  music('fly'); lv.customPlayer = true; lv.noCross = true; $('bars').hidden = true;
  addSky(lv, 0x1a1c5a, 0xff9a5a, 500, { p: [-260, 60, -200], s: 200, c: 0xffc070 });
  const gr = mesh(new THREE.CircleGeometry(600, 40), M(0x4a7a52, { map: tex('grass', 80, 80) }), 0, 0, 0); gr.rotation.x = -Math.PI / 2; lv.world.add(gr);
  const lake = mesh(new THREE.CircleGeometry(46, 40), M(0x3a6ad8, { emi: 0x4a3a8a, ei: 0.7, rough: 0.05, metal: 0.6 }), 70, 0.1, 30, false); lake.rotation.x = -Math.PI / 2; lv.world.add(lake);
  castle(lv, 0, 0, 1.6);
  for (let i = 0; i < 160; i++) { const a = rand(TAU), r = rand(50, 260), x = Math.sin(a) * r, z = Math.cos(a) * r; if (Math.hypot(x - 70, z - 30) < 50) continue; const s = rand(3, 7); const t = cone(s * 0.6, s * 2, M(pick([0x2f5d3a, 0x26503a, 0x3a6a4a]), { flat: true }), x, s, z, 6); t.castShadow = false; lv.world.add(t); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r = rand(330, 420); const m = cone(rand(70, 130), rand(120, 220), M(0x2a2a5a, { flat: true }), Math.sin(a) * r, 50, Math.cos(a) * r, 5); m.castShadow = false; lv.world.add(m); }
  for (let i = 0; i < 26; i++) { const c = new THREE.Group(); c.position.set(rand(-250, 250), rand(45, 100), rand(-250, 250)); for (let k = 0; k < 4; k++) { const s = sph(rand(5, 10), M(0xffe0d0, { op: 0.55, emi: 0xff9a7a, ei: 0.3 }), rand(-9, 9), rand(-2, 2), rand(-5, 5), 8); s.castShadow = false; c.add(s); } lv.world.add(c); }
  const NR = 22, pts = [];
  for (let i = 0; i < NR; i++) { const a = i / NR * TAU; const r = 95 + Math.sin(a * 3) * 28; pts.push(new V3(Math.sin(a) * r, 26 + Math.sin(a * 2 + 1) * 13 + Math.cos(a * 5) * 5, Math.cos(a) * r)); }
  const curve = new THREE.CatmullRomCurve3(pts, true), rings = [];
  const rmA = new THREE.MeshBasicMaterial({ color: 0xffd76a }), rmB = new THREE.MeshBasicMaterial({ color: 0x6a6aa0 });
  for (let i = 0; i < NR; i++) {
    const p = curve.getPointAt(i / NR), t = curve.getTangentAt(i / NR), m = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.3, 8, 28), rmB); m.position.copy(p); m.lookAt(p.clone().add(t));
    const gl = glow(0xffd76a, 16, 0); m.add(gl); lv.world.add(m); rings.push({ m, p, gl });
  }
  // 타는 사람들
  const pb = makeBroom(P.char); lv.world.add(pb);
  lv.cleanup = () => { scene.add(P.char); P.char.position.set(0, 0, 0); P.char.rotation.set(0, 0, 0); const u = P.char.userData; u.footL.position.set(-0.1, 0.04, 0.06); u.footR.position.set(0.1, 0.04, 0.06); $('bars').hidden = false; };
  const rivals = ['miro', 'rival'].map((id, i) => { const c = castChar(id), g = makeBroom(c); lv.world.add(g); return { g, u: -0.02 - i * 0.012, off: (i ? -1 : 1) * 3, sp: i ? 0.0178 : 0.0165, name: CAST[id].name }; });
  const pos = curve.getPointAt(0).clone(), tan = curve.getTangentAt(0); pos.addScaledVector(tan, -30);
  let yaw = Math.atan2(tan.x, tan.z), pitch = 0, roll = 0, next = 0, spd = 0, boost = 100, going = false, fin = false, rank = 1;
  G.cine = { pos: pos.clone().add(new V3(6, 3, 8)), look: pos.clone() }; pb.position.copy(pos); pb.rotation.set(0, yaw, 0, 'YXZ');
  const place = () => { rivals.forEach(r => { const p = curve.getPointAt(((r.u % 1) + 1) % 1), t = curve.getTangentAt(((r.u % 1) + 1) % 1); r.g.position.copy(p).x += r.off; r.g.position.y += Math.sin(G.time * 2 + r.off) * 1.2; r.g.lookAt(r.g.position.clone().add(t)); if (Math.random() < 0.4) emit(r.g.position, 1, { color: 0xffb0d0, speed: 0.5, life: 0.5, size: 0.2 }); }); };
  place(); pb.rotation.order = 'YXZ';
  await fade(0); await card('제5장', '별고리 경주');
  await say('미로', '루카! 별고리 스물두 개를 먼저 통과하는 사람이 우승이야. 지면 저녁 푸딩 내 거다!');
  for (const s of ['3', '2', '1', '출발!']) { toast(s, 0.7); sfx(s === '출발!' ? 'good' : 'pop'); await wait(0.8); }
  going = true; $('help').innerHTML = '마우스 / WASD 방향 · Space 또는 좌클릭 가속';
  lv.upd.push(dt => {
    if (going) rivals.forEach(r => { const lead = next / NR - r.u; r.u += r.sp * (1 + clamp(lead * 2.5, -0.22, 0.3)) * dt; });
    place();
    if (!going) return;
    let sx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.x, sy = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + joy.y;
    if (locked || isTouch) { sx += clamp(mouse.dx * 0.12, -3, 3); sy -= clamp(mouse.dy * 0.12, -3, 3); } else { sx += clamp(mouse.nx * 1.6, -1.3, 1.3); sy += clamp(mouse.ny * 1.6, -1.3, 1.3); }
    yaw -= sx * 1.25 * dt; pitch = clamp(pitch + sy * 1.1 * dt, -0.9, 0.9); roll = damp(roll, sx * 0.6, 5, dt);
    const bst = !fin && (keys.Space || mouse.l || keys.T_fire || keys.ShiftLeft) && boost > 0; if (bst) boost -= 30 * dt; else boost = Math.min(100, boost + 9 * dt);
    spd = damp(spd, fin ? 8 : bst ? 44 : 29, 2.5, dt);
    const cp = Math.cos(pitch); _v.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp); pos.addScaledVector(_v, spd * dt);
    if (pos.y < 3) { pos.y = 3; pitch = Math.max(pitch, 0.2); } if (pos.y > 110) { pos.y = 110; pitch = Math.min(pitch, 0); }
    pb.position.copy(pos); P.pos.copy(pos); pb.rotation.set(-pitch, yaw, -roll);
    G.cine.pos.lerp(_v2.copy(pos).addScaledVector(_v, -8.5).setY(pos.y + 2.6 - Math.sin(pitch) * 4), 1 - Math.exp(-7 * dt)); G.cine.look.copy(pos).addScaledVector(_v, 8);
    camera.fov = damp(camera.fov, bst ? 78 : 64, 4, dt); camera.updateProjectionMatrix();
    emit(_v2.copy(pos).addScaledVector(_v, -1.7), bst ? 3 : 1, { color: bst ? 0xffe28a : 0x9fd8ff, speed: 0.8, life: 0.7, size: 0.22 });
    if (next < NR) {
      const r = rings[next]; r.m.material = rmA; r.gl.material.opacity = 0.6 + Math.sin(G.time * 6) * 0.2; r.m.scale.setScalar(1 + Math.sin(G.time * 6) * 0.05);
      if (pos.distanceTo(r.p) < 5.2) { r.m.visible = false; emit(r.p, 50, { color: 0xffd76a, speed: 9, life: 0.8, size: 0.3 }); sfx('ring'); next++; boost = Math.min(100, boost + 22);
        if (next === NR) { fin = true; rank = 1 + rivals.filter(v => v.u >= 1).length; } }
      else if (pos.distanceTo(r.p) > 170) { const b = curve.getPointAt(((next - 0.6) / NR + 1) % 1); pos.copy(b); const t = curve.getTangentAt(((next - 0.6) / NR + 1) % 1); yaw = Math.atan2(t.x, t.z); pitch = 0; toast('코스로 돌아왔다!', 1); }
    }
    const pr = 1 + rivals.filter(v => v.u > (next - 0.3) / NR).length;
    objective('별고리 경주', `고리 ${next}/${NR} · 현재 ${pr}등 · 가속 ${Math.round(boost)}%`);
  });
  await until(() => fin);
  sfx('chime'); toast(rank === 1 ? '1등! 우승!' : `${rank}등으로 도착!`, 2.5); await wait(2.6);
  going = false; objective('');
  await say('미로', rank === 1 ? '졌다…! 푸딩은 네 거야. 진짜 빨랐어!' : '헤헤, 푸딩은 내 거! 그래도 멋진 비행이었어.');
  scene.fog.color.set(0x2a1a4a); flash(0.8, 1.5); sfx('roar'); G.shake = 0.5; music('mystery');
  await talk([['미로', '방금 성에서 보랏빛 섬광이…! 서고 쪽이야!'], ['', '주머니 속 거울 조각이 차갑게 떨린다.']]);
  await fade(1); camera.fov = 62; camera.updateProjectionMatrix(); $('help').innerHTML = '1·2·3 주문 선택 · WASD 이동 · 마우스 조준 · 좌클릭 광선 · 우클릭/Q 방패<br>Shift 회피 · Space 점프 · E 대화 · M 음소거';
} });

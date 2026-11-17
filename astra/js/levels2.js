'use strict';
/* ===== 6장: 유리가 된 친구 · 룬의 노래 ===== */
function crystalize(ch) { const m = M(0xbfe8ff, { emi: 0x4a8fd0, ei: 0.7, op: 0.8, metal: 0.4, rough: 0.08, flat: true, fresh: true }); ch.traverse(o => { if (o.isMesh) o.material = m; else if (o.isSprite) o.visible = false; }); return m; }
LEVELS.push({ name: '유리가 된 친구', env: { bg: 0x05061a, fog: 0x1a1038, fogD: 0.018, hemi: 0.5, skyC: 0x8a7aff, gndC: 0x1a1430, sunC: 0x9a8aff, sunI: 0.6, sunP: [-14, 26, 10], exp: 1.35 }, async run(lv) {
  music('mystery'); buildCourt(lv, 'night');
  const st = castChar('sera'); st.position.set(-5, 0, -9); st.rotation.y = 0.6; st.userData.armR.rotation.x = -1.3; crystalize(st); lv.world.add(st); lv.colliders.push({ x: -5, z: -9, r: 0.6 });
  const sg = glow(0x9fd8ff, 4, 0.5); sg.position.set(-5, 1.2, -9); lv.world.add(sg);
  lv.upd.push(dt => { if (Math.random() < dt * 6) emit(new V3(-5 + rand(-0.5, 0.5), rand(0.2, 1.8), -9 + rand(-0.5, 0.5)), 1, { color: 0xbfe8ff, speed: 0.2, vy: 0.5, life: 1.2, size: 0.08 }); });
  const orb = addNPC(lv, 'orbel', -3, -11, 0.3, async () => { await say('오르벨 교장', '유리 저주는 거울의 주인을 쓰러뜨려야만 풀린다. 별빛을 믿거라, 루카.'); });
  const piz = addNPC(lv, 'pizel', -7.6, -10.6, 0.8, async () => { await say('피젤 교수', '나, 나는 무섭지 않네! 이 떨림은… 준비 운동이야!'); });
  const miro = addNPC(lv, 'miro', -6.2, -7, 2.2, async () => { await say('미로', '세라를 꼭 되돌려 놓자. 룬 네 개, 속삭임의 순서대로야!'); });
  P.pos.set(0, 0, 13); P.face = P.yaw = Math.PI; G.ctl = false; G.cine = { pos: new V3(-2, 1.8, -5), look: new V3(-5, 1.3, -9) };
  await fade(0); await card('제6장', '유리가 된 친구');
  await talk([['미로', '세라…! 온몸이 유리처럼…!'], ['오르벨 교장', '유리 저주다. 오십 년 전 봉인된 "거울의 주인"이 깨어나고 있어.'], ['에코', '(조각 속에서) 내려와, 루카. 분수 아래야. 내 노래를 따라 문을 열어.']]);
  // 룬 석상
  const runes = [[6.5, 5.5], [-6.5, 5.5], [-6.5, -5.5], [6.5, -5.5]].map((p, i) => {
    const col = [0x8fd0ff, 0xffd76a, 0xff8fb0, 0x9fffb0][i], g = new THREE.Group(); g.position.set(p[0], -3, p[1]); g.rotation.y = Math.atan2(-p[0], -p[1]);
    const mm = M(0x3a3a55, { emi: col, ei: 0.25, flat: true, fresh: true }); g.add(box(1.1, 2.8, 0.6, mm, 0, 1.4, 0)); const top = mesh(new THREE.OctahedronGeometry(0.4), mm, 0, 3.2, 0); g.add(top);
    const gl = glow(col, 5, 0.15); gl.position.y = 1.6; g.add(gl); lv.world.add(g); lv.colliders.push({ x: p[0], z: p[1], r: 0.8 });
    const r = { rune: i, g, mm, gl, col, pos: new V3(p[0], 1.5, p[1]), r: 1.2, lit: 0 }; lv.targets.push(r); return r;
  });
  await camTo(0, 9, 16, 0, 1, 0, 1.5); sfx('boom'); G.shake = 0.3;
  await tween(1.6, k => runes.forEach(r => { r.g.position.y = -3 + 3 * k; if (Math.random() < 0.3) emit(new V3(r.pos.x, 0.2, r.pos.z), 2, { color: 0x8a7a6a, speed: 2, life: 0.6, grav: 5 }); }));
  cineOff(); G.ctl = true; P.pos.set(0, 0, 11);
  let seq = [], inp = 0, showing = false, round = 0, lastCur = null, solved = false;
  const light = r => { r.lit = 0.55; sfx('rune' + r.rune); emit(r.pos, 14, { color: r.col, speed: 3, life: 0.6 }); };
  async function show() { showing = true; objective('룬의 노래', `빛나는 순서를 기억하세요 (${round + 1}/3)`); await wait(0.9); for (const i of seq) { light(runes[i]); await wait(0.62); } showing = false; inp = 0; objective('룬의 노래', `같은 순서로 룬에 광선 비추기 (${round + 1}/3)`); }
  function gen(n) { seq = []; while (seq.length < n) { const v = Math.floor(rand(4)); if (v !== seq[seq.length - 1]) seq.push(v); } }
  lv.upd.push(dt => {
    runes.forEach(r => { r.lit = Math.max(0, r.lit - dt); const k = r.lit > 0 ? 1 : 0; r.mm.emissiveIntensity = damp(r.mm.emissiveIntensity, 0.25 + k * 2.4, 12, dt); r.gl.material.opacity = 0.15 + k * 0.75; });
    const cur = P.firing && P.hitT && P.hitT.rune !== undefined ? P.hitT : null;
    if (cur && cur !== lastCur && !showing && !solved && seq.length) {
      light(cur);
      if (cur.rune === seq[inp]) { inp++; if (inp >= seq.length) { round++; sfx('good'); if (round >= 3) solved = true; else { toast('맞았다!', 1); gen(3 + round); show(); } } }
      else { sfx('bad'); toast('순서가 틀렸다. 다시!', 1.2); show(); }
    }
    lastCur = cur;
  });
  gen(3); show();
  await until(() => solved);
  objective(''); G.ctl = false; PB.off(); sfx('chime'); await camTo(0, 7, 10, 0, 1, 0, 1.2); sfx('boom'); G.shake = 0.4; lv.dry = true;
  const vortex = mesh(new THREE.CircleGeometry(2.7, 28), new THREE.MeshBasicMaterial({ color: 0x9a5cff, transparent: true, opacity: 0 }), 0, 0.66, 0, false); vortex.rotation.x = -Math.PI / 2; lv.world.add(vortex); const vg = glow(0x9a5cff, 10, 0); vg.position.y = 1; lv.world.add(vg);
  await tween(2, k => { lv.water.position.y = 0.62 - k * 0.5; lv.star.position.y = 3.2 + k * 3; vortex.material.opacity = k * 0.9; vg.material.opacity = k * 0.6; });
  lv.upd.push(dt => { vortex.rotation.z += dt * 2; emit(new V3(rand(-2.5, 2.5), 0.8, rand(-2.5, 2.5)), 1, { color: 0xb07aff, speed: 0.4, vy: 2, life: 1, size: 0.12 }); });
  await talk([['피젤 교수', '내, 내가 앞장서겠네! …아니, 자네가 먼저 가게. 뒤는 내가 맡지!'], ['미로', '같이 가자, 루카!']]);
  cineOff(); G.ctl = true; objective('분수 속으로', '분수에 다가가 E로 뛰어들기');
  let go = false; addInteract(lv, new V3(0, 0, 0), 5, '분수 속으로 뛰어들기', async () => { go = true; }, true);
  await until(() => go); sfx('whoosh'); await fade(1, 0.5);
} });

/* ===== 7장: 별빛 통로 (미끄럼) ===== */
LEVELS.push({ name: '별빛 통로', env: { bg: 0x05040f, fog: 0x0c0820, fogD: 0.02, hemi: 0.75, skyC: 0x9a8aff, gndC: 0x2a1a4a, sunI: 0.1 }, async run(lv) {
  music('fly'); lv.customPlayer = true; lv.noCross = true;
  const pts = []; for (let i = 0; i <= 17; i++) pts.push(new V3(Math.sin(i * 0.8) * 16, -i * 7, -i * 36));
  const curve = new THREE.CatmullRomCurve3(pts), len = curve.getLength();
  lv.world.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 280, 5.2, 16, false), new THREE.MeshStandardMaterial({ map: tex('rock', 60, 4), side: THREE.BackSide, roughness: 0.9, emissive: 0x1a1040, emissiveIntensity: 0.9 })));
  const Y = new V3(0, 1, 0), fp = new V3(), ft = new V3(), fr = new V3(), fu = new V3();
  const fr_ = s => { const u = clamp(s / len, 0, 1); curve.getPointAt(u, fp); curve.getTangentAt(u, ft); fr.crossVectors(ft, Y).normalize(); fu.crossVectors(fr, ft); };
  const at = (s, x, y, out) => { fr_(s); return out.copy(fp).addScaledVector(fr, x).addScaledVector(fu, y); };
  const hz = [], motes = [];
  for (let s = 80; s < len - 50; s += rand(15, 23)) {
    const a = rand(TAU), h = { s, x: Math.cos(a) * 2.2, y: Math.sin(a) * 2.2 }, g = new THREE.Group(); at(s, h.x, h.y, g.position);
    for (let k = 0; k < 4; k++) { const c = mesh(new THREE.OctahedronGeometry(rand(0.7, 1.2)), M(0xff7ab8, { emi: 0xff3a8a, ei: 1.4, flat: true }), rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6), false); c.scale.y = rand(1.3, 2.2); c.rotation.set(rand(3), rand(3), rand(3)); g.add(c); }
    g.add(glow(0xff5a9a, 7, 0.6)); lv.world.add(g); hz.push(h);
    const m = { s: s + 8, x: -h.x * 0.9, y: -h.y * 0.9, g: glow(0xffe28a, 1.6, 1) }; at(m.s, m.x, m.y, m.g.position); lv.world.add(m.g); motes.push(m);
  }
  for (let s = 10; s < len; s += 9) { const a = rand(TAU), g = glow(pick([0x7fc8ff, 0xb07aff, 0x7affd0]), rand(2, 4), 0.8); at(s, Math.cos(a) * 4.9, Math.sin(a) * 4.9, g.position); lv.world.add(g); }
  const mk = (ch, lean) => { const g = new THREE.Group(); ch.position.set(0, -0.5, 0); ch.rotation.set(lean, 0, 0); g.add(ch); lv.world.add(g); return g; };
  const pg = mk(P.char, -1.1); const pl = new THREE.PointLight(0xbfd8ff, 1.6, 34, 1.6); pg.add(pl);
  lv.cleanup = () => { scene.add(P.char); P.char.position.set(0, 0, 0); P.char.rotation.set(0, 0, 0); };
  const mg = mk(castChar('miro'), -1.1), zg = mk(castChar('pizel'), -0.4);
  let s = 6, ox = 0, oy = -1, sp = 0, got = 0, done = false; G.cine = { pos: new V3(), look: new V3() };
  const step = dt => {
    let sx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.x, sy = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + joy.y;
    if (locked || isTouch) { ox += mouse.dx * 0.012; oy -= mouse.dy * 0.012; } else if (Math.abs(mouse.nx) + Math.abs(mouse.ny) > 0.02 && !sx && !sy) { ox = damp(ox, mouse.nx * 4, 5, dt); oy = damp(oy, mouse.ny * 4, 5, dt); }
    ox += sx * 8 * dt; oy += sy * 8 * dt; const m = Math.hypot(ox, oy); if (m > 3.5) { ox *= 3.5 / m; oy *= 3.5 / m; }
    sp = damp(sp, done ? 0 : 27 + s / len * 9, 1.5, dt); s += sp * dt;
    at(s, ox, oy, pg.position); pg.lookAt(_v.copy(pg.position).add(ft)); pg.rotation.z += Math.sin(G.time * 3) * 0.1; P.pos.copy(pg.position);
    at(s - 7.5, ox * 0.5, oy * 0.5 + 1.3, G.cine.pos); at(s + 8, ox * 0.6, oy * 0.6, G.cine.look);
    at(s + 9, Math.sin(G.time * 1.3) * 2, Math.cos(G.time * 1.7) * 1.5 - 1, mg.position); mg.lookAt(_v.copy(mg.position).add(ft));
    at(s + 15, Math.cos(G.time) * 2.5, Math.sin(G.time * 1.4) * 2, zg.position); zg.lookAt(_v.copy(zg.position).add(ft)); zg.rotation.z = G.time * 4;
    emit(pg.position, 1, { color: 0x9fd8ff, speed: 1, life: 0.5, size: 0.15 });
    for (const h of hz) if (!h.hit && Math.abs(h.s - s) < 1.4 && Math.hypot(h.x - ox, h.y - oy) < 2.1) { h.hit = true; hurt(13, true); sfx('glass'); sp *= 0.5; }
    for (const mo of motes) if (!mo.got && Math.abs(mo.s - s) < 1.6 && Math.hypot(mo.x - ox, mo.y - oy) < 1.7) { mo.got = true; mo.g.visible = false; got++; sfx('ring'); G.hp = Math.min(100, G.hp + 3); }
    objective('별빛 통로', `수정 가시를 피해 내려가기 · 별빛 ${got}`);
  };
  step(0.016); lv.upd.push(step);
  $('fade').style.transitionDuration = '.5s'; $('fade').style.opacity = 0; toast('마우스 / WASD로 피하기!', 2.2);
  await wait(1.2); say('피젤 교수', '으아아아아— 이건 예정에 없었는데에에—!').then(() => {});
  await wait(2.2); closeDialog();
  await until(() => s > len - 30); done = true; flash(1, 1.2); sfx('boom'); await fade(1, 0.4);
} });

/* ===== 잠든 서고 (보스 전투장) ===== */
function buildArchive(lv) {
  const fl = solid(lv, mesh(new THREE.CircleGeometry(22.5, 48), M(0x7a7890, { map: tex('tile', 12, 12), rough: 0.5, metal: 0.2 }), 0, 0, 0)); fl.rotation.x = -Math.PI / 2;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 20, 48, 1, true), new THREE.MeshStandardMaterial({ map: tex('rock', 16, 3), side: THREE.BackSide, roughness: 0.95 })); wall.position.y = 10; solid(lv, wall);
  const ring = (r0, r1, c, y) => { const m = mesh(new THREE.RingGeometry(r0, r1, 64), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }), 0, y, 0, false); m.rotation.x = -Math.PI / 2; lv.world.add(m); return m; };
  ring(8, 8.25, 0x7a4cff, 0.03); ring(3, 3.12, 0x4cc8ff, 0.03); ring(15, 15.15, 0x4cc8ff, 0.03);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, m = mesh(new THREE.PlaneGeometry(0.12, 7), new THREE.MeshBasicMaterial({ color: 0x5a3cc8 }), Math.sin(a) * 11.5, 0.03, Math.cos(a) * 11.5, false); m.rotation.x = -Math.PI / 2; m.rotation.z = -a; lv.world.add(m); }
  lv.pillars = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + 0.52, x = Math.sin(a) * 11.5, z = Math.cos(a) * 11.5;
    const p = solid(lv, cyl(0.95, 1.1, 10, M(0x8a88a0, { map: tex('stone', 2, 4) }), x, 5, z, 12)); lv.world.add(cyl(1.25, 1.25, 0.5, M(0x6a6880), x, 0.25, z, 12));
    const band = mesh(new THREE.TorusGeometry(1.0, 0.06, 6, 20), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x7a4cff : 0x4cc8ff }), x, 3.2, z, false); band.rotation.x = Math.PI / 2; lv.world.add(band);
    const gl = glow(i % 2 ? 0x7a4cff : 0x4cc8ff, 5, 0.5); gl.position.set(x, 3.2, z); lv.world.add(gl);
    const c = { x, z, r: 1.1, h: 8 }; lv.colliders.push(c); lv.pillars.push(c);
  }
  const bk = M(0xffffff, { map: tex('books', 2, 1) });
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + 0.2, g = new THREE.Group(); g.position.set(Math.sin(a) * 20.6, 0, Math.cos(a) * 20.6); g.rotation.y = a + Math.PI; g.rotation.z = rand(-0.12, 0.12);
    g.add(box(4, rand(5, 9), 0.8, M(0x3a2618), 0, 3, 0)); const f = mesh(new THREE.PlaneGeometry(3.8, 4.4), bk, 0, 2.6, 0.42, false); g.add(f); lv.world.add(g); }
  for (let i = 0; i < 26; i++) { const b = box(0.5, 0.12, 0.7, M(pick([0x7a2b3a, 0x2b3a7a, 0x2f7a5a, 0xb98a2e])), rand(-18, 18), 0, rand(-18, 18)); b.rotation.set(rand(0.5), rand(3), rand(0.5)); b.add(glow(0xb0a0ff, 1, 0.4)); lv.world.add(b); lv.bob.push({ o: b, y: rand(4, 11), s: rand(9), a: 0.5, sp: rand(0.4, 0.9) }); }
  for (let i = 0; i < 22; i++) { const a = rand(TAU), r = rand(3, 21), c = cone(rand(0.4, 1), rand(2, 5), M(0x4a4e63, { flat: true }), Math.sin(a) * r, 18.5, Math.cos(a) * r, 6); c.rotation.x = Math.PI; c.castShadow = false; lv.world.add(c); }
  [[0x7a4cff, 0, 9, 0], [0x4cc8ff, 14, 5, 10], [0x4cc8ff, -14, 5, -10]].forEach(l => { const p = new THREE.PointLight(l[0], 1.4, 46, 1.5); p.position.set(l[1], l[2], l[3]); lv.world.add(p); });
  lv.bounds = { r: 20.3 }; lv.camR = 21.2;
  lv.upd.push(dt => { if (Math.random() < dt * 12) emit(new V3(rand(-18, 18), rand(0.2, 7), rand(-18, 18)), 1, { color: pick([0x7a4cff, 0x4cc8ff]), speed: 0.3, vy: 0.4, life: 2.4, size: 0.1, drag: 0.1 }); });
}
/* 선분이 기둥에 막히는 지점 (0~1) */
function segBlock(ax, az, bx, bz) {
  let best = 1; const dx = bx - ax, dz = bz - az, A = dx * dx + dz * dz; if (A < 1e-6) return 1;
  for (const c of L.pillars || []) { const fx = ax - c.x, fz = az - c.z, B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - c.r * c.r, D = B * B - 4 * A * C; if (D < 0) continue; const t = (-B - Math.sqrt(D)) / (2 * A); if (t > 0 && t < best) best = t; }
  return best;
}
const ARENA_ENV = { bg: 0x04030c, fog: 0x0a0820, fogD: 0.016, hemi: 0.6, skyC: 0x8a8aff, gndC: 0x2a1a4a, sunC: 0x9ab0ff, sunI: 0.55, sunP: [6, 30, 8], exp: 1.4 };

/* ===== 8장: 유리 수호자 (중간 보스) ===== */
LEVELS.push({ name: '유리 수호자', env: ARENA_ENV, async run(lv) {
  music('mystery'); buildArchive(lv);
  const cm = M(0xa8d0f0, { op: 0.9, metal: 0.5, rough: 0.08, emi: 0x24487a, ei: 0.7, flat: true, fresh: true });
  const gol = new THREE.Group(); gol.position.set(0, 0, -9); lv.world.add(gol);
  const legs = [-1, 1].map(s => { const l = box(0.9, 1.9, 1, cm, s * 0.75, 0.95, 0); gol.add(l); return l; });
  const torso = new THREE.Group(); torso.position.y = 3.15; gol.add(torso); torso.add(box(2.7, 2.5, 1.7, cm, 0, 0, 0));
  [-1, 1].forEach(s => { const o = mesh(new THREE.OctahedronGeometry(0.8), cm, s * 1.6, 1.3, 0); o.scale.y = 1.5; torso.add(o); });
  const coreM = new THREE.MeshBasicMaterial({ color: 0xff4fd8 }), core = mesh(new THREE.SphereGeometry(0.55, 14, 10), coreM, 0, 0.1, 0.9, false); torso.add(core); const coreG = glow(0xff4fd8, 4, 0.9); core.add(coreG);
  const head = mesh(new THREE.OctahedronGeometry(0.8), cm, 0, 1.9, 0); torso.add(head); const eye = mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff5a8a }), 0, 0, 0.62, false); head.add(eye); const eyeG = glow(0xff5a8a, 1.5, 0.8); eye.add(eyeG);
  const arms = [-1, 1].map(s => { const a = new THREE.Group(); a.position.set(s * 1.85, 0.9, 0); a.add(box(0.75, 2.6, 0.85, cm, 0, -1.3, 0)); const f = mesh(new THREE.OctahedronGeometry(0.7), cm, 0, -2.9, 0); a.add(f); torso.add(a); return a; });
  const MAX = 560; let hp = MAX, inv = true, dead = false, p2 = false, moving = false, flashT = 0, beamOn = false, beamT = 0, armUp = [0, 0], staffReady = false;
  const bodyT = { pos: new V3(), r: 1.9, hit(d, pt, dt, pj) { dmg(d * (pj ? 0.5 : 0.3), pt, false); } }, coreT = { pos: new V3(), r: 0.75, hit(d, pt) { dmg(d, pt, true); } };
  lv.targets.push(coreT, bodyT); const gcol = { x: 0, z: -9, r: 1.9 }; lv.colliders.push(gcol);
  function dmg(d, pt, crit) { if (inv || dead) return; hp -= d; if (hp <= 0) dead = true; flashT = 0.08; if (crit && Math.random() < 0.5) emit(pt, 2, { color: 0xff9fe8, speed: 6, life: 0.5, grav: 6 }); bossBar('유리 수호자', hp / MAX); }
  const GB = makeBeam(lv.world, 0xff5a8a), bt = new V3(), headW = new V3(), waves = [];
  const miro = addNPC(lv, 'miro', 3, 15, Math.PI), piz = addNPC(lv, 'pizel', -3, 16, Math.PI); miro.look = false; let miroT = 3;
  lv.upd.push(dt => {
    if (dead) return; flashT -= dt; cm.emissive.setHex(flashT > 0 ? 0xffffff : p2 ? 0x6a2a7a : 0x24487a);
    const dx = P.pos.x - gol.position.x, dz = P.pos.z - gol.position.z, d = Math.hypot(dx, dz);
    gol.rotation.y += angDiff(gol.rotation.y, Math.atan2(dx, dz)) * Math.min(1, (p2 ? 2.2 : 1.5) * dt);
    if (moving && d > 5.5 && !G.cine) { const sp = p2 ? 2.4 : 1.7; gol.position.x += Math.sin(gol.rotation.y) * sp * dt; gol.position.z += Math.cos(gol.rotation.y) * sp * dt; const w = Math.sin(G.time * 5); legs[0].position.z = w * 0.5; legs[1].position.z = -w * 0.5; torso.position.y = 3.15 + Math.abs(w) * 0.1; if (Math.abs(w) > 0.97) G.shake = Math.max(G.shake, 0.04); }
    gcol.x = gol.position.x; gcol.z = gol.position.z; core.getWorldPosition(coreT.pos); bodyT.pos.copy(gol.position).y = 3.1; coreG.scale.setScalar(4 + Math.sin(G.time * 6) * 0.6);
    arms.forEach((a, i) => { a.rotation.x = damp(a.rotation.x, -armUp[i] * 2.6 + Math.sin(G.time * 1.5 + i * 3) * 0.08, 8, dt); });
    if (d < 2.6 && !G.cine) { hurt(10); P.pos.x += dx / d * 0.5; P.pos.z += dz / d * 0.5; }
    for (let i = waves.length - 1; i >= 0; i--) { const w = waves[i]; w.R += 15 * dt; w.m.scale.setScalar(w.R); w.m.material.opacity = clamp(1.2 - w.R / 24, 0, 1);
      for (let k = 0; k < 4; k++) { const a = rand(TAU); emit(_v.set(w.x + Math.sin(a) * w.R, 0.2, w.z + Math.cos(a) * w.R), 1, { color: 0xff9fe8, speed: 1, vy: 2, life: 0.4, size: 0.18 }); }
      const pd = Math.hypot(P.pos.x - w.x, P.pos.z - w.z); if (!w.hit && Math.abs(pd - w.R) < 0.9 && P.pos.y < 0.7) { w.hit = true; hurt(16); }
      if (w.R > 24) { lv.world.remove(w.m); waves.splice(i, 1); } }
    if (beamOn) {
      beamT += dt; head.getWorldPosition(headW); _v.set(P.pos.x - bt.x, 0, P.pos.z - bt.z); const l = _v.length(), sp = p2 ? 5.9 : 5; if (l > 0.05) bt.addScaledVector(_v, Math.min(l, sp * dt) / l);
      const t = segBlock(headW.x, headW.z, bt.x, bt.z); _v2.set(lerp(headW.x, bt.x, t), lerp(headW.y, 0.15, t), lerp(headW.z, bt.z, t)); GB.set(headW, _v2, 1.5);
      emit(_v2, 3, { color: 0xff8fb0, speed: 4, life: 0.4, grav: 5 }); beamSound(true, 0.6);
      if (t >= 1 && Math.hypot(P.pos.x - bt.x, P.pos.z - bt.z) < 1.15 && P.pos.y < 1.5) { if (P.shield) { G.mp = Math.max(0, G.mp - 34 * dt); emit(_v.copy(P.pos).setY(1.2), 2, { color: 0xbfeaff, speed: 4, life: 0.3 }); } else hurt(14); }
    }
    miroT -= dt; if (!inv && miroT <= 0 && !G.cine) { miroT = rand(2.6, 3.8); miro.casting = true; miro.char.rotation.y = Math.atan2(gol.position.x - miro.char.position.x, gol.position.z - miro.char.position.z); const s = miro.char.position.clone().setY(1.4); shoot(s, coreT.pos.clone().sub(s).normalize().multiplyScalar(16), { owner: 'player', dmg: 9, color: 0x6affc0 }); sfx('shoot'); setTimeout(() => { miro.casting = false; }, 400); }
  });
  P.pos.set(0, 0, 16); P.face = P.yaw = Math.PI; G.ctl = false; G.cine = { pos: new V3(0, 12, 20), look: new V3(0, 3, -9) };
  await fade(0); await card('제8장', '잠든 서고'); await camTo(0, 3, 4, 0, 3.4, -9, 2.5);
  sfx('roar'); G.shake = 0.5; armUp = [1, 1]; await wait(0.8); armUp = [0, 0]; sfx('boom'); G.shake = 0.6; music('battle');
  await talk([['피젤 교수', '저, 저건 서고의 유리 수호자! 나는… 지원군을 부르러 가겠네!'], ['미로', '교수님?! …됐어, 루카. 가슴의 붉은 핵을 노려! 내가 뒤에서 도울게!']]);
  walkTo(piz, 0, 19.5, 7).then(() => { piz.char.visible = false; piz.col.off = true; });
  cineOff(); G.ctl = true; inv = false; moving = true; bossBar('유리 수호자', 1);
  objective('유리 수호자', '붉은 핵에 광선 · 파편은 방패로 되받아치기 · 충격파는 점프');
  const volley = async () => { armUp = [0, 1]; await wait(0.7); const n = p2 ? 8 : 5; for (let i = 0; i < n && !dead; i++) { const s = coreT.pos.clone(); s.y += 1.2; const dir = _v.copy(P.pos).setY(1.1).sub(s).normalize(); dir.x += rand(-0.1, 0.1); dir.z += rand(-0.1, 0.1); shoot(s, dir.multiplyScalar(p2 ? 15 : 13), { dmg: 10, color: 0x9fe0ff, geo: new THREE.OctahedronGeometry(0.22), src: coreT }); sfx('shoot'); await wait(0.22); } armUp = [0, 0]; };
  const slam = async () => { moving = false; armUp = [1, 1]; sfx('roar'); await wait(1); armUp = [0, 0]; await wait(0.18); if (dead) return; sfx('boom'); G.shake = 0.5;
    const mk = () => { const m = mesh(new THREE.TorusGeometry(1, 0.035, 6, 48), new THREE.MeshBasicMaterial({ color: 0xff9fe8, transparent: true }), gol.position.x, 0.25, gol.position.z, false); m.rotation.x = Math.PI / 2; lv.world.add(m); waves.push({ m, R: 2, x: gol.position.x, z: gol.position.z, hit: false }); };
    mk(); if (p2) { await wait(0.7); if (!dead) { sfx('boom'); mk(); } } await wait(0.5); moving = true; };
  const sweep = async () => { moving = false; sfx('roar'); for (let i = 0; i < 20; i++) { head.getWorldPosition(headW); emit(headW, 3, { color: 0xff5a8a, speed: 3, life: 0.3 }); await wait(0.05); } if (dead) return; bt.copy(gol.position).addScaledVector(_v.set(Math.sin(gol.rotation.y), 0, Math.cos(gol.rotation.y)), 4); beamT = 0; beamOn = true; await until(() => beamT > (p2 ? 4 : 3.2) || dead); beamOn = false; GB.off(); beamSound(false); moving = true; };
  const order = [volley, slam, volley, sweep]; let ai = 0;
  while (!dead) {
    await wait(p2 ? 1.2 : 1.9); if (hp <= 0) break;
    if (!p2 && hp <= MAX * 0.5) { // 별 수정 등장
      p2 = true; inv = true; moving = false; G.ctl = false; PB.off(); sfx('roar'); G.shake = 0.6; armUp = [1, 1];
      await camTo(gol.position.x, 3, gol.position.z + 9, gol.position.x, 3.5, gol.position.z, 1); await say('', '수호자의 핵이 검붉게 달아오른다!'); armUp = [0, 0];
      const star = mesh(new THREE.OctahedronGeometry(0.5), M(0xfff0b0, { emi: 0xffd060, ei: 2.5, flat: true }), 0, 19, 0, false); star.add(glow(0xffd76a, 6, 0.9)); lv.world.add(star); lv.upd.push(dt => { star.rotation.y += dt * 2; });
      await Promise.all([camTo(4, 3, 6, 0, 4, 0, 1.2), tween(2.2, k => { star.position.y = lerp(19, 1.3, k); emit(star.position, 2, { color: 0xffd76a, speed: 1, life: 0.8 }); })]); sfx('chime');
      await say('오르벨 교장', '(멀리서 울리는 목소리) 분수의 별 수정을 보낸다, 루카. 별빛이 너와 함께한다!');
      cineOff(); G.ctl = true; inv = false; moving = true; objective('별 수정 줍기', '중앙의 별 수정에 다가가 E');
      addInteract(lv, star.position, 2.6, '별 수정 잡기', async () => { lv.world.remove(star); G.staff = true; G.beamPow = 1.8; PB.setColor(0xffd76a); G.hp = 100; G.mp = 100; flash(0.6, 0.8); sfx('chime'); toast('별빛 광선! 위력이 강해졌다!', 2.2); emit(P.pos.clone().setY(1), 60, { color: 0xffd76a, speed: 6, life: 1 }); objective('유리 수호자', '강해진 별빛 광선으로 핵을 부숴라!'); staffReady = true; }, true);
      spawnBlob(lv, 12, 0); spawnBlob(lv, -12, 0); continue;
    }
    await order[ai++ % order.length]();
  }
  dead = true; beamOn = false; GB.off(); beamSound(false); G.ctl = false; PB.off(); bossBar(null); objective(''); lv.projs.forEach(p => killProj(p)); (lv.enemies || []).forEach(e => { if (!e.off) e.hit(999, e.pos); });
  await camTo(gol.position.x + 5, 3, gol.position.z + 8, gol.position.x, 3, gol.position.z, 0.8);
  for (let i = 0; i < 6; i++) { sfx('glass'); emit(_v.copy(gol.position).setY(rand(1, 5)), 40, { color: 0xbfe8ff, speed: 7, life: 0.9, grav: 6, size: 0.2 }); G.shake = 0.3; await wait(0.22); }
  flash(0.9, 1); sfx('boom'); lv.world.remove(gol); gcol.off = true; coreT.off = bodyT.off = true; emit(_v.copy(gol.position).setY(3), 200, { color: 0xbfe8ff, speed: 12, life: 1.6, grav: 8, size: 0.25 }); music('mystery');
  await wait(1.4); await talk([['미로', '해냈다! …어? 루카, 네 주머니가 빛나!'], ['에코', '잘했어, 루카. 마지막 자물쇠까지 부숴 줬구나.']]);
  await fade(1);
} });

/* ===== 9장: 거울의 주인 (최종 보스) ===== */
LEVELS.push({ name: '거울의 주인', env: ARENA_ENV, async run(lv) {
  music('mystery'); buildArchive(lv);
  // 거대한 거울
  const mir = new THREE.Group(); mir.position.set(0, 0, -19); lv.world.add(mir);
  mir.add(box(7, 10, 0.5, M(0xb98a2e, { metal: 0.85, rough: 0.3 }), 0, 5.4, 0)); mir.add(box(8, 0.8, 1.6, M(0x3a2618), 0, 0.4, 0));
  const gm = new THREE.MeshBasicMaterial({ color: 0x2a1650 }); mir.add(mesh(new THREE.PlaneGeometry(6, 9), gm, 0, 5.4, 0.27, false)); const mgl = glow(0x9a5cff, 16, 0.5); mgl.position.set(0, 5.4, 1); mir.add(mgl);
  const shard = mesh(new THREE.OctahedronGeometry(0.45), M(0xd8c8ff, { emi: 0x9a5cff, ei: 2.2, flat: true, metal: 0.6, rough: 0.1, fresh: true }), 0, 1.4, 14, false); shard.scale.y = 1.8; lv.world.add(shard); const shG = glow(0xb07aff, 4, 0.9); shard.add(shG);
  const miro = addNPC(lv, 'miro', 4, 16.5, Math.PI); miro.look = false;
  const nox = castChar('nox'); nox.position.set(0, 0, -16); nox.visible = false; lv.world.add(nox); const nu = nox.userData;
  const MAX = 640; let hp = MAX, inv = true, dead = false, p2 = false, stun = 0, flashT = 0, mode = 'strafe', dir = 1, casting = false, tookClone = 0;
  const noxT = { pos: new V3(), r: 0.85, off: true, hit(d, pt) { if (inv || dead) return; d *= stun > 0 ? 1.6 : 1; hp -= d; tookClone += d; flashT = 0.08; if (Math.random() < 0.4) emit(pt, 2, { color: 0xff7ab0, speed: 5, life: 0.4 }); bossBar('거울의 주인 녹스', hp / MAX); } };
  lv.targets.push(noxT);
  const NB = makeBeam(lv.world, 0xff3a6a), bt = new V3(), ntip = new V3(); let beamOn = false, beamT = 0;
  const puff = () => { emit(_v.copy(nox.position).setY(1.2), 40, { color: 0x9a3cff, speed: 5, life: 0.6, size: 0.2 }); sfx('whoosh'); };
  const tele = (x, z) => { puff(); const d = Math.hypot(x, z); if (d > 18) { x *= 18 / d; z *= 18 / d; } nox.position.set(x, 0, z); puff(); };
  const teleRand = () => { let x, z, k = 0; do { const a = rand(TAU), r = rand(7, 16); x = Math.sin(a) * r; z = Math.cos(a) * r; } while (Math.hypot(x - P.pos.x, z - P.pos.z) < 8 && k++ < 20); tele(x, z); };
  lv.upd.push(dt => {
    if (!nox.visible) return; flashT -= dt; stun -= dt;
    const dx = P.pos.x - nox.position.x, dz = P.pos.z - nox.position.z, d = Math.hypot(dx, dz) || 1, ang = Math.atan2(dx, dz);
    nox.rotation.y += angDiff(nox.rotation.y, ang) * Math.min(1, 8 * dt);
    let spd = 0;
    if (!dead && stun <= 0 && mode === 'strafe' && !G.cine) { spd = p2 ? 4.4 : 3.4; const tx = -dz / d * dir, tz = dx / d * dir, rad = d < 8 ? -0.6 : d > 14 ? 0.6 : 0; nox.position.x += (tx + dx / d * rad) * spd * dt; nox.position.z += (tz + dz / d * rad) * spd * dt; const r = Math.hypot(nox.position.x, nox.position.z); if (r > 18) { nox.position.x *= 18 / r; nox.position.z *= 18 / r; dir = -dir; } if (Math.random() < dt * 0.25) dir = -dir; collide(nox.position, 0.5); }
    nox.position.y = dead ? 0 : stun > 0 ? 0 : 0.25 + Math.sin(G.time * 2.5) * 0.12; nu.body.rotation.z = stun > 0 ? 0.35 : 0;
    animChar(nox, dt, spd * 0.4, casting || beamOn, Math.atan2(1 - 1.4, d) * 0); if (stun > 0) nu.body.rotation.x = 0.5;
    noxT.pos.copy(nox.position).y += 1.1; nox.updateMatrixWorld(true); nu.tip.getWorldPosition(ntip);
    nox.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(flashT > 0 ? 0x884466 : 0); });
    if (Math.random() < dt * 14) emit(_v.copy(nox.position).setY(rand(0.1, 0.6)), 1, { color: 0x7a2cff, speed: 0.4, life: 0.6, size: 0.16 });
    if (stun > 0 && Math.random() < dt * 20) emit(_v.copy(nox.position).setY(2.2), 1, { color: 0xffe28a, speed: 1, life: 0.5 });
    if (beamOn) {
      const cl = G.clash; beamSound(true, 0.7);
      if (!cl) {
        beamT += dt; _v.set(P.pos.x - bt.x, 0, P.pos.z - bt.z); const l = _v.length(), sp = p2 ? 5.9 : 5.1; if (l > 0.05) bt.addScaledVector(_v, Math.min(l, sp * dt) / l);
        const t = segBlock(ntip.x, ntip.z, bt.x, bt.z); _v2.set(lerp(ntip.x, bt.x, t), lerp(ntip.y, 1.0, t), lerp(ntip.z, bt.z, t)); NB.set(ntip, _v2, 1.4); emit(_v2, 3, { color: 0xff7a9a, speed: 4, life: 0.4, grav: 5 });
        if (t >= 1 && Math.hypot(P.pos.x - bt.x, P.pos.z - bt.z) < 1.1) { if (P.shield) { G.mp = Math.max(0, G.mp - 36 * dt); emit(_v.copy(P.pos).setY(1.2), 2, { color: 0xbfeaff, speed: 4, life: 0.3 }); } else hurt(14); }
        if (P.firing && P.hitT === noxT && segBlock(P.pos.x, P.pos.z, nox.position.x, nox.position.z) >= 1) { G.clash = { c: 0.5, pt: new V3().lerpVectors(P.tip, ntip, 0.5) }; $('clash').hidden = false; sfx('parry'); toast('광선 대결!', 1); }
        if (beamT > 4.4) { beamOn = false; NB.off(); beamSound(false); }
      } else {
        if (pressed.Space || mouse.lp || pressed.T_fire || pressed.Tap || pressed.KeyF || pressed.KeyE) { cl.c += 0.062; sfx('pop'); }
        cl.c -= (p2 ? 0.31 : 0.25) * dt; cl.pt.lerpVectors(P.tip, ntip, clamp(cl.c, 0.05, 0.97)); NB.set(ntip, cl.pt, 1.7); G.shake = Math.max(G.shake, 0.07);
        emit(cl.pt, 6, { color: Math.random() < 0.5 ? 0xffd76a : 0xff3a6a, speed: 9, life: 0.5, grav: 4, size: 0.18 }); $('clashb').style.transform = `scaleX(${clamp(cl.c, 0, 1)})`;
        const end = () => { G.clash = null; beamOn = false; NB.off(); beamSound(false); $('clash').hidden = true; flash(0.6, 0.5); sfx('boom'); G.shake = 0.6; };
        if (cl.c >= 1) { end(); emit(noxT.pos, 120, { color: 0xffd76a, speed: 12, life: 1 }); inv = false; noxT.hit(110, noxT.pos); stun = 3.4; toast('밀어냈다! 지금 공격!', 1.6); }
        else if (cl.c <= 0) { end(); emit(_v.copy(P.pos).setY(1), 80, { color: 0xff3a6a, speed: 10, life: 0.8 }); hurt(26, true); }
      }
    }
  });
  P.pos.set(0, 0, 17); P.face = P.yaw = Math.PI; G.ctl = false; G.cine = { pos: new V3(2, 2.2, 18), look: new V3(0, 1.4, 14) };
  await fade(0); await card('제9장', '거울의 주인');
  await Promise.all([camTo(6, 5, 2, 0, 5, -19, 3), tween(3, k => { shard.position.set(0, 1.4 + Math.sin(k * 3.14) * 3 + k * 4, lerp(14, -18.4, k)); shard.rotation.y += 0.2; emit(shard.position, 1, { color: 0xb07aff, speed: 0.5, life: 0.8 }); })]);
  sfx('glass'); flash(0.7, 1); G.shake = 0.5; gm.color.set(0x7a3cd0); nox.visible = true; puff(); sfx('roar');
  await tween(1.2, k => { nox.position.z = lerp(-18.4, -13, k); }); await camTo(1.5, 2, -8.5, 0, 1.6, -13, 1.2);
  await talk([['녹스', '오십 년 만의 몸이군. 고맙다, 루카. 조각을 여기까지 날라 줘서.'], ['녹스', G.trust ? '날 믿어 준 건 너뿐이었지. 그래서 더 쉬웠어.' : '날 의심했으면서도 결국 왔구나. 호기심은 늘 내 편이지.'], ['녹스', '에코는 지어낸 이름이야. 나는 녹스. 세라의 빛은 맛있었지. 이제 네 빛을 다오!']]);
  say('미로', '잉크 그림자는 내가 막을게! 루카, 넌 녹스를!').then(() => {}); await wait(2); closeDialog(); miro.casting = true; miro.char.rotation.y = 0.4;
  music('battle'); cineOff(); G.ctl = true; inv = false; noxT.off = false; bossBar('거울의 주인 녹스', 1);
  objective('녹스와의 결투', '방패로 되받아치기 · 녹스의 광선엔 광선으로 맞서 연타!');
  const bolts = async () => { casting = true; await wait(0.45); const n = p2 ? 5 : 3; for (let w = 0; w < (p2 ? 2 : 1) && !dead; w++) { const base = Math.atan2(P.pos.x - ntip.x, P.pos.z - ntip.z); for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.16; shoot(ntip.clone(), new V3(Math.sin(a) * 14, (1.1 - ntip.y) / (Math.hypot(P.pos.x - ntip.x, P.pos.z - ntip.z) / 14 + 0.01), Math.cos(a) * 14), { dmg: 10, color: 0xff3a6a, src: noxT }); } sfx('shoot'); await wait(0.55); } casting = false; };
  const orbs = async () => { casting = true; await wait(0.5); for (let i = 0; i < (p2 ? 3 : 2) && !dead; i++) { shoot(ntip.clone().setY(2.4), new V3(rand(-3, 3), 3, rand(-3, 3)), { dmg: 12, color: 0xb04cff, r: 0.32, homing: 1.7, life: 6.5, src: noxT }); sfx('shoot'); await wait(0.4); } casting = false; };
  const clash = async () => { mode = 'still'; casting = true; toast('녹스가 광선을 모은다 — 광선으로 맞서라!', 2); sfx('roar'); for (let i = 0; i < 22; i++) { emit(ntip, 3, { color: 0xff3a6a, speed: 3, life: 0.3 }); await wait(0.05); } if (dead) return; bt.copy(nox.position).addScaledVector(_v.set(Math.sin(nox.rotation.y), 0, Math.cos(nox.rotation.y)), 3); beamT = 0; beamOn = true; await until(() => !beamOn || dead); casting = false; mode = 'strafe'; };
  const clones = async () => {
    mode = 'still'; const a0 = rand(TAU), R = 9, cs = []; tele(P.pos.x + Math.sin(a0) * R, P.pos.z + Math.cos(a0) * R); tookClone = 0; nu.tipGlow.scale.setScalar(0.5); toast('진짜를 찾아라!', 1.4);
    for (let i = 1; i < (p2 ? 5 : 4); i++) { const a = a0 + i * TAU / (p2 ? 5 : 4); let x = P.pos.x + Math.sin(a) * R, z = P.pos.z + Math.cos(a) * R; const d = Math.hypot(x, z); if (d > 18) { x *= 18 / d; z *= 18 / d; }
      const c = castChar('nox'); c.position.set(x, 0.25, z); c.traverse(o => { if (o.isMesh) o.material = M(0x3a1a6a, { op: 0.75, emi: 0x2a0a4a, ei: 1 }); }); c.userData.tipGlow.scale.setScalar(0.12); lv.world.add(c); emit(c.position, 20, { color: 0x9a3cff, speed: 4 });
      const t = { pos: new V3(x, 1.3, z), r: 0.85, c, hit() { if (t.off) return; t.off = true; lv.world.remove(c); emit(t.pos, 30, { color: 0x9a3cff, speed: 5 }); sfx('pop'); } }; lv.targets.push(t); cs.push(t); }
    const fx = dt => cs.forEach(t => { if (!t.off) { t.c.rotation.y = Math.atan2(P.pos.x - t.c.position.x, P.pos.z - t.c.position.z); animChar(t.c, dt, 0, true, 0); } }); lv.upd.push(fx); casting = true;
    await until(((t0) => () => G.time - t0 > 2 || tookClone > 16 || dead)(G.time));
    if (tookClone > 16) { stun = 2.4; toast('간파했다!', 1.2); sfx('good'); cs.forEach(t => t.hit()); }
    else { cs.forEach(t => { if (!t.off) { const s = t.pos.clone(); shoot(s, _v.copy(P.pos).setY(1.1).sub(s).normalize().multiplyScalar(13).clone(), { dmg: 9, color: 0xb04cff }); } }); const s = ntip.clone(); shoot(s, _v.copy(P.pos).setY(1.1).sub(s).normalize().multiplyScalar(14).clone(), { dmg: 11, color: 0xff3a6a, src: noxT }); sfx('shoot'); await wait(0.7); cs.forEach(t => t.hit()); }
    lv.upd.splice(lv.upd.indexOf(fx), 1); nu.tipGlow.scale.setScalar(0.18); casting = false; mode = 'strafe';
  };
  const order = [bolts, orbs, clash, clones, bolts, clash]; let ai = 0;
  while (hp > 0) {
    await wait(p2 ? 1.0 : 1.6); await until(() => stun <= 0 || hp <= 0); if (hp <= 0) break;
    if (!p2 && hp <= MAX * 0.5) { p2 = true; sfx('roar'); G.shake = 0.5; flash(0.4, 0.6); toast('녹스의 그림자가 짙어진다!', 1.8); scene.fog.color.set(0x1a0620); teleRand(); spawnBlob(lv, 10, 6); spawnBlob(lv, -10, 6); }
    if (Math.random() < 0.35) teleRand();
    await order[ai++ % order.length]();
  }
  // 조각 부수기
  dead = true; inv = true; beamOn = false; NB.off(); beamSound(false); G.clash = null; $('clash').hidden = true; bossBar(null); lv.projs.forEach(p => killProj(p)); (lv.enemies || []).forEach(e => { if (!e.off) e.hit(999, e.pos); });
  noxT.off = true; nox.position.y = 0; nu.body.rotation.x = 0.6; sfx('roar'); G.shake = 0.4; music('mystery');
  G.ctl = false; PB.off(); await camTo(P.pos.x, 2.4, P.pos.z, 0, 5, -19, 1.2);
  shard.position.set(0, 4.5, -17.6); await say('녹스', '크윽…! 소용없어. 조각이 남아 있는 한 나는 몇 번이고 돌아온다…!');
  cineOff(); G.ctl = true; let sh = 100; const shT = { pos: shard.position, r: 1.1, hit(d, pt) { sh -= d * 0.45; shard.scale.setScalar(1 + rand(0.15)); shard.scale.y = 1.8; emit(pt, 3, { color: 0xffffff, speed: 7, life: 0.5, grav: 5 }); G.shake = Math.max(G.shake, 0.05); bossBar('거울 조각', sh / 100); } };
  lv.targets.push(shT); bossBar('거울 조각', 1); objective('거울 조각 부수기', '거울 앞에 떠 있는 조각에 별빛 광선을 쏟아부어라!');
  lv.upd.push(dt => { shard.rotation.y += dt * (2 + (100 - sh) * 0.15); });
  await until(() => sh <= 0);
  G.ctl = false; PB.off(); objective(''); bossBar(null); shT.off = true; sfx('glass'); sfx('boom'); flash(1, 2.2); G.shake = 0.8; lv.world.remove(shard); gm.color.set(0x0a0612); mgl.visible = false;
  emit(new V3(0, 4.5, -17.6), 300, { color: 0xd8c8ff, speed: 14, life: 1.8, grav: 6, size: 0.25 });
  await camTo(nox.position.x + 2, 1.6, nox.position.z + 4, nox.position.x, 1.2, nox.position.z, 1.2);
  await say('녹스', '나는… 그저… 잊히고 싶지… 않았을 뿐인데…');
  await tween(1.8, k => { nox.scale.setScalar(1.1 * (1 - k * 0.9)); emit(_v.copy(nox.position).setY(1.2), 4, { color: 0x9a3cff, speed: 3, vy: 3, life: 1 }); }); nox.visible = false; sfx('chime'); music('calm');
  await say('미로', '끝났어…! 가자, 루카. 세라가 기다려!');
  await fade(1, 1.2);
} });

/* ===== 10장: 새벽 (결말) ===== */
LEVELS.push({ name: '새벽의 안뜰', env: { bg: 0x4a6ac8, fog: 0xffc8a0, fogD: 0.008, hemi: 1.0, skyC: 0xfff0e0, gndC: 0x6a6a5a, sunC: 0xffd8a0, sunI: 1.3, sunP: [22, 20, -8], exp: 1.15 }, async run(lv) {
  music('calm'); buildCourt(lv, 'dawn');
  let st = castChar('sera'); st.position.set(-3.5, 0, 6.5); st.rotation.y = 2.6; st.userData.armR.rotation.x = -1.3; const cmat = crystalize(st); lv.world.add(st); const scol = { x: -3.5, z: 6.5, r: 0.6 }; lv.colliders.push(scol);
  const orb = addNPC(lv, 'orbel', -6, 8.5, 2.3, async () => { await say('오르벨 교장', '녹스는 오래전 이 학교의 학생이었단다. 잊히는 게 두려워 거울에 자신을 가뒀지. 너는 다른 길을 택했구나.'); });
  const piz = addNPC(lv, 'pizel', -1, 9.5, 2.9, async () => { await say('피젤 교수', '지원군을 데려오는 중이었네! 정말이야! …다음 수업은 자습일세.'); });
  const miro = addNPC(lv, 'miro', -5.5, 4.5, 1.4, async () => { await say('미로', '푸딩은 셋이서 나눠 먹자. 아니, 퐁까지 넷!'); });
  P.pos.set(2, 0, 12); P.face = P.yaw = Math.PI + 0.6; G.ctl = false; G.cine = { pos: new V3(30, 20, 40), look: new V3(0, 12, -27) };
  await fade(0, 1.5); await Promise.all([card('마지막 장', '새벽의 안뜰'), camTo(1, 2.4, 12, -3.5, 1.4, 6.5, 4)]);
  await say('오르벨 교장', '저주의 뿌리는 사라졌다. 루카, 네 별빛으로 세라를 깨워 주렴.');
  cineOff(); G.ctl = true; objective('세라 깨우기', '유리가 된 세라에게 별빛 광선 비추기');
  let melt = 0; const sT = { pos: new V3(-3.5, 1.2, 6.5), r: 0.9, hit(d, pt, dt) { melt += (dt || 0.05); cmat.emissiveIntensity = 0.7 + melt * 1.5; emit(pt, 2, { color: 0xfff0b0, speed: 3, life: 0.6 }); } }; lv.targets.push(sT);
  await until(() => melt > 1.8);
  sT.off = true; G.ctl = false; PB.off(); objective(''); sfx('glass'); flash(0.8, 1.2); emit(new V3(-3.5, 1.2, 6.5), 150, { color: 0xbfe8ff, speed: 8, life: 1.2, grav: 5, size: 0.2 });
  lv.world.remove(st); scol.off = true; const sera = addNPC(lv, 'sera', -3.5, 6.5, 2.6, async () => { await say('세라', '유리 속에서도 다 들렸어. 너희가 나를 부르는 소리.'); }); sfx('chime');
  await camTo(-1, 1.9, 9.5, -3.5, 1.4, 6.5, 1);
  await talk([['세라', '…루카? 미로? 나, 아주 긴 꿈을 꾼 것 같아.'], ['미로', '세라! 진짜 걱정했잖아!'], ['세라', '고마워. 그 이름, 내가 찾아낸 대로였지? "녹스". 역시 기록은 거짓말을 안 해.']]);
  // 퐁 등장
  const pong = makePong(); pong.position.set(P.pos.x + 0.8, 0.4, P.pos.z - 0.8); pong.scale.setScalar(0.2); lv.world.add(pong); lv.upd.push(dt => animPong(pong, dt)); sfx('pop'); emit(pong.position, 30, { color: 0xbfc8ff, speed: 3 });
  await Promise.all([tween(0.8, k => { pong.scale.setScalar(0.2 + k * 0.8); pong.position.y = 0.4 + k * 1.1; }), camTo(P.pos.x - 1.5, 2, P.pos.z + 2.5, pong.position.x, 1.5, pong.position.z, 0.8)]);
  await talk([['퐁', '푸하! 트렁크 안은 너무 답답했어! 근데… 나 여기 계속 있으면 안 돼?'], ['오르벨 교장', '호오, 다락방 정령이로구나. 아스트라에는 먼지 쌓인 다락이 아주 많단다.']]);
  cineOff(); G.ctl = true; objective('퐁에게 선물하기', '퐁에게 다가가 E로 별 수정 조각 달아 주기');
  let gave = false; addInteract(lv, pong.position, 2.6, '퐁에게 별 수정 조각 달아 주기', async () => { gave = true; }, true);
  await until(() => gave);
  G.ctl = false; objective(''); sfx('chime'); pong.userData.star.material = M(0xfff0b0, { emi: 0xffd060, ei: 3 }); pong.userData.star.scale.setScalar(2); pong.add(glow(0xffd76a, 3, 0.6)); emit(pong.position, 60, { color: 0xffd76a, speed: 5, life: 1 });
  await camTo(pong.position.x + 1.6, 1.8, pong.position.z + 2.2, pong.position.x, 1.5, pong.position.z, 0.8);
  await talk([['퐁', '우와아! 반짝반짝! 이제 나는 아스트라의 다락지기 퐁이다!'], ['퐁', '퐁은 자유! 퐁은 어디든 간다! 고마워, 루카!']]);
  const boomAt = p => { const c = pick([0xffd76a, 0xff8fb0, 0x8fd0ff, 0x9fffb0, 0xc79fff]); emit(p, 90, { color: c, speed: 11, life: 1.6, grav: 3, size: 0.3, drag: 1.2 }); sfx('pop'); };
  let fw = 0; lv.upd.push(dt => { fw -= dt; if (fw <= 0) { fw = rand(0.3, 0.9); boomAt(new V3(rand(-30, 30), rand(18, 34), rand(-30, -5))); } pong.position.x += Math.sin(G.time * 0.8) * dt * 1.5; pong.position.z += Math.cos(G.time * 0.6) * dt * 1.5; pong.position.y = 2 + Math.sin(G.time * 1.4) * 0.6;
    if (P.firing && P.aim.y > 7 && Math.random() < dt * 5) boomAt(P.aim.clone()); });
  await camTo(0, 3, 22, 0, 14, -27, 3.5);
  $('cardh').textContent = '끝'; $('cardp').textContent = '아스트라 마법학교 · 거울 조각의 속삭임'; $('card').style.opacity = 1; await wait(4.5); $('card').style.opacity = 0; await wait(0.8);
  cineOff(); G.ctl = true; try { localStorage.setItem('astra_ch', '0'); } catch (e) {}
  objective('자유 시간', '하늘에 광선을 쏘면 불꽃이 터져요 · 성문에서 E로 처음 화면');
  let back = false; addInteract(lv, new V3(0, 0, -23), 3, '처음 화면으로', async () => { back = true; });
  await until(() => back); await fade(1); G.running = false; $('title').hidden = false; $('bars').hidden = true; objective(''); $('cross').hidden = true; $('prompt').hidden = true; $('help').hidden = true; if (document.exitPointerLock) document.exitPointerLock();
  music('calm'); $('fade').style.opacity = 0.35; await new Promise(() => {});
} });
boot();

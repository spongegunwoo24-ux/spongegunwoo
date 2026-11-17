'use strict';
/* ===== 인물 모델 (절차적 3D) ===== */
function makeChar(o) {
  const g = new THREE.Group(), u = g.userData;
  const robe = M(o.robe, { rough: 0.9 }), trim = M(o.trim ?? 0xf2cf7a, { rough: 0.5, metal: 0.4 }), skin = M(o.skin ?? 0xf3cba5, { rough: 0.7 }), hair = M(o.hair ?? 0x3a2a1c, { rough: 0.95 });
  const body = new THREE.Group(); g.add(body); u.body = body;
  body.add(cyl(0.19, 0.37, 1.05, robe, 0, 0.56, 0, 16));
  body.add(cyl(0.375, 0.385, 0.05, trim, 0, 0.055, 0, 16));
  const sh = sph(0.24, robe, 0, 1.07, 0); sh.scale.set(1.15, 0.62, 0.9); body.add(sh);
  body.add(cyl(0.2, 0.22, 0.05, trim, 0, 0.8, 0, 16)); // 허리띠
  if (o.cape) { // 망토
    const cg = new THREE.CylinderGeometry(0.25, 0.47, 1.05, 12, 1, true, Math.PI * 0.5, Math.PI);
    const cp = mesh(cg, M(o.cape, { rough: 0.9, side: THREE.DoubleSide }), 0, 0.62, -0.03); body.add(cp); u.cape = cp;
  }
  if (o.scarf) {
    const sc = mesh(new THREE.TorusGeometry(0.13, 0.055, 8, 16), M(o.scarf), 0, 1.2, 0); sc.rotation.x = Math.PI / 2; body.add(sc);
    const tail = box(0.1, 0.34, 0.04, M(o.scarf), 0.08, 1.02, 0.2); tail.rotation.z = -0.15; body.add(tail);
    if (o.scarf2) { body.add(box(0.102, 0.05, 0.042, M(o.scarf2), 0.085, 0.98, 0.2)); body.add(box(0.102, 0.05, 0.042, M(o.scarf2), 0.07, 1.1, 0.2)); }
  }
  const head = new THREE.Group(); head.position.y = 1.43; body.add(head); u.head = head;
  head.add(sph(0.19, skin, 0, 0, 0, 18));
  const eyeM = M(0x1a1a2a, { rough: 0.2 });
  [-1, 1].forEach(s => {
    head.add(sph(0.03, eyeM, s * 0.072, 0.015, 0.168, 8));
    const hl = sph(0.011, M(0xffffff, { emi: 0xffffff }), s * 0.066, 0.028, 0.193, 6); hl.castShadow = false; head.add(hl);
    const br = box(0.07, 0.014, 0.02, hair, s * 0.072, 0.075, 0.172); br.rotation.z = s * (o.brow ?? -0.12); head.add(br);
  });
  head.add(sph(0.022, skin, 0, -0.03, 0.19, 6)); // 코
  const mo = box(0.06, 0.012, 0.01, M(0x9a4a4a), 0, -0.085, 0.172); head.add(mo);
  const hs = o.hairStyle || 'short';
  if (hs !== 'bald') {
    const cap = mesh(new THREE.SphereGeometry(0.205, 18, 12, 0, TAU, 0, Math.PI * 0.56), hair, 0, 0.01, -0.012); cap.rotation.x = -0.32; head.add(cap);
    if (hs === 'long' || hs === 'bun') { const bk = sph(0.19, hair, 0, -0.12, -0.07); bk.scale.set(1.08, hs === 'long' ? 1.9 : 1.1, 0.7); head.add(bk); }
    if (hs === 'long') [-1, 1].forEach(s => { const sd = sph(0.07, hair, s * 0.17, -0.14, 0.02); sd.scale.set(0.7, 2.6, 1); head.add(sd); });
    if (hs === 'bun') head.add(sph(0.09, hair, 0, 0.17, -0.12));
    if (hs === 'wild') for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, c = cone(0.06, 0.16, hair, Math.cos(a) * 0.13, 0.15, Math.sin(a) * 0.13 - 0.02, 6); c.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); head.add(c); }
    if (hs === 'short') { const fr = sph(0.1, hair, 0.04, 0.14, 0.12); fr.scale.set(1.6, 0.5, 0.8); head.add(fr); }
    if (hs === 'slick') { const fr = sph(0.12, hair, 0, 0.13, 0.06); fr.scale.set(1.3, 0.55, 1.2); head.add(fr); }
  }
  if (o.hat) {
    const hg = new THREE.Group(); hg.position.y = 0.15; hg.rotation.z = 0.12;
    hg.add(cyl(0.34, 0.36, 0.03, M(o.hat), 0, 0, 0, 18)); hg.add(cone(0.2, 0.42, M(o.hat), 0, 0.22, 0, 14));
    const tip = cone(0.07, 0.2, M(o.hat), 0.06, 0.47, 0, 8); tip.rotation.z = -0.8; hg.add(tip);
    hg.add(cyl(0.205, 0.21, 0.05, trim, 0, 0.04, 0, 14)); head.add(hg);
  }
  if (o.beard) { const b = cone(0.14, 0.5, M(o.beard, { rough: 1 }), 0, -0.3, 0.1, 10); b.rotation.x = Math.PI + 0.2; head.add(b); }
  if (o.glasses) [-1, 1].forEach(s => { const t = mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 14), M(0x222222, { metal: 0.8, rough: 0.3 }), s * 0.072, 0.015, 0.18, false); head.add(t); });
  if (o.ears) [-1, 1].forEach(s => { const e = cone(0.05, 0.2, skin, s * 0.21, 0.04, 0, 6); e.rotation.z = -s * 1.2; head.add(e); });
  // 팔
  const mkArm = s => {
    const a = new THREE.Group(); a.position.set(s * 0.27, 1.12, 0);
    a.add(cyl(0.06, 0.085, 0.52, robe, 0, -0.26, 0, 10)); a.add(sph(0.055, skin, 0, -0.56, 0, 8)); body.add(a); return a;
  };
  u.armL = mkArm(-1); u.armR = mkArm(1); u.armL.rotation.z = -0.12; u.armR.rotation.z = 0.12;
  if (o.wand !== false) {
    u.armR.add(cyl(0.01, 0.017, 0.4, M(o.wandColor ?? 0x5a3a22, { rough: 0.5 }), 0, -0.78, 0, 6));
    const tip = new THREE.Object3D(); tip.position.y = -0.99; u.armR.add(tip); u.tip = tip;
    const tg = glow(o.wandGlow ?? 0x9fd8ff, 0.18, 0.7); tip.add(tg); u.tipGlow = tg;
  }
  if (o.staff) {
    u.armR.add(cyl(0.022, 0.026, 1.7, M(0x6b4a2a), 0, -0.45, 0.02, 8));
    const orb = sph(0.09, M(0xbfe6ff, { emi: 0x7fc8ff, ei: 1.5 }), 0, 0.46, 0.02); u.armR.add(orb); orb.add(glow(0x9fd8ff, 0.7, 0.7));
  }
  u.footL = box(0.12, 0.08, 0.22, M(0x2a2018), -0.1, 0.04, 0.06); u.footR = box(0.12, 0.08, 0.22, M(0x2a2018), 0.1, 0.04, 0.06);
  g.add(u.footL, u.footR);
  u.t = rand(10); u.cast = 0; u.castPitch = 0;
  g.scale.setScalar(o.scale || 1);
  g.traverse(m => { if (m.isMesh) m.frustumCulled = true; });
  return g;
}
/* 걷기·시전 애니메이션 */
function animChar(c, dt, speed = 0, casting = false, pitch = 0) {
  const u = c.userData; u.t += dt * (2 + speed * 2.2);
  const w = Math.min(1, speed / 3), s = Math.sin(u.t * 2.2) * w;
  u.body.position.y = Math.abs(Math.sin(u.t * 2.2)) * 0.05 * w + Math.sin(u.t * 0.9) * 0.008;
  u.body.rotation.x = w * 0.08;
  u.footL.position.z = 0.06 + s * 0.22; u.footR.position.z = 0.06 - s * 0.22;
  u.footL.position.y = 0.04 + Math.max(0, s) * 0.08; u.footR.position.y = 0.04 + Math.max(0, -s) * 0.08;
  u.armL.rotation.x = s * 0.7;
  u.cast = damp(u.cast, casting ? 1 : 0, 14, dt);
  u.armR.rotation.x = lerp(-s * 0.7, -Math.PI / 2 - pitch, u.cast);
  u.head.rotation.y = Math.sin(u.t * 0.35) * 0.12 * (1 - w);
  if (u.cape) u.cape.rotation.x = 0.06 + w * 0.22 + Math.sin(u.t * 1.7) * 0.03;
}
/* 인물 정의 — 모두 이 게임을 위해 새로 만든 인물 */
const CAST = {
  luka: { name: '루카', robe: 0x2b3a7a, cape: 0x1c2552, scarf: 0xd8a03a, scarf2: 0x2b3a7a, hair: 0x5a3b22, hairStyle: 'short' },
  miro: { name: '미로', robe: 0x7a2b3a, cape: 0x4d1823, scarf: 0x3fae8c, hair: 0xc4622a, hairStyle: 'wild', skin: 0xf6d3b0, scale: 1.03 },
  sera: { name: '세라', robe: 0x3d2b6b, cape: 0x261a47, scarf: 0xe6e0c8, hair: 0x1d1a2e, hairStyle: 'long', glasses: true, skin: 0xe9bf98, scale: 0.97 },
  orbel: { name: '오르벨 교장', robe: 0xe9e4d4, cape: 0x8fa8d8, trim: 0xb9d4ff, hair: 0xdfe3ee, hairStyle: 'bun', hat: 0x8fa8d8, staff: true, wand: false, skin: 0xd9ae8c, scale: 1.12 },
  pizel: { name: '피젤 교수', robe: 0x2f7a5a, cape: 0x1c4d38, hair: 0x8a8f55, hairStyle: 'wild', glasses: true, hat: 0x2f7a5a, beard: 0xb9b98a, scale: 1.0, brow: 0.2 },
  nox: { name: '녹스', robe: 0x16101f, cape: 0x0a0612, trim: 0xb04cff, hair: 0x0d0a14, hairStyle: 'slick', skin: 0xb9b3c9, scarf: 0x5a1f8a, wandColor: 0x111111, wandGlow: 0xff3a6a, scale: 1.1, brow: -0.35 },
  rival: { name: '카이', robe: 0x2a6b7a, cape: 0x17414a, hair: 0xe0d6a8, hairStyle: 'slick', scale: 1.02, brow: -0.25 }
};
function castChar(id) { const c = makeChar(CAST[id]); c.userData.id = id; c.userData.name = CAST[id].name; return c; }

/* 퐁 — 다락방에 사는 먼지구름 정령 */
function makePong() {
  const g = new THREE.Group(), u = g.userData, m = M(0xcfd6f2, { rough: 1, emi: 0x39407a, ei: 0.5 });
  const b = new THREE.Group(); g.add(b); u.body = b;
  b.add(sph(0.26, m, 0, 0, 0, 14));
  [[0.2, 0.05, 0], [-0.2, 0.04, 0.02], [0.1, 0.17, -0.05], [-0.1, 0.18, 0.03], [0, -0.1, 0.12], [0.14, -0.12, -0.1], [-0.15, -0.1, -0.08]].forEach(p => b.add(sph(rand(0.13, 0.18), m, p[0], p[1], p[2], 10)));
  [-1, 1].forEach(s => {
    b.add(sph(0.07, M(0xffffff, { rough: 0.2 }), s * 0.1, 0.04, 0.21, 10));
    b.add(sph(0.038, M(0x20203a, { rough: 0.1 }), s * 0.1, 0.04, 0.265, 8));
  });
  const st = mesh(new THREE.OctahedronGeometry(0.06), M(0xffe9a0, { emi: 0xffd060, ei: 2 }), 0, 0.42, 0, false); b.add(st); st.add(glow(0xffd880, 0.5, 0.8)); u.star = st;
  b.add(cyl(0.006, 0.006, 0.16, M(0x8890b8), 0, 0.33, 0, 4));
  [-1, 1].forEach(s => { const a = sph(0.07, m, s * 0.3, -0.05, 0.05, 8); b.add(a); u['hand' + s] = a; });
  g.add(glow(0x8fa8ff, 1.2, 0.25));
  u.t = rand(9);
  return g;
}
function animPong(p, dt) { const u = p.userData; u.t += dt; u.body.position.y = Math.sin(u.t * 2.4) * 0.07; u.body.rotation.z = Math.sin(u.t * 1.3) * 0.12; u.star.rotation.y += dt * 3; u.body.scale.setScalar(1 + Math.sin(u.t * 4) * 0.03); }

/* 별정령 — 수업 시간에 달아나는 작은 빛 */
function makeWisp(color = 0xffe28a) {
  const g = new THREE.Group();
  const c = mesh(new THREE.OctahedronGeometry(0.13), M(color, { emi: color, ei: 2.2, flat: true }), 0, 0, 0, false); g.add(c);
  g.add(glow(color, 1.1, 0.8));
  [-1, 1].forEach(s => { const w = mesh(new THREE.ConeGeometry(0.07, 0.3, 4), M(0xffffff, { emi: color, ei: 1, op: 0.7 }), s * 0.18, 0.05, 0, false); w.rotation.z = s * 1.1; g.add(w); g.userData['w' + s] = w; });
  g.userData.core = c; return g;
}

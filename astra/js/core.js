'use strict';
/* ===== 기본 도구 ===== */
const $ = id => document.getElementById(id);
const V3 = THREE.Vector3, TAU = Math.PI * 2;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const pick = a => a[Math.floor(Math.random() * a.length)];
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

/* ===== 렌더러 ===== */
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 700);
scene.add(camera);
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

/* ===== 입력 ===== */
const keys = {}, pressed = {};
const mouse = { dx: 0, dy: 0, nx: 0, ny: 0, l: false, r: false, lp: false };
let locked = false, isTouch = false;
const joy = { x: 0, y: 0 };
window.addEventListener('keydown', e => {
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.l = mouse.r = false; });
const cv = $('c');
function tryLock() {
  if (isTouch || locked || !cv.requestPointerLock) return;
  try { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}
cv.addEventListener('mousedown', e => {
  if (isTouch) return;
  if (e.button === 0) { mouse.l = true; mouse.lp = true; } else if (e.button === 2) mouse.r = true;
  if (window.G && G.running && !G.needCursor) tryLock();
});
window.addEventListener('mouseup', e => { if (e.button === 0) mouse.l = false; else if (e.button === 2) mouse.r = false; });
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('mousemove', e => {
  if (locked) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; }
  else { mouse.nx = e.clientX / window.innerWidth * 2 - 1; mouse.ny = -(e.clientY / window.innerHeight * 2 - 1); }
});
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === cv; });

/* 터치 조작 */
function setupTouch() {
  if (isTouch) return; isTouch = true; $('tc').hidden = false;
  const j = $('joy'), knob = j.firstElementChild; let jid = null;
  const jmove = t => {
    const r = j.getBoundingClientRect(); let x = (t.clientX - r.left - 60) / 50, y = (t.clientY - r.top - 60) / 50;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    joy.x = x; joy.y = -y; knob.style.transform = `translate(${x * 36}px,${y * 36}px)`;
  };
  j.addEventListener('touchstart', e => { e.preventDefault(); jid = e.changedTouches[0].identifier; jmove(e.changedTouches[0]); }, { passive: false });
  j.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === jid) jmove(t); }, { passive: false });
  const jend = e => { for (const t of e.changedTouches) if (t.identifier === jid) { jid = null; joy.x = joy.y = 0; knob.style.transform = ''; } };
  j.addEventListener('touchend', jend); j.addEventListener('touchcancel', jend);
  const bind = (id, code) => {
    const el = $(id);
    el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); keys[code] = true; pressed[code] = true; }, { passive: false });
    const up = e => { e.preventDefault(); keys[code] = false; };
    el.addEventListener('touchend', up); el.addEventListener('touchcancel', up);
  };
  bind('tfire', 'T_fire'); bind('tshield', 'T_shield'); bind('tjump', 'Space'); bind('tdash', 'ShiftLeft'); bind('tuse', 'KeyE');
  let lid = null, lx = 0, ly = 0;
  cv.addEventListener('touchstart', e => {
    e.preventDefault(); const t = e.changedTouches[0]; pressed.Tap = true;
    if (lid === null) { lid = t.identifier; lx = t.clientX; ly = t.clientY; }
  }, { passive: false });
  cv.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === lid) { mouse.dx += (t.clientX - lx) * 2.2; mouse.dy += (t.clientY - ly) * 2.2; lx = t.clientX; ly = t.clientY; }
  }, { passive: false });
  const lend = e => { for (const t of e.changedTouches) if (t.identifier === lid) lid = null; };
  cv.addEventListener('touchend', lend); cv.addEventListener('touchcancel', lend);
}
window.addEventListener('touchstart', setupTouch, { once: true, passive: true });

/* ===== 소리 ===== */
let AC = null, master, sfxG, musG, beamOsc = null, beamG, beamF, muted = false;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = AC.createGain(); master.gain.value = 0.8; master.connect(AC.destination);
  sfxG = AC.createGain(); sfxG.gain.value = 0.9; sfxG.connect(master);
  musG = AC.createGain(); musG.gain.value = 0.55; musG.connect(master);
  const dl = AC.createDelay(1); dl.delayTime.value = 0.31;
  const fb = AC.createGain(); fb.gain.value = 0.36;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  musG.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(master);
  // 광선 지속음
  beamG = AC.createGain(); beamG.gain.value = 0; beamF = AC.createBiquadFilter(); beamF.type = 'bandpass'; beamF.frequency.value = 900; beamF.Q.value = 3;
  beamOsc = [AC.createOscillator(), AC.createOscillator()];
  beamOsc[0].type = 'sawtooth'; beamOsc[0].frequency.value = 220; beamOsc[1].type = 'sawtooth'; beamOsc[1].frequency.value = 331;
  beamOsc.forEach(o => { o.connect(beamF); o.start(); }); beamF.connect(beamG); beamG.connect(sfxG);
  setInterval(musicTick, 50);
}
function beamSound(on, pitch = 1) {
  if (!AC) return; const t = AC.currentTime;
  beamG.gain.setTargetAtTime(on ? 0.16 : 0, t, 0.04);
  beamOsc[0].frequency.setTargetAtTime(220 * pitch, t, 0.05); beamOsc[1].frequency.setTargetAtTime(331 * pitch, t, 0.05);
  beamF.frequency.setTargetAtTime(900 * pitch + Math.random() * 300, t, 0.05);
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function tone(f, t, dur, type, vol, dest, atk = 0.006, slide = 0) {
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf = null;
function noise(t, dur, vol, freq, dest, type = 'lowpass') {
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function sfx(n) {
  if (!AC || muted) return; const t = AC.currentTime, d = sfxG;
  switch (n) {
    case 'chime': [84, 88, 91, 96].forEach((m, i) => tone(mtof(m), t + i * 0.07, 0.6, 'sine', 0.16, d)); break;
    case 'good': [76, 81, 88].forEach((m, i) => tone(mtof(m), t + i * 0.05, 0.35, 'triangle', 0.18, d)); break;
    case 'bad': tone(180, t, 0.35, 'sawtooth', 0.14, d, 0.01, 0.5); break;
    case 'hit': noise(t, 0.18, 0.5, 1800, d); tone(140, t, 0.2, 'square', 0.14, d, 0.005, 0.4); break;
    case 'hurt': noise(t, 0.3, 0.6, 700, d); tone(110, t, 0.35, 'sawtooth', 0.22, d, 0.005, 0.5); break;
    case 'boom': noise(t, 0.9, 0.9, 500, d); tone(70, t, 0.8, 'sine', 0.5, d, 0.005, 0.4); break;
    case 'shoot': tone(700, t, 0.22, 'sawtooth', 0.1, d, 0.005, 0.3); break;
    case 'parry': tone(1300, t, 0.3, 'triangle', 0.25, d); tone(1950, t + 0.03, 0.4, 'sine', 0.2, d); noise(t, 0.1, 0.3, 5000, d, 'highpass'); break;
    case 'shield': tone(300, t, 0.25, 'sine', 0.16, d, 0.02, 2); break;
    case 'dash': noise(t, 0.22, 0.3, 2500, d, 'bandpass'); break;
    case 'jump': tone(300, t, 0.15, 'sine', 0.12, d, 0.005, 1.8); break;
    case 'pop': tone(520, t, 0.12, 'sine', 0.2, d, 0.004, 2.2); break;
    case 'talk': tone(rand(380, 520), t, 0.05, 'triangle', 0.05, d); break;
    case 'ring': tone(mtof(86), t, 0.5, 'sine', 0.2, d); tone(mtof(93), t + 0.06, 0.6, 'sine', 0.16, d); break;
    case 'glass': for (let i = 0; i < 7; i++) tone(rand(1800, 5200), t + i * 0.03, 0.4, 'sine', 0.09, d); noise(t, 0.35, 0.4, 6000, d, 'highpass'); break;
    case 'roar': tone(90, t, 1.1, 'sawtooth', 0.3, d, 0.1, 0.6); tone(134, t, 1.1, 'sawtooth', 0.2, d, 0.1, 0.55); noise(t, 1, 0.3, 400, d); break;
    case 'whoosh': noise(t, 0.5, 0.35, 1200, d, 'bandpass'); break;
    case 'rune0': case 'rune1': case 'rune2': case 'rune3': case 'rune4':
      tone(mtof([62, 65, 69, 72, 74][+n[4]]), t, 0.7, 'sine', 0.3, d); tone(mtof([62, 65, 69, 72, 74][+n[4]] + 12), t, 0.5, 'triangle', 0.1, d); break;
  }
}
/* 직접 만든 배경 음악 (16분음표 시퀀서) */
const Dm = [50, 57, 62, 65], Bb = [46, 53, 58, 62], F = [53, 57, 60, 65], C = [48, 55, 60, 64], Gm = [43, 55, 58, 62], A = [45, 57, 61, 64], Am = [45, 57, 60, 64], E = [40, 56, 59, 64];
const SONGS = {
  calm: { bpm: 84, chords: [Dm, Bb, F, C, Dm, Bb, Gm, A], drums: 0, arp: 0, mel: [
    [69,0,0,0,74,0,77,0,76,0,74,0,69,0,0,0],[70,0,0,0,74,0,77,0,79,0,77,0,74,0,0,0],[72,0,0,0,77,0,81,0,79,0,77,0,72,0,76,0],[76,0,0,0,72,0,67,0,72,0,0,0,74,0,76,0],
    [77,0,0,0,76,0,74,0,69,0,0,0,74,0,0,0],[77,0,0,0,74,0,70,0,74,0,0,0,65,0,0,0],[70,0,0,0,74,0,79,0,82,0,81,0,79,0,74,0],[73,0,0,0,76,0,81,0,0,0,76,0,73,0,0,0]] },
  mystery: { bpm: 62, chords: [Am, F, Dm, E], drums: 0, arp: 0, mel: [
    [76,0,0,0,0,0,75,0,0,0,72,0,0,0,0,0],[69,0,0,0,0,0,0,0,77,0,0,0,76,0,0,0],[74,0,0,0,0,0,73,0,0,0,69,0,0,0,0,0],[68,0,0,0,0,0,0,0,71,0,0,0,76,0,0,0]] },
  battle: { bpm: 140, chords: [Dm, Bb, Gm, A], drums: 2, arp: 1, mel: [
    [74,0,0,0,0,0,0,0,77,0,0,0,76,0,74,0],[70,0,0,0,0,0,0,0,74,0,0,0,77,0,0,0],[79,0,0,0,0,0,0,0,77,0,0,0,74,0,0,0],[73,0,0,0,76,0,0,0,81,0,0,0,0,0,0,0]] },
  fly: { bpm: 122, chords: [F, C, Dm, Bb], drums: 1, arp: 1, mel: [
    [72,0,77,0,81,0,84,0,81,0,77,0,81,0,0,0],[72,0,76,0,79,0,84,0,79,0,76,0,79,0,0,0],[74,0,77,0,81,0,86,0,84,0,81,0,77,0,0,0],[74,0,77,0,82,0,86,0,84,0,82,0,77,0,81,0]] }
};
let song = null, songStep = 0, songT = 0;
function music(name) { if (song === SONGS[name]) return; song = SONGS[name] || null; songStep = 0; if (AC) songT = AC.currentTime + 0.1; }
function musicTick() {
  if (!AC || !song || muted) { if (AC) songT = AC.currentTime + 0.1; return; }
  const sd = 60 / song.bpm / 4;
  while (songT < AC.currentTime + 0.2) {
    const bar = Math.floor(songStep / 16) % song.chords.length, st = songStep % 16, ch = song.chords[bar], t = songT, d = musG;
    if (st === 0) ch.slice(1).forEach(m => { tone(mtof(m), t, sd * 16, 'sawtooth', 0.022, d, sd * 3); tone(mtof(m) * 1.004, t, sd * 16, 'triangle', 0.04, d, sd * 3); });
    if (st === 0 || st === 8) tone(mtof(ch[0] - (ch[0] > 47 ? 12 : 0)), t, sd * 7, 'triangle', 0.2, d, 0.01);
    const m = song.mel[bar % song.mel.length][st];
    if (m) { tone(mtof(m), t, sd * 5, 'sine', 0.15, d); tone(mtof(m) * 3.01, t, sd * 2, 'sine', 0.035, d); tone(mtof(m + 12), t, sd * 3, 'triangle', 0.03, d); }
    if (song.arp && st % 2 === 0) tone(mtof(ch[1 + [0, 1, 2, 1, 2, 1, 0, 2][st / 2]] + 12), t, sd * 1.6, 'triangle', 0.05, d);
    if (song.drums) {
      if (st % 8 === 0 || (song.drums > 1 && st === 10)) { tone(120, t, 0.18, 'sine', 0.5, d, 0.003, 0.3); }
      if (st % 8 === 4) noise(t, 0.12, 0.2, 3500, d, 'highpass');
      if (song.drums > 1 && st % 2 === 0) noise(t, 0.04, 0.07, 7000, d, 'highpass');
    }
    songT += sd; songStep++;
  }
}

/* ===== 텍스처 ===== */
function canvasTex(w, h, fn, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  t.anisotropy = 4; return t;
}
function speckle(g, w, h, n, a) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, rand(1, 4), rand(1, 4)); } }
const TEXFN = {
  stone(g, w, h) {
    g.fillStyle = '#8d8a96'; g.fillRect(0, 0, w, h);
    const bh = h / 8, bw = w / 4;
    for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) {
      const v = rand(-18, 18), x = c * bw + (r % 2 ? bw / 2 : 0);
      g.fillStyle = `rgb(${138 + v},${134 + v},${150 + v})`; g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
    }
    speckle(g, w, h, 1500, 0.09);
  },
  wood(g, w, h) {
    g.fillStyle = '#7a5334'; g.fillRect(0, 0, w, h);
    for (let c = 0; c < 6; c++) { const v = rand(-14, 14); g.fillStyle = `rgb(${122 + v},${83 + v},${52 + v})`; g.fillRect(c * w / 6 + 1, 0, w / 6 - 2, h); }
    g.strokeStyle = 'rgba(40,20,5,.25)'; for (let i = 0; i < 60; i++) { g.beginPath(); const x = rand(w); g.moveTo(x, rand(h)); g.lineTo(x + rand(-3, 3), rand(h)); g.stroke(); }
  },
  grass(g, w, h) {
    g.fillStyle = '#3c6b3f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { const v = rand(-25, 25); g.fillStyle = `rgb(${60 + v},${110 + v},${64 + v})`; g.fillRect(rand(w), rand(h), 2, rand(2, 6)); }
  },
  tile(g, w, h) {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const v = rand(-10, 10), d = (r + c) % 2 ? 0 : 26; g.fillStyle = `rgb(${96 + v + d},${92 + v + d},${112 + v + d})`; g.fillRect(c * w / 4 + 1, r * h / 4 + 1, w / 4 - 2, h / 4 - 2); }
    speckle(g, w, h, 900, 0.07);
  },
  rock(g, w, h) {
    g.fillStyle = '#4a4e63'; g.fillRect(0, 0, w, h); speckle(g, w, h, 3000, 0.12);
    g.strokeStyle = 'rgba(0,0,0,.3)'; for (let i = 0; i < 14; i++) { g.beginPath(); let x = rand(w), y = rand(h); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rand(-30, 30); y += rand(-30, 30); g.lineTo(x, y); } g.stroke(); }
  }
};
const texCache = {};
function tex(name, rx = 1, ry = 1) { const k = name + rx + '_' + ry; return texCache[k] || (texCache[k] = canvasTex(256, 256, TEXFN[name], [rx, ry])); }
const glowTex = canvasTex(64, 64, (g) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(0.6, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
});
const streakTex = canvasTex(64, 256, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) { const x = rand(w), y = rand(h), l = rand(30, 120); const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${rand(0.3, 1)})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, y, rand(2, 7), l); g.fillRect(x, y - h, rand(2, 7), l); }
}, [1, 1]);
function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, fog: false }));
  s.scale.set(size, size, 1); return s;
}

/* ===== 재질·도형 헬퍼 ===== */
const matCache = {};
function M(color, o = {}) {
  const k = color + JSON.stringify(o, (kk, v) => kk === 'map' && v ? v.uuid : v);
  if (matCache[k] && !o.fresh) return matCache[k];
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, emissive: o.emi ?? 0, emissiveIntensity: o.ei ?? 1,
    transparent: !!o.op, opacity: o.op ?? 1, flatShading: !!o.flat, side: o.side ?? THREE.FrontSide, map: o.map || null });
  if (!o.fresh) matCache[k] = m; return m;
}
function mesh(geo, mat, x = 0, y = 0, z = 0, sh = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sh; m.receiveShadow = true; return m; }
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const cyl = (rt, rb, h, mat, x, y, z, seg = 14) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);
const sph = (r, mat, x, y, z, seg = 14) => mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), mat, x, y, z);
const cone = (r, h, mat, x, y, z, seg = 12) => mesh(new THREE.ConeGeometry(r, h, seg), mat, x, y, z);

/* ===== 입자 ===== */
const PN = 2600;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pSize = new Float32Array(PN);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('pcol', new THREE.BufferAttribute(pCol, 3));
pGeo.setAttribute('psize', new THREE.BufferAttribute(pSize, 1));
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { sc: { value: 300 } },
  vertexShader: 'attribute vec3 pcol;attribute float psize;varying vec3 vc;uniform float sc;void main(){vc=pcol;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=psize*sc/max(.1,-mv.z);gl_Position=projectionMatrix*mv;}',
  fragmentShader: 'varying vec3 vc;void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,0.,d);gl_FragColor=vec4(vc*a*a,1.);}'
});
const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; pPoints.renderOrder = 10; scene.add(pPoints);
const parts = []; for (let i = 0; i < PN; i++) parts.push({ life: 0, max: 1, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, s: 0.1, grav: 0, drag: 0 });
let pIdx = 0; const _pc = new THREE.Color();
function emit(pos, n, o = {}) {
  _pc.set(o.color ?? 0xffffff);
  const sp = o.speed ?? 2, sz = o.size ?? 0.12, life = o.life ?? 0.6, spread = o.spread ?? 0;
  for (let i = 0; i < n; i++) {
    const p = parts[pIdx]; pIdx = (pIdx + 1) % PN;
    const th = rand(TAU), ph = Math.acos(rand(-1, 1)), v = sp * rand(0.3, 1);
    p.x = pos.x + rand(-spread, spread); p.y = pos.y + rand(-spread, spread); p.z = pos.z + rand(-spread, spread);
    p.vx = Math.sin(ph) * Math.cos(th) * v + (o.vx || 0); p.vy = Math.cos(ph) * v + (o.vy || 0); p.vz = Math.sin(ph) * Math.sin(th) * v + (o.vz || 0);
    const j = rand(0.7, 1.15); p.r = _pc.r * j; p.g = _pc.g * j; p.b = _pc.b * j;
    p.s = sz * rand(0.6, 1.3); p.max = p.life = life * rand(0.6, 1.2); p.grav = o.grav ?? 0; p.drag = o.drag ?? 1.5;
  }
}
function updateParticles(dt) {
  pMat.uniforms.sc.value = window.innerHeight * 0.9;
  for (let i = 0; i < PN; i++) {
    const p = parts[i];
    if (p.life <= 0) { if (pSize[i] !== 0) { pSize[i] = 0; pPos[i * 3 + 1] = -999; } continue; }
    p.life -= dt; const k = Math.max(0, p.life / p.max), dr = Math.exp(-p.drag * dt);
    p.vx *= dr; p.vy = p.vy * dr - p.grav * dt; p.vz *= dr;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
    pCol[i * 3] = p.r * k; pCol[i * 3 + 1] = p.g * k; pCol[i * 3 + 2] = p.b * k; pSize[i] = p.s * (0.4 + 0.6 * k);
  }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.pcol.needsUpdate = pGeo.attributes.psize.needsUpdate = true;
}
function clearParticles() { for (const p of parts) p.life = 0; }

// 밸런스 시뮬레이터: 봇이 덱을 굴려 스테이지별 클리어율과 캐릭터별 기여도를 냄
// 사용: node sim/sim.mjs [무작위 덱 수=120] [덱당 반복=3]
import { CHARS, CHAR_BY_ID, STARTER, RARITY, PITY, gachaPull, mulberry32 } from '../js/data.js';
import { Game } from '../js/engine.js';
import { Bot } from '../js/bot.js';

const N_DECKS = +process.argv[2] || 120;
const RUNS = +process.argv[3] || 3;
const DT = 0.1;
const STAGES = 10;

export function runOnce(deck, stage, seed, novice = false) {
  const g = new Game({ deck, stage, seed });
  const bot = new Bot(g, mulberry32(seed * 7919 + 13), { novice });
  let guard = 0;
  while (!g.result && guard++ < 60000) {
    bot.tick(DT);
    g.step(DT);
  }
  return g;
}

function rate(deck, stage, runs, seed0, novice = false) {
  let win = 0;
  let prog = 0;
  const dmg = {};
  for (let i = 0; i < runs; i++) {
    const g = runOnce(deck, stage, seed0 + i * 101, novice);
    if (g.result === 'win') win++;
    prog += (g.result === 'win' ? 10 : g.waveIdx) / 10;
    for (const k in g.stats) dmg[k] = (dmg[k] || 0) + g.stats[k];
  }
  return { win: win / runs, prog: prog / runs, dmg };
}

const pct = (x) => (x * 100).toFixed(0).padStart(4) + '%';
const row = (label, arr) => console.log(label.padEnd(22) + arr.map(pct).join(' '));

function randomDeck(rng, pool) {
  const p = pool.slice();
  const d = [];
  while (d.length < 5) d.push(p.splice(Math.floor(rng() * p.length), 1)[0].id);
  return d;
}

const t0 = Date.now();
console.log('스테이지'.padEnd(18) + Array.from({ length: STAGES }, (_, i) => String(i + 1).padStart(5)).join(''));

// 1) 고정 덱
const fixed = {
  '시작 덱(일반 5)': STARTER.slice(0, 5),
  '일반+희귀 균형': ['smile', 'cold', 'fear', 'cool', 'huff'],
  '영웅 섞은 덱': ['fear', 'cool', 'party', 'plead', 'huff'],
  '전설 덱': ['boom', 'ghost', 'cold', 'party', 'cool'],
  '최상급 덱': ['void', 'boom', 'ghost', 'angel', 'cold'],
};
for (const [name, deck] of Object.entries(fixed)) {
  const r = [];
  for (let s = 1; s <= STAGES; s++) r.push(rate(deck, s, 20, 1000 + s).win);
  row(name, r);
}

{
  // 사람 초보를 흉내 낸 봇: 3초에 한 번 행동, 자리 선택 엉성, 강화는 칸이 찬 뒤에만
  const r = [];
  for (let s = 1; s <= STAGES; s++) r.push(rate(STARTER.slice(0, 5), s, 40, 3000 + s, true).win);
  row('시작 덱 + 초보 봇', r);
}

// 2) 무작위 덱 — 전체 풀 / 일반+희귀 풀
const rng = mulberry32(42);
function sweep(label, pool) {
  const per = Array(STAGES).fill(0);
  const inc = {};
  const decks = [];
  for (let i = 0; i < N_DECKS; i++) decks.push(randomDeck(rng, pool));
  let overall = 0;
  let overallP = 0;
  for (const deck of decks) {
    let dw = 0;
    let dp = 0;
    const dmgTot = {};
    for (let s = 1; s <= STAGES; s++) {
      const r = rate(deck, s, RUNS, 5000 + s * 17);
      per[s - 1] += r.win / N_DECKS;
      dw += r.win / STAGES;
      dp += r.prog / STAGES;
      for (const k in r.dmg) dmgTot[k] = (dmgTot[k] || 0) + r.dmg[k];
    }
    overall += dw / N_DECKS;
    overallP += dp / N_DECKS;
    const all = Object.values(dmgTot).reduce((a, b) => a + b, 0) || 1;
    for (const id of deck) {
      const o = (inc[id] = inc[id] || { n: 0, win: 0, prog: 0, share: 0 });
      o.n++;
      o.win += dw;
      o.prog += dp;
      o.share += (dmgTot[id] || 0) / all;
    }
  }
  row(label, per);
  return { inc, overall, overallP };
}
const all = sweep(`무작위 덱(전체) x${N_DECKS}`, CHARS);
sweep(`무작위 덱(일반+희귀)`, CHARS.filter((c) => c.rar <= 1));

// 3) 캐릭터별: 덱에 있을 때의 평균 클리어율과 피해 비중
console.log(`\n캐릭터별 (전체 풀 무작위 덱, 전 스테이지 평균 클리어율 ${pct(all.overall).trim()})`);
console.log('캐릭터        등급  비용  포함 시 클리어율  편차  진행도 편차  피해 비중');
for (const c of CHARS) {
  const o = all.inc[c.id];
  if (!o) continue;
  const w = o.win / o.n;
  const d = w - all.overall;
  const dp = o.prog / o.n - all.overallP;
  console.log(
    `${c.e} ${c.name.padEnd(5, '　')} ${RARITY[c.rar].name}  ${String(c.cost).padStart(3)}   ${pct(w)}          ${(d >= 0 ? '+' : '') + (d * 100).toFixed(0).padStart(3)}p    ${(dp >= 0 ? '+' : '') + (dp * 100).toFixed(0).padStart(3)}p     ${pct(o.share / o.n)}  (n=${o.n})`,
  );
}

// 4) 뽑기 천장 검증
{
  const g = mulberry32(7);
  const pity = { hero: 0, legend: 0, myth: 0 };
  const N = 2_000_000;
  const cnt = [0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) cnt[gachaPull(pity, g).rar]++;
  console.log(`\n뽑기 ${N.toLocaleString()}회 실측 (천장 ${PITY.hero}/${PITY.legend}/${PITY.myth})`);
  console.log(RARITY.map((r, i) => `${r.name} ${((cnt[i] / N) * 100).toFixed(2)}%`).join('  '));
  console.log(`신화 1명당 평균 ${(N / cnt[4]).toFixed(1)}회, 전설 이상 1명당 평균 ${(N / (cnt[3] + cnt[4])).toFixed(1)}회`);
}
console.log(`\n소요 ${((Date.now() - t0) / 1000).toFixed(1)}초`);
void CHAR_BY_ID;

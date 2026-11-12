// 난투 모드 시뮬레이터: 단순 봇으로 스테이지별 승률을 냄
// 사용: node sim/brawl-sim.mjs [무작위 덱 수=150]
import { CHARS, STARTER, mulberry32 } from '../js/data.js';
import { Brawl, BrawlBot } from '../js/brawl.js';
const N = +process.argv[2] || 150;
function run(deck, stage, seed) {
  const g = new Brawl({ deck, stage, seed });
  const bot = new BrawlBot(g, mulberry32(seed * 31 + 7));
  while (!g.result) { bot.tick(0.1); g.step(0.1); }
  return g;
}
const rate = (deck, stage, runs, s0) => { let w = 0; for (let i = 0; i < runs; i++) if (run(deck, stage, s0 + i * 97).result === 'win') w++; return w / runs; };
const pct = (x) => (x * 100).toFixed(0).padStart(4) + '%';
const row = (l, a) => console.log(l.padEnd(22) + a.map(pct).join(' '));
console.log('난투 스테이지'.padEnd(17) + Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(5)).join(''));
const S = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
row('시작 덱(일반 5)', S.map((s) => rate(STARTER.slice(0, 5), s, 40, 100 + s)));
row('전설 덱', S.map((s) => rate(['boom', 'ghost', 'cold', 'party', 'cool'], s, 40, 100 + s)));
const rng = mulberry32(5);
const decks = (pool) => Array.from({ length: N }, () => { const p = pool.slice(); const d = []; while (d.length < 5) d.push(p.splice(Math.floor(rng() * p.length), 1)[0].id); return d; });
const all = decks(CHARS);
row(`무작위 덱(전체) x${N}`, S.map((s) => all.reduce((a, d) => a + rate(d, s, 2, 900 + s), 0) / N));
row('무작위 덱(일반+희귀)', S.map((s) => decks(CHARS.filter((c) => c.rar <= 1)).reduce((a, d) => a + rate(d, s, 2, 900 + s), 0) / N));
const inc = {};
let tot = 0;
for (const d of all) { let w = 0; for (const s of S) w += rate(d, s, 2, 900 + s) / 10; tot += w / N; for (const id of d) { (inc[id] = inc[id] || [0, 0])[0]++; inc[id][1] += w; } }
console.log(`\n캐릭터별 포함 시 승률 편차 (평균 ${pct(tot).trim()})`);
console.log(CHARS.map((c) => `${c.e}${((inc[c.id][1] / inc[c.id][0] - tot) * 100).toFixed(0).padStart(4)}p`).join('  '));

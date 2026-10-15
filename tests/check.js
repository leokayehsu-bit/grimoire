// Headless solver test: node tests/check.js [editions=300] [seances=5000]
// For every edition: the book builds and reads cleanly.
// For every séance: each relic has exactly one correct answer, a perfect Medium wins,
// three offenses lose, and the wrath runs out on time.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['util', 'seance', 'relics/candles', 'relics/ouija', 'relics/musicbox', 'relics/tarot', 'rules', 'game'];
const sandbox = vm.createContext({ console });
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), sandbox, { filename: f + '.js' });
const GR = sandbox.GR;

const EDITIONS = +process.argv[2] || 300;
const SEANCES = +process.argv[3] || 5000;
let fails = 0;
const fail = (msg) => { if (++fails <= 25) console.log('FAIL', msg); };
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---- Editions -------------------------------------------------------------
for (let e = 1; e <= EDITIONS; e++) {
  const R = GR.rules.build(e);
  for (const id of GR.RELIC_ORDER) {
    const html = GR.relics[id].manual(R[id]);
    if (/undefined|NaN|\[object/.test(html)) fail(`edition ${e} ${id}: manual has a broken value`);
  }
  for (let n = 3; n <= 6; n++) {
    const set = R.candles.byCount[n];
    if (set.rules.length !== 3 || set.fallback < 0 || set.fallback >= n) fail(`edition ${e}: candle set ${n} malformed`);
  }
  const o = R.ouija;
  if (new Set(o.words).size !== o.words.length) fail(`edition ${e}: duplicate board words`);
  for (const w of o.words) {
    const r = o.table[w];
    if (r.dusk === r.dawn || !GR.relics.ouija.ANSWERS.includes(r.dusk) || !GR.relics.ouija.ANSWERS.includes(r.dawn)) fail(`edition ${e}: bad answers for ${w}`);
  }
  for (const row of [...R.musicbox.lullaby, ...R.musicbox.dirge]) {
    if ([...row].sort().join() !== [...GR.relics.musicbox.FIGURES].sort().join()) fail(`edition ${e}: music row is not a permutation`);
  }
  if ([...R.tarot.order].sort().join() !== '0,1,2') fail(`edition ${e}: tarot order broken`);
}

// ---- Séances --------------------------------------------------------------
const stats = { candleRule: [0, 0, 0, 0], tarotPos: [0, 0, 0], ouijaDusk: 0, ouija: 0, wins: 0 };

function uniqueAnswer(def, state, ctx, rules, strikes, label) {
  const ok = def.inputs(state).filter((inp) => {
    const res = def.attempt(clone(state), inp, ctx, rules, strikes);
    return res !== 'strike';
  });
  if (ok.length !== 1) fail(`${label}: ${ok.length} accepted inputs (${JSON.stringify(ok)})`);
  return ok[0];
}

for (let s = 1; s <= SEANCES; s++) {
  const seed = Math.imul(s, 2654435761) >>> 0;
  const edition = 1 + (s % EDITIONS);
  const difficulty = ['restless', 'vengeful', 'damned'][s % 3];
  const label = `seed ${seed} ed ${edition}`;
  const g = new GR.Game({ seed, edition, difficulty });
  const rebuilt = new GR.Game({ seed, edition, difficulty });
  if (JSON.stringify(g.ctx) !== JSON.stringify(rebuilt.ctx) || JSON.stringify(g.relics.map((r) => r.state)) !== JSON.stringify(rebuilt.relics.map((r) => r.state))) {
    fail(`${label}: same seed built a different séance`);
  }

  // A perfect Medium, occasionally making a deliberate mistake (strikes change the music box table).
  const mistakes = s % 4 === 0 ? 2 : 0;
  let made = 0;
  g.relics.forEach((r, i) => {
    const rules = g.rules[r.id];
    if (r.id === 'candles') {
      const set = rules.byCount[r.state.colors.length];
      let hit = set.rules.findIndex((x) => x.test(r.state.colors, g.ctx));
      stats.candleRule[hit < 0 ? 3 : hit]++;
    }
    if (r.id === 'tarot') stats.tarotPos[r.def.expected(r.state, g.ctx, rules)]++;
    if (r.id === 'ouija') { stats.ouija++; if (rules.cond.test(g.ctx)) stats.ouijaDusk++; }

    let guard = 0;
    while (!r.solved && !g.result && guard++ < 50) {
      const ans = uniqueAnswer(r.def, r.state, g.ctx, rules, g.strikes, `${label} ${r.id}`);
      if (made < mistakes) {
        const wrong = r.def.inputs(r.state).find((x) => x !== ans);
        if (g.attempt(i, wrong) !== 'strike') fail(`${label} ${r.id}: wrong input was not an offense`);
        made++;
        continue;
      }
      const res = g.attempt(i, ans);
      if (res === 'strike') fail(`${label} ${r.id}: the book's answer was punished`);
    }
    if (!r.solved) fail(`${label} ${r.id}: could not be cleansed`);
  });
  if (!g.result || g.result.result !== 'win') fail(`${label}: perfect play did not win`);
  else stats.wins++;

  // Three offenses end the séance.
  const lose = new GR.Game({ seed, edition, difficulty });
  for (let k = 0; k < 3; k++) {
    const r = lose.relics[0];
    const ans = r.def.expected(r.state, lose.ctx, lose.rules[r.id], lose.strikes);
    const right = Array.isArray(ans) ? ans[r.state.input.length] : ans;
    lose.attempt(0, r.def.inputs(r.state).find((x) => x !== right));
  }
  if (!lose.result || lose.result.reason !== 'strikes') fail(`${label}: three offenses did not lose`);

  // Wrath runs out on schedule (with one offense it should run 25% faster).
  const slow = new GR.Game({ seed, edition, difficulty });
  slow.strikes = 1;
  for (let t = 0; t < slow.duration / 1.25 - 1; t++) slow.tick(1);
  if (slow.result) fail(`${label}: wrath ended early`);
  slow.tick(2);
  if (!slow.result || slow.result.reason !== 'wrath') fail(`${label}: wrath did not end the séance`);
}

const pct = (a, b) => (100 * a / b).toFixed(1) + '%';
const cr = stats.candleRule, ct = cr.reduce((a, b) => a + b, 0);
console.log(`editions ${EDITIONS}, séances ${SEANCES}`);
console.log(`candles: rule1 ${pct(cr[0], ct)} rule2 ${pct(cr[1], ct)} rule3 ${pct(cr[2], ct)} otherwise ${pct(cr[3], ct)}`);
const tp = stats.tarotPos, tt = tp.reduce((a, b) => a + b, 0);
console.log(`tarot burns: left ${pct(tp[0], tt)} middle ${pct(tp[1], tt)} right ${pct(tp[2], tt)}`);
console.log(`spirit board uses Dusk: ${pct(stats.ouijaDusk, stats.ouija)}`);
console.log(`perfect Medium wins: ${stats.wins}/${SEANCES}`);
console.log(fails ? `${fails} FAILURES` : 'ALL CHECKS PASSED');
process.exit(fails ? 1 : 0);

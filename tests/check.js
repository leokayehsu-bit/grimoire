// Headless solver test: node tests/check.js [editions=300] [seances=5000]
// For every edition: the book builds and reads cleanly.
// For every séance: each relic has exactly one correct answer, a perfect Medium wins,
// three offenses lose, and the wrath runs out on time. The Whispering Doll whispers on schedule, has exactly
// one right comfort, punishes silence, and never counts toward the win. In the smudged copy, every relic
// page loses exactly one entry, and exactly one margin note on another page restores the clean book.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['util', 'seance', 'relics/candles', 'relics/ouija', 'relics/musicbox', 'relics/tarot', 'relics/doll', 'rules', 'game'];
const sandbox = vm.createContext({ console });
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), sandbox, { filename: f + '.js' });
const GR = sandbox.GR;

const EDITIONS = +process.argv[2] || 300;
const SEANCES = +process.argv[3] || 5000;
let fails = 0;
const fail = (msg) => { if (++fails <= 25) console.log('FAIL', msg); };
const clone = (o) => JSON.parse(JSON.stringify(o));

const DOLL = GR.relics.doll;
let smudgesChecked = 0;

// ---- Smudged grimoire -----------------------------------------------------
const SPAN = /<span class="smudge" data-mark="([^"]+)">[^<]*<\/span>/g;
const NOTE = /<aside class="margin" data-mark="([^"]+)">[\s\S]*?<b class="restored">([\s\S]*?)<\/b>[\s\S]*?<\/aside>/g;

function checkSmudges(e, R) {
  const clean = {}, dirty = {}, notes = [];
  for (const id of GR.BOOK_ORDER) {
    clean[id] = GR.rules.page(R, id, false);
    dirty[id] = GR.rules.page(R, id, true);
    if (/smudge|class="margin"/.test(clean[id])) fail(`edition ${e} ${id}: the clean book is smudged`);
    if (/undefined|NaN|\[object/.test(dirty[id])) fail(`edition ${e} ${id}: smudged page has a broken value`);
    for (const m of dirty[id].matchAll(NOTE)) notes.push({ host: id, mark: m[1], value: m[2] });
  }
  for (const id of GR.BOOK_ORDER) {
    const spans = [...dirty[id].matchAll(SPAN)];
    if (spans.length !== 1) { fail(`edition ${e} ${id}: ${spans.length} smudges on the page`); continue; }
    const mark = spans[0][1];
    const found = notes.filter((n) => n.mark === mark);
    if (found.length !== 1) { fail(`edition ${e} ${id}: ${found.length} margin notes for ${mark}`); continue; }
    if (found[0].host === id) fail(`edition ${e} ${id}: the margin note is on its own page`);
    const body = dirty[id].replace(NOTE, '');
    if (body === clean[id]) fail(`edition ${e} ${id}: nothing was smudged`);
    // Writing the margin's value back over the smudge must give back the exact clean page.
    if (body.replace(spans[0][0], () => found[0].value) !== clean[id]) fail(`edition ${e} ${id}: the margin note does not restore the page`);
    else smudgesChecked++;
  }
}

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
  const d = R.doll;
  if (new Set(d.phrases).size !== d.phrases.length) fail(`edition ${e}: duplicate doll whispers`);
  for (const p of d.phrases) {
    const row = d.table[p];
    if (!row || row.open === row.closed || !DOLL.ACTIONS.includes(row.open) || !DOLL.ACTIONS.includes(row.closed)) fail(`edition ${e}: bad comforts for ${p}`);
  }
  checkSmudges(e, R);
}

// ---- Séances --------------------------------------------------------------
const stats = { candleRule: [0, 0, 0, 0], tarotPos: [0, 0, 0], ouijaDusk: 0, ouija: 0, wins: 0, whispers: 0, dollGames: 0 };

// A perfect Medium soothes the doll the moment it whispers.
function tend(g) {
  const r = g.relics.find((x) => x.needy);
  if (r && r.state.phase === 'whisper' && !g.result) g.attempt(g.relics.indexOf(r), r.def.expected(r.state, g.ctx, g.rules.doll));
}

function dollChecks(seed, edition, difficulty, label) {
  const g = new GR.Game({ seed, edition, difficulty });
  const i = g.relics.findIndex((x) => x.needy);
  if (i < 0) return;
  const r = g.relics[i];
  stats.dollGames++;
  if (r.id !== 'doll' || i !== g.relics.length - 1) fail(`${label}: the doll is not last on the table`);

  // Patient play: answer each whisper after a varying delay inside the window, and check the timing.
  const dt = 0.5;
  let t = 0, started = -1, quietSince = 0, whispers = 0;
  g.on('whisper', () => {
    const gap = t - quietSince;
    const [lo, hi] = whispers === 0 ? [25, 35] : [34, 46];
    if (gap < lo - dt || gap > hi + dt) fail(`${label}: doll whispered after ${gap}s of quiet`);
    started = t;
    whispers++;
  });
  while (t < g.duration - 15 && !g.result) {
    g.tick(dt);
    t += dt;
    if (r.state.phase === 'whisper' && t - started >= (whispers * 7) % 18) {
      const ans = uniqueAnswer(r.def, r.state, g.ctx, g.rules.doll, g.strikes, `${label} doll`);
      if (g.attempt(i, ans) !== 'soothed') fail(`${label}: the book's comfort did not soothe the doll`);
      quietSince = t;
    }
  }
  stats.whispers += whispers;
  if (whispers < 3) fail(`${label}: doll whispered only ${whispers} times`);
  if (g.strikes) fail(`${label}: soothing the doll caused an offense`);
  if (g.result) fail(`${label}: séance ended (${g.result.reason}) with relics still uncleansed`);
  if (r.solved) fail(`${label}: the doll counted as cleansed`);

  // Silence is an offense after exactly the window; touching a quiet doll is not.
  const h = new GR.Game({ seed, edition, difficulty });
  const hr = h.relics[i];
  while (hr.state.phase !== 'whisper') h.tick(1);
  for (let k = 0; k < DOLL.WINDOW - 1; k++) h.tick(1);
  if (h.strikes !== 0 || hr.state.phase !== 'whisper') fail(`${label}: doll stopped whispering early`);
  h.tick(1);
  if (h.strikes !== 1 || hr.state.phase !== 'quiet') fail(`${label}: an ignored whisper was not an offense`);
  if (h.attempt(i, 'ROCK') !== 'quiet' || h.strikes !== 1) fail(`${label}: touching a quiet doll did something`);
  // The wrong comfort is an offense and silences it.
  while (hr.state.phase !== 'whisper') h.tick(1);
  const right = hr.def.expected(hr.state, h.ctx, h.rules.doll);
  if (h.attempt(i, DOLL.ACTIONS.find((a) => a !== right)) !== 'strike' || h.strikes !== 2 || hr.state.phase !== 'quiet') fail(`${label}: the wrong comfort was not an offense`);
}

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
  let ended = null;
  g.on('end', (x) => { ended = x; });
  const rebuilt = new GR.Game({ seed, edition, difficulty });
  if (JSON.stringify(g.ctx) !== JSON.stringify(rebuilt.ctx) || JSON.stringify(g.relics.map((r) => r.state)) !== JSON.stringify(rebuilt.relics.map((r) => r.state))) {
    fail(`${label}: same seed built a different séance`);
  }

  // A perfect Medium, occasionally making a deliberate mistake (strikes change the music box table).
  const mistakes = s % 4 === 0 ? 2 : 0;
  let made = 0;
  g.relics.forEach((r, i) => {
    if (r.needy) return;
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
  const wantNeedy = GR.DIFFICULTY[difficulty].needy;
  if (g.relics.filter((r) => r.needy).length !== wantNeedy) fail(`${label}: expected ${wantNeedy} needy relics`);
  if (ended && ended.total !== GR.DIFFICULTY[difficulty].relics) fail(`${label}: the doll was counted in the cleansed total`);
  dollChecks(seed, edition, difficulty, label);

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
  for (let t = 0; t < slow.duration / 1.25 - 1; t++) { slow.tick(1); tend(slow); }
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
console.log(`doll: ${stats.dollGames} séances, ${(stats.whispers / Math.max(1, stats.dollGames)).toFixed(1)} whispers each (patient play)`);
console.log(`smudged pages restored from the margin: ${smudgesChecked}/${EDITIONS * GR.BOOK_ORDER.length}`);
console.log(fails ? `${fails} FAILURES` : 'ALL CHECKS PASSED');
process.exit(fails ? 1 : 0);

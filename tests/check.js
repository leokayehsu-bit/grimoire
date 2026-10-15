// Headless solver test: node tests/check.js [editions=300] [seances=5000]
// For every edition: every relic's book page builds cleanly, and every smudged book (whole or per level) loses
// exactly one entry per page that exactly one margin note restores.
// For every séance (all 40 levels × 3 difficulties, plus free séances): the level builds the table it promises,
// each relic accepts exactly one input at every step, a perfect Medium wins, running out of offenses loses,
// wrath runs out on time, and every needy relic calls on schedule, has one right answer and punishes silence.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = path.join(__dirname, '..');
const RELIC_FILES = fs.readdirSync(path.join(ROOT, 'js/relics')).filter((f) => f.endsWith('.js')).map((f) => 'relics/' + f.slice(0, -3));
const FILES = ['util', 'seance', 'kit', ...RELIC_FILES, 'rules', 'curses', 'bosses', 'levels', 'game'];
const sandbox = vm.createContext({ console });
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), sandbox, { filename: f + '.js' });
const GR = sandbox.GR;
const { LEVELS, DIFF_ORDER } = GR.levels;

const EDITIONS = +process.argv[2] || 300;
const SEANCES = +process.argv[3] || 5000;
let fails = 0;
const fail = (msg) => { if (++fails <= 30) console.log('FAIL', msg); };
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---- Campaign -------------------------------------------------------------
const ids = Object.keys(GR.relics);
if (LEVELS.length < 30 || LEVELS.length > 50) fail(`${LEVELS.length} levels`);
for (const id of ids) {
  const n = LEVELS.filter((lv) => lv.intro === id).length;
  if (n !== 1) fail(`${id} is introduced ${n} times`);
}
if (GR.BOOK_ORDER.length !== ids.length) fail('the book order is missing relics');
for (const lv of LEVELS) {
  if (!lv.name || !lv.desc || lv.desc.length < 30) fail(`level ${lv.n} needs a name and description`);
  const pages = GR.levels.book(lv.n);
  const pool = pages.filter((id) => !GR.relics[id].needy);
  if (lv.count > pool.length) fail(`level ${lv.n} asks for ${lv.count} relics but only ${pool.length} are known`);
  for (const nd of lv.needy) if (!pages.includes(nd)) fail(`level ${lv.n} uses ${nd} before it is introduced`);
  for (const d of DIFF_ORDER) {
    const t = GR.levels.terms(lv, d);
    if (t.offenses < 1 || t.time < 60 || t.time % 15) fail(`level ${lv.n} ${d}: bad terms ${JSON.stringify(t)}`);
  }
}
{
  const P = GR.levels.progress;
  let p = P.empty();
  if (!P.open(p, 1) || P.open(p, 2) || P.furthest(p) !== 1) fail('fresh progress should open only level 1');
  P.clear(p, 1, 'damned', { time: 100, strikes: 1, candles: 1 });
  if (!P.open(p, 2) || P.open(p, 3) || P.furthest(p) !== 2) fail('clearing level 1 should open level 2 only');
  // Best records: more candles wins, then the faster time; a worse run never replaces a better one.
  if (P.clear(p, 1, 'damned', { time: 90, strikes: 1, candles: 1 }) !== true || P.best(p, 1, 'damned').time !== 90) fail('a faster run should be the new best');
  if (P.clear(p, 1, 'damned', { time: 50, strikes: 2, candles: 1 }) !== true) fail('an even faster run should be the new best');
  if (P.clear(p, 1, 'damned', { time: 140, strikes: 0, candles: 2 }) !== true || P.candles(p, 1, 'damned') !== 2) fail('more candles should beat a faster time');
  if (P.clear(p, 1, 'damned', { time: 30, strikes: 1, candles: 1 }) !== false || P.candles(p, 1, 'damned') !== 2) fail('fewer candles must not replace the best');
  const legacy = { cleared: { 1: { vengeful: true } } };
  if (P.candles(legacy, 1, 'vengeful') !== 1 || !P.open(legacy, 2)) fail('old saves (true) should count as one candle');
  if (P.total(legacy) !== 1 || P.max() !== LEVELS.length * 9) fail('candle totals are wrong');
  const lv = LEVELS[0], lim = GR.levels.terms(lv, 'vengeful').time;
  const R = (time, strikes) => GR.levels.rating(lv, 'vengeful', { time, strikes });
  if (R(lim * 0.6, 0) !== 3 || R(lim * 0.6 + 1, 0) !== 2 || R(10, 1) !== 2 || R(lim, 2) !== 1) fail('candle ratings are wrong');
}
// Curses: each introduced once, after the Library, never used before its introduction, and the same
// séance always gets the same curses (so the Medium and the Scholars agree).
{
  const CI = GR.levels.CURSE_INTRO;
  for (const id of Object.keys(GR.CURSES)) {
    const n = LEVELS.filter((lv) => lv.curseIntro === id).length;
    if (n !== 1 || CI[id] == null) fail(`curse ${id} is introduced ${n} times`);
    if (LEVELS[CI[id] - 1].chapter < 2) fail(`curse ${id} arrives before the Library is finished`);
  }
  for (const lv of LEVELS) {
    for (const c of lv.curses) if (!GR.CURSES[c] || CI[c] > lv.n) fail(`level ${lv.n} uses curse ${c} before it is introduced`);
    if (lv.curseIntro && !lv.curses.includes(lv.curseIntro)) fail(`level ${lv.n} introduces ${lv.curseIntro} without using it`);
    for (const d of DIFF_ORDER) {
      for (const seed of [1, 99, 123456]) {
        const a = GR.levels.cursesFor(lv, d, seed), b = GR.levels.cursesFor(lv, d, seed);
        if (a.join() !== b.join()) fail(`level ${lv.n}: curses are not deterministic`);
        if (new Set(a).size !== a.length) fail(`level ${lv.n}: a curse appears twice`);
        const known = GR.levels.cursesKnown(lv.n);
        for (const c of a) if (!known.includes(c)) fail(`level ${lv.n} ${d}: ${c} has not been met yet`);
        const want = lv.curses.length + (d === 'damned' && known.length > lv.curses.length ? 1 : 0);
        if (a.length !== want) fail(`level ${lv.n} ${d}: ${a.length} curses, expected ${want}`);
      }
    }
  }
  const free = GR.levels.freeLevel(3, 0, 40, 2);
  const fc = GR.levels.cursesFor(free, 'damned', 7);
  if (fc.length !== 3 || new Set(fc).size !== 3) fail('a free séance with 2 curses on Damned should have 3 different curses');
  if (GR.levels.cursesFor(GR.levels.freeLevel(3, 0, 10, 2), 'damned', 7).length) fail('no curses before they are met');
  if (/undefined|NaN/.test(GR.curseFx.page(GR.levels.CURSE_ORDER, ['blackout']))) fail('the Curses page has a broken value');
}

// Bosses end chapters; daily séances are one fixed table per date.
{
  for (const [n, id] of Object.entries(GR.levels.BOSS_LEVELS)) {
    const lv = LEVELS[n - 1];
    if (!GR.BOSSES[id]) fail(`boss ${id} is not defined`);
    if (n % 8 !== 0) fail(`boss ${id} is not on a chapter finale (level ${n})`);
    if (lv.boss !== id) fail(`level ${n} lost its boss`);
    for (const ph of GR.BOSSES[id].phases) if (!(ph.at >= 0 && ph.at < 1) || !['tear', 'scratch', 'turn', 'swap'].includes(ph.ev)) fail(`boss ${id} has a bad phase`);
  }
  const seeds = new Set();
  for (let k = 0; k < 400; k++) {
    const d = new Date(2026, 0, 1 + k), date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const a = GR.levels.dailyLevel(date), b = GR.levels.dailyLevel(date);
    if (JSON.stringify(a) !== JSON.stringify(b)) fail(`daily ${date} is not deterministic`);
    if (a.count < 4 || a.count > 5 || a.edition < 2 || a.edition > 999) fail(`daily ${date} has bad terms`);
    for (const c of a.curses) if (!GR.CURSES[c]) fail(`daily ${date} has an unknown curse`);
    if (GR.levels.cursesFor(a, 'vengeful', a.seed).join() !== a.curses.join()) fail(`daily ${date}: curses changed at play time`);
    seeds.add(a.seed);
  }
  if (seeds.size < 395) fail('daily séances repeat too often');
}

// Epitaphs must stay distinguishable with one word changed.
{
  const E = GR.relics.headstone.EPITAPHS;
  for (let a = 0; a < E.length; a++) for (let b = a + 1; b < E.length; b++) {
    const same = E[a].filter((w, j) => E[b][j] === w).length;
    if (same > 1) fail(`epitaphs ${a + 1} and ${b + 1} share ${same} words in place`);
  }
}

// ---- Smudged grimoire -----------------------------------------------------
const SPAN = /<span class="smudge" data-mark="([^"]+)">[^<]*<\/span>/g;
const NOTE = /<aside class="margin" data-mark="([^"]+)">[\s\S]*?<b class="restored">([\s\S]*?)<\/b>[\s\S]*?<\/aside>/g;
let smudgesChecked = 0;

function checkSmudges(label, R, pages) {
  const sm = GR.rules.smudges(R, pages);
  const clean = {}, dirty = {}, notes = [];
  for (const m of GR.rules.prefaceNotes(sm).matchAll(NOTE)) notes.push({ host: 'preface', mark: m[1], value: m[2] });
  for (const id of pages) {
    clean[id] = GR.rules.page(R, id, null);
    dirty[id] = GR.rules.page(R, id, sm);
    if (/smudge|class="margin"/.test(clean[id])) fail(`${label} ${id}: the clean book is smudged`);
    if (/undefined|NaN|\[object/.test(clean[id] + dirty[id])) fail(`${label} ${id}: page has a broken value`);
    for (const m of dirty[id].matchAll(NOTE)) notes.push({ host: id, mark: m[1], value: m[2] });
  }
  for (const id of pages) {
    const spans = [...dirty[id].matchAll(SPAN)];
    if (spans.length !== 1) { fail(`${label} ${id}: ${spans.length} smudges on the page`); continue; }
    const found = notes.filter((n) => n.mark === spans[0][1]);
    if (found.length !== 1) { fail(`${label} ${id}: ${found.length} margin notes for ${spans[0][1]}`); continue; }
    if (found[0].host === id) fail(`${label} ${id}: the margin note is on its own page`);
    const body = dirty[id].replace(NOTE, '');
    if (body === clean[id]) fail(`${label} ${id}: nothing was smudged`);
    if (body.replace(spans[0][0], () => found[0].value) !== clean[id]) fail(`${label} ${id}: the margin note does not restore the page`);
    else smudgesChecked++;
  }
}

// ---- Editions -------------------------------------------------------------
for (let e = 1; e <= EDITIONS; e++) {
  const R = GR.rules.build(e);
  checkSmudges(`edition ${e}`, R, GR.BOOK_ORDER);
  const lv = LEVELS[e % LEVELS.length];
  checkSmudges(`edition ${e} level ${lv.n}`, R, GR.levels.book(lv.n));
  if (e <= 3) checkSmudges(`edition ${e} level 1`, R, GR.levels.book(1));

  for (let n = 3; n <= 6; n++) {
    const set = R.candles.byCount[n];
    if (set.rules.length !== 3 || set.fallback < 0 || set.fallback >= n) fail(`edition ${e}: candle set ${n} malformed`);
  }
  if (new Set(R.ouija.words).size !== R.ouija.words.length) fail(`edition ${e}: duplicate board words`);
  for (const row of [...R.musicbox.lullaby, ...R.musicbox.dirge]) {
    if ([...row].sort().join() !== [...GR.relics.musicbox.FIGURES].sort().join()) fail(`edition ${e}: music row is not a permutation`);
  }
  if (new Set(R.dollhouse.patterns).size !== 8) fail(`edition ${e}: dollhouse patterns repeat`);
  for (const id of GR.NEEDY_ORDER) {
    const t = R[id].table;
    for (const k of Object.keys(t)) {
      const vals = Object.values(t[k]);
      if (new Set(vals).size !== vals.length) fail(`edition ${e} ${id}: one row gives the same answer twice`);
    }
  }
}

// ---- Séances --------------------------------------------------------------
const stats = { wins: 0, seen: {}, needyGames: 0, calls: 0 };

function uniqueAnswer(def, state, ctx, rules, strikes, label) {
  const ok = def.inputs(state).filter((inp) => def.attempt(clone(state), inp, ctx, rules, strikes) !== 'strike');
  if (ok.length !== 1) fail(`${label}: ${ok.length} accepted inputs (${JSON.stringify(ok).slice(0, 80)})`);
  return ok[0];
}
const wrongInput = (r, g) => r.def.inputs(r.state).find((x) => r.def.attempt(clone(r.state), x, g.ctx, g.rules[r.id], g.strikes) === 'strike');

// A perfect Medium answers every needy relic the moment it calls.
function tend(g) {
  g.relics.forEach((r, i) => {
    if (r.needy && r.state.phase === 'whisper' && !g.result) g.attempt(i, r.def.expected(r.state, g.ctx, g.rules[r.id]));
  });
}

function needyChecks(opts, label) {
  const g = new GR.Game(opts);
  const needyIdx = g.relics.map((r, i) => (r.needy ? i : -1)).filter((i) => i >= 0);
  if (!needyIdx.length) return;
  stats.needyGames++;
  const dt = 0.5;
  let t = 0;
  const track = needyIdx.map((i) => ({ i, quietSince: 0, started: -1, calls: 0 }));
  g.on('whisper', (r) => {
    const tr = track.find((x) => g.relics[x.i] === r);
    const Q = r.def.QUIET || { first: [25, 35], next: [34, 46] };
    const [lo, hi] = tr.calls === 0 ? Q.first : Q.next;
    const gap = t - tr.quietSince;
    if (gap < lo - dt || gap > hi + dt) fail(`${label}: ${r.id} called after ${gap}s of quiet`);
    tr.started = t;
    tr.calls++;
  });
  while (t < g.duration - 15 && !g.result) {
    g.tick(dt);
    t += dt;
    for (const tr of track) {
      const r = g.relics[tr.i];
      if (r.state.phase === 'whisper' && t - tr.started >= (tr.calls * 7) % 18) {
        const ans = uniqueAnswer(r.def, r.state, g.ctx, g.rules[r.id], g.strikes, `${label} ${r.id}`);
        if (g.attempt(tr.i, ans) !== 'soothed') fail(`${label}: the book's answer did not soothe ${r.id}`);
        tr.quietSince = t;
      }
    }
  }
  for (const tr of track) {
    stats.calls += tr.calls;
    if (g.duration > 200 && tr.calls < 2) fail(`${label}: ${g.relics[tr.i].id} called only ${tr.calls} times`);
  }
  if (g.strikes) fail(`${label}: tending needy relics caused an offense`);
  if (g.result) fail(`${label}: séance ended (${g.result.reason}) while only tending`);

  // Silence is an offense after exactly the window; touching a quiet one is not; the wrong answer is an offense.
  for (const i of needyIdx) {
    const h = new GR.Game(opts);
    if (h.maxStrikes < 3) continue;
    const hr = h.relics[i], W = hr.def.WINDOW;
    let guard = 0;
    while (hr.state.phase !== 'whisper' && guard++ < 200) { h.tick(1); h.relics.forEach((x, k) => { if (k !== i && x.needy && x.state.phase === 'whisper') h.attempt(k, x.def.expected(x.state, h.ctx, h.rules[x.id])); }); }
    const s0 = h.strikes;
    for (let k = 0; k < W - 1; k++) h.tick(1);
    if (hr.state.phase !== 'whisper') fail(`${label}: ${hr.id} stopped calling early`);
    h.tick(1);
    if (h.strikes < s0 + 1 || hr.state.phase !== 'quiet') fail(`${label}: an ignored ${hr.id} was not an offense`);
    const s1 = h.strikes;
    if (h.attempt(i, hr.def.inputs()[0]) !== 'quiet' || h.strikes !== s1) fail(`${label}: touching a quiet ${hr.id} did something`);
  }
}

for (let s = 1; s <= SEANCES; s++) {
  const seed = Math.imul(s, 2654435761) >>> 0;
  const edition = 1 + (s % EDITIONS);
  const difficulty = DIFF_ORDER[s % 3];
  const dailyDate = s % 25 === 0 ? `2027-${String(1 + (s % 12)).padStart(2, '0')}-${String(1 + (s % 28)).padStart(2, '0')}` : null;
  const free = !dailyDate && s % 10 === 0 ? { count: 2 + (s % 5), needy: s % 4, upTo: 1 + (s % LEVELS.length) } : null;
  const level = free || dailyDate ? 0 : 1 + (Math.floor(s / 3) % LEVELS.length);
  const dl = dailyDate ? GR.levels.dailyLevel(dailyDate) : null;
  const opts = dl ? { seed: dl.seed, edition: dl.edition, difficulty: 'vengeful', level: 0, free: null, daily: dailyDate } : { seed, edition, difficulty, level, free };
  const label = `seed ${opts.seed} ed ${opts.edition} ${dailyDate ? 'daily ' + dailyDate : free ? 'free' : 'level ' + level} ${opts.difficulty}`;
  const g = new GR.Game(opts);
  let ended = null;
  g.on('end', (x) => { ended = x; });

  const rebuilt = new GR.Game(opts);
  if (JSON.stringify([g.ctx, g.relics.map((r) => [r.id, r.state])]) !== JSON.stringify([rebuilt.ctx, rebuilt.relics.map((r) => [r.id, r.state])])) {
    fail(`${label}: same seed built a different séance`);
  }

  // The table matches the level.
  const lv = g.level;
  const cleansable = g.relics.filter((r) => !r.needy);
  const pool = GR.levels.book(lv.free ? lv.bookUpTo : lv.n).filter((id) => !GR.relics[id].needy);
  if (cleansable.length !== Math.min(lv.count, pool.length)) fail(`${label}: ${cleansable.length} relics, expected ${lv.count}`);
  if (g.relics.filter((r) => r.needy).map((r) => r.id).join() !== lv.needy.join()) fail(`${label}: wrong needy relics`);
  if (!lv.free && lv.intro && !GR.relics[lv.intro].needy && !cleansable.some((r) => r.id === lv.intro)) fail(`${label}: the new relic is missing`);
  for (const r of cleansable) if (!pool.includes(r.id)) fail(`${label}: ${r.id} appears before it is introduced`);
  if (g.maxStrikes !== GR.levels.terms(lv, opts.difficulty).offenses) fail(`${label}: wrong offense limit`);

  // A perfect Medium, sometimes making deliberate mistakes (but never enough to lose).
  const mistakes = s % 4 === 0 ? Math.min(2, g.maxStrikes - 1) : 0;
  let made = 0;
  g.relics.forEach((r, i) => {
    if (r.needy) return;
    stats.seen[r.id] = (stats.seen[r.id] || 0) + 1;
    let guard = 0;
    while (!r.solved && !g.result && guard++ < 50) {
      const ans = uniqueAnswer(r.def, r.state, g.ctx, g.rules[r.id], g.strikes, `${label} ${r.id}`);
      if (made < mistakes) {
        const wrong = wrongInput(r, g);
        if (wrong === undefined || g.attempt(i, wrong) !== 'strike') fail(`${label} ${r.id}: a wrong input was not an offense`);
        made++;
        continue;
      }
      if (g.attempt(i, ans) === 'strike') fail(`${label} ${r.id}: the book's answer was punished`);
    }
    if (!r.solved) fail(`${label} ${r.id}: could not be cleansed`);
  });
  if (!g.result || g.result.result !== 'win') fail(`${label}: perfect play did not win`);
  else stats.wins++;
  if (ended && ended.total !== cleansable.length) fail(`${label}: needy relics counted toward the win`);
  if (ended && ended.level !== (free || dailyDate ? 0 : level)) fail(`${label}: the end report has the wrong level`);
  if (ended && (ended.daily || null) !== dailyDate) fail(`${label}: the end report has the wrong daily date`);

  if (s % 3 === 0) needyChecks(opts, label);

  // Running out of offenses ends the séance.
  const lose = new GR.Game(opts);
  for (let k = 0; k < lose.maxStrikes; k++) {
    const r = lose.relics.find((x) => !x.needy);
    lose.attempt(lose.relics.indexOf(r), wrongInput(r, lose));
  }
  if (!lose.result || lose.result.reason !== 'strikes') fail(`${label}: ${lose.maxStrikes} offenses did not lose`);

  // Wrath runs out on schedule (with one offense it should run 25% faster).
  if (g.maxStrikes > 1) {
    const slow = new GR.Game(opts);
    slow.strikes = 1;
    for (let t = 0; t < slow.duration / 1.25 - 1; t++) { slow.tick(1); tend(slow); }
    if (slow.result) fail(`${label}: wrath ended early (${slow.result.reason})`);
    slow.tick(2);
    if (!slow.result || slow.result.reason !== 'wrath') fail(`${label}: wrath did not end the séance`);
  }
}

console.log(`editions ${EDITIONS}, séances ${SEANCES}, levels ${LEVELS.length}, relics ${ids.length}`);
console.log('relics cleansed: ' + GR.RELIC_ORDER.map((id) => `${id} ${stats.seen[id] || 0}`).join(', '));
console.log(`needy: ${stats.needyGames} séances, ${(stats.calls / Math.max(1, stats.needyGames)).toFixed(1)} calls each (patient play)`);
console.log(`smudged pages restored from the margin: ${smudgesChecked}`);
console.log(`perfect Medium wins: ${stats.wins}/${SEANCES}`);
console.log(fails ? `${fails} FAILURES` : 'ALL CHECKS PASSED');
process.exit(fails ? 1 : 0);

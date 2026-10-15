// The campaign: 40 levels in five chapters. Each level introduces at most one new relic (a new grimoire page),
// and any level can be played at any difficulty, which bends its time limit and offense limit.
(function (G) {
  'use strict';

  const CHAPTERS = [
    { name: 'The Parlour', blurb: "A widow's parlour, where the first séance went wrong." },
    { name: 'The Library', blurb: 'Dust, ink, and books that were never meant to be opened.' },
    { name: 'The Chapel', blurb: 'The house chapel. The candles here were never put out.' },
    { name: 'The Attic', blurb: 'Everything the family wanted to forget, stored where no one goes.' },
    { name: 'The Crypt', blurb: 'Below the house, the spirit is strongest.' },
  ];

  // intro: the relic whose page this level adds to the book. count: relics to cleanse. needy: relics to soothe.
  // time is in seconds and offenses is the allowance, both at Vengeful (the standard difficulty).
  const L = (chapter, name, desc, count, time, offenses, intro, needy) => ({ chapter, name, desc, count, time, offenses, intro: intro || null, needy: needy || [] });
  const LEVELS = [
    L(0, 'First Light', 'A single row of candles flickers on the parlour table. Learn to read the Ritual Candles together before anything else stirs.', 1, 180, 3, 'candles'),
    L(0, 'Wax and Whispers', 'The candles again, but the spirit is less patient now. Less time, and only two mistakes allowed.', 1, 120, 2),
    L(0, 'The Spread', 'Someone left a tarot spread on the side table. The Tarot Spread takes arithmetic — Scholars, sharpen your pencils.', 2, 240, 3, 'tarot'),
    L(0, 'Cards on the Table', 'Candles and cards together. Split the work between your Scholars.', 2, 180, 3),
    L(0, 'The Board Speaks', 'The planchette is moving on its own. Read every letter the Spirit Board spells — some words look alike.', 2, 240, 3, 'ouija'),
    L(0, 'Parlour Games', 'Three relics at once for the first time. Decide who reads which page.', 3, 300, 3),
    L(0, 'The Dollhouse', "A child's dollhouse, its windows lighting up one by one. Describe which windows glow.", 2, 210, 3, 'dollhouse'),
    L(0, "The Widow's Parlour", 'The parlour at full strength. Four relics, and the widow is watching.', 4, 330, 3),

    L(1, 'Locked Away', 'A diary bound shut with a three-dial lock. The symbols on its cover are the key to the code.', 2, 240, 3, 'diary'),
    L(1, 'Marginalia', 'Three relics among the stacks. Work steadily.', 3, 270, 3),
    L(1, 'A Little Night Music', 'A music box plays a tune that grows longer each time. Its translation changes with every mistake you make.', 2, 240, 3, 'musicbox'),
    L(1, 'Overdue', 'Three relics, two mistakes. The librarian does not forgive.', 3, 270, 2),
    L(1, 'For Whom It Tolls', 'A bell with a coloured ribbon tolls on its own. Count every toll and ring it back.', 2, 210, 3, 'bell'),
    L(1, 'Silence in the Stacks', 'Four relics and a ticking clock. Keep your voices low and your answers quick.', 4, 330, 3),
    L(1, 'Playtime', 'A porcelain doll sits in the reading chair. It cannot be cleansed — only soothed when it whispers.', 2, 270, 3, 'doll', ['doll']),
    L(1, 'The Restless Library', 'Four relics while the doll whispers. Someone must always keep an ear on her.', 4, 360, 3, null, ['doll']),

    L(2, 'Through the Glass', 'The chapel mirror shows a word written backwards in the fog. Read it right to left.', 2, 240, 3, 'mirror'),
    L(2, 'Reflections', 'Three relics under the chapel windows — and the candles keep dying. Describe the table while you still can.', 3, 270, 3),
    L(2, 'Here Lies', 'A headstone stands where the altar should be. One word of its epitaph is wrong.', 2, 240, 3, 'headstone'),
    L(2, 'Vespers', 'Evening prayers, three relics, and the doll is back.', 3, 300, 3, null, ['doll']),
    L(2, "The Seer's Ball", 'A crystal ball swirls through colours. Watch which colour comes first and which comes last.', 2, 240, 3, 'crystal'),
    L(2, 'Stained Glass', 'Four relics. Two mistakes. Something in the chapel keeps turning the pages of your book.', 4, 330, 2),
    L(2, 'Lamplighter', 'An old lantern gutters and changes colour. Tend its flame before it goes out.', 2, 270, 3, 'lantern', ['lantern']),
    L(2, 'Midnight Mass', 'Four relics, the doll and the lantern all at once. Divide and conquer.', 4, 390, 3, null, ['doll', 'lantern']),

    L(3, 'The Gramophone', 'A gramophone with a record already on. Set the speed and drop the needle in the right groove.', 2, 240, 3, 'gramophone'),
    L(3, 'Dust and Records', 'An old dressing mirror leans over the table. Everything the Medium sees is backwards.', 3, 270, 3),
    L(3, 'The Pendulum Swings', 'A dowsing pendulum swings over a board. Watch the way it moves.', 2, 240, 3, 'pendulum'),
    L(3, 'Cobwebs', 'Four relics in the attic gloom.', 4, 330, 3),
    L(3, 'Knucklebones', 'Three carved bones, cast like dice. Keep one, and only one.', 2, 210, 3, 'knucklebones'),
    L(3, 'Nobody Plays Up Here', 'Four relics, two mistakes, and the doll has followed you upstairs. Something whispers lies to the Medium.', 4, 330, 2, null, ['doll']),
    L(3, 'Something at the Door', 'Someone is knocking at the attic door. Count the knocks and look at the light beneath it.', 2, 270, 3, 'door', ['door']),
    L(3, 'The Attic Wakes', 'Five relics, the lantern and the door. The whole attic is awake.', 5, 420, 3, null, ['lantern', 'door']),

    L(4, 'Nevermore', 'A raven waits on a coffin lid with something in its beak. It wants an offering.', 2, 240, 3, 'raven'),
    L(4, 'Down the Stair', 'Four relics at the bottom of the crypt stair, where no clock has ever ticked.', 4, 300, 3),
    L(4, 'Lines of Fate', "A pale hand rests on the table, palm up. Read its rings, its lines and its marks.", 2, 240, 3, 'palm'),
    L(4, 'Ossuary', 'Five relics among the bones, and the doll is singing.', 5, 390, 3, null, ['doll']),
    L(4, 'The Circle', 'A broken circle of salt. Seal its gaps in exactly the right order.', 2, 240, 3, 'salt'),
    L(4, 'Bitter Remedies', "The apothecary's shelf. Two ingredients, added in the right order, will quiet the spirit.", 2, 240, 3, 'apothecary'),
    L(4, 'In the Dark', 'The last candle in the crypt is guttering out. Four relics, and only a pool of light to find them by.', 4, 330, 2),
    L(4, 'The Last Séance', 'Six relics. The doll, the lantern and the door. Everything you have learned, all at once.', 6, 480, 3, null, ['doll', 'lantern', 'door']),
  ];
  LEVELS.forEach((lv, i) => { lv.n = i + 1; lv.curses = []; lv.curseIntro = null; });

  // Curses arrive after the Library: each is introduced alone, then mixed into later levels.
  const CURSE_LEVELS = {
    18: ['blackout'], 20: ['blackout'], 22: ['poltergeist'], 24: ['blackout', 'poltergeist'],
    26: ['mirror'], 28: ['poltergeist'], 30: ['lies'], 32: ['mirror', 'blackout'],
    34: ['silent'], 36: ['lies', 'poltergeist'], 39: ['darkness'], 40: ['poltergeist', 'lies', 'darkness'],
  };
  const CURSE_INTRO = { blackout: 18, poltergeist: 22, mirror: 26, lies: 30, silent: 34, darkness: 39 };
  for (const [n, list] of Object.entries(CURSE_LEVELS)) LEVELS[n - 1].curses = list;
  for (const [id, n] of Object.entries(CURSE_INTRO)) LEVELS[n - 1].curseIntro = id;
  const CURSE_ORDER = Object.keys(CURSE_INTRO).sort((a, b) => CURSE_INTRO[a] - CURSE_INTRO[b]);
  const cursesKnown = (upTo) => CURSE_ORDER.filter((id) => CURSE_INTRO[id] <= upTo);

  // Book order = the order relics are introduced. Every relic must be introduced exactly once.
  const INTRO = LEVELS.filter((lv) => lv.intro).map((lv) => lv.intro);
  const introLevel = {};
  LEVELS.forEach((lv) => { if (lv.intro) introLevel[lv.intro] = lv.n; });
  G.BOOK_ORDER = INTRO;
  G.RELIC_ORDER = INTRO.filter((id) => !G.relics[id].needy);
  G.NEEDY_ORDER = INTRO.filter((id) => G.relics[id].needy);

  const DIFFICULTY = {
    restless: { label: 'Restless', time: 1.25, offenses: +1, smudged: false, blurb: 'More time, one extra offense.' },
    vengeful: { label: 'Vengeful', time: 1, offenses: 0, smudged: false, blurb: 'The séance as written.' },
    damned: { label: 'Damned', time: 0.8, offenses: -1, smudged: true, blurb: 'Less time, one fewer offense, and the grimoire is smudged.' },
  };
  const DIFF_ORDER = ['restless', 'vengeful', 'damned'];

  const round15 = (s) => Math.max(60, Math.round(s / 15) * 15);
  const isNeedy = (id) => !!G.relics[id].needy;

  // Pages in the book once `upTo` levels are open: every relic introduced so far, in introduction order.
  function book(upTo) {
    return INTRO.filter((id) => introLevel[id] <= upTo);
  }

  // A free séance draws on everything introduced up to the host's furthest open level.
  function freeLevel(count, needyCount, upTo, curseCount = 0) {
    const avail = book(upTo);
    const cleansable = avail.filter((id) => !isNeedy(id));
    const needyAvail = avail.filter(isNeedy);
    const c = Math.max(1, Math.min(count, cleansable.length));
    const nd = needyAvail.slice(0, Math.max(0, Math.min(needyCount, needyAvail.length)));
    return {
      n: 0, free: true, chapter: -1, name: 'Free Séance',
      desc: 'Any relics you have met so far, drawn at random.',
      count: c, time: round15(60 + 70 * c + 30 * nd.length), offenses: 3, intro: null, needy: nd, bookUpTo: upTo,
      curses: [], freeCurses: Math.max(0, Math.min(curseCount, cursesKnown(upTo).length)), curseIntro: null,
    };
  }

  // The curses haunting a séance: the level's own (or random ones you've met, for a free séance),
  // plus one more on Damned. Chosen from the seed, so the Medium and the Scholars always agree.
  function cursesFor(lv, difficulty, seed) {
    const known = cursesKnown(lv.free ? lv.bookUpTo : lv.n);
    const pick = (list, salt) => list[G.util.hash(`curse/${seed}/${salt}`) % list.length];
    const out = lv.free ? [] : lv.curses.slice();
    for (let k = 0; k < (lv.freeCurses || 0); k++) out.push(pick(known.filter((id) => !out.includes(id)), 'free' + k));
    if (difficulty === 'damned') {
      const extra = known.filter((id) => !out.includes(id));
      if (extra.length) out.push(pick(extra, 'damned'));
    }
    return out;
  }

  // What a level looks like at a difficulty: the numbers shown on its card.
  function terms(lv, difficulty) {
    const d = DIFFICULTY[difficulty] || DIFFICULTY.vengeful;
    return { time: round15(lv.time * d.time), offenses: Math.max(1, lv.offenses + d.offenses), smudged: d.smudged };
  }

  // The concrete séance: which relics sit on the table. New relics (this level's and the previous level's)
  // are always included so they get practice.
  function plan(lv, difficulty, rng) {
    const upTo = lv.free ? lv.bookUpTo : lv.n;
    const pages = book(upTo);
    const pool = pages.filter((id) => !isNeedy(id));
    const must = [];
    if (!lv.free) {
      for (const k of [lv.n, lv.n - 1]) {
        const prev = LEVELS[k - 1];
        if (prev && prev.intro && !isNeedy(prev.intro) && !must.includes(prev.intro)) must.push(prev.intro);
      }
    }
    const count = Math.min(lv.count, pool.length);
    const chosen = must.slice(0, count);
    const rest = rng.shuffle(pool.filter((id) => !chosen.includes(id)));
    while (chosen.length < count) chosen.push(rest.shift());
    const t = terms(lv, difficulty);
    return { relics: rng.shuffle(chosen), needy: lv.needy.slice(), time: t.time, offenses: t.offenses, smudged: t.smudged, pages };
  }

  // Progress lives in each browser: { cleared: { [n]: { restless, vengeful, damned } } }.
  // Candles for a win: one for cleansing the table, one for no offenses, one for finishing with
  // at least 40% of the time limit to spare.
  const FAST = 0.6;
  function rating(lv, difficulty, { time, strikes }) {
    const limit = terms(lv, difficulty).time;
    return 1 + (strikes === 0 ? 1 : 0) + (time <= limit * FAST ? 1 : 0);
  }
  const fastTime = (lv, difficulty) => Math.floor(terms(lv, difficulty).time * FAST);

  // The better of two records: more candles, then the faster time.
  const better = (a, b) => (!b || a.candles > b.candles || (a.candles === b.candles && a.time < b.time));

  // Progress lives in each browser: { cleared: { [n]: { [difficulty]: true | { time, strikes, candles } } } }.
  // `true` is a clear from before ratings existed.
  const progress = {
    open(p, n) { return n === 1 || !!(p.cleared[n - 1] && DIFF_ORDER.some((d) => p.cleared[n - 1][d])); },
    furthest(p) { let n = 1; while (n < LEVELS.length && progress.open(p, n + 1)) n++; return n; },
    // Record a win; returns true if it beat the previous best.
    clear(p, n, difficulty, rec) {
      const prev = progress.best(p, n, difficulty);
      const improved = !!rec && better(rec, prev);
      const keep = improved ? { time: rec.time, strikes: rec.strikes, candles: rec.candles } : (p.cleared[n] && p.cleared[n][difficulty]) || true;
      p.cleared[n] = Object.assign({}, p.cleared[n], { [difficulty]: keep });
      return improved;
    },
    best(p, n, difficulty) {
      const r = p.cleared[n] && p.cleared[n][difficulty];
      return r && typeof r === 'object' ? r : null;
    },
    candles(p, n, difficulty) {
      const r = p.cleared[n] && p.cleared[n][difficulty];
      return !r ? 0 : r === true ? 1 : r.candles;
    },
    total(p) {
      let sum = 0;
      for (const lv of LEVELS) for (const d of DIFF_ORDER) sum += progress.candles(p, lv.n, d);
      return sum;
    },
    max: () => LEVELS.length * DIFF_ORDER.length * 3,
    empty: () => ({ cleared: {} }),
    all: () => ({ cleared: Object.fromEntries(LEVELS.map((lv) => [lv.n, { vengeful: true }])) }),
  };

  function get(n) { return LEVELS[n - 1] || null; }

  G.levels = { CHAPTERS, LEVELS, INTRO, introLevel, DIFFICULTY, DIFF_ORDER, book, freeLevel, terms, plan, progress, get, round15, rating, fastTime, cursesFor, cursesKnown, CURSE_INTRO, CURSE_ORDER };
})(globalThis.GR = globalThis.GR || {});

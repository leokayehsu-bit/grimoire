// Bosses: the spirit that ends each chapter, with a twist that strikes at set points of the wrath.
// Every twist is fair: nothing is ever lost, only moved, hidden or turned — always recoverable by talking.
//   tear    — a Scholar page is torn out; the Medium gets it and must read it aloud (until that relic is cleansed)
//   scratch — the Scholars' page titles are scratched away and the tabs shuffled; pages are found by content
//   turn    — the Medium's table is turned upside down; the book still means the real left, right, top, bottom
//   swap    — the Medium's nameplates are swapped between relics; describe what you see, not the label
(function (G) {
  'use strict';
  const { el, esc } = G.util;

  const BOSSES = {
    widow: {
      name: 'The Widow', title: 'Mistress of the Parlour', glyph: '🖤',
      desc: 'When her wrath stirs, she tears a page from the Scholars’ grimoire and leaves it on the Medium’s table. Until that relic is cleansed, the Medium must read its page aloud.',
      phases: [{ at: 0.3, ev: 'tear' }],
    },
    librarian: {
      name: 'The Librarian', title: 'Keeper of the Stacks', glyph: '📚',
      desc: 'A quarter of the way in, every title in the Scholars’ grimoire is scratched away and the pages are shuffled. Find each page by what it says.',
      phases: [{ at: 0.25, ev: 'scratch' }],
    },
    abbess: {
      name: 'The Abbess', title: 'She Who Keeps Vigil', glyph: '✝️',
      desc: 'Partway through the mass, she turns the Medium’s table upside down. The grimoire still means the real left and right, top and bottom.',
      phases: [{ at: 0.4, ev: 'turn' }],
    },
    collector: {
      name: 'The Collector', title: 'Hoarder of the Attic', glyph: '🗝️',
      desc: 'Every nameplate on the Medium’s table has been swapped. Describe each relic by what it looks like — the labels lie.',
      phases: [{ at: 0, ev: 'swap' }],
    },
    unbound: {
      name: 'The Spirit Unbound', title: 'It Remembers You', glyph: '👁️',
      desc: 'Everything its servants did, one after another: the titles are scratched away, then a page is torn out, then the table is turned.',
      phases: [{ at: 0.2, ev: 'scratch' }, { at: 0.45, ev: 'tear' }, { at: 0.7, ev: 'turn' }],
    },
  };

  const ANNOUNCE = {
    tear: (b) => `${b.name} tears a page from the grimoire!`,
    scratch: (b) => `${b.name} scratches out every title in the book!`,
    turn: (b) => `${b.name} turns the table over!`,
    swap: (b) => `${b.name} has swapped every nameplate!`,
  };

  // A big centred banner over everything, for the intro and for each twist.
  function banner(text, sub, cls = '') {
    const b = el('div', 'boss-banner ' + cls);
    b.innerHTML = `<div class="bb-inner"><h2>${esc(text)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;
    document.body.appendChild(b);
    setTimeout(() => b.classList.add('out'), cls === 'intro' ? 2600 : 2400);
    setTimeout(() => b.remove(), cls === 'intro' ? 3300 : 3000);
  }

  function intro(id, audio) {
    const b = BOSSES[id];
    if (!b) return;
    banner(b.name, `${b.title} — ${b.desc}`, 'intro');
    if (audio) audio.bossIntro();
  }

  function announce(id, ev, audio) {
    banner(ANNOUNCE[ev](BOSSES[id]), null, 'event');
    if (audio) audio.stinger(1);
  }

  // ---- Medium ---------------------------------------------------------------
  // Owns the timing (it has the real wrath) and decides which page is torn; status() reports it to Scholars.
  function medium(root, id, { game, audio, rules }) {
    const boss = BOSSES[id];
    if (!boss) return { update() {}, status: () => ({}), destroy() {} };
    const fired = new Set();
    const rng = G.util.makeRng((game.seed ^ 0xB055) >>> 0);
    let torn = null, tornPanel = null;
    const panelOf = (r) => root.querySelector('.relic-' + r.id);

    function tear() {
      const open = game.relics.filter((r) => !r.needy && !r.solved);
      if (!open.length) return false;
      const r = rng.pick(open);
      torn = r.id;
      tornPanel = el('section', 'torn-page');
      tornPanel.innerHTML = `<header><span class="tp-tag">✂ Torn from the grimoire — read it aloud to the Scholars</span></header>
        <article class="page"><h2>${esc(r.title)}</h2>${G.rules.page(rules, r.id, null)}</article>`;
      root.querySelector('.seance-table').before(tornPanel);
      return true;
    }

    function swap() {
      const plates = game.relics.filter((r) => !r.needy).map((r) => panelOf(r).querySelector('header h3'));
      if (plates.length < 2) return;
      const names = plates.map((h) => h.textContent);
      // Rotate by one so no relic keeps its own name.
      plates.forEach((h, i) => { h.textContent = names[(i + 1) % names.length]; h.classList.add('swapped'); });
    }

    function fire(ev) {
      if (ev === 'tear' && !tear()) return;
      if (ev === 'turn') root.classList.add('boss-turned');
      if (ev === 'swap') swap();
      announce(id, ev, audio);
    }

    return {
      update() {
        for (const [i, ph] of boss.phases.entries()) {
          if (!fired.has(i) && game.wrath >= ph.at && !game.result) { fired.add(i); fire(ph.ev); }
        }
        // The torn page returns to the book once its relic is cleansed.
        if (torn && game.relics.find((r) => r.id === torn).solved) {
          torn = null;
          if (tornPanel) { tornPanel.classList.add('mended'); setTimeout(() => tornPanel && tornPanel.remove(), 900); }
        }
      },
      status: () => ({ torn, bossFired: [...fired] }),
      destroy() { root.classList.remove('boss-turned'); if (tornPanel) tornPanel.remove(); },
    };
  }

  // ---- Scholars ---------------------------------------------------------------
  // Follows the Medium's status: the wrath for timing, `torn` for which page is gone.
  function scholar(root, id, { audio, book }) {
    const boss = BOSSES[id];
    if (!boss) return { status() {}, destroy() {} };
    const seen = new Set();
    let tornNow = null;
    return {
      status(s) {
        const fired = s.bossFired || [];
        for (const i of fired) {
          if (seen.has(i)) continue;
          seen.add(i);
          const ev = boss.phases[i].ev;
          if (ev === 'scratch') book.scratch();
          announce(id, ev, audio);
        }
        if ((s.torn || null) !== tornNow) {
          tornNow = s.torn || null;
          book.tear(tornNow);
        }
      },
      destroy() {},
    };
  }

  // The boss's entry in the grimoire's Curses page.
  const page = (id) => {
    const b = BOSSES[id];
    return b ? `<h3>${b.glyph} ${b.name} <span class="curse-active">boss of this séance</span></h3><p>${b.desc}</p>` : '';
  };

  G.BOSSES = BOSSES;
  G.bosses = { medium, scholar, intro, page };
})(globalThis.GR = globalThis.GR || {});

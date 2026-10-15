// Curses: twists on how a séance plays. They never change the rules or the answers — only what the
// players can see — so they live entirely in the views. Levels name them (js/levels.js).
(function (G) {
  'use strict';
  const { el } = G.util;

  const CURSES = {
    blackout: {
      name: 'Blackout', who: 'Medium', glyph: '🕯️',
      desc: 'Every so often every candle in the room dies at once and the Medium is left in the dark for a few seconds. Relics still work in the dark — if you remember where they are.',
      tip: 'Medium: describe the table early. Scholars: keep notes of what you are told.',
    },
    poltergeist: {
      name: 'Poltergeist', who: 'Scholars', glyph: '📖',
      desc: 'Something unseen flips the Scholars’ grimoire to a random page now and then.',
      tip: 'Scholars: remember which page you were on.',
    },
    mirror: {
      name: 'Looking-Glass', who: 'Medium', glyph: '🪞',
      desc: 'The Medium sees the whole table as a reflection: left is right and words read backwards. The grimoire still means the real left and right, so the Medium must flip everything they see.',
      tip: 'Medium: the candle you see on the far right is the first candle.',
    },
    lies: {
      name: 'Lying Whispers', who: 'Medium', glyph: '👄',
      desc: 'False instructions drift across the Medium’s table. The spirit is lying: only the Scholars’ words can be trusted.',
      tip: 'Medium: ignore anything the table tells you.',
    },
    silent: {
      name: 'Silent Hour', who: 'Medium', glyph: '⌛',
      desc: 'The Medium’s timer and wrath meter vanish. Nobody at the table knows how long is left — only the music and the darkness closing in.',
      tip: 'Everyone: listen to the heartbeat.',
    },
    darkness: {
      name: 'Darkness', who: 'Medium', glyph: '🌑',
      desc: 'The table is pitch black except a small pool of candlelight that follows the Medium’s hand. Search the table piece by piece.',
      tip: 'Medium: sweep the light across the whole table before you start.',
    },
  };

  // ---- Medium-side effects ----------------------------------------------------
  // Returns { destroy }. rng: a seeded random source so timings differ every séance.
  function medium(root, curses, { audio, game, rng }) {
    const stops = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); stops.push(() => clearTimeout(t)); };
    const alive = () => !game.result && root.isConnected;

    if (curses.includes('mirror')) {
      root.classList.add('curse-mirror');
      stops.push(() => root.classList.remove('curse-mirror'));
    }

    if (curses.includes('silent')) {
      root.classList.add('curse-silent');
      stops.push(() => root.classList.remove('curse-silent'));
    }

    if (curses.includes('darkness')) {
      const dark = el('div', 'curse-darkness');
      root.appendChild(dark);
      root.classList.add('curse-dark');
      const move = (e) => { dark.style.setProperty('--x', e.clientX + 'px'); dark.style.setProperty('--y', e.clientY + 'px'); };
      dark.style.setProperty('--x', '50vw');
      dark.style.setProperty('--y', '55vh');
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerdown', move);
      stops.push(() => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', move); dark.remove(); root.classList.remove('curse-dark'); });
    }

    if (curses.includes('blackout')) {
      const black = el('div', 'curse-blackout');
      black.innerHTML = '<span>The candles die…</span>';
      root.appendChild(black);
      const cycle = () => {
        if (!alive()) return;
        black.classList.add('on');
        audio.snuff();
        later(() => { black.classList.remove('on'); if (alive()) audio.relight(); later(cycle, 1000 * (26 + rng.next() * 18)); }, 1000 * (3.5 + rng.next() * 2.5));
      };
      later(cycle, 1000 * (14 + rng.next() * 12));
      stops.push(() => black.remove());
    }

    if (curses.includes('lies')) {
      const titles = game.relics.filter((r) => !r.needy).map((r) => r.title);
      const LIES = [
        'Snuff the second candle…', 'Burn the left card…', 'It is the red one…', 'Answer “Goodbye”…', 'Press the thumb…',
        'Trust me. Not them.', 'Touch the mouth…', 'The book is wrong…', 'Ring it three times…', 'The code is 4 1 7…',
        'Knock on the centre…', 'Keep the middle bone…', 'It says the left…', 'They are lying to you…',
      ].concat(titles.map((t) => `The ${t.toLowerCase().replace(/^the /, '')} is already safe…`));
      const say = () => {
        if (!alive()) return;
        const w = el('div', 'curse-lie', LIES[Math.floor(rng.next() * LIES.length)]);
        w.style.left = (8 + rng.next() * 62) + '%';
        w.style.top = (25 + rng.next() * 60) + '%';
        root.appendChild(w);
        audio.whisper(0.55);
        later(() => w.remove(), 4200);
        later(say, 1000 * (14 + rng.next() * 14));
      };
      later(say, 1000 * (8 + rng.next() * 8));
      stops.push(() => root.querySelectorAll('.curse-lie').forEach((n) => n.remove()));
    }

    return { destroy: () => stops.splice(0).forEach((f) => f()) };
  }

  // ---- Scholar-side effects ---------------------------------------------------
  function scholar(root, curses, { audio, book, pages }) {
    const stops = [];
    if (curses.includes('poltergeist')) {
      let t = null;
      const flip = () => {
        const ids = ['preface'].concat(pages).filter((id) => id !== book.current());
        const id = ids[Math.floor(Math.random() * ids.length)];
        audio.pageTurn();
        audio.whisper(0.4);
        book.open(id);
        const note = el('div', 'curse-flip', 'The pages turn on their own…');
        root.appendChild(note);
        root.classList.remove('shake');
        void root.offsetWidth;
        root.classList.add('shake');
        setTimeout(() => note.remove(), 2600);
        t = setTimeout(flip, 1000 * (32 + Math.random() * 22));
      };
      t = setTimeout(flip, 1000 * (20 + Math.random() * 15));
      stops.push(() => clearTimeout(t));
    }
    return { destroy: () => stops.splice(0).forEach((f) => f()) };
  }

  // A grimoire page describing the curses met so far (and which ones haunt this séance).
  function page(ids, active = []) {
    if (!ids.length) return '';
    return `<p class="lead">Some séances are cursed. A curse never changes the rules in this book — it changes what you can see.
      The level tells you which curses haunt it, and a Damned séance always brings one more.</p>` +
      ids.map((id) => {
        const c = CURSES[id];
        return `<h3>${c.glyph} ${c.name}${active.includes(id) ? ' <span class="curse-active">haunting this séance</span>' : ''}</h3>
          <p>${c.desc} <em>Affects the ${c.who}.</em></p><p class="note">${c.tip}</p>`;
      }).join('');
  }

  G.CURSES = CURSES;
  G.curseFx = { medium, scholar, page };
})(globalThis.GR = globalThis.GR || {});

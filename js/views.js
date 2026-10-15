// The two screens of a séance: the Medium's table and the Scholars' grimoire.
(function (G) {
  'use strict';
  const { el, esc, title, NUMWORD } = G.util;

  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  // The Medium sees the wrath meter, the time and how many relics are cleansed. Scholars see only the
  // offenses (the Music Box page needs them); they feel the wrath through the vignette, its pulse and the music.
  function statusBar({ scholar = false } = {}) {
    const bar = el('div', 'status-bar' + (scholar ? ' scholar' : ''));
    bar.innerHTML = scholar
      ? `<div class="strikes" title="Offenses"></div>
         <span class="scholar-note">You cannot see the table — ask the Medium what is on it.</span>`
      : `<div class="wrath"><span class="label">Wrath</span><div class="meter"><div class="fill"></div></div><span class="time">–:––</span></div>
         <div class="strikes" title="Offenses"></div>
         <div class="cleansed"></div>`;
    const fill = bar.querySelector('.fill'), time = bar.querySelector('.time');
    const strikes = bar.querySelector('.strikes'), cleansed = bar.querySelector('.cleansed');
    let lastStrikes = -1;
    function update(s) {
      if (fill) fill.style.width = (s.wrath * 100).toFixed(1) + '%';
      if (time) time.textContent = fmt(s.remaining);
      if (s.strikes !== lastStrikes) {
        strikes.innerHTML = '<span class="label">Offenses</span>' +
          Array.from({ length: s.maxStrikes }, (_, i) => `<span class="mark ${i < s.strikes ? 'on' : ''}">✕</span>`).join('');
        lastStrikes = s.strikes;
      }
      if (cleansed) {
        const cleansable = s.relics.filter((r) => !r.needy);
        cleansed.textContent = `${cleansable.filter((r) => r.solved).length} / ${cleansable.length} cleansed`;
      }
      document.body.style.setProperty('--wrath', s.wrath.toFixed(3));
      // The vignette throbs like a pulse, quicker as the wrath rises (and quicker still near the end).
      const urgency = Math.min(1, s.wrath + (s.remaining <= 15 ? 0.3 : 0));
      document.body.style.setProperty('--pulse', (2.8 - 2.1 * urgency).toFixed(2) + 's');
    }
    return { el: bar, update };
  }

  function contextStrip(ctx) {
    const strip = el('div', 'seance-ctx');
    strip.innerHTML = `
      <div class="ctx plaque"><span class="cap">Here lies</span><b>${esc(ctx.name)}</b><span class="year">✝ ${ctx.deathYear}</span></div>
      <div class="ctx moonwin"><div class="pane">${G.seance.moonSVG(ctx.moon, 58)}</div><span class="cap">Through the window</span></div>
      <div class="ctx bones"><div class="charms">${'<span class="charm"><i></i>🦴</span>'.repeat(ctx.bones)}</div><span class="cap">Hanging above</span></div>
      <div class="ctx sigils"><div class="carved">${ctx.sigils.map((s) =>
        `<span class="sigil"><b>${G.seance.SIGIL_GLYPH[s]}</b><small>${title(s)}</small></span>`).join('')}</div><span class="cap">Carved into the table</span></div>`;
    return strip;
  }

  // ---- Medium ---------------------------------------------------------------
  function seance(root, game, audio) {
    root.innerHTML = '';
    const sb = statusBar();
    root.appendChild(sb.el);
    root.appendChild(el('p', 'role-hint', 'You are the Medium. Describe everything you see — you may not read the grimoire.'));
    if (game.curses.length || game.boss) root.appendChild(curseChips(game.curses, game.boss));
    // The séance table: a wooden top lit by candles from above, with the relics laid out on it.
    const table = el('div', 'seance-table');
    table.innerHTML = '<div class="table-glow" aria-hidden="true"></div>';
    const motes = dust(table);
    table.appendChild(contextStrip(game.ctx));
    const grid = el('div', 'relics');
    table.appendChild(grid);
    root.appendChild(table);

    const handles = game.relics.map((r, i) => {
      const panel = el('section', 'relic relic-' + r.id + (r.needy ? ' needy' : ''));
      panel.innerHTML = `<header><h3>${r.title}</h3>${r.needy ? '<span class="needy-tag">Soothe only</span>' : '<span class="seal">Cleansed</span>'}</header>`;
      const body = el('div', 'relic-body');
      panel.appendChild(body);
      grid.appendChild(panel);
      const api = {
        ctx: game.ctx,
        rules: game.rules[r.id],
        audio,
        strikes: () => game.strikes,
        solved: () => r.solved || !!game.result,
        attempt: (input) => game.attempt(i, input),
      };
      return { panel, h: r.def.render(body, r.state, api) || {} };
    });

    const fx = G.curseFx.medium(root, game.curses, { audio, game, rng: G.util.makeRng((game.seed ^ 0x5EA7) >>> 0) });
    const boss = G.bosses.medium(root, game.boss, { game, audio, rules: game.rules });

    game.on('strike', () => {
      audio.strike();
      root.classList.remove('shake');
      void root.offsetWidth;
      root.classList.add('shake');
    });
    game.on('solve', (r) => {
      audio.solve();
      handles[game.relics.indexOf(r)].panel.classList.add('solved');
    });

    return {
      extraStatus: () => boss.status(),
      update: () => {
        boss.update();
        sb.update(game.status());
        handles.forEach((x) => x.h.update && x.h.update());
      },
      destroy: () => { fx.destroy(); boss.destroy(); motes.stop(); handles.forEach((x) => x.h.destroy && x.h.destroy()); root.innerHTML = ''; root.classList.remove('shake'); },
    };
  }

  // Dust drifting through the candlelight: a light canvas behind the relics.
  function dust(host) {
    const c = el('canvas', 'dust');
    c.setAttribute('aria-hidden', 'true');
    host.appendChild(c);
    const g = c.getContext('2d');
    const motes = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.6, vx: (Math.random() - 0.5) * 0.008, vy: -0.004 - Math.random() * 0.01, p: Math.random() * 6.28 }));
    let raf = 0, last = performance.now(), w = 0, h = 0;
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (c.clientWidth !== w || c.clientHeight !== h) { w = c.width = c.clientWidth; h = c.height = c.clientHeight; }
      g.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.p += dt * 0.8;
        m.x += (m.vx + Math.sin(m.p) * 0.004) * dt;
        m.y += m.vy * dt;
        if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
        if (m.x < 0) m.x += 1; else if (m.x > 1) m.x -= 1;
        // Brighter near the candlelight at the top centre.
        const lit = Math.max(0, 1 - Math.hypot(m.x - 0.5, m.y * 1.3) * 1.2);
        g.fillStyle = `rgba(255, 220, 160, ${0.08 + 0.35 * lit})`;
        g.beginPath();
        g.arc(m.x * w, m.y * h, m.r, 0, 6.283);
        g.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return { stop: () => cancelAnimationFrame(raf) };
  }

  function curseChips(ids, boss = null) {
    const row = el('div', 'curse-row');
    const b = boss && G.BOSSES[boss];
    row.innerHTML = (b ? `<span class="boss-chip" title="${esc(b.desc)}">${b.glyph} ${b.name}</span>` : '') +
      (ids.length ? '<span class="label">Cursed</span>' : '') +
      ids.map((id) => `<span class="curse-chip" title="${esc(G.CURSES[id].desc)}">${G.CURSES[id].glyph} ${G.CURSES[id].name}</span>`).join('');
    return row;
  }

  // ---- Scholars -------------------------------------------------------------
  function preface(rules, sm) {
    const moons = G.seance.MOONS.map((m) => `<figure>${G.seance.moonSVG(m, 44)}<figcaption>${title(m)}</figcaption></figure>`).join('');
    const sigils = G.seance.SIGILS.map((s) => `<li><span class="g">${G.seance.SIGIL_GLYPH[s]}</span> the ${title(s)}</li>`).join('');
    return `<p class="lead">You hold the grimoire. Your Medium sits at a séance table with cursed relics they cannot understand.
      You cannot see the table; they cannot read this book. Ask them questions, find the right passage, and tell them what to do.</p>
      <h3>The séance table</h3>
      <p>Many passages ask about the table itself. Have the Medium describe:</p>
      <ul>
        <li><b>The plaque</b> — the spirit's name and the year they died. Vowels are A, E, I, O and U; Y never counts.</li>
        <li><b>The moon</b> through the window. Its phase is one of:</li>
      </ul>
      <div class="moons">${moons}</div>
      <ul>
        <li><b>Bone charms</b> hanging above the table — count them.</li>
        <li><b>Sigils</b> carved into the table. There are five kinds:<ul class="sigil-list">${sigils}</ul></li>
      </ul>
      <h3>Offenses</h3>
      <p>Each mistake is an offense. The spirit's wrath rises faster after every offense, and when the séance's offenses run out it ends.
      If the wrath fills before every relic is cleansed, the séance is lost.</p>
      ${sm ? `<h3>Smudged ink</h3>
      <p>Damp has got into this copy. On every relic page, one entry has run and left only a sign such as
      <span class="smudge" data-mark="☿">☿</span>. Another Scholar pencilled each lost entry into the margin of
      a <em>different</em> page under the same sign — find it before you guess.</p>` : ''}
      <p class="note">This is edition ${rules.edition} of the grimoire.</p>${G.rules.prefaceNotes(sm)}`;
  }

  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

  // The book itself: page tabs plus the open page. Shared by the séance and the study screen.
  // pages: relic ids in the book; locked: ids shown as locked tabs; fresh: ids marked New.
  function book(rules, { pages = G.BOOK_ORDER, smudged = false, locked = [], fresh = [], startId = 'preface', curses = [], activeCurses = [], boss = null } = {}) {
    const wrap = el('div', 'book');
    const tabs = el('nav', 'tabs');
    const page = el('article', 'page');
    wrap.append(tabs, page);

    const sm = smudged ? G.rules.smudges(rules, pages) : null;
    const entries = [{ id: 'preface', title: 'Preface', html: () => preface(rules, sm) }]
      .concat(curses.length || boss ? [{ id: 'curses', title: boss ? 'Curses & the boss' : 'Curses', html: () => (boss ? G.bosses.page(boss) : '') + G.curseFx.page(curses, activeCurses), fresh: boss || activeCurses.some((c) => fresh.includes(c)) }] : [])
      .concat(pages.map((id) => ({ id, title: G.relics[id].title, html: () => G.rules.page(rules, id, sm), fresh: fresh.includes(id) })));
    const tabBtns = {};
    for (const p of entries) {
      const b = el('button', 'tab' + (p.fresh ? ' fresh' : ''), p.title);
      b.type = 'button';
      if (p.fresh) b.appendChild(el('span', 'new-tag', 'New'));
      b.addEventListener('click', () => { if (G.audio) G.audio.pageTurn(); open(p.id); });
      tabs.appendChild(b);
      tabBtns[p.id] = b;
    }
    for (const id of locked) {
      const b = el('button', 'tab locked', `🔒 Level ${G.levels.introLevel[id]}`);
      b.type = 'button';
      b.disabled = true;
      b.title = 'Reach this level to unlock its page';
      tabs.appendChild(b);
    }
    let current = null, scratched = false, torn = null;
    const isRelic = (id) => pages.includes(id);
    function open(id) {
      const p = entries.find((x) => x.id === id) || entries[0];
      current = p.id;
      const head = scratched && isRelic(p.id) ? '<h2 class="scratched" aria-label="A title scratched away">▒▒▒▒▒▒▒▒</h2>' : `<h2>${p.title}</h2>`;
      const body = p.id === torn
        ? `<div class="torn-notice"><p class="tn-big">✂ This page has been torn out.</p>
             <p>The spirit left it on the Medium's table. Ask the Medium to read it to you — every word.
             It returns to the book once this relic is cleansed.</p></div>`
        : p.html();
      page.innerHTML = `${head}${body}<p class="edition">Grimoire · edition ${rules.edition}${smudged ? ' · smudged copy' : ''}</p>`;
      for (const k in tabBtns) tabBtns[k].classList.toggle('active', k === p.id);
      page.scrollTop = 0;
    }
    // Boss: every relic title scratched away and the relic tabs shuffled (pages are found by content).
    function scratch() {
      if (scratched) return;
      scratched = true;
      const relicTabs = pages.map((id) => tabBtns[id]).filter(Boolean);
      const after = relicTabs.length ? relicTabs[relicTabs.length - 1].nextSibling : null; // the locked tabs, if any
      const shuffled = relicTabs.map((t) => [Math.random(), t]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
      shuffled.forEach((t, i) => {
        t.textContent = `Page ${ROMAN[i] || i + 1}`;
        t.classList.add('scratched-tab');
        t.classList.remove('fresh');
        tabs.insertBefore(t, after);
      });
      open(current);
    }
    // Boss: one relic page torn out (null puts it back).
    function tear(id) {
      if (torn && tabBtns[torn]) tabBtns[torn].classList.remove('torn');
      torn = id && tabBtns[id] ? id : null;
      if (torn) tabBtns[torn].classList.add('torn');
      if (current === torn || (!torn && current)) open(current);
    }
    open(startId);
    return { el: wrap, open, current: () => current, scratch, tear };
  }

  // The Scholars' screen during a séance. `level` adds a banner with its name and rules.
  function grimoire(root, rules, { smudged = false, pages, fresh = [], banner = '', curses = [], activeCurses = [], boss = null } = {}) {
    root.innerHTML = '';
    const sb = statusBar({ scholar: true });
    root.appendChild(sb.el);
    if (banner) { const b = el('div', 'level-banner'); b.innerHTML = banner; root.appendChild(b); }
    if (activeCurses.length || boss) root.appendChild(curseChips(activeCurses, boss));
    const bk = book(rules, { pages, smudged, fresh, curses, activeCurses, boss });
    root.appendChild(bk.el);
    const bossFx = G.bosses.scholar(root, boss, { audio: G.audio, book: bk });
    const fx = G.curseFx.scholar(root, activeCurses, { audio: G.audio, book: bk, pages: (curses.length ? ['curses'] : []).concat(pages) });

    const flash = (cls) => { root.classList.remove(cls); void root.offsetWidth; root.classList.add(cls); };
    let last = null;
    return {
      status(s) {
        sb.update(s);
        bossFx.status(s);
        if (last) {
          if (s.strikes > last.strikes) flash('shake');
          const done = (x) => x.relics.filter((r) => r.solved).length;
          if (done(s) > done(last)) flash('blessed');
        }
        last = s;
      },
      destroy: () => { fx.destroy(); root.innerHTML = ''; root.classList.remove('shake', 'blessed'); },
    };
  }

  // The grimoire laid out for paper: a cover with contents, then the preface and one relic per printed page.
  function printBook(root, rules, { pages, smudged = false, upTo = 0, only = false, curses = [] }) {
    const sm = smudged ? G.rules.smudges(rules, pages) : null;
    if (only) {
      root.innerHTML = pages.map((id) => `<section class="print-sheet"><article class="page print"><h2>${G.relics[id].title}</h2>
        ${G.rules.page(rules, id, null)}<p class="edition">Grimoire · edition ${rules.edition} · a new page to add to your book</p></article></section>`).join('');
      return;
    }
    const foot = `Grimoire · edition ${rules.edition}${smudged ? ' · smudged copy' : ''}`;
    const contents = pages.map((id, k) => `<li><span>${k + 1}.</span> ${G.relics[id].title}${G.relics[id].needy ? ' <small>(soothe only)</small>' : ''}</li>`).join('');
    root.innerHTML = `<section class="print-sheet print-cover">
        <div class="pc-crest">☾</div>
        <h1>Grimoire</h1>
        <p class="pc-sub">Edition ${rules.edition}${smudged ? ' · <b>smudged copy</b> for Damned séances' : ''}</p>
        <p class="pc-scope">${upTo ? `Every page up to level ${upTo}` : 'Every page'} — ${pages.length} relic${pages.length === 1 ? '' : 's'}</p>
        <h3>Contents</h3><ol class="pc-contents">${contents}</ol>
        <p class="pc-rule">The Medium may not read this book. The Scholars may not look at the screen.</p>
      </section>
      <section class="print-sheet"><article class="page print"><h2>Preface</h2>${preface(rules, sm)}<p class="edition">${foot}</p></article></section>` +
      (curses.length ? `<section class="print-sheet"><article class="page print"><h2>Curses</h2>${G.curseFx.page(curses)}<p class="edition">${foot}</p></article></section>` : '') +
      pages.map((id, k) => `<section class="print-sheet"><article class="page print"><h2><span class="pnum">${k + 1}.</span> ${G.relics[id].title}</h2>
        ${G.rules.page(rules, id, sm)}<p class="edition">${foot}</p></article></section>`).join('');
  }

  // Study the book from the main menu, outside any room. Pages unlock as your own progress reaches them.
  function study(root, { edition = 1, smudged = false, upTo = 1, onChange } = {}) {
    root.innerHTML = '';
    const bar = el('div', 'study-bar');
    bar.innerHTML = `
      <button class="btn small study-back" type="button">← Main menu</button>
      <label class="study-ed"><span class="label">Edition</span><input type="number" min="1" max="999" inputmode="numeric"></label>
      <label class="study-smudge"><input type="checkbox"> <span>Smudged copy <small>(Damned)</small></span></label>
      <button class="btn small study-print" type="button">🖨 Print this book</button>`;
    root.appendChild(bar);
    const pages = G.levels.book(upTo);
    const locked = G.BOOK_ORDER.filter((id) => !pages.includes(id));
    root.appendChild(el('p', 'role-hint', `Learn the rules before a séance. You have unlocked ${pages.length} of ${G.BOOK_ORDER.length} pages — more appear as you reach new levels. Edition 1 is the standard book.`));
    const slot = el('div');
    root.appendChild(slot);

    const edIn = bar.querySelector('input[type=number]'), smIn = bar.querySelector('input[type=checkbox]');
    edIn.value = edition;
    smIn.checked = smudged;
    let bk = null;
    function draw() {
      const ed = Math.max(1, Math.min(999, Math.round(+edIn.value) || 1));
      edIn.value = ed;
      const keep = bk ? bk.current() : 'preface';
      bk = book(G.rules.build(ed), { pages, smudged: smIn.checked, locked, startId: keep, curses: G.levels.cursesKnown(upTo) });
      slot.replaceChildren(bk.el);
      if (onChange) onChange({ edition: ed, smudged: smIn.checked });
    }
    edIn.addEventListener('change', draw);
    smIn.addEventListener('change', draw);
    draw();
    bar.querySelector('.study-print').addEventListener('click', () => {
      G.views.openPrint({ edition: +edIn.value || 1, smudged: smIn.checked, upTo });
    });
    return { back: bar.querySelector('.study-back'), destroy: () => { root.innerHTML = ''; } };
  }

  // Open the printable book in a new tab (it prints itself). Same edition + smudging = the same book on screen.
  function openPrint({ edition, smudged, upTo, all, only }) {
    const u = new URL(location.href);
    u.search = '';
    u.searchParams.set('print', '');
    u.searchParams.set('edition', edition);
    if (only) u.searchParams.set('only', only);
    else if (all) u.searchParams.set('all', '');
    else u.searchParams.set('upto', upTo);
    if (smudged) u.searchParams.set('smudged', '');
    window.open(u.toString().replace(/=(?=&|$)/g, ''), '_blank');
  }

  G.views = { seance, grimoire, study, printBook, openPrint, fmt, NUMWORD };
})(globalThis.GR = globalThis.GR || {});

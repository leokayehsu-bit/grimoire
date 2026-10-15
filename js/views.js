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
    root.appendChild(contextStrip(game.ctx));
    const grid = el('div', 'relics');
    root.appendChild(grid);

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
      update: () => {
        sb.update(game.status());
        handles.forEach((x) => x.h.update && x.h.update());
      },
      destroy: () => { handles.forEach((x) => x.h.destroy && x.h.destroy()); root.innerHTML = ''; root.classList.remove('shake'); },
    };
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

  // The book itself: page tabs plus the open page. Shared by the séance and the study screen.
  // pages: relic ids in the book; locked: ids shown as locked tabs; fresh: ids marked New.
  function book(rules, { pages = G.BOOK_ORDER, smudged = false, locked = [], fresh = [], startId = 'preface' } = {}) {
    const wrap = el('div', 'book');
    const tabs = el('nav', 'tabs');
    const page = el('article', 'page');
    wrap.append(tabs, page);

    const sm = smudged ? G.rules.smudges(rules, pages) : null;
    const entries = [{ id: 'preface', title: 'Preface', html: () => preface(rules, sm) }]
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
    let current = null;
    function open(id) {
      const p = entries.find((x) => x.id === id) || entries[0];
      current = p.id;
      page.innerHTML = `<h2>${p.title}</h2>${p.html()}<p class="edition">Grimoire · edition ${rules.edition}${smudged ? ' · smudged copy' : ''}</p>`;
      for (const k in tabBtns) tabBtns[k].classList.toggle('active', k === p.id);
      page.scrollTop = 0;
    }
    open(startId);
    return { el: wrap, open, current: () => current };
  }

  // The Scholars' screen during a séance. `level` adds a banner with its name and rules.
  function grimoire(root, rules, { smudged = false, pages, fresh = [], banner = '' } = {}) {
    root.innerHTML = '';
    const sb = statusBar({ scholar: true });
    root.appendChild(sb.el);
    if (banner) { const b = el('div', 'level-banner'); b.innerHTML = banner; root.appendChild(b); }
    const bk = book(rules, { pages, smudged, fresh });
    root.appendChild(bk.el);

    const flash = (cls) => { root.classList.remove(cls); void root.offsetWidth; root.classList.add(cls); };
    let last = null;
    return {
      status(s) {
        sb.update(s);
        if (last) {
          if (s.strikes > last.strikes) flash('shake');
          const done = (x) => x.relics.filter((r) => r.solved).length;
          if (done(s) > done(last)) flash('blessed');
        }
        last = s;
      },
      destroy: () => { root.innerHTML = ''; root.classList.remove('shake', 'blessed'); },
    };
  }

  // The grimoire laid out for paper: a cover with contents, then the preface and one relic per printed page.
  function printBook(root, rules, { pages, smudged = false, upTo = 0, only = false }) {
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
      bk = book(G.rules.build(ed), { pages, smudged: smIn.checked, locked, startId: keep });
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

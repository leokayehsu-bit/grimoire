// The two screens of a séance: the Medium's table and the Scholars' grimoire.
(function (G) {
  'use strict';
  const { el, esc, title, NUMWORD } = G.util;

  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  function statusBar() {
    const bar = el('div', 'status-bar');
    bar.innerHTML = `
      <div class="wrath"><span class="label">Wrath</span><div class="meter"><div class="fill"></div></div><span class="time">–:––</span></div>
      <div class="strikes" title="Offenses"></div>
      <div class="cleansed"></div>`;
    const fill = bar.querySelector('.fill'), time = bar.querySelector('.time');
    const strikes = bar.querySelector('.strikes'), cleansed = bar.querySelector('.cleansed');
    let lastStrikes = -1;
    function update(s) {
      fill.style.width = (s.wrath * 100).toFixed(1) + '%';
      time.textContent = fmt(s.remaining);
      if (s.strikes !== lastStrikes) {
        strikes.innerHTML = '<span class="label">Offenses</span>' +
          Array.from({ length: s.maxStrikes }, (_, i) => `<span class="mark ${i < s.strikes ? 'on' : ''}">✕</span>`).join('');
        lastStrikes = s.strikes;
      }
      const done = s.relics.filter((r) => r.solved).length;
      cleansed.textContent = `${done} / ${s.relics.length} cleansed`;
      document.body.style.setProperty('--wrath', s.wrath.toFixed(3));
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
      const panel = el('section', 'relic relic-' + r.id);
      panel.innerHTML = `<header><h3>${r.title}</h3><span class="seal">Cleansed</span></header>`;
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
      update: () => sb.update(game.status()),
      destroy: () => { handles.forEach((x) => x.h.destroy && x.h.destroy()); root.innerHTML = ''; root.classList.remove('shake'); },
    };
  }

  // ---- Scholars -------------------------------------------------------------
  function preface(rules) {
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
      <p>Each mistake is an offense. The spirit's wrath rises faster after every offense, and three offenses end the séance.
      If the wrath fills before every relic is cleansed, the séance is lost.</p>
      <p class="note">This is edition ${rules.edition} of the grimoire.</p>`;
  }

  function grimoire(root, rules) {
    root.innerHTML = '';
    const sb = statusBar();
    root.appendChild(sb.el);
    const onTable = el('div', 'on-table');
    onTable.innerHTML = '<span class="label">On the table</span><span class="waiting">Waiting for the Medium…</span>';
    root.appendChild(onTable);

    const book = el('div', 'book');
    const tabs = el('nav', 'tabs');
    const page = el('article', 'page');
    book.append(tabs, page);
    root.appendChild(book);

    const pages = [{ id: 'preface', title: 'Preface', html: preface(rules) }]
      .concat(G.RELIC_ORDER.map((id) => ({ id, title: G.relics[id].title, html: G.relics[id].manual(rules[id]) })));
    const tabBtns = {};
    for (const p of pages) {
      const b = el('button', 'tab', p.title);
      b.type = 'button';
      b.addEventListener('click', () => open(p.id));
      tabs.appendChild(b);
      tabBtns[p.id] = b;
    }
    function open(id) {
      const p = pages.find((x) => x.id === id);
      page.innerHTML = `<h2>${p.title}</h2>${p.html}<p class="edition">Grimoire · edition ${rules.edition}</p>`;
      for (const k in tabBtns) tabBtns[k].classList.toggle('active', k === id);
      page.scrollTop = 0;
    }
    open('preface');

    let lastKey = '';
    return {
      status(s) {
        sb.update(s);
        const key = s.relics.map((r) => r.id + (r.solved ? '+' : '')).join();
        if (key === lastKey) return;
        lastKey = key;
        onTable.innerHTML = '<span class="label">On the table</span>';
        for (const r of s.relics) {
          const b = el('button', 'chip' + (r.solved ? ' done' : ''), (r.solved ? '✓ ' : '') + r.title);
          b.type = 'button';
          b.addEventListener('click', () => open(r.id));
          onTable.appendChild(b);
        }
      },
      destroy: () => { root.innerHTML = ''; },
    };
  }

  G.views = { seance, grimoire, fmt, NUMWORD };
})(globalThis.GR = globalThis.GR || {});

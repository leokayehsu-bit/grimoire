// Screens and the room protocol. The host owns the lobby; the Medium's browser owns the séance.
//
// Messages (every message reaches everyone; `to` limits who acts on it):
//   join {name}            guest → host      ask to sit at the table
//   role {role}            guest → host      pick 'medium' | 'scholar'
//   lobby {players,...}    host → all        the room as it stands
//   start {seed,edition,difficulty,level,free,mediumId}  host → all
//   status {...}           Medium → all      wrath, offenses, relics (twice a second)
//   end {result,...}       Medium/host → all
//   toLobby {}             host → all
//   leave {} / closed {}   someone left / the host closed the room
(function (G) {
  'use strict';
  const { el, esc } = G.util;
  const $ = (s) => document.querySelector(s);

  const params = new URLSearchParams(location.search);
  // This copy's release stamp (from the ?v= that tools/publish.sh puts on every script), 'dev' locally.
  const BUILD = (() => {
    const tag = document.querySelector('script[src*="js/main.js"]');
    const m = tag && tag.src.match(/[?&]v=(\w+)/);
    return m ? m[1] : 'dev';
  })();
  const LOCAL = params.has('local');
  const audio = new G.Sound();
  G.audio = audio;

  const S = {
    net: null, screen: 'home',
    me: { id: null, name: '' }, isHost: false, hostId: null, code: null,
    players: [], settings: { edition: 1, difficulty: 'vengeful', level: 1, free: null, upTo: 1 },
    current: null, role: null, game: null, view: null, loop: null, joinTimer: null,
  };
  window.grimoire = { S, answers: () => S.game && S.game.answers(), build: () => BUILD, handle: (m) => handle(m) };

  const store = (k, v) => { try { localStorage.setItem('grimoire.' + k, v); } catch (e) { /* private mode */ } };
  const load = (k) => { try { return localStorage.getItem('grimoire.' + k); } catch (e) { return null; } };

  // Campaign progress lives in this browser. ?unlockall opens every level (for testing; never saved).
  const P = G.levels.progress;
  function getProgress() {
    if (params.has('unlockall')) return P.all();
    try {
      const p = JSON.parse(load('progress.v1'));
      if (p && p.cleared) return p;
    } catch (e) { /* corrupt or missing */ }
    return P.empty();
  }
  function saveProgress(p) { if (!params.has('unlockall')) store('progress.v1', JSON.stringify(p)); }
  const fmt = (sec) => G.views.fmt(sec);
  const candleRow = (n, cls = '') => `<span class="candles ${cls}" aria-label="${n} of 3 candles">${[1, 2, 3].map((k) => `<i class="${k <= n ? 'lit' : ''}"></i>`).join('')}</span>`;
  const DLABEL = (d) => G.levels.DIFFICULTY[d].label;

  function show(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== 'screen-' + name));
    $('#btn-quit').classList.toggle('hidden', name !== 'medium' && name !== 'scholar');
    S.screen = name;
    document.body.classList.toggle('in-seance', name === 'medium' || name === 'scholar');
    if (name === 'home') renderHomeProgress();
    if (name === 'home' || name === 'lobby' || name === 'study') audio.menuMusic(true);
    if (name !== 'medium' && name !== 'scholar') document.body.style.setProperty('--wrath', 0);
    window.scrollTo(0, 0);
  }

  const homeMsg = (t) => { $('#home-msg').textContent = t || ''; };
  const busy = (on) => { $('#btn-create').disabled = on; $('#btn-join').disabled = on; };

  function readName() {
    const n = $('#in-name').value.trim().slice(0, 16);
    if (!n) { homeMsg('Write your name first.'); $('#in-name').focus(); return null; }
    store('name', n);
    return n;
  }

  function netError(e) {
    if (!e) return 'Could not connect.';
    if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') return 'Could not reach the room service. Check your internet connection.';
    if (e.type === 'browser-incompatible') return 'This browser cannot join online rooms.';
    return e.message || 'Could not connect.';
  }

  function makeNet() {
    return new G.Net({
      onMessage: handle,
      onPeerLeft: peerLeft,
      onClosed: () => backHome('The host closed the room.'),
      onError: (e) => console.warn('[grimoire net]', e),
    }, { local: LOCAL });
  }

  // The host's starting choices: their furthest open level, or the one they last played.
  function freshSettings() {
    const furthest = P.furthest(getProgress());
    const last = +load('lastLevel');
    return {
      edition: +load('lastEdition') || 1,
      difficulty: load('lastDifficulty') || 'vengeful',
      level: last && last <= furthest ? last : furthest,
      free: null,
      upTo: furthest,
    };
  }

  // ---- One screen: no room; you sit as the Medium and the Scholars read a printed grimoire. ----
  function playSolo() {
    audio.unlock();
    const name = $('#in-name').value.trim().slice(0, 16) || 'Medium';
    S.solo = true;
    S.net = { id: 'solo', send() {}, leave() {} };
    S.me = { id: 'solo', name };
    S.isHost = true;
    S.hostId = 'solo';
    S.code = null;
    S.players = [{ id: 'solo', name, role: 'medium' }];
    S.current = null;
    S.settings = freshSettings();
    show('lobby');
    broadcastLobby();
  }

  function renderPrintCard() {
    const st = S.settings;
    const lv = currentLevel(st);
    const t = G.levels.terms(lv, st.difficulty);
    const all = $('#print-all').checked;
    const pages = all ? G.BOOK_ORDER : G.levels.book(st.upTo);
    $('#print-note').textContent = `Edition ${st.edition} · ${pages.length} relic page${pages.length === 1 ? '' : 's'} · ${t.smudged ? 'smudged copy (for Damned)' : 'clean copy'}`;
    // A level that adds a page the last printout may not have: offer just that page.
    const box = $('#print-new');
    const fresh = !lv.free && lv.intro;
    box.classList.toggle('hidden', !fresh);
    if (fresh) {
      box.innerHTML = `This level adds a new page — <b>${G.relics[lv.intro].title}</b>. If your printed book is older, print it now.
        <button id="btn-print-new" class="btn small" type="button">🖨 Print only this page</button>`;
      box.querySelector('button').addEventListener('click', () => G.views.openPrint({ edition: st.edition, only: lv.intro }));
    }
  }

  // ---- Joining ---------------------------------------------------------------
  async function createRoom() {
    const name = readName();
    if (!name) return;
    audio.unlock();
    busy(true);
    homeMsg('Lighting the candles…');
    const net = makeNet();
    try {
      S.code = await net.host();
    } catch (e) {
      busy(false);
      homeMsg(netError(e));
      return;
    }
    busy(false);
    homeMsg('');
    S.net = net;
    S.me = { id: net.id, name };
    S.isHost = true;
    S.hostId = net.id;
    S.players = [{ id: net.id, name, role: null, build: BUILD }];
    S.current = null;
    S.settings = freshSettings();
    show('lobby');
    broadcastLobby();
  }

  async function joinRoom() {
    const name = readName();
    if (!name) return;
    const code = $('#in-code').value.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) { homeMsg('Room codes are four letters.'); return; }
    audio.unlock();
    busy(true);
    homeMsg('Knocking…');
    const net = makeNet();
    try {
      await net.join(code);
    } catch (e) {
      busy(false);
      homeMsg(netError(e));
      return;
    }
    S.net = net;
    S.me = { id: net.id, name };
    S.isHost = false;
    S.hostId = null;
    S.code = code;
    net.send({ t: 'join', name, build: BUILD });
    S.joinTimer = setTimeout(() => {
      if (!S.hostId) { leave(); homeMsg('No answer from that room.'); }
    }, 6000);
  }

  function leave() {
    clearTimeout(S.joinTimer);
    stopRound();
    if (S.net) S.net.leave();
    S.net = null;
    S.isHost = false;
    S.hostId = null;
    S.players = [];
    S.current = null;
    S.role = null;
    S.solo = false;
    busy(false);
    audio.stopAmbience();
    show('home');
  }

  function backHome(msg) {
    if (!S.net) return;
    leave();
    homeMsg(msg);
  }

  // ---- Messages ----------------------------------------------------------------
  function handle(m) {
    if (!m || (m.to && m.to !== S.me.id)) return;
    switch (m.t) {
      case 'join': if (S.isHost) hostJoin(m); break;
      case 'role': if (S.isHost) hostRole(m.from, m.role); break;
      case 'leave': if (S.isHost) peerLeft(m.from); break;
      case 'lobby': gotLobby(m); break;
      case 'start': startRound(m); break;
      case 'status': if (S.role === 'scholar' && S.view) scholarStatus(m); break;
      case 'end': endRound(m); break;
      case 'toLobby': toLobby(); break;
      case 'closed': if (!S.isHost && m.from === S.hostId) backHome('The host closed the room.'); break;
    }
  }

  function broadcastLobby() {
    const m = { t: 'lobby', players: S.players, settings: S.settings, hostId: S.me.id, code: S.code, build: BUILD };
    S.net.send(m);
    gotLobby(m);
  }

  function hostJoin(m) {
    if (S.players.some((p) => p.id === m.from)) return;
    const p = { id: m.from, name: String(m.name || 'Guest').slice(0, 16), role: S.current ? 'scholar' : null, build: String(m.build || 'unknown') };
    S.players.push(p);
    broadcastLobby();
    // Arrived mid-séance: hand them the book.
    if (S.current) S.net.send(Object.assign({}, S.current, { to: m.from }));
  }

  function hostRole(id, role) {
    const p = S.players.find((x) => x.id === id);
    if (p && !S.current) {
      const mediumTaken = S.players.some((q) => q.role === 'medium' && q.id !== id);
      // null gives the seat up, so two players can swap.
      if (role === null || role === 'scholar' || (role === 'medium' && !mediumTaken)) p.role = role;
    }
    broadcastLobby();
  }

  function peerLeft(id) {
    if (!S.isHost) return;
    const i = S.players.findIndex((p) => p.id === id);
    if (i < 0) return;
    S.players.splice(i, 1);
    if (S.current && S.current.mediumId === id) {
      const m = { t: 'end', result: 'abandoned', reason: 'medium-left' };
      S.net.send(m);
      endRound(m);
    }
    broadcastLobby();
  }

  function gotLobby(m) {
    clearTimeout(S.joinTimer);
    S.players = m.players;
    S.settings = m.settings;
    S.hostId = m.hostId;
    S.code = m.code || S.code;
    S.hostBuild = m.build;
    if (S.screen === 'home') { busy(false); homeMsg(''); show('lobby'); }
    renderLobby();
    renderVersionWarn(m.build);
  }

  // ---- Lobby -------------------------------------------------------------------
  // Picking the seat you already have stands you up from it.
  function pickRole(role) {
    if (S.current) return;
    const mine = S.players.find((p) => p.id === S.me.id);
    if (mine && mine.role === role) role = null;
    if (S.isHost) hostRole(S.me.id, role);
    else S.net.send({ t: 'role', role });
  }

  function hostSetting(key, value) {
    if (!S.isHost || S.current) return;
    S.settings = Object.assign({}, S.settings, { [key]: value });
    broadcastLobby();
  }

  function startCheck() {
    if (S.solo) return '';
    const behind = S.players.find((p) => p.build && p.build !== BUILD);
    if (behind) return `${behind.name} is on a different version of Grimoire. ${olderOf(behind.build) === 'them' ? 'Ask them to reload the page.' : 'Reload this page to update, then reopen the room.'}`;
    const medium = S.players.find((p) => p.role === 'medium');
    const scholars = S.players.filter((p) => p.role === 'scholar');
    if (!medium) return 'Someone must sit as the Medium.';
    if (!scholars.length) return 'At least one Scholar must hold the book.';
    if (S.players.some((p) => !p.role)) return 'Everyone needs a seat first.';
    return '';
  }

  function hostStart() {
    if (!S.isHost || S.current || startCheck()) return;
    audio.unlock();
    const m = {
      t: 'start',
      seed: (Math.random() * 4294967296) >>> 0,
      edition: S.settings.edition,
      difficulty: S.settings.difficulty,
      level: S.settings.free ? 0 : S.settings.level,
      free: S.settings.free ? Object.assign({ upTo: S.settings.upTo }, S.settings.free) : null,
      mediumId: S.players.find((p) => p.role === 'medium').id,
    };
    store('lastLevel', S.settings.level);
    store('lastDifficulty', S.settings.difficulty);
    store('lastEdition', S.settings.edition);
    S.net.send(Object.assign({}, m));
    startRound(m);
  }

  function renderLobby() {
    if (S.screen !== 'lobby') return;
    $('#screen-lobby').classList.toggle('solo', !!S.solo);
    $('#print-card').classList.toggle('hidden', !S.solo);
    $('#roles-card').classList.toggle('hidden', !!S.solo);
    if (S.solo) renderPrintCard();
    $('#btn-leave').textContent = S.solo ? '← Main menu' : 'Leave room';
    $('#lobby-code').textContent = S.code || '····';
    const mine = S.players.find((p) => p.id === S.me.id);
    const medium = S.players.find((p) => p.role === 'medium');
    const mediumBtn = $('#role-medium'), scholarBtn = $('#role-scholar');
    mediumBtn.classList.toggle('mine', !!mine && mine.role === 'medium');
    scholarBtn.classList.toggle('mine', !!mine && mine.role === 'scholar');
    mediumBtn.disabled = !!medium && medium.id !== S.me.id;
    mediumBtn.querySelector('.taken').textContent = medium && medium.id !== S.me.id ? `Taken by ${medium.name} — they can tap it again to give it up` : '';
    for (const [btn, role] of [[mediumBtn, 'medium'], [scholarBtn, 'scholar']]) {
      let note = btn.querySelector('.unseat');
      if (!note) { note = el('em', 'unseat'); btn.appendChild(note); }
      note.textContent = mine && mine.role === role ? 'Your seat — tap again to give it up' : '';
    }

    const list = $('#player-list');
    list.innerHTML = '';
    for (const p of S.players) {
      const li = el('li');
      const seat = p.role === 'medium' ? '🕯️ Medium' : p.role === 'scholar' ? '📖 Scholar' : 'Choosing…';
      const stale = S.isHost && p.build && p.build !== BUILD ? ' <span class="stale">different version</span>' : '';
      li.innerHTML = `<span class="pname">${esc(p.name)}${p.id === S.me.id ? ' <i>(you)</i>' : ''}${p.id === S.hostId ? ' <span class="host">host</span>' : ''}${stale}</span><span class="seat ${p.role || 'none'}">${seat}</span>`;
      list.appendChild(li);
    }

    $('#settings-host').classList.toggle('hidden', !S.isHost);
    $('#settings-guest').classList.toggle('hidden', S.isHost);
    $('#level-card').innerHTML = levelCard(S.settings);
    if (S.isHost) {
      const st = S.settings, prog = getProgress();
      const lv = currentLevel(st);
      const seg = $('#diff-seg');
      seg.innerHTML = '';
      for (const d of G.levels.DIFF_ORDER) {
        const t = G.levels.terms(lv, d);
        const done = !lv.free && prog.cleared[lv.n] && prog.cleared[lv.n][d];
        const b = el('button', 'diff-btn' + (st.difficulty === d ? ' on' : ''));
        b.type = 'button';
        b.innerHTML = `<b>${G.levels.DIFFICULTY[d].label}${done ? ' ✓' : ''}</b><small>${fmt(t.time)} · ${t.offenses} offense${t.offenses === 1 ? '' : 's'}</small>`;
        b.addEventListener('click', () => hostSetting('difficulty', d));
        seg.appendChild(b);
      }
      $('#free-opts').classList.toggle('hidden', !st.free);
      if (st.free) {
        const avail = G.levels.book(st.upTo);
        fillSelect($('#in-free-count'), Array.from({ length: Math.min(6, avail.filter((id) => !G.relics[id].needy).length) }, (_, i) => i + 1), st.free.count, (n) => `${n} relic${n === 1 ? '' : 's'}`);
        fillSelect($('#in-free-needy'), Array.from({ length: avail.filter((id) => G.relics[id].needy).length + 1 }, (_, i) => i), st.free.needy, (n) => (n ? `${n} to soothe` : 'None'));
        const known = G.levels.cursesKnown(st.upTo).length;
        $('#free-curse-field').classList.toggle('hidden', !known);
        fillSelect($('#in-free-curses'), Array.from({ length: Math.min(2, known) + 1 }, (_, i) => i), st.free.curses || 0, (n) => (n ? `${n} at random` : 'None'));
      }
      const ed = $('#in-edition');
      if (document.activeElement !== ed) ed.value = st.edition;
      const why = startCheck();
      $('#btn-start').disabled = !!why;
      $('#start-msg').textContent = why;
      if (!$('#level-list').classList.contains('hidden')) renderLevelList();
    } else {
      $('#level-list').classList.add('hidden');
    }
  }

  // Release stamps are YYYYMMDDHHMM, so the smaller one is older. Returns who should reload.
  function olderOf(other) {
    if (other === BUILD) return null;
    if (!/^\d+$/.test(other) || !/^\d+$/.test(BUILD)) return 'them';
    return +other < +BUILD ? 'them' : 'me';
  }

  function renderVersionWarn(hostBuild) {
    const box = $('#version-warn');
    const who = S.isHost || !hostBuild ? null : olderOf(hostBuild);
    box.classList.toggle('hidden', !who);
    if (!who) return;
    box.innerHTML = who === 'me'
      ? 'Your copy of Grimoire is older than the host’s, so your rules would not match. <button class="btn small" type="button">Reload to update</button>'
      : 'The host is on an older version of Grimoire. Ask them to reload the page, then rejoin.';
    const b = box.querySelector('button');
    if (b) b.addEventListener('click', async () => {
      try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch (e) { /* offline */ }
      location.href = inviteLink();
    });
  }

  function fillSelect(sel, values, current, label) {
    sel.innerHTML = '';
    for (const v of values) {
      const o = el('option', null, label(v));
      o.value = v;
      sel.appendChild(o);
    }
    sel.value = values.includes(current) ? current : values[values.length - 1];
  }

  function currentLevel(st) {
    return st.free ? G.levels.freeLevel(st.free.count, st.free.needy, st.upTo, st.free.curses || 0) : G.levels.get(st.level);
  }

  // The card for the chosen level, at the chosen difficulty: name, story, and its terms.
  function levelCard(st) {
    const lv = currentLevel(st);
    if (!lv) return '';
    const t = G.levels.terms(lv, st.difficulty);
    const d = G.levels.DIFFICULTY[st.difficulty];
    const where = lv.free ? 'Free séance' : `${G.levels.CHAPTERS[lv.chapter].name} · Level ${lv.n} of ${G.levels.LEVELS.length}`;
    const needy = lv.needy.length ? `<div><dt>To soothe</dt><dd>${lv.needy.map((id) => G.relics[id].title).join(', ')}</dd></div>` : '';
    return `<span class="cap">${where}</span>
      <h3>${esc(lv.name)}</h3>
      <p class="lc-desc">${esc(lv.desc)}</p>
      ${lv.intro ? `<p class="lc-new">✦ New grimoire page: <b>${G.relics[lv.intro].title}</b></p>` : ''}
      ${lv.curseIntro ? `<p class="lc-curse">☠ New curse: <b>${G.CURSES[lv.curseIntro].name}</b> — ${esc(G.CURSES[lv.curseIntro].desc)}</p>` : ''}
      <dl class="lc-terms">
        <div><dt>Relics to cleanse</dt><dd>${lv.count}</dd></div>${needy}${curseTerms(lv, st.difficulty)}
        <div><dt>Time limit</dt><dd>${fmt(t.time)}</dd></div>
        <div><dt>Offenses allowed</dt><dd>${t.offenses}</dd></div>
        <div><dt>Difficulty</dt><dd>${d.label}${t.smudged ? ' · smudged ink' : ''}</dd></div>
      </dl>
      ${lv.free ? '' : bestLine(lv, st.difficulty)}`;
  }

  // The level's curses on its card. Damned adds one more, chosen when the séance begins.
  function curseTerms(lv, difficulty) {
    const names = lv.curses.map((id) => G.CURSES[id].name);
    if (lv.freeCurses) names.push(`${lv.freeCurses} at random`);
    const extra = difficulty === 'damned' && G.levels.cursesKnown(lv.free ? lv.bookUpTo : lv.n).length > lv.curses.length + (lv.freeCurses || 0);
    if (extra) names.push('+1 (Damned)');
    return names.length ? `<div class="lc-cursed"><dt>Curses</dt><dd>${names.join(', ')}</dd></div>` : '';
  }

  // Three-candle target for a level at a difficulty, and this browser's best there.
  function bestLine(lv, difficulty) {
    const best = P.best(getProgress(), lv.n, difficulty);
    const n = P.candles(getProgress(), lv.n, difficulty);
    return `<p class="lc-best">${candleRow(n)} <span>${best ? `Your best: ${fmt(best.time)}${best.strikes ? `, ${best.strikes} offense${best.strikes === 1 ? '' : 's'}` : ', no offenses'}` : n ? 'Cleared' : 'Not yet cleared'}
      · three candles for no offenses and under ${fmt(G.levels.fastTime(lv, difficulty))}</span></p>`;
  }

  // Every chapter and level; locked levels can't be picked yet.
  function renderLevelList() {
    const list = $('#level-list');
    const prog = getProgress();
    list.innerHTML = '<header class="ll-head"><h2>Choose a level</h2><button class="btn small ll-close" type="button">Close</button></header>';
    list.querySelector('.ll-close').addEventListener('click', () => list.classList.add('hidden'));
    G.levels.CHAPTERS.forEach((ch, c) => {
      const sec = el('section', 'll-chapter');
      const inChapter = G.levels.LEVELS.filter((x) => x.chapter === c);
      const got = inChapter.reduce((sum, x) => sum + G.levels.DIFF_ORDER.reduce((a, d) => a + P.candles(prog, x.n, d), 0), 0);
      sec.innerHTML = `<h3>${ch.name} <small class="ll-total">${got} / ${inChapter.length * 9} 🕯</small></h3><p class="note">${ch.blurb}</p>`;
      for (const lv of G.levels.LEVELS.filter((x) => x.chapter === c)) {
        const open = P.open(prog, lv.n);
        const marks = G.levels.DIFF_ORDER.map((d) => {
          const n = P.candles(prog, lv.n, d), best = P.best(prog, lv.n, d);
          const tip = n ? `${DLABEL(d)}: ${n} of 3 candles${best ? ', best ' + fmt(best.time) : ''}` : `${DLABEL(d)}: not cleared`;
          return `<i class="${n ? 'on' : ''}" title="${tip}">${DLABEL(d)[0]}${n ? `<sup>${n}</sup>` : ''}</i>`;
        }).join('');
        const b = el('button', 'll-row' + (open ? '' : ' locked') + (!S.settings.free && S.settings.level === lv.n ? ' current' : ''));
        b.type = 'button';
        b.disabled = !open;
        b.innerHTML = `<span class="ll-n">${open ? lv.n : '🔒'}</span><span class="ll-name">${esc(lv.name)}${lv.intro ? ` <small>✦ ${G.relics[lv.intro].title}</small>` : ''}</span><span class="ll-marks">${marks}</span>`;
        b.addEventListener('click', () => { hostSetting('level', lv.n); hostSetting('free', null); list.classList.add('hidden'); });
        sec.appendChild(b);
      }
      list.appendChild(sec);
    });
    const free = el('button', 'll-row ll-free' + (S.settings.free ? ' current' : ''));
    free.type = 'button';
    free.innerHTML = '<span class="ll-n">∞</span><span class="ll-name">Free séance <small>Any relics you have met, at random</small></span>';
    free.addEventListener('click', () => { hostSetting('free', { count: 3, needy: 0 }); list.classList.add('hidden'); });
    list.appendChild(free);
  }

  function inviteLink() {
    const u = new URL(location.href);
    u.search = '';
    u.searchParams.set('room', S.code);
    if (LOCAL) u.searchParams.set('local', '');
    return u.toString().replace('local=', 'local');
  }

  // ---- The séance --------------------------------------------------------------
  function startRound(m) {
    stopRound();
    S.current = { t: 'start', seed: m.seed, edition: m.edition, difficulty: m.difficulty, level: m.level, free: m.free, mediumId: m.mediumId };
    S.role = m.mediumId === S.me.id ? 'medium' : 'scholar';
    S.lastStatus = null;
    audio.resetIntensity();
    audio.startAmbience();
    audio.startSeance();

    if (S.role === 'medium') {
      const game = new G.Game(m);
      S.game = game;
      S.view = G.views.seance($('#screen-medium'), game, audio);
      show('medium');
      game.on('end', (r) => {
        const msg = Object.assign({ t: 'end' }, r);
        S.net.send(Object.assign({}, msg));
        endRound(msg);
      });
      const sendStatus = () => S.net && S.net.send(Object.assign({ t: 'status' }, game.status()));
      sendStatus();
      S.view.update();
      // setInterval with real deltas (not requestAnimationFrame) so the wrath keeps rising
      // even if the Medium switches tabs to their voice call.
      let last = performance.now(), acc = 0;
      S.loop = setInterval(() => {
        const now = performance.now();
        const dt = Math.min(2, (now - last) / 1000);
        last = now;
        game.tick(dt);
        if (S.game !== game) return; // the séance ended during this tick
        S.view.update();
        audio.setIntensity({ wrath: game.wrath, strikes: game.strikes, remaining: game.remaining });
        acc += dt;
        if (acc >= 0.5) { acc = 0; sendStatus(); }
      }, 100);
    } else {
      const lv = m.free ? G.levels.freeLevel(m.free.count, m.free.needy, m.free.upTo, m.free.curses || 0) : G.levels.get(m.level);
      const t = G.levels.terms(lv, m.difficulty);
      const upTo = lv.free ? lv.bookUpTo : lv.n;
      const banner = `<span class="cap">${lv.free ? 'Free séance' : 'Level ' + lv.n}</span> <b>${esc(lv.name)}</b>
        <span class="lb-terms">${G.levels.DIFFICULTY[m.difficulty].label} · ${fmt(t.time)} · ${t.offenses} offense${t.offenses === 1 ? '' : 's'}${t.smudged ? ' · smudged ink' : ''}</span>`;
      S.view = G.views.grimoire($('#screen-scholar'), G.rules.build(m.edition), {
        smudged: t.smudged, pages: G.levels.book(upTo), fresh: [lv.intro, lv.curseIntro].filter(Boolean), banner,
        curses: G.levels.cursesKnown(upTo), activeCurses: G.levels.cursesFor(lv, m.difficulty, m.seed),
      });
      show('scholar');
    }
  }

  // Scholars hear the séance through the Medium's status: the score follows the wrath, and they hear
  // each offense and each cleansing as it happens.
  function scholarStatus(m) {
    S.view.status(m);
    audio.setIntensity({ wrath: m.wrath, strikes: m.strikes, remaining: m.remaining });
    const last = S.lastStatus;
    if (last) {
      if (m.strikes > last.strikes) audio.strike();
      const done = (s) => s.relics.filter((r) => r.solved).length;
      if (done(m) > done(last)) audio.solve();
    }
    S.lastStatus = m;
  }

  function stopRound() {
    clearInterval(S.loop);
    S.loop = null;
    if (S.view) S.view.destroy();
    S.view = null;
    S.game = null;
  }

  const END_TEXT = {
    cleansed: ['The spirit is at rest.', 'Every relic is cleansed. The candles burn steady, and the room is only a room again.'],
    wrath: ['The spirit claims the séance.', "The spirit's wrath boiled over before the relics were cleansed."],
    strikes: ['The spirit claims the séance.', 'Too many offenses. The spirit would not forgive.'],
    'medium-left': ['The circle is broken.', 'The Medium fled the séance.'],
  };

  // A séance ends. If the spirit won, everyone watches it kill them first (over the frozen table).
  function endRound(m) {
    if (S.ending) return;
    const dramatic = m.result === 'lose' && (m.reason === 'wrath' || m.reason === 'strikes');
    S.current = null;
    clearInterval(S.loop);
    S.loop = null;
    if (!dramatic) { finishRound(m, false); return; }
    S.ending = true;
    G.death.play({ reason: m.reason, audio, gentle: load('jumpscares') === '0' }).then(() => { S.ending = false; finishRound(m, true); });
  }

  function finishRound(m, dramatic) {
    stopRound();
    audio.stopAmbience();
    if (m.result === 'win') audio.win(); else if (!dramatic) audio.lose();
    const [head, text] = END_TEXT[m.reason] || END_TEXT.wrath;
    $('#screen-end').classList.toggle('slain', !!dramatic);
    $('#end-title').textContent = head;
    $('#end-title').className = m.result === 'win' ? 'win' : 'lose';
    $('#end-text').textContent = text;
    const lv = m.level ? G.levels.get(m.level) : null;
    $('#end-level').textContent = m.levelName ? `${lv ? 'Level ' + lv.n + ' · ' : ''}${m.levelName} · ${G.levels.DIFFICULTY[m.difficulty].label}` : '';
    let unlock = '', rating = '';
    if (m.result === 'win' && lv) {
      const before = getProgress();
      const wasOpen = P.open(before, lv.n + 1);
      const prev = P.best(before, lv.n, m.difficulty);
      const candles = G.levels.rating(lv, m.difficulty, { time: m.time, strikes: m.strikes });
      const improved = P.clear(before, lv.n, m.difficulty, { time: m.time, strikes: m.strikes, candles });
      saveProgress(before);
      const fast = G.levels.fastTime(lv, m.difficulty);
      const best = P.best(before, lv.n, m.difficulty);
      rating = `${candleRow(candles, 'big')}
        <ul class="criteria">
          <li class="ok">Cleansed the table</li>
          <li class="${m.strikes === 0 ? 'ok' : ''}">No offenses</li>
          <li class="${m.time <= fast ? 'ok' : ''}">Under ${fmt(fast)}</li>
        </ul>
        <p class="best-line">${improved && prev ? `New best on ${DLABEL(m.difficulty)}!` : improved ? `First clear on ${DLABEL(m.difficulty)}.` :
          `Your best on ${DLABEL(m.difficulty)}: ${best.candles} candle${best.candles === 1 ? '' : 's'} in ${fmt(best.time)}.`}</p>`;
      const next = G.levels.get(lv.n + 1);
      if (next && !wasOpen) {
        unlock = `Level ${next.n} unlocked: ${next.name}.` + (next.intro ? ` A new page appears in the grimoire — ${G.relics[next.intro].title}.` : '');
      } else if (!next) unlock = 'You have finished the last séance. Try it again on Damned.';
      if (S.isHost) S.settings = Object.assign({}, S.settings, { upTo: P.furthest(getProgress()) });
    }
    $('#end-unlock').textContent = unlock;
    $('#end-rating').innerHTML = rating;
    S.nextLevel = m.result === 'win' && lv && G.levels.get(lv.n + 1) ? lv.n + 1 : 0;
    $('#btn-next').classList.toggle('hidden', !S.isHost || !S.nextLevel);
    const stats = $('#end-stats');
    stats.innerHTML = '';
    if (m.total) {
      stats.innerHTML = `<div><dt>Relics cleansed</dt><dd>${m.solved} / ${m.total}</dd></div>
        <div><dt>Offenses</dt><dd>${m.strikes}</dd></div>
        <div><dt>Time at the table</dt><dd>${G.views.fmt(m.time)}</dd></div>
        <div><dt>Edition</dt><dd>${m.edition}</dd></div>`;
    }
    $('#btn-again').classList.toggle('hidden', !S.isHost);
    $('#btn-end-leave').textContent = S.solo ? '← Main menu' : 'Leave room';
    $('#end-wait').classList.toggle('hidden', S.isHost);
    show('end');
  }

  function toLobby() {
    stopRound();
    S.current = null;
    audio.stopAmbience();
    show('lobby');
    renderLobby();
  }

  // ---- Study (read the book outside a room) -------------------------------------
  function openStudy() {
    const view = G.views.study($('#screen-study'), {
      edition: +load('studyEdition') || 1,
      smudged: load('studySmudged') === '1',
      upTo: P.furthest(getProgress()),
      onChange: (o) => { store('studyEdition', o.edition); store('studySmudged', o.smudged ? '1' : '0'); },
    });
    view.back.addEventListener('click', () => { view.destroy(); show('home'); });
    show('study');
  }

  // ---- Wiring ------------------------------------------------------------------
  // ?print&edition=N&(upto=L|all|only=id)[&smudged] lays the grimoire out for paper and opens the print dialog.
  function printMode() {
    document.body.classList.add('printing');
    const edition = Math.max(1, Math.min(999, Math.round(+params.get('edition')) || 1));
    const only = params.get('only');
    const all = params.has('all');
    const upTo = Math.max(1, Math.min(G.levels.LEVELS.length, +params.get('upto') || 1));
    const pages = only && G.relics[only] ? [only] : all ? G.BOOK_ORDER : G.levels.book(upTo);
    const bar = el('div', 'print-bar');
    bar.innerHTML = `<span>Grimoire · edition ${edition}${params.has('smudged') ? ' · smudged' : ''} — ${pages.length} page${pages.length === 1 ? '' : 's'}</span>
      <button class="btn small primary" type="button">🖨 Print</button>`;
    bar.querySelector('button').addEventListener('click', () => window.print());
    const root = el('div');
    root.id = 'print-root';
    document.body.append(bar, root);
    const curses = only ? [] : all ? G.levels.CURSE_ORDER : G.levels.cursesKnown(upTo);
    G.views.printBook(root, G.rules.build(edition), { pages, smudged: params.has('smudged') && !only, upTo: all || only ? 0 : upTo, only: !!only, curses });
    document.title = `Grimoire — edition ${edition}`;
    if (!params.has('noauto')) (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(() => window.print(), 500));
  }

  // Installable app + offline play. The worker only runs on the real site (or with ?sw), so local
  // development never serves stale files.
  function setupApp() {
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if ('serviceWorker' in navigator && (!local || params.has('sw'))) navigator.serviceWorker.register('sw.js').catch(() => {});
    let deferred = null;
    const btn = $('#btn-install');
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; btn.classList.remove('hidden'); $('#install-hint').textContent = ''; });
    btn.addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      btn.classList.add('hidden');
    });
    window.addEventListener('appinstalled', () => btn.classList.add('hidden'));
    const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const safari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS/.test(ua);
    if (!installed) {
      if (ios) $('#install-hint').textContent = 'To install: tap Share, then “Add to Home Screen”.';
      else if (safari) $('#install-hint').textContent = 'To install: in Safari, choose File → Add to Dock.';
    }
    const online = () => {
      const off = !navigator.onLine;
      $('#offline-note').classList.toggle('hidden', !off);
      $('#btn-create').disabled = off;
      $('#btn-join').disabled = off;
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', online);
    online();
  }

  // Settings (bottom-left): music and effects volume, and colour labels. Remembered per browser.
  function setupSoundControls() {
    const btn = $('#btn-sound'), pop = $('#sound-pop');
    const icon = () => {};
    const cb = $('#opt-cb');
    cb.checked = load('colorLabels') === '1';
    document.body.classList.toggle('cb', cb.checked);
    cb.addEventListener('change', () => {
      document.body.classList.toggle('cb', cb.checked);
      store('colorLabels', cb.checked ? '1' : '0');
    });
    const scare = $('#opt-scare');
    scare.checked = load('jumpscares') !== '0';
    scare.addEventListener('change', () => store('jumpscares', scare.checked ? '1' : '0'));
    for (const kind of ['music', 'sfx']) {
      const range = $('#vol-' + kind);
      range.value = Math.round(audio.vol[kind] * 100);
      range.addEventListener('input', () => {
        audio.unlock();
        audio.setVolume(kind, range.value / 100);
        icon();
      });
    }
    $('#vol-sfx').addEventListener('change', () => audio.solve());
    btn.addEventListener('click', (e) => { e.stopPropagation(); pop.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => { if (!pop.contains(e.target) && e.target !== btn) pop.classList.add('hidden'); });
    icon();
  }

  function renderHomeProgress() {
    const p = getProgress();
    const total = P.total(p);
    $('#home-progress').innerHTML = total
      ? `Level ${P.furthest(p)} of ${G.levels.LEVELS.length} reached · <b>${total}</b> of ${P.max()} candles`
      : '';
  }

  function init() {
    if (params.has('print')) { printMode(); return; }
    renderHomeProgress();
    setupApp();
    $('#in-name').value = load('name') || '';
    const room = (params.get('room') || '').toUpperCase();
    if (room) {
      $('#in-code').value = room;
      homeMsg(`You've been invited to room ${room}. Write your name, then press Join.`);
    }
    $('#mode-note').textContent = LOCAL
      ? 'Local mode: rooms only reach other tabs in this browser.'
      : 'Play together in one room, or on a voice call — the game doesn’t carry voices.';

    $('#btn-create').addEventListener('click', createRoom);
    $('#btn-join').addEventListener('click', joinRoom);
    $('#btn-study').addEventListener('click', openStudy);
    // A soft wooden tick on menu buttons (relics make their own sounds during a séance).
    document.addEventListener('click', (e) => {
      if (S.screen === 'medium' || S.screen === 'scholar') return;
      if (e.target.closest('.btn, .role-card, .diff-btn, .ll-row, .seg-btn')) audio.uiTap();
    });
    $('#btn-solo').addEventListener('click', playSolo);
    $('#btn-print').addEventListener('click', () => {
      const st = S.settings;
      G.views.openPrint({ edition: st.edition, smudged: G.levels.terms(currentLevel(st), st.difficulty).smudged, upTo: st.upTo, all: $('#print-all').checked });
    });
    $('#print-all').addEventListener('change', renderPrintCard);
    $('#in-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    $('#in-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
    $('#in-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') ($('#in-code').value ? joinRoom : createRoom)(); });

    $('#role-medium').addEventListener('click', () => pickRole('medium'));
    $('#role-scholar').addEventListener('click', () => pickRole('scholar'));
    $('#btn-levels').addEventListener('click', () => {
      const list = $('#level-list');
      list.classList.toggle('hidden');
      if (!list.classList.contains('hidden')) { renderLevelList(); list.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    $('#in-free-count').addEventListener('change', (e) => hostSetting('free', Object.assign({}, S.settings.free, { count: +e.target.value })));
    $('#in-free-needy').addEventListener('change', (e) => hostSetting('free', Object.assign({}, S.settings.free, { needy: +e.target.value })));
    $('#in-free-curses').addEventListener('change', (e) => hostSetting('free', Object.assign({}, S.settings.free, { curses: +e.target.value })));
    $('#btn-next').addEventListener('click', () => {
      if (!S.isHost || !S.nextLevel) return;
      S.settings = Object.assign({}, S.settings, { level: S.nextLevel, free: null });
      S.net.send({ t: 'toLobby' });
      toLobby();
      broadcastLobby();
    });
    $('#in-edition').addEventListener('change', (e) => {
      const v = Math.max(1, Math.min(999, Math.round(+e.target.value) || 1));
      e.target.value = v;
      hostSetting('edition', v);
    });
    $('#btn-ed-random').addEventListener('click', () => hostSetting('edition', 2 + Math.floor(Math.random() * 998)));
    $('#btn-start').addEventListener('click', hostStart);
    $('#btn-invite').addEventListener('click', async (e) => {
      const link = inviteLink();
      try { await navigator.clipboard.writeText(link); e.target.textContent = 'Copied!'; } catch (_) { prompt('Share this link:', link); }
      setTimeout(() => { e.target.textContent = 'Copy invite link'; }, 1600);
    });

    $('#btn-leave').addEventListener('click', leave);
    $('#btn-end-leave').addEventListener('click', leave);
    $('#btn-quit').addEventListener('click', () => {
      if (confirm(S.solo ? 'Abandon this séance?' : S.isHost ? 'Leaving closes the room for everyone. Leave?' : 'Leave the séance?')) leave();
    });
    $('#btn-again').addEventListener('click', () => {
      if (!S.isHost) return;
      S.net.send({ t: 'toLobby' });
      toLobby();
      broadcastLobby();
    });
    document.addEventListener('pointerdown', () => {
      audio.unlock();
      if (S.screen === 'home' || S.screen === 'lobby' || S.screen === 'study') audio.menuMusic(true);
    }, { once: true });
    setupSoundControls();
  }

  init();
})(globalThis.GR = globalThis.GR || {});

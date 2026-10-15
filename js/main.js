// Screens and the room protocol. The host owns the lobby; the Medium's browser owns the séance.
//
// Messages (every message reaches everyone; `to` limits who acts on it):
//   join {name}            guest → host      ask to sit at the table
//   role {role}            guest → host      pick 'medium' | 'scholar'
//   lobby {players,...}    host → all        the room as it stands
//   start {seed,edition,difficulty,mediumId}  host → all
//   status {...}           Medium → all      wrath, offenses, relics (twice a second)
//   end {result,...}       Medium/host → all
//   toLobby {}             host → all
//   leave {} / closed {}   someone left / the host closed the room
(function (G) {
  'use strict';
  const { el, esc } = G.util;
  const $ = (s) => document.querySelector(s);

  const params = new URLSearchParams(location.search);
  const LOCAL = params.has('local');
  const audio = new G.Sound();

  const S = {
    net: null, screen: 'home',
    me: { id: null, name: '' }, isHost: false, hostId: null, code: null,
    players: [], settings: { edition: 1, difficulty: 'restless' },
    current: null, role: null, game: null, view: null, loop: null, joinTimer: null,
  };
  window.grimoire = { S, answers: () => S.game && S.game.answers() };

  const store = (k, v) => { try { localStorage.setItem('grimoire.' + k, v); } catch (e) { /* private mode */ } };
  const load = (k) => { try { return localStorage.getItem('grimoire.' + k); } catch (e) { return null; } };

  function show(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== 'screen-' + name));
    $('#btn-quit').classList.toggle('hidden', name !== 'medium' && name !== 'scholar');
    S.screen = name;
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
    S.players = [{ id: net.id, name, role: null }];
    S.current = null;
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
    net.send({ t: 'join', name });
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
      case 'status': if (S.role === 'scholar' && S.view) S.view.status(m); break;
      case 'end': endRound(m); break;
      case 'toLobby': toLobby(); break;
      case 'closed': if (!S.isHost && m.from === S.hostId) backHome('The host closed the room.'); break;
    }
  }

  function broadcastLobby() {
    const m = { t: 'lobby', players: S.players, settings: S.settings, hostId: S.me.id, code: S.code };
    S.net.send(m);
    gotLobby(m);
  }

  function hostJoin(m) {
    if (S.players.some((p) => p.id === m.from)) return;
    const p = { id: m.from, name: String(m.name || 'Guest').slice(0, 16), role: S.current ? 'scholar' : null };
    S.players.push(p);
    broadcastLobby();
    // Arrived mid-séance: hand them the book.
    if (S.current) S.net.send(Object.assign({}, S.current, { to: m.from }));
  }

  function hostRole(id, role) {
    const p = S.players.find((x) => x.id === id);
    if (p && !S.current) {
      const mediumTaken = S.players.some((q) => q.role === 'medium' && q.id !== id);
      if (role === 'scholar' || (role === 'medium' && !mediumTaken)) p.role = role;
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
    if (S.screen === 'home') { busy(false); homeMsg(''); show('lobby'); }
    renderLobby();
  }

  // ---- Lobby -------------------------------------------------------------------
  function pickRole(role) {
    if (S.current) return;
    if (S.isHost) hostRole(S.me.id, role);
    else S.net.send({ t: 'role', role });
  }

  function hostSetting(key, value) {
    if (!S.isHost || S.current) return;
    S.settings = Object.assign({}, S.settings, { [key]: value });
    broadcastLobby();
  }

  function startCheck() {
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
      mediumId: S.players.find((p) => p.role === 'medium').id,
    };
    S.net.send(Object.assign({}, m));
    startRound(m);
  }

  function renderLobby() {
    if (S.screen !== 'lobby') return;
    $('#lobby-code').textContent = S.code || '····';
    const mine = S.players.find((p) => p.id === S.me.id);
    const medium = S.players.find((p) => p.role === 'medium');
    const mediumBtn = $('#role-medium'), scholarBtn = $('#role-scholar');
    mediumBtn.classList.toggle('mine', !!mine && mine.role === 'medium');
    scholarBtn.classList.toggle('mine', !!mine && mine.role === 'scholar');
    mediumBtn.disabled = !!medium && medium.id !== S.me.id;
    mediumBtn.querySelector('.taken').textContent = medium && medium.id !== S.me.id ? `Taken by ${medium.name}` : '';

    const list = $('#player-list');
    list.innerHTML = '';
    for (const p of S.players) {
      const li = el('li');
      const seat = p.role === 'medium' ? '🕯️ Medium' : p.role === 'scholar' ? '📖 Scholar' : 'Choosing…';
      li.innerHTML = `<span class="pname">${esc(p.name)}${p.id === S.me.id ? ' <i>(you)</i>' : ''}${p.id === S.hostId ? ' <span class="host">host</span>' : ''}</span><span class="seat ${p.role || 'none'}">${seat}</span>`;
      list.appendChild(li);
    }

    $('#settings-host').classList.toggle('hidden', !S.isHost);
    $('#settings-guest').classList.toggle('hidden', S.isHost);
    const diff = G.DIFFICULTY[S.settings.difficulty] || G.DIFFICULTY.restless;
    if (S.isHost) {
      const ed = $('#in-edition');
      if (document.activeElement !== ed) ed.value = S.settings.edition;
      $('#in-diff').value = S.settings.difficulty;
      const why = startCheck();
      $('#btn-start').disabled = !!why;
      $('#start-msg').textContent = why;
    } else {
      $('#guest-settings').textContent = `${diff.label} (${diff.blurb}) · grimoire edition ${S.settings.edition}`;
    }
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
    S.current = { t: 'start', seed: m.seed, edition: m.edition, difficulty: m.difficulty, mediumId: m.mediumId };
    S.role = m.mediumId === S.me.id ? 'medium' : 'scholar';
    audio.startAmbience();

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
        audio.setWrath(game.wrath);
        acc += dt;
        if (acc >= 0.5) { acc = 0; sendStatus(); }
      }, 100);
    } else {
      const diff = G.DIFFICULTY[m.difficulty] || G.DIFFICULTY.restless;
      S.view = G.views.grimoire($('#screen-scholar'), G.rules.build(m.edition), { smudged: !!diff.smudged });
      show('scholar');
    }
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
    strikes: ['The spirit claims the séance.', 'Three offenses. The spirit would not forgive.'],
    'medium-left': ['The circle is broken.', 'The Medium fled the séance.'],
  };

  function endRound(m) {
    stopRound();
    S.current = null;
    audio.stopAmbience();
    if (m.result === 'win') audio.win(); else audio.lose();
    const [head, text] = END_TEXT[m.reason] || END_TEXT.wrath;
    $('#end-title').textContent = head;
    $('#end-title').className = m.result === 'win' ? 'win' : 'lose';
    $('#end-text').textContent = text;
    const stats = $('#end-stats');
    stats.innerHTML = '';
    if (m.total) {
      stats.innerHTML = `<div><dt>Relics cleansed</dt><dd>${m.solved} / ${m.total}</dd></div>
        <div><dt>Offenses</dt><dd>${m.strikes}</dd></div>
        <div><dt>Time at the table</dt><dd>${G.views.fmt(m.time)}</dd></div>
        <div><dt>Edition</dt><dd>${m.edition}</dd></div>`;
    }
    $('#btn-again').classList.toggle('hidden', !S.isHost);
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

  // ---- Wiring ------------------------------------------------------------------
  function init() {
    $('#in-name').value = load('name') || '';
    const room = (params.get('room') || '').toUpperCase();
    if (room) {
      $('#in-code').value = room;
      homeMsg(`You've been invited to room ${room}. Write your name, then press Join.`);
    }
    $('#mode-note').textContent = LOCAL
      ? 'Local mode: rooms only reach other tabs in this browser.'
      : 'Play together in one room, or on a voice call — the game doesn’t carry voices.';

    const diffSel = $('#in-diff');
    for (const [k, d] of Object.entries(G.DIFFICULTY)) {
      const o = el('option', null, `${d.label} — ${d.blurb}`);
      o.value = k;
      diffSel.appendChild(o);
    }

    $('#btn-create').addEventListener('click', createRoom);
    $('#btn-join').addEventListener('click', joinRoom);
    $('#in-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
    $('#in-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
    $('#in-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') ($('#in-code').value ? joinRoom : createRoom)(); });

    $('#role-medium').addEventListener('click', () => pickRole('medium'));
    $('#role-scholar').addEventListener('click', () => pickRole('scholar'));
    diffSel.addEventListener('change', (e) => hostSetting('difficulty', e.target.value));
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
      if (confirm(S.isHost ? 'Leaving closes the room for everyone. Leave?' : 'Leave the séance?')) leave();
    });
    $('#btn-again').addEventListener('click', () => {
      if (!S.isHost) return;
      S.net.send({ t: 'toLobby' });
      toLobby();
    });
    document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  }

  init();
})(globalThis.GR = globalThis.GR || {});

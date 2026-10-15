// Whispering Doll: a "needy" relic. It can never be cleansed, only soothed.
// Every ~40 seconds it starts whispering; the Medium has 20 seconds to comfort it the way the book says.
// It never counts toward cleansing the table. The game core calls tick() so the doll keeps time without the DOM.
(function (G) {
  'use strict';
  const { el, esc } = G.util;

  // Near-identical whispers make the Medium read every word.
  const PAIRS = [
    ['I SEE YOU', 'I SEE TWO'], ['HOLD ME', 'HOLD STILL'], ['SING TO ME', 'SING FOR ME'],
    ["DON'T LEAVE", "DON'T LOOK"], ['COME CLOSER', 'COME LATER'],
  ];
  const SINGLES = [
    "I'M COLD", 'WHERE IS MOTHER', "THEY'RE WATCHING", "I CAN'T SLEEP", 'PLAY WITH ME',
    "IT'S SO DARK", "SOMEONE'S AT THE DOOR", "I'M HUNGRY", 'TELL ME A SECRET', 'THE WATER IS RISING',
    'WHO ARE YOU', 'COUNT FOR ME',
  ];
  const ACTIONS = ['ROCK', 'HUM', 'HAIR', 'EYES', 'WALL', 'BELL'];
  const ACTION_TEXT = {
    ROCK: 'Rock it', HUM: 'Hum to it', HAIR: 'Stroke its hair',
    EYES: 'Cover its eyes', WALL: 'Turn it to the wall', BELL: 'Ring its bell',
  };
  const EYES_TEXT = { open: 'Eyes open', closed: 'Eyes closed' };
  const WINDOW = 20;

  const current = (state) => state.whispers[state.cycle % state.whispers.length];

  // Fall silent and wait for the next whisper. `carry` keeps leftover time after a timeout so ticks stay exact.
  function hush(state, carry) {
    state.phase = 'quiet';
    state.cycle++;
    state.t = (carry ? state.t : 0) + current(state).quiet;
  }

  const relic = {
    id: 'doll',
    title: 'Whispering Doll',
    needy: true,
    WINDOW, ACTIONS, ACTION_TEXT,

    buildRules(rng) {
      const phrases = [...rng.sample(PAIRS, 2).flat(), ...rng.sample(SINGLES, 6)].sort();
      const table = {};
      for (const p of phrases) {
        const [open, closed] = rng.sample(ACTIONS, 2);
        table[p] = { open, closed };
      }
      return { phrases, table };
    },

    generate(rng, ctx, rules) {
      const whispers = [];
      let last = null;
      for (let k = 0; k < 16; k++) {
        let phrase;
        do phrase = rng.pick(rules.phrases); while (phrase === last);
        last = phrase;
        whispers.push({ phrase, eyes: rng.chance(0.5) ? 'open' : 'closed', quiet: k === 0 ? rng.int(25, 35) : rng.int(34, 46) });
      }
      return { whispers, cycle: 0, phase: 'quiet', t: whispers[0].quiet, soothed: 0, offended: 0 };
    },

    // Called by the game every tick. Returns 'whisper' when it starts, 'timeout' when the Medium ran out of time.
    tick(state, dt) {
      state.t -= dt;
      if (state.t > 0) return null;
      if (state.phase === 'quiet') {
        state.phase = 'whisper';
        state.t += WINDOW;
        return 'whisper';
      }
      state.offended++;
      hush(state, true);
      return 'timeout';
    },

    expected(state, ctx, rules) {
      if (state.phase !== 'whisper') return null;
      const w = current(state);
      return rules.table[w.phrase][w.eyes];
    },

    inputs() {
      return ACTIONS;
    },

    attempt(state, action, ctx, rules) {
      if (state.phase !== 'whisper') return 'quiet';
      const ok = action === relic.expected(state, ctx, rules);
      hush(state, false);
      if (!ok) { state.offended++; return 'strike'; }
      state.soothed++;
      return 'soothed';
    },

    render(root, state, api) {
      const panel = root.closest('.relic');
      const wrap = el('div', 'doll-wrap');
      const fig = el('div', 'doll');
      fig.innerHTML = `<svg viewBox="0 0 120 150" aria-hidden="true">
        <path class="d-dress" d="M38 92 Q60 82 82 92 L100 146 Q60 152 20 146 Z"/>
        <path class="d-collar" d="M44 90 Q60 100 76 90 L72 98 Q60 104 48 98 Z"/>
        <g class="d-head">
          <circle class="d-hair" cx="60" cy="50" r="36"/>
          <path class="d-hair" d="M26 52 Q20 80 30 92 L38 70 Z M94 52 Q100 80 90 92 L82 70 Z"/>
          <ellipse class="d-face" cx="60" cy="56" rx="26" ry="29"/>
          <path class="d-fringe" d="M34 46 Q46 22 60 26 Q76 22 86 46 Q72 36 60 40 Q48 36 34 46 Z"/>
          <path class="d-crack" d="M74 34 L70 44 L75 50 L71 58"/>
          <g class="eyes-open"><circle cx="49" cy="56" r="6" class="d-white"/><circle cx="71" cy="56" r="6" class="d-white"/>
            <circle cx="49" cy="57" r="3.4" class="d-pupil"/><circle cx="71" cy="57" r="3.4" class="d-pupil"/></g>
          <g class="eyes-closed"><path d="M42 57 Q49 62 56 57 M64 57 Q71 62 78 57" class="d-lid"/>
            <path d="M44 59 L42 62 M49 60.5 L49 64 M54 59 L56 62 M66 59 L64 62 M71 60.5 L71 64 M76 59 L78 62" class="d-lid"/></g>
          <circle cx="44" cy="68" r="4.5" class="d-cheek"/><circle cx="76" cy="68" r="4.5" class="d-cheek"/>
          <path class="d-mouth" d="M55 74 Q60 78 65 74"/>
          <g class="d-rage">
            <path class="d-brow" d="M40 46 L56 52 M80 46 L64 52"/>
            <ellipse cx="49" cy="57" rx="6.8" ry="7.4" class="d-void"/><ellipse cx="71" cy="57" rx="6.8" ry="7.4" class="d-void"/>
            <circle cx="49" cy="58" r="2.6" class="d-glow"/><circle cx="71" cy="58" r="2.6" class="d-glow"/>
            <path class="d-scream" d="M50 69 Q60 63 70 69 L67 86 L63 80 L60 89 L57 80 L53 86 Z"/>
            <path class="d-crack2" d="M75 50 L69 60 L74 66 L66 76 L70 84 M74 34 L82 24 M69 60 L62 63"/>
          </g>
        </g>
      </svg>`;
      const side = el('div', 'doll-side');
      const bubble = el('p', 'whisper');
      const timer = el('div', 'doll-timer');
      timer.innerHTML = '<i></i>';
      const bar = timer.querySelector('i');
      const acts = el('div', 'doll-acts');
      for (const a of ACTIONS) {
        const b = el('button', 'btn small doll-act', ACTION_TEXT[a]);
        b.type = 'button';
        b.addEventListener('click', () => {
          if (api.solved()) return;
          const res = api.attempt(a);
          if (res !== 'quiet') feedback(res === 'soothed');
          update();
        });
        acts.appendChild(b);
      }
      side.append(bubble, timer, acts);
      wrap.append(fig, side);
      root.appendChild(wrap);
      root.appendChild(el('p', 'relic-tip', 'It cannot be cleansed. When it whispers, read the words aloud and say whether its eyes are open.'));

      let phase = null, lastSec = -1, offended = state.offended, lashUntil = 0, lashTimer = null;
      const SHRIEKS = ['NO!', 'LIAR!', 'WRONG!', 'YOU LEFT ME!', 'NOT LIKE THAT!'];
      function feedback(good) {
        panel.classList.remove('hushed', 'angered');
        void panel.offsetWidth;
        panel.classList.add(good ? 'hushed' : 'angered');
        if (good) { api.audio.hush(); return; }
        // It lashes out: eyes blaze, the head lunges and screams, the crack spreads — then it sinks back.
        fig.classList.remove('lashing');
        void fig.getBoundingClientRect();
        fig.classList.add('lashing');
        lashUntil = Date.now() + 1600;
        bubble.textContent = SHRIEKS[Math.floor(Math.random() * SHRIEKS.length)];
        bar.style.width = '0%';
        bubble.classList.add('shriek');
        api.audio.dollShriek();
        clearTimeout(lashTimer);
        lashTimer = setTimeout(() => { fig.classList.remove('lashing'); bubble.classList.remove('shriek'); update(); }, 1700);
      }
      function update() {
        const whispering = state.phase === 'whisper' && !api.solved();
        if (state.offended !== offended) {
          if (phase === 'whisper' && state.phase === 'quiet') feedback(false);
          offended = state.offended;
        }
        if (state.phase !== phase) {
          phase = state.phase;
          if (whispering) api.audio.whisper();
        }
        const w = current(state);
        fig.classList.toggle('awake', whispering);
        fig.classList.toggle('open', whispering && w.eyes === 'open');
        panel.classList.toggle('whispering', whispering);
        if (Date.now() < lashUntil) return;
        bubble.textContent = whispering ? `“${w.phrase}”` : '…';
        bubble.classList.toggle('on', whispering);
        bar.style.width = whispering ? (100 * Math.max(0, state.t) / WINDOW).toFixed(1) + '%' : '0%';
        const sec = whispering ? Math.ceil(state.t) : -1;
        if (sec !== lastSec && sec > 0 && sec <= 5) api.audio.tick();
        lastSec = sec;
      }
      update();
      return { update, destroy: () => clearTimeout(lashTimer) };
    },

    // Every table cell the smudged grimoire may blot out, with exactly the text manual() prints there.
    smudgeables(rules) {
      const out = [];
      for (const p of rules.phrases) {
        for (const eyes of ['open', 'closed']) {
          out.push({ key: `${p}.${eyes}`, where: `the “${EYES_TEXT[eyes]}” comfort for ${p}`, value: ACTION_TEXT[rules.table[p][eyes]] });
        }
      }
      return out;
    },

    manual(rules, smudge) {
      const ink = G.util.inker(smudge);
      let html = `<p class="lead">The doll cannot be cleansed — only soothed. It sits quiet for a while, then begins to whisper.
        From the moment it whispers, the Medium has <strong>${WINDOW} seconds</strong> to comfort it.</p>
        <p class="lead">Have the Medium read the whisper word for word and say whether the doll's <b>eyes are open</b>.
        Find the whisper below and give the comfort in that column. The wrong comfort, or none in time, is an offense.</p>
        <table class="grid"><thead><tr><th>It whispers…</th><th>${EYES_TEXT.open}</th><th>${EYES_TEXT.closed}</th></tr></thead><tbody>`;
      for (const p of rules.phrases) {
        const r = rules.table[p];
        html += `<tr><td class="word">${esc(p)}</td><td>${ink(`${p}.open`, ACTION_TEXT[r.open])}</td><td>${ink(`${p}.closed`, ACTION_TEXT[r.closed])}</td></tr>`;
      }
      html += '</tbody></table><p class="note">The doll never counts toward cleansing the table. Once soothed, it falls quiet until it whispers again.</p>';
      return html;
    },
  };

  G.relics.doll = relic;
})(globalThis.GR = globalThis.GR || {});

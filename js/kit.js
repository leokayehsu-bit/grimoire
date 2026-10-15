// Building blocks shared by the relics: ordered instruction lists, needy timing, small HTML helpers.
(function (G) {
  'use strict';
  const { el } = G.util;

  // One instruction: `say(blot)` prints the sentence around its one blot-able word (what a smudged copy may lose).
  const rule = (blot, say, test, pick) => ({ blot, say, text: say(blot), test, pick });

  function firstRule(set, args) {
    for (let i = 0; i < set.rules.length; i++) if (set.rules[i].test(...args)) return i;
    return set.rules.length;
  }

  function pickFrom(set, args) {
    const i = firstRule(set, args);
    return i < set.rules.length ? set.rules[i].pick(...args) : set.fallback;
  }

  // "Obey the first instruction that holds true." Rejects lists where a line almost never fires,
  // so the book never prints dead text. sample(probeRng) returns the argument list for test()/pick().
  function coveredSet(rng, makeSet, sample, { tries = 30, trials = 500, min = 0.05 } = {}) {
    const probe = G.util.makeRng(0xC0FFEE);
    const tests = Array.from({ length: trials }, () => sample(probe));
    let best = null;
    for (let k = 0; k < tries; k++) {
      const set = makeSet(rng);
      const hits = new Array(set.rules.length + 1).fill(0);
      for (const t of tests) hits[firstRule(set, t)]++;
      const score = Math.min(...hits) / trials;
      if (!best || score > best.score) best = { set, score };
      if (score >= min) break;
    }
    return best.set;
  }

  // ---- Needy relics: quiet for a while, then call out; the Medium has WINDOW seconds to answer. ----
  const WINDOW = 20;
  const needy = {
    WINDOW,
    QUIET: { first: [30, 50], next: [34, 46] },
    generate(rng, makeCall) {
      const calls = [];
      for (let k = 0; k < 16; k++) {
        const q = k === 0 ? needy.QUIET.first : needy.QUIET.next;
        calls.push(Object.assign(makeCall(rng, k, calls[k - 1]), { quiet: rng.int(q[0], q[1]) }));
      }
      return { calls, cycle: 0, phase: 'quiet', t: calls[0].quiet, soothed: 0, offended: 0 };
    },
    current: (s) => s.calls[s.cycle % s.calls.length],
    hush(s, carry) {
      s.phase = 'quiet';
      s.cycle++;
      s.t = (carry ? s.t : 0) + needy.current(s).quiet;
    },
    tick(s, dt) {
      s.t -= dt;
      if (s.t > 0) return null;
      if (s.phase === 'quiet') {
        s.phase = 'whisper';
        s.t += WINDOW;
        return 'whisper';
      }
      s.offended++;
      needy.hush(s, true);
      return 'timeout';
    },
    attempt(s, ok) {
      if (s.phase !== 'whisper') return 'quiet';
      needy.hush(s, false);
      if (!ok) { s.offended++; return 'strike'; }
      s.soothed++;
      return 'soothed';
    },

    // A standard needy panel: a figure, what it is doing, a countdown bar and the action buttons.
    // opts: figure (HTML), awakeClass(call) → extra classes, prompt(call) → text, actions [{id,label}], tip, onCall
    panel(root, state, api, opts) {
      const panel = root.closest('.relic');
      const wrap = el('div', 'needy-wrap');
      const fig = el('div', 'needy-fig');
      fig.innerHTML = opts.figure;
      const side = el('div', 'needy-side');
      const prompt = el('p', 'needy-prompt');
      const timer = el('div', 'needy-timer');
      timer.innerHTML = '<i></i>';
      const bar = timer.querySelector('i');
      const acts = el('div', 'needy-acts');
      for (const a of opts.actions) {
        const b = el('button', 'btn small needy-act', a.label);
        b.type = 'button';
        b.addEventListener('click', () => {
          if (api.solved()) return;
          const res = api.attempt(a.id);
          if (res !== 'quiet') feedback(res === 'soothed');
          update();
        });
        acts.appendChild(b);
      }
      side.append(prompt, timer, acts);
      wrap.append(fig, side);
      root.appendChild(wrap);
      if (opts.tip) root.appendChild(el('p', 'relic-tip', opts.tip));

      let phase = null, lastSec = -1, offended = state.offended, extra = '';
      function feedback(good) {
        panel.classList.remove('hushed', 'angered');
        void panel.offsetWidth;
        panel.classList.add(good ? 'hushed' : 'angered');
        if (good) api.audio.hush();
      }
      function update() {
        const awake = state.phase === 'whisper' && !api.solved();
        if (state.offended !== offended) {
          if (phase === 'whisper' && state.phase === 'quiet') feedback(false);
          offended = state.offended;
        }
        const call = needy.current(state);
        if (state.phase !== phase) {
          phase = state.phase;
          if (awake && opts.onCall) opts.onCall(call);
        }
        if (extra) fig.classList.remove(...extra.split(' '));
        extra = awake ? (opts.awakeClass ? opts.awakeClass(call) : '') : '';
        if (extra) fig.classList.add(...extra.split(' '));
        fig.classList.toggle('awake', awake);
        panel.classList.toggle('whispering', awake);
        prompt.textContent = awake ? opts.prompt(call) : (opts.idle || '…');
        prompt.classList.toggle('on', awake);
        bar.style.width = awake ? (100 * Math.max(0, state.t) / WINDOW).toFixed(1) + '%' : '0%';
        const sec = awake ? Math.ceil(state.t) : -1;
        if (sec !== lastSec && sec > 0 && sec <= 5) api.audio.tick();
        lastSec = sec;
      }
      update();
      return { update };
    },
  };

  // ---- HTML helpers ----
  const table = (head, rows) =>
    '<table class="grid"><thead><tr>' + head.map((h) => `<th>${h}</th>`).join('') + '</tr></thead><tbody>' +
    rows.map((r) => '<tr>' + r.map((c, i) => (i === 0 ? `<td class="word">${c}</td>` : `<td>${c}</td>`)).join('') + '</tr>').join('') +
    '</tbody></table>';

  // A strike/solve flash on any element.
  function react(node, res) {
    node.classList.remove('wrong', 'right');
    void node.offsetWidth;
    if (res === 'strike') node.classList.add('wrong');
    else if (res === 'solved' || res === 'ok' || res === 'stage') node.classList.add('right');
  }

  // Repeat `fn` on a timer until destroyed; returns { stop }.
  function loop(fn, firstDelay) {
    let dead = false, timer = null;
    const later = (f, ms) => { clearTimeout(timer); timer = setTimeout(() => { if (!dead) f(later); }, ms); };
    later(() => fn(later), firstDelay);
    return { stop: () => { dead = true; clearTimeout(timer); }, later };
  }

  G.kit = { rule, firstRule, pickFrom, coveredSet, needy, table, react, loop };
})(globalThis.GR = globalThis.GR || {});

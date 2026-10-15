// When the spirit wins: the candles die, a red flicker shows its face, it lunges at the glass with a
// scream, the screen cracks, and the verdict bleeds in. About four and a half seconds; a click skips it.
(function (G) {
  'use strict';
  const { el } = G.util;

  const VERDICT = {
    wrath: 'Its wrath boiled over.',
    strikes: 'You offended it once too often.',
  };

  const FACE = `<svg class="dz-face" viewBox="0 0 200 240" aria-hidden="true">
      <defs>
        <radialGradient id="dzSkin" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#e9e4ef"/><stop offset="0.7" stop-color="#9c97a8"/><stop offset="1" stop-color="#2a2430"/></radialGradient>
        <radialGradient id="dzEye" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff3a2a"/><stop offset="0.35" stop-color="#7a0a08"/><stop offset="1" stop-color="#000"/></radialGradient>
      </defs>
      <path class="dz-hair" d="M30 120 Q10 40 100 18 Q190 40 170 120 L184 236 L150 170 L140 236 L112 176 L100 238 L88 176 L60 236 L50 170 L16 236 Z"/>
      <path d="M52 92 Q54 40 100 36 Q146 40 148 92 Q150 160 124 196 Q100 222 76 196 Q50 160 52 92 Z" fill="url(#dzSkin)"/>
      <ellipse cx="78" cy="98" rx="17" ry="21" fill="url(#dzEye)"/><ellipse cx="122" cy="98" rx="17" ry="21" fill="url(#dzEye)"/>
      <circle class="dz-pupil" cx="78" cy="100" r="3.5"/><circle class="dz-pupil" cx="122" cy="100" r="3.5"/>
      <path d="M96 118 L100 140 L104 118" fill="#3a3040" opacity="0.7"/>
      <path d="M76 158 Q100 146 124 158 Q122 196 100 200 Q78 196 76 158 Z" fill="#050306"/>
      <path d="M82 160 L86 170 L90 159 L95 171 L100 158 L105 171 L110 159 L114 170 L118 160" fill="none" stroke="#d8d2c8" stroke-width="2"/>
      <path d="M60 70 Q78 60 94 74 M106 74 Q122 60 140 70" fill="none" stroke="#2a2430" stroke-width="4" stroke-linecap="round"/>
    </svg>`;

  const CRACKS = `<svg class="dz-cracks" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M52 48 L40 20 L36 0 M52 48 L78 30 L100 22 M52 48 L88 62 L100 70 M52 48 L64 82 L70 100 M52 48 L30 70 L8 84 L0 88 M52 48 L18 44 L0 38
        M40 20 L28 14 M78 30 L84 12 M88 62 L94 80 M30 70 L32 88 M18 44 L10 58 M64 82 L52 92"/>
    </svg>`;

  // Plays the sequence over everything; resolves when it ends or is skipped.
  // gentle (Settings → Jumpscares off): the room just fades to dark red and the verdict appears.
  function play({ reason, audio, gentle = false }) {
    return new Promise((resolve) => {
      const root = el('div', 'death');
      if (gentle) root.classList.add('dz-gentle');
      root.innerHTML = `<div class="dz-black"></div><div class="dz-red"></div>${gentle ? '' : FACE + CRACKS}
        <div class="dz-words"><h1>The spirit claims you</h1><p>${VERDICT[reason] || VERDICT.wrath}</p></div>
        <span class="dz-skip">click to continue</span>`;
      document.body.appendChild(root);
      document.body.classList.add('dying');
      if (audio) {
        if (gentle) { audio.stopScore(0.8); audio.lose(); } else audio.death();
      }

      let done = false;
      const timers = [];
      const at = (ms, fn) => timers.push(setTimeout(fn, ms));
      const finish = () => {
        if (done) return;
        done = true;
        timers.forEach(clearTimeout);
        root.classList.add('dz-out');
        setTimeout(() => { root.remove(); document.body.classList.remove('dying'); }, 450);
        removeEventListener('keydown', finish);
        resolve();
      };
      if (gentle) {
        at(10, () => root.classList.add('dz-dark'));
        at(700, () => root.classList.add('dz-verdict'));
        at(1000, () => { root.addEventListener('click', finish); addEventListener('keydown', finish); });
        at(3600, finish);
        return;
      }
      // Stages, driven by classes so the CSS owns the look. The hit at 0.9 s lines up with audio.death().
      at(10, () => root.classList.add('dz-dark'));        // candles die
      at(380, () => root.classList.add('dz-flicker'));    // red flicker, the face in the dark
      at(900, () => root.classList.add('dz-lunge'));      // it rushes the glass, screaming
      at(1250, () => root.classList.add('dz-crack'));     // the glass breaks
      at(1650, () => root.classList.add('dz-verdict'));   // the words bleed in
      at(1900, () => { root.addEventListener('click', finish); addEventListener('keydown', finish); });
      at(4600, finish);
    });
  }

  G.death = { play };
})(globalThis.GR = globalThis.GR || {});

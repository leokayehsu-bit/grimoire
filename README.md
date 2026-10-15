# Grimoire

A co-op "one sees, the others read" party game. The **Medium** sits at a séance table covered in cursed relics but can't read the book. The **Scholars** hold the grimoire but never see the table. Talk it through and cleanse every relic before the spirit's wrath boils over.

## Play

- Open `index.html` through any static server (or the `grimoire` preview, port 8778).
- **Create a room** → share the 4-letter code or the invite link → one player picks Medium, the rest pick Scholar → host presses **Begin**.
- Rooms use [PeerJS](https://peerjs.com): the free PeerJS cloud server only introduces players, then game data goes browser-to-browser. Voice isn't carried, so play in one room or on a call.
- Add `?local` to the URL for offline testing with several tabs in one browser (BroadcastChannel, no internet).

To play with friends elsewhere, the files need to be hosted somewhere public (GitHub Pages and itch.io HTML games are both free).

## Layout

| File | What it does |
| --- | --- |
| `js/util.js` | Seeded RNG (mulberry32), hashing, text/DOM helpers |
| `js/seance.js` | Table context (spirit name, death year, moon, bone charms, sigils) and the condition pool rules draw from |
| `js/relics/*.js` | One file per relic: `buildRules`, `generate`, `expected`, `attempt`, `inputs`, `render`, `manual` |
| `js/rules.js` | Builds a whole grimoire edition from its number (cached) |
| `js/game.js` | DOM-free séance: wrath timer, offenses, win/lose |
| `js/views.js` | Medium table view and Scholar grimoire view |
| `js/net.js` | Rooms (PeerJS online, BroadcastChannel local) |
| `js/main.js` | Screens + room protocol (host owns lobby, Medium's browser owns the séance) |
| `tests/check.js` | Headless solver test |

**Single source of truth:** each rule is one object holding both the sentence printed in the grimoire and the test/pick the game runs, so the book can never disagree with the game.

## Test

```
node tests/check.js 300 5000
```

Builds 300 editions and plays 5000 séances: every relic must accept exactly one input, a perfect Medium must always win, three offenses must lose, and wrath must run out on time.

## Adding a relic

Create `js/relics/<id>.js` with the interface above, add a `<script>` tag, add the id to `G.RELIC_ORDER` in `rules.js`, add it to `FILES` in `tests/check.js`, and run the test.

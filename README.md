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
| `js/relics/*.js` | One file per relic: `buildRules`, `generate`, `expected`, `attempt`, `inputs`, `render`, `manual(rules, smudge)`, `smudgeables` |
| `js/kit.js` | Shared relic helpers: ordered instruction lists with coverage checks, needy timing/panel, tables |
| `js/levels.js` | Chapters, the 40 levels, difficulty terms, table planning, progress rules |
| `js/rules.js` | Builds a whole grimoire edition from its number (cached), its smudges, and each page's HTML (`G.rules.page`) |
| `js/game.js` | DOM-free séance: wrath timer, offenses, win/lose |
| `js/views.js` | Medium table view and Scholar grimoire view |
| `js/net.js` | Rooms (PeerJS online, BroadcastChannel local) |
| `js/main.js` | Screens + room protocol (host owns lobby, Medium's browser owns the séance) |
| `tests/check.js` | Headless solver test |

## Campaign

40 levels in five chapters (The Parlour, The Library, The Chapel, The Attic, The Crypt), defined in `js/levels.js`. Each level has a name, a description, a number of relics, a time limit and an offense allowance, and most introduce one new relic, which adds a page to the grimoire. The book in a séance only shows pages introduced up to that level.

Any level can be played at any difficulty:

- **Restless** — 25% more time, one extra offense.
- **Vengeful** — the level as written.
- **Damned** — 20% less time, one fewer offense (never below one), and the **smudged grimoire**: on every page one entry has run, and its value is pencilled into the margin of a different page under the same sign.

Progress is saved in each browser (`localStorage` key `grimoire.progress.v1`). Clearing a level on any difficulty opens the next; everyone in a winning room gets the credit. `?unlockall` opens every level for testing without saving. **Free séance** draws random relics from everything you have met.

## Relics

Cleansed: Ritual Candles, Tarot Spread, Spirit Board, Haunted Dollhouse, Locked Diary, Music Box, Spirit Bell, Haunted Mirror, Weathered Headstone, Crystal Ball, Gramophone, Pendulum, Knucklebones, The Raven, Palm Reading, Salt Circle (multi-step), Apothecary Shelf (multi-step).

Needy (never cleansed, only answered within 20 seconds when they call): Whispering Doll, Guttering Lantern, Creeping Door. Needy relics share timing and their panel through `G.kit.needy`.

**Single source of truth:** each rule is one object holding both the sentence printed in the grimoire and the test/pick the game runs, so the book can never disagree with the game.

## Test

```
node tests/check.js 300 6000
```

Builds 300 editions and plays 5000 séances: every relic must accept exactly one input, a perfect Medium must always win, three offenses must lose, and wrath must run out on time. The doll must whisper on schedule with exactly one right comfort, punish silence after 20s, and never count toward the win. Every smudged page must have exactly one smudge, restored by exactly one margin note on another page, and writing that note's value back must reproduce the clean page exactly.

## Adding a relic

Create `js/relics/<id>.js` with the interface above, add a `<script>` tag in `index.html`, and give it an introduction level in `js/levels.js` (the test fails if a relic is introduced zero or two times). The test picks up every file in `js/relics/` automatically. Print every value a smudge may hide through `ink(key, html)` and list it in `smudgeables`.

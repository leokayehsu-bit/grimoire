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
| `js/relics/doll.js` | The Whispering Doll, a *needy* relic (`needy: true` + `tick`): never cleansed, only soothed |
| `js/rules.js` | Builds a whole grimoire edition from its number (cached), its smudges, and each page's HTML (`G.rules.page`) |
| `js/game.js` | DOM-free séance: wrath timer, offenses, win/lose |
| `js/views.js` | Medium table view and Scholar grimoire view |
| `js/net.js` | Rooms (PeerJS online, BroadcastChannel local) |
| `js/main.js` | Screens + room protocol (host owns lobby, Medium's browser owns the séance) |
| `tests/check.js` | Headless solver test |

## Difficulties

- **Restless** — 3 relics, 5:00.
- **Vengeful** — 4 relics plus the **Whispering Doll**, 5:00. Every ~40s the doll whispers; the Medium has 20s to give the comfort the book lists for that whisper and whether its eyes are open. Wrong comfort or silence is an offense. It never counts toward the win.
- **Damned** — as Vengeful at 3:30, and the Scholars get the **smudged grimoire**: on every relic page one entry has run and shows only a sign (☿, ♄, …). The lost entry is pencilled into the margin of a *different* page under the same sign.

**Single source of truth:** each rule is one object holding both the sentence printed in the grimoire and the test/pick the game runs, so the book can never disagree with the game.

## Test

```
node tests/check.js 300 5000
```

Builds 300 editions and plays 5000 séances: every relic must accept exactly one input, a perfect Medium must always win, three offenses must lose, and wrath must run out on time. The doll must whisper on schedule with exactly one right comfort, punish silence after 20s, and never count toward the win. Every smudged page must have exactly one smudge, restored by exactly one margin note on another page, and writing that note's value back must reproduce the clean page exactly.

## Adding a relic

Create `js/relics/<id>.js` with the interface above, add a `<script>` tag, add the id to `G.RELIC_ORDER` (or `G.NEEDY_ORDER` for a needy relic) in `rules.js`, add it to `FILES` in `tests/check.js`, and run the test. Print every value a smudge may hide through `ink(key, html)` and list it in `smudgeables`.

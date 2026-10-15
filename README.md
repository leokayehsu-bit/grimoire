# Grimoire

A co-op "one sees, the others read" party game. The **Medium** sits at a séance table covered in cursed relics but can't read the book. The **Scholars** hold the grimoire but never see the table. Talk it through and cleanse every relic before the spirit's wrath boils over.

## Play

- Open `index.html` through any static server (or the `grimoire` preview, port 8778).
- **Create a room** → share the 4-letter code or the invite link → one player picks Medium, the rest pick Scholar → host presses **Begin**.
- Rooms use [PeerJS](https://peerjs.com): the free PeerJS cloud server only introduces players, then game data goes browser-to-browser. Voice isn't carried, so play in one room or on a call.
- Add `?local` to the URL for offline testing with several tabs in one browser (BroadcastChannel, no internet).

**One screen:** “Play on one screen” on the main menu skips rooms entirely. This computer is the Medium, and the Scholars read a **printed grimoire**. The print card prints the book for the chosen edition (pages you've unlocked, or every page), in the smudged version when Damned is picked; a level that adds a page offers to print just that page. The printable book is a plain link: `?print&edition=N&upto=L` (or `&all`, or `&only=<relic>`, plus `&smudged`; `&noauto` skips the print dialog). “Read the grimoire” has a print button too.

**Ratings:** every win earns 1–3 candles (cleansed; no offenses; under 60% of the time limit). Each browser keeps its best candles and time per level and difficulty (in `grimoire.progress.v1`), shown on the end screen, the level card, the level list (with chapter totals) and the main menu.

**App + offline:** the site is an installable web app (`manifest.webmanifest`, `sw.js`, icons from `tools/icons.sh`). The service worker fetches the page network-first (so online players always run the latest release) and serves the `?v=`-stamped scripts from its cache, so one-screen play, the grimoire and printing work offline. It is skipped on localhost unless you add `?sw`. `tools/publish.sh` stamps `sw.js` so installed apps update.

**Sound:** everything is synthesised in `js/audio.js` (no audio files). Effects and music run through separate buses into a shared stone-room reverb. The séance score is adaptive: `setIntensity({ wrath, strikes, remaining })` drives a drone, organ chords and a music box when calm, then a quickening heartbeat, trembling strings, a choir and a ticking clock as the wrath rises, with booms in the final 15 seconds and stingers at 50/75/90% wrath. Scholars hear the score and every offense or cleansing through the Medium's status updates. Menus get a quiet music-box version. Music and effects volumes (bottom-left 🔊) are saved per browser.

**Colour labels:** Settings (bottom-left ⚙) → Colour labels names every colour a relic uses — candles, bell ribbon, crystal-ball mist, lantern flame, pendulum crystal, apothecary liquids, gramophone record, the light under the door and the rings in Palm Reading — for colourblind players. Each relic renders a hidden `.cb-label`; `body.cb` shows them.

**The Medium's table:** relics sit on a wood-grain séance table (`.seance-table`) under flickering candlelight with drifting dust (a small canvas), each on a velvet cloth with brass corners and an engraved nameplate; a red wax seal is pressed on when a relic is cleansed. Every relic has its own sounds (pinched candles, burning cards, dial clicks and a latch, glass chimes and cracks, chisel on stone, bone clatter, pouring salt, bubbling jars, a crackly gramophone tune, wings…) on top of the shared offense/cleansing cues; quiet ones are scaled by `BOOST` in `js/audio.js`.

**What Scholars see:** only the offense marks (the Music Box page depends on them). No timer, wrath meter, cleansed count or relic names, so the Medium has to describe the table. They still feel the wrath: the red vignette closes in and throbs faster, the screen shakes on offenses, glows on cleansings, and the music follows the Medium's séance.

**Crossplay:** the app and the website are the same build. Every player's release stamp travels with them into a room; if anyone's differs from the host's, the lobby says who must reload and the séance can't start, so nobody plays with different rules.

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

## Curses

Curses (`js/curses.js`) change what players can see, never the rules. They arrive after the Library, each introduced alone and then mixed into later levels (`CURSE_LEVELS` in `js/levels.js`):

| Level | Curse | Affects | Effect |
| --- | --- | --- | --- |
| 18 | Blackout | Medium | the room goes black for a few seconds now and then |
| 22 | Poltergeist | Scholars | the grimoire flips to a random page |
| 26 | Looking-Glass | Medium | the table is mirrored; the book still means the real left |
| 30 | Lying Whispers | Medium | false instructions drift across the table |
| 34 | Silent Hour | Medium | the Medium's timer and wrath meter vanish |
| 39 | Darkness | Medium | only a pool of light follows the Medium's hand |

Damned adds one more curse you have met; free séances can add 0–2 at random. `G.levels.cursesFor(level, difficulty, seed)` decides them from the séance seed, so every player agrees. The grimoire has a Curses page.

**Losing:** when the spirit wins (wrath or offenses), everyone watches it claim them — candles die, its face flickers in red, lunges at the glass with a scream, the glass cracks, and the verdict bleeds in (`js/death.js`, `audio.death()`), before the end screen. A click skips it. Settings → Jumpscares (on by default, per device) turns it into a gentle fade to dark red with the verdict and no face, flash or scream.

## Bosses

Each chapter ends with a boss (`js/bosses.js`, `BOSS_LEVELS` in `js/levels.js`). Twists strike at set points of the wrath and are always recoverable by talking — nothing is ever lost, only moved, hidden or turned:

| Level | Boss | Twist |
| --- | --- | --- |
| 8 | The Widow | tears a Scholar page out; the Medium gets it and reads it aloud until that relic is cleansed |
| 16 | The Librarian | scratches out every page title and shuffles the tabs; pages are found by their content |
| 24 | The Abbess | turns the Medium's table upside down |
| 32 | The Collector | swaps every nameplate on the Medium's table |
| 40 | The Spirit Unbound | all of the above in phases |

The Medium's browser owns the timing and reports `torn` and `bossFired` in its status so the Scholars' book follows.

## Daily séance

`G.levels.dailyLevel('YYYY-MM-DD')` builds one table per day from the date alone — relics, needy relic, curse, grimoire edition and seed — so everyone gets the same séance. It's in the level list ("Today's séance"), always Vengeful, with every page in the book. Each browser keeps its best result per day (`grimoire.daily.v1`), a streak, and a share line for the end screen.

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

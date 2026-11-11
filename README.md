# Recuerdoot

A Kahoot-style quiz about shared memories. A host shows the questions on a big screen while players answer from their phones, or a single person plays solo in the browser. Questions can include audio clips, images, video and background music, and each answer can reveal the original moment.

It is a static site: it runs on GitHub Pages with no backend. The host's browser runs the match and phones connect to it directly over WebRTC. Questions and media are loaded in the host's browser from a folder or `.zip` and are never uploaded anywhere.

The UI is in Spanish and follows the Genesis design system (see [`DESIGN.md`](DESIGN.md)).

## Quick start

On the deployed site (or locally, see below):

1. Prepare a quiz folder with `questions.json` and your media (see [Quiz packs](#quiz-packs)).
2. Open the site on the computer connected to the big screen and click **Elegir carpeta** or **Elegir .zip**, or drag the folder or zip onto the card. The quiz is checked and saved in that browser.
3. Click **Multijugador**. Players scan the QR code or open the address shown, type the PIN and their name.

### Local development

Requires Node.js 20.11 or newer.

```bash
npm install
npm start
```

Open `http://localhost:8000`. If there is a `questions.json` in the project root (or at `QUESTIONS_PATH`), the dev server offers it automatically, with media under `assets/`, and the lobby QR uses your LAN address so phones on the same Wi-Fi can join. Otherwise load a quiz from the start screen as on the deployed site.

To check that your local questions file is valid and every media file exists:

```bash
npm run validate:questions
```

## Deploying to GitHub Pages

`.github/workflows/pages.yml` runs the tests, builds the site with `npm run build` and deploys `dist/` on every push to `main`. Enable it once in the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The build copies an explicit allowlist (the two pages, `assets/css`, `assets/js`, `assets/templates`, the two default music tracks and the vendor scripts from `node_modules`), so a local `questions.json` or private media can never be published. Any static host works the same way: serve the contents of `dist/`.

### Network requirements

- The host and the phones need internet access. The host registers its PIN on the free public [PeerJS](https://peerjs.com) signalling server; after the WebRTC handshake, game messages travel directly between browsers (or through PeerJS's public TURN relay when a network blocks direct connections).
- Phones do not need to be on the same Wi-Fi as the host.
- Media files are only ever played on the host, so they never travel over the network.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm start` | Starts the local dev server on port 8000 with live reload. |
| `npm run start-external` | Opens a Cloudflare quick tunnel and starts the dev server with its public URL in the join QR. Rarely needed now: the deployed site already has a public address. |
| `npm test` | Runs the test suite (`node --test`): state machines, shared helpers, question and pack validation, game logic, a full match over an in-memory transport and the dev server routes. |
| `npm run build` | Builds the static site into `dist/` (`BUILD_DIR` overrides the folder). |
| `npm run validate:questions` | Validates the local questions file (`QUESTIONS_PATH`, or `questions.json` by default) and checks that every referenced media file exists under `assets/`. |
| `npm run check` | `validate:questions` followed by `test`. |

### Environment variables (dev server)

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8000` | HTTP port. |
| `PUBLIC_BASE_URL` | LAN address | Base URL used for the join link and QR code. Set automatically by `start-external`. |
| `QUESTIONS_PATH` | `./questions.json` | Local questions file offered on the start screen (and checked by `validate:questions`). |
| `LIVERELOAD` | enabled | Set to `0` to disable live reload (it only loads if the dev dependencies are installed). |
| `CLOUDFLARED_PATH` | — | Absolute path to `cloudflared`. Otherwise it is looked up in `/opt/homebrew/bin`, `/usr/local/bin` and `/usr/bin`. |

## How to play

### Solo

Click **Jugar solo**. Answer each question by clicking a tile or pressing `1`–`6`. A feedback sheet shows whether you were right and reveals the media; press **Siguiente** or `→` to continue. There is no timer in solo mode.

### Multiplayer

1. The host clicks **Multijugador**. The lobby shows a 6-digit PIN, the join address and a QR code, and plays waiting music.
2. Players open `/player.html` (the QR code fills in the PIN), type their name and join. Up to 10 players.
3. The host clicks **Empezar** (or presses `→`). Everyone sees a 5-second countdown.
4. Each question:
   - **Normal questions**: 20-second answer window.
   - **Audio questions** (`before.audio`): 3 seconds to read, then the clip plays on the host; when it ends, a 10-second answer window opens. Phones show the options from the start and players may answer while listening. Pressing the play button while the clip plays skips straight to the answers.
   - The round ends early once every connected player has answered. A gong marks the end.
5. **Reveal**: answer distribution chart and the revealed media. **Ver marcador** shows the top 5 with rank changes and scores counting up.
6. After the last question the podium shows the winner and the final top 5.

Scoring: a correct answer is worth between 1000 and 100 points, falling linearly with the time since the question appeared (over 20 seconds). Wrong answers and timeouts score 0 and reset the streak. Each phone shows the result, points, position, total and streak after every round.

The host can leave at any time with **Salir** (after confirmation), which ends the match for everyone. Closing or reloading the host tab ends the match too (phones are told right away, or notice within 10 seconds if the host lost its connection). Players who have already seen the final results keep them.

Player phones keep their session in `sessionStorage`: refreshing, locking the screen or briefly losing the connection reconnects and rejoins the same player in the same state.

Click **Jugar solo** or **Multijugador** only once a quiz is loaded (see [Quiz packs](#quiz-packs)); both buttons stay disabled until then.

### Keyboard shortcuts (host)

| Key | Action |
|-----|--------|
| `→` | Main action on screen: start the match, see the scoreboard, next question, next in solo. |
| `1`–`6` | Answer in solo mode. |

### Host console helpers

Run these in the host browser's developer console:

| Helper | Returns |
|--------|---------|
| `getHostState()` | `{ state, mode, pin, progress, pack }` |
| `getMatchState()` | The match engine's view: phase, question index, player names and scores, how many answered (never the answers or player ids). `{ phase: "idle" }` without a match. |
| `getCurrentRanking()` | Current ranking as `{ name, score }[]` |
| `listDisconnectedPlayers()` | Disconnected players as `{ playerId, name, score }[]` |
| `purgeDisconnectedPlayers()` | Removes every disconnected player from the current match |

`getPlayerState()` is available in the player page console.

## Quiz packs

A quiz pack is `questions.json` plus the media it uses:

```
my-quiz/
├─ questions.json
├─ audios/
├─ images/
├─ videos/
└─ music/
```

The host loads it from the start screen as a **folder**, a **`.zip`** (with `questions.json` at the root or inside one top-level folder) or a lone **`questions.json`** (no media, or media as `https://` URLs), by picking it or dragging it onto the card. The pack is validated in the browser and every problem is listed with its question number. A valid pack is copied to IndexedDB (only `questions.json` and the files it references), so it is still there after a reload; **Quitar** deletes it. Media plays from `blob:` URLs and never leaves the host's browser. A starter file is published at `assets/templates/questions.json`.

### `questions.json`

An ordered JSON array; questions play in that order. Example:

```json
[
  {
    "question": "¿En qué ciudad fue el primer viaje del grupo?",
    "answers": { "right": "Lisboa", "wrong": ["Roma", "París", "Oporto"] },
    "before": { "image": "first-trip-blurred.jpg" },
    "after": { "image": "first-trip.jpg" }
  },
  {
    "question": "¿Quién dijo \"mañana empiezo la dieta\"?",
    "answers": { "right": "Laura", "wrong": ["Marta", "Sofía", "Carmen", "Elena"] },
    "before": { "audio": "PTT-20190704-WA0001_filtered.mp3" },
    "after": { "audio": "PTT-20190704-WA0001.mp3" }
  },
  {
    "question": "¿Qué canción sonaba en la fiesta de graduación?",
    "answers": { "right": "Canción A", "wrong": ["Canción B", "Canción C", "Canción D", "Canción E", "Canción F"] },
    "before": { "music": "party-instrumental.mp3" },
    "after": { "video": "graduation.mp4", "music": "party.mp3" }
  }
]
```

| Field | Required | Description |
|-------|----------|-------------|
| `question` | Yes | Text shown on the host. A phrase in double quotes is highlighted. |
| `answers.right` | Yes | The correct answer. |
| `answers.wrong` | Yes | 3 to 5 wrong answers, so each question has 4, 5 or 6 options. All options must be different. |
| `before` | No | Media shown with the question: any mix of `audio`, `image`, `video` and `music` (file names or `https://` URLs). |
| `after` | No | Media revealed after answering: any mix of `audio`, `image`, `video` and `music`. |

Behaviour:

- Options are shuffled at runtime. Five options render as two rows plus a centred last tile of the same width; six options as three rows of two.
- `before.audio` turns the question into an audio question (see the multiplayer flow above). In solo, the clip is played manually.
- `before.music` loops quietly during the question. Without it, the host plays `assets/music/default.mp3`.
- `after.music` loops during the reveal. Foreground clips duck the background music while they play.
- If an audio file name contains a date as `YYYYMMDD` (for example WhatsApp's `PTT-20190704-WA0001.mp3`), the reveal shows it as "4 julio 2019".

### Media lookup

A file name of kind `audio`, `image`, `video` or `music` is looked up in the pack's `audios/`, `images/`, `videos/` or `music/` folder, then in `assets/<folder>/`, then next to `questions.json`, and finally as a file with that name anywhere in the pack if it is unique (case-insensitive).

With the dev server's own `questions.json`, files live in `assets/audios/`, `assets/images/`, `assets/videos/` and `assets/music/`. Those folders are ignored by git except `assets/music/default.mp3` (question loop) and `assets/music/waiting.mp3` (lobby loop).

To make a voice harder to recognise, use a filtered copy with the `_filtered` suffix in `before.audio` and the original in `after.audio`. To generate filtered versions with [SoX](https://sourceforge.net/projects/sox/):

```bash
for f in audios/*.mp3; do
  [[ "$f" == *_filtered.mp3 ]] && continue
  base=$(basename "$f" .mp3)
  sox -v 0.5 "$f" "audios/${base}_filtered.mp3" pitch -320 highpass 120 lowpass 3200 bass 3 equalizer 500 1.0q 4 overdrive 8 compand 0.005,0.08 -24,-24,-12,-10,-6,-5 0 -24
done
```

## Project structure

```
server.js                  Dev server entry point: reads env vars, starts lib/app.js
start-external.js          Cloudflare tunnel launcher for the dev server
lib/
  app.js                   Dev server: static files, vendor scripts, local questions.json, config.json
  questions.js             Reads questions.json from disk (CLI and tests)
  network.js               LAN IP and join URL helpers
  vendor.js                Browser libraries served from node_modules (PeerJS, qrcode-generator, fflate)
scripts/
  build.js                 Builds the static site into dist/ (allowlist only)
  validate-questions.js    CLI behind `npm run validate:questions`
.github/workflows/pages.yml  Test, build and deploy to GitHub Pages
index.html                 Host page (solo + multiplayer big screen)
player.html                Player phone page
assets/
  css/main.css             All styles; design tokens at the top
  js/game-config.js        Shared constants (timings, scoring, limits, transport); browser + Node
  js/state-machines.js     Every state machine definition + createStateMachine(); browser + Node
  js/game-shared.js        Shared helpers: question normalisation, media resolution, CSPRNG, dates, sounds, start countdown
  js/game-engine.js        Game class: match rules, scoring, timers, phase machine; browser + Node
  js/match-host.js         Runs a match in the host browser and routes player connections; browser + Node
  js/peer-transport.js     WebRTC transport (PeerJS) with heartbeat and phone reconnection
  js/quiz-pack.js          questions.json validation and pack media lookup; browser + Node
  js/pack-loader.js        Reads folders, zips and drops; blob URLs; IndexedDB storage
  js/host-pack.js          Quiz card on the start screen (driven by the pack state machine)
  js/ui-shell.js           Theme (before first paint), dot grid, toasts
  js/host-media.js         Host audio: foreground clips, ducked background music, fades
  js/host-leaderboard.js   Leaderboard rendering, rank movement, score count-up
  js/host.js               Host controller (driven by the host state machine)
  js/player.js             Player controller (driven by the player state machine)
  templates/questions.json Starter questions file linked from the start screen
test/                      node:test suites and fixtures
docs/state-machines.md     Every state machine, its states and events
DESIGN.md                  Design system
AGENTS.md                  Guide for coding agents
```

The dev server only serves `index.html`, `player.html`, `config.json`, `questions.json`, `assets/` and the allowlisted vendor scripts. Source files, `package.json` and `node_modules` are never exposed.

## Architecture

There is no game server. When the host clicks **Multijugador**, `match-host.js` creates a `Game` (`game-engine.js`) in the host's browser and registers `recuerdoot-<PIN>` on the PeerJS signalling server (a new PIN is drawn if that id is taken). Phones open `player.html`, connect to that id over a WebRTC data channel and exchange `{ e: event, p: payload }` JSON messages. Both sides send a heartbeat every 2 s and drop a link that is silent for 10 s; phones reconnect automatically and rejoin with their `playerId`. The host is authoritative: phones only ever receive their options and results, never the correct answer or any media.

All flows are explicit state machines declared in `assets/js/state-machines.js` and documented in [`docs/state-machines.md`](docs/state-machines.md):

- **game** (match engine, in the host browser): `lobby → starting → listening/answering → reveal → … → end → closed`
- **host** (host page): `start`, `solo-*`, `multi-*`; the state decides which screen is visible
- **pack** (host start screen): `empty → loading → ready | invalid`
- **player** (phone): `join → joining → waiting → countdown → answering → answered → result → … → ended`

The current state is exposed as `document.body.dataset.state` on both pages.

### Match messages

Host commands are local calls (`match.command(name)`); everything else travels over the data channels.

| Direction | Event | Payload |
|-----------|-------|---------|
| host page → engine | `host:start`, `host:answersOpen`, `host:timeUp`, `host:next`, `host:purgeDisconnected` | — |
| player → host | `player:join` | `{ pin, name, playerId? }` |
| player → host | `player:answer` | `{ answer }` |
| engine → host page | `host:playerList` | `[{ playerId, name, score, connected }]` |
| engine → host page | `host:question` | `{ index, total, question, options, audioBefore, before, totalPlayers, countdownBefore, countdownAfter }` |
| engine → host page | `host:answerCount` | `{ answered, total }` |
| engine → host page | `host:reveal` | `{ correct, optionCounts, leaderboard, date, after }` |
| host → player | `player:joined` | `{ name, pin, playerId }` |
| host → player | `player:error` | message |
| host → player | `player:question` | `{ index, total, options, audioBefore, answersOpen, hasAnswered, selectedAnswer }` |
| host → player | `player:answersOpen` | `{ index }` |
| host → player | `player:result` | `{ isCorrect, points, rank, score, streak, timeout }` |
| host → player | `player:gameOver` | message |
| host → room | `game:startCountdown` | `{ seconds, startsAt }` |
| host → room | `game:end` | `{ leaderboard }` |

## Design

The design system lives in [`DESIGN.md`](DESIGN.md): Genesis tokens (indigo accent for interaction only, General Sans + DM Sans + JetBrains Mono, 4px grid, flat bordered cards) plus the game-specific answer palette and shapes. The UI supports light and dark themes (system by default, with a toggle on the host) and reduced motion.

Host gameplay screens (`#question-screen`, `#reveal-screen`, `#scoreboard-screen`, `#multiplayer-end-screen`) always fit the viewport without scrolling.

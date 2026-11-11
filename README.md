# Recuerdoot

A Kahoot-style quiz about shared memories. A host shows the questions on a big screen while players answer from their phones, or a single person plays solo in the browser. Questions can include audio clips, images, video and background music, and each answer can reveal the original moment.

The UI is in Spanish and follows the Genesis design system (see [`DESIGN.md`](DESIGN.md)).

## Quick start

Requires Node.js 20.11 or newer.

```bash
npm install
# create questions.json (see the format below)
npm start
```

Open `http://localhost:8000`. Players join from their phones at the address shown in the lobby, or by scanning the QR code.

To check that your questions file is valid and every media file exists:

```bash
npm run validate:questions
```

## Scripts

| Command | What it does |
|---------|--------------|
| `npm start` | Starts the server on port 8000 with live reload. |
| `npm run start-external` | Opens a Cloudflare quick tunnel and starts the server with its public URL, so players can join from outside your network. |
| `npm test` | Runs the test suite (`node --test`): state machines, shared helpers, question validation, game logic and an end-to-end Socket.IO match. |
| `npm run validate:questions` | Validates the questions file (`QUESTIONS_PATH`, or `questions.json` by default) and checks that every referenced media file exists. |
| `npm run check` | `validate:questions` followed by `test`. |

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8000` | HTTP port. |
| `PUBLIC_BASE_URL` | LAN address | Base URL used for the join link and QR code. Set automatically by `start-external`. |
| `QUESTIONS_PATH` | `./questions.json` | Questions file to load (and to check with `validate:questions`). |
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

The host can leave at any time with **Salir** (after confirmation), which ends the match for everyone. If the host disconnects, the match ends too. Players who have already seen the final results keep them.

Player phones keep their session in `sessionStorage`: refreshing or briefly losing the connection rejoins the same player in the same state.

### Keyboard shortcuts (host)

| Key | Action |
|-----|--------|
| `→` | Main action on screen: start the match, see the scoreboard, next question, next in solo. |
| `1`–`6` | Answer in solo mode. |

### Host console helpers

Run these in the host browser's developer console:

| Helper | Returns |
|--------|---------|
| `getHostState()` | `{ state, mode, pin, progress }` |
| `getCurrentRanking()` | Current ranking as `{ name, score }[]` |
| `listDisconnectedPlayers()` | Disconnected players as `{ playerId, name, score }[]` |
| `purgeDisconnectedPlayers()` | Removes every disconnected player from the current match |

`getPlayerState()` is available in the player page console, and `GET /api/state` returns the server's view of the match (phase, question index, player names and scores, how many answered; never the answers or player ids).

## `questions.json`

`questions.json` is private and ignored by git, so you need to create it. It is an ordered JSON array; questions play in that order. Example:

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
    "answers": { "right": "Bailando", "wrong": ["Despacito", "La Bicicleta", "Waka Waka", "Danza Kuduro", "Vivir mi vida"] },
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
| `before` | No | Media shown with the question: any mix of `audio`, `image`, `video` and `music` (file names). |
| `after` | No | Media revealed after answering: any mix of `audio`, `image`, `video` and `music`. |

Behaviour:

- Options are shuffled at runtime. Five options render as two rows plus a centred last tile of the same width; six options as three rows of two.
- `before.audio` turns the question into an audio question (see the multiplayer flow above). In solo, the clip is played manually.
- `before.music` loops quietly during the question. Without it, the host plays `assets/music/default.mp3`.
- `after.music` loops during the reveal. Foreground clips duck the background music while they play.
- If an audio file name contains a date as `YYYYMMDD` (for example WhatsApp's `PTT-20190704-WA0001.mp3`), the reveal shows it as "4 julio 2019".
- The server validates the file when a multiplayer match is created and reports every problem with the question number.

### Media files

| Kind | Folder |
|------|--------|
| `audio` | `assets/audios/` |
| `image` | `assets/images/` |
| `video` | `assets/videos/` |
| `music` | `assets/music/` |

All media folders are ignored by git except `assets/music/default.mp3` (question loop) and `assets/music/waiting.mp3` (lobby loop).

To make a voice harder to recognise, use a filtered copy with the `_filtered` suffix in `before.audio` and the original in `after.audio`. To generate filtered versions with [SoX](https://sourceforge.net/projects/sox/):

```bash
for f in assets/audios/*.mp3; do
  [[ "$f" == *_filtered.mp3 ]] && continue
  base=$(basename "$f" .mp3)
  sox -v 0.5 "$f" "assets/audios/${base}_filtered.mp3" pitch -320 highpass 120 lowpass 3200 bass 3 equalizer 500 1.0q 4 overdrive 8 compand 0.005,0.08 -24,-24,-12,-10,-6,-5 0 -24
done
```

## Project structure

```
server.js                  Entry point: reads env vars, starts the server
start-external.js          Cloudflare tunnel launcher
lib/
  app.js                   Express + Socket.IO wiring, HTTP routes, one active game
  game.js                  Game class: match rules, scoring, timers, phase machine
  questions.js             questions.json loading and validation
  network.js               LAN IP and join URL helpers
scripts/
  validate-questions.js    CLI behind `npm run validate:questions`
index.html                 Host page (solo + multiplayer big screen)
player.html                Player phone page
assets/
  css/main.css             All styles; design tokens at the top
  js/game-config.js        Shared constants (timings, scoring, limits); server + browser
  js/state-machines.js     Every state machine definition + createStateMachine(); server + browser
  js/game-shared.js        Shared helpers: question normalisation, CSPRNG shuffle, dates, sounds, start countdown
  js/ui-shell.js           Theme (before first paint), dot grid, toasts
  js/host-media.js         Host audio: foreground clips, ducked background music, fades
  js/host-leaderboard.js   Leaderboard rendering, rank movement, score count-up
  js/host.js               Host controller (driven by the host state machine)
  js/player.js             Player controller (driven by the player state machine)
test/                      node:test suites and fixtures
docs/state-machines.md     Every state machine, its states and events
DESIGN.md                  Design system
AGENTS.md                  Guide for coding agents
```

The server only serves `index.html`, `player.html`, `questions.json` and `assets/`. Source files, `package.json` and `node_modules` are never exposed.

## Architecture

All flows are explicit state machines declared in `assets/js/state-machines.js` and documented in [`docs/state-machines.md`](docs/state-machines.md):

- **game** (server): `lobby → starting → listening/answering → reveal → … → end → closed`
- **host** (host page): `start`, `solo-*`, `multi-*`; the state decides which screen is visible
- **player** (phone): `join → joining → waiting → countdown → answering → answered → result → … → ended`

The current state is exposed as `document.body.dataset.state` on both pages.

### Socket events

| Direction | Event | Payload |
|-----------|-------|---------|
| host → server | `host:create` | — |
| host → server | `host:start`, `host:answersOpen`, `host:timeUp`, `host:next`, `host:end`, `host:purgeDisconnected` | — |
| player → server | `player:join` | `{ pin, name, playerId? }` |
| player → server | `player:answer` | `{ answer }` |
| server → host | `host:created` | `{ pin, joinBaseUrl, joinUrl, qrSvg }` |
| server → host | `host:error` | message |
| server → host | `host:playerList` | `[{ playerId, name, score, connected }]` |
| server → host | `host:question` | `{ index, total, question, options, audioBefore, before, totalPlayers, countdownBefore, countdownAfter }` |
| server → host | `host:answerCount` | `{ answered, total }` |
| server → host | `host:reveal` | `{ correct, optionCounts, leaderboard, date, after }` |
| server → player | `player:joined` | `{ name, pin, playerId }` |
| server → player | `player:error` | message |
| server → player | `player:question` | `{ index, total, options, audioBefore, answersOpen, hasAnswered, selectedAnswer }` |
| server → player | `player:answersOpen` | `{ index }` |
| server → player | `player:result` | `{ isCorrect, points, rank, score, streak, timeout }` |
| server → player | `player:gameOver` | message |
| server → room | `game:startCountdown` | `{ seconds, startsAt }` |
| server → room | `game:end` | `{ leaderboard }` |

## Design

The design system lives in [`DESIGN.md`](DESIGN.md): Genesis tokens (indigo accent for interaction only, General Sans + DM Sans + JetBrains Mono, 4px grid, flat bordered cards) plus the game-specific answer palette and shapes. The UI supports light and dark themes (system by default, with a toggle on the host) and reduced motion.

Host gameplay screens (`#question-screen`, `#reveal-screen`, `#scoreboard-screen`, `#multiplayer-end-screen`) always fit the viewport without scrolling.

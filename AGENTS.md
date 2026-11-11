# Recuerdoot - Agent Context

## What is this project?

A Kahoot-style multiplayer quiz about shared memories, built with Node.js (Express + Socket.IO) and plain browser JavaScript (no bundler, no framework). A host shows questions on a big screen while players answer from their phones; there is also a solo mode. User-facing docs are in `README.md`, the design system in `DESIGN.md`, and every state machine in `docs/state-machines.md`.

## Commands

```bash
npm install
npm start                    # server on :8000 with live reload
npm test                     # node --test: unit + Socket.IO end-to-end
npm run validate:questions   # schema + media existence check for questions.json
npm run check                # validate:questions && test
```

Useful env vars: `PORT`, `PUBLIC_BASE_URL`, `QUESTIONS_PATH` (for example `test/fixtures/questions.json` to try the app with 3 short questions), `LIVERELOAD=0`.

Live reload reloads both pages whenever an HTML, CSS or JS file under `assets/` changes. A host reload disconnects the host and ends the match, so expect that while editing during a manual test.

## Architecture

- **server.js**: entry point only (env vars, `listen`, logs).
- **lib/app.js**: `createApp(options)` builds Express + Socket.IO without listening (tests use port 0). Holds the single active `Game`, maps socket events to `Game` methods, generates the PIN (`crypto.randomInt`) and the join QR code (server-side SVG). Serves only `index.html`, `player.html`, `questions.json`, `/assets` and `GET /api/state`.
- **lib/game.js**: `Game` class with all match rules (joining, scoring, timers, reveal, reconnection). It never touches Socket.IO; everything goes through the injected `emit(target, event, payload)`.
- **lib/questions.js**: reads and validates `questions.json` (`validateQuestions` returns readable messages with the question number).
- **lib/network.js**: LAN IP and join URL resolution.
- **scripts/validate-questions.js**: CLI behind `npm run validate:questions`.
- **index.html / player.html**: markup only. Screens are `<section class="screen">` toggled with the `hidden` attribute.
- **assets/js/** (classic scripts exposing `globalThis.RECUERDOOT_*`; the shared ones also `module.exports` for Node):
  - `game-config.js`: every shared constant (timings, scoring, limits, default music). Server and browser.
  - `state-machines.js`: `MACHINES.game | host | player` transition tables + `createStateMachine()`. Server and browser.
  - `game-shared.js`: `normalizeQuestion`, CSPRNG `randomInt`/`shuffle`, `parseDateParts`, `escapeHtml`, `ANSWER_SHAPES`, sound cues, start-countdown overlay.
  - `ui-shell.js`: loaded in `<head>`: theme before first paint, dot-grid spotlight, `showToast`.
  - `host-media.js`: foreground clip + ducked background music with fades.
  - `host-leaderboard.js`: leaderboard rendering, FLIP row movement, score count-up; pure helpers are unit-tested.
  - `host.js` / `player.js`: page controllers.
- **assets/css/main.css**: all styles; Genesis tokens at the top (`light-dark()` for both themes).
- **test/**: `node:test` suites; `test/fixtures/questions.json` is a generic 3-question fixture.

## State machines (read before changing any flow)

All flows are explicit; see `docs/state-machines.md` for diagrams and the meaning of each state.

- Add or rename states only in `assets/js/state-machines.js`, then update the controller's lookup maps (`SCREEN_BY_STATE`, `PHASE_LABEL_BY_STATE`, etc.), the docs and the tests.
- Server: guard every command with an explicit phase check before calling `transition()`. Invalid server transitions throw on purpose.
- Host and player: change screens only by transitioning the machine. The `subscribe` callback shows the right screen and syncs nav, chips and `document.body.dataset.state`. Don't toggle screens or keep parallel boolean flags.
- Re-entering the current state is allowed and notifies listeners (used for rejoins). So guard user actions with `machine.is(...)` before transitioning, never with the return value of `transition()`.
- Inspect state with `GET /api/state`, `getHostState()`, `getPlayerState()` or `body[data-state]`.

## questions.json

Private and gitignored (the format and a generic example are in `README.md`). Never commit it or real media, and never copy real questions, names or file names into tests or docs; use generic ones.

```json
{
  "question": "The question text",
  "answers": { "right": "Correct answer", "wrong": ["Wrong 1", "Wrong 2", "Wrong 3"] },
  "before": { "audio": "clip_filtered.mp3", "image": "photo.jpg", "video": "clip.mp4", "music": "loop.mp3" },
  "after": { "audio": "clip.mp3", "image": "photo.jpg", "video": "clip.mp4", "music": "loop.mp3" }
}
```

- `answers.wrong` has 3 to 5 entries (4 to 6 options in total), and all options must be different.
- `before` and `after` are optional; any mix of `audio`, `image`, `video` and `music`, resolved to `assets/audios|images|videos|music/`.
- `before.audio` makes it an audio question (filtered clip before, original after).
- Options are shuffled at runtime by `normalizeQuestion`; questions play in file order.
- Dates for reveal captions come from `YYYYMMDD` in the audio file name.

## Key conventions

- All UI text is in Spanish.
- No inline JavaScript or inline styles in HTML; no `innerHTML` with unescaped data (use `escapeHtml` or DOM nodes).
- Ids for singleton hooks, classes for shared styling.
- Never use `Math.random` (SonarCloud S2245): use `randomInt`/`shuffle` from `game-shared.js` or `crypto` on the server.
- Never spawn binaries through `PATH` (S4036): use `process.execPath` or absolute paths.
- No remote `<script>` tags without SRI; the QR code is generated on the server.
- Keep functions small (SonarCloud cognitive complexity) and don't duplicate logic between server and browser; put it in a shared `assets/js` module.
- Design follows `DESIGN.md` (Genesis): indigo only for interactive elements, 12px cards / 6px buttons, General Sans + DM Sans + JetBrains Mono, at most two weights (500/700) per screen, shadows only on hover and popovers, the dot grid is the only decoration. Answer colours and shapes are fixed per slot.
- Host gameplay screens (`.screen-stage`) must fit the viewport with no page scrolling.
- Reveal order: question → revealed media → chart → scoreboard. The first scoreboard appears directly; later ones animate from the previous order. Leaderboards show the top 5.
- Audio: without `before.music` the host loops `assets/music/default.mp3`; the lobby loops `assets/music/waiting.mp3`; foreground clips duck the music; the start countdown ticks each second on host and phones; a gong marks the end of every multiplayer question, including early ends.
- Multiplayer scoring: correct answers earn 1000 → 100 points, linear over 20 s from when the question appeared.

## Testing expectations

- Run `npm test` before finishing; add or adjust tests for any change to `lib/`, `state-machines.js`, `game-shared.js` or `host-leaderboard.js`.
- `test/game.test.js` drives `Game` with `t.mock.timers`; `test/server.test.js` plays a full match over real sockets (about 6 s because of the real start countdown).
- For UI changes, verify both pages in a browser (light and dark themes, a phone-sized viewport for `player.html`) with `QUESTIONS_PATH=test/fixtures/questions.json` for a quick run.

## Audio filter command (sox)

```bash
sox -v 0.5 input.mp3 input_filtered.mp3 pitch -320 highpass 120 lowpass 3200 bass 3 equalizer 500 1.0q 4 overdrive 8 compand 0.005,0.08 -24,-24,-12,-10,-6,-5 0 -24
```

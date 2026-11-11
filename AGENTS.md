# Recuerdoot - Agent Context

## What is this project?

A Kahoot-style multiplayer quiz about shared memories, built with plain browser JavaScript (no bundler, no framework) and deployed as a static site on GitHub Pages. A host shows questions on a big screen while players answer from their phones; there is also a solo mode. The host's browser runs the match and phones connect to it over WebRTC (PeerJS). Quizzes ("packs": `questions.json` plus media) are loaded in the host's browser and never uploaded. A small Node server exists only for local development. User-facing docs are in `README.md`, the design system in `DESIGN.md`, every state machine in `docs/state-machines.md`, and the quiz creation guide for people and AI assistants in `docs/quiz-guide.md`.

## Commands

```bash
npm install
npm start                    # dev server on :8000 with live reload
npm test                     # node --test: unit, match over an in-memory transport, dev server routes
npm run build                # static site into dist/ (what GitHub Pages serves)
npm run validate:questions   # schema + media existence check for questions.json (or QUESTIONS_PATH)
npm run check                # validate:questions && test
```

Useful env vars (dev server): `PORT`, `PUBLIC_BASE_URL`, `QUESTIONS_PATH` (for example `test/fixtures/questions.json` to try the app with 3 short questions), `LIVERELOAD=0`.

Live reload reloads both pages whenever an HTML, CSS or JS file under `assets/` changes. A host reload ends the match, so expect that while editing during a manual test.

Deployment: `.github/workflows/pages.yml` runs the tests, `npm run build` and deploys `dist/` on every push to `main` (Pages source must be "GitHub Actions").

## Architecture

- **Static site**: `index.html`, `player.html`, `assets/`, `quiz-guide.md` (from `docs/`), `config.json` and `assets/vendor/*` (PeerJS, qrcode-generator, fflate, copied from `node_modules`). `scripts/build.js` copies an explicit allowlist into `dist/`, so private media under `assets/` or a root `questions.json` can never be published.
- **Dev server** (`server.js` + `lib/app.js`): serves the same files, the vendor scripts straight from `node_modules` (`lib/vendor.js` is the single list), a local `questions.json` with media under `assets/`, and a dynamic `config.json` (`{ joinBaseUrl, serverQuestions }`: LAN or tunnel address for the QR, and whether to offer the local questions). The build writes a static `config.json` with neither. There is no game logic on the server.
- **lib/questions.js**: reads `questions.json` from disk for the CLI and tests (validation itself is shared). **lib/network.js**: LAN IP and join URL resolution.
- **index.html / player.html**: markup only. Screens are `<section class="screen">` toggled with the `hidden` attribute.
- **assets/js/** (classic scripts exposing `globalThis.RECUERDOOT_*`; the shared ones also `module.exports` for Node and `require` their dependencies there):
  - `game-config.js`: every shared constant (timings, scoring, limits, default music, transport timeouts). Browser + Node.
  - `state-machines.js`: `MACHINES.game | host | player | pack` transition tables + `createStateMachine()`. Browser + Node.
  - `game-shared.js`: `normalizeQuestion` (with a pluggable `resolveMedia`), `isRemoteMedia`, CSPRNG `randomInt`/`shuffle`/`randomId`, `parseDateParts`, `escapeHtml`, `ANSWER_SHAPES`, sound cues, start-countdown overlay. Browser + Node.
  - `game-engine.js`: `Game` class with all match rules (joining, scoring, timers, reveal, reconnection). It never touches the network; everything goes through the injected `emit(target, event, payload)`. Browser + Node.
  - `match-host.js`: `createMatchHost({ questions, listen, onEvent })` runs one match in the host browser: draws the PIN (retrying when the peer id is taken), owns the `Game`, accepts only `player:join`/`player:answer` from phones and routes `emit` to the host page, one connection or the room. Network injected, so tests use an in-memory transport. Browser + Node.
  - `peer-transport.js`: PeerJS `listen` for the host and `createPeerClient` for phones (heartbeat, reconnection, wrong-PIN and failure callbacks). Browser only.
  - `quiz-pack.js`: Spanish `validateQuestions`, `listMediaReferences`, pack path indexing and media lookup (`indexPackPaths`, `resolvePackPath`, `findMissingMedia`). Browser + Node.
  - `pack-loader.js`: reads folders, zips (fflate) and drops; builds packs with `blob:` URLs; IndexedDB persistence. Browser only.
  - `host-pack.js`: the quiz card on the start screen, driven by `MACHINES.pack`; also copies the AI-assistant prompt.
  - `ui-shell.js`: loaded in `<head>`: theme before first paint, dot-grid spotlight, `showToast`.
  - `host-media.js`: foreground clip + ducked background music with fades.
  - `host-leaderboard.js`: leaderboard rendering, FLIP row movement, score count-up; pure helpers are unit-tested.
  - `host.js` / `player.js`: page controllers.
- **assets/css/main.css**: all styles; Genesis tokens at the top (`light-dark()` for both themes).
- **test/**: `node:test` suites; `test/fixtures/questions.json` is a generic 3-question fixture.

## State machines (read before changing any flow)

All flows are explicit; see `docs/state-machines.md` for diagrams and the meaning of each state.

- Add or rename states only in `assets/js/state-machines.js`, then update the controller's lookup maps (`SCREEN_BY_STATE`, `PHASE_LABEL_BY_STATE`, `TITLE_BY_STATE`, etc.), the docs and the tests.
- Match engine: guard every command with an explicit phase check before calling `transition()`. Invalid engine transitions throw on purpose (match-host catches and logs them so a bug cannot kill the transport).
- Host, pack card and player: change screens only by transitioning the machine. The `subscribe` callback shows the right screen and syncs nav, chips and `document.body.dataset.state`. Don't toggle screens or keep parallel boolean flags.
- Re-entering the current state is allowed and notifies listeners (used for rejoins). So guard user actions with `machine.is(...)` before transitioning, never with the return value of `transition()`.
- Inspect state with `getHostState()`, `getMatchState()` (host console), `getPlayerState()` or `body[data-state]`.

## Quiz packs and questions.json

A pack is a folder or `.zip` with `questions.json` and `audios/`, `images/`, `videos/`, `music/`. Real quizzes are private: never commit a root `questions.json` or real media, and never copy real questions, names or file names into tests or docs; use generic ones. The format is described in `README.md` and, for end users and their AI assistants, in `docs/quiz-guide.md`.

```json
{
  "question": "The question text",
  "answers": { "right": "Correct answer", "wrong": ["Wrong 1", "Wrong 2", "Wrong 3"] },
  "before": { "audio": "clip_filtered.mp3", "image": "photo.jpg", "video": "clip.mp4", "music": "loop.mp3" },
  "after": { "audio": "clip.mp3", "image": "photo.jpg", "video": "clip.mp4", "music": "loop.mp3" }
}
```

- `answers.wrong` has 3 to 5 entries (4 to 6 options in total), and all options must be different.
- `before` and `after` are optional; any mix of `audio`, `image`, `video` and `music`, as file names or `https://` URLs.
- File lookup in a pack: `<kind folder>/<file>`, `assets/<kind folder>/<file>`, `<file>` at the root, then a unique file with that name anywhere (case-insensitive). The dev server's own `questions.json` resolves to `assets/audios|images|videos|music/`.
- `before.audio` makes it an audio question (filtered clip before, original after).
- Options are shuffled at runtime by `normalizeQuestion`; questions play in file order.
- Dates for reveal captions come from `YYYYMMDD` in the audio file name.
- `assets/js/quiz-pack.js` is the source of truth for the rules and messages. When they change, update `docs/quiz-guide.md` too, including its embedded Python validator.

## Key conventions

- All UI text is in Spanish (so are validation messages and `docs/quiz-guide.md`).
- No inline JavaScript or inline styles in HTML; no `innerHTML` with unescaped data (use `escapeHtml` or DOM nodes).
- Ids for singleton hooks, classes for shared styling.
- Never use `Math.random` (SonarCloud S2245): use `randomInt`/`shuffle`/`randomId` from `game-shared.js`.
- Never spawn binaries through `PATH` (S4036): use `process.execPath` or absolute paths.
- No remote `<script>` tags: third-party browser code is vendored from `node_modules` via `lib/vendor.js` (dev) and `scripts/build.js` (build). The QR code is drawn in the browser as one SVG path.
- Phones must never receive the correct answer or media; only the host page gets `host:*` payloads.
- Keep functions small (SonarCloud cognitive complexity) and don't duplicate logic between Node and browser; put it in a shared `assets/js` module.
- Design follows `DESIGN.md` (Genesis): indigo only for interactive elements, 12px cards / 6px buttons, General Sans + DM Sans + JetBrains Mono, at most two weights (500/700) per screen, shadows only on hover and popovers, the dot grid is the only decoration. Answer colours and shapes are fixed per slot.
- Host gameplay screens (`.screen-stage`) must fit the viewport with no page scrolling.
- Reveal order: question → revealed media → chart → scoreboard. The first scoreboard appears directly; later ones animate from the previous order. Leaderboards show the top 5.
- Audio: without `before.music` the host loops `assets/music/default.mp3`; the lobby loops `assets/music/waiting.mp3`; foreground clips duck the music; the start countdown ticks each second on host and phones; a gong marks the end of every multiplayer question, including early ends.
- Multiplayer scoring: correct answers earn 1000 → 100 points, linear over 20 s from when the question appeared.

## Testing expectations

- Run `npm test` before finishing; add or adjust tests for any change to `lib/`, `state-machines.js`, `game-shared.js`, `game-engine.js`, `match-host.js`, `quiz-pack.js` or `host-leaderboard.js`.
- `test/game.test.js` drives `Game` with `t.mock.timers`; `test/match-host.test.js` plays a full match over an in-memory transport; `test/server.test.js` checks the dev server routes.
- For UI changes, verify both pages in a browser (light and dark themes, a phone-sized viewport for `player.html`) with `QUESTIONS_PATH=test/fixtures/questions.json` for a quick run, or load a generic pack. To test the deployed flow, `npm run build` and serve `dist/` with any static server.
- WebRTC needs a real Chrome/Safari/Firefox: embedded app browsers may gather no ICE candidates, so phones never connect there. Multiplayer also needs internet access for the PeerJS signalling server.

## Audio filter command (sox)

```bash
sox -v 0.5 input.mp3 input_filtered.mp3 pitch -320 highpass 120 lowpass 3200 bass 3 equalizer 500 1.0q 4 overdrive 8 compand 0.005,0.08 -24,-24,-12,-10,-6,-5 0 -24
```

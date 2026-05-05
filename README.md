# Recuerdoot

A Kahoot-style multiplayer quiz game. A host shows questions on a big screen while players answer from their phones. Supports audio, image, video, and plain text questions.

## Design system

The UI uses a dark nostalgic quiz-night theme with:

- `Archivo Black` for display moments and bold labels
- `Outfit` for body copy and controls
- Blue accent color `#4f8cff` for primary actions and progress states
- Fixed multicolor answer tiles: red, blue, yellow, green

The canonical visual system, component rules, and design tokens live in `DESIGN.md`.

UI naming convention:

- Use ids for singleton UI hooks that appear once per screen.
- Use classes for shared and repeated styling patterns.

## Setup

```bash
npm install
node server.js
```

The server starts on port 8000. Open `http://localhost:8000` to play solo or start a multiplayer game.

For multiplayer, players join from their phones at `http://<your-ip>:8000/player.html` using the PIN shown on the host screen (or by scanning the QR code).

## Project structure

- `server.js` — Node.js server (Express + Socket.IO) handling multiplayer game logic
- `index.html` — HTML structure for host/solo screen
- `player.html` — HTML structure for player phone screen
- `assets/js/game-config.js` — Shared game configuration used by both server and client code
- `assets/js/game-shared.js` — Shared utility helpers used by server, host, and player scripts
- `assets/js/host.js` — Client-side JavaScript for host and solo mode
- `assets/js/player.js` — Client-side JavaScript for the player phone screen
- `assets/css/main.css` — Shared application styles
- `questions.json` — Ordered list of questions
- `DESIGN.md` — Design tokens and UI design guidance
- `assets/audios/` — Original and filtered audio files
- `assets/images/` — Image files
- `assets/videos/` — Video files

## `questions.json` format

An ordered JSON array. Questions play in the order defined. Every question uses the same unified structure:

```json
{
  "question": "¿Quién dijo \"Iván no me hace gracia\"?",
  "answers": { "right": "Esther", "wrong": ["Belén", "Raquel", "Paula", "Mery", "Lucía"] },
  "before": { "audio": "PTT-20140613-WA0010.mp3", "image": "image.jpg", "video": "clip.mp4", "music": "intro.mp3" },
  "after": { "audio": "PTT-20140613-WA0010.mp3", "video": "clip.mp4", "music": "reveal.mp3" }
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `question` | Yes | The question text shown to users |
| `answers` | Yes | Object with `right` (string) and `wrong` (array of 3 to 5 strings) |
| `before` | No | Media shown/played before answering. Can contain `audio`, `image`, `video`, and/or `music` (filename strings) |
| `after` | No | Media revealed after answering. Can contain `audio`, `image`, `video`, and/or `music` (filename strings) |

### Audio behavior

- `before.audio` — In multiplayer, the host waits 3s, auto-plays the audio, and then opens a 10s answer countdown after the audio ends. Players still receive the answer options immediately on their phones while the audio is playing. In solo, the user can play the audio manually and there is no forced countdown.
- `after.audio` — Audio available on the reveal screen after answering
- For filtered audio questions, use the `_filtered` version in `before.audio` and the original in `after.audio`
- When a question or reveal also has background music, that music ducks while the foreground audio is playing and returns after it ends or is stopped

### Image behavior

- `before.image` — Image is shown alongside the question

### Video behavior

- `before.video` — Video is shown alongside the question
- `after.video` — Video is shown on the reveal screen or solo result modal after answering

### Music behavior

- `before.music` — Background music plays quietly in a loop while the question is on screen
- If `before.music` is missing, the host falls back to `assets/music/default.mp3` during the question
- `after.music` — Background music plays quietly in a loop on the reveal screen or solo result modal after answering
- In multiplayer, the lobby plays `assets/music/waiting.mp3` in the background while players are joining
- Music files are loaded from `assets/music/`

### Notes

- A question can have any mix of `audio`, `image`, `video`, and `music` in `before`
- Questions can have 4, 5, or 6 total answer options
- Options are shuffled at runtime; `questions.json` stores answers in a fixed structure
- The code does not generate questions or options — everything comes directly from `questions.json`
- Five-option questions render as two rows plus a centered final answer with the same width as the others; six-option questions render as three rows of two

## Multiplayer

- Host opens `http://localhost:8000` and clicks **Multijugador**
- A 6-digit PIN and QR code are displayed on the host screen
- Players join at `http://<host-ip>:8000/player.html` with the PIN and a name (or scan QR to auto-fill PIN)
- Max 10 players
- Faster correct answers score more points (1000 max, 100 min)
- Reveal flow is split into two host views: reveal screen first, then scoreboard
- Reveal screen order is: question, revealed media, answer distribution chart, next action
- Kahoot-style bar chart shows answer distribution on the reveal screen after each question
- Leaderboard is shown on its own scoreboard screen after each round and at the end
- Host leaderboard views are capped to the top 5 players
- The first host scoreboard appears directly without movement indicators; later rounds first show the previous standings, then animate rows into the new order with up/down movement badges
- Score totals on the host scoreboard count up from the previous score to the new score during the rank transition
- After each question, each player phone shows the player's current rank, total score, and streak on the result screen
- The game-start countdown plays an audio cue on each second for both host and player screens
- When the multiplayer question countdown ends, or ends early because all players answered, the host plays a deeper gong cue
- Player phones keep their multiplayer session in `sessionStorage`, so a refresh or brief reconnect in the same tab can restore the player mid-game
- Disconnected players remain in the match state so they can rejoin, but the host can manually remove all currently disconnected players from the host browser console with `purgeDisconnectedPlayers()`

### Host console helpers

- `purgeDisconnectedPlayers()` — Removes all players currently marked as disconnected from the active multiplayer match
- `listDisconnectedPlayers()` — Returns the currently disconnected players as `{ playerId, name, score }` objects
- `getCurrentRanking()` — Returns the current multiplayer ranking as `{ name, score }` objects in ranking order

## Viewport behavior

- Host gameplay screens are designed to stay within the viewport without page scrolling
- `#question-screen`, `#reveal-screen`, `#scoreboard-screen`, and `#multiplayer-end-screen` use `100dvh`-aware sizing and `overflow: hidden`
- Reveal media shrinks to fit its content for audio-only reveals, while image and video reveals keep a larger framed presentation
- Layout sizing should prefer viewport-relative constraints over scroll-based fallback on the host screen

## Audio files

Place audio files in `assets/audios/`, music in `assets/music/`, images in `assets/images/`, and videos in `assets/videos/`.

The host uses `assets/music/default.mp3` as the default question loop when a question does not define `before.music`, and uses `assets/music/waiting.mp3` in the multiplayer lobby before the game starts.

Filtered versions use the same filename with a `_filtered` suffix (e.g., `PTT-20140627-WA0012_filtered.mp3`).

To generate filtered audios from originals:

```bash
for f in assets/audios/*.mp3; do
  [[ "$f" == *_filtered.mp3 ]] && continue
  base=$(basename "$f" .mp3)
  sox -v 0.5 "$f" "assets/audios/${base}_filtered.mp3" pitch -320 highpass 120 lowpass 3200 bass 3 equalizer 500 1.0q 4 overdrive 8 compand 0.005,0.08 -24,-24,-12,-10,-6,-5 0 -24
done
```

# Recuerdoot - Agent Context

## What is this project?

A Kahoot-style multiplayer quiz game built with Node.js (Express + Socket.IO). A host displays questions on a big screen while players answer from their phones in real-time.

## Architecture

- **server.js** — Single Node.js server handling both static file serving and WebSocket game logic. Express serves files, Socket.IO manages real-time multiplayer communication.
- **index.html** — HTML structure only: start screen, solo mode, and multiplayer host screens (lobby, question, reveal, scoreboard, end)
- **player.html** — HTML structure for multiplayer player screen (phone-optimized, join via PIN or QR)
- **assets/js/game-config.js** — Shared game constants loaded by both the server and the host page
- **assets/js/game-shared.js** — Shared helpers for countdown UI, escaping, shuffling, and date parsing used across server/client code
- **assets/js/host.js** — Client-side JavaScript for index.html (solo mode and multiplayer host logic)
- **assets/js/player.js** — Client-side JavaScript for player.html
- **assets/css/main.css** — Shared styles for both host and player screens
- **questions.json** — Ordered array of questions with a unified structure (no types/subtypes)

## questions.json format

Every question has the same structure:

```json
{
  "question": "The question text",
  "answers": { "right": "Correct answer", "wrong": ["Wrong 1", "Wrong 2", "Wrong 3", "Wrong 4", "Wrong 5"] },
  "before": { "audio": "PTT-20140627-WA0012.mp3", "image": "image.jpg", "video": "clip.mp4", "music": "intro.mp3" },
  "after": { "audio": "PTT-20140627-WA0012.mp3", "video": "clip.mp4", "music": "reveal.mp3" }
}
```

- `question` — Always present. The full question text as shown to users.
- `answers` — Always present. `right` is the correct answer string, `wrong` is an array of 3 to 5 wrong answers.
- `before` (optional) — Media shown/played with the question before answering. Can contain `audio` (filename string in `assets/audios/`), `image` (filename string in `assets/images/`), `video` (filename string in `assets/videos/`), and/or `music` (filename string in `assets/music/`).
- `after` (optional) — Media revealed after answering. Can contain `audio` (filename string in `assets/audios/`), `image` (filename string in `assets/images/`), `video` (filename string in `assets/videos/`), and/or `music` (filename string in `assets/music/`).
- For filtered audio questions: the `_filtered` version plays before answering, the original is revealed after.
- A question can have any mix of audio, image, video, and music in `before`.
- Questions can have 4, 5, or 6 total answer options.
- Options are shuffled at runtime by the code; questions.json stores them in a fixed structure.
- Five-option questions render as two rows plus a centered final answer with the same width as the others; six-option questions render as three rows of two.

## Key conventions

- All UI text is in Spanish
- Dark theme with Archivo Black display typography, Outfit body typography, and a blue accent (`#4f8cff`)
- Audio files live in `assets/audios/` (originals and filtered versions with `_filtered` suffix). Music lives in `assets/music/`. Images live in `assets/images/`. Videos live in `assets/videos/`.
- Questions play in the order defined in questions.json (no shuffle)
- For filtered audio questions: filtered audio plays before answering, original revealed after
- Multiplayer scoring: faster correct answers = more points (1000 max, 100 min, linear)
- No inline JavaScript in HTML files — all JS lives in separate `.js` files
- Multiplayer lobby shows a QR code for easy player joining
- The full visual system and UI behavior guidance live in `DESIGN.md`
- Naming convention: use ids for singleton UI hooks and classes for shared/repeated styling patterns
- Host gameplay screens should be viewport-constrained with no page scrolling
- Reveal flow order is question -> revealed media -> chart -> scoreboard
- Audio-only reveal media should shrink to fit content; image and video reveals can use a larger framed box
- Host leaderboard views are capped to the top 5 players
- The game-start countdown plays a short audio cue each second on both host and player screens
- If a question has no `before.music`, the host uses `assets/music/default.mp3` as the default question loop

## Running

```bash
npm install
node server.js
# Server on port 8000
```

## Audio filter command (sox)

```bash
sox -v 0.5 input.mp3 input_filtered.mp3 pitch -320 highpass 120 lowpass 3200 bass 3 equalizer 500 1.0q 4 overdrive 8 compand 0.005,0.08 -24,-24,-12,-10,-6,-5 0 -24
```

## Multiplayer flow

1. Host opens `/` and clicks Multijugador → creates game → shows PIN + QR code
2. Players open `/player.html` (or scan QR) → enter PIN + name → wait in lobby
3. Host starts game → questions cycle through:
   - Audio-before questions: 3s read → host auto-plays audio → 10s countdown to answer after the audio ends
   - Other questions: 30s countdown immediately
4. After each question: reveal screen with media/chart, then a separate scoreboard screen
5. End: winner crowned with the final top-5 leaderboard view

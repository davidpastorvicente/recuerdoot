# Recuerdoot - Agent Context

## What is this project?

A Kahoot-style multiplayer quiz game built with Node.js (Express + Socket.IO). A host displays questions on a big screen while players answer from their phones in real-time.

## Architecture

- **server.js** — Single Node.js server handling both static file serving and WebSocket game logic. Express serves files, Socket.IO manages real-time multiplayer communication.
- **index.html** — HTML structure only: start screen, solo mode, and multiplayer host screen (lobby, questions, countdown, bar chart, leaderboard)
- **player.html** — HTML structure for multiplayer player screen (phone-optimized, join via PIN or QR)
- **assets/js/host.js** — All client-side JavaScript for index.html (shared utilities, solo mode, multiplayer host logic)
- **assets/js/player.js** — All client-side JavaScript for player.html
- **assets/css/main.css** — Shared styles for both host and player screens
- **questions.json** — Ordered array of questions with a unified structure (no types/subtypes)

## questions.json format

Every question has the same structure:

```json
{
  "question": "The question text",
  "answers": { "right": "Correct answer", "wrong": ["Wrong 1", "Wrong 2", "Wrong 3"] },
  "before": { "audio": "PTT-20140627-WA0012.mp3", "image": "image.jpg" },
  "after": { "audio": "PTT-20140627-WA0012.mp3" }
}
```

- `question` — Always present. The full question text as shown to users.
- `answers` — Always present. `right` is the correct answer string, `wrong` is an array of 3 wrong answers.
- `before` (optional) — Media shown/played with the question before answering. Can contain `audio` (filename string in `media/audios/`) and/or `image` (filename string in `media/images/`).
- `after` (optional) — Media revealed after answering. Can contain `audio` (filename string in `media/audios/`) and/or `image` (filename string in `media/images/`).
- For filtered audio questions: the `_filtered` version plays before answering, the original is revealed after.
- A question can have both audio and image in `before`.
- Options are shuffled at runtime by the code; questions.json stores them in a fixed structure.

## Key conventions

- All UI text is in Spanish
- Dark theme with Archivo Black display typography, Outfit body typography, and a blue accent (`#4f8cff`)
- Audio files live in `media/audios/` (originals and filtered versions with `_filtered` suffix). The `media/` folder is gitignored.
- Questions play in the order defined in questions.json (no shuffle)
- For filtered audio questions: filtered audio plays before answering, original revealed after
- Multiplayer scoring: faster correct answers = more points (1000 max, 100 min, linear)
- No inline JavaScript in HTML files — all JS lives in separate `.js` files
- Multiplayer lobby shows a QR code for easy player joining
- The full visual system and UI behavior guidance live in `DESIGN.md`
- Naming convention: use ids for singleton UI hooks and classes for shared/repeated styling patterns

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
   - Audio-before questions: 3s read → auto-play audio → 5s countdown to answer
   - Other questions: 15s countdown immediately
4. After each question: bar chart with answer distribution + leaderboard
5. End: winner crowned with full leaderboard

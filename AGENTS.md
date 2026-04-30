# Recuerdoot - Agent Context

## What is this project?

A Kahoot-style multiplayer quiz game built with Node.js (Express + Socket.IO). A host displays questions on a big screen while players answer from their phones in real-time.

## Architecture

- **server.js** — Single Node.js server handling both static file serving and WebSocket game logic. Express serves files, Socket.IO manages real-time multiplayer communication.
- **index.html** — Main app: start screen, solo mode, and multiplayer host screen (lobby, questions, countdown, bar chart, leaderboard) all in one file
- **player.html** — Multiplayer player screen (phone-optimized, join via PIN)
- **questions.json** — Ordered array of questions. Three types: `audio` (with subtypes: person, year, text, custom), `photo`, `plain`.

## Key conventions

- All UI text is in Spanish
- Dark theme with Inter font, purple accent (`#7c5cfc`)
- Audio files live in `media/audios/` (originals) and `media/audios-filtered/` (sox pitch-shifted for person questions). The `media/` folder is gitignored.
- Questions play in the order defined in questions.json (no shuffle)
- For audio person questions: filtered audio plays before answering, original revealed after
- For audio text questions: quote shown as text, no audio before, audio revealed after
- Multiplayer scoring: faster correct answers = more points (1000 max, 100 min, linear)
- `Laura` never appears as a wrong option in person questions unless she is the correct answer

## Running

```bash
npm install
node server.js
# Server on port 8000
```

## Audio filter command (sox)

```bash
sox -v 0.5 input.mp3 output.mp3 pitch -320 highpass 120 lowpass 3200 bass 3 equalizer 500 1.0q 4 overdrive 8 compand 0.005,0.08 -24,-24,-12,-10,-6,-5 0 -24
```

## Multiplayer flow

1. Host opens `/` and clicks Multijugador → creates game → shows PIN
2. Players open `/player.html` → enter PIN + name → wait in lobby
3. Host starts game → questions cycle through:
   - Audio-before questions: 3s read → auto-play audio → 5s countdown to answer
   - Other questions: 15s countdown immediately
4. After each question: bar chart with answer distribution + leaderboard
5. End: winner crowned with full leaderboard

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
  "answers": { "right": "Esther", "wrong": ["Belén", "Raquel", "Paula"] },
  "before": { "audio": "PTT-20140613-WA0010.mp3", "image": "image.jpg", "video": "clip.mp4" },
  "after": { "audio": "PTT-20140613-WA0010.mp3", "video": "clip.mp4" }
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `question` | Yes | The question text shown to users |
| `answers` | Yes | Object with `right` (string) and `wrong` (array of 3 strings) |
| `before` | No | Media shown/played before answering. Can contain `audio`, `image`, and/or `video` (filename strings) |
| `after` | No | Media revealed after answering. Can contain `audio`, `image`, and/or `video` (filename strings) |

### Audio behavior

- `before.audio` — Audio plays before players can answer (3s reading time, then audio plays, then 5s countdown in multiplayer)
- `after.audio` — Audio available on the reveal screen after answering
- For filtered audio questions, use the `_filtered` version in `before.audio` and the original in `after.audio`

### Image behavior

- `before.image` — Image is shown alongside the question

### Video behavior

- `before.video` — Video is shown alongside the question
- `after.video` — Video is shown on the reveal screen or solo result modal after answering

### Notes

- A question can have any mix of `audio`, `image`, and `video` in `before`
- Options are shuffled at runtime; `questions.json` stores answers in a fixed structure
- The code does not generate questions or options — everything comes directly from `questions.json`

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

## Viewport behavior

- Host gameplay screens are designed to stay within the viewport without page scrolling
- `#question-screen`, `#reveal-screen`, `#scoreboard-screen`, and `#multiplayer-end-screen` use `100dvh`-aware sizing and `overflow: hidden`
- Reveal media shrinks to fit its content for audio-only reveals, while image and video reveals keep a larger framed presentation
- Layout sizing should prefer viewport-relative constraints over scroll-based fallback on the host screen

## Audio files

Place audio files in `assets/audios/`, images in `assets/images/`, and videos in `assets/videos/`.

Filtered versions use the same filename with a `_filtered` suffix (e.g., `PTT-20140627-WA0012_filtered.mp3`).

To generate filtered audios from originals:

```bash
for f in assets/audios/*.mp3; do
  [[ "$f" == *_filtered.mp3 ]] && continue
  base=$(basename "$f" .mp3)
  sox -v 0.5 "$f" "assets/audios/${base}_filtered.mp3" pitch -320 highpass 120 lowpass 3200 bass 3 equalizer 500 1.0q 4 overdrive 8 compand 0.005,0.08 -24,-24,-12,-10,-6,-5 0 -24
done
```

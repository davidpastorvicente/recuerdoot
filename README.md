# Recuerdoot

A Kahoot-style multiplayer quiz game. A host shows questions on a big screen while players answer from their phones. Supports audio, photo, and plain text questions.

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
- `app.js` — Client-side JavaScript for index.html
- `player.html` — HTML structure for player phone screen
- `player.js` — Client-side JavaScript for player.html
- `styles.css` — Shared styles
- `questions.json` — Ordered list of questions
- `media/audios/` — Original and filtered audio files (not in repo, add locally)
- `media/images/` — Photo files (not in repo)

## `questions.json` format

An ordered JSON array. Questions play in the order defined. Every question uses the same unified structure:

```json
{
  "question": "¿Quién dijo \"Iván no me hace gracia\"?",
  "answers": { "right": "Esther", "wrong": ["Belén", "Raquel", "Paula"] },
  "before": { "audio": "PTT-20140613-WA0010.mp3", "image": "image.jpg" },
  "after": { "audio": "PTT-20140613-WA0010.mp3" }
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `question` | Yes | The question text shown to users |
| `answers` | Yes | Object with `right` (string) and `wrong` (array of 3 strings) |
| `before` | No | Media shown/played before answering. Can contain `audio` and/or `image` (filename strings) |
| `after` | No | Media revealed after answering. Can contain `audio` (filename string) |

### Audio behavior

- `before.audio` — Audio plays before players can answer (3s reading time, then audio plays, then 5s countdown in multiplayer)
- `after.audio` — Audio available on the reveal screen after answering
- For filtered audio questions, use the `_filtered` version in `before.audio` and the original in `after.audio`

### Image behavior

- `before.image` — Image is shown alongside the question

### Notes

- A question can have both `audio` and `image` in `before`
- Options are shuffled at runtime; `questions.json` stores answers in a fixed structure
- The code does not generate questions or options — everything comes directly from `questions.json`

## Multiplayer

- Host opens `http://localhost:8000` and clicks **Multijugador**
- A 6-digit PIN and QR code are displayed on the host screen
- Players join at `http://<host-ip>:8000/player.html` with the PIN and a name (or scan QR to auto-fill PIN)
- Max 10 players
- Faster correct answers score more points (1000 max, 100 min)
- Kahoot-style bar chart shows answer distribution after each question
- Leaderboard shown after each round and at the end

## Audio files

Audio files are personal and excluded from the repo via `.gitignore`. Place them in `media/audios/`.

Filtered versions use the same filename with a `_filtered` suffix (e.g., `PTT-20140627-WA0012_filtered.mp3`).

To generate filtered audios from originals:

```bash
for f in media/audios/*.mp3; do
  [[ "$f" == *_filtered.mp3 ]] && continue
  base=$(basename "$f" .mp3)
  sox -v 0.5 "$f" "media/audios/${base}_filtered.mp3" pitch -320 highpass 120 lowpass 3200 bass 3 equalizer 500 1.0q 4 overdrive 8 compand 0.005,0.08 -24,-24,-12,-10,-6,-5 0 -24
done
```

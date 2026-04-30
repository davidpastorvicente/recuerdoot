# Recuerdoot

A Kahoot-style multiplayer quiz game. A host shows questions on a big screen while players answer from their phones. Supports audio, photo, and plain text questions.

## Setup

```bash
npm install
node server.js
```

The server starts on port 8000. Open `http://localhost:8000` to play solo or start a multiplayer game.

For multiplayer, players join from their phones at `http://<your-ip>:8000/player.html` using the PIN shown on the host screen.

## Project structure

- `server.js` — Node.js server (Express + Socket.IO) handling multiplayer game logic
- `index.html` — Solo play mode
- `host.html` — Host/projector screen for multiplayer (lobby, questions, countdown, leaderboard)
- `player.html` — Player phone screen (join, answer, results)
- `questions.json` — Ordered list of questions
- `media/audios/` — Original audio files (not in repo, add locally)
- `media/audios-filtered/` — Filtered audio files for "person" questions (not in repo)

## `questions.json` format

An ordered JSON array. Questions play in the order defined. Three question types are supported:

### Type: `audio`

Audio-based questions with subtypes:

#### Subtype: `person`

Plays filtered audio, asks who it is. After answering, reveals the original audio.

```json
{
  "type": "audio",
  "subtype": "person",
  "audio": "PTT-20140627-WA0012",
  "person": "Belén",
  "year": 2014
}
```

#### Subtype: `year`

Plays the audio, asks what year it's from.

```json
{
  "type": "audio",
  "subtype": "year",
  "audio": "PTT-20140621-WA0033",
  "person": "Belén",
  "year": 2014
}
```

#### Subtype: `text`

Shows a written quote, asks who said it. Reveals audio after answering.

```json
{
  "type": "audio",
  "subtype": "text",
  "audio": "PTT-20140613-WA0010",
  "person": "Esther",
  "year": 2014,
  "text": "Iván no me hace gracia"
}
```

#### Subtype: `custom`

Custom question with your own answers. Optionally plays audio before answering.

```json
{
  "type": "audio",
  "subtype": "custom",
  "audio": "PTT-20160428-WA0001",
  "person": "Mery",
  "year": 2016,
  "audioBefore": true,
  "question": "¿De quién habla Mery?",
  "correctAnswer": "Don Arturo",
  "wrongAnswers": ["Doña Marta", "Jesús Uceda", "Don Carlos"]
}
```

### Type: `photo`

Shows a photo with a question.

```json
{
  "type": "photo",
  "photo": "photos/example.jpg",
  "question": "¿Dónde se tomó esta foto?",
  "correctAnswer": "En la playa",
  "wrongAnswers": ["En la montaña", "En casa", "En el parque"]
}
```

### Type: `plain`

Text-only question, no media.

```json
{
  "type": "plain",
  "question": "¿En qué año nos conocimos?",
  "correctAnswer": "2012",
  "wrongAnswers": ["2011", "2013", "2014"]
}
```

## Multiplayer

- Host opens `http://localhost:8000` and clicks **Multijugador**
- A 6-digit PIN is displayed on the host screen
- Players join at `http://<host-ip>:8000/player.html` with the PIN and a name
- Max 10 players
- Faster correct answers score more points (1000 max, 100 min)
- Kahoot-style bar chart shows answer distribution after each question
- Leaderboard shown after each round and at the end

## Audio files

Audio files are personal and excluded from the repo via `.gitignore`. Place them in:

- `media/audios/` — Original MP3 files named `<audio-key>.mp3`
- `media/audios-filtered/` — Filtered versions (used for `person` subtype)

To generate filtered audios from originals:

```bash
for f in media/audios/*.mp3; do
  sox -v 0.5 "$f" "media/audios-filtered/$(basename "$f")" pitch -320 highpass 120 lowpass 3200 bass 3 equalizer 500 1.0q 4 overdrive 8 compand 0.005,0.08 -24,-24,-12,-10,-6,-5 0 -24
done
```

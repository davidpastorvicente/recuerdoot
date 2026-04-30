# Recuerdos de Audio

This folder contains the game and the metadata used to generate the questions.

## Files

- `index.html`: the game UI
- `summary.json`: configuration for each audio
- `audios/`: original audios
- `audios-filtered/`: filtered audios used in `person` questions

## `summary.json` format

Each key is the audio filename without the `.mp3` extension.

Minimal base structure:

```json
"PTT-20140621-WA0033": {
  "person": "Belén",
  "year": 2014,
  "type": "person"
}
```

Common fields:

- `person`: display name of the speaker/person
- `year`: year associated with the audio
- `type`: question type

## Types

### `person`

The game plays the audio and asks which person it is.

```json
"PTT-20140621-WA0033": {
  "person": "Belén",
  "year": 2014,
  "type": "person"
}
```

### `year`

The game plays the audio and asks for the year.

```json
"PTT-20140621-WA0033": {
  "person": "Belén",
  "year": 2014,
  "type": "year"
}
```

### `text`

The game shows a written quote or clue first, then reveals the audio after answering.

Extra field:

- `text`: the quote or clue shown in the question

```json
"PTT-20140621-WA0033": {
  "person": "Belén",
  "year": 2014,
  "type": "text",
  "text": "No puedo más con esto"
}
```

### `custom`

You define the full question and answer set.

Extra fields:

- `question`: question text shown in the game
- `correctAnswer`: the correct option
- `wrongAnswers`: array of wrong options
- `audioBefore`: optional boolean, default `false`; if `true`, shows the audio before answering

The game automatically combines `correctAnswer` + `wrongAnswers` and randomizes their order.

```json
"PTT-20140621-WA0033": {
  "person": "Belén",
  "year": 2014,
  "type": "custom",
  "question": "¿Dónde estábamos ese día?",
  "correctAnswer": "En la feria",
  "wrongAnswers": ["En la playa", "En casa", "En el coche"],
  "audioBefore": true
}
```

## Notes

- Only include extra fields when that type needs them.
- If you crop or replace audios in `audios/`, regenerate `audios-filtered/`.
- For `custom`, make sure `correctAnswer` is a string and `wrongAnswers` is a list of strings.

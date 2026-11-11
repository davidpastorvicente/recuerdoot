# Guide to creating a Recuerdoot quiz

> **For AI assistants (ChatGPT, Claude, Gemini, Copilot…):** this guide is your reference for helping someone create a Recuerdoot *quiz pack*: a folder or a `.zip` with a `questions.json` file plus its photos, audio clips, videos and music. Follow the [guided flow](#1-guided-flow-for-the-assistant), stick to the [exact format](#3-questionsjson-format) and, if you can run code, validate and package the pack with the [script in section 7](#7-validate-and-create-the-zip). Talk to the person in their language; the questions and answers are written in the language the game will be played in.
>
> **For people:** you can read it yourself, or give it to your AI assistant with a message like *"Read this guide and help me create a Recuerdoot quiz step by step"*. If your assistant can't open links, download this file and attach it to the conversation.
>
> *Esta guía también está [en español](quiz-guide.md).*

## What is Recuerdoot

A Kahoot-style quiz game about shared memories. A big screen (the *host*) shows each question with its photo, audio clip or video, and players answer from their phones. After each question the original moment is revealed (the uncropped photo, the undistorted voice note, the video…). It can also be played solo.

Everything happens in the host's browser: the quiz is loaded from the start screen (**Choose folder**, **Choose .zip** or by dragging it in) and **is never uploaded to any server**. The files only play on the host's computer.

The app is available in Spanish and English (**ES / EN** switch at the top of the page). That only changes the interface: your questions and answers are shown exactly as you write them.

---

## 1. Guided flow (for the assistant)

Work in this order. Don't make up memories: the questions must come from what the person tells you or gives you.

### Step 1 · Short interview

Ask these questions (a few at a time, not all at once):

1. **Occasion and audience:** what is it for (birthday, farewell, wedding, anniversary, reunion with friends, family…)? Who will play and how many people (10 phones at most)?
2. **Tone:** heartfelt, cheeky, a mix? Any topics to avoid?
3. **Length:** how many questions? Recommend **10–20** (each question takes ~1 minute with the reveal and the scoreboard).
4. **Material available:** what do you have?
   - Audio (WhatsApp voice notes, recordings).
   - Photos (trips, parties, old pictures, chat screenshots).
   - Short videos.
   - Songs that matter to the group.
   - Anecdotes, legendary quotes, dates, places, fun facts (no files is fine too).
5. **People:** names or nicknames of everyone who appears (to use them as answers).
6. **How we'll handle the files:** can you give me access to them (upload them, or a local folder if I can run code), or would you rather I give you instructions and you put them in place?

### Step 2 · Propose a plan

Propose a numbered list of questions with, for each one: type (see [section 2](#2-question-types)), text, correct answer, 3–5 believable wrong answers, and which file goes before and after. Ask for confirmation and adjust. Tips:

- Mix the types: don't put three audio questions in a row.
- Start with something easy and leave the most emotional or funniest ones for the end (questions are played **in file order**).
- Wrong answers must be plausible: other names from the group, other cities from the same trip, nearby years.

### Step 3 · Prepare the files

Rename and convert the files as described in [section 5](#5-media-files) and place them in the structure from [section 4](#4-folder-structure). Create *before* versions (cropped, blurred, distorted voice) whenever the original gives the answer away.

### Step 4 · Write `questions.json`

Follow [section 3](#3-questionsjson-format) to the letter. Strict JSON: double quotes, no comments, no trailing commas, UTF-8.

### Step 5 · Validate and package

Run the script from [section 7](#7-validate-and-create-the-zip). If you can't run code, deliver the `questions.json` and the exact list of files with their folder, and explain how to create the zip (section 7.3). Always finish with the [final checklist](#8-final-checklist).

---

## 2. Question types

Proven ideas. Freely combine `before` (what is seen or heard with the question) and `after` (what is revealed afterwards).

| Type | Example question | `before` | `after` |
|------|------------------|----------|---------|
| **Who said…?** (audio) | `Who sent this voice note?` | `audio`: **distorted** voice note (`_filtered`) | `audio`: the original note |
| **Legendary quote** (no file) | `Who said "I'll start the diet tomorrow"?` | — | optional: `image` of the moment |
| **Hidden photo** | `Whose hand is this?` / `Where were we?` | `image`: crop, zoom or blur | `image`: the full photo |
| **Where was it?** | `In which city was this photo taken?` | `image`: a not-so-obvious detail | `image` or `video` of the place |
| **Who is it?** | `Who is this baby?` | `image`: childhood photo | `image`: current photo |
| **When was it?** | `What year was this trip?` | `image` | `image` or `video` |
| **The group's song** | `Which song played at every party?` | `music`: instrumental version or an unrecognisable snippet | `music`: the original song, maybe with a `video` |
| **Video reveal** | `What happened right after?` | `image`: a frame | `video`: the video |
| **Fact or number** | `How many kilometres did we walk on the Camino?` | — | `image` of the certificate, map… |
| **Chat** | `Who wrote this message?` | `image`: screenshot with the name hidden | `image`: full screenshot |

How each case plays:

- **Regular question:** 20 seconds to answer. The sooner you get it right, the more points (from 1000 down to 100).
- **Question with `before.audio`:** the screen gives 3 seconds to read, plays the clip and, when it ends, opens 10 seconds to answer (players can answer while it plays). That's why *before* clips should last **between 3 and 20 seconds**.
- **`music`** loops quietly in the background (it ducks when an `audio` clip plays). Use it for atmosphere or for song questions. Without `before.music`, a default track plays.
- **Automatic dates:** if an audio file name contains a `YYYYMMDD` date (for example `PTT-20190704-WA0001.mp3`, WhatsApp's format), the reveal shows "July 4, 2019" (or "4 julio 2019" when the app is in Spanish).
- **Quotes:** a phrase in double quotes inside the question is highlighted on screen. In JSON they are written as `\"`.
- Answers are **shuffled** automatically; there's no need to mix them up yourself.

---

## 3. `questions.json` format

A **JSON list** of questions, in the order they will be played:

```json
[
  {
    "question": "Who sent this voice note?",
    "answers": { "right": "Laura", "wrong": ["Martha", "Sophie", "Carmen"] },
    "before": { "audio": "PTT-20190704-WA0001_filtered.mp3" },
    "after": { "audio": "PTT-20190704-WA0001.mp3" }
  }
]
```

| Field | Required | Rule |
|-------|----------|------|
| `question` | Yes | Non-empty text. Recommended: up to ~110 characters. |
| `answers.right` | Yes | The correct answer. Non-empty text. |
| `answers.wrong` | Yes | List of **3 to 5** wrong answers (4, 5 or 6 options in total). Non-empty texts. |
| `before` | No | Object with any combination of `audio`, `image`, `video`, `music`. Shown with the question. |
| `after` | No | Same as `before`. Revealed after answering. |

Strict rules (the game rejects the quiz if they're not met):

- The file is a list with **at least one** question.
- **All the options of a question are different** (the correct one can't be repeated among the wrong ones). Comparison is case-sensitive: better not to rely on that.
- `before` and `after` only accept the keys `audio`, `image`, `video` and `music`, and each value is **a file name** (not an absolute path) or an `https://` URL.
- Every file named must exist inside the pack.

Style recommendations:

- Short answers: ideally **under 30 characters** (they're shown on big tiles).
- Use names or nicknames the way the group knows them.
- Don't put the answer in the question text or in the name of a file that will be visible.
- One idea per question.

---

## 4. Folder structure

```
my-quiz/
├─ questions.json
├─ audios/      voice notes and clips (before.audio / after.audio)
├─ images/      photos and screenshots
├─ videos/      videos
└─ music/       background music
```

- In `questions.json` write **only the file name**: `"image": "beach.jpg"`, not `"images/beach.jpg"`. The game looks for it in the subfolder for its type (`audios/`, `images/`, `videos/`, `music/`), then in `assets/<subfolder>/`, then next to `questions.json` and, finally, any file with that exact name if it's unique in the pack. To avoid surprises, use the structure above and unique names.
- `questions.json` can be at the root of the zip or inside a single folder (`my-quiz/questions.json`); both work.
- Unused files are ignored (and not saved in the browser).
- You can also use an `https://` URL instead of a file. Careful: Google Drive, Dropbox or iCloud share links usually **don't work** because they don't point to the file itself. Including the files in the pack is better.

### File names

- No slashes or odd characters; letters, numbers, `-` and `_` are the safest. Accents and spaces work, but avoiding them saves trouble.
- For the distorted audio use the `_filtered` suffix: `PTT-20190704-WA0001_filtered.mp3` (before) and `PTT-20190704-WA0001.mp3` (after).
- Keep the `YYYYMMDD` date in WhatsApp audio names if you want it shown on the reveal.

---

## 5. Media files

### Formats that work in every browser

| Type | Use | Avoid (convert first) |
|------|-----|-----------------------|
| Audio | `.mp3` (safest), `.m4a`, `.ogg`, `.wav` | WhatsApp `.opus` on Safari, `.amr` |
| Image | `.jpg`, `.png`, `.webp`, `.gif` | `.heic` / `.heif` (iPhone photos) |
| Video | `.mp4` with H.264 video and AAC audio | `.mov`, HEVC/H.265 videos, `.avi`, `.mkv` |

### Recommended sizes

- Photos: **1600–2400 px** on the long side, under 2 MB each.
- Videos: **15–60 s**, 720p or 1080p, under 50 MB each.
- *Before* audio: **3–20 s**. *After* audio: the full clip.
- Whole pack as a `.zip`: ideally **under 500 MB** (the browser opens it in memory). If it's bigger, use **Choose folder**.

### Useful commands

They need [ffmpeg](https://ffmpeg.org), [SoX](https://sourceforge.net/projects/sox/) or the tools mentioned. Adjust the file names.

```bash
# WhatsApp voice note (.opus/.ogg) to mp3
ffmpeg -i PTT-20190704-WA0001.opus -c:a libmp3lame -q:a 3 audios/PTT-20190704-WA0001.mp3

# Trim an audio clip (from second 2, 12 seconds long)
ffmpeg -ss 2 -t 12 -i input.mp3 -c:a libmp3lame -q:a 3 audios/clip.mp3

# Unrecognisable voice for the question (deeper, filtered and saturated)
sox -v 0.5 audios/PTT-20190704-WA0001.mp3 audios/PTT-20190704-WA0001_filtered.mp3 pitch -320 highpass 120 lowpass 3200 bass 3 equalizer 500 1.0q 4 overdrive 8 compand 0.005,0.08 -24,-24,-12,-10,-6,-5 0 -24

# Alternative without SoX: deeper voice with ffmpeg
ffmpeg -i audios/original.mp3 -af "asetrate=44100*0.75,aresample=44100,atempo=1.333,highpass=f=200,lowpass=f=3000" audios/original_filtered.mp3

# iPhone photo (HEIC) to JPG (macOS)
sips -s format jpeg -Z 2000 IMG_1234.HEIC --out images/IMG_1234.jpg
# … or with ImageMagick
magick IMG_1234.HEIC -resize 2000x2000\> images/IMG_1234.jpg

# Blurred photo for the question
ffmpeg -i images/beach.jpg -vf "boxblur=25:2" images/beach_blur.jpg

# Pixelated photo
ffmpeg -i images/beach.jpg -vf "scale=iw/40:-1,scale=iw*40:-1:flags=neighbor" images/beach_pixel.jpg

# Crop an area (width:height:x:y)
ffmpeg -i images/beach.jpg -vf "crop=400:400:800:300" images/beach_detail.jpg

# .mov or HEVC video to a compatible mp4 (720p)
ffmpeg -i IMG_5678.MOV -vf "scale=-2:720" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart videos/trip.mp4

# Trim a video (from 00:01:05, 30 seconds long)
ffmpeg -ss 00:01:05 -t 30 -i long.mp4 -c:v libx264 -crf 23 -c:a aac -movflags +faststart videos/moment.mp4

# A frame from a video to use as the "before" image
ffmpeg -ss 3 -i videos/moment.mp4 -frames:v 1 images/moment_frame.jpg

# Instrumental music: if there's no instrumental version, a snippet without the most recognisable part
ffmpeg -ss 45 -t 40 -i song.mp3 -c:a libmp3lame -q:a 3 music/song_snippet.mp3
```

---

## 6. Full example

```
my-quiz/
├─ questions.json
├─ audios/
│  ├─ PTT-20190704-WA0001.mp3
│  └─ PTT-20190704-WA0001_filtered.mp3
├─ images/
│  ├─ bicycle.jpg
│  ├─ bicycle_detail.jpg
│  └─ school_trip.jpg
├─ videos/
│  └─ school_trip.mp4
└─ music/
   ├─ party.mp3
   └─ party_instrumental.mp3
```

```json
[
  {
    "question": "What colour was the group's first bicycle?",
    "answers": { "right": "Red", "wrong": ["Blue", "Green", "Yellow"] },
    "before": { "image": "bicycle_detail.jpg" },
    "after": { "image": "bicycle.jpg" }
  },
  {
    "question": "Who said \"I'll start the diet tomorrow\"?",
    "answers": { "right": "Laura", "wrong": ["Martha", "Sophie", "Carmen", "Ellen"] },
    "before": { "audio": "PTT-20190704-WA0001_filtered.mp3" },
    "after": { "audio": "PTT-20190704-WA0001.mp3" }
  },
  {
    "question": "Which song played at every party?",
    "answers": { "right": "Song A", "wrong": ["Song B", "Song C", "Song D", "Song E", "Song F"] },
    "before": { "music": "party_instrumental.mp3" },
    "after": { "music": "party.mp3" }
  },
  {
    "question": "Where did we go on the end-of-year school trip?",
    "answers": { "right": "Granada", "wrong": ["Lisbon", "Rome", "Porto"] },
    "after": { "image": "school_trip.jpg", "video": "school_trip.mp4" }
  }
]
```

---

## 7. Validate and create the zip

### 7.1 Validation and packaging script

Save it as `recuerdoot_pack.py` and run it with Python 3.8+ (it only uses the standard library):

```bash
python3 recuerdoot_pack.py my-quiz          # validate
python3 recuerdoot_pack.py my-quiz --zip    # validate and create my-quiz.zip
```

```python
#!/usr/bin/env python3
"""Validates a Recuerdoot quiz pack (folder with questions.json) and optionally zips it."""
import json
import sys
import zipfile
from pathlib import Path

KINDS = {"audio": "audios", "image": "images", "video": "videos", "music": "music"}
SLOTS = ("before", "after")
SAFE_EXTENSIONS = {
    "audio": {".mp3", ".m4a", ".aac", ".ogg", ".oga", ".wav", ".flac"},
    "music": {".mp3", ".m4a", ".aac", ".ogg", ".oga", ".wav", ".flac"},
    "image": {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"},
    "video": {".mp4", ".m4v", ".webm"},
}
BIG_FILE_MB = 80


def is_text(value):
    return isinstance(value, str) and value.strip() != ""


def is_remote(value):
    return isinstance(value, str) and value.lower().startswith(("http://", "https://"))


def is_hidden(path, root):
    return any(part.startswith(".") or part == "__MACOSX" for part in path.relative_to(root).parts)


def find_file(root, files, kind, name):
    """Same lookup order as the game: <kind folder>/, assets/<kind folder>/, root, unique file name."""
    folder = KINDS[kind]
    for candidate in (root / folder / name, root / "assets" / folder / name, root / name):
        if candidate.is_file():
            return candidate
    same_name = [f for f in files if f.name.lower() == Path(name).name.lower()]
    if len(same_name) == 1:
        return same_name[0]
    in_folder = [f for f in same_name if folder in f.relative_to(root).parts]
    return in_folder[0] if len(in_folder) == 1 else None


def check_answers(answers, label):
    if not isinstance(answers, dict):
        return [f'{label}: "answers" must be an object with "right" and "wrong"']
    errors = []
    if not is_text(answers.get("right")):
        errors.append(f'{label}: "answers.right" must be a non-empty text')
    wrong = answers.get("wrong")
    if not isinstance(wrong, list) or not 3 <= len(wrong) <= 5:
        return errors + [f'{label}: "answers.wrong" must have between 3 and 5 answers']
    if not all(is_text(item) for item in wrong):
        errors.append(f'{label}: every answer in "answers.wrong" must be a non-empty text')
    options = [answers.get("right"), *wrong]
    if len(set(map(str, options))) != len(options):
        errors.append(f"{label}: answers cannot be repeated")
    return errors


def validate(root):
    root = Path(root)
    questions_path = root / "questions.json"
    if not questions_path.is_file():
        return [f"{questions_path} does not exist"], [], set()
    try:
        raw = json.loads(questions_path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        return [f"questions.json is not valid JSON: {error}"], [], set()
    if not isinstance(raw, list) or not raw:
        return ["questions.json must be a JSON list with at least one question"], [], set()

    files = [f for f in root.rglob("*") if f.is_file() and not is_hidden(f, root)]
    errors, warnings, used = [], [], {questions_path}
    for index, entry in enumerate(raw, start=1):
        label = f"Question {index}"
        if not isinstance(entry, dict):
            errors.append(f"{label}: must be an object")
            continue
        if not is_text(entry.get("question")):
            errors.append(f'{label}: "question" must be a non-empty text')
        errors += check_answers(entry.get("answers"), label)
        for slot in SLOTS:
            media = entry.get(slot)
            if media is None:
                continue
            if not isinstance(media, dict):
                errors.append(f'{label}: "{slot}" must be an object')
                continue
            for kind, name in media.items():
                if kind not in KINDS:
                    errors.append(f'{label}: "{slot}.{kind}" is not allowed (use audio, image, music, video)')
                elif not is_text(name):
                    errors.append(f'{label}: "{slot}.{kind}" must be a file name')
                elif is_remote(name):
                    warnings.append(f"{label}: {slot}.{kind} is a URL; check that it opens the file itself")
                else:
                    found = find_file(root, files, kind, name)
                    if not found:
                        errors.append(f'{label}: missing file "{KINDS[kind]}/{name}"')
                        continue
                    used.add(found)
                    if found.suffix.lower() not in SAFE_EXTENSIONS[kind]:
                        warnings.append(f"{label}: {found.name} may not play in every browser; convert it")
                    if found.stat().st_size > BIG_FILE_MB * 1024 * 1024:
                        warnings.append(f"{label}: {found.name} is larger than {BIG_FILE_MB} MB; consider compressing it")
    return errors, warnings, used


def make_zip(root, used):
    root = Path(root).resolve()
    target = root.with_suffix(".zip")
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(used):
            archive.write(path, Path(root.name) / path.resolve().relative_to(root))
    return target


def main():
    args = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
    if len(args) != 1:
        print("Usage: python3 recuerdoot_pack.py <quiz-folder> [--zip]")
        return 2
    errors, warnings, used = validate(args[0])
    for warning in warnings:
        print(f"⚠ {warning}")
    if errors:
        print(f"✗ {len(errors)} problem(s):")
        for error in errors:
            print(f"  - {error}")
        return 1
    print(f"✓ Valid quiz: {len(used) - 1} media file(s) used.")
    if "--zip" in sys.argv:
        print(f"✓ Created {make_zip(args[0], used)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

The zip it creates only includes `questions.json` and the files the questions use, inside a folder named after the quiz.

### 7.2 If the assistant can't run code

Deliver:

1. The full contents of `questions.json`.
2. A table with every file: final name, subfolder (`audios/`, `images/`, `videos/`, `music/`) and which original file it comes from or what needs to be done to it (trim, blur, convert).
3. The instructions from 7.3 to create the zip, or simply tell them they can pick the **folder** directly in Recuerdoot.

### 7.3 Create the zip by hand

- **macOS:** right-click the `my-quiz` folder → *Compress "my-quiz"*. Or in Terminal: `zip -r my-quiz.zip my-quiz -x "*.DS_Store" -x "__MACOSX/*"`
- **Windows:** right-click the folder → *Send to* → *Compressed (zipped) folder*. Or in PowerShell: `Compress-Archive -Path my-quiz -DestinationPath my-quiz.zip`
- **Linux:** `zip -r my-quiz.zip my-quiz`

You don't need a zip: in Recuerdoot you can also press **Choose folder** or drag the folder in.

---

## 8. Final checklist

- [ ] `questions.json` is a valid JSON list (no comments or trailing commas, double quotes, UTF-8).
- [ ] Every question has `question`, `answers.right` and 3 to 5 `answers.wrong`, with no repeated options.
- [ ] `before`/`after` only use `audio`, `image`, `video`, `music`, with file names (not paths).
- [ ] Every file exists in its subfolder and is in a compatible format (mp3, jpg/png/webp, H.264 mp4).
- [ ] The *before* files don't give the answer away (distorted voice, cropped or blurred photo).
- [ ] *Before* audio clips last between 3 and 20 seconds.
- [ ] The question order has a good rhythm: varied, building up.
- [ ] The validation script prints ✓ (or the game shows the quiz as **Ready** when loading it).

## 9. Common errors

The game lists the problems when loading the quiz (in the language the app is set to). How to fix them:

| Message | Fix |
|---------|-----|
| `There is no questions.json in what you picked` | The file must be named exactly `questions.json` and be at the root or inside a single folder. |
| `questions.json is not valid JSON` | Check for trailing commas, single quotes, unescaped quotes (`\"`) or comments. |
| `"answers.wrong" must have between 3 and 5 answers` | Add or remove wrong answers. |
| `answers cannot be repeated` | The correct answer also appears among the wrong ones, or two are identical. |
| `"before.photo" is not allowed` | Only use `audio`, `image`, `video` or `music`. |
| `missing file "images/x.jpg"` | The name doesn't match (capital letters, `.jpeg` vs `.jpg` extension, spaces) or the file isn't in the pack. |
| The video or photo doesn't show even though the quiz is **Ready** | Unsupported format (HEIC, MOV, HEVC): convert it (section 5). |

## 10. Privacy

- The files stay on the host's computer: Recuerdoot reads them in the browser and only stores them in that browser (the **Remove** button deletes them).
- Phones never receive the photos, audio clips or videos; only the answer options.
- Don't publish the pack in a public repository or on open links if it contains private audio or photos.

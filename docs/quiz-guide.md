# Guía para crear un quiz de Recuerdoot

> **Para asistentes de IA (ChatGPT, Claude, Gemini, Copilot…):** esta guía es tu referencia para ayudar a una persona a crear un *quiz pack* de Recuerdoot: una carpeta o un `.zip` con un archivo `questions.json` y sus fotos, audios, vídeos y música. Sigue el [flujo guiado](#1-flujo-guiado-para-el-asistente), respeta el [formato exacto](#3-formato-de-questionsjson) y, si puedes ejecutar código, valida y empaqueta con el [script de la sección 7](#7-validar-y-crear-el-zip). Habla con la persona en su idioma; el texto de las preguntas y respuestas va en el idioma en que se jugará (normalmente español).
>
> **Para personas:** puedes leerla tú, o pasársela a tu asistente de IA con un mensaje como *"Lee esta guía y ayúdame paso a paso a crear un quiz de Recuerdoot"*. Si tu asistente no puede abrir enlaces, descarga este archivo y adjúntalo a la conversación.

## Qué es Recuerdoot

Un juego de preguntas al estilo Kahoot sobre recuerdos compartidos. Una pantalla grande (el *host*) muestra cada pregunta con su foto, audio o vídeo; los jugadores responden desde el móvil. Tras cada pregunta se revela el momento original (la foto sin recortar, el audio sin distorsionar, el vídeo…). También se puede jugar en solitario.

Todo ocurre en el navegador del host: el quiz se carga desde la pantalla de inicio (**Elegir carpeta**, **Elegir .zip** o arrastrándolo) y **no se sube a ningún servidor**. Los archivos solo se reproducen en el ordenador del host.

---

## 1. Flujo guiado (para el asistente)

Trabaja en este orden. No inventes recuerdos: las preguntas tienen que salir de lo que la persona te cuente o te dé.

### Paso 1 · Entrevista breve

Haz estas preguntas (pocas a la vez, no todas de golpe):

1. **Ocasión y público:** ¿para qué es? (cumpleaños, despedida, boda, aniversario, reunión de amigos, familia…) ¿Quién jugará y cuántas personas (máximo 10 móviles)?
2. **Tono:** ¿emotivo, gamberro, mezcla? ¿Hay temas que evitar?
3. **Duración:** ¿cuántas preguntas? Recomienda **10–20** (cada pregunta dura ~1 minuto con la revelación y el marcador).
4. **Material disponible:** ¿qué tienes?
   - Audios (notas de voz de WhatsApp, grabaciones).
   - Fotos (viajes, fiestas, fotos antiguas, capturas de chats).
   - Vídeos cortos.
   - Canciones importantes para el grupo.
   - Anécdotas, frases míticas, fechas, lugares, datos curiosos (sin archivos también vale).
5. **Personas:** nombres o apodos de quienes aparecen (para usarlos como respuestas).
6. **Cómo trabajaremos con los archivos:** ¿puedes darme acceso a ellos (subirlos, una carpeta local si puedo ejecutar código) o prefieres que te dé instrucciones y tú los colocas?

### Paso 2 · Propón un guion

Propón una lista numerada de preguntas con, para cada una: tipo (ver [sección 2](#2-tipos-de-preguntas)), texto, respuesta correcta, 3–5 respuestas incorrectas creíbles y qué archivo va antes y después. Pide confirmación y ajusta. Consejos:

- Varía los tipos: no pongas tres audios seguidos.
- Empieza con algo fácil, deja lo más emotivo o divertido para el final (las preguntas se juegan **en el orden del archivo**).
- Las respuestas incorrectas deben ser plausibles: otros nombres del grupo, otras ciudades del mismo viaje, años cercanos.

### Paso 3 · Prepara los archivos

Renombra y convierte los archivos según la [sección 5](#5-archivos-multimedia) y colócalos en la estructura de la [sección 4](#4-estructura-de-la-carpeta). Crea versiones *antes* (recortada, desenfocada, voz distorsionada) cuando el original revele la respuesta.

### Paso 4 · Escribe `questions.json`

Sigue la [sección 3](#3-formato-de-questionsjson) al pie de la letra. JSON estricto: comillas dobles, sin comentarios, sin comas finales, UTF-8.

### Paso 5 · Valida y empaqueta

Ejecuta el script de la [sección 7](#7-validar-y-crear-el-zip). Si no puedes ejecutar código, entrega el `questions.json` y la lista exacta de archivos con su carpeta, y explica a la persona cómo crear el zip (sección 7.3). Termina siempre con el [checklist final](#8-checklist-final).

---

## 2. Tipos de preguntas

Ideas probadas. Combina libremente `before` (lo que se ve u oye con la pregunta) y `after` (lo que se revela después).

| Tipo | Ejemplo de pregunta | `before` | `after` |
|------|--------------------|----------|---------|
| **¿Quién dijo…?** (audio) | `¿Quién mandó este audio?` | `audio`: nota de voz **distorsionada** (`_filtered`) | `audio`: la nota original |
| **Frase mítica** (sin archivo) | `¿Quién dijo "mañana empiezo la dieta"?` | — | opcional: `image` del momento |
| **Foto escondida** | `¿De quién es esta mano?` / `¿Dónde estábamos?` | `image`: recorte, zoom o desenfoque | `image`: la foto completa |
| **¿Dónde fue?** | `¿En qué ciudad se hizo esta foto?` | `image`: detalle poco obvio | `image` o `video` del lugar |
| **¿Quién es?** | `¿Quién es este bebé?` | `image`: foto de infancia | `image`: foto actual |
| **¿Cuándo fue?** | `¿En qué año fue este viaje?` | `image` | `image` o `video` |
| **Canción del grupo** | `¿Qué canción sonaba en todas las fiestas?` | `music`: versión instrumental o fragmento irreconocible | `music`: la canción original, y quizá un `video` |
| **Vídeo revelación** | `¿Qué pasó justo después?` | `image`: fotograma | `video`: el vídeo |
| **Dato o número** | `¿Cuántos kilómetros hicimos en el Camino?` | — | `image` del diploma, mapa… |
| **Chat** | `¿Quién escribió este mensaje?` | `image`: captura con el nombre tapado | `image`: captura completa |

Notas sobre cómo se juega cada caso:

- **Pregunta normal:** 20 segundos para responder. Cuanto antes se acierta, más puntos (de 1000 a 100).
- **Pregunta con `before.audio`:** la pantalla da 3 segundos para leer, reproduce el audio y, cuando termina, abre 10 segundos para responder (los jugadores pueden responder mientras suena). Por eso los audios *antes* deben durar **entre 3 y 20 segundos**.
- **`music`** suena en bucle y bajito de fondo (se atenúa cuando suena un `audio`). Sirve para ambientar o para preguntas de canciones. Sin `before.music` suena una música por defecto.
- **Fechas automáticas:** si el nombre de un archivo de audio contiene una fecha `AAAAMMDD` (por ejemplo `PTT-20190704-WA0001.mp3`, el formato de WhatsApp), al revelar se muestra "4 julio 2019".
- **Comillas:** una frase entre comillas dobles en la pregunta se resalta en pantalla. En JSON se escriben como `\"`.
- Las respuestas se **barajan** automáticamente; no hace falta desordenarlas.

---

## 3. Formato de `questions.json`

Una **lista JSON** de preguntas, en el orden en que se jugarán:

```json
[
  {
    "question": "¿Quién mandó este audio?",
    "answers": { "right": "Laura", "wrong": ["Marta", "Sofía", "Carmen"] },
    "before": { "audio": "PTT-20190704-WA0001_filtered.mp3" },
    "after": { "audio": "PTT-20190704-WA0001.mp3" }
  }
]
```

| Campo | Obligatorio | Regla |
|-------|-------------|-------|
| `question` | Sí | Texto no vacío. Recomendado: hasta ~110 caracteres. |
| `answers.right` | Sí | La respuesta correcta. Texto no vacío. |
| `answers.wrong` | Sí | Lista de **3 a 5** respuestas incorrectas (en total 4, 5 o 6 opciones). Textos no vacíos. |
| `before` | No | Objeto con cualquier combinación de `audio`, `image`, `video`, `music`. Se muestra con la pregunta. |
| `after` | No | Igual que `before`. Se revela tras responder. |

Reglas estrictas (el juego rechaza el quiz si no se cumplen):

- El archivo es una lista con **al menos una** pregunta.
- **Todas las opciones de una pregunta son distintas** (la correcta no puede repetirse entre las incorrectas). Distingue mayúsculas: mejor no jugar con eso.
- En `before` y `after` solo se permiten las claves `audio`, `image`, `video` y `music`, y cada valor es **un nombre de archivo** (no una ruta absoluta) o una URL `https://`.
- Cada archivo nombrado tiene que existir dentro del pack.

Recomendaciones de estilo:

- Respuestas cortas: idealmente **menos de 30 caracteres** (se muestran en baldosas grandes).
- Usa nombres o apodos como los conoce el grupo.
- No pongas la respuesta en el texto de la pregunta ni en el nombre de un archivo que se vea.
- Una idea por pregunta.

---

## 4. Estructura de la carpeta

```
mi-quiz/
├─ questions.json
├─ audios/      notas de voz y clips (before.audio / after.audio)
├─ images/      fotos y capturas
├─ videos/      vídeos
└─ music/       música de fondo
```

- En `questions.json` escribe **solo el nombre del archivo**: `"image": "playa.jpg"`, no `"images/playa.jpg"`. El juego lo busca en la subcarpeta de su tipo (`audios/`, `images/`, `videos/`, `music/`), después en `assets/<subcarpeta>/`, después junto a `questions.json` y, por último, cualquier archivo con ese nombre exacto si es único en el pack. Para evitar sorpresas, usa la estructura de arriba y nombres únicos.
- `questions.json` puede estar en la raíz del zip o dentro de una única carpeta (`mi-quiz/questions.json`); las dos cosas funcionan.
- Archivos que no se usan se ignoran (y no se guardan en el navegador).
- También se puede usar una URL `https://` en lugar de un archivo. Ojo: los enlaces para compartir de Google Drive, Dropbox o iCloud normalmente **no funcionan** porque no apuntan al archivo directo. Mejor incluir los archivos en el pack.

### Nombres de archivo

- Sin barras ni caracteres raros; letras, números, `-` y `_` son lo más seguro. Las tildes y espacios funcionan, pero evitarlos ahorra problemas.
- Para el audio distorsionado usa el sufijo `_filtered`: `PTT-20190704-WA0001_filtered.mp3` (antes) y `PTT-20190704-WA0001.mp3` (después).
- Conserva la fecha `AAAAMMDD` en los audios de WhatsApp si quieres que se muestre al revelar.

---

## 5. Archivos multimedia

### Formatos que funcionan en todos los navegadores

| Tipo | Usa | Evita (convierte antes) |
|------|-----|-------------------------|
| Audio | `.mp3` (lo más seguro), `.m4a`, `.ogg`, `.wav` | `.opus` de WhatsApp en Safari, `.amr` |
| Imagen | `.jpg`, `.png`, `.webp`, `.gif` | `.heic` / `.heif` (fotos de iPhone) |
| Vídeo | `.mp4` con vídeo H.264 y audio AAC | `.mov`, vídeos HEVC/H.265, `.avi`, `.mkv` |

### Tamaños recomendados

- Fotos: lado largo de **1600–2400 px**, menos de 2 MB cada una.
- Vídeos: **15–60 s**, 720p o 1080p, menos de 50 MB cada uno.
- Audios *antes*: **3–20 s**. Audios *después*: el clip completo.
- Pack completo en `.zip`: idealmente **menos de 500 MB** (el navegador lo abre en memoria). Si es más grande, usa **Elegir carpeta**.

### Comandos útiles

Requieren [ffmpeg](https://ffmpeg.org), [SoX](https://sourceforge.net/projects/sox/) o las herramientas indicadas. Ajusta los nombres de archivo.

```bash
# Nota de voz de WhatsApp (.opus/.ogg) a mp3
ffmpeg -i PTT-20190704-WA0001.opus -c:a libmp3lame -q:a 3 audios/PTT-20190704-WA0001.mp3

# Recortar un audio (desde el segundo 2, 12 segundos)
ffmpeg -ss 2 -t 12 -i entrada.mp3 -c:a libmp3lame -q:a 3 audios/recorte.mp3

# Voz irreconocible para la pregunta (más grave, filtrada y saturada)
sox -v 0.5 audios/PTT-20190704-WA0001.mp3 audios/PTT-20190704-WA0001_filtered.mp3 pitch -320 highpass 120 lowpass 3200 bass 3 equalizer 500 1.0q 4 overdrive 8 compand 0.005,0.08 -24,-24,-12,-10,-6,-5 0 -24

# Alternativa sin SoX: voz más grave con ffmpeg
ffmpeg -i audios/original.mp3 -af "asetrate=44100*0.75,aresample=44100,atempo=1.333,highpass=f=200,lowpass=f=3000" audios/original_filtered.mp3

# Foto de iPhone (HEIC) a JPG (macOS)
sips -s format jpeg -Z 2000 IMG_1234.HEIC --out images/IMG_1234.jpg
# … o con ImageMagick
magick IMG_1234.HEIC -resize 2000x2000\> images/IMG_1234.jpg

# Foto desenfocada para la pregunta
ffmpeg -i images/playa.jpg -vf "boxblur=25:2" images/playa_blur.jpg

# Foto pixelada
ffmpeg -i images/playa.jpg -vf "scale=iw/40:-1,scale=iw*40:-1:flags=neighbor" images/playa_pixel.jpg

# Recorte de una zona (ancho:alto:x:y)
ffmpeg -i images/playa.jpg -vf "crop=400:400:800:300" images/playa_detalle.jpg

# Vídeo .mov o HEVC a mp4 compatible (720p)
ffmpeg -i IMG_5678.MOV -vf "scale=-2:720" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart videos/viaje.mp4

# Recortar un vídeo (desde 00:01:05, 30 segundos)
ffmpeg -ss 00:01:05 -t 30 -i largo.mp4 -c:v libx264 -crf 23 -c:a aac -movflags +faststart videos/momento.mp4

# Fotograma de un vídeo para usarlo como imagen "antes"
ffmpeg -ss 3 -i videos/momento.mp4 -frames:v 1 images/momento_frame.jpg

# Música instrumental: si no tienes versión instrumental, un fragmento sin la parte más reconocible
ffmpeg -ss 45 -t 40 -i cancion.mp3 -c:a libmp3lame -q:a 3 music/cancion_fragmento.mp3
```

---

## 6. Ejemplo completo

```
mi-quiz/
├─ questions.json
├─ audios/
│  ├─ PTT-20190704-WA0001.mp3
│  └─ PTT-20190704-WA0001_filtered.mp3
├─ images/
│  ├─ bicicleta.jpg
│  ├─ bicicleta_detalle.jpg
│  └─ excursion.jpg
├─ videos/
│  └─ excursion.mp4
└─ music/
   ├─ fiesta.mp3
   └─ fiesta_instrumental.mp3
```

```json
[
  {
    "question": "¿De qué color era la primera bicicleta del grupo?",
    "answers": { "right": "Roja", "wrong": ["Azul", "Verde", "Amarilla"] },
    "before": { "image": "bicicleta_detalle.jpg" },
    "after": { "image": "bicicleta.jpg" }
  },
  {
    "question": "¿Quién dijo \"mañana empiezo la dieta\"?",
    "answers": { "right": "Laura", "wrong": ["Marta", "Sofía", "Carmen", "Elena"] },
    "before": { "audio": "PTT-20190704-WA0001_filtered.mp3" },
    "after": { "audio": "PTT-20190704-WA0001.mp3" }
  },
  {
    "question": "¿Qué canción sonaba en todas las fiestas?",
    "answers": { "right": "Canción A", "wrong": ["Canción B", "Canción C", "Canción D", "Canción E", "Canción F"] },
    "before": { "music": "fiesta_instrumental.mp3" },
    "after": { "music": "fiesta.mp3" }
  },
  {
    "question": "¿Dónde fue la excursión de fin de curso?",
    "answers": { "right": "Granada", "wrong": ["Lisboa", "Roma", "Oporto"] },
    "after": { "image": "excursion.jpg", "video": "excursion.mp4" }
  }
]
```

---

## 7. Validar y crear el zip

### 7.1 Script de validación y empaquetado

Guárdalo como `recuerdoot_pack.py` y ejecútalo con Python 3.8+ (solo usa la biblioteca estándar):

```bash
python3 recuerdoot_pack.py mi-quiz          # valida
python3 recuerdoot_pack.py mi-quiz --zip    # valida y crea mi-quiz.zip
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
        return [f'{label}: "answers" debe ser un objeto con "right" y "wrong"']
    errors = []
    if not is_text(answers.get("right")):
        errors.append(f'{label}: "answers.right" debe ser un texto no vacío')
    wrong = answers.get("wrong")
    if not isinstance(wrong, list) or not 3 <= len(wrong) <= 5:
        return errors + [f'{label}: "answers.wrong" debe tener entre 3 y 5 respuestas']
    if not all(is_text(item) for item in wrong):
        errors.append(f'{label}: cada respuesta de "answers.wrong" debe ser un texto no vacío')
    options = [answers.get("right"), *wrong]
    if len(set(map(str, options))) != len(options):
        errors.append(f"{label}: las respuestas no pueden repetirse")
    return errors


def validate(root):
    root = Path(root)
    questions_path = root / "questions.json"
    if not questions_path.is_file():
        return [f"No existe {questions_path}"], [], set()
    try:
        raw = json.loads(questions_path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        return [f"questions.json no es un JSON válido: {error}"], [], set()
    if not isinstance(raw, list) or not raw:
        return ["questions.json debe ser una lista JSON con al menos una pregunta"], [], set()

    files = [f for f in root.rglob("*") if f.is_file() and not is_hidden(f, root)]
    errors, warnings, used = [], [], {questions_path}
    for index, entry in enumerate(raw, start=1):
        label = f"Pregunta {index}"
        if not isinstance(entry, dict):
            errors.append(f"{label}: debe ser un objeto")
            continue
        if not is_text(entry.get("question")):
            errors.append(f'{label}: "question" debe ser un texto no vacío')
        errors += check_answers(entry.get("answers"), label)
        for slot in SLOTS:
            media = entry.get(slot)
            if media is None:
                continue
            if not isinstance(media, dict):
                errors.append(f'{label}: "{slot}" debe ser un objeto')
                continue
            for kind, name in media.items():
                if kind not in KINDS:
                    errors.append(f'{label}: "{slot}.{kind}" no está permitido (usa audio, image, music, video)')
                elif not is_text(name):
                    errors.append(f'{label}: "{slot}.{kind}" debe ser un nombre de archivo')
                elif is_remote(name):
                    warnings.append(f"{label}: {slot}.{kind} es una URL; comprueba que abre el archivo directo")
                else:
                    found = find_file(root, files, kind, name)
                    if not found:
                        errors.append(f'{label}: falta el archivo "{KINDS[kind]}/{name}"')
                        continue
                    used.add(found)
                    if found.suffix.lower() not in SAFE_EXTENSIONS[kind]:
                        warnings.append(f"{label}: {found.name} puede no reproducirse en todos los navegadores; conviértelo")
                    if found.stat().st_size > BIG_FILE_MB * 1024 * 1024:
                        warnings.append(f"{label}: {found.name} pesa más de {BIG_FILE_MB} MB; considera comprimirlo")
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
        print("Uso: python3 recuerdoot_pack.py <carpeta-del-quiz> [--zip]")
        return 2
    errors, warnings, used = validate(args[0])
    for warning in warnings:
        print(f"⚠ {warning}")
    if errors:
        print(f"✗ {len(errors)} problema(s):")
        for error in errors:
            print(f"  - {error}")
        return 1
    print(f"✓ Quiz válido: {len(used) - 1} archivo(s) multimedia usados.")
    if "--zip" in sys.argv:
        print(f"✓ Creado {make_zip(args[0], used)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

El zip que crea solo incluye `questions.json` y los archivos que usan las preguntas, dentro de una carpeta con el nombre del quiz.

### 7.2 Si el asistente no puede ejecutar código

Entrega:

1. El contenido completo de `questions.json`.
2. Una tabla con cada archivo: nombre final, subcarpeta (`audios/`, `images/`, `videos/`, `music/`) y de qué archivo original sale o qué hay que hacerle (recortar, desenfocar, convertir).
3. Las instrucciones de 7.3 para crear el zip, o simplemente decirle que en Recuerdoot puede elegir la **carpeta** directamente.

### 7.3 Crear el zip a mano

- **macOS:** clic derecho en la carpeta `mi-quiz` → *Comprimir "mi-quiz"*. O en Terminal: `zip -r mi-quiz.zip mi-quiz -x "*.DS_Store" -x "__MACOSX/*"`
- **Windows:** clic derecho en la carpeta → *Enviar a* → *Carpeta comprimida (en zip)*. O en PowerShell: `Compress-Archive -Path mi-quiz -DestinationPath mi-quiz.zip`
- **Linux:** `zip -r mi-quiz.zip mi-quiz`

No hace falta zip: en Recuerdoot también puedes pulsar **Elegir carpeta** o arrastrar la carpeta.

---

## 8. Checklist final

- [ ] `questions.json` es una lista JSON válida (sin comentarios ni comas finales, comillas dobles, UTF-8).
- [ ] Cada pregunta tiene `question`, `answers.right` y entre 3 y 5 `answers.wrong`, sin opciones repetidas.
- [ ] `before`/`after` solo usan `audio`, `image`, `video`, `music`, con nombres de archivo (no rutas).
- [ ] Cada archivo existe en su subcarpeta y está en un formato compatible (mp3, jpg/png/webp, mp4 H.264).
- [ ] Los archivos *antes* no revelan la respuesta (voz distorsionada, foto recortada o desenfocada).
- [ ] Los audios *antes* duran entre 3 y 20 segundos.
- [ ] El orden de las preguntas tiene ritmo: variado, de menos a más.
- [ ] El script de validación da ✓ (o el juego muestra el quiz como **Listo** al cargarlo).

## 9. Errores frecuentes

El juego muestra los problemas al cargar el quiz. Cómo arreglarlos:

| Mensaje | Solución |
|---------|----------|
| `No se encuentra questions.json en lo que has elegido` | El archivo debe llamarse exactamente `questions.json` y estar en la raíz o dentro de una única carpeta. |
| `questions.json no es un JSON válido` | Revisa comas finales, comillas simples, comillas sin escapar (`\"`) o comentarios. |
| `"answers.wrong" debe tener entre 3 y 5 respuestas` | Añade o quita respuestas incorrectas. |
| `las respuestas no pueden repetirse` | La correcta aparece también entre las incorrectas, o hay dos iguales. |
| `"before.foto" no está permitido` | Usa solo `audio`, `image`, `video` o `music`. |
| `falta el archivo "images/x.jpg"` | El nombre no coincide (mayúsculas, extensión `.jpeg` vs `.jpg`, espacios) o el archivo no está en el pack. |
| El vídeo o la foto no se ve aunque el quiz está **Listo** | Formato no compatible (HEIC, MOV, HEVC): conviértelo (sección 5). |

## 10. Privacidad

- Los archivos se quedan en el ordenador del host: Recuerdoot los lee en el navegador y los guarda solo en ese navegador (botón **Quitar** para borrarlos).
- Los móviles nunca reciben las fotos, audios ni vídeos; solo las opciones de respuesta.
- No publiques el pack en un repositorio público ni en enlaces abiertos si contiene audios o fotos privadas.

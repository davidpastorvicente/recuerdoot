/*
 * Translations (Spanish and English) and the helpers that apply them. Browser + Node.
 * Loaded in <head>, before ui-shell.js, so the page language is set before the first paint.
 *
 * - `t(key, params)` returns a message. `{name}` interpolates a param, `{name:date}` formats an ISO
 *   date (YYYY-MM-DD), and messages with `one`/`other` forms are picked with `params.count`.
 * - Markup: `data-i18n` (text), `data-i18n-html` (trusted markup from this file), `data-i18n-<attr>`
 *   for aria-label, alt, placeholder and title, plus `data-i18n-params` (JSON). `translateDom()`
 *   reapplies them all, so dynamic texts set with `setText`/`setHtml`/`setAttr` follow language changes.
 * - Any element with `data-locale-option="es|en"` switches the language when clicked.
 */
(function initI18n(globalScope) {
  const STORAGE_KEY = "recuerdoot-locale";
  const LOCALES = Object.freeze(["es", "en"]);
  const DEFAULT_LOCALE = "es";
  // Iberian languages that are more likely to be read in Spanish than in English.
  const SPANISH_FALLBACKS = new Set(["es", "ca", "gl", "eu", "ast", "an"]);
  const ATTRIBUTES = Object.freeze(["aria-label", "alt", "placeholder", "title"]);
  const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  const MESSAGES = {
    es: {
      "lang.label": "Idioma",
      "page.playerTitle": "{app} · Jugar",
      "theme.toggle": "Cambiar tema",
      "theme.toLight": "Cambiar a tema claro",
      "theme.toDark": "Cambiar a tema oscuro",
      "nav.exit": "Salir",

      "date.months": ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
      "date.long": "{day} {month} {year}",
      "question.counter": "Pregunta {current} de {total}",
      "countdown.ready": "Preparados",
      "countdown.set": "Listos",
      "countdown.go": "¡Ya!",

      "start.tagline": "Juego de recuerdos",
      "start.questionCount": { one: "{count} pregunta", other: "{count} preguntas" },
      "start.title": 'Vuestros recuerdos, <span class="brand-highlight">en juego</span>.',
      "start.lede": "Preguntas sobre vuestros recuerdos con audios e imágenes. Adivina la respuesta correcta y descubre después el momento completo.",
      "start.multiplayer": "Multijugador",
      "start.creating": "Creando partida…",
      "start.solo": "Jugar solo",
      "start.shortcuts": 'Atajos: <kbd class="kbd">→</kbd> avanzar · <kbd class="kbd">1</kbd>–<kbd class="kbd">6</kbd> responder en solitario',
      "steps.label": "Cómo se juega",
      "steps.create.title": "Crea la partida",
      "steps.create.text": "La pantalla grande muestra un PIN y un código QR.",
      "steps.join.title": "Uníos desde el móvil",
      "steps.join.text": "Hasta 10 jugadores, cada uno con su nombre.",
      "steps.answer.title": "Escuchad y responded",
      "steps.answer.text": "Cuanto antes aciertes, más puntos sumas.",
      "steps.relive.title": "Revivid el momento",
      "steps.relive.text": "Tras cada pregunta llega el audio o la foto original.",

      "pack.overline": "Tu quiz",
      "pack.title.empty": "Carga tus preguntas",
      "pack.title.loading": "Cargando quiz…",
      "pack.title.invalid": "Hay que revisar el quiz",
      "pack.text.empty": "Elige una carpeta o un .zip con tu questions.json y sus fotos, audios y vídeos. Nada se sube a internet: todo se queda en este navegador.",
      "pack.text.loading": "Leyendo las preguntas y comprobando los archivos.",
      "pack.text.invalid": "Corrige estos puntos y vuelve a cargarlo:",
      "pack.status.ready": "Listo",
      "pack.status.invalid": "Con errores",
      "pack.count.questions": { one: "{count} pregunta", other: "{count} preguntas" },
      "pack.count.files": { one: "{count} archivo", other: "{count} archivos" },
      "pack.source.folder": "Carpeta",
      "pack.source.zip": "Archivo .zip",
      "pack.source.json": "questions.json",
      "pack.source.stored": "Guardado en este navegador",
      "pack.source.server": "questions.json del servidor local",
      "pack.moreErrors": "…y {count} más",
      "pack.chooseFolder": "Elegir carpeta",
      "pack.chooseZip": "Elegir .zip",
      "pack.clear": "Quitar",
      "pack.dropHint": "O arrastra aquí la carpeta, el .zip o un questions.json.",
      "pack.aiHint": '¿Lo preparas con una IA (ChatGPT, Claude, Gemini…)? Pásale la <a class="link" href="quiz-guide.md" target="_blank" rel="noopener">guía para crear el quiz</a> y te guiará paso a paso.',
      "pack.aiCopy": "Copiar instrucciones para la IA",
      "pack.help.summary": "¿Cómo preparo el quiz?",
      "pack.help.intro": 'Crea una carpeta con <code class="mono">questions.json</code> y, si usas archivos, estas subcarpetas:',
      "pack.help.tree": "mi-quiz/\n├─ questions.json\n├─ audios/\n├─ images/\n├─ videos/\n└─ music/",
      "pack.help.details": 'En <code class="mono">questions.json</code> escribe solo el nombre de cada archivo (<code class="mono">"image": "playa.jpg"</code>) o una dirección <code class="mono">https://</code>. En la <a class="link" href="quiz-guide.md" target="_blank" rel="noopener">guía completa</a> tienes un ejemplo, ideas de preguntas, formatos y cómo preparar audios y fotos.',
      "pack.guideFile": "quiz-guide.md",
      "pack.prompt": "Quiero crear un quiz de Recuerdoot sobre recuerdos de mi grupo.\nLee esta guía y sigue su flujo guiado: {url}\nHazme las preguntas de la entrevista, propón un guion de preguntas y ayúdame a preparar los archivos, el questions.json y el .zip.\nSi no puedes abrir el enlace, dímelo y te adjunto el archivo.",
      "pack.toast.copied": "Instrucciones copiadas: pégalas en tu asistente de IA.",
      "pack.toast.copyFailed": "No se han podido copiar. Abre la guía y pásale el enlace a tu IA.",
      "pack.toast.readFailed": "No se ha podido leer el quiz.",
      "pack.toast.saveFailed": "El quiz funciona, pero no se ha podido guardar: tendrás que cargarlo otra vez si recargas.",
      "pack.error.invalidJson": "questions.json no es un JSON válido: {detail}",
      "pack.error.noQuestions": "No se encuentra questions.json en lo que has elegido",
      "pack.error.zip": "No se ha podido abrir el .zip: {detail}",
      "pack.error.unsupported": "Elige una carpeta, un .zip o un questions.json",

      "validation.notList": "questions.json debe contener una lista JSON de preguntas",
      "validation.empty": "questions.json debe contener al menos una pregunta",
      "validation.label": "Pregunta {number}",
      "validation.entryObject": "{label}: debe ser un objeto",
      "validation.questionText": '{label}: "question" debe ser un texto no vacío',
      "validation.answersObject": '{label}: "answers" debe ser un objeto con "right" y "wrong"',
      "validation.rightText": '{label}: "answers.right" debe ser un texto no vacío',
      "validation.wrongCount": '{label}: "answers.wrong" debe tener entre {min} y {max} respuestas',
      "validation.wrongText": '{label}: cada respuesta de "answers.wrong" debe ser un texto no vacío',
      "validation.duplicates": "{label}: las respuestas no pueden repetirse",
      "validation.mediaObject": '{label}: "{slot}" debe ser un objeto',
      "validation.mediaKind": '{label}: "{slot}.{kind}" no está permitido (usa {kinds})',
      "validation.mediaFile": '{label}: "{slot}.{kind}" debe ser un nombre de archivo',
      "validation.missingFile": '{label}: falta el archivo "{path}"',

      "lobby.pinLabel": "PIN de la partida",
      "lobby.goTo": "Entra en",
      "lobby.scan": "Escanea para unirte",
      "lobby.qrLabel": "Código QR para unirse a la partida",
      "lobby.players": "Jugadores",
      "lobby.empty": "Aún no hay nadie. Escanead el código para uniros.",
      "lobby.waiting": "Esperando jugadores…",
      "lobby.start": { one: "Empezar ({count} jugador)", other: "Empezar ({count} jugadores)" },
      "lobby.starting": "Empezando…",

      "phase.reading": "Atentos al audio",
      "phase.listening": "Escuchando",
      "phase.answering": "¡A responder!",
      "question.timeLeft": "Tiempo restante",
      "question.imageAlt": "Imagen de la pregunta",
      "question.videoLabel": "Vídeo de la pregunta",
      "question.playAudio": "Reproducir o pausar el audio de la pregunta",
      "question.answers": "Respuestas",

      "reveal.imageAlt": "Imagen revelada de la pregunta",
      "reveal.videoLabel": "Vídeo revelado de la pregunta",
      "reveal.playAudio": "Reproducir o pausar el audio revelado",
      "reveal.chartLabel": "Respuestas por opción",
      "reveal.correctBadge": "✓ Correcta",
      "reveal.showScoreboard": "Ver marcador",
      "reveal.date": "{date:date}",

      "scoreboard.title": "Marcador",
      "scoreboard.next": "Siguiente pregunta",
      "scoreboard.results": "Ver resultados",
      "leaderboard.new": "Nuevo",
      "leaderboard.up": "Sube {count}",
      "leaderboard.down": "Baja {count}",
      "leaderboard.offline": "Desconectado",

      "solo.correct": "¡Correcto!",
      "solo.wrong": "¡Incorrecto!",
      "solo.correctWas": 'La respuesta correcta era <strong class="text-success">{answer}</strong>',
      "solo.next": "Siguiente",
      "solo.seeResult": "Ver resultado",
      "solo.revealImageAlt": "Imagen revelada tras responder",
      "solo.revealVideoLabel": "Vídeo revelado tras responder",
      "solo.endTitle": "Fin del juego",
      "solo.end.perfect": "Memoria perfecta. Conocéis a vuestras amigas mejor que nadie.",
      "solo.end.great": "¡Muy bien! Casi acertáis todas.",
      "solo.end.ok": "No está mal, ¡pero hay que repasar esos audios!",
      "solo.end.low": "Uy… ¡toca volver a escuchar esos audios!",
      "solo.restart": "Jugar otra vez",
      "solo.back": "Volver al inicio",

      "end.winner": "Ganador",
      "end.noWinner": "Sin ganador",
      "end.newGame": "Nueva partida",
      "score.points": { one: "{count} punto", other: "{count} puntos" },

      "exit.title": "¿Salir de la partida?",
      "exit.multi": "La partida terminará para todos los jugadores.",
      "exit.solo": "Perderás el progreso de esta partida.",
      "exit.keepPlaying": "Seguir jugando",
      "exit.confirm": "Salir",

      "host.createFailed": "No se ha podido crear la partida. Comprueba la conexión a internet e inténtalo de nuevo.",
      "host.endedOnLeave": "La partida terminó al salir de la página.",
      "gameOver.hostCancelled": "El host ha cancelado la partida",
      "gameOver.createFailed": "No se ha podido crear la partida",
      "gameOver.hostEnded": "El host ha terminado la partida",
      "gameOver.hostClosed": "El host ha cerrado la partida",
      "gameOver.hostGone": "La partida ha terminado: el host ya no está conectado",

      "join.error.wrongPin": "PIN incorrecto",
      "join.error.pinFormat": "Introduce el PIN de {length} cifras",
      "join.error.nameRequired": "Introduce tu nombre",
      "join.error.nameTaken": "Ese nombre ya está en uso",
      "join.error.started": "La partida ya ha comenzado",
      "join.error.full": "Sala llena (máx {max})",
      "join.error.connection": "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.",

      "player.reconnecting": "Reconectando…",
      "player.overline": "Únete a la partida",
      "player.title": "¿Listo para recordar?",
      "player.nameLabel": "Tu nombre",
      "player.namePlaceholder": "Nombre",
      "player.join": "Unirse",
      "player.joining": "Uniéndote…",
      "player.inside": "Estás dentro",
      "player.waitingStart": "Esperando a que empiece la partida",
      "player.answerNow": "¡Responde!",
      "player.listen": "Escucha el audio",
      "player.sent": "Respuesta enviada",
      "player.correct": "¡Correcto!",
      "player.wrong": "Incorrecto",
      "player.timeout": "Se acabó el tiempo",
      "player.gained": "+{points} puntos",
      "player.rank": "Posición",
      "player.points": "Puntos",
      "player.rankNow": "Vas en el puesto {rank}",
      "player.streak": "Racha de {count}",
      "player.waitingNext": "Esperando la siguiente pregunta",
      "player.gameOver": "Fin de la partida",
      "player.matchOver": "Partida terminada",
      "player.won": "¡Has ganado!",
      "player.place": "Puesto {rank}",
      "player.back": "Volver",
      "rank.1": "Primera posición",
      "rank.2": "Segunda posición",
      "rank.3": "Tercera posición",
    },

    en: {
      "lang.label": "Language",
      "page.playerTitle": "{app} · Play",
      "theme.toggle": "Toggle theme",
      "theme.toLight": "Switch to light theme",
      "theme.toDark": "Switch to dark theme",
      "nav.exit": "Exit",

      "date.months": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      "date.long": "{month} {day}, {year}",
      "question.counter": "Question {current} of {total}",
      "countdown.ready": "Ready",
      "countdown.set": "Set",
      "countdown.go": "Go!",

      "start.tagline": "Memory game",
      "start.questionCount": { one: "{count} question", other: "{count} questions" },
      "start.title": 'Your memories, <span class="brand-highlight">in play</span>.',
      "start.lede": "Questions about the memories you share, with voice notes and photos. Guess the right answer, then relive the whole moment.",
      "start.multiplayer": "Multiplayer",
      "start.creating": "Creating game…",
      "start.solo": "Play solo",
      "start.shortcuts": 'Shortcuts: <kbd class="kbd">→</kbd> next · <kbd class="kbd">1</kbd>–<kbd class="kbd">6</kbd> answer in solo mode',
      "steps.label": "How to play",
      "steps.create.title": "Create the game",
      "steps.create.text": "The big screen shows a PIN and a QR code.",
      "steps.join.title": "Join from your phones",
      "steps.join.text": "Up to 10 players, each with their own name.",
      "steps.answer.title": "Listen and answer",
      "steps.answer.text": "The faster you get it right, the more points you score.",
      "steps.relive.title": "Relive the moment",
      "steps.relive.text": "After each question, the original audio or photo is revealed.",

      "pack.overline": "Your quiz",
      "pack.title.empty": "Load your questions",
      "pack.title.loading": "Loading quiz…",
      "pack.title.invalid": "Your quiz needs a few fixes",
      "pack.text.empty": "Pick a folder or a .zip with your questions.json and its photos, audio clips and videos. Nothing is uploaded: everything stays in this browser.",
      "pack.text.loading": "Reading the questions and checking the files.",
      "pack.text.invalid": "Fix these issues and load it again:",
      "pack.status.ready": "Ready",
      "pack.status.invalid": "Has errors",
      "pack.count.questions": { one: "{count} question", other: "{count} questions" },
      "pack.count.files": { one: "{count} file", other: "{count} files" },
      "pack.source.folder": "Folder",
      "pack.source.zip": ".zip file",
      "pack.source.json": "questions.json",
      "pack.source.stored": "Saved in this browser",
      "pack.source.server": "Local server questions.json",
      "pack.moreErrors": "…and {count} more",
      "pack.chooseFolder": "Choose folder",
      "pack.chooseZip": "Choose .zip",
      "pack.clear": "Remove",
      "pack.dropHint": "Or drop the folder, the .zip or a questions.json here.",
      "pack.aiHint": 'Building it with an AI (ChatGPT, Claude, Gemini…)? Give it the <a class="link" href="quiz-guide.en.md" target="_blank" rel="noopener">quiz creation guide</a> and it will walk you through it step by step.',
      "pack.aiCopy": "Copy instructions for your AI",
      "pack.help.summary": "How do I prepare the quiz?",
      "pack.help.intro": 'Create a folder with <code class="mono">questions.json</code> and, if you use files, these subfolders:',
      "pack.help.tree": "my-quiz/\n├─ questions.json\n├─ audios/\n├─ images/\n├─ videos/\n└─ music/",
      "pack.help.details": 'In <code class="mono">questions.json</code>, write just the name of each file (<code class="mono">"image": "beach.jpg"</code>) or an <code class="mono">https://</code> address. The <a class="link" href="quiz-guide.en.md" target="_blank" rel="noopener">full guide</a> has an example, question ideas, formats and tips for preparing audio and photos.',
      "pack.guideFile": "quiz-guide.en.md",
      "pack.prompt": "I want to create a Recuerdoot quiz about my group's memories.\nRead this guide and follow its guided flow: {url}\nAsk me the interview questions, suggest a list of questions and help me prepare the files, the questions.json and the .zip.\nIf you can't open the link, tell me and I'll attach the file.",
      "pack.toast.copied": "Instructions copied: paste them into your AI assistant.",
      "pack.toast.copyFailed": "Couldn't copy them. Open the guide and give the link to your AI.",
      "pack.toast.readFailed": "Couldn't read the quiz.",
      "pack.toast.saveFailed": "The quiz works, but it couldn't be saved: you'll need to load it again if you reload the page.",
      "pack.error.invalidJson": "questions.json is not valid JSON: {detail}",
      "pack.error.noQuestions": "There is no questions.json in what you picked",
      "pack.error.zip": "Couldn't open the .zip: {detail}",
      "pack.error.unsupported": "Pick a folder, a .zip or a questions.json",

      "validation.notList": "questions.json must contain a JSON list of questions",
      "validation.empty": "questions.json must contain at least one question",
      "validation.label": "Question {number}",
      "validation.entryObject": "{label}: must be an object",
      "validation.questionText": '{label}: "question" must be a non-empty text',
      "validation.answersObject": '{label}: "answers" must be an object with "right" and "wrong"',
      "validation.rightText": '{label}: "answers.right" must be a non-empty text',
      "validation.wrongCount": '{label}: "answers.wrong" must have between {min} and {max} answers',
      "validation.wrongText": '{label}: every answer in "answers.wrong" must be a non-empty text',
      "validation.duplicates": "{label}: answers cannot be repeated",
      "validation.mediaObject": '{label}: "{slot}" must be an object',
      "validation.mediaKind": '{label}: "{slot}.{kind}" is not allowed (use {kinds})',
      "validation.mediaFile": '{label}: "{slot}.{kind}" must be a file name',
      "validation.missingFile": '{label}: missing file "{path}"',

      "lobby.pinLabel": "Game PIN",
      "lobby.goTo": "Go to",
      "lobby.scan": "Scan to join",
      "lobby.qrLabel": "QR code to join the game",
      "lobby.players": "Players",
      "lobby.empty": "Nobody here yet. Scan the code to join.",
      "lobby.waiting": "Waiting for players…",
      "lobby.start": { one: "Start ({count} player)", other: "Start ({count} players)" },
      "lobby.starting": "Starting…",

      "phase.reading": "Get ready to listen",
      "phase.listening": "Listening",
      "phase.answering": "Answer now!",
      "question.timeLeft": "Time left",
      "question.imageAlt": "Question image",
      "question.videoLabel": "Question video",
      "question.playAudio": "Play or pause the question audio",
      "question.answers": "Answers",

      "reveal.imageAlt": "Revealed question image",
      "reveal.videoLabel": "Revealed question video",
      "reveal.playAudio": "Play or pause the revealed audio",
      "reveal.chartLabel": "Answers per option",
      "reveal.correctBadge": "✓ Correct",
      "reveal.showScoreboard": "Show scoreboard",
      "reveal.date": "{date:date}",

      "scoreboard.title": "Scoreboard",
      "scoreboard.next": "Next question",
      "scoreboard.results": "See results",
      "leaderboard.new": "New",
      "leaderboard.up": "Up {count}",
      "leaderboard.down": "Down {count}",
      "leaderboard.offline": "Disconnected",

      "solo.correct": "Correct!",
      "solo.wrong": "Wrong!",
      "solo.correctWas": 'The right answer was <strong class="text-success">{answer}</strong>',
      "solo.next": "Next",
      "solo.seeResult": "See result",
      "solo.revealImageAlt": "Image revealed after answering",
      "solo.revealVideoLabel": "Video revealed after answering",
      "solo.endTitle": "Game over",
      "solo.end.perfect": "Perfect memory. Nobody knows your friends better than you.",
      "solo.end.great": "Great job! You got almost all of them.",
      "solo.end.ok": "Not bad, but those voice notes deserve another listen!",
      "solo.end.low": "Oops… time to listen to those voice notes again!",
      "solo.restart": "Play again",
      "solo.back": "Back to start",

      "end.winner": "Winner",
      "end.noWinner": "No winner",
      "end.newGame": "New game",
      "score.points": { one: "{count} point", other: "{count} points" },

      "exit.title": "Leave the game?",
      "exit.multi": "The game will end for every player.",
      "exit.solo": "You'll lose your progress in this game.",
      "exit.keepPlaying": "Keep playing",
      "exit.confirm": "Leave",

      "host.createFailed": "Couldn't create the game. Check your internet connection and try again.",
      "host.endedOnLeave": "The game ended when you left the page.",
      "gameOver.hostCancelled": "The host cancelled the game",
      "gameOver.createFailed": "The game couldn't be created",
      "gameOver.hostEnded": "The host ended the game",
      "gameOver.hostClosed": "The host closed the game",
      "gameOver.hostGone": "The game is over: the host is no longer connected",

      "join.error.wrongPin": "Wrong PIN",
      "join.error.pinFormat": "Enter the {length}-digit PIN",
      "join.error.nameRequired": "Enter your name",
      "join.error.nameTaken": "That name is already taken",
      "join.error.started": "The game has already started",
      "join.error.full": "The room is full (max {max})",
      "join.error.connection": "Couldn't connect. Check your connection and try again.",

      "player.reconnecting": "Reconnecting…",
      "player.overline": "Join the game",
      "player.title": "Ready to remember?",
      "player.nameLabel": "Your name",
      "player.namePlaceholder": "Name",
      "player.join": "Join",
      "player.joining": "Joining…",
      "player.inside": "You're in",
      "player.waitingStart": "Waiting for the game to start",
      "player.answerNow": "Answer now!",
      "player.listen": "Listen to the audio",
      "player.sent": "Answer sent",
      "player.correct": "Correct!",
      "player.wrong": "Wrong",
      "player.timeout": "Time's up",
      "player.gained": "+{points} points",
      "player.rank": "Rank",
      "player.points": "Points",
      "player.rankNow": "You're in position {rank}",
      "player.streak": "{count} in a row",
      "player.waitingNext": "Waiting for the next question",
      "player.gameOver": "Game over",
      "player.matchOver": "Game finished",
      "player.won": "You won!",
      "player.place": "Position {rank}",
      "player.back": "Back",
      "rank.1": "First place",
      "rank.2": "Second place",
      "rank.3": "Third place",
    },
  };

  const pluralRules = new Map();
  const listeners = new Set();
  let locale = DEFAULT_LOCALE;

  const isSupported = (value) => LOCALES.includes(value);
  const escapeHtml = (value) => String(value).replaceAll(/[&<>"']/g, (character) => HTML_ESCAPES[character]);

  function lookup(key) {
    return MESSAGES[locale][key] ?? MESSAGES[DEFAULT_LOCALE][key];
  }

  function pluralCategory(count) {
    if (!pluralRules.has(locale)) pluralRules.set(locale, new Intl.PluralRules(locale));
    return pluralRules.get(locale).select(count);
  }

  /** "2019-07-04" -> "4 julio 2019" / "July 4, 2019". Anything else is returned unchanged. */
  function formatDate(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
    const month = match ? lookup("date.months")[Number(match[2]) - 1] : null;
    if (!month) return String(iso ?? "");
    return interpolate(lookup("date.long"), { day: Number(match[3]), month, year: match[1] });
  }

  const FORMATTERS = { date: formatDate };

  function interpolate(template, params, encode = String) {
    return template.replaceAll(/\{(\w+)(?::(\w+))?\}/g, (placeholder, name, format) => {
      if (!Object.hasOwn(params, name)) return placeholder;
      const value = format && FORMATTERS[format] ? FORMATTERS[format](params[name]) : params[name];
      return encode(value);
    });
  }

  function resolve(key, params) {
    const message = lookup(key);
    if (message === undefined) return key;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
    return message[pluralCategory(Number(params.count))] ?? message.other;
  }

  /** The message for `key` in the current language; params are interpolated as plain text. */
  function t(key, params = {}) {
    return interpolate(resolve(key, params), params);
  }

  /** Like t() for markup messages: the message itself is trusted, params are HTML-escaped. */
  function tHtml(key, params = {}) {
    return interpolate(resolve(key, params), params, escapeHtml);
  }

  // ---------- DOM ----------

  const hasDom = () => typeof document !== "undefined";
  const DOM_SELECTOR = ["[data-i18n]", "[data-i18n-html]", ...ATTRIBUTES.map((attribute) => `[data-i18n-${attribute}]`)].join(",");

  function readParams(element) {
    try {
      return element.dataset.i18nParams ? JSON.parse(element.dataset.i18nParams) : {};
    } catch {
      return {};
    }
  }

  function writeParams(element, params) {
    if (params && Object.keys(params).length > 0) {
      element.dataset.i18nParams = JSON.stringify(params);
    } else {
      delete element.dataset.i18nParams;
    }
  }

  function translateElement(element) {
    const params = readParams(element);
    if (element.dataset.i18n) element.textContent = t(element.dataset.i18n, params);
    if (element.dataset.i18nHtml) element.innerHTML = tHtml(element.dataset.i18nHtml, params);
    ATTRIBUTES.forEach((attribute) => {
      const key = element.getAttribute(`data-i18n-${attribute}`);
      if (key) element.setAttribute(attribute, t(key, params));
    });
  }

  function applyPageTitle() {
    const key = document.body?.dataset.i18nTitle;
    const app = globalScope.RECUERDOOT_CONFIG?.APP_NAME ?? "Recuerdoot";
    document.title = key ? t(key, { app }) : app;
  }

  function syncLocaleOptions() {
    document.querySelectorAll("[data-locale-option]").forEach((option) => {
      option.setAttribute("aria-pressed", String(option.dataset.localeOption === locale));
    });
  }

  /** Translates every marked element under `root` (the whole page by default). */
  function translateDom(root = hasDom() ? document : null) {
    if (!root) return;
    if (root.matches?.(DOM_SELECTOR)) translateElement(root);
    root.querySelectorAll(DOM_SELECTOR).forEach(translateElement);
    if (root === document) {
      document.documentElement.lang = locale;
      applyPageTitle();
      syncLocaleOptions();
    }
  }

  /** Sets a translated text that follows language changes. */
  function setText(element, key, params) {
    delete element.dataset.i18nHtml;
    element.dataset.i18n = key;
    writeParams(element, params);
    element.textContent = t(key, params);
  }

  /** Sets translated markup (a trusted message with escaped params) that follows language changes. */
  function setHtml(element, key, params) {
    delete element.dataset.i18n;
    element.dataset.i18nHtml = key;
    writeParams(element, params);
    element.innerHTML = tHtml(key, params);
  }

  /** Sets literal text (names, questions, numbers) and stops translating the element. */
  function setPlain(element, text) {
    delete element.dataset.i18n;
    delete element.dataset.i18nHtml;
    delete element.dataset.i18nParams;
    element.textContent = text;
  }

  /** Sets a translated attribute (aria-label, alt, placeholder, title) that follows language changes. */
  function setAttr(element, attribute, key, params) {
    element.setAttribute(`data-i18n-${attribute}`, key);
    writeParams(element, params);
    element.setAttribute(attribute, t(key, params));
  }

  /** Attribute string for markup built as HTML: `<span ${attrs("key")}>${t("key")}</span>`. */
  function attrs(key, params, attribute = null) {
    const name = attribute ? `data-i18n-${attribute}` : "data-i18n";
    const encodedParams = params ? ` data-i18n-params="${escapeHtml(JSON.stringify(params))}"` : "";
    return `${name}="${escapeHtml(key)}"${encodedParams}`;
  }

  // ---------- Locale ----------

  function readStoredLocale() {
    try {
      return globalScope.localStorage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  function storeLocale(value) {
    try {
      globalScope.localStorage?.setItem(STORAGE_KEY, value);
    } catch {
      // Private mode: the choice lasts for this page view.
    }
  }

  /** `?lang=` first, then the saved choice, then the browser languages; English for everyone else. */
  function detectLocale() {
    const fromUrl = new URLSearchParams(globalScope.location?.search ?? "").get("lang");
    if (isSupported(fromUrl)) return fromUrl;
    const stored = readStoredLocale();
    if (isSupported(stored)) return stored;

    const preferred = globalScope.navigator?.languages ?? [globalScope.navigator?.language];
    for (const tag of preferred.filter(Boolean)) {
      const base = tag.toLowerCase().split("-")[0];
      if (isSupported(base)) return base;
      if (SPANISH_FALLBACKS.has(base)) return "es";
    }
    return "en";
  }

  /** A chosen language replaces a `?lang=` link parameter, so reloading keeps the choice. */
  function dropUrlLocale() {
    const url = new URL(globalScope.location.href);
    if (!url.searchParams.has("lang")) return;
    url.searchParams.delete("lang");
    globalScope.history.replaceState(globalScope.history.state, "", url);
  }

  function getLocale() {
    return locale;
  }

  /** Changes the language, saves the choice (in the browser), retranslates the page and notifies listeners. */
  function setLocale(next, { persist = true } = {}) {
    if (!isSupported(next)) return false;
    const changed = next !== locale;
    locale = next;
    if (hasDom()) {
      if (persist) {
        storeLocale(next);
        dropUrlLocale();
      }
      translateDom();
    }
    if (changed) listeners.forEach((listener) => listener(locale));
    return true;
  }

  /** Calls `listener(locale)` after every language change. Returns an unsubscribe function. */
  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  const api = {
    DEFAULT_LOCALE,
    LOCALES,
    MESSAGES,
    attrs,
    detectLocale,
    formatDate,
    getLocale,
    onChange,
    setAttr,
    setHtml,
    setLocale,
    setPlain,
    setText,
    t,
    tHtml,
    translateDom,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.RECUERDOOT_I18N = api;

  if (hasDom()) {
    locale = detectLocale();
    document.documentElement.lang = locale;
    document.addEventListener("DOMContentLoaded", () => {
      translateDom();
      document.addEventListener("click", (event) => {
        const option = event.target.closest?.("[data-locale-option]");
        if (option) setLocale(option.dataset.localeOption);
      });
    });
  }
})(globalThis);

/*
 * Quiz pack rules shared by the browser and Node: questions.json validation and the lookup of
 * media files inside a pack (a folder or .zip with questions.json plus audios/, images/, videos/, music/).
 * Pure functions only; reading files, zips and IndexedDB lives in pack-loader.js.
 */
(function initQuizPack(globalScope) {
  const isNode = typeof module !== "undefined" && module.exports;
  const { MEDIA_FOLDERS, isRemoteMedia } = isNode ? require("./game-shared.js") : globalScope.RECUERDOOT_SHARED;
  const { t } = isNode ? require("./i18n.js") : globalScope.RECUERDOOT_I18N;

  const QUESTIONS_FILE = "questions.json";
  const MEDIA_SLOTS = ["before", "after"];
  const MEDIA_KINDS = Object.keys(MEDIA_FOLDERS);
  const MIN_WRONG_ANSWERS = 3;
  const MAX_WRONG_ANSWERS = 5;
  // Folder of each media kind inside a pack, e.g. "audios" for "assets/audios".
  const PACK_FOLDERS = Object.freeze(Object.fromEntries(
    Object.entries(MEDIA_FOLDERS).map(([kind, folder]) => [kind, folder.split("/").pop()])
  ));
  // Hidden files and macOS zip metadata.
  const IGNORED_PATH = /(?:^|\/)(?:__MACOSX|\.[^/]*)(?:\/|$)/;

  const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

  // ---------- questions.json schema ----------

  function validateAnswers(answers, label) {
    if (!answers || typeof answers !== "object") {
      return [t("validation.answersObject", { label })];
    }

    const errors = [];
    if (!isNonEmptyString(answers.right)) {
      errors.push(t("validation.rightText", { label }));
    }

    const { wrong } = answers;
    if (!Array.isArray(wrong) || wrong.length < MIN_WRONG_ANSWERS || wrong.length > MAX_WRONG_ANSWERS) {
      errors.push(t("validation.wrongCount", { label, min: MIN_WRONG_ANSWERS, max: MAX_WRONG_ANSWERS }));
      return errors;
    }

    if (!wrong.every(isNonEmptyString)) {
      errors.push(t("validation.wrongText", { label }));
    }

    const options = [answers.right, ...wrong];
    if (new Set(options).size !== options.length) {
      errors.push(t("validation.duplicates", { label }));
    }
    return errors;
  }

  function validateMedia(media, slot, label) {
    if (media === undefined) return [];
    if (!media || typeof media !== "object" || Array.isArray(media)) {
      return [t("validation.mediaObject", { label, slot })];
    }

    return Object.entries(media).flatMap(([kind, file]) => {
      if (!MEDIA_KINDS.includes(kind)) {
        return [t("validation.mediaKind", { label, slot, kind, kinds: MEDIA_KINDS.join(", ") })];
      }
      return isNonEmptyString(file) ? [] : [t("validation.mediaFile", { label, slot, kind })];
    });
  }

  /** Returns a list of readable problems in the current language; an empty list means the questions are valid. */
  function validateQuestions(raw) {
    if (!Array.isArray(raw)) {
      return [t("validation.notList")];
    }
    if (raw.length === 0) {
      return [t("validation.empty")];
    }

    return raw.flatMap((entry, index) => {
      const label = t("validation.label", { number: index + 1 });
      if (!entry || typeof entry !== "object") {
        return [t("validation.entryObject", { label })];
      }

      return [
        ...(isNonEmptyString(entry.question) ? [] : [t("validation.questionText", { label })]),
        ...validateAnswers(entry.answers, label),
        ...MEDIA_SLOTS.flatMap((slot) => validateMedia(entry[slot], slot, label)),
      ];
    });
  }

  /** Every local media file referenced by valid questions (remote URLs are skipped). */
  function listMediaReferences(raw) {
    return raw.flatMap((entry, index) => MEDIA_SLOTS.flatMap((slot) =>
      Object.entries(entry[slot] || {})
        .filter(([kind, file]) => MEDIA_KINDS.includes(kind) && !isRemoteMedia(file))
        .map(([kind, file]) => ({ question: index + 1, slot, kind, file }))
    ));
  }

  // ---------- Pack file index ----------

  function normalizePath(path) {
    return String(path).replaceAll("\\", "/").replace(/^(?:\.\/|\/)+/, "");
  }

  const depthOf = (path) => path.split("/").length;
  const baseName = (path) => path.split("/").pop().toLowerCase();

  /**
   * Indexes the paths of a picked folder, zip or drop. The shallowest questions.json marks the
   * pack root, so a zip with a single top-level folder works the same as a flat one.
   * Returns null when there is no questions.json.
   */
  function indexPackPaths(paths) {
    const usable = paths.map(normalizePath).filter((path) => path && !IGNORED_PATH.test(path));
    const questionsPath = usable
      .filter((path) => path === QUESTIONS_FILE || path.endsWith(`/${QUESTIONS_FILE}`))
      .sort((a, b) => depthOf(a) - depthOf(b))[0];
    if (!questionsPath) return null;

    const root = questionsPath.slice(0, -QUESTIONS_FILE.length);
    const files = new Map();
    const byBaseName = new Map();
    for (const path of usable) {
      if (!path.startsWith(root)) continue;
      const relative = path.slice(root.length);
      files.set(relative, path);
      const key = baseName(relative);
      byBaseName.set(key, [...(byBaseName.get(key) ?? []), relative]);
    }
    return { questionsPath, files, byBaseName };
  }

  /**
   * Finds a media file in the pack: first `<kind folder>/<file>`, then `assets/<kind folder>/<file>`
   * and `<file>` at the root, then a unique file with that name anywhere. Returns the original path or null.
   */
  function resolvePackPath(index, kind, file) {
    const name = normalizePath(file);
    const folder = PACK_FOLDERS[kind];
    const direct = [`${folder}/${name}`, `assets/${folder}/${name}`, name].find((candidate) => index.files.has(candidate));
    if (direct) return index.files.get(direct);

    const sameName = index.byBaseName.get(baseName(name)) ?? [];
    if (sameName.length === 1) return index.files.get(sameName[0]);

    const inFolder = sameName.filter((path) => path.split("/").includes(folder));
    return inFolder.length === 1 ? index.files.get(inFolder[0]) : null;
  }

  /** Readable problems for media files the questions reference but the pack does not contain. */
  function findMissingMedia(raw, index) {
    const seen = new Set();
    return listMediaReferences(raw).flatMap(({ question, kind, file }) => {
      const key = `${kind}:${file}`;
      if (seen.has(key) || resolvePackPath(index, kind, file)) return [];
      seen.add(key);
      const label = t("validation.label", { number: question });
      return [t("validation.missingFile", { label, path: `${PACK_FOLDERS[kind]}/${file}` })];
    });
  }

  const api = {
    MEDIA_KINDS,
    PACK_FOLDERS,
    QUESTIONS_FILE,
    findMissingMedia,
    indexPackPaths,
    listMediaReferences,
    normalizePath,
    resolvePackPath,
    validateQuestions,
  };

  if (isNode) {
    module.exports = api;
  }

  globalScope.RECUERDOOT_PACK = api;
})(globalThis);

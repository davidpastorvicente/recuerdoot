/*
 * Loads a quiz pack in the host browser. A pack is questions.json plus the media it references,
 * picked as a folder, a .zip, a single questions.json or dropped onto the page. Files never leave
 * the browser: media plays from blob: URLs and the pack is kept in IndexedDB for the next visit.
 *
 * Every loader resolves to a pack:
 * { name, source, raw, errors, questionCount, mediaCount, files, resolveMedia(kind, file), release() }
 * `errors` is empty when the pack can be played.
 */
(function initPackLoader(globalScope) {
  const { isRemoteMedia, resolveAssetMedia } = globalScope.RECUERDOOT_SHARED;
  const { t } = globalScope.RECUERDOOT_I18N;
  const {
    PACK_FOLDERS,
    QUESTIONS_FILE,
    findMissingMedia,
    indexPackPaths,
    listMediaReferences,
    normalizePath,
    resolvePackPath,
    validateQuestions,
  } = globalScope.RECUERDOOT_PACK;

  const DB_NAME = "recuerdoot";
  const DB_STORE = "packs";
  const DB_KEY = "current";
  const MIME_TYPES = Object.freeze({
    aac: "audio/aac",
    avif: "image/avif",
    flac: "audio/flac",
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    json: "application/json",
    m4a: "audio/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    oga: "audio/ogg",
    ogg: "audio/ogg",
    opus: "audio/ogg",
    png: "image/png",
    svg: "image/svg+xml",
    wav: "audio/wav",
    weba: "audio/webm",
    webm: "video/webm",
    webp: "image/webp",
  });

  const mimeFor = (path) => MIME_TYPES[path.split(".").pop().toLowerCase()] ?? "";
  const stripExtension = (name) => name.replace(/\.[^.]+$/, "");
  const canonicalPath = (kind, file) => `${PACK_FOLDERS[kind]}/${normalizePath(file)}`;

  // ---------- Pack building ----------

  function createPack({ name, source, raw = null, errors = [], files = new Map(), resolveFile = null }) {
    const urls = new Map();

    function resolveMedia(kind, file) {
      if (isRemoteMedia(file)) return file;
      if (resolveFile) return resolveFile(kind, file);

      const key = canonicalPath(kind, file);
      if (!urls.has(key) && files.has(key)) urls.set(key, URL.createObjectURL(files.get(key)));
      return urls.get(key) ?? null;
    }

    return {
      name,
      source,
      raw,
      errors,
      files,
      questionCount: Array.isArray(raw) ? raw.length : 0,
      mediaCount: raw && errors.length === 0 ? new Set(listMediaReferences(raw).map(({ kind, file }) => canonicalPath(kind, file))).size : 0,
      resolveMedia,
      release() {
        urls.forEach((url) => URL.revokeObjectURL(url));
        urls.clear();
      },
    };
  }

  async function parseQuestions(blob) {
    try {
      return { raw: JSON.parse(await blob.text()) };
    } catch (error) {
      return { error: t("pack.error.invalidJson", { detail: error.message }) };
    }
  }

  /** Validates the entries and keeps only questions.json and the media the questions use, under canonical paths. */
  async function buildPack(entries, meta) {
    const index = indexPackPaths(entries.map((entry) => entry.path));
    if (!index) {
      return createPack({ ...meta, errors: [t("pack.error.noQuestions")] });
    }

    const blobs = new Map(entries.map((entry) => [normalizePath(entry.path), entry.blob]));
    const questionsBlob = blobs.get(index.questionsPath);
    const { raw, error } = await parseQuestions(questionsBlob);
    if (error) return createPack({ ...meta, errors: [error] });

    const schemaErrors = validateQuestions(raw);
    const errors = schemaErrors.length > 0 ? schemaErrors : findMissingMedia(raw, index);
    if (errors.length > 0) return createPack({ ...meta, raw, errors });

    const files = new Map([[QUESTIONS_FILE, questionsBlob]]);
    for (const { kind, file } of listMediaReferences(raw)) {
      files.set(canonicalPath(kind, file), blobs.get(resolvePackPath(index, kind, file)));
    }
    return createPack({ ...meta, raw, files });
  }

  // ---------- Sources ----------

  /** Files from `<input type="file" webkitdirectory>`; paths start with the picked folder name. */
  function fromFileList(fileList) {
    const files = Array.from(fileList);
    const entries = files.map((file) => ({ path: file.webkitRelativePath || file.name, blob: file }));
    const name = files[0]?.webkitRelativePath?.split("/")[0] || "Quiz";
    return buildPack(entries, { name, source: "folder" });
  }

  function unzip(bytes) {
    const { fflate } = globalScope;
    const filter = (file) => !file.name.endsWith("/");
    return new Promise((resolve, reject) => {
      fflate.unzip(bytes, { filter }, (error, data) => {
        if (!error) {
          resolve(data);
          return;
        }
        // Workers can be unavailable; the synchronous version blocks briefly but always works.
        try {
          resolve(fflate.unzipSync(bytes, { filter }));
        } catch (syncError) {
          reject(syncError);
        }
      });
    });
  }

  async function fromZipFile(file) {
    const meta = { name: stripExtension(file.name), source: "zip" };
    let data;
    try {
      data = await unzip(new Uint8Array(await file.arrayBuffer()));
    } catch (error) {
      return createPack({ ...meta, errors: [t("pack.error.zip", { detail: error.message })] });
    }
    const entries = Object.entries(data).map(([path, bytes]) => ({ path, blob: new Blob([bytes], { type: mimeFor(path) }) }));
    return buildPack(entries, meta);
  }

  /** A single picked or dropped file: a .zip pack or a lone questions.json (media as URLs, or none). */
  function fromFile(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    if (extension === "zip") return fromZipFile(file);
    if (extension === "json") {
      return buildPack([{ path: QUESTIONS_FILE, blob: file }], { name: stripExtension(file.name), source: "json" });
    }
    return Promise.resolve(createPack({
      name: file.name,
      source: "file",
      errors: [t("pack.error.unsupported")],
    }));
  }

  function readDirectoryBatch(reader) {
    return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
  }

  async function readEntry(entry, prefix) {
    const path = `${prefix}${entry.name}`;
    if (entry.isFile) {
      const blob = await new Promise((resolve, reject) => entry.file(resolve, reject));
      return [{ path, blob }];
    }

    const reader = entry.createReader();
    const children = [];
    for (let batch = await readDirectoryBatch(reader); batch.length > 0; batch = await readDirectoryBatch(reader)) {
      children.push(...batch);
    }
    const nested = await Promise.all(children.map((child) => readEntry(child, `${path}/`)));
    return nested.flat();
  }

  /**
   * Dropped items. `entries` and `files` must be read synchronously inside the drop event
   * (`item.webkitGetAsEntry()` and `dataTransfer.files`), so the caller passes them in.
   */
  async function fromDrop({ entries, files }) {
    const roots = entries.filter(Boolean);
    if (roots.length === 1 && roots[0].isFile && files[0]) return fromFile(files[0]);
    if (roots.length === 0 && files.length === 1) return fromFile(files[0]);

    const read = await Promise.all(roots.map((root) => readEntry(root, "")));
    const name = roots.length === 1 ? roots[0].name : "Quiz";
    return buildPack(read.flat(), { name, source: "folder" });
  }

  /** The dev server can serve its own questions.json, with media under assets/. */
  async function fromServer() {
    let response;
    try {
      response = await fetch("questions.json", { cache: "no-store" });
    } catch {
      return null;
    }
    if (!response.ok) return null;

    const { raw, error } = await parseQuestions(await response.blob());
    const meta = { name: "questions.json", source: "server", resolveFile: resolveAssetMedia };
    if (error) return createPack({ ...meta, errors: [error] });
    return createPack({ ...meta, raw, errors: validateQuestions(raw) });
  }

  // ---------- IndexedDB ----------

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function withStore(mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, mode);
      const request = action(transaction.objectStore(DB_STORE));
      transaction.oncomplete = () => {
        db.close();
        resolve(request.result);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
      transaction.onabort = transaction.onerror;
    });
  }

  /** Copies a playable pack into IndexedDB so it survives reloads. */
  async function saveStored(pack) {
    navigator.storage?.persist?.().catch(() => {});
    const record = {
      name: pack.name,
      source: pack.source,
      savedAt: Date.now(),
      files: Array.from(pack.files, ([path, blob]) => ({ path, blob })),
    };
    await withStore("readwrite", (store) => store.put(record, DB_KEY));
  }

  async function loadStored() {
    const record = await withStore("readonly", (store) => store.get(DB_KEY));
    if (!record?.files?.length) return null;
    return buildPack(record.files, { name: record.name, source: "stored" });
  }

  function clearStored() {
    return withStore("readwrite", (store) => store.delete(DB_KEY));
  }

  globalScope.RECUERDOOT_PACK_LOADER = {
    clearStored,
    fromDrop,
    fromFile,
    fromFileList,
    fromServer,
    loadStored,
    saveStored,
  };
})(globalThis);

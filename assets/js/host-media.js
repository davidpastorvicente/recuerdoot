(function initHostMedia(globalScope) {
  const FADE_OUT_MS = 180;
  const noop = () => {};

  function createFader() {
    const fades = new WeakMap();

    function cancel(element, volume) {
      const fade = fades.get(element);
      if (fade?.frameId) cancelAnimationFrame(fade.frameId);
      fades.delete(element);
      element.volume = volume;
    }

    function stop(element, volume, { immediate = false, resetSource = false, onDone = noop } = {}) {
      cancel(element, volume);

      const finalize = () => {
        fades.delete(element);
        element.pause();
        element.currentTime = 0;
        element.volume = volume;
        if (resetSource) {
          element.removeAttribute("src");
          element.load();
        }
        onDone();
      };

      if (immediate || element.paused || element.ended || element.currentTime === 0) {
        finalize();
        return;
      }

      const fade = { frameId: null, startedAt: performance.now(), startVolume: element.volume };
      fades.set(element, fade);

      const step = (now) => {
        if (fades.get(element) !== fade) return;
        const progress = Math.min((now - fade.startedAt) / FADE_OUT_MS, 1);
        element.volume = fade.startVolume * (1 - progress);
        if (progress < 1) {
          fade.frameId = requestAnimationFrame(step);
          return;
        }
        finalize();
      };
      fade.frameId = requestAnimationFrame(step);
    }

    return { cancel, stop };
  }

  /**
   * Owns the two host audio channels:
   * - foreground: question/reveal clips (idle <-> playing, one-shot `onEnded` callback)
   * - music: looping background track that ducks while the foreground plays
   */
  function createMediaController({ foreground, music, volumes, onForegroundChange = noop }) {
    const fader = createFader();
    let playing = false;
    let ducked = false;
    let endedAction = null;
    let pendingSource;

    music.volume = volumes.music;

    function syncMusicVolume() {
      if (!music.getAttribute("src")) return;
      music.volume = ducked ? volumes.musicDucked : volumes.music;
    }

    function setDucked(value) {
      ducked = value;
      syncMusicVolume();
    }

    function setPlaying(value) {
      playing = value;
      onForegroundChange(value);
    }

    function applyPendingSource() {
      if (pendingSource === undefined) return;
      const source = pendingSource;
      pendingSource = undefined;
      if (source) {
        foreground.src = source;
      } else {
        foreground.removeAttribute("src");
      }
      foreground.load();
    }

    function stopForeground({ immediate = false } = {}) {
      endedAction = null;
      setPlaying(false);
      fader.stop(foreground, volumes.foreground, {
        immediate,
        onDone: () => {
          setDucked(false);
          applyPendingSource();
        },
      });
    }

    /** Swaps the foreground clip after the current one fades out. `null` clears it. */
    function loadForeground(source) {
      pendingSource = source || null;
      stopForeground();
    }

    /** Resolves to `false` when the browser refuses to play (autoplay policy, missing file...). */
    function playForeground({ onEnded = null } = {}) {
      fader.cancel(foreground, volumes.foreground);
      applyPendingSource();
      if (!foreground.getAttribute("src")) return Promise.resolve(false);

      endedAction = onEnded;
      setDucked(true);
      setPlaying(true);
      return foreground.play().then(() => true, () => {
        endedAction = null;
        setPlaying(false);
        setDucked(false);
        return false;
      });
    }

    function toggleForeground() {
      if (playing) {
        stopForeground();
        return Promise.resolve(false);
      }
      return playForeground();
    }

    function finishForeground() {
      const action = endedAction;
      stopForeground({ immediate: true });
      action?.();
    }

    foreground.addEventListener("ended", finishForeground);
    foreground.addEventListener("error", () => {
      if (playing) finishForeground();
    });

    function playMusic(source) {
      if (!source) {
        stopMusic();
        return;
      }

      if (music.getAttribute("src") === source) {
        fader.cancel(music, volumes.music);
        music.loop = true;
        syncMusicVolume();
        if (music.paused) music.play().catch(noop);
        return;
      }

      fader.stop(music, volumes.music, {
        onDone: () => {
          music.src = source;
          music.loop = true;
          music.load();
          syncMusicVolume();
          music.play().catch(noop);
        },
      });
    }

    function stopMusic({ immediate = false } = {}) {
      fader.stop(music, volumes.music, { immediate, resetSource: true });
    }

    return {
      get isForegroundPlaying() {
        return playing;
      },
      loadForeground,
      playForeground,
      playMusic,
      stopForeground,
      stopMusic,
      toggleForeground,
    };
  }

  function stopVideo(video) {
    video.pause();
    video.currentTime = 0;
  }

  /** Shows an <img>/<video> with `source`, or hides and unloads it when `source` is empty. */
  function setMediaSource(element, source) {
    const isVideo = element.tagName === "VIDEO";
    element.hidden = !source;

    if (source) {
      element.src = source;
      if (isVideo) element.load();
      return;
    }

    if (isVideo) element.pause();
    element.removeAttribute("src");
    if (isVideo) element.load();
  }

  globalScope.RECUERDOOT_MEDIA = { createMediaController, setMediaSource, stopVideo };
})(globalThis);

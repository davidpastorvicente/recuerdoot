(function initGameConfig(globalScope) {
  const config = Object.freeze({
    APP_NAME: "Recuerdoot",
    COUNTDOWN_GAME_START_SECONDS: 5,
    COUNTDOWN_QUESTION_SECONDS: 20,
    COUNTDOWN_AUDIO_BEFORE_SECONDS: 3,
    COUNTDOWN_AUDIO_AFTER_SECONDS: 10,
    DEFAULT_QUESTION_MUSIC_SRC: "assets/music/default.mp3",
    LOBBY_WAITING_MUSIC_SRC: "assets/music/waiting.mp3",
    LEADERBOARD_DISPLAY_LIMIT: 5,
    MAX_PLAYERS: 10,
    MAX_POINTS: 1000,
    MIN_POINTS: 100,
    PIN_LENGTH: 6,
    PLAYER_NAME_MAX_LENGTH: 15,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = config;
  }

  globalScope.RECUERDOOT_CONFIG = config;
})(globalThis);

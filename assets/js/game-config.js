(function initGameConfig(globalScope) {
  const config = {
    COUNTDOWN_GAME_START_SECONDS: 5,
    LEADERBOARD_DISPLAY_LIMIT: 5,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = config;
  }

  globalScope.RECUERDOOT_CONFIG = config;
})(typeof globalThis !== "undefined" ? globalThis : window);

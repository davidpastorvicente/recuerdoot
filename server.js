const { APP_NAME } = require("./assets/js/game-config.js");
const { createApp } = require("./lib/app");
const { getNetworkIp } = require("./lib/network");

const PORT = Number(process.env.PORT) || 8000;
const publicBaseUrl = process.env.PUBLIC_BASE_URL?.trim() ?? "";

const { server } = createApp({
  publicBaseUrl,
  questionsPath: process.env.QUESTIONS_PATH || undefined,
  liveReload: process.env.LIVERELOAD !== "0",
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`  ${APP_NAME} dev server running!\n`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${getNetworkIp()}:${PORT}`);
  if (publicBaseUrl) {
    console.log(`  Public:  ${publicBaseUrl.replace(/\/$/, "")}`);
  }
});

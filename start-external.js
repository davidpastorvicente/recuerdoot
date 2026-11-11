const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT || "8000";
const targetUrl = `http://localhost:${PORT}`;
const SERVER_ENTRY = path.join(__dirname, "server.js");
const CLOUDFLARED_DIRECTORIES = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

function exitWithError(message) {
  console.error(message);
  process.exit(1);
}

// Absolute paths only: never let PATH decide which binary runs.
function resolveCloudflaredBinary() {
  const configuredPath = process.env.CLOUDFLARED_PATH?.trim();
  if (configuredPath) {
    return path.isAbsolute(configuredPath) && fs.existsSync(configuredPath) ? configuredPath : null;
  }

  return CLOUDFLARED_DIRECTORIES
    .map((directory) => path.join(directory, "cloudflared"))
    .find((candidate) => fs.existsSync(candidate)) ?? null;
}

const cloudflaredBinary = resolveCloudflaredBinary();
if (!cloudflaredBinary) {
  exitWithError(`cloudflared not found in ${CLOUDFLARED_DIRECTORIES.join(", ")}. Install it or set CLOUDFLARED_PATH to its absolute path.`);
}

const cloudflared = spawn(
  cloudflaredBinary,
  ["tunnel", "--url", targetUrl, "--no-autoupdate"],
  { stdio: ["ignore", "pipe", "pipe"] }
);

let server = null;
let resolved = false;

function stopChildren(signal = "SIGTERM") {
  if (server && !server.killed) server.kill(signal);
  if (!cloudflared.killed) cloudflared.kill(signal);
}

function startServer(publicBaseUrl) {
  if (server) return;

  server = spawn(process.execPath, [SERVER_ENTRY], {
    stdio: "inherit",
    env: {
      ...process.env,
      PORT,
      PUBLIC_BASE_URL: publicBaseUrl,
    },
  });

  server.on("exit", (code, signal) => {
    stopChildren(signal || undefined);

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

function handleCloudflaredOutput(chunk) {
  if (resolved) return;

  const match = /https:\/\/[a-z0-9.-]+\.trycloudflare\.com/i.exec(chunk.toString());
  if (!match) return;

  resolved = true;
  startServer(match[0]);
}

cloudflared.stdout.on("data", handleCloudflaredOutput);
cloudflared.stderr.on("data", handleCloudflaredOutput);

cloudflared.on("error", (error) => {
  exitWithError(`Failed to start cloudflared: ${error.message}`);
});

cloudflared.on("exit", (code) => {
  if (!resolved) {
    exitWithError(`cloudflared exited before a public URL was ready (code ${code ?? "unknown"}).`);
  }
});

process.on("SIGINT", () => stopChildren("SIGINT"));
process.on("SIGTERM", () => stopChildren("SIGTERM"));

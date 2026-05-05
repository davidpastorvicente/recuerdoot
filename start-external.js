const { spawn } = require("child_process");

const PORT = process.env.PORT || "8000";
const targetUrl = `http://localhost:${PORT}`;

function exitWithError(message) {
  console.error(message);
  process.exit(1);
}

const cloudflared = spawn(
  "cloudflared",
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

  server = spawn("node", ["server.js"], {
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
  const text = chunk.toString();
  process.stderr.write(text);

  if (resolved) return;

  const match = text.match(/https:\/\/[a-z0-9.-]+\.trycloudflare\.com/i);
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
    exitWithError(code === 127 ? "cloudflared is not installed or not on PATH." : `cloudflared exited before a public URL was ready (code ${code ?? "unknown"}).`);
  }
});

process.on("SIGINT", () => stopChildren("SIGINT"));
process.on("SIGTERM", () => stopChildren("SIGTERM"));

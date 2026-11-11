"use strict";

const os = require("node:os");

function getNetworkIp() {
  const interfaces = Object.values(os.networkInterfaces()).flat();
  const external = interfaces.find((net) => net?.family === "IPv4" && !net.internal);
  return external?.address ?? "localhost";
}

function resolveJoinBaseUrl({ publicBaseUrl, port }) {
  const trimmed = publicBaseUrl?.trim();
  if (trimmed) {
    return trimmed.replace(/\/$/, "");
  }
  return `http://${getNetworkIp()}:${port}`;
}

module.exports = { getNetworkIp, resolveJoinBaseUrl };

"use strict";

const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");

/**
 * Third-party browser scripts served as `assets/vendor/<name>`. They come from node_modules:
 * the dev server serves them directly and `npm run build` copies them into dist/.
 */
const VENDOR_FILES = Object.freeze({
  "peerjs.min.js": "node_modules/peerjs/dist/peerjs.min.js",
  "peerjs.min.js.map": "node_modules/peerjs/dist/peerjs.min.js.map",
  "qrcode.js": "node_modules/qrcode-generator/qrcode.js",
  "fflate.js": "node_modules/fflate/umd/index.js",
});

function vendorPath(name, rootDir = ROOT_DIR) {
  return Object.hasOwn(VENDOR_FILES, name) ? path.join(rootDir, VENDOR_FILES[name]) : null;
}

module.exports = { VENDOR_FILES, vendorPath };

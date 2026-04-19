#!/usr/bin/env bun

/**
 * YOLO Lab — Entry point.
 *
 * Server ini menjalankan app React + Bun untuk labeling, testing, dan
 * training YOLO. Semua logic bisnis ada di folder `server/`.
 *
 * Hot reload: tekan r + Enter di terminal untuk restart server.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";

import { REACT_BUILD_SCRIPT, REACT_SHELL_PATH, TRUE_VALUES } from "./server/constants.js";
import { parseCliArgs, printUsage } from "./server/cli.js";
import { createServerState } from "./server/state.js";
import { createFetchHandler } from "./server/routes.js";

if (typeof Bun === "undefined" || typeof Bun.serve !== "function") {
  throw new Error("Server YOLO Lab ini harus dijalankan dengan Bun.");
}

// ── React build ─────────────────────────────────────────────────────

function buildReactAssets() {
  const skipBuild = TRUE_VALUES.has(String(process.env.YOLO_LAB_SKIP_REACT_BUILD || "").trim().toLowerCase());
  if (skipBuild) {
    console.log("[yolo-lab-app] skip build asset React karena YOLO_LAB_SKIP_REACT_BUILD aktif");
    return;
  }

  if (!existsSync(REACT_BUILD_SCRIPT)) {
    console.log("[yolo-lab-app] ⚠ Script build React tidak ditemukan, skip build");
    return;
  }

  const result = spawnSync(process.execPath, [REACT_BUILD_SCRIPT], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    // Cek apakah asset sudah ada dari build sebelumnya
    const cssExists = existsSync(path.join(path.dirname(REACT_BUILD_SCRIPT), "static", "react-app.css"));
    const vendorExists = existsSync(path.join(path.dirname(REACT_BUILD_SCRIPT), "static", "vendor", "react.js"));
    if (cssExists && vendorExists) {
      console.log("[yolo-lab-app] ⚠ Build React gagal tapi asset lama masih tersedia, lanjut pakai asset yang ada");
      return;
    }

    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Gagal build asset React YOLO Lab.\n${output}`.trim());
  }

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  if (output) {
    console.log(output);
  }
}

// ── Server lifecycle ────────────────────────────────────────────────

function startServer(options) {
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error("`--port` harus berada di rentang 1..65535.");
  }

  buildReactAssets();
  const appState = createServerState(options);
  const handler = createFetchHandler(appState);
  const server = Bun.serve({
    hostname: options.host,
    port: options.port,
    fetch: async (request) => {
      const url = new URL(request.url);
      const response = await handler(request);
      console.log(`[yolo-lab-app] ${request.method} ${url.pathname} -> ${response.status}`);
      return response;
    },
  });

  console.log("");
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║             YOLO Lab — Server Siap                  ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  frames : ${appState.framesDir}`);
  console.log(`║  labels : ${appState.labelsDir}`);
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  labeler  : http://${options.host}:${options.port}`);
  console.log(`║  tester   : http://${options.host}:${options.port}/tester`);
  console.log(`║  training : http://${options.host}:${options.port}/training`);
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║  r + Enter  → hot reload                           ║");
  console.log("║  Ctrl+C     → berhenti                             ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");

  return server;
}

// ── Hot reload & main ───────────────────────────────────────────────

function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  let server = startServer(options);

  // ── Stdin listener untuk hot reload ──
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    const input = line.trim().toLowerCase();
    if (input === "r") {
      console.log("");
      console.log("[yolo-lab-app] ♻ Hot reload dimulai...");
      try {
        server.stop();
        server = startServer(options);
        console.log("[yolo-lab-app] ♻ Hot reload selesai!");
      } catch (error) {
        console.error(`[yolo-lab-app] ✗ Hot reload gagal: ${error.message}`);
      }
    }
  });

  // ── Graceful shutdown ──
  let stopped = false;
  const shutdown = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    rl.close();
    console.log("");
    console.log("[yolo-lab-app] server dihentikan");
    console.log("");
    server.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();

#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(APP_DIR, "..");
const STATIC_DIR = path.join(APP_DIR, "static");
const NODE_MODULES_DIR = path.join(APP_DIR, "node_modules");
const REACT_OUT_DIR = path.join(STATIC_DIR, "react");
const VENDOR_OUT_DIR = path.join(STATIC_DIR, "vendor");
const TSC_BIN = path.join(NODE_MODULES_DIR, ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
const TAILWIND_BIN = path.join(NODE_MODULES_DIR, ".bin", process.platform === "win32" ? "tailwindcss.cmd" : "tailwindcss");
const TSCONFIG_PATH = path.join(APP_DIR, "tsconfig.react.json");
const TAILWIND_CONFIG_PATH = path.join(APP_DIR, "tailwind.config.cjs");
const CSS_INPUT_PATH = path.join(APP_DIR, "src", "styles.css");
const CSS_OUTPUT_PATH = path.join(STATIC_DIR, "react-app.css");

function ensureBinary(binPath, label) {
  if (!existsSync(binPath)) {
    throw new Error(`${label} tidak ditemukan: ${binPath}`);
  }
}

function runCommand(binPath, args, label) {
  const result = spawnSync(binPath, args, {
    cwd: PROJECT_DIR,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${label} gagal.\n${output}`.trim());
  }
}

function walkFiles(rootDir, callback) {
  if (!existsSync(rootDir)) {
    return;
  }

  for (const entry of readdirSync(rootDir)) {
    const entryPath = path.join(rootDir, entry);
    const stat = statSync(entryPath);
    if (stat.isDirectory()) {
      walkFiles(entryPath, callback);
      continue;
    }
    callback(entryPath);
  }
}

function rewriteRelativeJsxImports(rootDir) {
  walkFiles(rootDir, (filePath) => {
    if (path.extname(filePath) !== ".js") {
      return;
    }

    const source = readFileSync(filePath, "utf8");
    const nextSource = source.replaceAll(/(['"])([^'"]+)\.jsx\1/g, "$1$2.js$1");
    if (nextSource !== source) {
      writeFileSync(filePath, nextSource);
    }
  });
}

function buildReactModules() {
  rmSync(REACT_OUT_DIR, { recursive: true, force: true });
  mkdirSync(REACT_OUT_DIR, { recursive: true });
  runCommand(TSC_BIN, ["-p", TSCONFIG_PATH], "Transpile React module");
  rewriteRelativeJsxImports(REACT_OUT_DIR);
}

function buildStyles() {
  mkdirSync(STATIC_DIR, { recursive: true });
  runCommand(
    TAILWIND_BIN,
    [
      "-c",
      TAILWIND_CONFIG_PATH,
      "-i",
      CSS_INPUT_PATH,
      "-o",
      CSS_OUTPUT_PATH,
      "--minify",
    ],
    "Build CSS React app",
  );
}

function syncVendorFiles() {
  mkdirSync(VENDOR_OUT_DIR, { recursive: true });

  const reactUmdPath = path.join(NODE_MODULES_DIR, "react", "umd", "react.development.js");
  const reactDomUmdPath = path.join(NODE_MODULES_DIR, "react-dom", "umd", "react-dom.development.js");

  cpSync(reactUmdPath, path.join(VENDOR_OUT_DIR, "react.development.js"));
  cpSync(reactDomUmdPath, path.join(VENDOR_OUT_DIR, "react-dom.development.js"));

  writeFileSync(
    path.join(VENDOR_OUT_DIR, "react.js"),
    `const ReactGlobal = globalThis.React;
if (!ReactGlobal) {
  throw new Error("React global belum termuat. Pastikan react.development.js dimuat lebih dulu.");
}

export default ReactGlobal;
export const {
  Children,
  Component,
  Fragment,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createFactory,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version,
} = ReactGlobal;
`,
  );

  writeFileSync(
    path.join(VENDOR_OUT_DIR, "react-dom-client.js"),
    `const ReactDOMGlobal = globalThis.ReactDOM;
if (!ReactDOMGlobal) {
  throw new Error("ReactDOM global belum termuat. Pastikan react-dom.development.js dimuat lebih dulu.");
}

export default ReactDOMGlobal;
export const { createRoot, flushSync, hydrateRoot, unstable_batchedUpdates } = ReactDOMGlobal;
`,
  );
}

function main() {
  ensureBinary(TSC_BIN, "TypeScript compiler");
  ensureBinary(TAILWIND_BIN, "Tailwind CLI");
  buildReactModules();
  buildStyles();
  syncVendorFiles();
  console.log("[react-build] assets React YOLO Lab siap");
}

main();

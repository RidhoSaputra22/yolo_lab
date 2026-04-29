import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export function createTempWorkspace(prefix = "yolo-lab-test-") {
  return path.join(
    tmpdir(),
    `${prefix}${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
}

export function createWorkspace(prefix = "yolo-lab-test-") {
  const root = createTempWorkspace(prefix);
  mkdirSync(root, { recursive: true });
  return root;
}

export function cleanupWorkspace(root) {
  if (root) {
    rmSync(root, { recursive: true, force: true });
  }
}

export function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function writeFixture(filePath, contents = "") {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
  return filePath;
}

export async function responseJson(response) {
  return JSON.parse(await response.text());
}

export function createMemoryPreferences(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    read(page) {
      return values.get(String(page).toLowerCase()) || {};
    },
    write(page, nextValues) {
      const normalized = String(page).toLowerCase();
      const payload = nextValues && typeof nextValues === "object" && !Array.isArray(nextValues)
        ? nextValues
        : {};
      values.set(normalized, payload);
      return {
        page: normalized,
        path: `/memory/${normalized}.json`,
        values: payload,
      };
    },
  };
}

export function createFakeRunner(name, defaults = {}) {
  return {
    configPayload(preferences = {}) {
      return {
        layout: [],
        defaults: { ...defaults, ...preferences },
        preferences: { ...defaults, ...preferences },
        preview: { command: [name, "preview"], commandDisplay: `${name} preview` },
        runtimeWarnings: [],
        job: this.snapshot(),
      };
    },
    preview(payload = {}) {
      return {
        manager: name,
        payload,
        command: [name, "preview"],
        commandDisplay: `${name} preview`,
      };
    },
    start(payload = {}) {
      return { manager: name, started: true, payload };
    },
    stop() {
      return { manager: name, stopped: true };
    },
    snapshot() {
      return {
        manager: name,
        state: "idle",
        running: false,
        logs: [],
      };
    },
    subscribe() {
      return () => {};
    },
  };
}

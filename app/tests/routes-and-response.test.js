import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { PROJECT_DIR } from "../server/constants.js";
import { createFetchHandler } from "../server/routes.js";
import { AppState } from "../server/state.js";
import {
  fileResponse,
  jsonResponse,
  readJsonRequest,
  staticPathResponse,
} from "../server/response.js";
import { cleanupWorkspace, createFakeRunner, createMemoryPreferences, createWorkspace, ensureDir, responseJson, writeFixture } from "./helpers.js";

let workspace = null;

function createRouteState() {
  workspace = createWorkspace();
  const framesRootDir = ensureDir(path.join(workspace, "frames"));
  const labelsRootDir = ensureDir(path.join(workspace, "labels"));
  writeFixture(path.join(framesRootDir, "route.jpg"), "image");

  const autolabelRunner = {
    ...createFakeRunner("autolabel"),
    configPayload(overrides = {}) {
      return {
        defaults: { model: "auto.pt", conf: 0.35, ...overrides },
        runtimeWarnings: [],
        job: this.snapshot(),
      };
    },
    startImage(payload, context) {
      return { mode: "current", payload, context };
    },
    startSelection(payload, context) {
      return { mode: "selection", payload, context };
    },
    startAll(payload, context) {
      return { mode: "all", payload, context };
    },
  };

  return new AppState({
    framesDir: framesRootDir,
    framesRootDir,
    labelsRootDir,
    labelsDir: labelsRootDir,
    classNames: ["person"],
    checkpointPath: path.join(labelsRootDir, ".manual_labeler_checkpoint.json"),
    footageRunner: createFakeRunner("footage", { footageDir: "train/footage" }),
    testRunner: createFakeRunner("test", { outputDir: "test/output" }),
    trainingRunner: createFakeRunner("training", { runsDir: "train/runs" }),
    autolabelRunner,
    frameArchiveManager: {},
    pagePreferences: createMemoryPreferences(),
    pythonBin: "python3",
    trainScript: path.join(workspace, "train.py"),
  });
}

function request(pathname, init = {}) {
  return new Request(`http://localhost${pathname}`, init);
}

afterEach(() => {
  cleanupWorkspace(workspace);
  workspace = null;
});

describe("response helpers", () => {
  test("returns JSON responses with no-store cache headers", async () => {
    const response = jsonResponse({ ok: true }, 201);

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
  });

  test("parses valid JSON request bodies and rejects invalid JSON", async () => {
    expect(await readJsonRequest(new Request("http://localhost", { method: "POST", body: "{\"ok\":true}" })))
      .toEqual({ ok: true });
    await expect(readJsonRequest(new Request("http://localhost", { method: "POST", body: "[1]" })))
      .rejects.toThrow("Body JSON harus berupa object");
    await expect(readJsonRequest(new Request("http://localhost", { method: "POST", body: "{broken" })))
      .rejects.toThrow("Request tidak valid");
  });

  test("serves files with HEAD and byte range support", async () => {
    workspace = createWorkspace();
    const filePath = writeFixture(path.join(workspace, "asset.txt"), "abcdef");

    const head = fileResponse(filePath, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("6");
    expect(await head.text()).toBe("");

    const ranged = fileResponse(filePath, { rangeHeader: "bytes=2-4" });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get("content-range")).toBe("bytes 2-4/6");
    expect(await ranged.text()).toBe("cde");
  });

  test("serves static paths and rejects traversal", async () => {
    workspace = createWorkspace();
    const staticRoot = ensureDir(path.join(workspace, "static"));
    writeFixture(path.join(staticRoot, "app.js"), "console.log('ok');");

    expect(await staticPathResponse(staticRoot, "/static/app.js", "/static/", "GET").text())
      .toBe("console.log('ok');");
    expect(() => staticPathResponse(staticRoot, "/static/../secret.js", "/static/", "GET"))
      .toThrow("Path asset tidak valid");
  });
});

describe("API routes", () => {
  test("returns labeler config summary and persists label data through the labels API", async () => {
    const handler = createFetchHandler(createRouteState());

    const initialConfig = await responseJson(await handler(request("/api/config")));
    expect(initialConfig).toMatchObject({
      classNames: ["person"],
      summary: {
        totalImages: 1,
        labeledImages: 0,
        pendingImages: 1,
        totalBoxes: 0,
      },
    });

    const saveResponse = await handler(request("/api/labels?image=route.jpg", {
      method: "POST",
      body: JSON.stringify({
        imageWidth: 100,
        imageHeight: 100,
        boxes: [{ classId: 0, x: 10, y: 20, width: 30, height: 40 }],
      }),
    }));
    expect(saveResponse.status).toBe(200);
    expect(await responseJson(saveResponse)).toMatchObject({ saved: true, boxCount: 1 });

    const labelResponse = await responseJson(await handler(request("/api/labels?image=route.jpg")));
    expect(labelResponse).toMatchObject({
      image: "route.jpg",
      hasLabelFile: true,
      boxes: [{ classId: 0, cx: 0.25, cy: 0.4, width: 0.3, height: 0.4 }],
    });
  });

  test("handles preferences, checkpoints, frame deletion, and autolabel validation routes", async () => {
    const state = createRouteState();
    const handler = createFetchHandler(state);

    const preferences = await responseJson(await handler(request("/api/preferences", {
      method: "POST",
      body: JSON.stringify({ page: "tester", values: { outputDir: "custom" } }),
    })));
    expect(preferences).toMatchObject({ page: "tester", values: { outputDir: "custom" } });
    expect(await responseJson(await handler(request("/api/preferences?page=tester"))))
      .toMatchObject({ page: "tester", values: { outputDir: "custom" } });

    expect(await responseJson(await handler(request("/api/checkpoint", {
      method: "POST",
      body: JSON.stringify({ image: "route.jpg" }),
    })))).toEqual({ saved: true, checkpointImage: "route.jpg" });

    const autolabelSelection = await handler(request("/api/autolabel/selection", {
      method: "POST",
      body: JSON.stringify({ images: [] }),
    }));
    expect(autolabelSelection.status).toBe(400);
    expect(await responseJson(autolabelSelection)).toMatchObject({
      error: "Minimal pilih satu frame untuk auto-label.",
    });

    const deleted = await responseJson(await handler(request("/api/frames/delete", {
      method: "POST",
      body: JSON.stringify({ image: "route.jpg" }),
    })));
    expect(deleted).toMatchObject({
      deleted: true,
      image: "route.jpg",
      checkpointCleared: true,
    });
    expect(existsSync(path.join(state.framesDir, "route.jpg"))).toBe(false);
  });

  test("routes runner preview/status endpoints to the configured managers", async () => {
    const handler = createFetchHandler(createRouteState());

    expect(await responseJson(await handler(request("/api/test/preview", {
      method: "POST",
      body: JSON.stringify({ input: "sample.mp4" }),
    })))).toMatchObject({ manager: "test", payload: { input: "sample.mp4" } });

    expect(await responseJson(await handler(request("/api/footage/status"))))
      .toMatchObject({ manager: "footage", state: "idle", running: false });
    expect(await responseJson(await handler(request("/api/train/status"))))
      .toMatchObject({ manager: "training", state: "idle", running: false });
  });

  test("browses project files safely and returns JSON errors for invalid API methods", async () => {
    const handler = createFetchHandler(createRouteState());

    const browse = await responseJson(await handler(request("/api/files/browse?path=app/server")));
    expect(browse.currentPath).toBe("app/server");
    expect(browse.rootName).toBe(path.basename(PROJECT_DIR));
    expect(browse.entries.some((entry) => entry.name === "routes.js" && !entry.isDirectory)).toBe(true);

    const methodResponse = await handler(request("/api/config", { method: "DELETE" }));
    expect(methodResponse.status).toBe(405);
    expect(await responseJson(methodResponse)).toEqual({ error: "Method tidak didukung." });
  });

  test("serves frame files and protects artifact access outside the project", async () => {
    const state = createRouteState();
    const handler = createFetchHandler(state);

    const frameResponse = await handler(request("/frames/route.jpg"));
    expect(frameResponse.status).toBe(200);
    expect(Number(frameResponse.headers.get("content-length"))).toBe(statSync(path.join(state.framesDir, "route.jpg")).size);

    const artifactResponse = await handler(request(`/api/test/artifact?path=${encodeURIComponent(path.join(workspace, "outside.mp4"))}`));
    expect(artifactResponse.status).toBe(404);
  });
});

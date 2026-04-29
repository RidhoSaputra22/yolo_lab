import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  PROJECT_DIR,
} from "../server/constants.js";
import {
  displayPath,
  encodePathQuery,
  pathInside,
  rebaseSubdirectoryPath,
  resolveProjectPath,
} from "../server/paths.js";
import {
  classNamesFromDataYaml,
  parseResultsCsvSummary,
  parseSimpleYamlObject,
  parseYamlScalar,
} from "../server/parsers.js";
import { PagePreferenceStore } from "../server/preferences.js";
import { discoverFiles, listFrameDirectoryChoices, recursiveFileStats } from "../server/files.js";
import { fileSizeLabel, shellJoin, shellQuote } from "../server/format.js";
import { cleanupWorkspace, createWorkspace, ensureDir, writeFixture } from "./helpers.js";

let workspace = null;

afterEach(() => {
  cleanupWorkspace(workspace);
  workspace = null;
});

describe("server path helpers", () => {
  test("resolve project aliases, display relative project paths, and encode path queries", () => {
    const rootAlias = path.basename(PROJECT_DIR);
    const framesPath = path.join(PROJECT_DIR, "train", "frames");

    expect(resolveProjectPath(`${rootAlias}/train/frames`)).toBe(framesPath);
    expect(displayPath(framesPath)).toBe("train/frames");
    expect(encodePathQuery(`${rootAlias}/train/frames/a b.jpg`)).toBe("train/frames/a%20b.jpg");
    expect(pathInside(framesPath, PROJECT_DIR)).toBe(true);
    expect(pathInside(path.dirname(PROJECT_DIR), PROJECT_DIR)).toBe(false);
  });

  test("rebases matching subdirectories and rejects paths outside the source root", () => {
    workspace = createWorkspace();
    const sourceRoot = ensureDir(path.join(workspace, "frames"));
    const targetRoot = ensureDir(path.join(workspace, "labels"));
    const nestedFrames = ensureDir(path.join(sourceRoot, "camera-1"));

    expect(rebaseSubdirectoryPath(sourceRoot, nestedFrames, targetRoot)).toBe(
      path.join(targetRoot, "camera-1"),
    );
    expect(() => rebaseSubdirectoryPath(sourceRoot, workspace, targetRoot)).toThrow(
      "Path di luar root sumber",
    );
  });
});

describe("server parsers and formatters", () => {
  test("parses simple YAML values and ignores nested YAML when reading top-level objects", () => {
    workspace = createWorkspace();
    const yamlPath = writeFixture(
      path.join(workspace, "args.yaml"),
      [
        "# comment",
        "epochs: 10",
        "cache: true",
        "device: 'cpu'",
        "model: /tmp/model.pt",
        "nested:",
        "  child: ignored",
      ].join("\n"),
    );

    expect(parseYamlScalar("false")).toBe(false);
    expect(parseYamlScalar("7")).toBe(7);
    expect(parseYamlScalar("0.25")).toBe(0.25);
    expect(parseSimpleYamlObject(yamlPath)).toEqual({
      epochs: 10,
      cache: true,
      device: "cpu",
      model: "/tmp/model.pt",
      nested: null,
    });
  });

  test("reads class names and training metrics from dataset artifacts", () => {
    workspace = createWorkspace();
    const datasetDir = ensureDir(path.join(workspace, "dataset"));
    writeFixture(
      path.join(datasetDir, "data.yaml"),
      [
        "path: .",
        "names:",
        "  0: person",
        "  2: staff",
      ].join("\n"),
    );
    const resultsPath = writeFixture(
      path.join(workspace, "results.csv"),
      [
        "epoch,metrics/precision(B),metrics/recall(B),metrics/mAP50(B),metrics/mAP50-95(B)",
        "0,0.5,0.6,0.7,0.4",
        "1,0.8,0.9,0.65,0.45",
      ].join("\n"),
    );

    expect(classNamesFromDataYaml(datasetDir)).toEqual(["person", "class-1", "staff"]);
    expect(parseResultsCsvSummary(resultsPath)).toMatchObject({
      rowCount: 2,
      lastEpoch: 1,
      lastPrecision: 0.8,
      lastRecall: 0.9,
      lastMap50: 0.65,
      lastMap50_95: 0.45,
      bestMap50: 0.7,
      bestMap50_95: 0.45,
    });
  });

  test("formats shell commands and file sizes safely", () => {
    expect(shellQuote("plain-value")).toBe("plain-value");
    expect(shellQuote("two words")).toBe("'two words'");
    expect(shellJoin(["python3", "script.py", "two words"])).toBe("python3 script.py 'two words'");
    expect(fileSizeLabel(1024)).toBe("1.0 KB");
  });
});

describe("server filesystem helpers and preferences", () => {
  test("discovers files while skipping ignored folders and summarizes recursive stats", () => {
    workspace = createWorkspace();
    writeFixture(path.join(workspace, "a.mp4"), "video");
    writeFixture(path.join(workspace, "node_modules", "ignored.mp4"), "video");
    writeFixture(path.join(workspace, "nested", "b.mp4"), "video");

    const discovered = discoverFiles([workspace], new Set([".mp4"]));
    expect(discovered).toContain(path.join(workspace, "a.mp4"));
    expect(discovered).toContain(path.join(workspace, "nested", "b.mp4"));
    expect(discovered.some((item) => item.includes("node_modules"))).toBe(false);

    const stats = recursiveFileStats(workspace);
    expect(stats.fileCount).toBe(3);
    expect(stats.totalSizeBytes).toBeGreaterThan(0);
  });

  test("lists frame directories with active empty directory retained", () => {
    workspace = createWorkspace();
    const framesRoot = ensureDir(path.join(workspace, "frames"));
    const cameraDir = ensureDir(path.join(framesRoot, "camera-a"));
    writeFixture(path.join(cameraDir, "frame-1.jpg"), "image");

    const choices = listFrameDirectoryChoices(framesRoot, new Set([".jpg"]), framesRoot);
    expect(choices[0]).toMatchObject({
      path: framesRoot,
      frameCount: 0,
      isActive: true,
      isRoot: true,
    });
    expect(choices.some((item) => item.path === cameraDir && item.frameCount === 1)).toBe(true);
  });

  test("stores page preferences and falls back to an empty object for broken JSON", () => {
    workspace = createWorkspace();
    const store = new PagePreferenceStore(workspace);

    expect(store.write("Tester", { outputDir: "test/output" })).toMatchObject({
      page: "tester",
      values: { outputDir: "test/output" },
    });
    expect(store.read("tester")).toEqual({ outputDir: "test/output" });

    writeFileSync(path.join(workspace, "tester.json"), "{broken");
    expect(store.read("tester")).toEqual({});
    expect(() => store.read("unknown")).toThrow("Halaman preference tidak dikenal");
  });
});

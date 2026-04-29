import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { AppState } from "../server/state.js";
import { cleanupWorkspace, createFakeRunner, createMemoryPreferences, createWorkspace, ensureDir, writeFixture } from "./helpers.js";

let workspace = null;

function createState({ classNames = ["person", "staff"] } = {}) {
  workspace = createWorkspace();
  const framesRootDir = ensureDir(path.join(workspace, "frames"));
  const labelsRootDir = ensureDir(path.join(workspace, "labels"));
  writeFixture(path.join(framesRootDir, "lobby.jpg"), "image");
  writeFixture(path.join(framesRootDir, "door.png"), "image");

  return new AppState({
    framesDir: framesRootDir,
    framesRootDir,
    labelsRootDir,
    labelsDir: labelsRootDir,
    classNames,
    checkpointPath: path.join(labelsRootDir, ".manual_labeler_checkpoint.json"),
    footageRunner: createFakeRunner("footage"),
    testRunner: createFakeRunner("test"),
    trainingRunner: createFakeRunner("training"),
    autolabelRunner: {
      ...createFakeRunner("autolabel"),
      configPayload(overrides = {}) {
        return { defaults: { model: "model.pt", ...overrides }, runtimeWarnings: [], job: this.snapshot() };
      },
      startImage(payload, context) {
        return { mode: "image", payload, context };
      },
      startSelection(payload, context) {
        return { mode: "selection", payload, context };
      },
      startAll(payload, context) {
        return { mode: "all", payload, context };
      },
    },
    frameArchiveManager: {},
    pagePreferences: createMemoryPreferences(),
    pythonBin: "python3",
    trainScript: path.join(workspace, "train.py"),
  });
}

afterEach(() => {
  cleanupWorkspace(workspace);
  workspace = null;
});

describe("AppState labeler features", () => {
  test("lists images with label metadata and saves normalized YOLO label boxes", () => {
    const state = createState();

    const result = state.saveLabelData("lobby.jpg", 100, 100, [
      { classId: 1, x: -10, y: 10, width: 60, height: 20 },
      { classId: 0, x: 5, y: 5, width: 0.5, height: 20 },
    ]);

    expect(result.boxCount).toBe(1);
    expect(state.readLabelData("lobby.jpg")).toEqual({
      hasLabelFile: true,
      parseError: null,
      boxes: [
        {
          classId: 1,
          cx: 0.25,
          cy: 0.2,
          width: 0.5,
          height: 0.2,
        },
      ],
    });
    expect(state.listImages()).toEqual([
      expect.objectContaining({ name: "door.png", boxCount: 0, hasLabelFile: false }),
      expect.objectContaining({ name: "lobby.jpg", boxCount: 1, hasLabelFile: true }),
    ]);
  });

  test("rejects invalid label saves and unsafe frame names", () => {
    const state = createState();

    expect(() => state.saveLabelData("lobby.jpg", 0, 100, [])).toThrow("Ukuran image tidak valid");
    expect(() => state.saveLabelData("lobby.jpg", 100, 100, [{ classId: 99, x: 0, y: 0, width: 10, height: 10 }]))
      .toThrow("Class ID di luar rentang");
    expect(() => state.readLabelData("../lobby.jpg")).toThrow("Nama file tidak valid");
  });

  test("reports parse errors for malformed label files", () => {
    const state = createState();
    writeFixture(path.join(state.labelsDir, "door.txt"), "0 0.5 broken 0.2 0.2\n");

    expect(state.readLabelData("door.png")).toMatchObject({
      hasLabelFile: true,
      parseError: "Nilai numerik tidak valid di door.txt baris 1.",
      boxes: [],
    });
  });

  test("saves checkpoints and clears matching checkpoint when frame is deleted", () => {
    const state = createState();
    state.saveLabelData("lobby.jpg", 100, 100, [{ classId: 0, x: 0, y: 0, width: 20, height: 20 }]);
    state.saveCheckpointImage("lobby.jpg");

    const deleted = state.deleteFrame("lobby.jpg");

    expect(deleted).toMatchObject({
      deleted: true,
      image: "lobby.jpg",
      labelDeleted: true,
      checkpointCleared: true,
      checkpointImage: null,
      remainingImageCount: 1,
    });
    expect(existsSync(path.join(state.labelsDir, "lobby.txt"))).toBe(false);
    expect(state.readCheckpointImage()).toBe(null);
  });

  test("activates nested frame directories and maps them to matching label folders", () => {
    const state = createState();
    const nextFramesDir = ensureDir(path.join(state.framesRootDir, "camera-2"));
    writeFixture(path.join(nextFramesDir, "cam.jpg"), "image");

    const activated = state.setFramesDir(nextFramesDir);

    expect(activated.framesDir).toBe(nextFramesDir);
    expect(activated.labelsDir).toBe(path.join(state.labelsRootDir, "camera-2"));
    expect(activated.imageCount).toBe(1);
    expect(existsSync(path.join(state.labelsRootDir, "camera-2"))).toBe(true);
  });
});

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { BaseRunManager } from "../server/managers/base-manager.js";
import { AutolabelRunManager } from "../server/managers/autolabel-manager.js";
import { FootageRunManager } from "../server/managers/footage-manager.js";
import { TestRunManager } from "../server/managers/test-manager.js";
import { TrainingRunManager } from "../server/managers/training-manager.js";
import { MAX_LOG_LINES } from "../server/constants.js";
import { cleanupWorkspace, createWorkspace, ensureDir, writeFixture } from "./helpers.js";

let workspace = null;

afterEach(() => {
  cleanupWorkspace(workspace);
  workspace = null;
});

class HarnessRunManager extends BaseRunManager {
  constructor() {
    super();
    this.current = {
      jobId: 7,
      startedAt: Date.now() - 1_000,
      finishedAt: null,
      logs: [],
      process: null,
    };
  }
}

describe("BaseRunManager behavior", () => {
  test("normalizes booleans, validates numbers, and trims old logs", () => {
    const manager = new HarnessRunManager();

    expect(manager.boolValue("yes")).toBe(true);
    expect(manager.boolValue("0")).toBe(false);
    expect(manager.intValue("5", { minimum: 1, maximum: 10, fieldName: "count" })).toBe(5);
    expect(() => manager.floatValue("-1", { minimum: 0, fieldName: "ratio" })).toThrow("minimal 0");

    for (let index = 0; index < MAX_LOG_LINES + 5; index += 1) {
      manager.appendLog(`line-${index}`);
    }

    expect(manager.current.logs).toHaveLength(MAX_LOG_LINES);
    expect(manager.current.logs[0]).toBe("line-5");
    expect(manager.durationSeconds()).toBeGreaterThanOrEqual(1);
  });
});

describe("FootageRunManager features", () => {
  function createFootageManager() {
    workspace = createWorkspace();
    return new FootageRunManager({
      projectDir: workspace,
      trainScript: path.join(workspace, "train.py"),
      pythonBin: "python3",
      defaultFootageDir: ensureDir(path.join(workspace, "footage")),
      defaultFramesDir: ensureDir(path.join(workspace, "frames")),
      defaultLabelsDir: ensureDir(path.join(workspace, "labels")),
      defaultDatasetDir: ensureDir(path.join(workspace, "dataset")),
    });
  }

  test("previews frame extraction command with normalized numeric and boolean fields", () => {
    const manager = createFootageManager();
    const preview = manager.preview({
      footageDir: path.join(workspace, "footage"),
      framesDir: path.join(workspace, "frames"),
      sampleEvery: "5",
      maxFramesPerVideo: "0",
      jpegQuality: "80",
      overwriteFrames: "true",
    });

    expect(preview.config).toMatchObject({
      footageDir: path.join(workspace, "footage"),
      sampleEvery: 5,
      maxFramesPerVideo: 0,
      jpegQuality: 80,
      overwriteFrames: true,
      estimatedFrameCount: 0,
    });
    expect(preview.config.framesDir).toMatch(new RegExp(`${path.join(workspace, "frames").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/frame_\\d{8}_0$`));
    expect(preview.command).toContain("--overwrite-frames");
    expect(preview.library).toMatchObject({
      footageCount: 0,
      frameCount: 0,
      labeledFrameCount: 0,
    });
  });

  test("imports only valid video uploads and creates unique safe filenames", async () => {
    const manager = createFootageManager();
    const targetDir = path.join(workspace, "footage");
    const formData = new FormData();
    formData.set("footageDir", targetDir);
    formData.append("files", new File(["video"], "My Video!.MP4", { type: "video/mp4" }));
    formData.append("files", new File(["notes"], "notes.txt", { type: "text/plain" }));

    const firstImport = await manager.importFiles(formData);
    expect(firstImport).toMatchObject({
      targetDir,
      importedCount: 1,
      skippedCount: 1,
      imported: [expect.objectContaining({ originalName: "My Video!.MP4", savedName: "My_Video.mp4" })],
    });

    const secondFormData = new FormData();
    secondFormData.set("footageDir", targetDir);
    secondFormData.append("files", new File(["video"], "My Video!.MP4", { type: "video/mp4" }));
    const secondImport = await manager.importFiles(secondFormData);
    expect(secondImport.imported[0].savedName).toBe("My_Video-2.mp4");
  });
});

describe("TestRunManager features", () => {
  function createTestManager() {
    workspace = createWorkspace();
    return new TestRunManager({
      projectDir: workspace,
      runnerScript: path.join(workspace, "runner.py"),
      pythonBin: "python3",
      defaultOutputDir: ensureDir(path.join(workspace, "output")),
    });
  }

  test("previews offline runner command and validates model/input parameters", () => {
    const manager = createTestManager();
    const input = writeFixture(path.join(workspace, "sample.mp4"), "video");
    const weights = writeFixture(path.join(workspace, "weights.pt"), "weights");
    const employeeFacesDir = ensureDir(path.join(workspace, "petugas"));

    const preview = manager.preview({
      input,
      outputDir: path.join(workspace, "output"),
      outputName: "run-a",
      weights,
      withFaceRecognition: "on",
      employeeFacesDir,
      faceRegistrySource: "folder",
      suppressNestedDuplicates: false,
      yoloConf: "0.4",
      yoloIou: "0.5",
    });

    expect(preview.config).toMatchObject({
      input,
      outputDir: path.join(workspace, "output"),
      outputName: "run-a",
      weights,
      withFaceRecognition: true,
      faceRegistrySource: "folder",
      suppressNestedDuplicates: false,
      yoloConf: 0.4,
      yoloIou: 0.5,
    });
    expect(preview.command).toContain("--with-face-recognition");
    expect(preview.command).toContain("--no-suppress-nested-duplicates");
    expect(preview.command).toContain("--weights");
    expect(() => manager.preview({ input, outputDir: path.join(workspace, "output"), yoloConf: "2" }))
      .toThrow("Field `yoloConf` maksimal 1");
  });

  test("lists output artifacts with JSON summary data and MP4 playback diagnostics", () => {
    const manager = createTestManager();
    const outputDir = ensureDir(path.join(workspace, "output", "run-a"));
    writeFixture(path.join(outputDir, "run_summary.json"), JSON.stringify({ frames: 10 }));
    writeFixture(path.join(outputDir, "run_tracking.mp4"), "not a valid mp4");
    writeFixture(path.join(outputDir, "run_tracks.csv"), "track_id\n1\n");

    const artifacts = manager.listArtifacts(path.join(workspace, "output"));
    expect(artifacts.map((item) => item.name)).toEqual(
      expect.arrayContaining(["run_summary.json", "run_tracking.mp4", "run_tracks.csv"]),
    );
    expect(artifacts.find((item) => item.name === "run_summary.json").summaryData).toEqual({ frames: 10 });
    expect(artifacts.find((item) => item.name === "run_tracking.mp4").videoPlayback).toMatchObject({
      playable: false,
    });
  });
});

describe("TrainingRunManager features", () => {
  function createTrainingManager() {
    workspace = createWorkspace();
    return new TrainingRunManager({
      projectDir: workspace,
      trainScript: path.join(workspace, "train.py"),
      pythonBin: "python3",
      defaultRunsDir: ensureDir(path.join(workspace, "runs")),
    });
  }

  test("previews prepare-train command and summarizes training workspace", () => {
    const manager = createTrainingManager();
    const framesDir = ensureDir(path.join(workspace, "frames"));
    const labelsDir = ensureDir(path.join(workspace, "labels"));
    const datasetDir = ensureDir(path.join(workspace, "dataset"));
    const runsDir = ensureDir(path.join(workspace, "runs"));
    const model = writeFixture(path.join(workspace, "base.pt"), "weights");
    writeFixture(path.join(framesDir, "a.jpg"), "image");
    writeFixture(path.join(labelsDir, "a.txt"), "0 0.5 0.5 0.2 0.2\n");
    writeFixture(path.join(datasetDir, "images", "train", "a.jpg"), "image");
    writeFixture(path.join(datasetDir, "labels", "train", "a.txt"), "label");

    const preview = manager.preview({
      framesDir,
      labelsDir,
      datasetDir,
      runsDir,
      trainModel: model,
      classNames: "person, staff",
      imgsz: "320",
      epochs: "2",
      batch: "1",
      workers: "0",
      patience: "0",
      valRatio: "0.25",
      seed: "123",
      device: "cpu",
      runName: "unit-run",
      allowEmptyLabels: "true",
      cache: "true",
    });

    expect(preview.config.classNames).toEqual(["person", "staff"]);
    expect(preview.command).toEqual(expect.arrayContaining([
      "prepare-train",
      "--class-name",
      "person",
      "staff",
      "--allow-empty-labels",
      "--cache",
    ]));
    expect(preview.workspace).toMatchObject({
      frameCount: 1,
      labelCount: 1,
      datasetTrainImages: 1,
      datasetTrainLabels: 1,
      classNames: ["person", "staff"],
    });
  });

  test("summarizes completed training runs and metrics artifacts", () => {
    const manager = createTrainingManager();
    const runDir = ensureDir(path.join(workspace, "runs", "exp"));
    mkdirSync(path.join(runDir, "weights"), { recursive: true });
    writeFixture(path.join(runDir, "args.yaml"), "model: base.pt\nepochs: 3\nbatch: 2\nimgsz: 640\ndevice: cpu\n");
    writeFixture(
      path.join(runDir, "results.csv"),
      [
        "epoch,metrics/precision(B),metrics/recall(B),metrics/mAP50(B),metrics/mAP50-95(B)",
        "0,0.1,0.2,0.3,0.2",
        "1,0.4,0.5,0.6,0.55",
      ].join("\n"),
    );
    writeFixture(path.join(runDir, "weights", "best.pt"), "best");
    writeFixture(path.join(runDir, "results.png"), "png");

    const [summary] = manager.listRunSummaries(path.join(workspace, "runs"));
    expect(summary).toMatchObject({
      key: "exp",
      metrics: {
        rowCount: 2,
        bestMap50: 0.6,
        bestMap50_95: 0.55,
      },
      config: {
        model: "base.pt",
        epochs: 3,
        batch: 2,
        imgsz: 640,
        device: "cpu",
      },
    });
    expect(summary.artifacts.bestWeights.name).toBe("best.pt");
    expect(summary.previewArtifacts[0].name).toBe("results.png");
  });
});

describe("AutolabelRunManager features", () => {
  test("validates autolabel config and builds deduplicated target commands", () => {
    workspace = createWorkspace();
    const manager = new AutolabelRunManager({
      projectDir: workspace,
      trainScript: path.join(workspace, "train.py"),
      pythonBin: "python3",
    });

    const config = manager.normalizePayload({
      model: "model.pt",
      conf: "0.3",
      iou: "0.4",
      imgsz: "640",
      device: "cpu",
      suppressNestedDuplicates: false,
      duplicateContainmentThreshold: "0.8",
    });
    const command = manager.buildCommand(config, {
      framesDir: path.join(workspace, "frames"),
      labelsDir: path.join(workspace, "labels"),
      imageNames: ["a.jpg", "a.jpg", "../b.jpg"],
      overwriteLabels: true,
    });

    expect(config).toMatchObject({
      model: "model.pt",
      conf: 0.3,
      iou: 0.4,
      imgsz: 640,
      device: "cpu",
      suppressNestedDuplicates: false,
      duplicateContainmentThreshold: 0.8,
    });
    expect(command.filter((item) => item === "--image-name")).toHaveLength(2);
    expect(command).toContain("--no-suppress-nested-duplicates");
    expect(command).toContain("--overwrite-labels");
    expect(() => manager.normalizePayload({ model: "model.pt", conf: "1" })).toThrow(
      "`conf` auto-label harus berada di rentang 0..1",
    );
  });
});

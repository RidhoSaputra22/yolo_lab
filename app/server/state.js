/**
 * AppState — state utama server YOLO Lab (labeler, footage, test runner, training runner).
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  DEFAULT_DATASET_DIR,
  DEFAULT_EDGE_PYTHON,
  DEFAULT_FRAMES_DIR,
  DEFAULT_LABELS_DIR,
  DEFAULT_TEST_OUTPUT_DIR,
  DEFAULT_TEST_INPUT_DIR,
  DEFAULT_TEST_RUNNER,
  DEFAULT_TRAIN_OUTPUT_DIR,
  DEFAULT_TRAIN_RUNNER,
  IMAGE_EXTENSIONS,
  LAB_DIR,
  PROJECT_DIR,
  WEIGHTS_EXTENSIONS,
} from "./constants.js";
import { envValue } from "./env.js";
import { HttpError } from "./errors.js";
import { shellJoin } from "./format.js";
import { discoverFiles, listTopLevelFiles } from "./files.js";
import { displayPath, pathInside, resolveProjectPath } from "./paths.js";
import { classNamesFromDataYaml } from "./parsers.js";
import { defaultLabelerAutolabelConfig } from "./forms/training-form.js";
import { FootageRunManager } from "./managers/footage-manager.js";
import { TestRunManager } from "./managers/test-manager.js";
import { TrainingRunManager } from "./managers/training-manager.js";

function defaultPythonBin() {
  if (existsSync(DEFAULT_EDGE_PYTHON)) {
    return DEFAULT_EDGE_PYTHON;
  }
  return envValue("YOLO_APP_PYTHON", "python3");
}

export class AppState {
  constructor({
    framesDir,
    labelsDir,
    classNames,
    checkpointPath,
    footageRunner,
    testRunner,
    trainingRunner,
    pythonBin,
    trainScript,
  }) {
    this.framesDir = path.resolve(framesDir);
    this.labelsDir = path.resolve(labelsDir);
    this.classNames = [...classNames];
    this.checkpointPath = path.resolve(checkpointPath);
    this.footageRunner = footageRunner;
    this.testRunner = testRunner;
    this.trainingRunner = trainingRunner;
    this.pythonBin = pythonBin;
    this.trainScript = path.resolve(trainScript);
  }

  listImages() {
    const checkpointImage = this.readCheckpointImage();
    return listTopLevelFiles(this.framesDir, IMAGE_EXTENSIONS).map((imagePath) => {
      const labelData = this.readLabelData(path.basename(imagePath));
      return {
        name: path.basename(imagePath),
        boxCount: labelData.boxes.length,
        hasLabelFile: labelData.hasLabelFile,
        parseError: labelData.parseError,
        isCheckpoint: path.basename(imagePath) === checkpointImage,
      };
    });
  }

  setFramesDir(nextFramesDir) {
    const resolvedPath = path.resolve(nextFramesDir);
    if (
      !existsSync(resolvedPath)
      || !statSync(resolvedPath).isDirectory()
      || !pathInside(resolvedPath, PROJECT_DIR)
    ) {
      throw new HttpError(400, `Folder frame aktif tidak valid: ${nextFramesDir}`);
    }
    this.framesDir = resolvedPath;
    return {
      framesDir: displayPath(this.framesDir),
      imageCount: listTopLevelFiles(this.framesDir, IMAGE_EXTENSIONS).length,
    };
  }

  readLabelData(imageName) {
    this.imagePath(imageName);
    const labelPath = this.labelPath(imageName);
    if (!existsSync(labelPath)) {
      return { boxes: [], hasLabelFile: false, parseError: null };
    }

    const boxes = [];
    const lines = readFileSync(labelPath, "utf8").split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) {
        continue;
      }

      const parts = line.split(/\s+/);
      if (parts.length !== 5) {
        return {
          boxes: [],
          hasLabelFile: true,
          parseError: `Format label tidak valid di ${path.basename(labelPath)} baris ${index + 1}.`,
        };
      }

      const classId = Number.parseInt(parts[0], 10);
      const numericValues = parts.slice(1).map((value) => Number.parseFloat(value));
      if (!Number.isFinite(classId) || numericValues.some((value) => !Number.isFinite(value))) {
        return {
          boxes: [],
          hasLabelFile: true,
          parseError: `Nilai numerik tidak valid di ${path.basename(labelPath)} baris ${index + 1}.`,
        };
      }

      boxes.push({
        classId,
        cx: numericValues[0],
        cy: numericValues[1],
        width: numericValues[2],
        height: numericValues[3],
      });
    }

    return { boxes, hasLabelFile: true, parseError: null };
  }

  saveLabelData(imageName, imageWidth, imageHeight, boxes) {
    this.imagePath(imageName);

    if (imageWidth <= 0 || imageHeight <= 0) {
      throw new HttpError(400, "Ukuran image tidak valid.");
    }

    const lines = [];
    for (const rawBox of boxes) {
      const classId = Number.parseInt(rawBox.classId, 10);
      if (!Number.isFinite(classId) || classId < 0 || classId >= this.classNames.length) {
        throw new HttpError(400, `Class ID di luar rentang: ${rawBox.classId}`);
      }

      const x = Number(rawBox.x) || 0;
      const y = Number(rawBox.y) || 0;
      const width = Number(rawBox.width) || 0;
      const height = Number(rawBox.height) || 0;

      const x1 = Math.max(0, Math.min(x, imageWidth));
      const y1 = Math.max(0, Math.min(y, imageHeight));
      const x2 = Math.max(0, Math.min(x + width, imageWidth));
      const y2 = Math.max(0, Math.min(y + height, imageHeight));

      const boxWidth = x2 - x1;
      const boxHeight = y2 - y1;
      if (boxWidth < 1 || boxHeight < 1) {
        continue;
      }

      const cx = ((x1 + x2) / 2) / imageWidth;
      const cy = ((y1 + y2) / 2) / imageHeight;
      const widthNorm = boxWidth / imageWidth;
      const heightNorm = boxHeight / imageHeight;
      lines.push(
        `${classId} ${cx.toFixed(6)} ${cy.toFixed(6)} ${widthNorm.toFixed(6)} ${heightNorm.toFixed(6)}`,
      );
    }

    const labelPath = this.labelPath(imageName);
    mkdirSync(path.dirname(labelPath), { recursive: true });
    writeFileSync(labelPath, `${lines.join("\n")}${lines.length ? "\n" : ""}`, "utf8");
    return { saved: true, boxCount: lines.length, labelPath: String(labelPath) };
  }

  autolabelConfigPayload() {
    const defaults = defaultLabelerAutolabelConfig();
    return {
      defaults,
      suggestions: {
        model: discoverFiles(
          [path.join(PROJECT_DIR, "edge"), path.join(LAB_DIR, "train", "runs")],
          WEIGHTS_EXTENSIONS,
        ),
      },
      runtimeWarnings: this.autolabelRuntimeWarnings(defaults),
    };
  }

  autolabelRuntimeWarnings(defaults = defaultLabelerAutolabelConfig()) {
    const warnings = [];
    if (!existsSync(this.trainScript)) {
      warnings.push(`Script training tidak ditemukan: ${this.trainScript}`);
    }
    if (path.isAbsolute(this.pythonBin) && !existsSync(this.pythonBin)) {
      warnings.push(`Python edge tidak ditemukan: ${this.pythonBin}`);
    }
    const modelPath = resolveProjectPath(defaults.model, { allowEmpty: true });
    if (modelPath && !existsSync(modelPath)) {
      warnings.push(`Model auto-label default belum ditemukan: ${displayPath(modelPath)}`);
    }
    return warnings;
  }

  autolabelImage(imageName, payload) {
    const safeImageName = path.basename(this.imagePath(imageName));
    const defaults = defaultLabelerAutolabelConfig();
    const raw = { ...defaults, ...(payload || {}) };

    const modelSource = String(raw.model ?? "").trim();
    if (!modelSource) {
      throw new HttpError(400, "Model auto-label wajib diisi.");
    }

    const conf = Number.parseFloat(String(raw.conf ?? defaults.conf));
    if (!Number.isFinite(conf) || conf <= 0 || conf >= 1) {
      throw new HttpError(400, "`conf` auto-label harus berada di rentang 0..1.");
    }

    const imgsz = Number.parseInt(String(raw.imgsz ?? defaults.imgsz), 10);
    if (!Number.isFinite(imgsz) || imgsz < 32) {
      throw new HttpError(400, "`imgsz` auto-label minimal 32.");
    }

    const device = String(raw.device ?? defaults.device ?? "auto").trim() || "auto";
    const command = [
      this.pythonBin,
      this.trainScript,
      "autolabel",
      "--frames-dir",
      displayPath(this.framesDir),
      "--labels-dir",
      displayPath(this.labelsDir),
      "--model",
      modelSource,
      "--conf",
      String(conf),
      "--imgsz",
      String(imgsz),
      "--device",
      device,
      "--image-name",
      safeImageName,
      "--overwrite-labels",
    ];

    const result = spawnSync(command[0], command.slice(1), {
      cwd: PROJECT_DIR,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        MPLCONFIGDIR: process.env.MPLCONFIGDIR || "/tmp/matplotlib",
      },
      encoding: "utf8",
      stdio: "pipe",
    });

    if (result.status !== 0) {
      const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      const message = output || "Auto-label frame gagal dijalankan.";
      throw new HttpError(500, message);
    }

    const labelData = this.readLabelData(safeImageName);
    return {
      image: safeImageName,
      commandDisplay: shellJoin(command),
      hasLabelFile: labelData.hasLabelFile,
      parseError: labelData.parseError,
      boxes: labelData.boxes,
      boxCount: labelData.boxes.length,
      stdout: (result.stdout || "").trim(),
      stderr: (result.stderr || "").trim(),
    };
  }

  readCheckpointImage() {
    if (!existsSync(this.checkpointPath)) {
      return null;
    }

    try {
      const payload = JSON.parse(readFileSync(this.checkpointPath, "utf8") || "{}");
      const imageName = String(payload.image || "").trim();
      if (!imageName) {
        return null;
      }
      return path.basename(this.imagePath(imageName));
    } catch {
      this.clearCheckpointImage();
      return null;
    }
  }

  saveCheckpointImage(imageName) {
    const safeName = path.basename(this.imagePath(imageName));
    mkdirSync(path.dirname(this.checkpointPath), { recursive: true });
    writeFileSync(
      this.checkpointPath,
      `${JSON.stringify({ image: safeName }, null, 2)}\n`,
      "utf8",
    );
    return { saved: true, checkpointImage: safeName };
  }

  clearCheckpointImage() {
    if (existsSync(this.checkpointPath)) {
      unlinkSync(this.checkpointPath);
    }
  }

  imagePath(imageName) {
    const safeName = this.safeName(imageName);
    const resolvedPath = path.resolve(this.framesDir, safeName);
    if (path.dirname(resolvedPath) !== this.framesDir || !existsSync(resolvedPath)) {
      throw new HttpError(404, `Frame tidak ditemukan: ${imageName}`);
    }
    return resolvedPath;
  }

  labelPath(imageName) {
    const safeName = this.safeName(imageName);
    const stem = path.parse(safeName).name;
    return path.resolve(this.labelsDir, `${stem}.txt`);
  }

  safeName(value) {
    const decoded = decodeURIComponent(String(value ?? ""));
    const normalized = path.basename(decoded);
    if (normalized !== decoded || !normalized || normalized === "." || normalized === "..") {
      throw new HttpError(400, "Nama file tidak valid.");
    }
    return normalized;
  }
}

export function createServerState(options) {
  const framesDir = path.resolve(options.framesDir);
  const labelsDir = path.resolve(options.labelsDir);
  const datasetDir = path.resolve(options.datasetDir);
  const pythonBin = defaultPythonBin();
  const cliClassNames = options.classNames.filter(Boolean);
  const datasetClassNames = classNamesFromDataYaml(datasetDir);
  const classNames = cliClassNames.length > 0 ? cliClassNames : datasetClassNames.length ? datasetClassNames : ["person"];

  if (!existsSync(framesDir)) {
    throw new Error(`Folder frame tidak ditemukan: ${framesDir}`);
  }

  mkdirSync(labelsDir, { recursive: true });
  const checkpointPath = path.join(labelsDir, ".manual_labeler_checkpoint.json");

  return new AppState({
    framesDir,
    labelsDir,
    classNames,
    checkpointPath,
    footageRunner: new FootageRunManager({
      projectDir: PROJECT_DIR,
      trainScript: DEFAULT_TRAIN_RUNNER,
      pythonBin,
      defaultFootageDir: DEFAULT_TEST_INPUT_DIR,
      defaultFramesDir: DEFAULT_FRAMES_DIR,
      defaultLabelsDir: DEFAULT_LABELS_DIR,
      defaultDatasetDir: DEFAULT_DATASET_DIR,
    }),
    testRunner: new TestRunManager({
      projectDir: PROJECT_DIR,
      runnerScript: DEFAULT_TEST_RUNNER,
      pythonBin,
      defaultOutputDir: DEFAULT_TEST_OUTPUT_DIR,
    }),
    trainingRunner: new TrainingRunManager({
      projectDir: PROJECT_DIR,
      trainScript: DEFAULT_TRAIN_RUNNER,
      pythonBin,
      defaultRunsDir: DEFAULT_TRAIN_OUTPUT_DIR,
    }),
    pythonBin,
    trainScript: DEFAULT_TRAIN_RUNNER,
  });
}

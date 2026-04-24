/**
 * AppState — state utama server YOLO Lab (labeler, footage, test runner, training runner).
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
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
  PROJECT_DIR,
} from "./constants.js";
import { envValue } from "./env.js";
import { HttpError } from "./errors.js";
import { listFrameDirectoryChoices, listTopLevelFiles } from "./files.js";
import { displayPath, pathInside, rebaseSubdirectoryPath, resolveProjectPath } from "./paths.js";
import { classNamesFromDataYaml } from "./parsers.js";
import { PagePreferenceStore } from "./preferences.js";
import { AutolabelRunManager } from "./managers/autolabel-manager.js";
import { FrameArchiveManager } from "./managers/frame-archive-manager.js";
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
    framesRootDir,
    labelsRootDir,
    labelsDir,
    classNames,
    checkpointPath,
    footageRunner,
    testRunner,
    trainingRunner,
    autolabelRunner,
    frameArchiveManager,
    pagePreferences,
    pythonBin,
    trainScript,
  }) {
    this.framesDir = path.resolve(framesDir);
    this.framesRootDir = path.resolve(framesRootDir);
    this.labelsRootDir = path.resolve(labelsRootDir);
    this.labelsDir = path.resolve(labelsDir);
    this.classNames = [...classNames];
    this.checkpointPath = path.resolve(checkpointPath);
    this.footageRunner = footageRunner;
    this.testRunner = testRunner;
    this.trainingRunner = trainingRunner;
    this.autolabelRunner = autolabelRunner;
    this.frameArchiveManager = frameArchiveManager;
    this.pagePreferences = pagePreferences;
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

  listFrameFolders() {
    return listFrameDirectoryChoices(this.framesRootDir, IMAGE_EXTENSIONS, this.framesDir)
      .map((item) => ({
        ...item,
        labelsDir: displayPath(this.labelsDirForFramesDir(resolveProjectPath(item.path))),
      }));
  }

  labelsDirForFramesDir(nextFramesDir = this.framesDir) {
    return rebaseSubdirectoryPath(this.framesRootDir, nextFramesDir, this.labelsRootDir);
  }

  activateFrameDirectory(nextFramesDir, { createLabelsDir = true } = {}) {
    const resolvedFramesDir = path.resolve(nextFramesDir);
    const nextLabelsDir = this.labelsDirForFramesDir(resolvedFramesDir);
    if (createLabelsDir) {
      mkdirSync(nextLabelsDir, { recursive: true });
    }

    this.framesDir = resolvedFramesDir;
    this.labelsDir = nextLabelsDir;
    this.checkpointPath = path.join(nextLabelsDir, ".manual_labeler_checkpoint.json");

    return {
      framesDir: displayPath(this.framesDir),
      labelsDir: displayPath(this.labelsDir),
      checkpointPath: displayPath(this.checkpointPath),
    };
  }

  setFramesDir(nextFramesDir) {
    const resolvedPath = path.resolve(nextFramesDir);
    if (
      !existsSync(resolvedPath)
      || !statSync(resolvedPath).isDirectory()
      || !pathInside(resolvedPath, this.framesRootDir)
    ) {
      throw new HttpError(400, `Folder frame aktif tidak valid: ${nextFramesDir}`);
    }
    const activePaths = this.activateFrameDirectory(resolvedPath);
    return {
      ...activePaths,
      imageCount: listTopLevelFiles(this.framesDir, IMAGE_EXTENSIONS).length,
      frameFolders: this.listFrameFolders(),
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

  deleteFrame(imageName) {
    const safeImageName = path.basename(this.imagePath(imageName));
    const imagePath = this.imagePath(safeImageName);
    const labelPath = this.labelPath(safeImageName);
    const hadLabelFile = existsSync(labelPath);
    const activeCheckpointImage = this.readCheckpointImage();
    const checkpointCleared = activeCheckpointImage === safeImageName;

    unlinkSync(imagePath);
    if (hadLabelFile) {
      unlinkSync(labelPath);
    }
    if (checkpointCleared) {
      this.clearCheckpointImage();
    }

    return {
      deleted: true,
      image: safeImageName,
      framePath: displayPath(imagePath),
      labelPath: hadLabelFile ? displayPath(labelPath) : null,
      labelDeleted: hadLabelFile,
      checkpointCleared,
      checkpointImage: this.readCheckpointImage(),
      remainingImageCount: listTopLevelFiles(this.framesDir, IMAGE_EXTENSIONS).length,
    };
  }

  exportFrameArchive() {
    return this.frameArchiveManager.exportArchive({
      framesDir: this.framesDir,
      labelsDir: this.labelsDir,
      classNames: this.classNames,
      checkpointImage: this.readCheckpointImage(),
    });
  }

  async importFrameArchive(formData) {
    const result = await this.frameArchiveManager.importArchive(formData);
    const nextFramesDir = resolveProjectPath(result.framesDir);
    const activePaths = this.setFramesDir(nextFramesDir);
    return {
      ...result,
      ...activePaths,
      checkpointImage: this.readCheckpointImage(),
    };
  }

  autolabelConfigPayload(overrides = {}) {
    return this.autolabelRunner.configPayload(overrides);
  }

  autolabelRuntimeWarnings(config) {
    return this.autolabelRunner.runtimeWarnings(config);
  }

  startAutolabelImage(imageName, payload) {
    const safeImageName = path.basename(this.imagePath(imageName));
    return this.autolabelRunner.startImage(payload, {
      framesDir: this.framesDir,
      labelsDir: this.labelsDir,
      imageName: safeImageName,
    });
  }

  startAutolabelSelection(imageNames, payload) {
    const safeImageNames = Array.from(
      new Set(
        (Array.isArray(imageNames) ? imageNames : [])
          .map((imageName) => String(imageName || "").trim())
          .filter(Boolean)
          .map((imageName) => path.basename(this.imagePath(imageName))),
      ),
    );

    if (!safeImageNames.length) {
      throw new HttpError(400, "Minimal pilih satu frame untuk auto-label.");
    }

    return this.autolabelRunner.startSelection(payload, {
      framesDir: this.framesDir,
      labelsDir: this.labelsDir,
      imageNames: safeImageNames,
    });
  }

  startAutolabelAll(payload) {
    return this.autolabelRunner.startAll(payload, {
      framesDir: this.framesDir,
      labelsDir: this.labelsDir,
    });
  }

  autolabelJobSnapshot(config) {
    return this.autolabelRunner.snapshot(config);
  }

  stopAutolabel() {
    return this.autolabelRunner.stop();
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
  const defaultFramesDir = path.resolve(options.framesDir);
  const defaultFramesRootDir = path.resolve(DEFAULT_FRAMES_DIR);
  const framesRootDir = pathInside(defaultFramesDir, defaultFramesRootDir) ? defaultFramesRootDir : defaultFramesDir;
  const labelsRootDir = path.resolve(options.labelsDir);
  const datasetDir = path.resolve(options.datasetDir);
  const pythonBin = defaultPythonBin();
  const pagePreferences = new PagePreferenceStore();
  const cliClassNames = options.classNames.filter(Boolean);
  const datasetClassNames = classNamesFromDataYaml(datasetDir);
  const classNames = cliClassNames.length > 0 ? cliClassNames : datasetClassNames.length ? datasetClassNames : ["person"];
  const savedLabelerPreferences = pagePreferences.read("labeler");
  let framesDir = defaultFramesDir;

  const savedFramesDirValue = String(savedLabelerPreferences.framesDir || "").trim();
  if (savedFramesDirValue) {
    try {
      const resolvedSavedFramesDir = resolveProjectPath(savedFramesDirValue);
      if (
        existsSync(resolvedSavedFramesDir)
        && statSync(resolvedSavedFramesDir).isDirectory()
        && pathInside(resolvedSavedFramesDir, framesRootDir)
      ) {
        framesDir = resolvedSavedFramesDir;
      }
    } catch {
      // Abaikan preference lama yang tidak valid dan fallback ke opsi CLI/default.
    }
  }

  const labelsDir = rebaseSubdirectoryPath(framesRootDir, framesDir, labelsRootDir);

  if (!existsSync(framesDir)) {
    throw new Error(`Folder frame tidak ditemukan: ${framesDir}`);
  }

  mkdirSync(labelsRootDir, { recursive: true });
  mkdirSync(labelsDir, { recursive: true });
  const checkpointPath = path.join(labelsDir, ".manual_labeler_checkpoint.json");

  return new AppState({
    framesDir,
    framesRootDir,
    labelsRootDir,
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
    autolabelRunner: new AutolabelRunManager({
      projectDir: PROJECT_DIR,
      trainScript: DEFAULT_TRAIN_RUNNER,
      pythonBin,
    }),
    frameArchiveManager: new FrameArchiveManager({
      projectDir: PROJECT_DIR,
      framesRootDir,
      labelsRootDir,
      pythonBin,
    }),
    pagePreferences,
    pythonBin,
    trainScript: DEFAULT_TRAIN_RUNNER,
  });
}

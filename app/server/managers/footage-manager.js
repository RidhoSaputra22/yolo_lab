/**
 * FootageRunManager — mengelola import footage, snapshot dataset, dan ekstraksi frame.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  DEFAULT_DATASET_DIR,
  DEFAULT_FRAMES_DIR,
  DEFAULT_LABELS_DIR,
  DEFAULT_TEST_INPUT_DIR,
  IMAGE_EXTENSIONS,
  LABEL_EXTENSIONS,
  PROJECT_DIR,
  VIDEO_EXTENSIONS,
} from "../constants.js";
import { HttpError } from "../errors.js";
import { fileSizeLabel, shellJoin, toLocalIso } from "../format.js";
import { listTopLevelFiles } from "../files.js";
import { defaultFootageFormData, footageFormLayout } from "../forms/footage-form.js";
import { displayPath, encodePathQuery, pathInside, rebaseSubdirectoryPath, resolveProjectPath } from "../paths.js";
import { BaseRunManager } from "./base-manager.js";

const VIDEO_FRAME_COUNT_SCRIPT = `
import cv2
import sys

capture = cv2.VideoCapture(sys.argv[1])
if not capture.isOpened():
    print(0)
    raise SystemExit(0)

try:
    value = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    print(value if value > 0 else 0)
finally:
    capture.release()
`;

function frameSourceStem(fileName) {
  const match = String(fileName || "").match(/^(.*)__f\d+$/);
  return match ? match[1] : null;
}

function countNonEmptyLines(filePath) {
  if (!existsSync(filePath)) {
    return 0;
  }
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .length;
}

function safeUploadName(fileName) {
  const parsed = path.parse(path.basename(String(fileName || "").trim()));
  const safeStem = parsed.name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "footage";
  return `${safeStem}${parsed.ext.toLowerCase()}`;
}

function isAutoFrameDirectoryName(value) {
  return /^(?:frame|frames)_\d{8}_\d+(?:_\d+)?$/.test(String(value || ""));
}

function dateStamp(value = new Date()) {
  const pad = (input) => String(input).padStart(2, "0");
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}`;
}

export class FootageRunManager extends BaseRunManager {
  constructor({
    projectDir,
    trainScript,
    pythonBin,
    defaultFootageDir = DEFAULT_TEST_INPUT_DIR,
    defaultFramesDir = DEFAULT_FRAMES_DIR,
    defaultLabelsDir = DEFAULT_LABELS_DIR,
    defaultDatasetDir = DEFAULT_DATASET_DIR,
  }) {
    super();
    this.projectDir = path.resolve(projectDir);
    this.trainScript = path.resolve(trainScript);
    this.pythonBin = pythonBin;
    this.defaultFootageDir = path.resolve(defaultFootageDir);
    this.defaultFramesDir = path.resolve(defaultFramesDir);
    this.defaultLabelsDir = path.resolve(defaultLabelsDir);
    this.defaultDatasetDir = path.resolve(defaultDatasetDir);
    this.videoFrameCountCache = new Map();
    this.current = {
      jobId: 0,
      state: "idle",
      process: null,
      command: [],
      commandDisplay: "",
      config: {},
      outputDir: null,
      startedAt: null,
      finishedAt: null,
      returnCode: null,
      stopRequested: false,
      logs: [],
      error: null,
    };
  }

  configPayload(defaultOverrides = {}) {
    const requestedDefaults = { ...defaultFootageFormData(), ...(defaultOverrides || {}) };
    const defaults = this.normalizePayload(requestedDefaults, { validatePaths: false });
    let preview = { config: defaults, command: [], commandDisplay: "" };
    try {
      preview = this.preview(defaults);
    } catch {
      preview = { config: defaults, command: [], commandDisplay: "" };
    }

    return {
      layout: footageFormLayout(),
      defaults,
      suggestions: {
        footageDir: [displayPath(this.defaultFootageDir)],
        framesDir: [displayPath(this.defaultFramesDir), defaults.framesDir],
      },
      paths: {
        projectDir: this.projectDir,
        trainScript: displayPath(this.trainScript),
        pythonBin: path.isAbsolute(this.pythonBin) ? displayPath(this.pythonBin) : this.pythonBin,
        defaultFootageDir: displayPath(this.defaultFootageDir),
        defaultFramesDir: displayPath(this.defaultFramesDir),
        defaultLabelsDir: displayPath(this.defaultLabelsDir),
        defaultDatasetDir: displayPath(this.defaultDatasetDir),
      },
      preview,
      runtimeWarnings: this.runtimeWarnings(defaults),
      job: this.snapshot(defaults),
    };
  }

  runtimeWarnings(defaults = defaultFootageFormData()) {
    const warnings = [];
    if (!existsSync(this.trainScript)) {
      warnings.push(`Script training tidak ditemukan: ${this.trainScript}`);
    }
    if (path.isAbsolute(this.pythonBin) && !existsSync(this.pythonBin)) {
      warnings.push(`Python edge tidak ditemukan: ${this.pythonBin}`);
    }

    const footageDir = resolveProjectPath(defaults.footageDir);
    if (!existsSync(footageDir)) {
      warnings.push(`Folder footage belum ada dan akan dibuat saat import: ${displayPath(footageDir)}`);
    }

    return warnings;
  }

  preview(payload) {
    const config = this.normalizePayload(payload, { validatePaths: false });
    const command = this.buildCommand(config);
    return {
      config,
      command,
      commandDisplay: shellJoin(command),
      library: this.librarySnapshot(config),
    };
  }

  start(payload) {
    const config = this.normalizePayload(payload, { validatePaths: true });
    const command = this.buildCommand(config);

    if (!existsSync(this.trainScript)) {
      throw new HttpError(404, `Script training tidak ditemukan: ${this.trainScript}`);
    }
    if (path.isAbsolute(this.pythonBin) && !existsSync(this.pythonBin)) {
      throw new HttpError(404, `Python edge tidak ditemukan: ${this.pythonBin}`);
    }
    if (this.isRunning()) {
      throw new HttpError(409, "Masih ada proses ekstraksi frame yang berjalan. Stop dulu sebelum mulai run baru.");
    }

    const framesDir = resolveProjectPath(config.framesDir);
    const labelsDir = this.labelsDirForFramesDir(framesDir);
    mkdirSync(framesDir, { recursive: true });
    mkdirSync(labelsDir, { recursive: true });

    const env = {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      MPLCONFIGDIR: process.env.MPLCONFIGDIR || "/tmp/matplotlib",
    };

    const child = spawn(command[0], command.slice(1), {
      cwd: this.projectDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const jobId = this.nextJobId;
    this.nextJobId += 1;
    this.current = {
      jobId,
      state: "running",
      process: child,
      command,
      commandDisplay: shellJoin(command),
      config,
      outputDir: framesDir,
      startedAt: Date.now(),
      finishedAt: null,
      returnCode: null,
      stopRequested: false,
      logs: [
        "[app] Menjalankan ekstraksi frame dari footage.",
        `$ ${shellJoin(command)}`,
      ],
      error: null,
    };

    this.consumeStream(jobId, child.stdout);
    this.consumeStream(jobId, child.stderr);

    child.on("close", (returnCode) => {
      if (this.current.jobId !== jobId) {
        return;
      }

      this.current.process = null;
      this.current.returnCode = typeof returnCode === "number" ? returnCode : 1;
      this.current.finishedAt = Date.now();
      if (this.current.stopRequested) {
        this.current.state = "stopped";
        this.appendLog(`[app] Proses ekstraksi dihentikan. Return code: ${this.current.returnCode}`);
      } else if (this.current.returnCode === 0) {
        this.current.state = "finished";
        this.appendLog("[app] Ekstraksi frame selesai tanpa error.");
      } else {
        this.current.state = "failed";
        this.current.error = `Ekstraksi frame berhenti dengan kode ${this.current.returnCode}.`;
        this.appendLog(this.current.error);
      }
    });

    child.on("error", (error) => {
      if (this.current.jobId !== jobId) {
        return;
      }
      this.current.process = null;
      this.current.finishedAt = Date.now();
      this.current.state = "failed";
      this.current.returnCode = 1;
      this.current.error = `Gagal menjalankan ekstraksi frame: ${error.message}`;
      this.appendLog(this.current.error);
    });

    return this.snapshot(config);
  }

  stop() {
    if (!this.isRunning() || !this.current.process) {
      throw new HttpError(409, "Tidak ada proses ekstraksi frame yang sedang berjalan.");
    }

    const processRef = this.current.process;
    this.current.stopRequested = true;
    this.appendLog("[app] Mengirim sinyal stop ke proses ekstraksi...");
    processRef.kill("SIGTERM");
    setTimeout(() => {
      if (processRef.exitCode === null && !processRef.killed) {
        processRef.kill("SIGKILL");
      }
    }, 5000).unref?.();

    return this.snapshot();
  }

  snapshot(baseConfig = null) {
    const fallbackConfig =
      baseConfig || (Object.keys(this.current.config).length ? this.current.config : defaultFootageFormData());

    return {
      jobId: this.current.jobId,
      state: this.current.state,
      running: this.isRunning(),
      command: [...this.current.command],
      commandDisplay: this.current.commandDisplay,
      config: { ...this.current.config },
      outputDir: displayPath(this.current.outputDir),
      startedAt: toLocalIso(this.current.startedAt),
      finishedAt: toLocalIso(this.current.finishedAt),
      durationSeconds: this.durationSeconds(),
      returnCode: this.current.returnCode,
      stopRequested: this.current.stopRequested,
      logs: [...this.current.logs],
      error: this.current.error,
      library: this.librarySnapshot(fallbackConfig),
    };
  }

  framesRootDir(value) {
    const resolvedPath = resolveProjectPath(value);
    return isAutoFrameDirectoryName(path.basename(resolvedPath))
      ? path.dirname(resolvedPath)
      : resolvedPath;
  }

  readVideoFrameCount(videoPath) {
    if (!existsSync(videoPath)) {
      return 0;
    }

    const resolvedPath = path.resolve(videoPath);
    const stats = statSync(resolvedPath);
    const signature = `${stats.size}:${stats.mtimeMs}`;
    const cached = this.videoFrameCountCache.get(resolvedPath);
    if (cached && cached.signature === signature) {
      return cached.frameCount;
    }

    const result = spawnSync(this.pythonBin, ["-c", VIDEO_FRAME_COUNT_SCRIPT, resolvedPath], {
      cwd: this.projectDir,
      encoding: "utf8",
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
      stdio: "pipe",
    });

    const frameCount = result.status === 0
      ? Math.max(0, Number.parseInt(String(result.stdout || "").trim(), 10) || 0)
      : 0;

    this.videoFrameCountCache.set(resolvedPath, { signature, frameCount });
    return frameCount;
  }

  estimateSelectedFrameCount(footageDir, sampleEvery, maxFramesPerVideo) {
    if (!existsSync(footageDir) || !statSync(footageDir).isDirectory()) {
      return 0;
    }

    return listTopLevelFiles(footageDir, VIDEO_EXTENSIONS).reduce((sum, videoPath) => {
      const frameCount = this.readVideoFrameCount(videoPath);
      if (!frameCount) {
        return sum;
      }

      const selectedFrames = Math.ceil(frameCount / sampleEvery);
      const cappedFrames =
        maxFramesPerVideo > 0 ? Math.min(selectedFrames, maxFramesPerVideo) : selectedFrames;
      return sum + cappedFrames;
    }, 0);
  }

  labelsDirForFramesDir(framesDir) {
    return rebaseSubdirectoryPath(this.defaultFramesDir, framesDir, this.defaultLabelsDir);
  }

  buildAutoFramesDir(rawFramesDir, footageDir, sampleEvery, maxFramesPerVideo) {
    const requestedPath = resolveProjectPath(rawFramesDir);
    const rootDir = this.framesRootDir(rawFramesDir);
    const totalFrames = this.estimateSelectedFrameCount(footageDir, sampleEvery, maxFramesPerVideo);
    const folderStem = `frame_${dateStamp()}_${totalFrames}`;
    const requestedBaseName = path.basename(requestedPath);

    if (isAutoFrameDirectoryName(requestedBaseName) && requestedBaseName.startsWith(folderStem)) {
      return requestedPath;
    }

    const candidate = path.join(rootDir, folderStem);
    if (!existsSync(candidate) || candidate === requestedPath) {
      return candidate;
    }

    let index = 2;
    while (existsSync(path.join(rootDir, `${folderStem}_${index}`))) {
      index += 1;
    }
    return path.join(rootDir, `${folderStem}_${index}`);
  }

  librarySnapshot(config) {
    const raw = { ...defaultFootageFormData(), ...(config || {}) };
    const footageDir = resolveProjectPath(raw.footageDir);
    const framesDir = resolveProjectPath(raw.framesDir);
    const labelsDir = this.labelsDirForFramesDir(framesDir);
    const datasetDir = this.defaultDatasetDir;
    const hasFootageDir = existsSync(footageDir) && statSync(footageDir).isDirectory();
    const hasFramesDir = existsSync(framesDir) && statSync(framesDir).isDirectory();
    const hasLabelsDir = existsSync(labelsDir) && statSync(labelsDir).isDirectory();

    const footagePaths = hasFootageDir
      ? listTopLevelFiles(footageDir, VIDEO_EXTENSIONS).sort(
          (left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs,
        )
      : [];
    const framePaths = hasFramesDir ? listTopLevelFiles(framesDir, IMAGE_EXTENSIONS) : [];
    const labelPaths = hasLabelsDir ? listTopLevelFiles(labelsDir, LABEL_EXTENSIONS) : [];

    const frameCountByStem = new Map();
    const labeledCountByStem = new Map();
    for (const framePath of framePaths) {
      const stem = frameSourceStem(path.parse(framePath).name) || path.parse(framePath).name;
      frameCountByStem.set(stem, (frameCountByStem.get(stem) || 0) + 1);
    }

    const labelStemSet = new Set();
    for (const labelPath of labelPaths) {
      const labelStem = path.parse(labelPath).name;
      labelStemSet.add(labelStem);
      const sourceStem = frameSourceStem(labelStem) || labelStem;
      labeledCountByStem.set(sourceStem, (labeledCountByStem.get(sourceStem) || 0) + 1);
    }

    const footageItems = footagePaths.map((footagePath) => this.footagePayload(footagePath, frameCountByStem, labeledCountByStem));
    const totalFootageBytes = footageItems.reduce((sum, item) => sum + item.sizeBytes, 0);
    const labeledFrameCount = framePaths.reduce(
      (sum, framePath) => sum + (labelStemSet.has(path.parse(framePath).name) ? 1 : 0),
      0,
    );

    const framePreview = [...framePaths]
      .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)
      .slice(0, 18)
      .map((framePath) => this.framePayload(framePath, labelStemSet, labelsDir));

    return {
      footageDir: displayPath(footageDir),
      framesDir: displayPath(framesDir),
      labelsDir: displayPath(labelsDir),
      footageCount: footageItems.length,
      frameCount: framePaths.length,
      labeledFrameCount,
      pendingFrameCount: Math.max(0, framePaths.length - labeledFrameCount),
      totalFootageBytes,
      totalFootageSizeLabel: fileSizeLabel(totalFootageBytes),
      latestFootageAt: footageItems[0]?.modifiedAt || null,
      footageItems,
      framePreview,
      dataset: {
        datasetDir: displayPath(datasetDir),
        dataYamlExists: existsSync(path.join(datasetDir, "data.yaml")),
        trainImages: listTopLevelFiles(path.join(datasetDir, "images", "train"), IMAGE_EXTENSIONS).length,
        valImages: listTopLevelFiles(path.join(datasetDir, "images", "val"), IMAGE_EXTENSIONS).length,
        trainLabels: listTopLevelFiles(path.join(datasetDir, "labels", "train"), LABEL_EXTENSIONS).length,
        valLabels: listTopLevelFiles(path.join(datasetDir, "labels", "val"), LABEL_EXTENSIONS).length,
      },
    };
  }

  footagePayload(targetPath, frameCountByStem, labeledCountByStem) {
    const stats = statSync(targetPath);
    const resolvedPath = path.resolve(targetPath);
    const relativePath = displayPath(resolvedPath);
    const stem = path.parse(targetPath).name;
    const previewUrl = pathInside(resolvedPath, PROJECT_DIR)
      ? `/api/footage/artifact?path=${encodePathQuery(relativePath)}`
      : null;

    return {
      name: path.basename(targetPath),
      path: relativePath,
      sizeBytes: stats.size,
      sizeLabel: fileSizeLabel(stats.size),
      modifiedAt: toLocalIso(stats.mtimeMs),
      previewUrl,
      extractedFrames: frameCountByStem.get(stem) || 0,
      labeledFrames: labeledCountByStem.get(stem) || 0,
      extension: path.extname(targetPath).toLowerCase(),
    };
  }

  framePayload(targetPath, labelStemSet, labelsDir) {
    const stats = statSync(targetPath);
    const name = path.basename(targetPath);
    const stem = path.parse(name).name;
    const sourceStem = frameSourceStem(stem);
    const hasLabelFile = labelStemSet.has(stem);
    const labelPath = path.join(labelsDir, `${stem}.txt`);
    const relativePath = displayPath(targetPath);

    return {
      name,
      imageUrl: `/api/footage/artifact?path=${encodePathQuery(relativePath)}`,
      modifiedAt: toLocalIso(stats.mtimeMs),
      sourceStem,
      hasLabelFile,
      boxCount: hasLabelFile ? countNonEmptyLines(labelPath) : 0,
    };
  }

  async importFiles(formData) {
    const defaults = defaultFootageFormData();
    const targetDir = resolveProjectPath(formData.get("footageDir") || defaults.footageDir);
    if (!pathInside(targetDir, this.projectDir)) {
      throw new HttpError(400, "Import footage hanya boleh diarahkan ke folder di dalam project.");
    }
    if (existsSync(targetDir) && !statSync(targetDir).isDirectory()) {
      throw new HttpError(400, "Target import footage harus berupa folder, bukan file.");
    }

    mkdirSync(targetDir, { recursive: true });
    const files = formData
      .getAll("files")
      .filter((item) => item && typeof item === "object" && typeof item.arrayBuffer === "function");

    if (!files.length) {
      throw new HttpError(400, "Pilih minimal satu file video untuk diimport.");
    }

    const imported = [];
    const skipped = [];

    for (const file of files) {
      const originalName = path.basename(String(file.name || "").trim()) || "footage";
      const finalName = safeUploadName(originalName);
      const extension = path.extname(finalName).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(extension)) {
        skipped.push({
          name: originalName,
          reason: `Format video tidak didukung: ${extension || "(tanpa ekstensi)"}`,
        });
        continue;
      }
      if (!Number.isFinite(file.size) || file.size <= 0) {
        skipped.push({
          name: originalName,
          reason: "Ukuran file kosong atau tidak valid.",
        });
        continue;
      }

      const destinationPath = this.uniqueImportPath(targetDir, finalName);
      const buffer = Buffer.from(await file.arrayBuffer());
      writeFileSync(destinationPath, buffer);
      const stats = statSync(destinationPath);
      imported.push({
        originalName,
        savedName: path.basename(destinationPath),
        path: displayPath(destinationPath),
        sizeBytes: stats.size,
        sizeLabel: fileSizeLabel(stats.size),
      });
    }

    if (!imported.length) {
      throw new HttpError(400, "Tidak ada file video valid yang berhasil diimport.");
    }

    return {
      targetDir: displayPath(targetDir),
      importedCount: imported.length,
      skippedCount: skipped.length,
      imported,
      skipped,
    };
  }

  uniqueImportPath(targetDir, fileName) {
    const parsed = path.parse(fileName);
    let counter = 0;

    while (true) {
      const suffix = counter === 0 ? "" : `-${counter + 1}`;
      const candidate = path.join(targetDir, `${parsed.name}${suffix}${parsed.ext}`);
      if (!existsSync(candidate)) {
        return candidate;
      }
      counter += 1;
    }
  }

  normalizePayload(payload, { validatePaths = false } = {}) {
    const raw = { ...defaultFootageFormData(), ...(payload || {}) };
    const footageDir = resolveProjectPath(raw.footageDir);
    const sampleEvery = this.intValue(raw.sampleEvery, { minimum: 1, fieldName: "sampleEvery" });
    const maxFramesPerVideo = this.intValue(raw.maxFramesPerVideo, {
      minimum: 0,
      fieldName: "maxFramesPerVideo",
    });
    const framesDir = this.buildAutoFramesDir(raw.framesDir, footageDir, sampleEvery, maxFramesPerVideo);
    const estimatedFrameCount = this.estimateSelectedFrameCount(footageDir, sampleEvery, maxFramesPerVideo);
    const config = {
      footageDir: displayPath(footageDir),
      framesDir: displayPath(framesDir),
      sampleEvery,
      maxFramesPerVideo,
      jpegQuality: this.intValue(raw.jpegQuality, {
        minimum: 1,
        maximum: 100,
        fieldName: "jpegQuality",
      }),
      overwriteFrames: this.boolValue(raw.overwriteFrames),
      estimatedFrameCount,
    };

    if (validatePaths) {
      if (!existsSync(footageDir) || !statSync(footageDir).isDirectory()) {
        throw new HttpError(404, `Folder footage tidak ditemukan: ${raw.footageDir || ""}`);
      }

      const footageVideos = readdirSync(footageDir, { withFileTypes: true }).filter(
        (entry) => entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
      );
      if (!footageVideos.length) {
        throw new HttpError(400, `Belum ada video footage di folder: ${displayPath(footageDir)}`);
      }
    }

    return config;
  }

  buildCommand(config) {
    const command = [
      this.pythonBin,
      this.trainScript,
      "extract",
      "--footage-dir",
      config.footageDir,
      "--frames-dir",
      config.framesDir,
      "--sample-every",
      String(config.sampleEvery),
      "--max-frames-per-video",
      String(config.maxFramesPerVideo),
      "--jpeg-quality",
      String(config.jpegQuality),
    ];

    if (config.overwriteFrames) {
      command.push("--overwrite-frames");
    }

    return command;
  }
}

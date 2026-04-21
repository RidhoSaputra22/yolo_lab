/**
 * TestRunManager — mengelola proses test runner offline.
 */

import { closeSync, existsSync, mkdirSync, openSync, readSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  ARTIFACT_EXTENSIONS,
  DEFAULT_TEST_INPUT_DIR,
  LAB_DIR,
  MAX_DISCOVERY_ITEMS,
  PROJECT_DIR,
  VIDEO_EXTENSIONS,
  WEIGHTS_EXTENSIONS,
} from "../constants.js";
import { HttpError } from "../errors.js";
import { fileSizeLabel, shellJoin, toLocalIso } from "../format.js";
import { discoverFiles } from "../files.js";
import { displayPath, encodePathQuery, pathInside, resolveProjectPath } from "../paths.js";
import { defaultTestFormData, testFormLayout } from "../forms/test-form.js";
import { BaseRunManager } from "./base-manager.js";

function inspectMp4Playback(filePath) {
  const stats = statSync(filePath);
  if (!stats.isFile() || stats.size < 8) {
    return {
      playable: false,
      issue: "File video tidak lengkap atau ukurannya terlalu kecil.",
    };
  }

  let fd = null;
  try {
    fd = openSync(filePath, "r");
    let offset = 0;
    let foundFtyp = false;
    let foundMoov = false;

    while (offset + 8 <= stats.size) {
      const header = Buffer.alloc(8);
      const headerRead = readSync(fd, header, 0, 8, offset);
      if (headerRead < 8) {
        break;
      }

      let atomSize = header.readUInt32BE(0);
      const atomType = header.toString("ascii", 4, 8);
      let headerSize = 8;

      if (atomSize === 1) {
        const extendedSizeBuffer = Buffer.alloc(8);
        const extendedRead = readSync(fd, extendedSizeBuffer, 0, 8, offset + 8);
        if (extendedRead < 8) {
          return {
            playable: false,
            issue: "Header MP4 tidak lengkap.",
          };
        }
        atomSize = Number(extendedSizeBuffer.readBigUInt64BE(0));
        headerSize = 16;
      } else if (atomSize === 0) {
        atomSize = stats.size - offset;
      }

      if (!Number.isFinite(atomSize) || atomSize < headerSize || offset + atomSize > stats.size) {
        return {
          playable: false,
          issue: "Struktur MP4 tidak lengkap atau terpotong.",
        };
      }

      if (atomType === "ftyp") {
        foundFtyp = true;
      }
      if (atomType === "moov") {
        foundMoov = true;
      }

      offset += atomSize;
    }

    if (!foundFtyp) {
      return {
        playable: false,
        issue: "Header MP4 (ftyp) tidak ditemukan.",
      };
    }

    if (!foundMoov) {
      return {
        playable: false,
        issue:
          "Metadata MP4 (moov atom) tidak ditemukan. Biasanya file video belum selesai ditulis atau proses test berhenti sebelum finalisasi.",
      };
    }

    return {
      playable: true,
      issue: null,
    };
  } catch (error) {
    return {
      playable: false,
      issue: `Video tidak bisa dibaca: ${error.message}`,
    };
  } finally {
    if (fd !== null) {
      closeSync(fd);
    }
  }
}

export class TestRunManager extends BaseRunManager {
  constructor({ projectDir, runnerScript, pythonBin, defaultOutputDir }) {
    super();
    this.projectDir = path.resolve(projectDir);
    this.runnerScript = path.resolve(runnerScript);
    this.pythonBin = pythonBin;
    this.defaultOutputDir = path.resolve(defaultOutputDir);
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
    const defaults = { ...defaultTestFormData(), ...(defaultOverrides || {}) };
    const outputSuggestions = [displayPath(this.defaultOutputDir)];
    if (existsSync(this.defaultOutputDir)) {
      const directDirs = readdirSync(this.defaultOutputDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => displayPath(path.join(this.defaultOutputDir, entry.name)))
        .slice(0, 8);
      outputSuggestions.push(...directDirs);
    }

    const suggestions = {
      input: discoverFiles(
        [DEFAULT_TEST_INPUT_DIR, path.join(this.projectDir, "rstp"), path.join(this.projectDir, "uploads")],
        VIDEO_EXTENSIONS,
      ),
      weights: discoverFiles(
        [path.join(this.projectDir, "edge"), path.join(LAB_DIR, "train", "runs")],
        WEIGHTS_EXTENSIONS,
      ),
      outputDir: outputSuggestions,
    };

    let preview = { config: defaults, command: [], commandDisplay: "" };
    try {
      preview = this.preview(defaults);
    } catch {
      preview = { config: defaults, command: [], commandDisplay: "" };
    }

    return {
      layout: testFormLayout(),
      defaults,
      choices: {
        backend: ["yolov5", "ultralytics"],
        identityMode: ["reid", "face"],
      },
      paths: {
        projectDir: this.projectDir,
        runnerScript: displayPath(this.runnerScript),
        pythonBin: path.isAbsolute(this.pythonBin) ? displayPath(this.pythonBin) : this.pythonBin,
        defaultOutputDir: displayPath(this.defaultOutputDir),
      },
      suggestions,
      preview,
      runtimeWarnings: this.runtimeWarnings(),
      job: this.snapshot(),
    };
  }

  runtimeWarnings() {
    const warnings = [];
    if (!existsSync(this.runnerScript)) {
      warnings.push(`Runner test tidak ditemukan: ${this.runnerScript}`);
    }
    if (path.isAbsolute(this.pythonBin) && !existsSync(this.pythonBin)) {
      warnings.push(`Python edge tidak ditemukan: ${this.pythonBin}`);
    }
    if (!existsSync(DEFAULT_TEST_INPUT_DIR)) {
      warnings.push(`Folder footage tidak ditemukan: ${DEFAULT_TEST_INPUT_DIR}`);
    }
    return warnings;
  }

  preview(payload) {
    const config = this.normalizePayload(payload);
    const command = this.buildCommand(config);
    return {
      config,
      command,
      commandDisplay: shellJoin(command),
    };
  }

  start(payload) {
    const preview = this.preview(payload);
    const config = preview.config;
    const command = [...preview.command];

    if (!existsSync(this.runnerScript)) {
      throw new HttpError(404, `Runner test tidak ditemukan: ${this.runnerScript}`);
    }
    if (path.isAbsolute(this.pythonBin) && !existsSync(this.pythonBin)) {
      throw new HttpError(404, `Python edge tidak ditemukan: ${this.pythonBin}`);
    }
    if (this.isRunning()) {
      throw new HttpError(409, "Masih ada proses test yang berjalan. Stop dulu sebelum mulai run baru.");
    }

    const outputDir = resolveProjectPath(config.outputDir);
    mkdirSync(outputDir, { recursive: true });

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
      commandDisplay: preview.commandDisplay,
      config,
      outputDir,
      startedAt: Date.now(),
      finishedAt: null,
      returnCode: null,
      stopRequested: false,
      logs: [
        "[app] Menjalankan runner offline YOLO.",
        `$ ${preview.commandDisplay}`,
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
        this.appendLog(`[app] Proses dihentikan. Return code: ${this.current.returnCode}`);
      } else if (this.current.returnCode === 0) {
        this.current.state = "finished";
        this.appendLog("[app] Run selesai tanpa error.");
      } else {
        this.current.state = "failed";
        this.current.error = `Runner berhenti dengan kode ${this.current.returnCode}.`;
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
      this.current.error = `Gagal menjalankan runner: ${error.message}`;
      this.appendLog(this.current.error);
    });

    return this.snapshot();
  }

  stop() {
    if (!this.isRunning() || !this.current.process) {
      throw new HttpError(409, "Tidak ada proses test yang sedang berjalan.");
    }

    const processRef = this.current.process;
    this.current.stopRequested = true;
    this.appendLog("[app] Mengirim sinyal stop ke proses test...");
    processRef.kill("SIGTERM");
    setTimeout(() => {
      if (processRef.exitCode === null && !processRef.killed) {
        processRef.kill("SIGKILL");
      }
    }, 5000).unref?.();

    return this.snapshot();
  }

  snapshot() {
    const artifactRoot = this.current.outputDir || this.defaultOutputDir;
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
      artifacts: this.listArtifacts(artifactRoot),
    };
  }

  listArtifacts(outputDir) {
    if (!outputDir || !existsSync(outputDir)) {
      return [];
    }

    const files = [];
    const stack = [path.resolve(outputDir)];
    while (stack.length) {
      const currentDir = stack.pop();
      for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
        const entryPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          stack.push(entryPath);
          continue;
        }
        if (entry.isFile() && ARTIFACT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          files.push(entryPath);
        }
      }
    }

    files.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
    return files.slice(0, MAX_DISCOVERY_ITEMS).map((artifactPath) => this.artifactPayload(artifactPath));
  }

  artifactPayload(targetPath) {
    const stats = statSync(targetPath);
    const resolvedPath = path.resolve(targetPath);
    const relativePath = displayPath(resolvedPath);
    const isVideo = path.extname(targetPath).toLowerCase() === ".mp4";
    const downloadUrl = pathInside(resolvedPath, PROJECT_DIR)
      ? `/api/test/artifact?path=${encodePathQuery(relativePath)}`
      : null;

    return {
      name: path.basename(targetPath),
      path: relativePath,
      parent: displayPath(path.dirname(resolvedPath)),
      sizeBytes: stats.size,
      sizeLabel: fileSizeLabel(stats.size),
      modifiedAt: toLocalIso(stats.mtimeMs),
      downloadUrl,
      isVideo,
      videoPlayback: isVideo ? inspectMp4Playback(resolvedPath) : null,
    };
  }

  normalizePayload(payload) {
    const raw = { ...defaultTestFormData(), ...(payload || {}) };

    const inputPath = resolveProjectPath(raw.input);
    if (!existsSync(inputPath) || !statSync(inputPath).isFile()) {
      throw new HttpError(404, `Input video tidak ditemukan: ${raw.input || ""}`);
    }

    const outputDir = resolveProjectPath(raw.outputDir);
    const weightsPath = resolveProjectPath(raw.weights, { allowEmpty: true });
    if (weightsPath && !existsSync(weightsPath)) {
      throw new HttpError(404, `File weights tidak ditemukan: ${raw.weights || ""}`);
    }

    const backend = this.choiceValue(raw.backend, new Set(["yolov5", "ultralytics"]), "backend");
    const identityMode = this.choiceValue(raw.identityMode, new Set(["reid", "face"]), "identityMode");

    return {
      input: displayPath(inputPath),
      outputDir: displayPath(outputDir),
      outputName: String(raw.outputName ?? "").trim(),
      roiJson: String(raw.roiJson ?? "").trim(),
      frameWidth: this.intValue(raw.frameWidth, { minimum: 1, fieldName: "frameWidth" }),
      frameHeight: this.intValue(raw.frameHeight, { minimum: 1, fieldName: "frameHeight" }),
      keepSourceSize: this.boolValue(raw.keepSourceSize),
      maxFrames: this.intValue(raw.maxFrames, { minimum: 0, fieldName: "maxFrames" }),
      maxSeconds: this.floatValue(raw.maxSeconds, { minimum: 0.0, fieldName: "maxSeconds" }),
      frameStep: this.intValue(raw.frameStep, { minimum: 1, fieldName: "frameStep" }),
      outputFps: this.floatValue(raw.outputFps, { minimum: 0.0, fieldName: "outputFps" }),
      imgSize: this.intValue(raw.imgSize, { minimum: 32, fieldName: "imgSize" }),
      forceCentroid: this.boolValue(raw.forceCentroid),
      maxAge: this.intValue(raw.maxAge, { minimum: 1, fieldName: "maxAge" }),
      nInit: this.intValue(raw.nInit, { minimum: 1, fieldName: "nInit" }),
      maxDistance: this.floatValue(raw.maxDistance, { minimum: 0.0, fieldName: "maxDistance" }),
      maxCosineDistance: this.floatValue(raw.maxCosineDistance, {
        minimum: 0.0,
        fieldName: "maxCosineDistance",
      }),
      identityMode,
      backend,
      weights: displayPath(weightsPath),
      device: String(raw.device ?? "auto").trim() || "auto",
      reidMatchThreshold: this.floatValue(raw.reidMatchThreshold, {
        minimum: 0.0,
        fieldName: "reidMatchThreshold",
      }),
      reidMinTrackFrames: this.intValue(raw.reidMinTrackFrames, {
        minimum: 1,
        fieldName: "reidMinTrackFrames",
      }),
      reidStrongMatchThreshold: this.floatValue(raw.reidStrongMatchThreshold, {
        minimum: 0.0,
        fieldName: "reidStrongMatchThreshold",
      }),
      reidAmbiguityMargin: this.floatValue(raw.reidAmbiguityMargin, {
        minimum: 0.0,
        fieldName: "reidAmbiguityMargin",
      }),
      reidPrototypeAlpha: this.floatValue(raw.reidPrototypeAlpha, {
        minimum: 0.0,
        fieldName: "reidPrototypeAlpha",
      }),
      withFaceRecognition: this.boolValue(raw.withFaceRecognition),
      faceIdMatchThreshold: this.floatValue(raw.faceIdMatchThreshold, {
        minimum: 0.0,
        fieldName: "faceIdMatchThreshold",
      }),
      faceIdMinTrackFrames: this.intValue(raw.faceIdMinTrackFrames, {
        minimum: 1,
        fieldName: "faceIdMinTrackFrames",
      }),
      faceIdStrongMatchThreshold: this.floatValue(raw.faceIdStrongMatchThreshold, {
        minimum: 0.0,
        fieldName: "faceIdStrongMatchThreshold",
      }),
      faceIdAmbiguityMargin: this.floatValue(raw.faceIdAmbiguityMargin, {
        minimum: 0.0,
        fieldName: "faceIdAmbiguityMargin",
      }),
      faceIdPrototypeAlpha: this.floatValue(raw.faceIdPrototypeAlpha, {
        minimum: 0.0,
        fieldName: "faceIdPrototypeAlpha",
      }),
    };
  }

  buildCommand(config) {
    const command = [
      this.pythonBin,
      this.runnerScript,
      "--input",
      config.input,
      "--output-dir",
      config.outputDir,
      "--frame-width",
      String(config.frameWidth),
      "--frame-height",
      String(config.frameHeight),
      "--max-frames",
      String(config.maxFrames),
      "--max-seconds",
      String(config.maxSeconds),
      "--frame-step",
      String(config.frameStep),
      "--output-fps",
      String(config.outputFps),
      "--img-size",
      String(config.imgSize),
      "--max-age",
      String(config.maxAge),
      "--n-init",
      String(config.nInit),
      "--max-distance",
      String(config.maxDistance),
      "--max-cosine-distance",
      String(config.maxCosineDistance),
      "--identity-mode",
      config.identityMode,
      "--backend",
      config.backend,
      "--device",
      config.device,
      "--reid-match-threshold",
      String(config.reidMatchThreshold),
      "--reid-min-track-frames",
      String(config.reidMinTrackFrames),
      "--reid-strong-match-threshold",
      String(config.reidStrongMatchThreshold),
      "--reid-ambiguity-margin",
      String(config.reidAmbiguityMargin),
      "--reid-prototype-alpha",
      String(config.reidPrototypeAlpha),
      "--face-id-match-threshold",
      String(config.faceIdMatchThreshold),
      "--face-id-min-track-frames",
      String(config.faceIdMinTrackFrames),
      "--face-id-strong-match-threshold",
      String(config.faceIdStrongMatchThreshold),
      "--face-id-ambiguity-margin",
      String(config.faceIdAmbiguityMargin),
      "--face-id-prototype-alpha",
      String(config.faceIdPrototypeAlpha),
    ];

    if (config.outputName) {
      command.push("--output-name", config.outputName);
    }
    if (config.roiJson) {
      command.push("--roi-json", config.roiJson);
    }
    if (config.keepSourceSize) {
      command.push("--keep-source-size");
    }
    if (config.forceCentroid) {
      command.push("--force-centroid");
    }
    if (config.weights) {
      command.push("--weights", config.weights);
    }
    if (config.withFaceRecognition) {
      command.push("--with-face-recognition");
    }
    return command.map((part) => String(part));
  }
}

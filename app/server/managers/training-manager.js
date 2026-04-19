/**
 * TrainingRunManager — mengelola proses training YOLO.
 */

import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  IMAGE_EXTENSIONS,
  LABEL_EXTENSIONS,
  LAB_DIR,
  PROJECT_DIR,
  WEIGHTS_EXTENSIONS,
} from "../constants.js";
import { HttpError } from "../errors.js";
import { fileSizeLabel, shellJoin, toLocalIso } from "../format.js";
import { discoverFiles, listTopLevelDirectories, listTopLevelFiles, recursiveFileStats } from "../files.js";
import { displayPath, encodePathQuery, pathInside, resolveProjectPath } from "../paths.js";
import { classNamesFromDataYaml, displayYamlValue, parseResultsCsvSummary, parseSimpleYamlObject } from "../parsers.js";
import { defaultTrainingFormData, trainingFormLayout } from "../forms/training-form.js";
import { BaseRunManager } from "./base-manager.js";

export class TrainingRunManager extends BaseRunManager {
  constructor({ projectDir, trainScript, pythonBin, defaultRunsDir }) {
    super();
    this.projectDir = path.resolve(projectDir);
    this.trainScript = path.resolve(trainScript);
    this.pythonBin = pythonBin;
    this.defaultRunsDir = path.resolve(defaultRunsDir);
    this.current = {
      jobId: 0,
      state: "idle",
      process: null,
      command: [],
      commandDisplay: "",
      config: {},
      outputDir: null,
      activeRunName: "",
      startedAt: null,
      finishedAt: null,
      returnCode: null,
      stopRequested: false,
      logs: [],
      error: null,
    };
  }

  configPayload() {
    const defaults = defaultTrainingFormData();
    const suggestions = {
      framesDir: [defaults.framesDir],
      labelsDir: [defaults.labelsDir],
      datasetDir: [defaults.datasetDir],
      runsDir: [defaults.runsDir],
      trainModel: discoverFiles(
        [path.join(this.projectDir, "edge"), path.join(LAB_DIR, "train", "runs")],
        WEIGHTS_EXTENSIONS,
      ),
    };

    let preview = { config: defaults, command: [], commandDisplay: "" };
    try {
      preview = this.preview(defaults);
    } catch {
      preview = { config: defaults, command: [], commandDisplay: "" };
    }

    return {
      layout: trainingFormLayout(),
      defaults,
      paths: {
        projectDir: this.projectDir,
        trainScript: displayPath(this.trainScript),
        pythonBin: path.isAbsolute(this.pythonBin) ? displayPath(this.pythonBin) : this.pythonBin,
        defaultRunsDir: displayPath(this.defaultRunsDir),
      },
      suggestions,
      preview,
      runtimeWarnings: this.runtimeWarnings(defaults),
      job: this.snapshot(defaults),
    };
  }

  runtimeWarnings(defaults = defaultTrainingFormData()) {
    const warnings = [];
    if (!existsSync(this.trainScript)) {
      warnings.push(`Script training tidak ditemukan: ${this.trainScript}`);
    }
    if (path.isAbsolute(this.pythonBin) && !existsSync(this.pythonBin)) {
      warnings.push(`Python edge tidak ditemukan: ${this.pythonBin}`);
    }

    const framesDir = resolveProjectPath(defaults.framesDir);
    if (!existsSync(framesDir)) {
      warnings.push(`Folder frame tidak ditemukan: ${displayPath(framesDir)}`);
    }

    const labelsDir = resolveProjectPath(defaults.labelsDir);
    if (!existsSync(labelsDir)) {
      warnings.push(`Folder label tidak ditemukan: ${displayPath(labelsDir)}`);
    }

    const trainModel = resolveProjectPath(defaults.trainModel, { allowEmpty: true });
    if (trainModel && !existsSync(trainModel)) {
      warnings.push(`Model training default belum ditemukan: ${displayPath(trainModel)}`);
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
      throw new HttpError(409, "Masih ada proses training yang berjalan. Stop dulu sebelum mulai run baru.");
    }

    const runsDir = resolveProjectPath(config.runsDir);
    mkdirSync(runsDir, { recursive: true });

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
      outputDir: runsDir,
      activeRunName: config.runName,
      startedAt: Date.now(),
      finishedAt: null,
      returnCode: null,
      stopRequested: false,
      logs: [
        "[app] Menjalankan prepare + training YOLO.",
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
        this.appendLog(`[app] Proses training dihentikan. Return code: ${this.current.returnCode}`);
      } else if (this.current.returnCode === 0) {
        this.current.state = "finished";
        this.appendLog("[app] Prepare + training selesai tanpa error.");
      } else {
        this.current.state = "failed";
        this.current.error = `Training berhenti dengan kode ${this.current.returnCode}.`;
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
      this.current.error = `Gagal menjalankan training: ${error.message}`;
      this.appendLog(this.current.error);
    });

    return this.snapshot(config);
  }

  stop() {
    if (!this.isRunning() || !this.current.process) {
      throw new HttpError(409, "Tidak ada proses training yang sedang berjalan.");
    }

    const processRef = this.current.process;
    this.current.stopRequested = true;
    this.appendLog("[app] Mengirim sinyal stop ke proses training...");
    processRef.kill("SIGTERM");
    setTimeout(() => {
      if (processRef.exitCode === null && !processRef.killed) {
        processRef.kill("SIGKILL");
      }
    }, 5000).unref?.();

    return this.snapshot();
  }

  snapshot(baseConfig = null) {
    const fallbackConfig = baseConfig || (Object.keys(this.current.config).length ? this.current.config : defaultTrainingFormData());
    const runsDir = resolveProjectPath(this.current.outputDir ? displayPath(this.current.outputDir) : fallbackConfig.runsDir);
    const runs = this.listRunSummaries(runsDir);

    return {
      jobId: this.current.jobId,
      state: this.current.state,
      running: this.isRunning(),
      command: [...this.current.command],
      commandDisplay: this.current.commandDisplay,
      config: { ...this.current.config },
      outputDir: displayPath(this.current.outputDir),
      activeRunName: this.current.activeRunName,
      startedAt: toLocalIso(this.current.startedAt),
      finishedAt: toLocalIso(this.current.finishedAt),
      durationSeconds: this.durationSeconds(),
      returnCode: this.current.returnCode,
      stopRequested: this.current.stopRequested,
      logs: [...this.current.logs],
      error: this.current.error,
      workspace: this.workspaceSnapshot(fallbackConfig, runs),
      runs,
    };
  }

  workspaceSnapshot(config, runs = null) {
    const raw = { ...defaultTrainingFormData(), ...(config || {}) };
    const framesDir = resolveProjectPath(raw.framesDir);
    const labelsDir = resolveProjectPath(raw.labelsDir);
    const datasetDir = resolveProjectPath(raw.datasetDir);
    const runsDir = resolveProjectPath(raw.runsDir);
    const datasetRuns = Array.isArray(runs) ? runs : this.listRunSummaries(runsDir);
    const datasetClassNames = classNamesFromDataYaml(datasetDir);
    const classNames = datasetClassNames.length ? datasetClassNames : this.parseClassNames(raw.classNames);

    return {
      framesDir: displayPath(framesDir),
      labelsDir: displayPath(labelsDir),
      datasetDir: displayPath(datasetDir),
      runsDir: displayPath(runsDir),
      frameCount: listTopLevelFiles(framesDir, IMAGE_EXTENSIONS).length,
      labelCount: listTopLevelFiles(labelsDir, LABEL_EXTENSIONS).length,
      datasetTrainImages: listTopLevelFiles(path.join(datasetDir, "images", "train"), IMAGE_EXTENSIONS).length,
      datasetValImages: listTopLevelFiles(path.join(datasetDir, "images", "val"), IMAGE_EXTENSIONS).length,
      datasetTrainLabels: listTopLevelFiles(path.join(datasetDir, "labels", "train"), LABEL_EXTENSIONS).length,
      datasetValLabels: listTopLevelFiles(path.join(datasetDir, "labels", "val"), LABEL_EXTENSIONS).length,
      dataYamlExists: existsSync(path.join(datasetDir, "data.yaml")),
      classNames,
      runCount: datasetRuns.length,
      latestRunName: datasetRuns[0]?.key || null,
      latestRunAt: datasetRuns[0]?.updatedAt || null,
    };
  }

  listRunSummaries(runsDir) {
    if (!runsDir || !existsSync(runsDir) || !statSync(runsDir).isDirectory()) {
      return [];
    }

    return listTopLevelDirectories(runsDir)
      .map((runDir) => this.runSummary(runDir))
      .sort((left, right) => right.updatedMs - left.updatedMs);
  }

  runSummary(runDir) {
    const stats = recursiveFileStats(runDir);
    const argsYamlPath = path.join(runDir, "args.yaml");
    const resultsCsvPath = path.join(runDir, "results.csv");
    const args = parseSimpleYamlObject(argsYamlPath) || {};

    return {
      key: path.basename(runDir),
      path: displayPath(runDir),
      updatedMs: stats.updatedMs,
      updatedAt: toLocalIso(stats.updatedMs),
      fileCount: stats.fileCount,
      totalSizeBytes: stats.totalSizeBytes,
      totalSizeLabel: fileSizeLabel(stats.totalSizeBytes),
      metrics: parseResultsCsvSummary(resultsCsvPath),
      config: {
        model: displayYamlValue(args.model) || "-",
        data: displayYamlValue(args.data) || "-",
        epochs: args.epochs ?? null,
        batch: args.batch ?? null,
        imgsz: args.imgsz ?? null,
        device: displayYamlValue(args.device) || "-",
        workers: args.workers ?? null,
        patience: args.patience ?? null,
      },
      artifacts: {
        bestWeights: existsSync(path.join(runDir, "weights", "best.pt"))
          ? this.artifactPayload(path.join(runDir, "weights", "best.pt"))
          : null,
        lastWeights: existsSync(path.join(runDir, "weights", "last.pt"))
          ? this.artifactPayload(path.join(runDir, "weights", "last.pt"))
          : null,
        resultsCsv: existsSync(resultsCsvPath) ? this.artifactPayload(resultsCsvPath) : null,
        argsYaml: existsSync(argsYamlPath) ? this.artifactPayload(argsYamlPath) : null,
      },
      previewArtifacts: [
        path.join(runDir, "results.png"),
        path.join(runDir, "confusion_matrix.png"),
        path.join(runDir, "labels.jpg"),
      ]
        .filter((artifactPath) => existsSync(artifactPath))
        .map((artifactPath) => this.artifactPayload(artifactPath)),
    };
  }

  artifactPayload(targetPath) {
    const stats = statSync(targetPath);
    const resolvedPath = path.resolve(targetPath);
    const relativePath = displayPath(resolvedPath);
    const downloadUrl = pathInside(resolvedPath, PROJECT_DIR)
      ? `/api/train/artifact?path=${encodePathQuery(relativePath)}`
      : null;

    return {
      name: path.basename(targetPath),
      path: relativePath,
      parent: displayPath(path.dirname(resolvedPath)),
      sizeBytes: stats.size,
      sizeLabel: fileSizeLabel(stats.size),
      modifiedAt: toLocalIso(stats.mtimeMs),
      downloadUrl,
    };
  }

  parseClassNames(value) {
    const cleaned = String(value ?? "")
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    return cleaned.length ? cleaned : ["person"];
  }

  normalizePayload(payload, { validatePaths = false } = {}) {
    const raw = { ...defaultTrainingFormData(), ...(payload || {}) };

    const framesDir = resolveProjectPath(raw.framesDir);
    const labelsDir = resolveProjectPath(raw.labelsDir);
    const datasetDir = resolveProjectPath(raw.datasetDir);
    const runsDir = resolveProjectPath(raw.runsDir);
    const trainModel = resolveProjectPath(raw.trainModel, { allowEmpty: true });

    if (validatePaths) {
      if (!existsSync(framesDir) || !statSync(framesDir).isDirectory()) {
        throw new HttpError(404, `Folder frame tidak ditemukan: ${raw.framesDir || ""}`);
      }
      if (!existsSync(labelsDir) || !statSync(labelsDir).isDirectory()) {
        throw new HttpError(404, `Folder label tidak ditemukan: ${raw.labelsDir || ""}`);
      }
      if (trainModel && !existsSync(trainModel)) {
        throw new HttpError(404, `Model training tidak ditemukan: ${raw.trainModel || ""}`);
      }
    }

    const classNames = this.parseClassNames(raw.classNames);

    return {
      framesDir: displayPath(framesDir),
      labelsDir: displayPath(labelsDir),
      datasetDir: displayPath(datasetDir),
      runsDir: displayPath(runsDir),
      classNames,
      trainModel: trainModel ? displayPath(trainModel) : "",
      imgsz: this.intValue(raw.imgsz, { minimum: 32, fieldName: "imgsz" }),
      epochs: this.intValue(raw.epochs, { minimum: 1, fieldName: "epochs" }),
      batch: this.intValue(raw.batch, { minimum: 1, fieldName: "batch" }),
      workers: this.intValue(raw.workers, { minimum: 0, fieldName: "workers" }),
      patience: this.intValue(raw.patience, { minimum: 0, fieldName: "patience" }),
      valRatio: this.floatValue(raw.valRatio, { minimum: 0.0, maximum: 0.95, fieldName: "valRatio" }),
      seed: this.intValue(raw.seed, { fieldName: "seed" }),
      device: String(raw.device ?? "auto").trim() || "auto",
      runName: String(raw.runName ?? "").trim(),
      allowEmptyLabels: this.boolValue(raw.allowEmptyLabels),
      cache: this.boolValue(raw.cache),
    };
  }

  buildCommand(config) {
    const command = [
      this.pythonBin,
      this.trainScript,
      "prepare-train",
      "--frames-dir",
      config.framesDir,
      "--labels-dir",
      config.labelsDir,
      "--dataset-dir",
      config.datasetDir,
      "--runs-dir",
      config.runsDir,
      "--val-ratio",
      String(config.valRatio),
      "--seed",
      String(config.seed),
      "--imgsz",
      String(config.imgsz),
      "--epochs",
      String(config.epochs),
      "--batch",
      String(config.batch),
      "--workers",
      String(config.workers),
      "--patience",
      String(config.patience),
      "--device",
      config.device,
    ];

    for (const className of config.classNames) {
      command.push("--class-name", className);
    }
    if (config.trainModel) {
      command.push("--model", config.trainModel);
    }
    if (config.runName) {
      command.push("--run-name", config.runName);
    }
    if (config.allowEmptyLabels) {
      command.push("--allow-empty-labels");
    }
    if (config.cache) {
      command.push("--cache");
    }

    return command.map((part) => String(part));
  }
}

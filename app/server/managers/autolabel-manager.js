/**
 * AutolabelRunManager — mengelola proses auto-label untuk labeler.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { LAB_DIR, PROJECT_DIR, WEIGHTS_EXTENSIONS } from "../constants.js";
import { HttpError } from "../errors.js";
import { shellJoin, toLocalIso } from "../format.js";
import { defaultLabelerAutolabelConfig } from "../forms/training-form.js";
import { discoverFiles } from "../files.js";
import { displayPath, resolveProjectPath } from "../paths.js";
import { BaseRunManager } from "./base-manager.js";

function isPathLike(value) {
  return value.startsWith(".") || value.includes("/") || value.includes("\\");
}

export class AutolabelRunManager extends BaseRunManager {
  constructor({ projectDir, trainScript, pythonBin }) {
    super();
    this.projectDir = path.resolve(projectDir);
    this.trainScript = path.resolve(trainScript);
    this.pythonBin = pythonBin;
    this.current = {
      jobId: 0,
      state: "idle",
      process: null,
      command: [],
      commandDisplay: "",
      config: {},
      framesDir: null,
      labelsDir: null,
      targetMode: "",
      targetImage: "",
      startedAt: null,
      finishedAt: null,
      returnCode: null,
      stopRequested: false,
      logs: [],
      error: null,
    };
  }

  configPayload(defaultOverrides = {}) {
    const defaults = {
      ...defaultLabelerAutolabelConfig(),
      ...(defaultOverrides || {}),
    };
    return {
      defaults,
      suggestions: {
        model: discoverFiles(
          [
            path.join(this.projectDir, "model"),
            path.join(this.projectDir, "edge"),
            path.join(LAB_DIR, "train", "runs"),
          ],
          WEIGHTS_EXTENSIONS,
        ),
      },
      runtimeWarnings: this.runtimeWarnings(defaults),
      job: this.snapshot(defaults),
    };
  }

  runtimeWarnings(config = defaultLabelerAutolabelConfig()) {
    const warnings = [];
    if (!existsSync(this.trainScript)) {
      warnings.push(`Script training tidak ditemukan: ${this.trainScript}`);
    }
    if (path.isAbsolute(this.pythonBin) && !existsSync(this.pythonBin)) {
      warnings.push(`Python edge tidak ditemukan: ${this.pythonBin}`);
    }

    const modelSource = String(config.model || "").trim();
    if (modelSource && isPathLike(modelSource)) {
      const modelPath = resolveProjectPath(modelSource, { allowEmpty: true });
      if (modelPath && !existsSync(modelPath)) {
        warnings.push(`Model auto-label belum ditemukan: ${displayPath(modelPath)}`);
      }
    }

    return warnings;
  }

  normalizePayload(payload) {
    const defaults = defaultLabelerAutolabelConfig();
    const raw = { ...defaults, ...(payload || {}) };

    const model = String(raw.model ?? "").trim();
    if (!model) {
      throw new HttpError(400, "Model auto-label wajib diisi.");
    }

    const conf = Number.parseFloat(String(raw.conf ?? defaults.conf));
    if (!Number.isFinite(conf) || conf <= 0 || conf >= 1) {
      throw new HttpError(400, "`conf` auto-label harus berada di rentang 0..1.");
    }

    const iou = Number.parseFloat(String(raw.iou ?? defaults.iou));
    if (!Number.isFinite(iou) || iou <= 0 || iou >= 1) {
      throw new HttpError(400, "`iou` auto-label harus berada di rentang 0..1.");
    }

    const imgsz = Number.parseInt(String(raw.imgsz ?? defaults.imgsz), 10);
    if (!Number.isFinite(imgsz) || imgsz < 32) {
      throw new HttpError(400, "`imgsz` auto-label minimal 32.");
    }

    const suppressNestedDuplicates = this.boolValue(raw.suppressNestedDuplicates);
    const duplicateContainmentThreshold = Number.parseFloat(
      String(raw.duplicateContainmentThreshold ?? defaults.duplicateContainmentThreshold),
    );
    if (
      !Number.isFinite(duplicateContainmentThreshold)
      || duplicateContainmentThreshold <= 0
      || duplicateContainmentThreshold > 1
    ) {
      throw new HttpError(400, "`duplicateContainmentThreshold` harus berada di rentang > 0 sampai 1.");
    }

    const device = String(raw.device ?? defaults.device ?? "auto").trim() || "auto";
    return {
      model,
      conf,
      iou,
      imgsz,
      device,
      suppressNestedDuplicates,
      duplicateContainmentThreshold,
    };
  }

  buildCommand(config, { framesDir, labelsDir, imageName = "", overwriteLabels = false } = {}) {
    const command = [
      this.pythonBin,
      this.trainScript,
      "autolabel",
      "--frames-dir",
      displayPath(framesDir),
      "--labels-dir",
      displayPath(labelsDir),
      "--model",
      config.model,
      "--conf",
      String(config.conf),
      "--iou",
      String(config.iou),
      "--imgsz",
      String(config.imgsz),
      "--device",
      config.device,
      "--duplicate-containment-threshold",
      String(config.duplicateContainmentThreshold),
    ];

    command.push(
      config.suppressNestedDuplicates
        ? "--suppress-nested-duplicates"
        : "--no-suppress-nested-duplicates",
    );

    if (imageName) {
      command.push("--image-name", path.basename(imageName));
    }

    if (overwriteLabels) {
      command.push("--overwrite-labels");
    }

    return command;
  }

  startImage(payload, { framesDir, labelsDir, imageName }) {
    return this.start(payload, {
      framesDir,
      labelsDir,
      imageName,
      targetMode: "current",
      overwriteLabels: true,
      initialMessage: `[app] Menjalankan auto-label untuk frame ${path.basename(imageName)}.`,
    });
  }

  startAll(payload, { framesDir, labelsDir }) {
    return this.start(payload, {
      framesDir,
      labelsDir,
      imageName: "",
      targetMode: "all",
      overwriteLabels: false,
      initialMessage:
        "[app] Menjalankan auto-label untuk semua frame. Label yang sudah ada akan dipertahankan.",
    });
  }

  start(payload, { framesDir, labelsDir, imageName = "", targetMode, overwriteLabels, initialMessage }) {
    const config = this.normalizePayload(payload);
    const command = this.buildCommand(config, {
      framesDir,
      labelsDir,
      imageName,
      overwriteLabels,
    });

    if (!existsSync(this.trainScript)) {
      throw new HttpError(404, `Script training tidak ditemukan: ${this.trainScript}`);
    }
    if (path.isAbsolute(this.pythonBin) && !existsSync(this.pythonBin)) {
      throw new HttpError(404, `Python edge tidak ditemukan: ${this.pythonBin}`);
    }
    if (this.isRunning()) {
      throw new HttpError(409, "Masih ada proses auto-label yang berjalan. Tunggu sampai selesai.");
    }

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
      framesDir: path.resolve(framesDir),
      labelsDir: path.resolve(labelsDir),
      targetMode,
      targetImage: imageName ? path.basename(imageName) : "",
      startedAt: Date.now(),
      finishedAt: null,
      returnCode: null,
      stopRequested: false,
      logs: [
        initialMessage,
        `$ ${shellJoin(command)}`,
      ],
      error: null,
    };
    this.emitSnapshot();

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
        this.appendLog(`[app] Proses auto-label dihentikan. Return code: ${this.current.returnCode}`);
      } else if (this.current.returnCode === 0) {
        this.current.state = "finished";
        this.appendLog("[app] Auto-label selesai tanpa error.");
      } else {
        this.current.state = "failed";
        this.current.error = `Auto-label berhenti dengan kode ${this.current.returnCode}.`;
        this.appendLog(this.current.error);
      }
      this.emitSnapshot();
    });

    child.on("error", (error) => {
      if (this.current.jobId !== jobId) {
        return;
      }
      this.current.process = null;
      this.current.finishedAt = Date.now();
      this.current.state = "failed";
      this.current.returnCode = 1;
      this.current.error = `Gagal menjalankan auto-label: ${error.message}`;
      this.appendLog(this.current.error);
      this.emitSnapshot();
    });

    return this.snapshot(config);
  }

  stop() {
    if (!this.isRunning() || !this.current.process) {
      throw new HttpError(409, "Tidak ada proses auto-label yang sedang berjalan.");
    }

    const processRef = this.current.process;
    this.current.stopRequested = true;
    this.appendLog("[app] Mengirim sinyal stop ke proses auto-label...");
    this.emitSnapshot();
    processRef.kill("SIGTERM");
    setTimeout(() => {
      if (processRef.exitCode === null && !processRef.killed) {
        processRef.kill("SIGKILL");
      }
    }, 5000).unref?.();

    return this.snapshot();
  }

  snapshot(defaultConfig = null) {
    const fallbackConfig =
      defaultConfig || (Object.keys(this.current.config).length ? this.current.config : defaultLabelerAutolabelConfig());

    return {
      jobId: this.current.jobId,
      state: this.current.state,
      running: this.isRunning(),
      command: [...this.current.command],
      commandDisplay: this.current.commandDisplay,
      config: { ...(Object.keys(this.current.config).length ? this.current.config : fallbackConfig) },
      framesDir: displayPath(this.current.framesDir),
      labelsDir: displayPath(this.current.labelsDir),
      targetMode: this.current.targetMode,
      targetImage: this.current.targetImage,
      startedAt: toLocalIso(this.current.startedAt),
      finishedAt: toLocalIso(this.current.finishedAt),
      durationSeconds: this.durationSeconds(),
      returnCode: this.current.returnCode,
      stopRequested: this.current.stopRequested,
      logs: [...this.current.logs],
      error: this.current.error,
    };
  }
}

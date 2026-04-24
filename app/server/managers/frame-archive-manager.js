/**
 * FrameArchiveManager — membuat dan mengimpor bundle zip `frames/` + `labels/`
 * sesuai format labeler project ini.
 */

import {
  existsSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IMAGE_EXTENSIONS } from "../constants.js";
import { HttpError } from "../errors.js";
import { listTopLevelFiles } from "../files.js";
import { displayPath, pathInside } from "../paths.js";

const MANAGER_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRAME_ARCHIVE_SCRIPT = path.join(MANAGER_DIR, "..", "scripts", "frame-archive.py");
const ARCHIVE_EXTENSION = ".zip";
const ARCHIVE_MANIFEST_FILE = "yolo-lab-frame-archive.json";

function normalizeSubdir(value, fieldName) {
  const normalized = String(value || "").trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized === ".") {
    return "";
  }
  if (normalized.includes("/")) {
    throw new HttpError(
      400,
      `Field \`${fieldName}\` hanya boleh root atau satu subfolder langsung di bawah train/frames.`,
    );
  }
  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new HttpError(
      400,
      `Field \`${fieldName}\` hanya boleh berisi huruf, angka, titik, strip, dan underscore.`,
    );
  }
  return normalized;
}

function safeArchiveStem(value) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "root";
}

function timeStampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "_",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function parseManagerJson(stdout, fallbackMessage) {
  try {
    const payload = JSON.parse(String(stdout || "{}").trim() || "{}");
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Payload bukan object.");
    }
    return payload;
  } catch (error) {
    throw new HttpError(500, `${fallbackMessage}: ${error.message}`);
  }
}

function ensureBundleFile(file) {
  if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function") {
    throw new HttpError(400, "Pilih satu file bundle zip sebelum import.");
  }
  const originalName = path.basename(String(file.name || "").trim()) || "labeler-bundle.zip";
  if (path.extname(originalName).toLowerCase() !== ARCHIVE_EXTENSION) {
    throw new HttpError(400, "Format bundle harus berupa file `.zip`.");
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new HttpError(400, "File bundle zip kosong atau tidak valid.");
  }
  return originalName;
}

export class FrameArchiveManager {
  constructor({
    projectDir,
    framesRootDir,
    labelsRootDir,
    pythonBin,
  }) {
    this.projectDir = path.resolve(projectDir);
    this.framesRootDir = path.resolve(framesRootDir);
    this.labelsRootDir = path.resolve(labelsRootDir);
    this.pythonBin = pythonBin;
  }

  assertRuntimeReady() {
    if (!existsSync(FRAME_ARCHIVE_SCRIPT)) {
      throw new HttpError(500, `Script archive tidak ditemukan: ${FRAME_ARCHIVE_SCRIPT}`);
    }
    if (path.isAbsolute(this.pythonBin) && !existsSync(this.pythonBin)) {
      throw new HttpError(404, `Python edge tidak ditemukan: ${this.pythonBin}`);
    }
  }

  framesSubdirFor(framesDir) {
    const resolvedFramesDir = path.resolve(framesDir);
    if (!pathInside(resolvedFramesDir, this.framesRootDir)) {
      throw new HttpError(400, "Folder frame aktif berada di luar workspace frames root.");
    }
    const relative = path.relative(this.framesRootDir, resolvedFramesDir);
    return normalizeSubdir(relative, "framesSubdir");
  }

  exportArchive({
    framesDir,
    labelsDir,
    classNames = [],
    checkpointImage = null,
  }) {
    this.assertRuntimeReady();

    const resolvedFramesDir = path.resolve(framesDir);
    const resolvedLabelsDir = path.resolve(labelsDir);
    if (!existsSync(resolvedFramesDir) || !statSync(resolvedFramesDir).isDirectory()) {
      throw new HttpError(404, `Folder frame tidak ditemukan: ${displayPath(resolvedFramesDir)}`);
    }
    if (!existsSync(resolvedLabelsDir) || !statSync(resolvedLabelsDir).isDirectory()) {
      throw new HttpError(404, `Folder label tidak ditemukan: ${displayPath(resolvedLabelsDir)}`);
    }
    if (!pathInside(resolvedFramesDir, this.framesRootDir)) {
      throw new HttpError(400, "Folder frame aktif berada di luar workspace frames root.");
    }
    if (!pathInside(resolvedLabelsDir, this.labelsRootDir)) {
      throw new HttpError(400, "Folder label aktif berada di luar workspace labels root.");
    }

    const framesSubdir = this.framesSubdirFor(resolvedFramesDir);
    const labelsSubdir = normalizeSubdir(path.relative(this.labelsRootDir, resolvedLabelsDir), "labelsSubdir");
    const imageCount = listTopLevelFiles(resolvedFramesDir, IMAGE_EXTENSIONS).length;
    if (!imageCount) {
      throw new HttpError(400, "Folder frame aktif kosong. Tidak ada frame yang bisa diexport.");
    }

    const tempDir = mkdtempSync(path.join(tmpdir(), "yolo-lab-frame-export-"));
    const archiveName = `yolo-lab-frames-${safeArchiveStem(framesSubdir)}-${timeStampForFile()}.zip`;
    const archivePath = path.join(tempDir, archiveName);
    const metadata = {
      exportedAt: new Date().toISOString(),
      framesSubdir,
      labelsSubdir,
      framesDir: displayPath(resolvedFramesDir),
      labelsDir: displayPath(resolvedLabelsDir),
      classNames: Array.isArray(classNames) ? classNames : [],
      checkpointImage: typeof checkpointImage === "string" && checkpointImage.trim()
        ? checkpointImage.trim()
        : null,
    };

    const result = spawnSync(
      this.pythonBin,
      [
        FRAME_ARCHIVE_SCRIPT,
        "export",
        resolvedFramesDir,
        resolvedLabelsDir,
        archivePath,
        JSON.stringify(metadata),
      ],
      {
        cwd: this.projectDir,
        encoding: "utf8",
        stdio: "pipe",
      },
    );

    if (result.status !== 0) {
      rmSync(tempDir, { recursive: true, force: true });
      const message = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      throw new HttpError(500, message || "Gagal membuat bundle zip frame-label.");
    }

    const payload = parseManagerJson(result.stdout, "Gagal membaca hasil export bundle");
    return {
      ...payload,
      manifestFile: payload.manifestFile || ARCHIVE_MANIFEST_FILE,
      archiveName,
      archivePath,
      tempDir,
      framesDir: displayPath(resolvedFramesDir),
      labelsDir: displayPath(resolvedLabelsDir),
      framesSubdir,
      labelsSubdir,
    };
  }

  async importArchive(formData) {
    this.assertRuntimeReady();

    const archiveFile = formData.get("archive");
    const originalName = ensureBundleFile(archiveFile);
    const targetSubdir = normalizeSubdir(formData.get("targetSubdir") || "", "targetSubdir");

    const tempDir = mkdtempSync(path.join(tmpdir(), "yolo-lab-frame-import-"));
    const tempArchivePath = path.join(tempDir, `${randomUUID()}${ARCHIVE_EXTENSION}`);

    try {
      writeFileSync(tempArchivePath, Buffer.from(await archiveFile.arrayBuffer()));

      const result = spawnSync(
        this.pythonBin,
        [
          FRAME_ARCHIVE_SCRIPT,
          "import",
          tempArchivePath,
          this.framesRootDir,
          this.labelsRootDir,
          targetSubdir,
        ],
        {
          cwd: this.projectDir,
          encoding: "utf8",
          stdio: "pipe",
        },
      );

      if (result.status !== 0) {
        const message = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
        throw new HttpError(400, message || "Gagal mengimpor bundle zip frame-label.");
      }

      const payload = parseManagerJson(result.stdout, "Gagal membaca hasil import bundle");
      const importedSubdir = normalizeSubdir(payload.framesSubdir || "", "framesSubdir");
      const framesDir = path.join(this.framesRootDir, importedSubdir);
      const labelsDir = path.join(this.labelsRootDir, importedSubdir);

      return {
        ...payload,
        archiveName: originalName,
        framesDir: displayPath(framesDir),
        labelsDir: displayPath(labelsDir),
        framesSubdir: importedSubdir,
        sourceFramesSubdir: normalizeSubdir(payload.sourceFramesSubdir || "", "sourceFramesSubdir"),
      };
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

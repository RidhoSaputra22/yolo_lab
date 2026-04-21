/**
 * Konstanta global YOLO Lab server.
 *
 * Semua default path, extension set, threshold, dan content-type map
 * dikumpulkan di sini agar mudah di-import dari modul lain.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Directory landmarks ─────────────────────────────────────────────
export const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
export const APP_DIR = path.dirname(MODULE_DIR);
export const LAB_DIR = path.dirname(APP_DIR);
export const PROJECT_DIR = LAB_DIR;
export const DATABASE_DIR = path.join(APP_DIR, "database");
export const STATIC_DIR = path.join(APP_DIR, "static");
export const REACT_MODULES_DIR = path.join(STATIC_DIR, "react");
export const REACT_SHELL_PATH = path.join(APP_DIR, "index.html");
export const REACT_BUILD_SCRIPT = path.join(APP_DIR, "build-react.mjs");
export const DOTENV_PATH = path.join(LAB_DIR, ".env");

// ── Default runner / data paths ─────────────────────────────────────
export const DEFAULT_TEST_RUNNER = path.join(LAB_DIR, "test", "run_video_tracking.py");
export const DEFAULT_TRAIN_RUNNER = path.join(LAB_DIR, "train", "yolo_train.py");
export const DEFAULT_TEST_OUTPUT_DIR = path.join(LAB_DIR, "test", "output");
export const DEFAULT_TRAIN_OUTPUT_DIR = path.join(LAB_DIR, "train", "runs");
export const DEFAULT_TEST_INPUT_DIR = path.join(LAB_DIR, "train", "footage");
export const DEFAULT_FRAMES_DIR = path.join(LAB_DIR, "train", "frames");
export const DEFAULT_LABELS_DIR = path.join(LAB_DIR, "train", "labels");
export const DEFAULT_DATASET_DIR = path.join(LAB_DIR, "train", "dataset");
export const DEFAULT_EDGE_PYTHON = path.join(LAB_DIR, "edge", ".venv", "bin", "python");

// ── Model / inference defaults ──────────────────────────────────────
export const EDGE_REFERENCE_SIZE = { width: 1280, height: 720 };
export const DEFAULT_FACE_ID_MATCH_THRESHOLD = 0.55;
export const DEFAULT_FACE_ID_MIN_TRACK_FRAMES = 3;
export const DEFAULT_FACE_ID_STRONG_MATCH_THRESHOLD = 0.65;
export const DEFAULT_FACE_ID_AMBIGUITY_MARGIN = 0.03;
export const DEFAULT_FACE_ID_PROTOTYPE_ALPHA = 0.18;

// ── Extension sets ──────────────────────────────────────────────────
export const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".bmp", ".webp"]);
export const VIDEO_EXTENSIONS = new Set([".mp4", ".avi", ".mov", ".mkv", ".webm"]);
export const WEIGHTS_EXTENSIONS = new Set([".pt", ".onnx", ".engine"]);
export const ARTIFACT_EXTENSIONS = new Set([".mp4", ".csv", ".json"]);
export const LABEL_EXTENSIONS = new Set([".txt"]);

// ── Limits ──────────────────────────────────────────────────────────
export const MAX_LOG_LINES = 500;
export const MAX_DISCOVERY_ITEMS = 48;

// ── Misc ────────────────────────────────────────────────────────────
export const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export const STATIC_CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
};

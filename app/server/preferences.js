/**
 * Penyimpanan preferensi per halaman dalam file JSON di `app/database`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DATABASE_DIR } from "./constants.js";
import { HttpError } from "./errors.js";

export const PAGE_PREFERENCE_FILES = Object.freeze({
  labeler: "labeler.json",
  footage: "footage.json",
  tester: "tester.json",
  training: "training.json",
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export class PagePreferenceStore {
  constructor(databaseDir = DATABASE_DIR) {
    this.databaseDir = path.resolve(databaseDir);
  }

  normalizePageName(pageName) {
    const normalized = String(pageName || "").trim().toLowerCase();
    if (!normalized || !Object.hasOwn(PAGE_PREFERENCE_FILES, normalized)) {
      throw new HttpError(400, `Halaman preference tidak dikenal: ${pageName || "-"}.`);
    }
    return normalized;
  }

  filePath(pageName) {
    const normalized = this.normalizePageName(pageName);
    mkdirSync(this.databaseDir, { recursive: true });
    return path.join(this.databaseDir, PAGE_PREFERENCE_FILES[normalized]);
  }

  read(pageName) {
    const filePath = this.filePath(pageName);
    if (!existsSync(filePath)) {
      return {};
    }

    try {
      const payload = JSON.parse(readFileSync(filePath, "utf8") || "{}");
      return isPlainObject(payload) ? payload : {};
    } catch {
      return {};
    }
  }

  write(pageName, values) {
    const normalized = this.normalizePageName(pageName);
    const filePath = this.filePath(normalized);
    const payload = isPlainObject(values) ? values : {};
    writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return {
      page: normalized,
      path: filePath,
      values: payload,
    };
  }
}

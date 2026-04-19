/**
 * Dotenv reader & environment value resolver.
 */

import { existsSync, readFileSync } from "node:fs";
import { DOTENV_PATH } from "./constants.js";

export function loadDotenvDefaults(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const values = {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !rawLine.includes("=")) {
      continue;
    }

    const separatorIndex = rawLine.indexOf("=");
    const key = rawLine.slice(0, separatorIndex).trim();
    let value = rawLine.slice(separatorIndex + 1).replace(/\s+#.*$/, "").trim();
    if (value.length >= 2 && value[0] === value.at(-1) && (value[0] === '"' || value[0] === "'")) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

const DOTENV_DEFAULTS = loadDotenvDefaults(DOTENV_PATH);

export function envValue(name, fallback) {
  const direct = process.env[name];
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  const dotenvValue = DOTENV_DEFAULTS[name];
  if (typeof dotenvValue === "string" && dotenvValue.trim()) {
    return dotenvValue.trim();
  }
  return String(fallback ?? "").trim();
}

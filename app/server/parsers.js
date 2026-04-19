/**
 * Parser: simple YAML, results CSV, class names dari data.yaml.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { displayPath } from "./paths.js";

export function parseYamlScalar(rawValue) {
  let value = String(rawValue ?? "").trim();
  if (!value || value === "null") {
    return null;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (value.length >= 2 && value[0] === value.at(-1) && (value[0] === '"' || value[0] === "'")) {
    value = value.slice(1, -1);
  }
  if (/^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  if (/^-?(?:\d+\.\d*|\d*\.\d+)(?:e[-+]?\d+)?$/i.test(value)) {
    return Number.parseFloat(value);
  }
  return value;
}

export function parseSimpleYamlObject(filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return null;
  }

  const payload = {};
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || rawLine.startsWith(" ") || rawLine.startsWith("\t")) {
      continue;
    }
    if (!trimmed.includes(":")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    payload[key] = parseYamlScalar(rawValue);
  }

  return payload;
}

export function displayYamlValue(value) {
  if (typeof value === "string" && path.isAbsolute(value)) {
    return displayPath(value);
  }
  return value;
}

export function parseResultsCsvSummary(filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return null;
  }

  const lines = readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return null;
  }

  const headers = lines[0].split(",");
  let lastRow = null;
  let bestMap50 = null;
  let bestMap50_95 = null;

  for (const line of lines.slice(1)) {
    const values = line.split(",");
    const row = {};
    headers.forEach((header, index) => {
      const parsed = Number.parseFloat(values[index] ?? "");
      row[header] = Number.isFinite(parsed) ? parsed : values[index] ?? "";
    });
    lastRow = row;

    const map50 = Number(row["metrics/mAP50(B)"]);
    const map50_95 = Number(row["metrics/mAP50-95(B)"]);
    if (Number.isFinite(map50)) {
      bestMap50 = bestMap50 === null ? map50 : Math.max(bestMap50, map50);
    }
    if (Number.isFinite(map50_95)) {
      bestMap50_95 = bestMap50_95 === null ? map50_95 : Math.max(bestMap50_95, map50_95);
    }
  }

  if (!lastRow) {
    return null;
  }

  return {
    rowCount: Math.max(0, lines.length - 1),
    lastEpoch: Number.isFinite(Number(lastRow.epoch)) ? Number(lastRow.epoch) : null,
    lastPrecision: Number.isFinite(Number(lastRow["metrics/precision(B)"]))
      ? Number(lastRow["metrics/precision(B)"])
      : null,
    lastRecall: Number.isFinite(Number(lastRow["metrics/recall(B)"]))
      ? Number(lastRow["metrics/recall(B)"])
      : null,
    lastMap50: Number.isFinite(Number(lastRow["metrics/mAP50(B)"]))
      ? Number(lastRow["metrics/mAP50(B)"])
      : null,
    lastMap50_95: Number.isFinite(Number(lastRow["metrics/mAP50-95(B)"]))
      ? Number(lastRow["metrics/mAP50-95(B)"])
      : null,
    bestMap50,
    bestMap50_95,
  };
}

export function classNamesFromDataYaml(datasetDir) {
  const yamlPath = path.join(datasetDir, "data.yaml");
  if (!existsSync(yamlPath)) {
    return [];
  }

  const classNames = new Map();
  let insideNamesBlock = false;

  for (const rawLine of readFileSync(yamlPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const stripped = line.trim();
    if (!stripped || stripped.startsWith("#")) {
      continue;
    }

    if (!insideNamesBlock) {
      if (stripped === "names:") {
        insideNamesBlock = true;
      }
      continue;
    }

    if (!rawLine.startsWith(" ") && !rawLine.startsWith("\t")) {
      break;
    }

    if (!stripped.includes(":")) {
      continue;
    }

    const separatorIndex = stripped.indexOf(":");
    const rawKey = stripped.slice(0, separatorIndex).trim();
    let rawValue = stripped.slice(separatorIndex + 1).trim();
    const classId = Number.parseInt(rawKey, 10);
    if (!Number.isFinite(classId)) {
      continue;
    }

    if (rawValue.length >= 2 && rawValue[0] === rawValue.at(-1) && (rawValue[0] === '"' || rawValue[0] === "'")) {
      rawValue = rawValue.slice(1, -1);
    }

    if (rawValue) {
      classNames.set(classId, rawValue);
    }
  }

  if (!classNames.size) {
    return [];
  }

  const maxClassId = Math.max(...classNames.keys());
  const resolvedNames = [];
  for (let index = 0; index <= maxClassId; index += 1) {
    resolvedNames.push(classNames.get(index) || `class-${index}`);
  }
  return resolvedNames;
}

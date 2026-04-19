/**
 * Path utilities: resolve, display, validation.
 */

import path from "node:path";
import { PROJECT_DIR } from "./constants.js";
import { HttpError } from "./errors.js";

export function pathInside(targetPath, rootPath) {
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

export function resolveProjectPath(value, { allowEmpty = false } = {}) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) {
    if (allowEmpty) {
      return null;
    }
    throw new HttpError(400, "Path wajib diisi.");
  }

  const candidate = path.isAbsolute(rawValue) ? rawValue : path.join(PROJECT_DIR, rawValue);
  return path.resolve(candidate);
}

export function displayPath(targetPath) {
  if (!targetPath) {
    return "";
  }
  const resolvedPath = path.resolve(targetPath);
  return pathInside(resolvedPath, PROJECT_DIR)
    ? path.relative(PROJECT_DIR, resolvedPath).split(path.sep).join("/")
    : resolvedPath;
}

export function encodePathQuery(value) {
  return String(value)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

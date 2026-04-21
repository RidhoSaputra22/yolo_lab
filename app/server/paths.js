/**
 * Path utilities: resolve, display, validation.
 */

import path from "node:path";
import { PROJECT_DIR } from "./constants.js";
import { HttpError } from "./errors.js";

const PROJECT_ROOT_ALIAS = path.basename(PROJECT_DIR);

function normalizeProjectRelative(rawValue) {
  const normalizedValue = String(rawValue ?? "").trim().replaceAll("\\", "/");
  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue === PROJECT_ROOT_ALIAS) {
    return "";
  }

  const rootPrefix = `${PROJECT_ROOT_ALIAS}/`;
  return normalizedValue.startsWith(rootPrefix)
    ? normalizedValue.slice(rootPrefix.length)
    : normalizedValue;
}

export function pathInside(targetPath, rootPath) {
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

export function rebaseSubdirectoryPath(sourceRootPath, sourcePath, targetRootPath) {
  const resolvedSourceRoot = path.resolve(sourceRootPath);
  const resolvedSourcePath = path.resolve(sourcePath);
  const resolvedTargetRoot = path.resolve(targetRootPath);

  if (!pathInside(resolvedSourcePath, resolvedSourceRoot)) {
    throw new HttpError(400, `Path di luar root sumber: ${resolvedSourcePath}`);
  }

  const relativePath = path.relative(resolvedSourceRoot, resolvedSourcePath);
  return relativePath ? path.resolve(resolvedTargetRoot, relativePath) : resolvedTargetRoot;
}

export function resolveProjectPath(value, { allowEmpty = false } = {}) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) {
    if (allowEmpty) {
      return null;
    }
    throw new HttpError(400, "Path wajib diisi.");
  }

  const projectRelativeValue = normalizeProjectRelative(rawValue);
  const candidate = path.isAbsolute(rawValue) ? rawValue : path.join(PROJECT_DIR, projectRelativeValue);
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
  return normalizeProjectRelative(value)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function projectRootName() {
  return PROJECT_ROOT_ALIAS;
}

/**
 * File system helpers: discovery, listing, recursive stats.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { MAX_DISCOVERY_ITEMS } from "./constants.js";
import { displayPath } from "./paths.js";

export function walkFiles(baseDir, extensions, ignoredParts, seen, discovered, limit) {
  if (!existsSync(baseDir)) {
    return;
  }

  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    const entryPath = path.join(baseDir, entry.name);
    const resolvedEntryPath = path.resolve(entryPath);
    if (entry.isDirectory()) {
      if (ignoredParts.has(entry.name)) {
        continue;
      }
      walkFiles(resolvedEntryPath, extensions, ignoredParts, seen, discovered, limit);
      if (discovered.length >= limit) {
        return;
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }
    if (!extensions.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }
    if (seen.has(resolvedEntryPath)) {
      continue;
    }

    seen.add(resolvedEntryPath);
    discovered.push(displayPath(resolvedEntryPath));
    if (discovered.length >= limit) {
      return;
    }
  }
}

export function discoverFiles(baseDirs, extensions, limit = MAX_DISCOVERY_ITEMS) {
  const ignoredParts = new Set([".git", ".venv", "__pycache__", "site-packages", "node_modules"]);
  const seen = new Set();
  const discovered = [];

  for (const baseDir of baseDirs) {
    walkFiles(path.resolve(baseDir), extensions, ignoredParts, seen, discovered, limit);
    if (discovered.length >= limit) {
      break;
    }
  }
  return discovered;
}

export function listTopLevelFiles(directoryPath, extensions) {
  if (!existsSync(directoryPath)) {
    return [];
  }
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(directoryPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export function listTopLevelDirectories(directoryPath) {
  if (!existsSync(directoryPath)) {
    return [];
  }
  return readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(directoryPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export function listFrameDirectoryChoices(rootDir, extensions, activeDir = null) {
  const resolvedRootDir = path.resolve(rootDir);
  const resolvedActiveDir = activeDir ? path.resolve(activeDir) : null;
  const directories = [];

  const registerDirectory = (directoryPath, { isRoot = false } = {}) => {
    if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) {
      return;
    }

    const resolvedDir = path.resolve(directoryPath);
    const frameCount = listTopLevelFiles(resolvedDir, extensions).length;
    const isActive = Boolean(resolvedActiveDir && resolvedActiveDir === resolvedDir);
    if (!frameCount && !isActive) {
      return;
    }

    const displayDir = displayPath(resolvedDir);
    const name = isRoot ? path.basename(resolvedRootDir) : path.basename(resolvedDir);
    directories.push({
      name,
      path: displayDir,
      frameCount,
      isActive,
      isRoot,
      label: `${isRoot ? `${displayDir} (root)` : name} • ${frameCount} frame`,
    });
  };

  registerDirectory(resolvedRootDir, { isRoot: true });
  for (const subDirectory of listTopLevelDirectories(resolvedRootDir)) {
    registerDirectory(subDirectory);
  }

  return directories.sort((left, right) => {
    const activeDiff = Number(right.isActive) - Number(left.isActive);
    if (activeDiff !== 0) {
      return activeDiff;
    }
    return right.path.localeCompare(left.path);
  });
}

export function recursiveFileStats(rootDir) {
  if (!rootDir || !existsSync(rootDir)) {
    return { fileCount: 0, totalSizeBytes: 0, updatedMs: 0, files: [] };
  }

  const files = [];
  const stack = [path.resolve(rootDir)];
  let totalSizeBytes = 0;
  let updatedMs = 0;

  while (stack.length) {
    const currentDir = stack.pop();
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const stats = statSync(entryPath);
      files.push(entryPath);
      totalSizeBytes += stats.size;
      updatedMs = Math.max(updatedMs, stats.mtimeMs);
    }
  }

  files.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  return {
    fileCount: files.length,
    totalSizeBytes,
    updatedMs,
    files,
  };
}

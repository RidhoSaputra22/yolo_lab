export function joinClasses(...values) {
  return values.filter(Boolean).join(" ");
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function formatTimestamp(value) {
  if (!value) {
    return "-";
  }
  return String(value).replace("T", " ");
}

export function formatCount(count, noun) {
  return `${count} ${noun}`;
}

export function fileSizeLabel(sizeBytes) {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return "-";
  }
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  if (sizeBytes < 1024 * 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function parseTimestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizePath(value) {
  return String(value || "")
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

export function relativeFolderPath(basePath, targetPath) {
  const normalizedBase = normalizePath(basePath);
  const normalizedTarget = normalizePath(targetPath);
  if (!normalizedTarget) {
    return ".";
  }
  if (!normalizedBase) {
    return normalizedTarget;
  }
  if (normalizedTarget === normalizedBase) {
    return ".";
  }
  if (normalizedTarget.startsWith(`${normalizedBase}/`)) {
    return normalizedTarget.slice(normalizedBase.length + 1) || ".";
  }

  const baseParts = normalizedBase.split("/").filter(Boolean);
  const targetParts = normalizedTarget.split("/").filter(Boolean);
  let index = 0;
  while (index < baseParts.length && index < targetParts.length && baseParts[index] === targetParts[index]) {
    index += 1;
  }
  const relative = targetParts.slice(index).join("/");
  return relative || normalizedTarget;
}

export function inferArtifactDescriptor(name) {
  const lowerName = String(name || "").toLowerCase();
  const patterns = [
    { suffix: "_tracking.mp4", kind: "video" },
    { suffix: "_tracks.csv", kind: "tracks" },
    { suffix: "_predictions.csv", kind: "tracks" },
    { suffix: "_summary.json", kind: "summary" },
  ];

  for (const pattern of patterns) {
    if (lowerName.endsWith(pattern.suffix)) {
      return {
        kind: pattern.kind,
        runKey: name.slice(0, -pattern.suffix.length),
      };
    }
  }

  const dotIndex = name.lastIndexOf(".");
  const stem = dotIndex >= 0 ? name.slice(0, dotIndex) : name;
  const extension = dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : "";
  let kind = "file";
  if (extension === "mp4") {
    kind = "video";
  } else if (extension === "csv") {
    kind = "tracks";
  } else if (extension === "json") {
    kind = "summary";
  }

  return {
    kind,
    runKey: stem,
  };
}

export function groupArtifactsByFolder(artifacts, baseOutputDir) {
  const folders = new Map();

  for (const artifact of artifacts) {
    const folderKey = relativeFolderPath(baseOutputDir, artifact.parent);
    let folder = folders.get(folderKey);
    if (!folder) {
      folder = {
        key: folderKey,
        label: folderKey === "." ? "Folder utama" : folderKey,
        path: artifact.parent,
        fileCount: 0,
        totalSizeBytes: 0,
        updatedMs: 0,
        updatedAt: "-",
        runs: new Map(),
      };
      folders.set(folderKey, folder);
    }

    folder.fileCount += 1;
    folder.totalSizeBytes += artifact.sizeBytes || 0;
    const artifactUpdatedMs = parseTimestamp(artifact.modifiedAt);
    if (artifactUpdatedMs >= folder.updatedMs) {
      folder.updatedMs = artifactUpdatedMs;
      folder.updatedAt = formatTimestamp(artifact.modifiedAt);
    }

    const descriptor = inferArtifactDescriptor(artifact.name);
    let run = folder.runs.get(descriptor.runKey);
    if (!run) {
      run = {
        key: descriptor.runKey,
        updatedMs: 0,
        updatedAt: "-",
        totalSizeBytes: 0,
        video: null,
        summary: null,
        tracks: null,
        others: [],
      };
      folder.runs.set(descriptor.runKey, run);
    }

    run.totalSizeBytes += artifact.sizeBytes || 0;
    if (artifactUpdatedMs >= run.updatedMs) {
      run.updatedMs = artifactUpdatedMs;
      run.updatedAt = formatTimestamp(artifact.modifiedAt);
    }

    if (descriptor.kind === "video" && !run.video) {
      run.video = artifact;
    } else if (descriptor.kind === "summary" && !run.summary) {
      run.summary = artifact;
    } else if (descriptor.kind === "tracks" && !run.tracks) {
      run.tracks = artifact;
    } else {
      run.others.push(artifact);
    }
  }

  return Array.from(folders.values())
    .map((folder) => ({
      ...folder,
      runCount: folder.runs.size,
      totalSizeLabel: fileSizeLabel(folder.totalSizeBytes),
      runs: Array.from(folder.runs.values())
        .map((run) => ({
          ...run,
          totalSizeLabel: fileSizeLabel(run.totalSizeBytes),
        }))
        .sort((left, right) => right.updatedMs - left.updatedMs),
    }))
    .sort((left, right) => right.updatedMs - left.updatedMs);
}

/**
 * HTTP response helpers untuk Bun.serve.
 */

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { STATIC_CONTENT_TYPES } from "./constants.js";
import { HttpError } from "./errors.js";
import { pathInside } from "./paths.js";

export function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function textResponse(message, status = 200) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function contentTypeForPath(filePath) {
  return STATIC_CONTENT_TYPES[path.extname(filePath).toLowerCase()] || Bun.file(filePath).type || "application/octet-stream";
}

function parseByteRange(rangeHeader, sizeBytes) {
  if (!rangeHeader) {
    return null;
  }

  const rawValue = String(rangeHeader).trim();
  if (!rawValue.startsWith("bytes=") || rawValue.includes(",")) {
    throw new HttpError(416, "Header Range tidak valid.");
  }

  const [startRaw, endRaw] = rawValue.slice("bytes=".length).split("-", 2);
  if (!startRaw && !endRaw) {
    throw new HttpError(416, "Header Range tidak valid.");
  }

  let start = 0;
  let end = sizeBytes - 1;

  if (!startRaw) {
    const suffixLength = Number.parseInt(endRaw, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      throw new HttpError(416, "Header Range tidak valid.");
    }
    start = Math.max(sizeBytes - suffixLength, 0);
  } else {
    start = Number.parseInt(startRaw, 10);
    if (!Number.isFinite(start) || start < 0) {
      throw new HttpError(416, "Header Range tidak valid.");
    }
    if (endRaw) {
      end = Number.parseInt(endRaw, 10);
      if (!Number.isFinite(end) || end < start) {
        throw new HttpError(416, "Header Range tidak valid.");
      }
    }
  }

  if (start >= sizeBytes) {
    throw new HttpError(416, "Range melebihi ukuran file.");
  }

  end = Math.min(end, sizeBytes - 1);
  return { start, end };
}

export function fileResponse(filePath, { method = "GET", contentType = null, rangeHeader = null } = {}) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new HttpError(404, "File tidak ditemukan.");
  }

  const stats = statSync(filePath);
  const range = parseByteRange(rangeHeader, stats.size);
  const headers = new Headers();
  headers.set("Content-Type", contentType || contentTypeForPath(filePath));
  headers.set("Accept-Ranges", "bytes");
  if ([".html", ".js", ".css"].includes(path.extname(filePath).toLowerCase())) {
    headers.set("Cache-Control", "no-store");
  }

  if (range) {
    const chunkSize = range.end - range.start + 1;
    headers.set("Content-Length", String(chunkSize));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${stats.size}`);
    return new Response(method === "HEAD" ? null : Bun.file(filePath).slice(range.start, range.end + 1), {
      status: 206,
      headers,
    });
  }

  headers.set("Content-Length", String(stats.size));
  return new Response(method === "HEAD" ? null : Bun.file(filePath), {
    status: 200,
    headers,
  });
}

export async function readJsonRequest(request) {
  const contentLength = Number.parseInt(request.headers.get("content-length") || "0", 10);
  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    return {};
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    throw new HttpError(400, `Request tidak valid: ${error.message}`);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "Request tidak valid: Body JSON harus berupa object.");
  }

  return payload;
}

export function requireQueryValue(url, key) {
  const value = url.searchParams.get(key)?.trim();
  if (!value) {
    throw new HttpError(400, `Query parameter \`${key}\` wajib diisi.`);
  }
  return value;
}

export function staticPathResponse(rootDir, requestPath, prefix, method) {
  const relativePath = decodeURIComponent(requestPath.slice(prefix.length));
  const resolvedPath = path.resolve(rootDir, relativePath);
  if (!relativePath || !pathInside(resolvedPath, rootDir)) {
    throw new HttpError(400, "Path asset tidak valid.");
  }
  return fileResponse(resolvedPath, { method });
}

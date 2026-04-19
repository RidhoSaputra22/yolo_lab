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

export function fileResponse(filePath, { method = "GET", contentType = null } = {}) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new HttpError(404, "File tidak ditemukan.");
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType || contentTypeForPath(filePath));
  headers.set("Content-Length", String(statSync(filePath).size));
  if ([".html", ".js", ".css"].includes(path.extname(filePath).toLowerCase())) {
    headers.set("Cache-Control", "no-store");
  }

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

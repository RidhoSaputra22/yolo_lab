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

export function eventStreamResponse(request, setup) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  let closeStream = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let heartbeat = null;

      const sendChunk = (chunk) => {
        if (closed) {
          return;
        }
        controller.enqueue(encoder.encode(chunk));
      };

      const sendComment = (comment) => {
        sendChunk(`: ${comment}\n\n`);
      };

      const sendEvent = (event, payload) => {
        sendChunk(`event: ${event}\ndata: ${payload == null ? "null" : JSON.stringify(payload)}\n\n`);
      };

      closeStream = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (heartbeat) {
          clearInterval(heartbeat);
        }
        request.signal?.removeEventListener?.("abort", closeStream);
        try {
          cleanup();
        } catch {
          // Best effort clean-up for disconnected SSE clients.
        }
        try {
          controller.close();
        } catch {
          // Stream may already be closed by Bun/client.
        }
      };

      try {
        cleanup = setup({
          sendEvent,
          sendComment,
          close: closeStream,
        }) || (() => {});
      } catch (error) {
        sendEvent("stream-error", { error: error.message });
        closeStream();
        return;
      }

      heartbeat = setInterval(() => {
        try {
          sendComment("keepalive");
        } catch {
          closeStream();
        }
      }, 15000);

      request.signal?.addEventListener?.("abort", closeStream, { once: true });
      sendComment("connected");
    },
    cancel() {
      closeStream();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
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

export function fileResponse(
  filePath,
  {
    method = "GET",
    contentType = null,
    rangeHeader = null,
    headers: extraHeaders = null,
  } = {},
) {
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
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      if (value != null) {
        headers.set(key, String(value));
      }
    }
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
  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch (error) {
    throw new HttpError(400, `Request tidak valid: ${error.message}`);
  }

  if (!String(rawBody || "").trim()) {
    return {};
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
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

/**
 * Route handler — createFetchHandler(appState).
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { PROJECT_DIR, REACT_MODULES_DIR, REACT_SHELL_PATH, STATIC_DIR } from "./constants.js";
import { HttpError } from "./errors.js";
import { pathInside, resolveProjectPath, displayPath } from "./paths.js";
import {
  fileResponse,
  jsonResponse,
  readJsonRequest,
  requireQueryValue,
  staticPathResponse,
  textResponse,
} from "./response.js";

export function createFetchHandler(appState) {
  return async function handleRequest(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const isApi = pathname.startsWith("/api/");

    try {
      if (!["GET", "HEAD", "POST"].includes(request.method)) {
        throw new HttpError(405, "Method tidak didukung.");
      }

      if (request.method === "GET" || request.method === "HEAD") {
        if (pathname === "/" || pathname === "/index.html") {
          return fileResponse(REACT_SHELL_PATH, {
            method: request.method,
            contentType: "text/html; charset=utf-8",
          });
        }

        if (pathname === "/tester" || pathname === "/tester.html") {
          return fileResponse(REACT_SHELL_PATH, {
            method: request.method,
            contentType: "text/html; charset=utf-8",
          });
        }

        if (pathname === "/training" || pathname === "/training.html") {
          return fileResponse(REACT_SHELL_PATH, {
            method: request.method,
            contentType: "text/html; charset=utf-8",
          });
        }

        if (pathname.startsWith("/react/")) {
          return staticPathResponse(REACT_MODULES_DIR, pathname, "/react/", request.method);
        }

        if (pathname.startsWith("/static/")) {
          return staticPathResponse(STATIC_DIR, pathname, "/static/", request.method);
        }

        if (pathname.startsWith("/frames/")) {
          const imageName = decodeURIComponent(pathname.slice("/frames/".length));
          const imagePath = appState.imagePath(imageName);
          return fileResponse(imagePath, { method: request.method });
        }

        if (pathname === "/api/config") {
          const images = appState.listImages();
          const labeledCount = images.filter((item) => item.hasLabelFile).length;
          const totalBoxes = images.reduce((sum, item) => sum + Number(item.boxCount || 0), 0);
          const autolabelConfig = appState.autolabelConfigPayload();
          return jsonResponse({
            classNames: appState.classNames,
            images,
            checkpointImage: appState.readCheckpointImage(),
            autolabel: autolabelConfig,
            summary: {
              totalImages: images.length,
              labeledImages: labeledCount,
              pendingImages: images.length - labeledCount,
              totalBoxes,
            },
          });
        }

        if (pathname === "/api/labels") {
          const imageName = requireQueryValue(url, "image");
          const labelData = appState.readLabelData(imageName);
          return jsonResponse({
            image: imageName,
            hasLabelFile: labelData.hasLabelFile,
            parseError: labelData.parseError,
            boxes: labelData.boxes,
          });
        }

        if (pathname === "/api/test/config") {
          return jsonResponse(appState.testRunner.configPayload());
        }

        if (pathname === "/api/test/status") {
          return jsonResponse(appState.testRunner.snapshot());
        }

        if (pathname === "/api/test/artifact") {
          const artifactValue = requireQueryValue(url, "path");
          const artifactPath = resolveProjectPath(artifactValue);
          if (!existsSync(artifactPath)) {
            throw new HttpError(404, `Artifact tidak ditemukan: ${artifactValue}`);
          }
          if (!pathInside(artifactPath, PROJECT_DIR)) {
            throw new HttpError(400, "Artifact di luar project tidak bisa diakses dari UI.");
          }
          return fileResponse(artifactPath, { method: request.method });
        }

        if (pathname === "/api/train/config") {
          return jsonResponse(appState.trainingRunner.configPayload());
        }

        if (pathname === "/api/train/status") {
          return jsonResponse(appState.trainingRunner.snapshot());
        }

        if (pathname === "/api/train/artifact") {
          const artifactValue = requireQueryValue(url, "path");
          const artifactPath = resolveProjectPath(artifactValue);
          if (!existsSync(artifactPath)) {
            throw new HttpError(404, `Artifact tidak ditemukan: ${artifactValue}`);
          }
          if (!pathInside(artifactPath, PROJECT_DIR)) {
            throw new HttpError(400, "Artifact di luar project tidak bisa diakses dari UI.");
          }
          return fileResponse(artifactPath, { method: request.method });
        }

        if (pathname === "/api/files/browse") {
          const pathValue = url.searchParams.get("path") || "";
          const targetPath = pathValue ? resolveProjectPath(pathValue) : PROJECT_DIR;
          
          if (!existsSync(targetPath)) {
            throw new HttpError(404, `Path tidak ditemukan: ${pathValue}`);
          }
          if (!pathInside(targetPath, PROJECT_DIR)) {
            throw new HttpError(400, "Path di luar project tidak bisa diakses.");
          }

          const stats = statSync(targetPath);
          const parentPath = targetPath === PROJECT_DIR ? null : path.dirname(targetPath);
          
          if (stats.isDirectory()) {
            const entries = readdirSync(targetPath, { withFileTypes: true })
              .map((entry) => {
                const entryPath = path.join(targetPath, entry.name);
                const entryStats = statSync(entryPath);
                return {
                  name: entry.name,
                  path: displayPath(entryPath),
                  isDirectory: entry.isDirectory(),
                  size: entryStats.size,
                  modified: entryStats.mtime.toISOString(),
                };
              })
              .sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) return b.isDirectory - a.isDirectory;
                return a.name.localeCompare(b.name);
              });

            return jsonResponse({
              currentPath: displayPath(targetPath),
              isRoot: targetPath === PROJECT_DIR,
              parentPath: parentPath ? displayPath(parentPath) : null,
              entries,
            });
          } else {
            return jsonResponse({
              currentPath: displayPath(targetPath),
              isRoot: false,
              parentPath: displayPath(path.dirname(targetPath)),
              entries: [],
              isFile: true,
            });
          }
        }

        throw new HttpError(404, "Route tidak ditemukan.");
      }

      const payload = await readJsonRequest(request);

      if (pathname === "/api/labels") {
        const imageName = requireQueryValue(url, "image");
        const result = appState.saveLabelData(
          imageName,
          Number.parseInt(payload.imageWidth, 10),
          Number.parseInt(payload.imageHeight, 10),
          Array.isArray(payload.boxes) ? payload.boxes : [],
        );
        return jsonResponse(result, 200);
      }

      if (pathname === "/api/checkpoint") {
        const imageName = String(payload.image || "").trim();
        const result = appState.saveCheckpointImage(imageName);
        return jsonResponse(result, 200);
      }

      if (pathname === "/api/autolabel") {
        const imageName = String(payload.image || "").trim();
        return jsonResponse(appState.autolabelImage(imageName, payload), 200);
      }

      if (pathname === "/api/test/preview") {
        return jsonResponse(appState.testRunner.preview(payload), 200);
      }

      if (pathname === "/api/test/run") {
        return jsonResponse(appState.testRunner.start(payload), 200);
      }

      if (pathname === "/api/test/stop") {
        return jsonResponse(appState.testRunner.stop(), 200);
      }

      if (pathname === "/api/train/preview") {
        return jsonResponse(appState.trainingRunner.preview(payload), 200);
      }

      if (pathname === "/api/train/run") {
        return jsonResponse(appState.trainingRunner.start(payload), 200);
      }

      if (pathname === "/api/train/stop") {
        return jsonResponse(appState.trainingRunner.stop(), 200);
      }

      throw new HttpError(404, "Route tidak ditemukan.");
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError ? error.message : `Server error: ${error.message}`;
      return isApi ? jsonResponse({ error: message }, status) : textResponse(message, status);
    }
  };
}

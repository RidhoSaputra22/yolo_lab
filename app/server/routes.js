/**
 * Route handler — createFetchHandler(appState).
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { PROJECT_DIR, REACT_MODULES_DIR, REACT_SHELL_PATH, STATIC_DIR } from "./constants.js";
import { HttpError } from "./errors.js";
import { pathInside, resolveProjectPath, displayPath, projectRootName } from "./paths.js";
import {
  eventStreamResponse,
  fileResponse,
  jsonResponse,
  readJsonRequest,
  requireQueryValue,
  staticPathResponse,
  textResponse,
} from "./response.js";

function requestRangeHeader(request) {
  return (
    request.headers.get("range")
    || request.headers.get("Range")
    || request.headers.toJSON?.().range
    || request.headers.toJSON?.().Range
    || null
  );
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function labelerPreferencesPayload(appState, storedPreferences, autolabelDefaults) {
  const safePreferences = isPlainObject(storedPreferences) ? storedPreferences : {};
  return {
    framesDir: displayPath(appState.framesDir),
    filterValue: typeof safePreferences.filterValue === "string" && safePreferences.filterValue
      ? safePreferences.filterValue
      : "all",
    searchQuery: typeof safePreferences.searchQuery === "string" ? safePreferences.searchQuery : "",
    activeClassId: Number.isFinite(Number(safePreferences.activeClassId))
      ? Number(safePreferences.activeClassId)
      : 0,
    autolabelConfig: {
      ...autolabelDefaults,
      ...(isPlainObject(safePreferences.autolabelConfig) ? safePreferences.autolabelConfig : {}),
    },
  };
}

function jobStreamResponse(request, manager, snapshotBuilder) {
  return eventStreamResponse(request, ({ sendEvent }) => {
    const emitSnapshot = () => {
      sendEvent("snapshot", snapshotBuilder());
    };

    emitSnapshot();
    return manager.subscribe((event) => {
      if (event?.type === "log") {
        sendEvent("log", event);
        return;
      }
      emitSnapshot();
    });
  });
}

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

        if (pathname === "/footage" || pathname === "/footage.html") {
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
          const storedPreferences = appState.pagePreferences.read("labeler");
          const storedAutolabelConfig = isPlainObject(storedPreferences.autolabelConfig)
            ? storedPreferences.autolabelConfig
            : {};
          const autolabelConfig = appState.autolabelConfigPayload(storedAutolabelConfig);
          const preferences = labelerPreferencesPayload(
            appState,
            storedPreferences,
            autolabelConfig.defaults || {},
          );
          appState.pagePreferences.write("labeler", preferences);
          const images = appState.listImages();
          const labeledCount = images.filter((item) => item.hasLabelFile).length;
          const totalBoxes = images.reduce((sum, item) => sum + Number(item.boxCount || 0), 0);
          return jsonResponse({
            classNames: appState.classNames,
            images,
            checkpointImage: appState.readCheckpointImage(),
            activeFramesDir: displayPath(appState.framesDir),
            activeLabelsDir: displayPath(appState.labelsDir),
            framesRootDir: displayPath(appState.framesRootDir),
            frameFolders: appState.listFrameFolders(),
            preferences,
            autolabel: autolabelConfig,
            summary: {
              totalImages: images.length,
              labeledImages: labeledCount,
              pendingImages: images.length - labeledCount,
              totalBoxes,
            },
          });
        }

        if (pathname === "/api/preferences") {
          const page = requireQueryValue(url, "page");
          return jsonResponse({
            page: String(page).trim().toLowerCase(),
            values: appState.pagePreferences.read(page),
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

        if (pathname === "/api/autolabel/status") {
          return jsonResponse(appState.autolabelJobSnapshot(), 200);
        }

        if (pathname === "/api/autolabel/stream") {
          return jobStreamResponse(request, appState.autolabelRunner, () => appState.autolabelJobSnapshot());
        }

        if (pathname === "/api/test/config") {
          const configPayload = appState.testRunner.configPayload(appState.pagePreferences.read("tester"));
          appState.pagePreferences.write("tester", configPayload.defaults || {});
          return jsonResponse({
            ...configPayload,
            preferences: configPayload.defaults || {},
          });
        }

        if (pathname === "/api/footage/config") {
          const configPayload = appState.footageRunner.configPayload(appState.pagePreferences.read("footage"));
          appState.pagePreferences.write("footage", configPayload.defaults || {});
          return jsonResponse({
            ...configPayload,
            preferences: configPayload.defaults || {},
          });
        }

        if (pathname === "/api/footage/status") {
          return jsonResponse(appState.footageRunner.snapshot());
        }

        if (pathname === "/api/footage/stream") {
          return jobStreamResponse(request, appState.footageRunner, () => appState.footageRunner.snapshot());
        }

        if (pathname === "/api/footage/artifact") {
          const artifactValue = requireQueryValue(url, "path");
          const artifactPath = resolveProjectPath(artifactValue);
          if (!existsSync(artifactPath)) {
            throw new HttpError(404, `Footage tidak ditemukan: ${artifactValue}`);
          }
          if (!pathInside(artifactPath, PROJECT_DIR)) {
            throw new HttpError(400, "Footage di luar project tidak bisa diakses dari UI.");
          }
          return fileResponse(artifactPath, {
            method: request.method,
            rangeHeader: requestRangeHeader(request),
          });
        }

        if (pathname === "/api/test/status") {
          return jsonResponse(appState.testRunner.snapshot());
        }

        if (pathname === "/api/test/stream") {
          return jobStreamResponse(request, appState.testRunner, () => appState.testRunner.snapshot());
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
          return fileResponse(artifactPath, {
            method: request.method,
            rangeHeader: requestRangeHeader(request),
          });
        }

        if (pathname === "/api/train/config") {
          const storedPreferences = appState.pagePreferences.read("training");
          const configPayload = appState.trainingRunner.configPayload({
            framesDir: displayPath(appState.framesDir),
            labelsDir: displayPath(appState.labelsDir),
            ...(isPlainObject(storedPreferences) ? storedPreferences : {}),
          });
          appState.pagePreferences.write("training", configPayload.defaults || {});
          const frameFolders = (configPayload.frameFolders || []).map((item) => ({
            ...item,
            labelsDir: displayPath(appState.labelsDirForFramesDir(resolveProjectPath(item.path))),
          }));
          return jsonResponse({
            ...configPayload,
            frameFolders,
            activeFramesDir: configPayload.defaults?.framesDir || displayPath(appState.framesDir),
            activeLabelsDir: configPayload.defaults?.labelsDir || displayPath(appState.labelsDir),
            preferences: configPayload.defaults || {},
            suggestions: {
              ...(configPayload.suggestions || {}),
              labelsDir: [
                ...new Set([
                  configPayload.defaults?.labelsDir || displayPath(appState.labelsDir),
                  ...frameFolders.map((item) => item.labelsDir).filter(Boolean),
                ]),
              ],
            },
          });
        }

        if (pathname === "/api/train/status") {
          return jsonResponse(
            appState.trainingRunner.snapshot({
              framesDir: displayPath(appState.framesDir),
              labelsDir: displayPath(appState.labelsDir),
            }),
          );
        }

        if (pathname === "/api/train/stream") {
          return jobStreamResponse(
            request,
            appState.trainingRunner,
            () => appState.trainingRunner.snapshot({
              framesDir: displayPath(appState.framesDir),
              labelsDir: displayPath(appState.labelsDir),
            }),
          );
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
          return fileResponse(artifactPath, {
            method: request.method,
            rangeHeader: requestRangeHeader(request),
          });
        }

        if (pathname === "/api/files/browse") {
          const pathValue = url.searchParams.get("path") || "";
          const targetPath = pathValue ? resolveProjectPath(pathValue) : PROJECT_DIR;
          const rootName = projectRootName();
          
          if (!existsSync(targetPath)) {
            throw new HttpError(404, `Path tidak ditemukan: ${pathValue}`);
          }
          if (!pathInside(targetPath, PROJECT_DIR)) {
            throw new HttpError(400, "Path di luar project tidak bisa diakses.");
          }

          const stats = statSync(targetPath);
          const browsePath = stats.isDirectory() ? targetPath : path.dirname(targetPath);
          const parentPath = browsePath === PROJECT_DIR ? null : path.dirname(browsePath);
          const selectedPath = stats.isFile() ? displayPath(targetPath) : null;
          
          const entries = readdirSync(browsePath, { withFileTypes: true })
            .map((entry) => {
              const entryPath = path.join(browsePath, entry.name);
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

          if (stats.isDirectory()) {
            return jsonResponse({
              currentPath: displayPath(browsePath),
              isRoot: browsePath === PROJECT_DIR,
              parentPath: parentPath ? displayPath(parentPath) : null,
              rootName,
              selectedPath,
              entries,
            });
          } else {
            return jsonResponse({
              currentPath: displayPath(browsePath),
              isRoot: browsePath === PROJECT_DIR,
              parentPath: parentPath ? displayPath(parentPath) : null,
              rootName,
              selectedPath,
              entries,
              isFile: true,
            });
          }
        }

        throw new HttpError(404, "Route tidak ditemukan.");
      }

      if (pathname === "/api/footage/import") {
        const formData = await request.formData();
        return jsonResponse(await appState.footageRunner.importFiles(formData), 200);
      }

      const payload = await readJsonRequest(request);

      if (pathname === "/api/preferences") {
        const page = String(payload.page || "").trim();
        if (!isPlainObject(payload.values)) {
          throw new HttpError(400, "Payload `values` wajib berupa object.");
        }
        const result = appState.pagePreferences.write(page, payload.values);
        return jsonResponse({
          page: result.page,
          path: displayPath(result.path),
          values: result.values,
        }, 200);
      }

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
        return jsonResponse(appState.startAutolabelImage(imageName, payload), 200);
      }

      if (pathname === "/api/autolabel/all") {
        return jsonResponse(appState.startAutolabelAll(payload), 200);
      }

      if (pathname === "/api/autolabel/stop") {
        return jsonResponse(appState.stopAutolabel(), 200);
      }

      if (pathname === "/api/footage/activate") {
        const framesDir = String(payload.framesDir || "").trim();
        return jsonResponse(appState.setFramesDir(resolveProjectPath(framesDir)), 200);
      }

      if (pathname === "/api/frames/activate") {
        const framesDir = String(payload.framesDir || "").trim();
        return jsonResponse(appState.setFramesDir(resolveProjectPath(framesDir)), 200);
      }

      if (pathname === "/api/footage/preview") {
        return jsonResponse(appState.footageRunner.preview(payload), 200);
      }

      if (pathname === "/api/footage/extract") {
        return jsonResponse(appState.footageRunner.start(payload), 200);
      }

      if (pathname === "/api/footage/stop") {
        return jsonResponse(appState.footageRunner.stop(), 200);
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

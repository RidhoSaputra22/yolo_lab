/**
 * BaseRunManager — shared logic untuk TestRunManager & TrainingRunManager.
 */

import { MAX_LOG_LINES, TRUE_VALUES } from "../constants.js";
import { HttpError } from "../errors.js";
import { toLocalIso } from "../format.js";

export class BaseRunManager {
  constructor() {
    this.nextJobId = 1;
    this.listeners = new Set();
  }

  isRunning() {
    return Boolean(this.current.process && this.current.process.exitCode === null);
  }

  appendLog(line) {
    this.current.logs.push(line);
    let trimmedCount = 0;
    if (this.current.logs.length > MAX_LOG_LINES) {
      trimmedCount = this.current.logs.length - MAX_LOG_LINES;
      this.current.logs.splice(0, trimmedCount);
    }
    this.emitUpdate({
      type: "log",
      jobId: this.current.jobId,
      line,
      trimmedCount,
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emitUpdate(event) {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error(`[yolo-lab-app] gagal mengirim update job: ${error.message}`);
      }
    }
  }

  emitSnapshot() {
    this.emitUpdate({
      type: "snapshot",
      jobId: this.current.jobId,
    });
  }

  consumeStream(jobId, stream) {
    if (!stream) {
      return;
    }

    let buffer = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      if (this.current.jobId !== jobId) {
        return;
      }
      buffer += chunk;

      while (true) {
        const boundaryIndex = buffer.search(/[\r\n]/);
        if (boundaryIndex < 0) {
          break;
        }

        const boundaryChar = buffer[boundaryIndex];
        const boundaryLength =
          boundaryChar === "\r" && buffer[boundaryIndex + 1] === "\n"
            ? 2
            : 1;
        const line = buffer.slice(0, boundaryIndex).trimEnd();
        buffer = buffer.slice(boundaryIndex + boundaryLength);
        if (line) {
          this.appendLog(line);
        }
      }
    });

    stream.on("end", () => {
      const rest = buffer.trim();
      if (rest && this.current.jobId === jobId) {
        this.appendLog(rest);
      }
    });
  }

  boolValue(value) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return Boolean(value);
    }
    return TRUE_VALUES.has(String(value ?? "").trim().toLowerCase());
  }

  intValue(value, { minimum = Number.NEGATIVE_INFINITY, maximum = Number.POSITIVE_INFINITY, fieldName }) {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    if (!Number.isFinite(parsed)) {
      throw new HttpError(400, `Field \`${fieldName}\` harus berupa bilangan bulat.`);
    }
    if (parsed < minimum) {
      throw new HttpError(400, `Field \`${fieldName}\` minimal ${minimum}.`);
    }
    if (parsed > maximum) {
      throw new HttpError(400, `Field \`${fieldName}\` maksimal ${maximum}.`);
    }
    return parsed;
  }

  floatValue(value, { minimum = Number.NEGATIVE_INFINITY, maximum = Number.POSITIVE_INFINITY, fieldName }) {
    const parsed = Number.parseFloat(String(value ?? "").trim());
    if (!Number.isFinite(parsed)) {
      throw new HttpError(400, `Field \`${fieldName}\` harus berupa angka.`);
    }
    if (parsed < minimum) {
      throw new HttpError(400, `Field \`${fieldName}\` minimal ${minimum}.`);
    }
    if (parsed > maximum) {
      throw new HttpError(400, `Field \`${fieldName}\` maksimal ${maximum}.`);
    }
    return parsed;
  }

  choiceValue(value, choices, fieldName) {
    const normalized = String(value ?? "").trim();
    if (!choices.has(normalized)) {
      throw new HttpError(400, `Field \`${fieldName}\` harus salah satu dari ${JSON.stringify([...choices].sort())}.`);
    }
    return normalized;
  }

  durationSeconds() {
    if (!this.current.startedAt) {
      return null;
    }
    const endedAt = this.current.finishedAt || Date.now();
    return Math.round(Math.max(0, endedAt - this.current.startedAt) / 10) / 100;
  }
}

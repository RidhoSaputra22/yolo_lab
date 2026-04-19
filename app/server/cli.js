/**
 * CLI argument parser & usage printer.
 */

import { DEFAULT_DATASET_DIR, DEFAULT_FRAMES_DIR, DEFAULT_LABELS_DIR } from "./constants.js";

export function parseCliArgs(argv) {
  const options = {
    framesDir: DEFAULT_FRAMES_DIR,
    labelsDir: DEFAULT_LABELS_DIR,
    datasetDir: DEFAULT_DATASET_DIR,
    host: "127.0.0.1",
    port: 8765,
    classNames: [],
  };

  const readValue = (index, currentArg) => {
    if (currentArg.includes("=")) {
      return currentArg.slice(currentArg.indexOf("=") + 1);
    }
    if (index + 1 >= argv.length) {
      throw new Error(`Argumen ${currentArg} membutuhkan nilai.`);
    }
    return argv[index + 1];
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--frames-dir" || arg.startsWith("--frames-dir=")) {
      options.framesDir = readValue(index, arg);
      if (!arg.includes("=")) {
        index += 1;
      }
      continue;
    }
    if (arg === "--labels-dir" || arg.startsWith("--labels-dir=")) {
      options.labelsDir = readValue(index, arg);
      if (!arg.includes("=")) {
        index += 1;
      }
      continue;
    }
    if (arg === "--dataset-dir" || arg.startsWith("--dataset-dir=")) {
      options.datasetDir = readValue(index, arg);
      if (!arg.includes("=")) {
        index += 1;
      }
      continue;
    }
    if (arg === "--host" || arg.startsWith("--host=")) {
      options.host = readValue(index, arg);
      if (!arg.includes("=")) {
        index += 1;
      }
      continue;
    }
    if (arg === "--port" || arg.startsWith("--port=")) {
      const value = readValue(index, arg);
      options.port = Number.parseInt(value, 10);
      if (!arg.includes("=")) {
        index += 1;
      }
      continue;
    }
    if (arg === "--class-name" || arg.startsWith("--class-name=")) {
      const value = readValue(index, arg);
      options.classNames.push(String(value).trim());
      if (!arg.includes("=")) {
        index += 1;
      }
      continue;
    }

    throw new Error(`Argumen tidak dikenal: ${arg}`);
  }

  return options;
}

export function printUsage() {
  console.log("");
  console.log("YOLO Lab Bun server");
  console.log("");
  console.log("Gunakan:");
  console.log("  bun yolo_lab/app/server.js [opsi]");
  console.log("");
  console.log("Opsi:");
  console.log("  --frames-dir <path>   Folder frame. Default: yolo_lab/train/frames");
  console.log("  --labels-dir <path>   Folder label. Default: yolo_lab/train/labels");
  console.log("  --dataset-dir <path>  Folder dataset. Default: yolo_lab/train/dataset");
  console.log("  --class-name <name>   Nama class, bisa dipakai berulang.");
  console.log("  --host <host>         Host bind. Default: 127.0.0.1");
  console.log("  --port <port>         Port bind. Default: 8765");
  console.log("");
  console.log("Hot Reload:");
  console.log("  Tekan r + Enter di terminal untuk reload server.");
  console.log("");
}

/**
 * Form layout & defaults untuk Training dan Autolabel.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_DATASET_DIR,
  DEFAULT_FRAMES_DIR,
  DEFAULT_LABELS_DIR,
  DEFAULT_TRAIN_OUTPUT_DIR,
  PROJECT_DIR,
} from "../constants.js";
import { displayPath } from "../paths.js";

function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return displayPath(candidate);
    }
  }
  return displayPath(candidates[0]);
}

function defaultTrainingModelPath() {
  return firstExistingPath([
    path.join(PROJECT_DIR, "model", "yolov5nu.pt"),
    path.join(PROJECT_DIR, "edge", "yolov5nu.pt"),
    path.join(PROJECT_DIR, "model", "yolov5s.pt"),
    path.join(PROJECT_DIR, "edge", "yolov5s.pt"),
  ]);
}

function defaultAutolabelModelPath() {
  return firstExistingPath([
    path.join(PROJECT_DIR, "model", "yolo26x.pt"),
    path.join(PROJECT_DIR, "edge", "yolo26x.pt"),
    path.join(PROJECT_DIR, "model", "yolo26n.pt"),
    path.join(PROJECT_DIR, "edge", "yolo26n.pt"),
    path.join(PROJECT_DIR, "model", "yolov5x6u.pt"),
    path.join(PROJECT_DIR, "edge", "yolov5x6u.pt"),
    path.join(PROJECT_DIR, "model", "yolov5nu.pt"),
    path.join(PROJECT_DIR, "edge", "yolov5nu.pt"),
    path.join(PROJECT_DIR, "model", "yolov5s.pt"),
    path.join(PROJECT_DIR, "edge", "yolov5s.pt"),
  ]);
}

export function defaultTrainingFormData() {
  return {
    framesDir: displayPath(DEFAULT_FRAMES_DIR),
    labelsDir: displayPath(DEFAULT_LABELS_DIR),
    datasetDir: displayPath(DEFAULT_DATASET_DIR),
    runsDir: displayPath(DEFAULT_TRAIN_OUTPUT_DIR),
    classNames: "person",
    trainModel: defaultTrainingModelPath(),
    imgsz: 640,
    epochs: 10,
    batch: 4,
    workers: 0,
    patience: 5,
    valRatio: 0.2,
    seed: 42,
    device: "cpu",
    runName: "visitor_person_cpu_bootstrap",
    allowEmptyLabels: false,
    cache: false,
  };
}

export function defaultLabelerAutolabelConfig() {
  return {
    model: defaultAutolabelModelPath(),
    conf: 0.35,
    imgsz: 960,
    device: "auto",
  };
}

export function trainingFormLayout({ includeFramesDirField = true } = {}) {
  const pathFields = [
    ...(includeFramesDirField
      ? [
          {
            name: "framesDir",
            label: "Frames directory",
            type: "path",
            required: true,
            helpText: "Folder output frame hasil ekstraksi.",
          },
        ]
      : []),
    {
      name: "labelsDir",
      label: "Labels directory",
      type: "path",
      required: true,
      helpText: "Folder file label YOLO (.txt) per frame. Default akan mengikuti subfolder frame aktif.",
    },
    {
      name: "datasetDir",
      label: "Dataset directory",
      type: "path",
      required: true,
      helpText: "Folder dataset YOLO train/val yang akan dibuat.",
    },
    {
      name: "runsDir",
      label: "Runs directory",
      type: "path",
      required: true,
      helpText: "Folder output training Ultralytics.",
    },
    {
      name: "classNames",
      label: "Class names",
      type: "text",
      placeholder: "person, helmet",
      helpText: "Pisahkan dengan koma bila multi-class. Default tetap `person` bila dikosongkan.",
    },
  ];

  return [
    {
      id: "paths",
      title: "Path Dataset",
      description: "Folder frame, label, dataset, dan hasil run training yang sudah siap dipakai.",
      fields: pathFields,
    },
    {
      id: "dataset",
      title: "Dataset Split",
      description: "Bangun ulang dataset train/val dari label yang sudah kamu rapikan secara manual.",
      fields: [
        {
          name: "valRatio",
          label: "Validation ratio",
          type: "float",
          helpText: "Proporsi data validasi, mis. 0.2 = 20%.",
        },
        {
          name: "seed",
          label: "Seed",
          type: "int",
          helpText: "Seed shuffle saat prepare dataset.",
        },
        {
          name: "allowEmptyLabels",
          label: "Allow empty labels",
          type: "bool",
          helpText: "Buat label kosong untuk frame tanpa objek.",
        },
      ],
    },
    {
      id: "training",
      title: "Training",
      description: "Jalankan prepare lalu training tanpa auto-label ulang, jadi label manual tidak di-reset.",
      fields: [
        {
          name: "trainModel",
          label: "Train model",
          type: "path",
          helpText: "Bobot awal untuk tahap training.",
        },
        {
          name: "imgsz",
          label: "Image size",
          type: "int",
          helpText: "Ukuran image training.",
        },
        {
          name: "epochs",
          label: "Epochs",
          type: "int",
          helpText: "Jumlah epoch training.",
        },
        {
          name: "batch",
          label: "Batch",
          type: "int",
          helpText: "Batch size training.",
        },
        {
          name: "workers",
          label: "Workers",
          type: "int",
          helpText: "Jumlah dataloader worker.",
        },
        {
          name: "patience",
          label: "Patience",
          type: "int",
          helpText: "Early stopping patience.",
        },
        {
          name: "runName",
          label: "Run name",
          type: "text",
          placeholder: "visitor_person_cpu_bootstrap",
          helpText: "Nama folder run output.",
        },
        {
          name: "device",
          label: "Device",
          type: "text",
          placeholder: "cpu / auto / cuda:0",
          helpText: "Device training, mis. cpu, auto, atau cuda:0.",
        },
        {
          name: "cache",
          label: "Cache dataset",
          type: "bool",
          helpText: "Aktifkan cache image saat training bila resource cukup.",
        },
      ],
    },
  ];
}

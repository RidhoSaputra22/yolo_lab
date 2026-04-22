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
    iou: 0.45,
    imgsz: 960,
    device: "auto",
    suppressNestedDuplicates: true,
    duplicateContainmentThreshold: 0.9,
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
            helpText:
              "Folder sumber frame hasil ekstraksi yang akan dipasangkan dengan label manual. Training akan membaca gambar dari sini saat membangun dataset.",
          },
        ]
      : []),
    {
      name: "labelsDir",
      label: "Labels directory",
      type: "path",
      required: true,
      helpText:
        "Folder file label YOLO (`.txt`) untuk setiap frame. Pastikan pasangan folder ini sesuai dengan `framesDir`; pasangan yang salah bisa membuat gambar dan label tidak sinkron.",
    },
    {
      name: "datasetDir",
      label: "Dataset directory",
      type: "path",
      required: true,
      helpText:
        "Folder keluaran dataset YOLO `train/val` yang dibangun saat tahap prepare. Isi folder ini dipakai langsung oleh proses training berikutnya.",
    },
    {
      name: "runsDir",
      label: "Runs directory",
      type: "path",
      required: true,
      helpText:
        "Folder hasil training Ultralytics seperti `weights`, grafik, dan metrics. Gunakan lokasi yang rapi agar perbandingan eksperimen lebih mudah.",
    },
    {
      name: "classNames",
      label: "Class names",
      type: "text",
      placeholder: "person, helmet",
      helpText:
        "Daftar class dipisah koma, misalnya `person, helmet`. Urutan nama ini menentukan indeks class pada file label dan output model; jika kosong, sistem tetap memakai `person`.",
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
          helpText:
            "Menentukan proporsi data yang dipindah ke set validasi saat split dataset. Contoh `0.2` berarti 20% data dipakai mengecek kemampuan generalisasi; terlalu kecil membuat evaluasi kurang stabil, terlalu besar mengurangi jatah data latih.",
        },
        {
          name: "seed",
          label: "Seed",
          type: "int",
          helpText:
            "Angka acak untuk shuffle saat membagi data train/val. Pakai seed yang sama bila kamu ingin split tetap konsisten dan hasil eksperimen mudah dibandingkan.",
        },
        {
          name: "allowEmptyLabels",
          label: "Allow empty labels",
          type: "bool",
          helpText:
            "Jika aktif, frame tanpa objek tetap dibuatkan file label kosong agar ikut masuk dataset sebagai contoh background. Berguna untuk data nyata, tetapi terlalu banyak frame kosong bisa membuat model lebih sering memprediksi tidak ada objek.",
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
          helpText:
            "Bobot awal (`.pt`) yang dipakai sebagai titik mulai training. Model awal yang lebih dekat dengan domain data biasanya membuat konvergensi lebih cepat dan hasil lebih stabil.",
        },
        {
          name: "imgsz",
          label: "Image size",
          type: "int",
          helpText:
            "Resolusi gambar saat training. Nilai lebih besar bisa membantu objek kecil terbaca lebih baik, tetapi waktu train dan kebutuhan VRAM/RAM ikut meningkat.",
        },
        {
          name: "epochs",
          label: "Epochs",
          type: "int",
          helpText:
            "Jumlah putaran training ke seluruh dataset. Terlalu sedikit bisa membuat model underfit, sedangkan terlalu banyak berisiko overfit bila tidak dibatasi `patience`.",
        },
        {
          name: "batch",
          label: "Batch",
          type: "int",
          helpText:
            "Jumlah gambar yang diproses per iterasi. Batch lebih besar membuat training lebih stabil dan cepat, tetapi membutuhkan memori lebih besar.",
        },
        {
          name: "workers",
          label: "Workers",
          type: "int",
          helpText:
            "Jumlah worker dataloader untuk menyiapkan batch di sisi CPU. Nilai lebih tinggi bisa mempercepat loading data, tetapi terlalu besar dapat membebani RAM/CPU.",
        },
        {
          name: "patience",
          label: "Patience",
          type: "int",
          helpText:
            "Jumlah epoch tanpa peningkatan sebelum early stopping menghentikan training. Nilai kecil membuat proses cepat berhenti, nilai besar memberi model lebih banyak kesempatan belajar.",
        },
        {
          name: "runName",
          label: "Run name",
          type: "text",
          placeholder: "visitor_person_cpu_bootstrap",
          helpText:
            "Nama folder output eksperimen training. Gunakan nama yang deskriptif agar hasil run mudah dikenali dan dibandingkan.",
        },
        {
          name: "device",
          label: "Device",
          type: "text",
          placeholder: "cpu / auto / cuda:0",
          helpText:
            "Perangkat eksekusi training, misalnya `cpu`, `auto`, atau `cuda:0`. GPU mempercepat training bila tersedia, sedangkan `auto` membiarkan sistem memilih device yang cocok.",
        },
        {
          name: "cache",
          label: "Cache dataset",
          type: "bool",
          helpText:
            "Jika aktif, dataset di-cache agar epoch berikutnya lebih cepat. Cocok saat RAM atau storage cukup, tetapi hindari bila resource mesin terbatas.",
        },
      ],
    },
  ];
}

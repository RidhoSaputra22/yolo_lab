/**
 * Form layout & defaults untuk import footage dan ekstraksi frame.
 */

import { DEFAULT_FRAMES_DIR, DEFAULT_TEST_INPUT_DIR } from "../constants.js";
import { displayPath } from "../paths.js";

export function defaultFootageFormData() {
  return {
    footageDir: displayPath(DEFAULT_TEST_INPUT_DIR),
    framesDir: displayPath(DEFAULT_FRAMES_DIR),
    sampleEvery: 15,
    maxFramesPerVideo: 0,
    jpegQuality: 95,
    overwriteFrames: false,
  };
}

export function footageFormLayout() {
  return [
    {
      id: "paths",
      title: "Path Footage",
      description: "Folder video mentah dan folder output frame hasil ekstraksi.",
      fields: [
        {
          name: "footageDir",
          label: "Footage directory",
          type: "path",
          required: true,
          helpText:
            "Folder sumber video mentah yang akan discan saat ekstraksi frame. Menjaga footage terpusat di sini memudahkan batch extract dan audit file asal.",
        },
        {
          name: "framesDir",
          label: "Frames directory",
          type: "path",
          required: true,
          helpText:
            "Folder root penyimpanan hasil extract. Sistem akan membuat subfolder baru di bawah path ini agar hasil lama tidak tertimpa tanpa sengaja.",
        },
      ],
    },
    {
      id: "extract",
      title: "Ekstraksi Frame",
      description: "Atur step frame, limit, dan kualitas JPEG saat extract.",
      fields: [
        {
          name: "sampleEvery",
          label: "Frame step",
          type: "int",
          helpText:
            "Ambil 1 frame tiap N frame. Nilai lebih besar membuat proses lebih cepat dan dataset lebih kecil, tetapi momen penting bisa lebih mudah terlewat.",
        },
        {
          name: "maxFramesPerVideo",
          label: "Max frames per video",
          type: "int",
          helpText:
            "Batas jumlah frame yang diambil dari setiap video. Isi `0` untuk tanpa batas; nilai kecil cocok saat ingin membuat sampel dataset dengan cepat.",
        },
        {
          name: "jpegQuality",
          label: "JPEG quality",
          type: "int",
          helpText:
            "Kualitas kompresi JPEG dari `1` sampai `100`. Nilai tinggi menjaga detail objek lebih baik, tetapi ukuran file hasil juga ikut membesar.",
        },
        {
          name: "overwriteFrames",
          label: "Overwrite frames lama",
          type: "bool",
          helpText:
            "Jika aktif, isi folder frame lama akan dibersihkan sebelum ekstraksi ulang. Gunakan saat kamu yakin hasil sebelumnya memang ingin diganti.",
        },
      ],
    },
  ];
}

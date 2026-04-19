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
          helpText: "Video mentah disimpan di sini. Default: `train/footage`.",
        },
        {
          name: "framesDir",
          label: "Frames directory",
          type: "path",
          required: true,
          helpText:
            "Subfolder output dibuat otomatis di bawah path ini dengan format `frame_YYYYMMDD_jumlahFrame`.",
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
          helpText: "Ambil 1 frame tiap N frame. Mis. 15 berarti 0, 15, 30, dan seterusnya.",
        },
        {
          name: "maxFramesPerVideo",
          label: "Max frames per video",
          type: "int",
          helpText: "0 berarti tanpa batas.",
        },
        {
          name: "jpegQuality",
          label: "JPEG quality",
          type: "int",
          helpText: "Kualitas output JPEG 1..100.",
        },
        {
          name: "overwriteFrames",
          label: "Overwrite frames lama",
          type: "bool",
          helpText: "Hapus isi folder frame lama sebelum ekstraksi ulang.",
        },
      ],
    },
  ];
}

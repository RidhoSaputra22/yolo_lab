/**
 * Form layout & defaults untuk Test (offline video runner).
 */

import {
  DEFAULT_FACE_ID_AMBIGUITY_MARGIN,
  DEFAULT_FACE_ID_MATCH_THRESHOLD,
  DEFAULT_FACE_ID_MIN_TRACK_FRAMES,
  DEFAULT_FACE_ID_PROTOTYPE_ALPHA,
  DEFAULT_FACE_ID_STRONG_MATCH_THRESHOLD,
  DEFAULT_TEST_INPUT_DIR,
  DEFAULT_TEST_OUTPUT_DIR,
  EDGE_REFERENCE_SIZE,
  VIDEO_EXTENSIONS,
} from "../constants.js";
import { envValue } from "../env.js";
import { discoverFiles } from "../files.js";
import { displayPath, resolveProjectPath } from "../paths.js";

export function defaultTestFormData() {
  const defaultWeights = displayPath(resolveProjectPath(envValue("YOLOV5_WEIGHTS", ""), { allowEmpty: true }));
  const defaultInputCandidates = discoverFiles([DEFAULT_TEST_INPUT_DIR], VIDEO_EXTENSIONS, 1);
  return {
    input: defaultInputCandidates[0] || "",
    outputDir: displayPath(DEFAULT_TEST_OUTPUT_DIR),
    outputName: "",
    roiJson: envValue("DEFAULT_AREA_ROI_POLYGON", ""),
    frameWidth: EDGE_REFERENCE_SIZE.width,
    frameHeight: EDGE_REFERENCE_SIZE.height,
    keepSourceSize: false,
    maxFrames: 0,
    maxSeconds: 0.0,
    frameStep: 1,
    outputFps: 0.0,
    imgSize: Number.parseInt(envValue("YOLOV5_IMG_SIZE", "512"), 10) || 512,
    forceCentroid: false,
    maxAge: Number.parseInt(envValue("TRACK_MAX_DISAPPEARED", "20"), 10) || 20,
    nInit: Number.parseInt(envValue("TRACK_CONFIRM_FRAMES", "1"), 10) || 1,
    maxDistance: Number.parseFloat(envValue("TRACK_MAX_DISTANCE", "80")) || 80,
    maxCosineDistance: 0.3,
    identityMode: "reid",
    backend: envValue("YOLO_BACKEND", "yolov5") || "yolov5",
    weights: defaultWeights,
    device: envValue("YOLOV5_DEVICE", "auto") || "auto",
    reidMatchThreshold: Number.parseFloat(envValue("REID_MATCH_THRESHOLD", "0.77")) || 0.77,
    reidMinTrackFrames: Number.parseInt(envValue("REID_MIN_TRACK_FRAMES", "3"), 10) || 3,
    reidStrongMatchThreshold:
      Number.parseFloat(envValue("REID_STRONG_MATCH_THRESHOLD", "0.86")) || 0.86,
    reidAmbiguityMargin: Number.parseFloat(envValue("REID_AMBIGUITY_MARGIN", "0.04")) || 0.04,
    reidPrototypeAlpha: Number.parseFloat(envValue("REID_PROTOTYPE_ALPHA", "0.18")) || 0.18,
    withFaceRecognition: false,
    faceIdMatchThreshold: DEFAULT_FACE_ID_MATCH_THRESHOLD,
    faceIdMinTrackFrames: DEFAULT_FACE_ID_MIN_TRACK_FRAMES,
    faceIdStrongMatchThreshold: DEFAULT_FACE_ID_STRONG_MATCH_THRESHOLD,
    faceIdAmbiguityMargin: DEFAULT_FACE_ID_AMBIGUITY_MARGIN,
    faceIdPrototypeAlpha: DEFAULT_FACE_ID_PROTOTYPE_ALPHA,
  };
}

export function testFormLayout() {
  return [
    {
      id: "source",
      title: "Sumber & Output",
      description: "Video input, folder hasil, dan ROI runner offline.",
      fields: [
        { name: "input", label: "Input video", type: "path", required: true },
        { name: "outputDir", label: "Output directory", type: "path", required: true },
        { name: "outputName", label: "Output name prefix", type: "text" },
        { name: "roiJson", label: "ROI JSON", type: "textarea" },
      ],
    },
    {
      id: "frames",
      title: "Frame & Inferensi",
      description: "Ukuran output, sampling frame, dan ukuran inferensi YOLO.",
      fields: [
        { name: "frameWidth", label: "Frame width", type: "int" },
        { name: "frameHeight", label: "Frame height", type: "int" },
        { name: "keepSourceSize", label: "Keep source size", type: "bool" },
        { name: "maxFrames", label: "Max frames", type: "int" },
        { name: "maxSeconds", label: "Max seconds", type: "float" },
        { name: "frameStep", label: "Frame step", type: "int" },
        { name: "outputFps", label: "Output FPS", type: "float" },
        { name: "imgSize", label: "YOLO img size", type: "int" },
      ],
    },
    {
      id: "tracker",
      title: "Tracker",
      description: "Parameter DeepSORT atau fallback CentroidTracker.",
      fields: [
        { name: "forceCentroid", label: "Paksa CentroidTracker", type: "bool" },
        { name: "maxAge", label: "Max age", type: "int" },
        { name: "nInit", label: "n_init", type: "int" },
        { name: "maxDistance", label: "Max distance", type: "float" },
        { name: "maxCosineDistance", label: "Max cosine distance", type: "float" },
      ],
    },
    {
      id: "model",
      title: "Model & Identitas",
      description: "Backend YOLO, bobot, device, dan mode identitas visitor.",
      fields: [
        {
          name: "backend",
          label: "Backend",
          type: "select",
          choices: ["yolov5", "ultralytics"],
        },
        { name: "weights", label: "Weights", type: "path" },
        { name: "device", label: "Device", type: "text" },
        {
          name: "identityMode",
          label: "Identity mode",
          type: "select",
          choices: ["reid", "face"],
        },
        { name: "withFaceRecognition", label: "Aktifkan face recognition", type: "bool" },
      ],
    },
    {
      id: "reid",
      title: "Tuning reID",
      description: "Selalu tersedia untuk mode reID dan tetap dipakai sebagai fallback env override.",
      fields: [
        { name: "reidMatchThreshold", label: "Match threshold", type: "float" },
        { name: "reidMinTrackFrames", label: "Min track frames", type: "int" },
        { name: "reidStrongMatchThreshold", label: "Strong match threshold", type: "float" },
        { name: "reidAmbiguityMargin", label: "Ambiguity margin", type: "float" },
        { name: "reidPrototypeAlpha", label: "Prototype alpha", type: "float" },
      ],
    },
    {
      id: "face",
      title: "Tuning face identity",
      description: "Dipakai saat identity mode = face.",
      fields: [
        { name: "faceIdMatchThreshold", label: "Face match threshold", type: "float" },
        { name: "faceIdMinTrackFrames", label: "Face min track frames", type: "int" },
        {
          name: "faceIdStrongMatchThreshold",
          label: "Face strong match threshold",
          type: "float",
        },
        { name: "faceIdAmbiguityMargin", label: "Face ambiguity margin", type: "float" },
        { name: "faceIdPrototypeAlpha", label: "Face prototype alpha", type: "float" },
      ],
    },
  ];
}

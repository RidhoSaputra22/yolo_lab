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
        {
          name: "input",
          label: "Input video",
          type: "path",
          required: true,
          helpText:
            "File video yang akan dianalisis oleh runner offline. Pilih sumber uji yang ingin diproses tanpa mengubah file asli.",
        },
        {
          name: "outputDir",
          label: "Output directory",
          type: "path",
          required: true,
          helpText:
            "Folder penyimpanan hasil run seperti video keluaran, log, dan artefak analitik. Gunakan folder terpisah agar hasil eksperimen mudah dibandingkan.",
        },
        {
          name: "outputName",
          label: "Output name prefix",
          type: "text",
          helpText:
            "Awalan nama file output. Kosongkan bila ingin sistem memakai nama default dari video input.",
        },
        {
          name: "roiJson",
          label: "ROI JSON",
          type: "textarea",
          helpText:
            "Polygon area yang membatasi wilayah analisis. Kosong berarti seluruh frame diproses; ROI yang terlalu sempit bisa membuat objek di luar area diabaikan.",
        },
      ],
    },
    {
      id: "frames",
      title: "Frame & Inferensi",
      description: "Ukuran output, sampling frame, dan ukuran inferensi YOLO.",
      fields: [
        {
          name: "frameWidth",
          label: "Frame width",
          type: "int",
          helpText:
            "Lebar video output dalam piksel. Nilai ini dipakai saat resize hasil, kecuali jika `Keep source size` diaktifkan.",
        },
        {
          name: "frameHeight",
          label: "Frame height",
          type: "int",
          helpText:
            "Tinggi video output dalam piksel. Pasangkan dengan `Frame width` untuk menentukan resolusi hasil runner.",
        },
        {
          name: "keepSourceSize",
          label: "Keep source size",
          type: "bool",
          helpText:
            "Jika aktif, output mengikuti resolusi asli video. Cocok untuk menjaga detail, tetapi ukuran file dan beban proses bisa lebih besar.",
        },
        {
          name: "maxFrames",
          label: "Max frames",
          type: "int",
          helpText:
            "Batas maksimum frame yang diproses. Isi `0` untuk memproses video sampai habis; nilai kecil cocok untuk uji cepat.",
        },
        {
          name: "maxSeconds",
          label: "Max seconds",
          type: "float",
          helpText:
            "Batas durasi video yang diproses dalam detik. Isi `0` untuk tanpa batas waktu.",
        },
        {
          name: "frameStep",
          label: "Frame step",
          type: "int",
          helpText:
            "Ambil 1 frame setiap N frame. Nilai lebih besar mempercepat proses, tetapi gerakan cepat dan kemunculan singkat objek bisa lebih mudah terlewat.",
        },
        {
          name: "outputFps",
          label: "Output FPS",
          type: "float",
          helpText:
            "FPS untuk video hasil. Isi `0` bila ingin memakai FPS sumber atau default runner.",
        },
        {
          name: "imgSize",
          label: "YOLO img size",
          type: "int",
          helpText:
            "Ukuran input inferensi YOLO. Nilai lebih besar membantu objek kecil lebih terlihat, tetapi waktu inferensi dan kebutuhan memori ikut naik.",
        },
      ],
    },
    {
      id: "tracker",
      title: "Tracker",
      description: "Parameter DeepSORT atau fallback CentroidTracker.",
      fields: [
        {
          name: "forceCentroid",
          label: "Paksa CentroidTracker",
          type: "bool",
          helpText:
            "Lewati DeepSORT dan pakai CentroidTracker langsung. Lebih ringan, tetapi identitas antar frame biasanya kurang stabil.",
        },
        {
          name: "maxAge",
          label: "Max age",
          type: "int",
          helpText:
            "Jumlah frame maksimum track boleh hilang sebelum dianggap selesai. Nilai besar lebih toleran terhadap occlusion, tetapi bisa menahan track salah lebih lama.",
        },
        {
          name: "nInit",
          label: "n_init",
          type: "int",
          helpText:
            "Jumlah frame minimum sebelum track dianggap valid. Nilai lebih besar membantu menyaring noise, tetapi objek yang muncul singkat bisa tidak tercatat.",
        },
        {
          name: "maxDistance",
          label: "Max distance",
          type: "float",
          helpText:
            "Batas jarak perpindahan objek antar frame saat asosiasi track. Terlalu kecil membuat track mudah putus, terlalu besar bisa menukar identitas objek yang berdekatan.",
        },
        {
          name: "maxCosineDistance",
          label: "Max cosine distance",
          type: "float",
          helpText:
            "Ambang perbedaan fitur appearance untuk pencocokan DeepSORT/reID. Nilai kecil lebih ketat menjaga identitas, nilai besar lebih toleran tetapi rawan salah gabung.",
        },
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
          helpText:
            "Engine YOLO yang dipakai untuk inferensi. Pilih sesuai format bobot dan pipeline yang sudah kamu siapkan.",
        },
        {
          name: "weights",
          label: "Weights",
          type: "path",
          helpText: "Path bobot model deteksi yang akan dipakai saat testing.",
        },
        {
          name: "device",
          label: "Device",
          type: "text",
          helpText:
            "Perangkat inferensi seperti `cpu`, `auto`, atau `cuda:0`. GPU memberi proses lebih cepat bila tersedia.",
        },
        {
          name: "identityMode",
          label: "Identity mode",
          type: "select",
          choices: ["reid", "face"],
          helpText:
            "Strategi pelacakan identitas visitor. `reid` mengandalkan fitur penampilan, sedangkan `face` menekankan verifikasi berbasis wajah.",
        },
        {
          name: "withFaceRecognition",
          label: "Aktifkan face recognition",
          type: "bool",
          helpText:
            "Mengaktifkan pembanding identitas berbasis wajah jika pipeline face tersedia. Berguna untuk memperkuat identitas, tetapi menambah beban proses.",
        },
      ],
    },
    {
      id: "reid",
      title: "Tuning reID",
      description: "Selalu tersedia untuk mode reID dan tetap dipakai sebagai fallback env override.",
      fields: [
        {
          name: "reidMatchThreshold",
          label: "Match threshold",
          type: "float",
          helpText:
            "Ambang minimum kemiripan agar track dianggap milik identitas yang sama. Naikkan untuk keputusan lebih ketat, turunkan untuk lebih toleran.",
        },
        {
          name: "reidMinTrackFrames",
          label: "Min track frames",
          type: "int",
          helpText:
            "Jumlah frame minimum sebelum fitur track dianggap cukup stabil untuk matching identitas.",
        },
        {
          name: "reidStrongMatchThreshold",
          label: "Strong match threshold",
          type: "float",
          helpText:
            "Ambang kemiripan tinggi untuk mengunci match yang sangat yakin. Nilai besar mengurangi false positive, tetapi juga bisa menambah kasus belum cocok.",
        },
        {
          name: "reidAmbiguityMargin",
          label: "Ambiguity margin",
          type: "float",
          helpText:
            "Jarak minimum antara kandidat terbaik dan kandidat kedua. Margin lebih besar mengurangi match ambigu, tetapi membuat sistem lebih sering menunda keputusan.",
        },
        {
          name: "reidPrototypeAlpha",
          label: "Prototype alpha",
          type: "float",
          helpText:
            "Kecepatan pembaruan representasi fitur identitas. Nilai kecil lebih stabil, nilai besar lebih cepat beradaptasi terhadap perubahan tampilan.",
        },
      ],
    },
    {
      id: "face",
      title: "Tuning face identity",
      description: "Dipakai saat identity mode = face.",
      fields: [
        {
          name: "faceIdMatchThreshold",
          label: "Face match threshold",
          type: "float",
          helpText:
            "Ambang minimum kemiripan wajah agar track dianggap identik. Nilai lebih tinggi lebih ketat, nilai lebih rendah lebih permisif.",
        },
        {
          name: "faceIdMinTrackFrames",
          label: "Face min track frames",
          type: "int",
          helpText:
            "Jumlah frame minimum sebelum identitas wajah dianggap cukup meyakinkan untuk dipakai sebagai keputusan.",
        },
        {
          name: "faceIdStrongMatchThreshold",
          label: "Face strong match threshold",
          type: "float",
          helpText:
            "Ambang kemiripan wajah yang sangat yakin. Cocok untuk kasus saat kamu ingin lock identitas hanya ketika confidence benar-benar tinggi.",
        },
        {
          name: "faceIdAmbiguityMargin",
          label: "Face ambiguity margin",
          type: "float",
          helpText:
            "Selisih minimum antara kandidat wajah terbaik dan berikutnya. Margin besar menekan keputusan ambigu, tetapi bisa membuat hasil lebih konservatif.",
        },
        {
          name: "faceIdPrototypeAlpha",
          label: "Face prototype alpha",
          type: "float",
          helpText:
            "Kecepatan pembaruan representasi wajah per identitas. Nilai kecil lebih stabil, nilai besar lebih cepat mengikuti perubahan pose atau pencahayaan.",
        },
      ],
    },
  ];
}

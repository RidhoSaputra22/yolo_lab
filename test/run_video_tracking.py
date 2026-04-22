#!/usr/bin/env python3
"""Offline video test harness for YOLO + DeepSORT + reID."""

from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple


PROJECT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = PROJECT_DIR / "test" / "edge" / "output"
DEFAULT_EMPLOYEE_FACES_DIR = PROJECT_DIR / "petugas"
EDGE_REFERENCE_SIZE = (1280, 720)
DEFAULT_EMPLOYEE_MATCH_THRESHOLD = 0.45
DEFAULT_FACE_ID_MATCH_THRESHOLD = 0.55
DEFAULT_FACE_ID_MIN_TRACK_FRAMES = 3
DEFAULT_FACE_ID_STRONG_MATCH_THRESHOLD = 0.65
DEFAULT_FACE_ID_AMBIGUITY_MARGIN = 0.03
DEFAULT_FACE_ID_PROTOTYPE_ALPHA = 0.18


def _resolve_project_path(value: str) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = PROJECT_DIR / path
    return path.resolve()


def _slugify(value: str) -> str:
    cleaned = []
    for char in value.strip().lower():
        if char.isalnum():
            cleaned.append(char)
        elif char in {"-", "_", "."}:
            cleaned.append("_")
        else:
            cleaned.append("_")
    slug = "".join(cleaned).strip("_")
    while "__" in slug:
        slug = slug.replace("__", "_")
    return slug or "default"


def _model_label(backend: str, weights: str) -> str:
    backend_slug = _slugify(backend or "model")
    if weights:
        weight_name = Path(weights).stem
    else:
        weight_name = "default_weights"
    weight_slug = _slugify(weight_name)
    return f"{backend_slug}_{weight_slug}"


def _build_output_stem(name_prefix: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{name_prefix}_{timestamp}"


def _bootstrap_runtime(argv: Sequence[str]) -> None:
    """Apply CLI overrides before importing edge modules that read .env."""
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--weights")
    parser.add_argument("--backend", choices=("yolov5", "ultralytics"))
    parser.add_argument("--device")
    parser.add_argument("--yolo-conf", type=float)
    parser.add_argument("--yolo-iou", type=float)
    parser.add_argument("--test-mode", choices=("video", "face-benchmark"), default="video")
    parser.add_argument("--face-registry-source", choices=("backend", "folder"), default="folder")
    parser.add_argument("--employee-faces-dir")
    parser.add_argument("--employee-match-threshold", type=float, default=DEFAULT_EMPLOYEE_MATCH_THRESHOLD)
    parser.add_argument("--identity-mode", choices=("reid", "face"), default="reid")
    parser.add_argument("--reid-match-threshold", type=float)
    parser.add_argument("--reid-min-track-frames", type=int)
    parser.add_argument("--reid-strong-match-threshold", type=float)
    parser.add_argument("--reid-ambiguity-margin", type=float)
    parser.add_argument("--reid-prototype-alpha", type=float)
    parser.add_argument("--face-id-match-threshold", type=float, default=DEFAULT_FACE_ID_MATCH_THRESHOLD)
    parser.add_argument("--face-id-min-track-frames", type=int, default=DEFAULT_FACE_ID_MIN_TRACK_FRAMES)
    parser.add_argument(
        "--face-id-strong-match-threshold",
        type=float,
        default=DEFAULT_FACE_ID_STRONG_MATCH_THRESHOLD,
    )
    parser.add_argument(
        "--face-id-ambiguity-margin",
        type=float,
        default=DEFAULT_FACE_ID_AMBIGUITY_MARGIN,
    )
    parser.add_argument("--face-id-prototype-alpha", type=float, default=DEFAULT_FACE_ID_PROTOTYPE_ALPHA)
    parser.add_argument("--with-face-recognition", action="store_true")
    args, _ = parser.parse_known_args(argv)

    if args.weights:
        os.environ["YOLOV5_WEIGHTS"] = str(_resolve_project_path(args.weights))
    if args.backend:
        os.environ["YOLO_BACKEND"] = args.backend
    if args.device:
        os.environ["YOLOV5_DEVICE"] = args.device
    if args.yolo_conf is not None:
        os.environ["YOLOV5_CONF"] = str(args.yolo_conf)
    if args.yolo_iou is not None:
        os.environ["YOLOV5_IOU"] = str(args.yolo_iou)
    if args.employee_match_threshold is not None:
        os.environ["EMPLOYEE_MATCH_THRESHOLD"] = str(args.employee_match_threshold)
    if args.reid_match_threshold is not None:
        os.environ["REID_MATCH_THRESHOLD"] = str(args.reid_match_threshold)
    if args.reid_min_track_frames is not None:
        os.environ["REID_MIN_TRACK_FRAMES"] = str(args.reid_min_track_frames)
    if args.reid_strong_match_threshold is not None:
        os.environ["REID_STRONG_MATCH_THRESHOLD"] = str(args.reid_strong_match_threshold)
    if args.reid_ambiguity_margin is not None:
        os.environ["REID_AMBIGUITY_MARGIN"] = str(args.reid_ambiguity_margin)
    if args.reid_prototype_alpha is not None:
        os.environ["REID_PROTOTYPE_ALPHA"] = str(args.reid_prototype_alpha)
    if args.test_mode == "face-benchmark" or args.identity_mode == "face":
        os.environ["FACE_RECOGNITION_ENABLED"] = "true"
        if args.reid_match_threshold is None:
            os.environ["REID_MATCH_THRESHOLD"] = str(args.face_id_match_threshold)
        if args.reid_min_track_frames is None:
            os.environ["REID_MIN_TRACK_FRAMES"] = str(args.face_id_min_track_frames)
        if args.reid_strong_match_threshold is None:
            os.environ["REID_STRONG_MATCH_THRESHOLD"] = str(args.face_id_strong_match_threshold)
        if args.reid_ambiguity_margin is None:
            os.environ["REID_AMBIGUITY_MARGIN"] = str(args.face_id_ambiguity_margin)
        if args.reid_prototype_alpha is None:
            os.environ["REID_PROTOTYPE_ALPHA"] = str(args.face_id_prototype_alpha)
    elif not args.with_face_recognition:
        os.environ["FACE_RECOGNITION_ENABLED"] = "false"

    configured_weights = os.getenv("YOLOV5_WEIGHTS", "").strip()
    resolved_weights = _resolve_project_path(configured_weights) if configured_weights else None
    fallback_weights = PROJECT_DIR / "edge" / "yolov5s.pt"

    if (not configured_weights or not resolved_weights or not resolved_weights.exists()) and fallback_weights.exists():
        os.environ["YOLOV5_WEIGHTS"] = str(fallback_weights)
        if not args.backend:
            os.environ["YOLO_BACKEND"] = "yolov5"


_bootstrap_runtime(sys.argv[1:])

if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

import cv2
import numpy as np

from edge.core.api_client import get_employee_registry, login_token
from edge.core.config import CAMERA_ID, IMG_SIZE, TRACK_CONFIRM_FRAMES, TRACK_MAX_DISAPPEARED, TRACK_MAX_DISTANCE
from edge.core.detection import load_model, parse_roi, point_in_roi, suppress_duplicate_person_detections
from edge.core.face_recognition import EmployeeFaceRecognizer, FACE_IMAGE_EXTENSIONS, derive_employee_label
from edge.core.reid import (
    canonicalize_visitor_key,
    cleanup_old_tracks,
    get_cache_stats,
    get_reid_config,
    reset_daily_cache,
    update_track_identity,
)
from edge.core.tracker import CentroidTracker, DEEPSORT_AVAILABLE, DeepSORTTracker
from edge.core.visualization import draw_info_overlay, draw_roi_polygon


TRACK_CSV_FIELDS = [
    "frame_index",
    "time_seconds",
    "track_id",
    "visitor_key",
    "visitor_key_short",
    "reid_source",
    "reid_identity_status",
    "reid_embedding_samples",
    "reid_match_similarity",
    "reid_match_margin",
    "track_backend",
    "roi_status",
    "event",
    "unique_status",
    "person_type",
    "employee_id",
    "employee_code",
    "employee_name",
    "match_score",
    "x1",
    "y1",
    "x2",
    "y2",
    "centroid_x",
    "centroid_y",
    "confidence",
    "embedding_available",
]

FACE_BENCHMARK_CSV_FIELDS = [
    "file_name",
    "image_path",
    "true_label",
    "predicted_label",
    "match_score",
    "is_correct",
    "same_label_reference_count",
    "registry_label_count",
    "issue",
]


def _identity_embedding_source(identity_mode: str) -> str:
    return "face_embedding" if identity_mode == "face" else "body_track_embedding"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Test YOLO + DeepSORT + reID on a local video and export annotated video + CSV.",
    )
    parser.add_argument(
        "--test-mode",
        choices=("video", "face-benchmark"),
        default="video",
        help="Mode `video` untuk runner offline biasa, `face-benchmark` untuk evaluasi folder petugas.",
    )
    parser.add_argument("--input", default="", help="Path video input.")
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Folder keluaran untuk video, CSV, dan summary.",
    )
    parser.add_argument(
        "--output-name",
        default="",
        help="Prefix nama file output. Default: nama file video input.",
    )
    parser.add_argument(
        "--face-registry-source",
        choices=("backend", "folder"),
        default="folder",
        help="Sumber registry petugas untuk face recognition.",
    )
    parser.add_argument(
        "--employee-faces-dir",
        default=str(DEFAULT_EMPLOYEE_FACES_DIR),
        help="Folder gambar petugas berlabel nama file.",
    )
    parser.add_argument(
        "--employee-match-threshold",
        type=float,
        default=float(os.getenv("EMPLOYEE_MATCH_THRESHOLD", str(DEFAULT_EMPLOYEE_MATCH_THRESHOLD))),
        help="Threshold cosine similarity untuk pengenalan petugas.",
    )
    parser.add_argument(
        "--face-benchmark-allow-self-match",
        action="store_true",
        help="Pada mode face-benchmark, izinkan gambar query dicocokkan dengan file yang sama.",
    )
    parser.add_argument(
        "--roi-json",
        default="",
        help="ROI polygon JSON, contoh: [[50,50],[1230,50],[1230,670],[50,670]]",
    )
    parser.add_argument(
        "--frame-width",
        type=int,
        default=EDGE_REFERENCE_SIZE[0],
        help="Lebar frame output. Default menyesuaikan pipeline edge.",
    )
    parser.add_argument(
        "--frame-height",
        type=int,
        default=EDGE_REFERENCE_SIZE[1],
        help="Tinggi frame output. Default menyesuaikan pipeline edge.",
    )
    parser.add_argument(
        "--keep-source-size",
        action="store_true",
        help="Gunakan resolusi asli video input tanpa resize ke 1280x720.",
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=0,
        help="Batasi jumlah frame yang diproses. 0 = semua frame.",
    )
    parser.add_argument(
        "--max-seconds",
        type=float,
        default=0.0,
        help="Batasi durasi footage yang diproses dalam detik. 0 = proses sampai selesai.",
    )
    parser.add_argument(
        "--frame-step",
        type=int,
        default=1,
        help="Proses tiap N frame. Contoh 2 = ambil 1 frame tiap 2 frame.",
    )
    parser.add_argument(
        "--output-fps",
        type=float,
        default=0.0,
        help="FPS output. 0 = ikuti FPS video input (dibagi frame-step bila perlu).",
    )
    parser.add_argument(
        "--img-size",
        type=int,
        default=IMG_SIZE,
        help="Ukuran inferensi YOLO.",
    )
    parser.add_argument(
        "--yolo-conf",
        type=float,
        default=float(os.getenv("YOLOV5_CONF", "0.25")),
        help="Confidence minimum deteksi YOLO.",
    )
    parser.add_argument(
        "--yolo-iou",
        type=float,
        default=float(os.getenv("YOLOV5_IOU", "0.45")),
        help="IoU / NMS threshold YOLO untuk menekan box overlap.",
    )
    parser.add_argument(
        "--suppress-nested-duplicates",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Buang deteksi person nested seperti upper-body di dalam full-body sebelum tracking.",
    )
    parser.add_argument(
        "--duplicate-containment-threshold",
        type=float,
        default=0.9,
        help="Seberapa besar dua box harus saling menutupi agar dianggap duplikat nested.",
    )
    parser.add_argument(
        "--force-centroid",
        action="store_true",
        help="Paksa pakai CentroidTracker walau DeepSORT tersedia.",
    )
    parser.add_argument(
        "--max-age",
        type=int,
        default=TRACK_MAX_DISAPPEARED,
        help="Maksimum frame track boleh hilang sebelum dihapus.",
    )
    parser.add_argument(
        "--n-init",
        type=int,
        default=TRACK_CONFIRM_FRAMES,
        help="Jumlah konfirmasi awal track untuk DeepSORT.",
    )
    parser.add_argument(
        "--max-distance",
        type=float,
        default=TRACK_MAX_DISTANCE,
        help="Maksimum jarak centroid untuk fallback tracker.",
    )
    parser.add_argument(
        "--max-cosine-distance",
        type=float,
        default=0.3,
        help="Threshold cosine distance DeepSORT.",
    )
    parser.add_argument(
        "--identity-mode",
        choices=("reid", "face"),
        default="reid",
        help="Sumber embedding untuk identitas pengunjung unik.",
    )
    parser.add_argument(
        "--backend",
        choices=("yolov5", "ultralytics"),
        default=os.getenv("YOLO_BACKEND", "yolov5"),
        help="Override backend YOLO untuk sesi test ini.",
    )
    parser.add_argument(
        "--weights",
        default=os.getenv("YOLOV5_WEIGHTS", ""),
        help="Override file weights model untuk sesi test ini.",
    )
    parser.add_argument(
        "--device",
        default=os.getenv("YOLOV5_DEVICE", "auto"),
        help="Override device inferensi, misal cpu/cuda/xpu/auto.",
    )
    parser.add_argument(
        "--reid-match-threshold",
        type=float,
        default=float(os.getenv("REID_MATCH_THRESHOLD", "0.77")),
        help="Threshold similarity untuk merge reID antar track.",
    )
    parser.add_argument(
        "--reid-min-track-frames",
        type=int,
        default=int(os.getenv("REID_MIN_TRACK_FRAMES", "3")),
        help="Jumlah frame embedding sebelum track baru boleh dikunci sebagai visitor baru.",
    )
    parser.add_argument(
        "--reid-strong-match-threshold",
        type=float,
        default=float(os.getenv("REID_STRONG_MATCH_THRESHOLD", "0.86")),
        help="Similarity tinggi yang boleh langsung mengikat ke visitor lama tanpa menunggu banyak frame.",
    )
    parser.add_argument(
        "--reid-ambiguity-margin",
        type=float,
        default=float(os.getenv("REID_AMBIGUITY_MARGIN", "0.04")),
        help="Selisih similarity minimal antara kandidat terbaik dan kandidat kedua agar match dianggap jelas.",
    )
    parser.add_argument(
        "--reid-prototype-alpha",
        type=float,
        default=float(os.getenv("REID_PROTOTYPE_ALPHA", "0.18")),
        help="Bobot pembaruan prototype embedding visitor harian.",
    )
    parser.add_argument(
        "--with-face-recognition",
        action="store_true",
        help="Aktifkan klasifikasi wajah employee jika dependency tersedia.",
    )
    parser.add_argument(
        "--face-id-match-threshold",
        type=float,
        default=DEFAULT_FACE_ID_MATCH_THRESHOLD,
        help="Threshold similarity untuk merge identity bila --identity-mode=face.",
    )
    parser.add_argument(
        "--face-id-min-track-frames",
        type=int,
        default=DEFAULT_FACE_ID_MIN_TRACK_FRAMES,
        help="Jumlah sampel embedding wajah sebelum visitor baru dikunci bila --identity-mode=face.",
    )
    parser.add_argument(
        "--face-id-strong-match-threshold",
        type=float,
        default=DEFAULT_FACE_ID_STRONG_MATCH_THRESHOLD,
        help="Similarity tinggi untuk fast-match bila --identity-mode=face.",
    )
    parser.add_argument(
        "--face-id-ambiguity-margin",
        type=float,
        default=DEFAULT_FACE_ID_AMBIGUITY_MARGIN,
        help="Margin minimal antar kandidat face match bila --identity-mode=face.",
    )
    parser.add_argument(
        "--face-id-prototype-alpha",
        type=float,
        default=DEFAULT_FACE_ID_PROTOTYPE_ALPHA,
        help="Bobot update prototype embedding wajah bila --identity-mode=face.",
    )
    return parser


def _load_roi(roi_json: str, frame_width: int, frame_height: int) -> List[List[float]]:
    roi = parse_roi(roi_json) if roi_json else None
    if roi is None:
        roi = parse_roi(os.getenv("DEFAULT_AREA_ROI_POLYGON", ""))
    if roi is None:
        roi = [
            [0.0, 0.0],
            [float(frame_width - 1), 0.0],
            [float(frame_width - 1), float(frame_height - 1)],
            [0.0, float(frame_height - 1)],
        ]
    return _scale_roi(roi, frame_width, frame_height)


def _scale_roi(roi: List[List[float]], frame_width: int, frame_height: int) -> List[List[float]]:
    if not roi:
        return roi

    ref_w, ref_h = EDGE_REFERENCE_SIZE
    max_x = max(float(point[0]) for point in roi)
    max_y = max(float(point[1]) for point in roi)

    if frame_width == ref_w and frame_height == ref_h:
        return roi
    if max_x > ref_w or max_y > ref_h:
        return roi

    scale_x = frame_width / float(ref_w)
    scale_y = frame_height / float(ref_h)
    scaled: List[List[float]] = []
    for x, y in roi:
        scaled.append([round(float(x) * scale_x, 2), round(float(y) * scale_y, 2)])
    return scaled


def _bbox_iou(
    box_a: Tuple[float, float, float, float],
    box_b: Tuple[float, float, float, float],
) -> float:
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0.0, inter_x2 - inter_x1)
    inter_h = max(0.0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h
    if inter_area <= 0:
        return 0.0

    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    denom = area_a + area_b - inter_area
    if denom <= 0:
        return 0.0
    return inter_area / denom


def _match_detection_confidence(
    track_bbox: Tuple[float, float, float, float],
    detections: List[Tuple[float, float, float, float, float]],
) -> float:
    best_iou = 0.0
    best_conf = 0.0
    for detection in detections:
        bbox = (detection[0], detection[1], detection[2], detection[3])
        score = _bbox_iou(track_bbox, bbox)
        if score > best_iou:
            best_iou = score
            best_conf = float(detection[4])
    return round(best_conf, 4)


def _track_color(state: Dict[str, Any], in_roi: bool) -> Tuple[int, int, int]:
    person_type = state.get("person_type", "CUSTOMER")
    if state.get("reid_identity_status") == "PENDING":
        return (255, 255, 0)
    if person_type == "EMPLOYEE":
        return (255, 0, 0)
    if person_type == "UNKNOWN":
        return (0, 255, 255)
    if not in_roi:
        return (160, 160, 160)
    if state.get("unique_status") == "NEW":
        return (0, 255, 0)
    return (0, 165, 255)


def _draw_test_tracks(frame: np.ndarray, tracks: Dict[int, Any], visitor_states: Dict[int, Dict[str, Any]]) -> None:
    for track_id, track in tracks.items():
        if getattr(track, "disappeared", 0) > 0:
            continue

        state = visitor_states.get(track_id, {})
        in_roi = bool(state.get("in_roi", False))
        color = _track_color(state, in_roi)

        x1, y1, x2, y2 = [int(v) for v in track.bbox]
        label_parts = [f"T{track_id}"]
        if state.get("unique_status"):
            label_parts.append(str(state["unique_status"]))
        if state.get("roi_status"):
            label_parts.append(str(state["roi_status"]))
        if state.get("visitor_key_short"):
            label_parts.append(f"V:{state['visitor_key_short']}")
        if state.get("reid_identity_status") == "PENDING":
            label_parts.append("REID:PEND")
        elif state.get("reid_match_similarity") is not None:
            label_parts.append(f"R:{float(state['reid_match_similarity']):.2f}")
        if state.get("person_type") == "EMPLOYEE" and state.get("employee_code"):
            label_parts.append(str(state["employee_code"]))
        label = " ".join(label_parts)

        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.circle(frame, (int(track.centroid[0]), int(track.centroid[1])), 4, color, -1)

        (label_w, label_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        top = max(0, y1 - 22)
        bottom = max(label_h + 10, y1)
        cv2.rectangle(frame, (x1, top), (x1 + label_w + 10, bottom), color, -1)
        cv2.putText(
            frame,
            label,
            (x1 + 5, bottom - 6),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )


def _writer_fps(source_fps: float, output_fps: float, frame_step: int) -> float:
    if output_fps > 0:
        return output_fps
    base = source_fps if source_fps > 0 else 30.0
    adjusted = base / max(frame_step, 1)
    return max(adjusted, 1.0)


def _release_writer(writer: Any) -> None:
    if writer is None:
        return
    try:
        writer.release()
    except Exception:
        pass


def _transcode_video_for_browser(video_path: Path) -> Tuple[bool, Optional[str]]:
    if not video_path.exists() or video_path.stat().st_size <= 0:
        return False, "File output video belum terbentuk penuh sehingga tidak bisa ditranskode."

    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        return False, "ffmpeg tidak tersedia, output disimpan dengan codec desktop dan mungkin gagal diputar di browser."

    temp_path = video_path.with_name(f"{video_path.stem}.browser_tmp{video_path.suffix}")
    if temp_path.exists():
        temp_path.unlink()

    command = [
        ffmpeg_bin,
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(video_path),
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(temp_path),
    ]

    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode != 0 or not temp_path.exists() or temp_path.stat().st_size <= 0:
        if temp_path.exists():
            temp_path.unlink()
        error_text = (completed.stderr or completed.stdout or "").strip()
        error_detail = error_text.splitlines()[-1] if error_text else "detail error tidak tersedia"
        return False, f"Gagal menyiapkan video H.264 browser-friendly: {error_detail}"

    os.replace(temp_path, video_path)
    return True, None


def _build_tracker(args: argparse.Namespace) -> Tuple[Any, str]:
    if not args.force_centroid and DEEPSORT_AVAILABLE:
        tracker = DeepSORTTracker(
            max_age=args.max_age,
            n_init=args.n_init,
            max_cosine_distance=args.max_cosine_distance,
        )
        if not getattr(tracker, "using_fallback", False):
            return tracker, "DeepSORT+ReID"
        return tracker, "CentroidTracker"

    tracker = CentroidTracker(
        max_disappeared=args.max_age,
        max_distance=args.max_distance,
    )
    return tracker, "CentroidTracker"


def _current_tracker_backend(tracker: Any, default_backend: str) -> str:
    if isinstance(tracker, DeepSORTTracker):
        return "CentroidTracker" if getattr(tracker, "using_fallback", False) else "DeepSORT+ReID"
    return default_backend


def _print_progress(processed_frames: int, total_frames: int, elapsed: float) -> None:
    if total_frames > 0:
        print(f"[progress] frame {processed_frames}/{total_frames} | elapsed {elapsed:.1f}s")
    else:
        print(f"[progress] frame {processed_frames} | elapsed {elapsed:.1f}s")


def _person_type_bucket(person_type: Optional[str]) -> str:
    value = (person_type or "UNKNOWN").upper()
    if value in {"CUSTOMER", "EMPLOYEE", "UNKNOWN"}:
        return value
    return "UNKNOWN"


def _person_type_rank(person_type: Optional[str]) -> int:
    value = _person_type_bucket(person_type)
    if value == "EMPLOYEE":
        return 3
    if value == "CUSTOMER":
        return 2
    return 1


def _canonicalize_visitor_key_set(keys: set[str]) -> set[str]:
    canonical_keys: set[str] = set()
    for key in keys:
        canonical_key = canonicalize_visitor_key(key)
        if canonical_key:
            canonical_keys.add(canonical_key)
    return canonical_keys


def _canonicalize_bucket_sets(bucket_sets: Dict[str, set[str]]) -> Dict[str, set[str]]:
    return {
        person_type: _canonicalize_visitor_key_set(visitor_keys)
        for person_type, visitor_keys in bucket_sets.items()
    }


def _canonicalize_visitor_profiles(
    visitor_profiles: Dict[str, Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    canonical_profiles: Dict[str, Dict[str, Any]] = {}
    for visitor_key, profile in visitor_profiles.items():
        canonical_key = canonicalize_visitor_key(visitor_key)
        if not canonical_key:
            continue
        existing = canonical_profiles.get(canonical_key)
        if existing is None or _person_type_rank(profile.get("person_type")) >= _person_type_rank(
            existing.get("person_type")
        ):
            canonical_profiles[canonical_key] = dict(profile)
    return canonical_profiles


def _empty_face_registry_stats(source: str, directory: Optional[Path] = None, reason: str = "") -> Dict[str, Any]:
    return {
        "source": source,
        "directory": str(directory) if directory else "",
        "loaded_count": 0,
        "sample_count": 0,
        "image_count": 0,
        "skipped_no_face": 0,
        "skipped_read_error": 0,
        "reason": reason,
    }


def _load_face_registry(face_recognizer: EmployeeFaceRecognizer, args: argparse.Namespace) -> Dict[str, Any]:
    directory = _resolve_project_path(args.employee_faces_dir)
    if not face_recognizer.enabled:
        return _empty_face_registry_stats(args.face_registry_source, directory, face_recognizer.reason or "disabled")
    if not face_recognizer.available:
        return _empty_face_registry_stats(args.face_registry_source, directory, face_recognizer.reason or "unavailable")

    if args.face_registry_source == "folder":
        return face_recognizer.load_registry_from_dir(directory)

    token = login_token()
    face_recognizer.refresh_registry(get_employee_registry, token, force=True)
    return {
        "source": "backend",
        "directory": "",
        "loaded_count": face_recognizer.registry_size,
        "sample_count": face_recognizer.registry_size,
        "image_count": face_recognizer.registry_size,
        "skipped_no_face": 0,
        "skipped_read_error": 0,
        "reason": (
            face_recognizer.reason
            if face_recognizer.registry_size == 0
            else ""
        ) or ("registry backend kosong atau backend tidak terjangkau" if face_recognizer.registry_size == 0 else ""),
    }


def _collect_face_benchmark_records(
    face_recognizer: EmployeeFaceRecognizer,
    employee_faces_dir: Path,
) -> List[Dict[str, Any]]:
    image_paths = sorted(
        image_path
        for image_path in employee_faces_dir.rglob("*")
        if image_path.is_file() and image_path.suffix.lower() in FACE_IMAGE_EXTENSIONS
    )

    records: List[Dict[str, Any]] = []
    for image_path in image_paths:
        label = derive_employee_label(image_path)
        record = {
            "file_name": image_path.name,
            "image_path": str(image_path),
            "true_label": label,
            "embedding": None,
            "issue": "",
        }

        image = cv2.imread(str(image_path))
        if image is None:
            record["issue"] = "read_error"
            records.append(record)
            continue

        embedding = face_recognizer.extract_image_face_embedding(image)
        if embedding is None:
            record["issue"] = "no_face_detected"
            records.append(record)
            continue

        record["embedding"] = embedding
        records.append(record)

    return records


def _build_face_label_registry(
    records: List[Dict[str, Any]],
    excluded_image_path: Optional[str] = None,
) -> Dict[str, Dict[str, Any]]:
    grouped: Dict[str, List[np.ndarray]] = {}
    for record in records:
        embedding = record.get("embedding")
        if embedding is None:
            continue
        if excluded_image_path and record["image_path"] == excluded_image_path:
            continue
        grouped.setdefault(record["true_label"], []).append(np.asarray(embedding, dtype=np.float32))

    registry: Dict[str, Dict[str, Any]] = {}
    for label, embeddings in grouped.items():
        if not embeddings:
            continue
        matrix = np.stack(embeddings, axis=0)
        prototype = matrix.mean(axis=0)
        norm = np.linalg.norm(prototype)
        if norm > 0:
            prototype = prototype / norm
        registry[label] = {
            "embedding": prototype,
            "sample_count": len(embeddings),
        }
    return registry


def _predict_face_label(
    query_embedding: np.ndarray,
    registry: Dict[str, Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    if not registry:
        return None

    labels = sorted(registry.keys())
    matrix = np.stack([registry[label]["embedding"] for label in labels], axis=0)
    scores = matrix @ np.asarray(query_embedding, dtype=np.float32)
    best_index = int(np.argmax(scores))
    best_label = labels[best_index]
    return {
        "label": best_label,
        "score": float(scores[best_index]),
        "sample_count": int(registry[best_label]["sample_count"]),
    }


def _run_face_benchmark(args: argparse.Namespace) -> int:
    employee_faces_dir = _resolve_project_path(args.employee_faces_dir)
    if not employee_faces_dir.exists() or not employee_faces_dir.is_dir():
        print(f"Folder petugas tidak ditemukan: {employee_faces_dir}", file=sys.stderr)
        return 1

    output_dir = _resolve_project_path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    benchmark_output_dir = output_dir / "face_benchmark"
    benchmark_output_dir.mkdir(parents=True, exist_ok=True)

    name_prefix = args.output_name.strip() or f"{employee_faces_dir.name}_face_benchmark"
    output_stem = _build_output_stem(name_prefix)
    csv_path = benchmark_output_dir / f"{output_stem}_predictions.csv"
    summary_path = benchmark_output_dir / f"{output_stem}_summary.json"

    face_recognizer = EmployeeFaceRecognizer()
    if not (face_recognizer.enabled and face_recognizer.available):
        print(
            "Benchmark face recognition membutuhkan InsightFace yang aktif, tetapi runtime tidak tersedia.",
            file=sys.stderr,
        )
        return 1

    print(f"[info] mode    : face-benchmark")
    print(f"[info] source  : {employee_faces_dir}")
    print(f"[info] out dir : {benchmark_output_dir}")
    print(f"[info] csv     : {csv_path}")
    print(f"[info] summary : {summary_path}")
    print(f"[info] th      : employee_match_threshold={args.employee_match_threshold}")
    print(f"[info] self    : {'enabled' if args.face_benchmark_allow_self_match else 'disabled'}")

    records = _collect_face_benchmark_records(face_recognizer, employee_faces_dir)
    if not records:
        print(
            f"Folder petugas belum berisi gambar wajah yang didukung: {employee_faces_dir}",
            file=sys.stderr,
        )
        return 1
    registry_stats = face_recognizer.load_registry_from_dir(employee_faces_dir)

    usable_records = [record for record in records if record.get("embedding") is not None]
    label_totals: Dict[str, int] = {}
    for record in records:
        label_totals[record["true_label"]] = label_totals.get(record["true_label"], 0) + 1

    per_label_stats: Dict[str, Dict[str, int]] = {
        label: {"total": total, "correct": 0, "wrong": 0, "unknown": 0}
        for label, total in sorted(label_totals.items())
    }

    prediction_rows: List[Dict[str, Any]] = []
    correct_predictions = 0
    wrong_predictions = 0
    unknown_predictions = 0

    for record in records:
        if record.get("embedding") is None:
            per_label_stats[record["true_label"]]["unknown"] += 1
            prediction_rows.append(
                {
                    "file_name": record["file_name"],
                    "image_path": record["image_path"],
                    "true_label": record["true_label"],
                    "predicted_label": "UNKNOWN",
                    "match_score": "",
                    "is_correct": False,
                    "same_label_reference_count": 0,
                    "registry_label_count": 0,
                    "issue": record["issue"] or "no_embedding",
                }
            )
            continue

        registry = _build_face_label_registry(
            usable_records,
            None if args.face_benchmark_allow_self_match else record["image_path"],
        )
        same_label_reference_count = int(registry.get(record["true_label"], {}).get("sample_count", 0))
        match = _predict_face_label(record["embedding"], registry)
        predicted_label = "UNKNOWN"
        match_score = ""
        issue = ""
        if match is not None:
            match_score = round(float(match["score"]), 4)
            if float(match["score"]) >= args.employee_match_threshold:
                predicted_label = str(match["label"])
            else:
                issue = "below_threshold"
        else:
            issue = "empty_registry"

        is_correct = predicted_label == record["true_label"]
        if predicted_label == "UNKNOWN":
            unknown_predictions += 1
            per_label_stats[record["true_label"]]["unknown"] += 1
        elif is_correct:
            correct_predictions += 1
            per_label_stats[record["true_label"]]["correct"] += 1
        else:
            wrong_predictions += 1
            per_label_stats[record["true_label"]]["wrong"] += 1

        prediction_rows.append(
            {
                "file_name": record["file_name"],
                "image_path": record["image_path"],
                "true_label": record["true_label"],
                "predicted_label": predicted_label,
                "match_score": match_score,
                "is_correct": is_correct,
                "same_label_reference_count": same_label_reference_count,
                "registry_label_count": len(registry),
                "issue": issue,
            }
        )

    accuracy = correct_predictions / len(usable_records) if usable_records else 0.0
    known_predictions = correct_predictions + wrong_predictions
    known_accuracy = correct_predictions / known_predictions if known_predictions else 0.0
    single_sample_labels = sorted(label for label, total in label_totals.items() if total <= 1)
    notes: List[str] = []
    if single_sample_labels and not args.face_benchmark_allow_self_match:
        notes.append(
            "Beberapa label hanya punya satu gambar; nonaktif self-match akan membuat label seperti ini "
            "lebih sulit dikenali pada benchmark."
        )

    with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer_csv = csv.DictWriter(csv_file, fieldnames=FACE_BENCHMARK_CSV_FIELDS)
        writer_csv.writeheader()
        writer_csv.writerows(prediction_rows)

    summary = {
        "test_mode": "face-benchmark",
        "employee_faces_dir": str(employee_faces_dir),
        "output_csv": str(csv_path),
        "output_summary": str(summary_path),
        "output_stem": output_stem,
        "face_recognition_enabled": bool(face_recognizer.enabled and face_recognizer.available),
        "face_recognition_reason": getattr(face_recognizer, "reason", ""),
        "employee_match_threshold": float(args.employee_match_threshold),
        "face_registry": registry_stats,
        "face_benchmark": {
            "total_images": len(records),
            "usable_images": len(usable_records),
            "images_without_face": registry_stats.get("skipped_no_face", 0),
            "read_errors": registry_stats.get("skipped_read_error", 0),
            "label_count": len(label_totals),
            "correct_predictions": correct_predictions,
            "wrong_predictions": wrong_predictions,
            "unknown_predictions": unknown_predictions,
            "accuracy": round(accuracy, 6),
            "known_accuracy": round(known_accuracy, 6),
            "allow_self_match": bool(args.face_benchmark_allow_self_match),
            "per_label": per_label_stats,
            "notes": notes,
        },
    }

    summary_path.write_text(f"{json.dumps(summary, indent=2, ensure_ascii=False)}\n", encoding="utf-8")
    print(
        f"[done] accuracy={summary['face_benchmark']['accuracy']:.4f} | "
        f"correct={correct_predictions} | wrong={wrong_predictions} | unknown={unknown_predictions}"
    )
    return 0


def main() -> int:
    args = build_parser().parse_args()

    if args.test_mode == "face-benchmark":
        return _run_face_benchmark(args)

    if not str(args.input or "").strip():
        print("Field --input wajib diisi untuk --test-mode=video.", file=sys.stderr)
        return 1

    input_path = _resolve_project_path(args.input)
    if not input_path.exists():
        print(f"Input video tidak ditemukan: {input_path}", file=sys.stderr)
        return 1

    output_dir = _resolve_project_path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    name_prefix = args.output_name.strip() or input_path.stem
    output_stem = _build_output_stem(name_prefix)

    active_backend = os.getenv("YOLO_BACKEND", args.backend)
    active_weights = os.getenv("YOLOV5_WEIGHTS", args.weights)
    model_label = _model_label(active_backend, active_weights)
    model_output_dir = output_dir / model_label
    model_output_dir.mkdir(parents=True, exist_ok=True)

    capture = cv2.VideoCapture(str(input_path))
    if not capture.isOpened():
        print(f"Gagal membuka video: {input_path}", file=sys.stderr)
        return 1

    writer: Optional[Any] = None
    writer_released = False
    try:
        source_fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
        source_width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        source_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        total_frames_raw = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        total_frames_estimated = (
            (total_frames_raw + max(args.frame_step, 1) - 1) // max(args.frame_step, 1)
            if total_frames_raw > 0
            else 0
        )

        frame_width = source_width if args.keep_source_size and source_width > 0 else args.frame_width
        frame_height = source_height if args.keep_source_size and source_height > 0 else args.frame_height
        writer_fps = _writer_fps(source_fps, args.output_fps, args.frame_step)

        roi = _load_roi(args.roi_json, frame_width, frame_height)

        video_path = model_output_dir / f"{output_stem}_tracking.mp4"
        csv_path = model_output_dir / f"{output_stem}_tracks.csv"
        summary_path = model_output_dir / f"{output_stem}_summary.json"

        writer = cv2.VideoWriter(
            str(video_path),
            cv2.VideoWriter_fourcc(*"mp4v"),
            writer_fps,
            (frame_width, frame_height),
        )
        if not writer.isOpened():
            print(f"Gagal membuat video output: {video_path}", file=sys.stderr)
            return 1

        model = load_model()
        tracker, tracker_backend = _build_tracker(args)
        tracker_uses_frame_detections = isinstance(tracker, DeepSORTTracker)
        face_recognizer = EmployeeFaceRecognizer()
        face_registry = _empty_face_registry_stats(args.face_registry_source, _resolve_project_path(args.employee_faces_dir))
        if args.identity_mode == "face" and not (face_recognizer.enabled and face_recognizer.available):
            print(
                "Face identity mode membutuhkan InsightFace yang aktif, tetapi runtime tidak tersedia.",
                file=sys.stderr,
            )
            return 1
        if face_recognizer.enabled and face_recognizer.available:
            face_registry = _load_face_registry(face_recognizer, args)

        visitor_states: Dict[int, Dict[str, Any]] = {}
        seen_visitor_keys: set[str] = set()
        seen_track_ids: set[int] = set()
        visitor_profiles: Dict[str, Dict[str, Any]] = {}
        visitor_last_state: Dict[str, Dict[str, Any]] = {}
        event_counts = {"enter_roi": 0, "exit_roi": 0}
        event_counts_by_person_type = {
            "CUSTOMER": {"enter_roi": 0, "exit_roi": 0},
            "EMPLOYEE": {"enter_roi": 0, "exit_roi": 0},
            "UNKNOWN": {"enter_roi": 0, "exit_roi": 0},
        }
        unique_event_visitors = {"enter_roi": set(), "exit_roi": set()}
        peak_concurrent_tracks = 0
        peak_tracks_in_roi = 0
        peak_unique_visitors_visible = 0
        peak_unique_visitors_in_roi = 0
        peak_unique_visitors_by_person_type_visible = {
            "CUSTOMER": 0,
            "EMPLOYEE": 0,
            "UNKNOWN": 0,
        }
        peak_unique_visitors_by_person_type_in_roi = {
            "CUSTOMER": 0,
            "EMPLOYEE": 0,
            "UNKNOWN": 0,
        }
        frames_with_detections = 0
        last_frame_unique_visitors: set[str] = set()
        last_frame_unique_visitors_in_roi: set[str] = set()
        last_frame_unique_visitors_by_person_type = {
            "CUSTOMER": set(),
            "EMPLOYEE": set(),
            "UNKNOWN": set(),
        }
        start_time = time.time()
        today = datetime.now().strftime("%Y-%m-%d")
        reset_daily_cache(today)
        tracker_backend_runtime = _current_tracker_backend(tracker, tracker_backend)

        processed_frames = 0
        csv_rows = 0
        source_frame_index = 0

        max_source_frames_by_seconds = 0
        if args.max_seconds > 0:
            effective_source_fps = source_fps if source_fps > 0 else 30.0
            max_source_frames_by_seconds = max(1, int(args.max_seconds * effective_source_fps))

        print(f"[info] input   : {input_path}")
        print(f"[info] model   : {model_label}")
        print(f"[info] out dir : {model_output_dir}")
        print(f"[info] output  : {video_path}")
        print(f"[info] csv     : {csv_path}")
        print(f"[info] summary : {summary_path}")
        print(f"[info] tracker : {tracker_backend_runtime}")
        print(f"[info] yolo    : {active_backend} | weights={active_weights}")
        print(
            "[info] yolo cfg: "
            f"imgsz={args.img_size} | conf={os.getenv('YOLOV5_CONF', '0.25')} | "
            f"iou={os.getenv('YOLOV5_IOU', '0.45')}"
        )
        print(
            "[info] dedupe  : "
            f"{'enabled' if args.suppress_nested_duplicates else 'disabled'} | "
            f"containment={args.duplicate_containment_threshold}"
        )
        print(f"[info] id mode : {args.identity_mode} | source={_identity_embedding_source(args.identity_mode)}")
        print(f"[info] id th   : threshold={os.getenv('REID_MATCH_THRESHOLD', '0.77')}")
        print(
            "[info] id tune : "
            f"min_frames={os.getenv('REID_MIN_TRACK_FRAMES', '3')} | "
            f"strong={os.getenv('REID_STRONG_MATCH_THRESHOLD', '0.86')} | "
            f"margin={os.getenv('REID_AMBIGUITY_MARGIN', '0.04')} | "
            f"alpha={os.getenv('REID_PROTOTYPE_ALPHA', '0.18')}"
        )
        print(
            f"[info] face    : "
            f"{'enabled' if face_recognizer.enabled and face_recognizer.available else 'disabled'}"
        )
        print(
            f"[info] registry : {face_registry.get('source', '-')} | "
            f"labels={face_registry.get('loaded_count', 0)} | "
            f"samples={face_registry.get('sample_count', 0)}"
        )
        if face_registry.get("reason"):
            print(f"[warn] registry : {face_registry['reason']}", file=sys.stderr)
        print(f"[info] limit   : max_frames={args.max_frames} | max_seconds={args.max_seconds}")

        with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
            writer_csv = csv.DictWriter(csv_file, fieldnames=TRACK_CSV_FIELDS)
            writer_csv.writeheader()

            while True:
                ok, frame = capture.read()
                if not ok or frame is None:
                    break

                source_frame_index += 1

                if max_source_frames_by_seconds > 0 and source_frame_index > max_source_frames_by_seconds:
                    break

                if args.frame_step > 1 and (source_frame_index - 1) % args.frame_step != 0:
                    continue

                if frame.shape[1] != frame_width or frame.shape[0] != frame_height:
                    frame = cv2.resize(frame, (frame_width, frame_height))

                results = model(frame, size=args.img_size)
                raw_detections = (
                    results.xyxy[0].detach().cpu().numpy()
                    if hasattr(results, "xyxy")
                    else np.zeros((0, 6), dtype=np.float32)
                )

                detections: List[Tuple[float, float, float, float, float]] = []
                for x1, y1, x2, y2, conf, _ in raw_detections:
                    detections.append((float(x1), float(y1), float(x2), float(y2), float(conf)))
                detections = suppress_duplicate_person_detections(
                    detections,
                    suppress=args.suppress_nested_duplicates,
                    containment_threshold=args.duplicate_containment_threshold,
                )
                if detections:
                    frames_with_detections += 1

                if tracker_uses_frame_detections:
                    tracks = tracker.update(frame, detections)
                else:
                    boxes = [(det[0], det[1], det[2], det[3]) for det in detections]
                    tracks = tracker.update(boxes)
                tracker_backend_runtime = _current_tracker_backend(tracker, tracker_backend)

                active_track_ids = list(tracks.keys())
                cleanup_old_tracks(active_track_ids)
                face_recognizer.cleanup(active_track_ids)
                face_recognizer.detect_faces_batch(frame, frame_id=source_frame_index)

                display_frame = frame.copy()
                draw_roi_polygon(display_frame, roi)

                customer_tracks = 0
                employee_tracks = 0
                verifying_tracks = 0
                pending_reid_tracks = 0
                tracks_in_roi = 0
                frame_unique_visitors: set[str] = set()
                frame_unique_visitors_in_roi: set[str] = set()
                frame_unique_visitors_by_person_type = {
                    "CUSTOMER": set(),
                    "EMPLOYEE": set(),
                    "UNKNOWN": set(),
                }
                frame_unique_visitors_in_roi_by_person_type = {
                    "CUSTOMER": set(),
                    "EMPLOYEE": set(),
                    "UNKNOWN": set(),
                }

                for track_id, track in tracks.items():
                    seen_track_ids.add(track_id)
                    previous_in_roi = bool(getattr(track, "in_roi", False))
                    in_roi_now = point_in_roi(roi, track.centroid[0], track.centroid[1])
                    if in_roi_now:
                        tracks_in_roi += 1

                    if args.identity_mode == "face":
                        identity_embedding = face_recognizer.extract_track_face_embedding(track.bbox)
                    else:
                        identity_embedding = getattr(track, "embedding", None)

                    identity = update_track_identity(track_id, identity_embedding, CAMERA_ID, today)
                    visitor_key = identity["visitor_key"]
                    classification = face_recognizer.classify_track(frame, track_id, track.bbox)
                    person_type = _person_type_bucket(classification.get("person_type", "CUSTOMER"))
                    if identity["identity_status"] == "PENDING":
                        pending_reid_tracks += 1
                    frame_unique_visitors.add(visitor_key)
                    frame_unique_visitors_by_person_type[person_type].add(visitor_key)
                    if in_roi_now:
                        frame_unique_visitors_in_roi.add(visitor_key)
                        frame_unique_visitors_in_roi_by_person_type[person_type].add(visitor_key)

                    unique_status = "NEW" if visitor_key not in seen_visitor_keys else "SEEN"
                    seen_visitor_keys.add(visitor_key)

                    profile = visitor_profiles.get(visitor_key)
                    if profile is None or _person_type_rank(person_type) >= _person_type_rank(profile.get("person_type")):
                        visitor_profiles[visitor_key] = {
                            "person_type": person_type,
                            "employee_id": classification.get("employee_id"),
                            "employee_code": classification.get("employee_code"),
                            "employee_name": classification.get("employee_name"),
                        }

                    if person_type == "EMPLOYEE":
                        employee_tracks += 1
                    elif person_type == "UNKNOWN":
                        verifying_tracks += 1
                    else:
                        customer_tracks += 1

                    event = ""
                    if not previous_in_roi and in_roi_now:
                        event = "ENTER_ROI"
                    elif previous_in_roi and not in_roi_now:
                        event = "EXIT_ROI"

                    if event == "ENTER_ROI":
                        event_counts["enter_roi"] += 1
                        event_counts_by_person_type[person_type]["enter_roi"] += 1
                        unique_event_visitors["enter_roi"].add(visitor_key)
                    elif event == "EXIT_ROI":
                        event_counts["exit_roi"] += 1
                        event_counts_by_person_type[person_type]["exit_roi"] += 1
                        unique_event_visitors["exit_roi"].add(visitor_key)

                    roi_status = "IN_ROI" if in_roi_now else "OUTSIDE_ROI"
                    visitor_key_short = visitor_key[:8] if visitor_key else ""
                    confidence = _match_detection_confidence(track.bbox, detections)
                    visitor_last_state[visitor_key] = {
                        "in_roi": in_roi_now,
                        "track_id": track_id,
                        "person_type": person_type,
                        "last_frame_index": source_frame_index,
                    }

                    state = visitor_states.setdefault(track_id, {})
                    state.update(
                        {
                            "visitor_key": visitor_key,
                            "visitor_key_short": visitor_key_short,
                            "unique_status": unique_status,
                            "roi_status": roi_status,
                            "event": event,
                            "in_roi": in_roi_now,
                            "person_type": person_type,
                            "employee_id": classification.get("employee_id"),
                            "employee_code": classification.get("employee_code"),
                            "employee_name": classification.get("employee_name"),
                            "match_score": classification.get("match_score"),
                            "confidence": confidence,
                            "reid_identity_status": identity["identity_status"],
                            "reid_source": identity["reid_source"],
                            "reid_embedding_samples": identity["embedding_samples"],
                            "reid_match_similarity": identity["match_similarity"],
                            "reid_match_margin": identity["match_margin"],
                        }
                    )

                    track.in_roi = in_roi_now

                    writer_csv.writerow(
                        {
                            "frame_index": source_frame_index,
                            "time_seconds": round(
                                (source_frame_index - 1) / (source_fps if source_fps > 0 else writer_fps),
                                3,
                            ),
                            "track_id": track_id,
                            "visitor_key": visitor_key,
                            "visitor_key_short": visitor_key_short,
                            "reid_source": identity["reid_source"],
                            "reid_identity_status": identity["identity_status"],
                            "reid_embedding_samples": identity["embedding_samples"],
                            "reid_match_similarity": (
                                identity["match_similarity"] if identity["match_similarity"] is not None else ""
                            ),
                            "reid_match_margin": (
                                identity["match_margin"] if identity["match_margin"] is not None else ""
                            ),
                            "track_backend": tracker_backend_runtime,
                            "roi_status": roi_status,
                            "event": event,
                            "unique_status": unique_status,
                            "person_type": classification.get("person_type", "CUSTOMER"),
                            "employee_id": classification.get("employee_id"),
                            "employee_code": classification.get("employee_code"),
                            "employee_name": classification.get("employee_name"),
                            "match_score": (
                                round(float(classification["match_score"]), 4)
                                if classification.get("match_score") is not None
                                else ""
                            ),
                            "x1": round(float(track.bbox[0]), 2),
                            "y1": round(float(track.bbox[1]), 2),
                            "x2": round(float(track.bbox[2]), 2),
                            "y2": round(float(track.bbox[3]), 2),
                            "centroid_x": round(float(track.centroid[0]), 2),
                            "centroid_y": round(float(track.centroid[1]), 2),
                            "confidence": confidence,
                            "embedding_available": bool(identity_embedding is not None),
                        }
                    )
                    csv_rows += 1

                _draw_test_tracks(display_frame, tracks, visitor_states)
                last_frame_unique_visitors = set(frame_unique_visitors)
                last_frame_unique_visitors_in_roi = set(frame_unique_visitors_in_roi)
                last_frame_unique_visitors_by_person_type = {
                    person_type: set(visitor_keys)
                    for person_type, visitor_keys in frame_unique_visitors_by_person_type.items()
                }
                info_lines = [
                    f"Tracks: {len(tracks)} | {tracker_backend_runtime}",
                    f"Customer: {customer_tracks} | Employee: {employee_tracks} | Verify: {verifying_tracks}",
                    f"Unique so far: {len(seen_visitor_keys)} | Detections: {len(detections)}",
                    f"Unique now: {len(frame_unique_visitors)} | In ROI now: {len(frame_unique_visitors_in_roi)}",
                    f"{'FaceID' if args.identity_mode == 'face' else 'ReID'} stable: "
                    f"{max(len(tracks) - pending_reid_tracks, 0)} | Pending: {pending_reid_tracks}",
                ]
                draw_info_overlay(display_frame, info_lines, show_live_indicator=False)
                writer.write(display_frame)

                peak_concurrent_tracks = max(peak_concurrent_tracks, len(tracks))
                peak_tracks_in_roi = max(peak_tracks_in_roi, tracks_in_roi)
                peak_unique_visitors_visible = max(peak_unique_visitors_visible, len(frame_unique_visitors))
                peak_unique_visitors_in_roi = max(peak_unique_visitors_in_roi, len(frame_unique_visitors_in_roi))
                for person_type, visitor_keys in frame_unique_visitors_by_person_type.items():
                    peak_unique_visitors_by_person_type_visible[person_type] = max(
                        peak_unique_visitors_by_person_type_visible[person_type],
                        len(visitor_keys),
                    )
                for person_type, visitor_keys in frame_unique_visitors_in_roi_by_person_type.items():
                    peak_unique_visitors_by_person_type_in_roi[person_type] = max(
                        peak_unique_visitors_by_person_type_in_roi[person_type],
                        len(visitor_keys),
                    )
                processed_frames += 1
                if processed_frames % 30 == 0:
                    _print_progress(processed_frames, total_frames_estimated, time.time() - start_time)

                if args.max_frames > 0 and processed_frames >= args.max_frames:
                    break

        elapsed = time.time() - start_time
        cleanup_old_tracks([])
        canonical_seen_visitor_keys = _canonicalize_visitor_key_set(seen_visitor_keys)
        canonical_last_frame_unique_visitors = _canonicalize_visitor_key_set(last_frame_unique_visitors)
        canonical_last_frame_unique_visitors_in_roi = _canonicalize_visitor_key_set(last_frame_unique_visitors_in_roi)
        canonical_last_frame_unique_visitors_by_person_type = _canonicalize_bucket_sets(
            last_frame_unique_visitors_by_person_type
        )
        canonical_unique_event_visitors = {
            "enter_roi": _canonicalize_visitor_key_set(unique_event_visitors["enter_roi"]),
            "exit_roi": _canonicalize_visitor_key_set(unique_event_visitors["exit_roi"]),
        }
        canonical_visitor_profiles = _canonicalize_visitor_profiles(visitor_profiles)
        reid_config = get_reid_config()
        reid_cache_stats = get_cache_stats()

        unique_visitors_by_person_type = {"CUSTOMER": 0, "EMPLOYEE": 0, "UNKNOWN": 0}
        for visitor_profile in canonical_visitor_profiles.values():
            unique_visitors_by_person_type[_person_type_bucket(visitor_profile.get("person_type"))] += 1

        active_unique_visitors_last_frame = len(canonical_last_frame_unique_visitors)
        active_unique_visitors_in_roi_last_frame = len(canonical_last_frame_unique_visitors_in_roi)
        active_unique_visitors_by_person_type_last_frame = {
            person_type: len(visitor_keys)
            for person_type, visitor_keys in canonical_last_frame_unique_visitors_by_person_type.items()
        }
        cumulative_unique_visitors_by_person_type = dict(unique_visitors_by_person_type)
        visitors_inside_roi_at_end = active_unique_visitors_in_roi_last_frame
        visitors_outside_roi_at_end = max(0, active_unique_visitors_last_frame - active_unique_visitors_in_roi_last_frame)
        unique_visitors_entered_roi = len(canonical_unique_event_visitors["enter_roi"])
        unique_visitors_exited_roi = len(canonical_unique_event_visitors["exit_roi"])
        repeat_entry_events = max(0, event_counts["enter_roi"] - unique_visitors_entered_roi)
        repeat_exit_events = max(0, event_counts["exit_roi"] - unique_visitors_exited_roi)
        _release_writer(writer)
        writer_released = True

        browser_video_ready, browser_video_issue = _transcode_video_for_browser(video_path)
        if browser_video_ready:
            print(f"[info] browser : siap diputar di browser ({video_path.name})")
        elif browser_video_issue:
            print(f"[warn] browser : {browser_video_issue}", file=sys.stderr)

        summary = {
            "test_mode": "video",
            "input_video": str(input_path),
            "model_label": model_label,
            "model_output_dir": str(model_output_dir),
            "output_video": str(video_path),
            "output_csv": str(csv_path),
            "output_summary": str(summary_path),
            "output_stem": output_stem,
            "tracker_backend": tracker_backend_runtime,
            "identity_mode": args.identity_mode,
            "identity_embedding_source": _identity_embedding_source(args.identity_mode),
            "identity_match_threshold": float(os.getenv("REID_MATCH_THRESHOLD", "0.77")),
            "yolo_backend": active_backend,
            "weights": active_weights,
            "yolo_img_size": int(args.img_size),
            "yolo_conf_threshold": float(os.getenv("YOLOV5_CONF", "0.25")),
            "yolo_iou_threshold": float(os.getenv("YOLOV5_IOU", "0.45")),
            "suppress_nested_duplicates": bool(args.suppress_nested_duplicates),
            "duplicate_containment_threshold": float(args.duplicate_containment_threshold),
            "reid_match_threshold": float(os.getenv("REID_MATCH_THRESHOLD", "0.77")),
            "employee_match_threshold": float(os.getenv("EMPLOYEE_MATCH_THRESHOLD", str(DEFAULT_EMPLOYEE_MATCH_THRESHOLD))),
            "device": os.getenv("YOLOV5_DEVICE", "auto"),
            "face_recognition_enabled": bool(face_recognizer.enabled and face_recognizer.available),
            "face_recognition_reason": getattr(face_recognizer, "reason", ""),
            "face_registry": face_registry,
            "source_fps": round(source_fps, 3),
            "output_fps": round(writer_fps, 3),
            "source_size": [source_width, source_height],
            "output_size": [frame_width, frame_height],
            "browser_video_ready": browser_video_ready,
            "browser_video_issue": browser_video_issue,
            "frames_processed": processed_frames,
            "frames_with_detections": frames_with_detections,
            "track_rows_written": csv_rows,
            "requested_max_frames": args.max_frames,
            "requested_max_seconds": args.max_seconds,
            "unique_visitors": peak_unique_visitors_visible,
            "unique_visitors_mode": "peak_visible",
            "cumulative_unique_visitors": len(canonical_seen_visitor_keys),
            "raw_cumulative_unique_visitors": len(seen_visitor_keys),
            "unique_track_ids": len(seen_track_ids),
            "visitor_summary": {
                "total_enter_events": event_counts["enter_roi"],
                "total_exit_events": event_counts["exit_roi"],
                "unique_visitors_detected": peak_unique_visitors_visible,
                "unique_visitors_detected_mode": "peak_visible",
                "cumulative_unique_visitors_detected": len(canonical_seen_visitor_keys),
                "raw_cumulative_unique_visitors_detected": len(seen_visitor_keys),
                "active_unique_visitors_last_frame": active_unique_visitors_last_frame,
                "active_unique_visitors_in_roi_last_frame": active_unique_visitors_in_roi_last_frame,
                "unique_visitors_entered_roi": unique_visitors_entered_roi,
                "unique_visitors_exited_roi": unique_visitors_exited_roi,
                "repeat_entry_events": repeat_entry_events,
                "repeat_exit_events": repeat_exit_events,
                "unique_visitors_by_person_type": peak_unique_visitors_by_person_type_visible,
                "unique_visitors_by_person_type_mode": "peak_visible",
                "cumulative_unique_visitors_by_person_type": cumulative_unique_visitors_by_person_type,
                "active_unique_visitors_by_person_type_last_frame": active_unique_visitors_by_person_type_last_frame,
                "event_counts_by_person_type": event_counts_by_person_type,
                "visitors_inside_roi_at_end": visitors_inside_roi_at_end,
                "visitors_outside_roi_at_end": visitors_outside_roi_at_end,
                "peak_concurrent_tracks": peak_concurrent_tracks,
                "peak_tracks_in_roi": peak_tracks_in_roi,
                "peak_unique_visitors_visible": peak_unique_visitors_visible,
                "peak_unique_visitors_in_roi": peak_unique_visitors_in_roi,
                "peak_unique_visitors_by_person_type_visible": peak_unique_visitors_by_person_type_visible,
                "peak_unique_visitors_by_person_type_in_roi": peak_unique_visitors_by_person_type_in_roi,
                "identity_tuning": {
                    "identity_mode": args.identity_mode,
                    "embedding_source": _identity_embedding_source(args.identity_mode),
                    "match_threshold": reid_config["match_threshold"],
                    "strong_match_threshold": reid_config["strong_match_threshold"],
                    "ambiguity_margin": reid_config["ambiguity_margin"],
                    "min_track_frames": int(reid_config["min_track_frames"]),
                    "prototype_alpha": reid_config["prototype_alpha"],
                    "alias_count": reid_cache_stats["alias_count"],
                    "daily_visitors_in_cache": reid_cache_stats["daily_visitors"],
                },
                "reid_tuning": {
                    "match_threshold": reid_config["match_threshold"],
                    "strong_match_threshold": reid_config["strong_match_threshold"],
                    "ambiguity_margin": reid_config["ambiguity_margin"],
                    "min_track_frames": int(reid_config["min_track_frames"]),
                    "prototype_alpha": reid_config["prototype_alpha"],
                    "alias_count": reid_cache_stats["alias_count"],
                    "daily_visitors_in_cache": reid_cache_stats["daily_visitors"],
                },
            },
            "roi": roi,
            "duration_seconds": round(elapsed, 3),
        }
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

        print(f"[done] frames  : {processed_frames}")
        print(f"[done] rows    : {csv_rows}")
        print(f"[done] enter   : {event_counts['enter_roi']}")
        print(f"[done] exit    : {event_counts['exit_roi']}")
        print(f"[done] peak    : {peak_unique_visitors_visible}")
        print(f"[done] unique  : {len(canonical_seen_visitor_keys)} cumulative ({len(seen_visitor_keys)} raw)")
        print(f"[done] summary : {summary_path}")
        return 0
    finally:
        capture.release()
        if not writer_released:
            _release_writer(writer)


if __name__ == "__main__":
    raise SystemExit(main())

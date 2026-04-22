"""Employee face recognition utilities for the edge worker."""
from dataclasses import dataclass
from pathlib import Path
import re
import time
from typing import Any, Dict, List, Optional

import cv2
import numpy as np

from .config import (
    FACE_RECOGNITION_ENABLED,
    INSIGHTFACE_DET_SIZE,
    INSIGHTFACE_MODEL_NAME,
    INSIGHTFACE_PROVIDERS,
    EMPLOYEE_MATCH_THRESHOLD,
    EMPLOYEE_REGISTRY_REFRESH_SECONDS,
    FACE_RECHECK_SECONDS,
    FACE_DETECTION_FRAME_INTERVAL,
    FACE_UNKNOWN_TIMEOUT,
)
from .logger import get_logger

log = get_logger("face")
FACE_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

try:
    from insightface.app import FaceAnalysis

    INSIGHTFACE_AVAILABLE = True
    _IMPORT_ERROR = ""
except Exception as exc:  # pragma: no cover - optional dependency path
    FaceAnalysis = None
    INSIGHTFACE_AVAILABLE = False
    _IMPORT_ERROR = str(exc)


@dataclass
class TrackClassification:
    person_type: str = "UNKNOWN"
    employee_id: Optional[int] = None
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    match_score: Optional[float] = None
    recognition_source: str = "insightface"
    first_seen_at: float = 0.0
    last_checked_at: float = 0.0
    face_seen: bool = False
    stable: bool = False


def _normalize_embedding(embedding: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(embedding)
    if norm <= 0:
        return embedding
    return embedding / norm


def _largest_face(faces: List[Any]) -> Optional[Any]:
    best_face = None
    best_area = 0.0
    for face in faces or []:
        bbox = getattr(face, "bbox", None)
        if bbox is None or len(bbox) < 4:
            continue
        width = max(0.0, float(bbox[2]) - float(bbox[0]))
        height = max(0.0, float(bbox[3]) - float(bbox[1]))
        area = width * height
        if area > best_area:
            best_area = area
            best_face = face
    return best_face


def derive_employee_label(image_path: str | Path) -> str:
    stem = Path(image_path).stem.strip()
    label = re.sub(r"\s*\(\d+\)$", "", stem)
    label = re.sub(r"[_-]\d+$", "", label)
    label = label.strip()
    return label or stem or "unknown"


class EmployeeFaceRecognizer:
    """Classify tracked people as EMPLOYEE or CUSTOMER using face embeddings."""

    def __init__(self):
        self.enabled = FACE_RECOGNITION_ENABLED
        self.available = False
        self.reason = ""
        self._app = None
        self._track_states: Dict[int, TrackClassification] = {}
        self._employee_registry: List[Dict[str, Any]] = []
        self._employee_matrix: Optional[np.ndarray] = None  # (N, D) stacked embeddings
        self._last_registry_refresh = 0.0
        # Batch face detection cache: populated once per frame
        self._frame_faces: Optional[list] = None
        self._frame_id: Optional[int] = None
        self._last_detected_frame_id: Optional[int] = None

        if not self.enabled:
            self.reason = "disabled by config"
            return

        if not INSIGHTFACE_AVAILABLE:
            self.reason = _IMPORT_ERROR or "InsightFace unavailable"
            log.warning("Recognition disabled: %s", self.reason)
            return

        try:
            self._app = FaceAnalysis(
                name=INSIGHTFACE_MODEL_NAME,
                providers=INSIGHTFACE_PROVIDERS,
            )
            self._app.prepare(
                ctx_id=-1,
                det_size=(INSIGHTFACE_DET_SIZE, INSIGHTFACE_DET_SIZE),
            )
            self.available = True
            log.info("InsightFace initialized for employee recognition")
        except Exception as exc:  # pragma: no cover - depends on runtime
            self.reason = str(exc)
            log.error("Failed to initialize InsightFace: %s", self.reason)

    def refresh_registry(self, fetch_fn, token: Optional[str], force: bool = False) -> None:
        """Refresh employee embeddings from backend."""
        now = time.time()
        if not force and now - self._last_registry_refresh < EMPLOYEE_REGISTRY_REFRESH_SECONDS:
            return

        payload = fetch_fn(token)
        items = payload.get("items", []) if isinstance(payload, dict) else []
        self.load_registry_items(items, refresh_ts=now)
        log.info("Loaded %d employee face embeddings", len(self._employee_registry))

    def load_registry_items(self, items: List[Dict[str, Any]], refresh_ts: Optional[float] = None) -> None:
        registry: List[Dict[str, Any]] = []
        for item in items:
            embedding = item.get("face_embedding") or item.get("embedding")
            if embedding is None:
                continue
            emb = _normalize_embedding(np.asarray(embedding, dtype=np.float32))
            registry.append(
                {
                    "employee_id": item.get("employee_id"),
                    "employee_code": item.get("employee_code") or item.get("employee_name") or item.get("full_name"),
                    "employee_name": item.get("employee_name") or item.get("full_name") or item.get("employee_code"),
                    "embedding": emb,
                    "sample_count": item.get("sample_count"),
                    "source_files": item.get("source_files") or [],
                }
            )

        self._employee_registry = registry
        if registry:
            self._employee_matrix = np.stack([emp["embedding"] for emp in registry], axis=0)
        else:
            self._employee_matrix = None
        self._last_registry_refresh = refresh_ts or time.time()

    def load_registry_from_dir(self, directory: str | Path) -> Dict[str, Any]:
        if not self.enabled or not self.available or self._app is None:
            return {
                "source": "folder",
                "directory": str(directory),
                "loaded_count": 0,
                "sample_count": 0,
                "image_count": 0,
                "skipped_no_face": 0,
                "skipped_read_error": 0,
                "reason": self.reason or "face recognition unavailable",
            }

        root_dir = Path(directory).expanduser().resolve()
        image_paths = sorted(
            file_path
            for file_path in root_dir.rglob("*")
            if file_path.is_file() and file_path.suffix.lower() in FACE_IMAGE_EXTENSIONS
        )

        grouped_embeddings: Dict[str, Dict[str, Any]] = {}
        skipped_no_face = 0
        skipped_read_error = 0
        sample_count = 0

        for image_path in image_paths:
            image = cv2.imread(str(image_path))
            if image is None:
                skipped_read_error += 1
                continue

            embedding = self.extract_image_face_embedding(image)
            if embedding is None:
                skipped_no_face += 1
                continue

            label = derive_employee_label(image_path)
            bucket = grouped_embeddings.setdefault(label, {"embeddings": [], "source_files": []})
            bucket["embeddings"].append(embedding)
            bucket["source_files"].append(str(image_path))
            sample_count += 1

        registry: List[Dict[str, Any]] = []
        for index, label in enumerate(sorted(grouped_embeddings.keys()), start=1):
            payload = grouped_embeddings[label]
            matrix = np.stack(payload["embeddings"], axis=0)
            averaged = _normalize_embedding(np.mean(matrix, axis=0))
            registry.append(
                {
                    "employee_id": index,
                    "employee_code": label,
                    "employee_name": label,
                    "embedding": averaged,
                    "sample_count": len(payload["embeddings"]),
                    "source_files": payload["source_files"],
                }
            )

        self.load_registry_items(registry)
        log.info(
            "Loaded %d local employee label(s) from %s (%d sample(s))",
            len(registry),
            root_dir,
            sample_count,
        )
        return {
            "source": "folder",
            "directory": str(root_dir),
            "loaded_count": len(registry),
            "sample_count": sample_count,
            "image_count": len(image_paths),
            "skipped_no_face": skipped_no_face,
            "skipped_read_error": skipped_read_error,
            "reason": "",
        }

    def extract_image_face_embedding(self, image: np.ndarray) -> Optional[np.ndarray]:
        if not self.enabled or not self.available or self._app is None:
            return None
        candidates = [image]
        height, width = image.shape[:2]
        min_side = min(height, width)
        pad = max(80, int(min_side * 0.2))
        candidates.append(
            cv2.copyMakeBorder(
                image,
                pad,
                pad,
                pad,
                pad,
                cv2.BORDER_CONSTANT,
                value=(255, 255, 255),
            )
        )

        for candidate in candidates:
            try:
                faces = self._app.get(candidate)
            except Exception:
                continue

            face = _largest_face(list(faces or []))
            if face is None:
                continue
            embedding = getattr(face, "embedding", None)
            if embedding is None or len(embedding) == 0:
                continue
            return _normalize_embedding(np.asarray(embedding, dtype=np.float32))
        return None

    def match_embedding(self, embedding: np.ndarray) -> Optional[Dict[str, Any]]:
        normalized = _normalize_embedding(np.asarray(embedding, dtype=np.float32))
        return self._match_employee(normalized)

    def reset_daily(self) -> None:
        """Reset active track classifications on date rollover."""
        self._track_states = {}
        self._frame_faces = None
        self._frame_id = None
        self._last_detected_frame_id = None

    def cleanup(self, active_track_ids: List[int]) -> None:
        stale_ids = [tid for tid in self._track_states if tid not in active_track_ids]
        for tid in stale_ids:
            del self._track_states[tid]

    @property
    def registry_size(self) -> int:
        return len(self._employee_registry)

    def needs_detection(self, active_track_ids: List[int]) -> bool:
        """Return True when at least one active track still needs face classification."""
        if not self.enabled or not self.available or not self._employee_registry or not active_track_ids:
            return False

        for track_id in active_track_ids:
            state = self._track_states.get(track_id)
            if state is None or not state.stable:
                return True
        return False

    def detect_faces_batch(self, frame: np.ndarray, frame_id: int = 0) -> None:
        """Run InsightFace once on full frame and cache results.

        Call this once per frame BEFORE iterating over tracks with classify_track.
        """
        if not self.enabled or not self.available or self._app is None:
            self._frame_faces = None
            self._frame_id = frame_id
            return

        if self._frame_id == frame_id and self._frame_faces is not None:
            return  # Already detected for this frame

        if (
            self._last_detected_frame_id is not None
            and frame_id - self._last_detected_frame_id < FACE_DETECTION_FRAME_INTERVAL
        ):
            self._frame_faces = None
            self._frame_id = frame_id
            return

        self._frame_id = frame_id
        try:
            self._frame_faces = self._app.get(frame)
            self._last_detected_frame_id = frame_id
        except Exception:
            self._frame_faces = None

    def classify_track(self, frame: np.ndarray, track_id: int, bbox) -> Dict[str, Any]:
        """Classify a track using pre-computed batch face detections."""
        now = time.time()
        state = self._track_states.get(track_id)
        if state is None:
            state = TrackClassification(first_seen_at=now, last_checked_at=0.0)
            self._track_states[track_id] = state

        if not self.enabled or not self.available:
            state.person_type = "CUSTOMER"
            state.recognition_source = "disabled"
            state.stable = True
            return self._serialize(state)

        if not self._employee_registry:
            state.person_type = "CUSTOMER"
            state.recognition_source = "no_registry"
            state.stable = True
            return self._serialize(state)

        if state.stable:
            return self._serialize(state)

        if now - state.last_checked_at < FACE_RECHECK_SECONDS:
            if now - state.first_seen_at >= FACE_UNKNOWN_TIMEOUT:
                state.person_type = "CUSTOMER"
                state.recognition_source = "timeout_fallback"
                state.stable = True
            return self._serialize(state)

        state.last_checked_at = now
        embedding = self._extract_face_embedding(frame, bbox)
        if embedding is None:
            if now - state.first_seen_at >= FACE_UNKNOWN_TIMEOUT:
                state.person_type = "CUSTOMER"
                state.recognition_source = "timeout_fallback"
                state.stable = True
            return self._serialize(state)

        state.face_seen = True
        best_match = self._match_employee(embedding)
        if best_match and best_match["score"] >= EMPLOYEE_MATCH_THRESHOLD:
            state.person_type = "EMPLOYEE"
            state.employee_id = best_match["employee_id"]
            state.employee_code = best_match["employee_code"]
            state.employee_name = best_match["employee_name"]
            state.match_score = best_match["score"]
            state.recognition_source = "insightface"
            state.stable = True
        else:
            state.person_type = "CUSTOMER"
            state.match_score = best_match["score"] if best_match else None
            state.recognition_source = "insightface"
            state.stable = True

        return self._serialize(state)

    def extract_track_face_embedding(self, bbox) -> Optional[np.ndarray]:
        """Return the normalized face embedding matched to a track bbox, if any."""
        if not self.enabled or not self.available:
            return None
        return self._extract_face_embedding(None, bbox)

    def _serialize(self, state: TrackClassification) -> Dict[str, Any]:
        return {
            "person_type": state.person_type,
            "employee_id": state.employee_id,
            "employee_code": state.employee_code,
            "employee_name": state.employee_name,
            "match_score": state.match_score,
            "recognition_source": state.recognition_source,
            "face_seen": state.face_seen,
            "stable": state.stable,
        }

    def _extract_face_embedding(self, frame: Optional[np.ndarray], bbox) -> Optional[np.ndarray]:
        """Match a pre-detected face from batch cache to the given track bbox using IoU."""
        if self._frame_faces is None or len(self._frame_faces) == 0:
            return None

        x1, y1, x2, y2 = float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])
        best_face = None
        best_iou = 0.1  # minimum IoU threshold to consider a match

        for face in self._frame_faces:
            fb = getattr(face, "bbox", None)
            if fb is None or len(fb) < 4:
                continue
            fx1, fy1, fx2, fy2 = float(fb[0]), float(fb[1]), float(fb[2]), float(fb[3])

            # Check if face center is inside track bbox (fast pre-filter)
            fcx = (fx1 + fx2) / 2.0
            fcy = (fy1 + fy2) / 2.0
            if fcx < x1 or fcx > x2 or fcy < y1 or fcy > y2:
                continue

            # Compute IoU between face bbox and track bbox
            inter_x1 = max(x1, fx1)
            inter_y1 = max(y1, fy1)
            inter_x2 = min(x2, fx2)
            inter_y2 = min(y2, fy2)
            inter_area = max(0.0, inter_x2 - inter_x1) * max(0.0, inter_y2 - inter_y1)
            face_area = (fx2 - fx1) * (fy2 - fy1)
            if face_area <= 0:
                continue
            # Use face coverage ratio (how much of face is inside track)
            iou = inter_area / face_area
            if iou > best_iou:
                best_iou = iou
                best_face = face

        if best_face is None:
            return None
        embedding = getattr(best_face, "embedding", None)
        if embedding is None or len(embedding) == 0:
            return None
        return _normalize_embedding(np.asarray(embedding, dtype=np.float32))

    def _match_employee(self, embedding: np.ndarray) -> Optional[Dict[str, Any]]:
        if self._employee_matrix is None or len(self._employee_registry) == 0:
            return None

        # Vectorized cosine similarity: (N,D) @ (D,) -> (N,)
        scores = self._employee_matrix @ embedding
        max_idx = int(np.argmax(scores))
        best = self._employee_registry[max_idx]

        return {
            "employee_id": best["employee_id"],
            "employee_code": best["employee_code"],
            "employee_name": best["employee_name"],
            "score": float(scores[max_idx]),
        }

#!/usr/bin/env python3
"""Siapkan dataset YOLO dari footage lokal lalu jalankan training."""

from __future__ import annotations

import argparse
import json
import random
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterable, Sequence


TRAIN_DIR = Path(__file__).resolve().parent
PROJECT_DIR = TRAIN_DIR.parent
PROJECT_ROOT = PROJECT_DIR.parent

DEFAULT_FOOTAGE_DIR = TRAIN_DIR / "footage"
DEFAULT_FRAMES_DIR = TRAIN_DIR / "frames"
DEFAULT_LABELS_DIR = TRAIN_DIR / "labels"
DEFAULT_DATASET_DIR = TRAIN_DIR / "dataset"
DEFAULT_RUNS_DIR = TRAIN_DIR / "runs"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}

if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))


class CliError(RuntimeError):
    """Human-friendly runtime error for CLI usage."""


def _resolve_path(value: str | Path) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = PROJECT_DIR / path
    return path.resolve()


def _is_path_like(value: str) -> bool:
    return value.startswith(".") or "/" in value or "\\" in value


ModelSourceFactory = Callable[[], str]


def _pick_first_existing_model(candidates: Sequence[Path], error_message: str) -> str:
    for candidate in candidates:
        if candidate.exists():
            return str(candidate.resolve())
    raise CliError(error_message)


def _default_training_model_source() -> str:
    return _pick_first_existing_model(
        (
            PROJECT_DIR / "edge" / "yolov5nu.pt",
            PROJECT_DIR / "edge" / "yolov5s.pt",
        ),
        "Model default training tidak ditemukan. Tambahkan file bobot lokal seperti "
        "`edge/yolov5nu.pt` atau berikan `--model`/`--train-model` secara eksplisit.",
    )


def _default_autolabel_model_source() -> str:
    return _pick_first_existing_model(
        (
            PROJECT_DIR / "edge" / "yolo26x.pt",
            PROJECT_DIR / "edge" / "yolo26n.pt",
            PROJECT_DIR / "edge" / "yolov5x6u.pt",
            PROJECT_DIR / "edge" / "yolov5nu.pt",
            PROJECT_DIR / "edge" / "yolov5s.pt",
        ),
        "Model default auto-label tidak ditemukan. Tambahkan file bobot lokal seperti "
        "`edge/yolo26x.pt`, `edge/yolov5x6u.pt`, atau berikan "
        "`--model`/`--autolabel-model` secara eksplisit.",
    )


def _resolve_model_source(
    value: str | None,
    default_factory: ModelSourceFactory = _default_training_model_source,
) -> str:
    if not value:
        return default_factory()

    raw_value = value.strip()
    candidate = Path(raw_value).expanduser()

    if candidate.is_absolute():
        resolved = candidate.resolve()
        if not resolved.exists():
            raise CliError(f"File model tidak ditemukan: {resolved}")
        return str(resolved)

    if _is_path_like(raw_value):
        resolved = _resolve_path(candidate)
        if not resolved.exists():
            raise CliError(f"File model tidak ditemukan: {resolved}")
        return str(resolved)

    project_candidate = _resolve_path(candidate)
    if project_candidate.exists():
        return str(project_candidate)

    # Nama model resmi Ultralytics, mis. yolo11n.pt
    return raw_value


def _list_files(directory: Path, extensions: set[str]) -> list[Path]:
    if not directory.exists():
        return []
    return sorted(
        path
        for path in directory.iterdir()
        if path.is_file() and path.suffix.lower() in extensions
    )


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _reset_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def _load_cv2():
    try:
        import cv2
    except ImportError as exc:
        raise CliError(
            "OpenCV belum ter-install. Pakai environment yang sudah meng-install "
            "`edge/requirements.txt`."
        ) from exc
    return cv2


def _load_yolo():
    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise CliError(
            "Package `ultralytics` belum tersedia. Pakai environment yang sudah "
            "meng-install `edge/requirements.txt`."
        ) from exc
    return YOLO


def _normalize_device(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized or normalized.lower() == "auto":
        return None
    return normalized


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _iter_image_label_pairs(
    frames_dir: Path,
    labels_dir: Path,
) -> list[tuple[Path, Path]]:
    images = _list_files(frames_dir, IMAGE_EXTENSIONS)
    pairs: list[tuple[Path, Path]] = []
    for image_path in images:
        label_path = labels_dir / f"{image_path.stem}.txt"
        pairs.append((image_path, label_path))
    return pairs


def _resolve_target_images(
    frames_dir: Path,
    requested_names: Sequence[str] | None = None,
) -> list[Path]:
    images = _list_files(frames_dir, IMAGE_EXTENSIONS)
    if not requested_names:
        return images

    image_map = {image_path.name: image_path for image_path in images}
    selected_images: list[Path] = []
    missing_names: list[str] = []

    for raw_name in requested_names:
        normalized_name = Path(raw_name).name.strip()
        if not normalized_name:
            continue

        image_path = image_map.get(normalized_name)
        if image_path is None:
            missing_names.append(normalized_name)
            continue
        selected_images.append(image_path)

    if missing_names:
        preview = ", ".join(missing_names[:5])
        raise CliError(f"Frame target tidak ditemukan di {frames_dir}: {preview}")

    if not selected_images:
        raise CliError("Tidak ada frame target yang valid untuk diproses.")

    return selected_images


def _validate_label_file(label_path: Path, class_count: int) -> None:
    if not label_path.exists():
        return

    for line_number, raw_line in enumerate(label_path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

        parts = line.split()
        if len(parts) != 5:
            raise CliError(
                f"Label tidak valid di {label_path} baris {line_number}: "
                "format YOLO harus berisi 5 kolom."
            )

        try:
            class_id = int(parts[0])
        except ValueError as exc:
            raise CliError(
                f"Class ID tidak valid di {label_path} baris {line_number}: {parts[0]!r}"
            ) from exc

        if class_id < 0 or class_id >= class_count:
            raise CliError(
                f"Class ID {class_id} di {label_path} baris {line_number} di luar "
                f"rentang 0..{class_count - 1}."
            )

        for value in parts[1:]:
            try:
                float(value)
            except ValueError as exc:
                raise CliError(
                    f"Koordinat YOLO tidak valid di {label_path} baris {line_number}: {value!r}"
                ) from exc


def _write_dataset_yaml(dataset_dir: Path, class_names: Sequence[str]) -> Path:
    yaml_path = dataset_dir / "data.yaml"
    lines = [
        f"path: {json.dumps(dataset_dir.as_posix(), ensure_ascii=False)}",
        f"train: {json.dumps('images/train', ensure_ascii=False)}",
        f"val: {json.dumps('images/val', ensure_ascii=False)}",
        f"nc: {len(class_names)}",
        "names:",
    ]
    for index, class_name in enumerate(class_names):
        lines.append(f"  {index}: {json.dumps(class_name, ensure_ascii=False)}")
    _write_text(yaml_path, "\n".join(lines) + "\n")
    return yaml_path


def _class_names_from_data_yaml(dataset_dir: Path) -> list[str]:
    yaml_path = dataset_dir / "data.yaml"
    if not yaml_path.exists():
        return []

    class_names: dict[int, str] = {}
    inside_names_block = False

    for raw_line in yaml_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        if not inside_names_block:
            if stripped == "names:":
                inside_names_block = True
            continue

        if not raw_line.startswith((" ", "\t")):
            break

        if ":" not in stripped:
            continue

        raw_key, raw_value = stripped.split(":", 1)
        try:
            index = int(raw_key.strip())
        except ValueError:
            continue

        value = raw_value.strip()
        if not value:
            continue

        try:
            if value.startswith('"'):
                parsed_value = json.loads(value)
            else:
                parsed_value = value.strip("'")
        except json.JSONDecodeError:
            parsed_value = value.strip("'\"")

        class_names[index] = parsed_value

    return [class_names[index] for index in sorted(class_names)]


def extract_frames(
    footage_dir: Path,
    frames_dir: Path,
    sample_every: int,
    max_frames_per_video: int,
    jpeg_quality: int,
    overwrite: bool,
) -> int:
    if sample_every < 1:
        raise CliError("`--sample-every` minimal bernilai 1.")
    if max_frames_per_video < 0:
        raise CliError("`--max-frames-per-video` tidak boleh negatif.")
    if jpeg_quality < 1 or jpeg_quality > 100:
        raise CliError("`--jpeg-quality` harus berada di rentang 1..100.")

    videos = _list_files(footage_dir, VIDEO_EXTENSIONS)
    if not videos:
        raise CliError(f"Tidak ada file video yang ditemukan di: {footage_dir}")

    cv2 = _load_cv2()
    if overwrite:
        _reset_dir(frames_dir)
    else:
        _ensure_dir(frames_dir)

    total_saved = 0
    print(f"[extract] memproses {len(videos)} video dari {footage_dir}")

    for video_path in videos:
        capture = cv2.VideoCapture(str(video_path))
        if not capture.isOpened():
            raise CliError(f"Gagal membuka video: {video_path}")

        frame_index = 0
        selected_count = 0
        saved_count = 0
        reused_count = 0

        while True:
            ok, frame = capture.read()
            if not ok:
                break

            if frame_index % sample_every == 0:
                output_name = f"{video_path.stem}__f{frame_index:06d}.jpg"
                output_path = frames_dir / output_name
                selected_count += 1

                if output_path.exists():
                    reused_count += 1
                else:
                    success = cv2.imwrite(
                        str(output_path),
                        frame,
                        [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality],
                    )
                    if not success:
                        raise CliError(f"Gagal menyimpan frame ke: {output_path}")
                    saved_count += 1
                    total_saved += 1

                if max_frames_per_video and selected_count >= max_frames_per_video:
                    break

            frame_index += 1

        capture.release()
        print(
            f"[extract] {video_path.name}: dipilih {selected_count} frame, "
            f"baru {saved_count}, reuse {reused_count}"
        )

    print(f"[extract] selesai, total frame baru: {total_saved}")
    return total_saved


def autolabel_frames(
    frames_dir: Path,
    labels_dir: Path,
    model_source: str,
    conf: float,
    imgsz: int,
    device: str | None,
    overwrite: bool,
    image_names: Sequence[str] | None = None,
) -> int:
    if conf <= 0 or conf >= 1:
        raise CliError("`--conf` harus berada di rentang 0..1.")
    if imgsz < 32:
        raise CliError("`--imgsz` minimal 32.")

    images = _resolve_target_images(frames_dir, image_names)
    if not images:
        raise CliError(f"Tidak ada frame yang ditemukan di: {frames_dir}")

    YOLO = _load_yolo()
    _ensure_dir(labels_dir)

    print(f"[autolabel] memuat model: {model_source}")
    model = YOLO(model_source)

    generated_count = 0
    skipped_count = 0
    total_boxes = 0
    predict_kwargs = {
        "conf": conf,
        "imgsz": imgsz,
        "classes": [0],  # person pada model COCO
        "verbose": False,
    }
    normalized_device = _normalize_device(device)
    if normalized_device is not None:
        predict_kwargs["device"] = normalized_device

    for index, image_path in enumerate(images, start=1):
        label_path = labels_dir / f"{image_path.stem}.txt"
        if label_path.exists() and not overwrite:
            skipped_count += 1
            continue

        result = model.predict(source=str(image_path), **predict_kwargs)[0]
        boxes = getattr(result, "boxes", None)
        lines: list[str] = []
        if boxes is not None and len(boxes) > 0:
            for cx, cy, width, height in boxes.xywhn.cpu().tolist():
                lines.append(f"0 {cx:.6f} {cy:.6f} {width:.6f} {height:.6f}")

        _write_text(label_path, "\n".join(lines) + ("\n" if lines else ""))
        generated_count += 1
        total_boxes += len(lines)

        if index % 25 == 0 or index == len(images):
            print(
                f"[autolabel] {index}/{len(images)} frame diproses, "
                f"box terkumpul: {total_boxes}"
            )

    print(
        f"[autolabel] selesai, label baru/refresh: {generated_count}, "
        f"skip existing: {skipped_count}, total box: {total_boxes}"
    )
    return generated_count


def prepare_dataset(
    frames_dir: Path,
    labels_dir: Path,
    dataset_dir: Path,
    class_names: Sequence[str],
    val_ratio: float,
    seed: int,
    allow_empty_labels: bool,
) -> Path:
    if not class_names:
        raise CliError("Minimal harus ada satu `--class-name`.")
    if val_ratio < 0 or val_ratio >= 1:
        raise CliError("`--val-ratio` harus berada di rentang 0..1.")

    pairs = _iter_image_label_pairs(frames_dir, labels_dir)
    if not pairs:
        raise CliError(
            f"Tidak ada frame yang ditemukan di {frames_dir}. Jalankan subcommand `extract` dulu."
        )

    missing_labels: list[str] = []
    valid_pairs: list[tuple[Path, Path]] = []

    for image_path, label_path in pairs:
        if not label_path.exists():
            if allow_empty_labels:
                _write_text(label_path, "")
            else:
                missing_labels.append(label_path.name)
                continue
        _validate_label_file(label_path, len(class_names))
        valid_pairs.append((image_path, label_path))

    if missing_labels:
        preview = ", ".join(missing_labels[:5])
        raise CliError(
            "Masih ada label yang belum dibuat. Contoh: "
            f"{preview}. Jalankan `autolabel`, anotasi manual, atau pakai "
            "`--allow-empty-labels` bila frame tersebut memang tidak punya objek."
        )

    rng = random.Random(seed)
    rng.shuffle(valid_pairs)

    if len(valid_pairs) == 1:
        train_pairs = valid_pairs
        val_pairs: list[tuple[Path, Path]] = []
    else:
        val_count = int(round(len(valid_pairs) * val_ratio))
        val_count = min(max(1, val_count), len(valid_pairs) - 1)
        val_pairs = valid_pairs[:val_count]
        train_pairs = valid_pairs[val_count:]

    images_train_dir = dataset_dir / "images" / "train"
    images_val_dir = dataset_dir / "images" / "val"
    labels_train_dir = dataset_dir / "labels" / "train"
    labels_val_dir = dataset_dir / "labels" / "val"

    for target_dir in (images_train_dir, images_val_dir, labels_train_dir, labels_val_dir):
        _reset_dir(target_dir)

    def copy_pairs(items: Iterable[tuple[Path, Path]], image_dir: Path, label_dir: Path) -> None:
        for image_path, label_path in items:
            shutil.copy2(image_path, image_dir / image_path.name)
            shutil.copy2(label_path, label_dir / label_path.name)

    copy_pairs(train_pairs, images_train_dir, labels_train_dir)
    copy_pairs(val_pairs, images_val_dir, labels_val_dir)

    yaml_path = _write_dataset_yaml(dataset_dir, class_names)
    print(
        f"[prepare] dataset siap: train={len(train_pairs)} image, "
        f"val={len(val_pairs)} image, yaml={yaml_path}"
    )
    return yaml_path


def launch_manual_labeler(
    frames_dir: Path,
    labels_dir: Path,
    dataset_dir: Path,
    class_names: Sequence[str],
    host: str,
    port: int,
) -> None:
    if port < 1 or port > 65535:
        raise CliError("`--port` harus berada di rentang 1..65535.")

    images = _list_files(frames_dir, IMAGE_EXTENSIONS)
    if not images:
        raise CliError(
            f"Tidak ada frame yang ditemukan di {frames_dir}. Jalankan subcommand `extract` dulu."
        )

    resolved_class_names = list(class_names) or _class_names_from_data_yaml(dataset_dir) or ["person"]

    try:
        from yolo_lab.app.server import run_server
    except ImportError as exc:
        raise CliError(
            "Package app YOLO lab tidak dapat dimuat. Pastikan folder `yolo_lab/app` lengkap."
        ) from exc

    try:
        run_server(
            frames_dir=frames_dir,
            labels_dir=labels_dir,
            class_names=resolved_class_names,
            host=host,
            port=port,
        )
    except OSError as exc:
        raise CliError(f"Gagal menjalankan server manual labeler: {exc}") from exc


def train_model(
    data_yaml: Path,
    model_source: str,
    runs_dir: Path,
    run_name: str | None,
    epochs: int,
    imgsz: int,
    batch: int,
    device: str | None,
    workers: int,
    patience: int,
    cache: bool,
) -> Path:
    if not data_yaml.exists():
        raise CliError(f"File dataset YAML tidak ditemukan: {data_yaml}")
    if epochs < 1:
        raise CliError("`--epochs` minimal 1.")
    if imgsz < 32:
        raise CliError("`--imgsz` minimal 32.")
    if batch == 0 or batch < -1:
        raise CliError("`--batch` tidak valid. Gunakan -1 atau bilangan positif.")
    if workers < 0:
        raise CliError("`--workers` tidak boleh negatif.")
    if patience < 0:
        raise CliError("`--patience` tidak boleh negatif.")

    YOLO = _load_yolo()
    _ensure_dir(runs_dir)

    training_run_name = run_name or f"visitor_person_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    normalized_device = _normalize_device(device)

    print(f"[train] memuat model: {model_source}")
    model = YOLO(model_source)

    train_kwargs = {
        "data": str(data_yaml),
        "epochs": epochs,
        "imgsz": imgsz,
        "batch": batch,
        "project": str(runs_dir),
        "name": training_run_name,
        "workers": workers,
        "patience": patience,
        "plots": True,
        "exist_ok": False,
        "verbose": True,
    }
    if normalized_device is not None:
        train_kwargs["device"] = normalized_device
    if cache:
        train_kwargs["cache"] = True

    results = model.train(**train_kwargs)
    save_dir = Path(results.save_dir)
    best_weights = save_dir / "weights" / "best.pt"

    print(f"[train] selesai, output: {save_dir}")
    if best_weights.exists():
        print(f"[train] best weights: {best_weights}")
    return save_dir


def _default_class_names(parsed_values: Sequence[str] | None) -> list[str]:
    if not parsed_values:
        return ["person"]
    cleaned = [value.strip() for value in parsed_values if value.strip()]
    if not cleaned:
        return ["person"]
    return cleaned


def _add_shared_path_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--footage-dir",
        default=str(DEFAULT_FOOTAGE_DIR),
        help="Folder yang berisi video mentah untuk training.",
    )
    parser.add_argument(
        "--frames-dir",
        default=str(DEFAULT_FRAMES_DIR),
        help="Folder keluaran frame hasil ekstraksi.",
    )
    parser.add_argument(
        "--labels-dir",
        default=str(DEFAULT_LABELS_DIR),
        help="Folder label YOLO (.txt) untuk tiap frame.",
    )
    parser.add_argument(
        "--dataset-dir",
        default=str(DEFAULT_DATASET_DIR),
        help="Folder dataset YOLO hasil split train/val.",
    )
    parser.add_argument(
        "--runs-dir",
        default=str(DEFAULT_RUNS_DIR),
        help="Folder hasil training Ultralytics.",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "CLI untuk menyiapkan dataset YOLO dari footage di folder train lalu "
            "menjalankan training dengan Ultralytics."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    extract_parser = subparsers.add_parser(
        "extract",
        help="Ekstrak frame dari video di folder footage.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    _add_shared_path_args(extract_parser)
    extract_parser.add_argument("--sample-every", type=int, default=15, help="Ambil 1 frame tiap N frame.")
    extract_parser.add_argument(
        "--max-frames-per-video",
        type=int,
        default=0,
        help="Batas jumlah frame yang diambil per video. 0 = tanpa batas.",
    )
    extract_parser.add_argument("--jpeg-quality", type=int, default=95, help="Kualitas JPEG output.")
    extract_parser.add_argument(
        "--overwrite-frames",
        action="store_true",
        help="Hapus folder frame lama sebelum ekstraksi ulang.",
    )

    autolabel_parser = subparsers.add_parser(
        "autolabel",
        help="Buat pseudo-label YOLO (class person) dari frame hasil ekstraksi.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    _add_shared_path_args(autolabel_parser)
    autolabel_parser.add_argument(
        "--model",
        default="",
        help=(
            "Path file bobot lokal atau nama model Ultralytics. Default mencoba "
            "model auto-label terbaik yang ada secara lokal."
        ),
    )
    autolabel_parser.add_argument("--conf", type=float, default=0.35, help="Confidence threshold pseudo-label.")
    autolabel_parser.add_argument("--imgsz", type=int, default=960, help="Ukuran inferensi saat auto-label.")
    autolabel_parser.add_argument(
        "--device",
        default="auto",
        help="Device Ultralytics, mis. cpu, cuda:0, atau auto.",
    )
    autolabel_parser.add_argument(
        "--overwrite-labels",
        action="store_true",
        help="Timpa label yang sudah ada.",
    )
    autolabel_parser.add_argument(
        "--image-name",
        action="append",
        default=None,
        help="Nama frame tertentu yang ingin di-auto-label. Ulangi argumen untuk multi-frame.",
    )

    prepare_parser = subparsers.add_parser(
        "prepare",
        help="Bangun struktur dataset YOLO train/val dari frame dan label.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    _add_shared_path_args(prepare_parser)
    prepare_parser.add_argument(
        "--class-name",
        action="append",
        default=None,
        help="Nama class dataset. Ulangi argumen untuk multi-class.",
    )
    prepare_parser.add_argument("--val-ratio", type=float, default=0.2, help="Proporsi validation set.")
    prepare_parser.add_argument("--seed", type=int, default=42, help="Seed shuffle dataset.")
    prepare_parser.add_argument(
        "--allow-empty-labels",
        action="store_true",
        help="Buat file label kosong bila frame memang tidak punya objek.",
    )

    train_parser = subparsers.add_parser(
        "train",
        help="Jalankan training Ultralytics dari dataset yang sudah siap.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    _add_shared_path_args(train_parser)
    train_parser.add_argument(
        "--data",
        default="",
        help="Override path data.yaml. Default memakai dataset-dir/data.yaml.",
    )
    train_parser.add_argument(
        "--model",
        default="",
        help="Path file bobot lokal atau nama model Ultralytics.",
    )
    train_parser.add_argument("--epochs", type=int, default=50, help="Jumlah epoch training.")
    train_parser.add_argument("--imgsz", type=int, default=960, help="Ukuran image training.")
    train_parser.add_argument("--batch", type=int, default=8, help="Batch size training.")
    train_parser.add_argument(
        "--device",
        default="auto",
        help="Device training, mis. cpu, cuda:0, atau auto.",
    )
    train_parser.add_argument("--workers", type=int, default=2, help="Jumlah worker dataloader.")
    train_parser.add_argument("--patience", type=int, default=20, help="Early stopping patience.")
    train_parser.add_argument("--run-name", default="", help="Nama folder run training.")
    train_parser.add_argument("--cache", action="store_true", help="Cache image dataset di training.")

    prepare_train_parser = subparsers.add_parser(
        "prepare-train",
        help="Bangun dataset dari label saat ini lalu jalankan training tanpa auto-label ulang.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    _add_shared_path_args(prepare_train_parser)
    prepare_train_parser.add_argument(
        "--class-name",
        action="append",
        default=None,
        help="Nama class dataset. Ulangi argumen untuk multi-class.",
    )
    prepare_train_parser.add_argument("--val-ratio", type=float, default=0.2, help="Proporsi validation set.")
    prepare_train_parser.add_argument("--seed", type=int, default=42, help="Seed shuffle dataset.")
    prepare_train_parser.add_argument(
        "--allow-empty-labels",
        action="store_true",
        help="Buat label kosong untuk frame tanpa objek.",
    )
    prepare_train_parser.add_argument(
        "--data",
        default="",
        help="Override path data.yaml. Default memakai dataset-dir/data.yaml hasil prepare.",
    )
    prepare_train_parser.add_argument(
        "--model",
        default="",
        help="Path file bobot lokal atau nama model Ultralytics.",
    )
    prepare_train_parser.add_argument("--epochs", type=int, default=50, help="Jumlah epoch training.")
    prepare_train_parser.add_argument("--imgsz", type=int, default=960, help="Ukuran image training.")
    prepare_train_parser.add_argument("--batch", type=int, default=8, help="Batch size training.")
    prepare_train_parser.add_argument(
        "--device",
        default="auto",
        help="Device training, mis. cpu, cuda:0, atau auto.",
    )
    prepare_train_parser.add_argument("--workers", type=int, default=2, help="Jumlah worker dataloader.")
    prepare_train_parser.add_argument("--patience", type=int, default=20, help="Early stopping patience.")
    prepare_train_parser.add_argument("--run-name", default="", help="Nama folder run training.")
    prepare_train_parser.add_argument("--cache", action="store_true", help="Cache image dataset di training.")

    label_ui_parser = subparsers.add_parser(
        "label-ui",
        help="Jalankan interface lokal untuk anotasi manual frame ke label YOLO.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    _add_shared_path_args(label_ui_parser)
    label_ui_parser.add_argument(
        "--class-name",
        action="append",
        default=None,
        help="Override nama class. Kalau kosong, coba baca dari dataset/data.yaml lalu fallback ke `person`.",
    )
    label_ui_parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host server lokal untuk interface labeling.",
    )
    label_ui_parser.add_argument(
        "--port",
        type=int,
        default=8765,
        help="Port server lokal untuk interface labeling.",
    )

    pipeline_parser = subparsers.add_parser(
        "pipeline",
        help="Jalankan extract -> autolabel -> prepare -> train sekaligus.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    _add_shared_path_args(pipeline_parser)
    pipeline_parser.add_argument("--sample-every", type=int, default=15, help="Ambil 1 frame tiap N frame.")
    pipeline_parser.add_argument(
        "--max-frames-per-video",
        type=int,
        default=0,
        help="Batas jumlah frame yang diambil per video. 0 = tanpa batas.",
    )
    pipeline_parser.add_argument("--jpeg-quality", type=int, default=95, help="Kualitas JPEG output.")
    pipeline_parser.add_argument(
        "--overwrite-frames",
        action="store_true",
        help="Hapus folder frame lama sebelum ekstraksi ulang.",
    )
    pipeline_parser.add_argument(
        "--overwrite-labels",
        action="store_true",
        help="Timpa label pseudo yang sudah ada.",
    )
    pipeline_parser.add_argument(
        "--class-name",
        action="append",
        default=None,
        help="Nama class dataset. Ulangi argumen untuk multi-class.",
    )
    pipeline_parser.add_argument("--val-ratio", type=float, default=0.2, help="Proporsi validation set.")
    pipeline_parser.add_argument("--seed", type=int, default=42, help="Seed shuffle dataset.")
    pipeline_parser.add_argument(
        "--allow-empty-labels",
        action="store_true",
        help="Buat label kosong untuk frame tanpa objek.",
    )
    pipeline_parser.add_argument(
        "--model",
        default="",
        help=(
            "Shortcut untuk memakai model yang sama pada tahap auto-label dan "
            "training. Diabaikan bila `--autolabel-model` atau `--train-model` diisi."
        ),
    )
    pipeline_parser.add_argument(
        "--autolabel-model",
        default="",
        help="Path file bobot lokal atau nama model Ultralytics untuk tahap auto-label.",
    )
    pipeline_parser.add_argument(
        "--train-model",
        default="",
        help="Path file bobot lokal atau nama model Ultralytics untuk tahap training.",
    )
    pipeline_parser.add_argument("--conf", type=float, default=0.35, help="Confidence threshold pseudo-label.")
    pipeline_parser.add_argument(
        "--device",
        default="auto",
        help="Device inferensi dan training, mis. cpu, cuda:0, atau auto.",
    )
    pipeline_parser.add_argument("--imgsz", type=int, default=960, help="Ukuran inferensi dan training.")
    pipeline_parser.add_argument("--epochs", type=int, default=50, help="Jumlah epoch training.")
    pipeline_parser.add_argument("--batch", type=int, default=8, help="Batch size training.")
    pipeline_parser.add_argument("--workers", type=int, default=2, help="Jumlah worker dataloader.")
    pipeline_parser.add_argument("--patience", type=int, default=20, help="Early stopping patience.")
    pipeline_parser.add_argument("--run-name", default="", help="Nama folder run training.")
    pipeline_parser.add_argument("--cache", action="store_true", help="Cache image dataset di training.")

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    footage_dir = _resolve_path(args.footage_dir)
    frames_dir = _resolve_path(args.frames_dir)
    labels_dir = _resolve_path(args.labels_dir)
    dataset_dir = _resolve_path(args.dataset_dir)
    runs_dir = _resolve_path(args.runs_dir)

    try:
        if args.command == "extract":
            extract_frames(
                footage_dir=footage_dir,
                frames_dir=frames_dir,
                sample_every=args.sample_every,
                max_frames_per_video=args.max_frames_per_video,
                jpeg_quality=args.jpeg_quality,
                overwrite=args.overwrite_frames,
            )
            return 0

        if args.command == "autolabel":
            autolabel_frames(
                frames_dir=frames_dir,
                labels_dir=labels_dir,
                model_source=_resolve_model_source(
                    args.model,
                    default_factory=_default_autolabel_model_source,
                ),
                conf=args.conf,
                imgsz=args.imgsz,
                device=args.device,
                overwrite=args.overwrite_labels,
                image_names=args.image_name,
            )
            return 0

        if args.command == "prepare":
            prepare_dataset(
                frames_dir=frames_dir,
                labels_dir=labels_dir,
                dataset_dir=dataset_dir,
                class_names=_default_class_names(args.class_name),
                val_ratio=args.val_ratio,
                seed=args.seed,
                allow_empty_labels=args.allow_empty_labels,
            )
            return 0

        if args.command == "train":
            data_yaml = _resolve_path(args.data) if args.data else dataset_dir / "data.yaml"
            train_model(
                data_yaml=data_yaml,
                model_source=_resolve_model_source(
                    args.model,
                    default_factory=_default_training_model_source,
                ),
                runs_dir=runs_dir,
                run_name=args.run_name or None,
                epochs=args.epochs,
                imgsz=args.imgsz,
                batch=args.batch,
                device=args.device,
                workers=args.workers,
                patience=args.patience,
                cache=args.cache,
            )
            return 0

        if args.command == "prepare-train":
            data_yaml = prepare_dataset(
                frames_dir=frames_dir,
                labels_dir=labels_dir,
                dataset_dir=dataset_dir,
                class_names=_default_class_names(args.class_name),
                val_ratio=args.val_ratio,
                seed=args.seed,
                allow_empty_labels=args.allow_empty_labels,
            )
            train_model(
                data_yaml=_resolve_path(args.data) if args.data else data_yaml,
                model_source=_resolve_model_source(
                    args.model,
                    default_factory=_default_training_model_source,
                ),
                runs_dir=runs_dir,
                run_name=args.run_name or None,
                epochs=args.epochs,
                imgsz=args.imgsz,
                batch=args.batch,
                device=args.device,
                workers=args.workers,
                patience=args.patience,
                cache=args.cache,
            )
            return 0

        if args.command == "label-ui":
            launch_manual_labeler(
                frames_dir=frames_dir,
                labels_dir=labels_dir,
                dataset_dir=dataset_dir,
                class_names=_default_class_names(args.class_name) if args.class_name else [],
                host=args.host,
                port=args.port,
            )
            return 0

        if args.command == "pipeline":
            class_names = _default_class_names(args.class_name)
            autolabel_model_source = _resolve_model_source(
                args.autolabel_model or args.model,
                default_factory=_default_autolabel_model_source,
            )
            train_model_source = _resolve_model_source(
                args.train_model or args.model,
                default_factory=_default_training_model_source,
            )

            print(f"[pipeline] model auto-label: {autolabel_model_source}")
            print(f"[pipeline] model training: {train_model_source}")

            extract_frames(
                footage_dir=footage_dir,
                frames_dir=frames_dir,
                sample_every=args.sample_every,
                max_frames_per_video=args.max_frames_per_video,
                jpeg_quality=args.jpeg_quality,
                overwrite=args.overwrite_frames,
            )
            autolabel_frames(
                frames_dir=frames_dir,
                labels_dir=labels_dir,
                model_source=autolabel_model_source,
                conf=args.conf,
                imgsz=args.imgsz,
                device=args.device,
                overwrite=args.overwrite_labels,
            )
            data_yaml = prepare_dataset(
                frames_dir=frames_dir,
                labels_dir=labels_dir,
                dataset_dir=dataset_dir,
                class_names=class_names,
                val_ratio=args.val_ratio,
                seed=args.seed,
                allow_empty_labels=args.allow_empty_labels,
            )
            train_model(
                data_yaml=data_yaml,
                model_source=train_model_source,
                runs_dir=runs_dir,
                run_name=args.run_name or None,
                epochs=args.epochs,
                imgsz=args.imgsz,
                batch=args.batch,
                device=args.device,
                workers=args.workers,
                patience=args.patience,
                cache=args.cache,
            )
            return 0

        raise CliError(f"Subcommand belum didukung: {args.command}")
    except CliError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Dibatalkan oleh user.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())

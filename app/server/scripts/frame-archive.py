#!/usr/bin/env python3

import json
import os
import re
import shutil
import sys
import zipfile
from datetime import datetime, timezone

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
LABEL_EXTENSIONS = {".txt"}
CHECKPOINT_FILE = ".manual_labeler_checkpoint.json"
MANIFEST_FILE = "yolo-lab-frame-archive.json"
BUNDLE_FORMAT = "yolo-lab-frame-archive"
BUNDLE_VERSION = 1
SAFE_SUBDIR_RE = re.compile(r"^[A-Za-z0-9._-]+$")


def fail(message):
    print(str(message), file=sys.stderr)
    raise SystemExit(1)


def normalize_subdir(raw_value, field_name):
    normalized = str(raw_value or "").strip().replace("\\", "/").strip("/")
    if normalized in {"", "."}:
        return ""
    if "/" in normalized:
        fail(
            f"Field `{field_name}` hanya boleh root atau satu subfolder langsung di bawah train/frames."
        )
    if normalized in {"..", "."} or not SAFE_SUBDIR_RE.fullmatch(normalized):
        fail(
            f"Field `{field_name}` hanya boleh berisi huruf, angka, titik, strip, dan underscore."
        )
    return normalized


def ensure_inside(root_path, target_path, label):
    root_abs = os.path.abspath(root_path)
    target_abs = os.path.abspath(target_path)
    try:
        common = os.path.commonpath([root_abs, target_abs])
    except ValueError:
        fail(f"{label} berada di luar root yang diizinkan.")
    if common != root_abs:
        fail(f"{label} berada di luar root yang diizinkan.")
    return target_abs


def list_top_level_files(directory_path):
    if not os.path.isdir(directory_path):
        return []

    files = []
    for entry_name in sorted(os.listdir(directory_path)):
        entry_path = os.path.join(directory_path, entry_name)
        if os.path.isfile(entry_path):
            files.append((entry_name, entry_path))
    return files


def split_archive_member(member_name):
    normalized = str(member_name or "").replace("\\", "/")
    if normalized.startswith("/"):
        fail("Bundle zip tidak valid: ada path absolut di dalam archive.")

    parts = [part for part in normalized.split("/") if part not in {"", "."}]
    if any(part == ".." for part in parts):
        fail("Bundle zip tidak valid: ada path traversal di dalam archive.")
    return parts


def export_archive(frames_dir, labels_dir, output_zip_path, metadata_json):
    metadata = json.loads(metadata_json or "{}")
    frames_subdir = normalize_subdir(metadata.get("framesSubdir"), "framesSubdir")
    labels_subdir = normalize_subdir(metadata.get("labelsSubdir"), "labelsSubdir")

    if frames_subdir != labels_subdir:
        fail("Metadata bundle tidak valid: subfolder frames dan labels harus sama.")

    frame_files = [
        (name, file_path)
        for name, file_path in list_top_level_files(frames_dir)
        if os.path.splitext(name)[1].lower() in IMAGE_EXTENSIONS
    ]
    if not frame_files:
        fail("Folder frame aktif kosong. Tidak ada frame yang bisa diexport.")

    label_files = []
    label_count = 0
    checkpoint_included = False
    for name, file_path in list_top_level_files(labels_dir):
        extension = os.path.splitext(name)[1].lower()
        if name == CHECKPOINT_FILE:
            checkpoint_included = True
            label_files.append((name, file_path))
            continue
        if extension in LABEL_EXTENSIONS:
            label_count += 1
            label_files.append((name, file_path))

    os.makedirs(os.path.dirname(output_zip_path), exist_ok=True)

    manifest = {
        "format": BUNDLE_FORMAT,
        "version": BUNDLE_VERSION,
        "exportedAt": metadata.get("exportedAt")
        or datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "framesSubdir": frames_subdir,
        "labelsSubdir": labels_subdir,
        "framesDir": metadata.get("framesDir") or "",
        "labelsDir": metadata.get("labelsDir") or "",
        "classNames": metadata.get("classNames") or [],
        "checkpointImage": metadata.get("checkpointImage") or None,
        "imageCount": len(frame_files),
        "labelCount": label_count,
        "checkpointIncluded": checkpoint_included,
    }

    with zipfile.ZipFile(output_zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(f"{MANIFEST_FILE}", json.dumps(manifest, indent=2) + "\n")
        for name, file_path in frame_files:
            archive.write(file_path, f"frames/{name}")
        for name, file_path in label_files:
            archive.write(file_path, f"labels/{name}")

    print(
        json.dumps(
            {
                "manifestFile": MANIFEST_FILE,
                "framesSubdir": frames_subdir,
                "labelsSubdir": labels_subdir,
                "imageCount": len(frame_files),
                "labelCount": label_count,
                "checkpointIncluded": checkpoint_included,
                "archivePath": output_zip_path,
            }
        )
    )


def import_archive(zip_path, frames_root_dir, labels_root_dir, target_subdir_raw):
    if not os.path.isfile(zip_path):
        fail(f"Bundle zip tidak ditemukan: {zip_path}")

    with zipfile.ZipFile(zip_path, "r") as archive:
        manifest = None
        frame_entries = []
        label_entries = []
        seen_names = set()

        for info in archive.infolist():
            if info.is_dir():
                continue

            parts = split_archive_member(info.filename)
            if not parts:
                continue

            key = "/".join(parts)
            if key in seen_names:
                fail(f"Bundle zip tidak valid: file duplikat ditemukan di archive ({key}).")
            seen_names.add(key)

            if parts == [MANIFEST_FILE]:
                try:
                    manifest = json.loads(archive.read(info).decode("utf-8"))
                except Exception as error:  # noqa: BLE001
                    fail(f"Gagal membaca manifest bundle: {error}")
                continue

            section = parts[0]
            if section == "frames":
                if len(parts) != 2:
                    fail("Bundle zip tidak valid: folder frames hanya boleh berisi file langsung.")
                file_name = parts[1]
                extension = os.path.splitext(file_name)[1].lower()
                if extension not in IMAGE_EXTENSIONS:
                    fail(f"Bundle zip tidak valid: file frames tidak didukung ({file_name}).")
                frame_entries.append((file_name, info))
                continue

            if section == "labels":
                if len(parts) != 2:
                    fail("Bundle zip tidak valid: folder labels hanya boleh berisi file langsung.")
                file_name = parts[1]
                extension = os.path.splitext(file_name)[1].lower()
                if file_name != CHECKPOINT_FILE and extension not in LABEL_EXTENSIONS:
                    fail(f"Bundle zip tidak valid: file label tidak didukung ({file_name}).")
                label_entries.append((file_name, info))
                continue

            fail(
                "Bundle zip tidak valid: isi archive hanya boleh `frames/`, `labels/`, dan manifest bundle."
            )

        if not manifest:
            fail(
                f"Bundle zip tidak valid: file manifest `{MANIFEST_FILE}` tidak ditemukan."
            )
        if manifest.get("format") != BUNDLE_FORMAT:
            fail("Bundle zip tidak valid: format bundle tidak dikenali.")
        if int(manifest.get("version") or 0) != BUNDLE_VERSION:
            fail(
                "Bundle zip tidak valid: versi bundle tidak didukung oleh project ini."
            )
        if not frame_entries:
            fail("Bundle zip tidak valid: tidak ada frame di folder `frames/`.")

        source_frames_subdir = normalize_subdir(manifest.get("framesSubdir"), "framesSubdir")
        source_labels_subdir = normalize_subdir(manifest.get("labelsSubdir"), "labelsSubdir")
        if source_frames_subdir != source_labels_subdir:
            fail("Bundle zip tidak valid: subfolder frames dan labels pada manifest tidak sinkron.")

        target_subdir = normalize_subdir(
            target_subdir_raw if str(target_subdir_raw or "").strip() else source_frames_subdir,
            "targetSubdir" if str(target_subdir_raw or "").strip() else "framesSubdir",
        )

        target_frames_dir = ensure_inside(
            frames_root_dir, os.path.join(frames_root_dir, target_subdir), "Target frames"
        )
        target_labels_dir = ensure_inside(
            labels_root_dir, os.path.join(labels_root_dir, target_subdir), "Target labels"
        )

        conflicts = []
        for file_name, _info in frame_entries:
            if os.path.exists(os.path.join(target_frames_dir, file_name)):
                conflicts.append(f"frames/{file_name}")
        for file_name, _info in label_entries:
            if os.path.exists(os.path.join(target_labels_dir, file_name)):
                conflicts.append(f"labels/{file_name}")

        if conflicts:
            preview = ", ".join(conflicts[:5])
            suffix = " dan file lain." if len(conflicts) > 5 else "."
            fail(
                f"Import dibatalkan karena target sudah memiliki file dengan nama sama: {preview}{suffix}"
            )

        os.makedirs(target_frames_dir, exist_ok=True)
        os.makedirs(target_labels_dir, exist_ok=True)

        for file_name, info in frame_entries:
            destination_path = os.path.join(target_frames_dir, file_name)
            with archive.open(info, "r") as source_handle, open(destination_path, "wb") as dest_handle:
                shutil.copyfileobj(source_handle, dest_handle)

        checkpoint_imported = False
        imported_label_count = 0
        for file_name, info in label_entries:
            destination_path = os.path.join(target_labels_dir, file_name)
            with archive.open(info, "r") as source_handle, open(destination_path, "wb") as dest_handle:
                shutil.copyfileobj(source_handle, dest_handle)
            if file_name == CHECKPOINT_FILE:
                checkpoint_imported = True
            else:
                imported_label_count += 1

    print(
        json.dumps(
            {
                "manifestFile": MANIFEST_FILE,
                "framesSubdir": target_subdir,
                "sourceFramesSubdir": source_frames_subdir,
                "imageCount": len(frame_entries),
                "labelCount": imported_label_count,
                "checkpointImported": checkpoint_imported,
                "checkpointImage": manifest.get("checkpointImage") or None,
            }
        )
    )


def main():
    if len(sys.argv) < 2:
        fail("Mode script archive belum diberikan.")

    mode = sys.argv[1].strip().lower()

    if mode == "export":
        if len(sys.argv) != 6:
            fail("Argumen export archive tidak lengkap.")
        export_archive(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
        return

    if mode == "import":
        if len(sys.argv) != 6:
            fail("Argumen import archive tidak lengkap.")
        import_archive(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
        return

    fail(f"Mode archive tidak dikenali: {mode}")


if __name__ == "__main__":
    main()

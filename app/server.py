#!/usr/bin/env python3
"""Compatibility launcher for the Bun-based YOLO Lab app server."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


MODULE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = MODULE_DIR.parents[0]
BUN_ENTRYPOINT = MODULE_DIR / "server.js"


def _bun_bin() -> str:
    bun_bin = shutil.which("bun")
    if bun_bin:
        return bun_bin
    raise OSError(
        "Bun belum ter-install atau belum masuk PATH. "
        "Install Bun lalu jalankan lagi server YOLO Lab."
    )


def run_server(
    *,
    frames_dir: Path,
    labels_dir: Path,
    class_names: list[str],
    host: str = "127.0.0.1",
    port: int = 8765,
) -> None:
    if not BUN_ENTRYPOINT.exists():
        raise OSError(f"Entrypoint Bun server tidak ditemukan: {BUN_ENTRYPOINT}")

    command = [
        _bun_bin(),
        str(BUN_ENTRYPOINT),
        "--frames-dir",
        str(Path(frames_dir).resolve()),
        "--labels-dir",
        str(Path(labels_dir).resolve()),
        "--host",
        host,
        "--port",
        str(port),
    ]

    for class_name in class_names:
        normalized = str(class_name).strip()
        if normalized:
            command.extend(["--class-name", normalized])

    try:
        subprocess.run(command, cwd=str(PROJECT_DIR), check=True)
    except subprocess.CalledProcessError as exc:
        raise OSError(f"Server Bun berhenti dengan kode {exc.returncode}.") from exc


if __name__ == "__main__":
    run_server(
        frames_dir=PROJECT_DIR / "train" / "frames",
        labels_dir=PROJECT_DIR / "train" / "labels",
        class_names=["person"],
    )
